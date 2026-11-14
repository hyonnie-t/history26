/* v178(2026-11-14) — 활동 웹앱의 «🙋 선생님 도와주세요» 버튼 점검.
 * 배포된 웹앱(hyonnie-t.github.io/<앱>/)을 열되 snippets/portal_auth.js·help_button.js 요청은 이 레포 파일로 바꿔 준다(route).
 * Apps Script로 가는 POST는 전부 가짜 응답으로 막는다(시트에 아무것도 안 씀). GET은 helpMine만 가짜, 나머지는 그대로(읽기).
 * 사용: node tests/webapp-testing/help_apps_check.js <출력 폴더> [앱1,앱2,...]   (PW_MODULE=<playwright 경로>)
 * 보는 것(앱마다, 폰 375·태블릿 768/1180·PC 1280):
 *  - 세션 있고 sid 같음 → 버튼 1개, 화면 안, 웹앱 고정 요소와 겹치지 않음, 가로 넘침 없음
 *  - 누르면 창 → «선생님 부르기» → «선생님이 곧 와요» → «혼자 해결했어요» → 원래 버튼 (한 폭에서만)
 *  - ?preview=1 / 세션 없음 / 다른 학번 sid → 버튼 없음
 *  - 포털(history26/)은 자기 버튼만 1개(웹앱용 버튼이 겹쳐 뜨지 않음)
 */
const fs = require('fs'), path = require('path');
function loadPlaywright() {
  const cands = ['playwright', process.env.PW_MODULE || '',
    'C:/Users/alfzl/AppData/Local/npm-cache/_npx/daf98f25e57265ec/node_modules/playwright',
    'C:/Users/user/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright'].filter(Boolean);
  for (const c of cands) { try { return require(c); } catch (e) { /* 다음 */ } }
  throw new Error('playwright 모듈을 못 찾음. PW_MODULE=<경로>');
}
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = process.argv[2]; if (!OUT) { console.error('사용: node help_apps_check.js <출력 폴더> [앱,...]'); process.exit(2); }
const APPS = (process.argv[3] || 'nation-building,empire-rebut,suffrage_age').split(',');
fs.mkdirSync(OUT, { recursive: true });
const SNIP = {
  portal_auth: fs.readFileSync(path.join(ROOT, 'snippets', 'portal_auth.js'), 'utf8'),
  help_button: fs.readFileSync(path.join(ROOT, 'snippets', 'help_button.js'), 'utf8'),
};
const SID = '20199', NAME = '테스트';
const SIZES = [[375, 812, '폰'], [768, 1024, '태블릿세로'], [1180, 820, '태블릿가로'], [1280, 800, 'PC']];
const J = o => ({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
const results = []; let fails = 0;
const ok = (app, what, pass, more) => { results.push({ app, what, pass, more: more || '' }); if (!pass) fails++; console.log((pass ? 'O ' : 'X ') + app + ' | ' + what + (more ? ' | ' + more : '')); };

(async () => {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ channel: 'chrome' });
  async function newPage(w, h, { session = true, sessSid = SID } = {}) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    if (session) await ctx.addInitScript(([sid, name]) => {
      try { localStorage.setItem('h26_auth', JSON.stringify({ token: 'test-token', exp: Date.now() + 3600e3, sid, name })); } catch (e) {}
    }, [sessSid, NAME]);
    else await ctx.addInitScript(() => { try { localStorage.removeItem('h26_auth'); localStorage.removeItem('h26_help_wait'); } catch (e) {} });
    const page = await ctx.newPage();
    const state = { mine: null, calls: [] };
    await page.route(/hyonnie-t\.github\.io\/history26\/snippets\/(portal_auth|help_button)\.js/, r => {
      const k = /help_button/.test(r.request().url()) ? 'help_button' : 'portal_auth';
      r.fulfill({ status: 200, contentType: 'text/javascript', body: SNIP[k] });
    });
    await page.route(/script\.google(usercontent)?\.com/, r => {
      const req = r.request(), url = req.url();
      if (req.method() === 'POST') {
        let b = {}; try { b = JSON.parse(req.postData() || '{}'); } catch (e) {}
        state.calls.push(b.action || '?');
        if (b.action === 'helpAsk') { const already = !!state.mine; state.mine = { status: '대기', question: b.question || '', since: new Date().toISOString() }; return r.fulfill(J({ result: 'success', mine: state.mine, already, gotSession: b.session })); }
        if (b.action === 'helpCancel') { state.mine = null; return r.fulfill(J({ result: 'success' })); }
        return r.fulfill(J({ result: 'success' })); // 다른 쓰기는 막음
      }
      if (/mode=helpMine/.test(url)) { state.calls.push('helpMine'); return r.fulfill(J({ result: 'success', mine: state.mine })); }
      return r.continue();
    });
    return { ctx, page, state };
  }
  const fabInfo = page => page.evaluate(() => {
    const host = document.getElementById('h26-help-host');
    const portalFab = document.getElementById('helpFab');
    if (!host) return { hosts: 0, portalFab: !!portalFab };
    const fab = host.shadowRoot.querySelector('.fab'); const r = fab.getBoundingClientRect();
    const W = innerWidth, H = innerHeight;
    // 웹앱의 고정/스티키 요소 중 버튼과 겹치는 것
    const overlaps = [];
    document.querySelectorAll('body *').forEach(el => {
      if (el === host || host.contains(el)) return;
      const cs = getComputedStyle(el); if (cs.position !== 'fixed' && cs.position !== 'sticky') return;
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return;
      const e = el.getBoundingClientRect(); if (e.width < 2 || e.height < 2) return;
      if (e.height > H * 0.5 && e.width > W * 0.5) return; // 화면을 덮는 배경·창
      if (r.left < e.right && r.right > e.left && r.top < e.bottom && r.bottom > e.top)
        overlaps.push((el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0]) + ' ' + Math.round(e.top) + '~' + Math.round(e.bottom));
    });
    return { hosts: document.querySelectorAll('#h26-help-host').length, portalFab: !!portalFab,
      rect: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)], inView: r.left >= 0 && r.top >= 0 && r.right <= W && r.bottom <= H,
      label: fab.textContent.trim(), overlaps, hscroll: document.documentElement.scrollWidth > W + 1 };
  });

  for (const app of APPS) {
    const base = 'https://hyonnie-t.github.io/' + app + '/';
    const url = base + '?sid=' + SID + '&name=' + encodeURIComponent(NAME);
    for (const [w, h, tag] of SIZES) {
      const { ctx, page, state } = await newPage(w, h);
      const errs = []; page.on('pageerror', e => errs.push(e.message));
      await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(e => errs.push('goto ' + e.message));
      await page.waitForTimeout(2500); // place()가 2초마다 다시 잼
      const i = await fabInfo(page);
      ok(app, tag + ' 버튼 1개·화면 안', i.hosts === 1 && i.inView, JSON.stringify(i.rect || i));
      ok(app, tag + ' 웹앱 고정 요소와 안 겹침', i.hosts === 1 && i.overlaps.length === 0, (i.overlaps || []).join(', '));
      ok(app, tag + ' 가로 넘침 없음', i.hosts === 1 && !i.hscroll);
      const helpErrs = errs.filter(m => /help|h26|선생님/i.test(m));
      ok(app, tag + ' 버튼 관련 오류 없음', helpErrs.length === 0, errs.slice(0, 3).join(' / '));
      await page.screenshot({ path: path.join(OUT, `${app}_${tag}.png`) });
      const hiddenByApp = i.hosts === 1 && await page.evaluate(() => document.getElementById('h26-help-host').shadowRoot.querySelector('.fab').style.visibility === 'hidden');
      if (hiddenByApp) ok(app, tag + ' 앱의 덮는 창 버튼 위라 숨음(흐름 시험 건너뜀)', true);
      if (w === 375 && !hiddenByApp) {
        // 흐름: 열기 → 부르기 → 기다림 → 혼자 해결
        const fab = page.locator('#h26-help-host .fab');
        await fab.click(); await page.waitForTimeout(300);
        const dlgOpen = await page.evaluate(() => document.getElementById('h26-help-host').shadowRoot.querySelector('dialog').open);
        ok(app, '창 열림', dlgOpen);
        await page.screenshot({ path: path.join(OUT, `${app}_폰_창.png`) });
        await page.locator('#h26-help-host input').fill('2번에서 막혔어요');
        await page.locator('#h26-help-host .go').click(); await page.waitForTimeout(700);
        const lab1 = await fab.textContent();
        ok(app, '부르기 → «곧 와요»', /곧 와요/.test(lab1) && state.calls.includes('helpAsk'), lab1);
        await page.screenshot({ path: path.join(OUT, `${app}_폰_기다림.png`) });
        await fab.click(); await page.waitForTimeout(300);
        await page.locator('#h26-help-host .cancel').click(); await page.waitForTimeout(700);
        const lab2 = await fab.textContent();
        ok(app, '혼자 해결 → 원래 버튼', /도와주세요/.test(lab2) && state.calls.includes('helpCancel'), lab2);
        // 활동 화면에 흔한 «아래 고정 버튼 줄»이 생기면 그 위로 비키는지(가짜 줄을 넣어 본다)
        await page.evaluate(() => { const b = document.createElement('div'); b.id = 'fakeBar'; b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:72px;background:#ccc;z-index:10'; document.body.appendChild(b); });
        await page.waitForTimeout(2300);
        const j = await fabInfo(page);
        ok(app, '아래 고정 줄 생기면 위로 비킴', j.overlaps.length === 0 && j.inView, JSON.stringify(j.rect) + ' ' + j.overlaps.join(','));
        await page.screenshot({ path: path.join(OUT, `${app}_폰_고정줄.png`) });
        // 화면을 덮는 고정 창 안의 버튼이 밑에 깔리면 숨고, 창이 닫히면 다시 보이는지
        await page.evaluate(() => document.getElementById('fakeBar').remove());
        await page.waitForTimeout(600); // 버튼이 제자리로 내려온 뒤
        await page.evaluate(() => { const o = document.createElement('div'); o.id = 'fakeModal'; o.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:20'; const fr = document.getElementById('h26-help-host').shadowRoot.querySelector('.fab').getBoundingClientRect(); o.innerHTML = '<button style="position:absolute;left:16px;right:16px;top:' + fr.top + 'px;height:48px">확인</button>'; /* 도움 버튼이 있는 자리에 */ document.body.appendChild(o); });
        await page.waitForTimeout(150); // 2초 주기를 기다리지 않고 바로 숨어야 한다
        const vis1 = await page.evaluate(() => document.getElementById('h26-help-host').shadowRoot.querySelector('.fab').style.visibility);
        await page.evaluate(() => document.getElementById('fakeModal').remove());
        await page.waitForTimeout(150);
        const vis2 = await page.evaluate(() => document.getElementById('h26-help-host').shadowRoot.querySelector('.fab').style.visibility);
        ok(app, '덮는 창 버튼 위면 숨고 닫히면 다시 보임', vis1 === 'hidden' && vis2 === '', vis1 + '→' + (vis2 || '보임'));
      }
      await ctx.close();
    }
    // 안 떠야 하는 경우
    for (const [name, opts, u] of [
      ['?preview=1', {}, base + '?preview=1&sid=' + SID],
      ['세션 없음', { session: false }, base],
      ['다른 학번 sid', { sessSid: '20198' }, url],
    ]) {
      const { ctx, page } = await newPage(1180, 820, opts);
      await page.goto(u, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
      await page.waitForTimeout(1500);
      const i = await fabInfo(page);
      ok(app, name + ' → 버튼 없음', i.hosts === 0);
      await ctx.close();
    }
  }
  // 포털: 웹앱용 버튼이 겹쳐 뜨지 않는지(포털 자기 버튼은 로그인 화면 뒤라 없을 수 있음)
  {
    const { ctx, page } = await newPage(1180, 820);
    await page.goto('https://hyonnie-t.github.io/history26/', { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const i = await fabInfo(page);
    ok('history26(포털)', '웹앱용 버튼 안 붙음', i.hosts === 0, 'portalFab=' + i.portalFab);
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(results, null, 1));
  console.log(fails ? `\n실패 ${fails}개` : '\n모두 통과');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
