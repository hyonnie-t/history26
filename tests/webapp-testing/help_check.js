/* v177(2026-11-14) — «선생님 도와주세요» 점검. 포털을 로컬 서버로 띄우고 Apps Script 호출을 가짜 응답(상태 있는 흉내)으로 바꾼다.
 * 시트에는 아무것도 쓰지 않는다. 커리큘럼만 실제 ?mode=curriculum을 한 번 읽는다(읽기 전용, mock_check.js와 같음).
 * 사용: node tests/webapp-testing/help_check.js <출력 폴더>   (playwright 경로는 PW_MODULE=<경로>로 알려 줄 수 있다)
 * 보는 것: 학생 — 고정 버튼 보임·창 열기·부르기→«곧 와요»·질문 바꾸기·«혼자 해결했어요»·교사가 해결하면 원래 버튼(폰 375·태블릿 768/1180·PC 1280)
 *          교사 — 맨 위 «N명 기다려요»·오늘 탭 숫자·반별 묶음·해결·반 모두 해결·되돌리기·담당 반 밖(3-1)은 안 보임·가로 넘침 없음(같은 네 폭) */
const fs = require('fs'), path = require('path'), http = require('http');
function loadPlaywright() {
  const cands = ['playwright', 'playwright-core', process.env.PW_MODULE || '',
    'C:/Users/user/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright',
    'C:/Users/alfzl/AppData/Local/npm-cache/_npx/daf98f25e57265ec/node_modules/playwright'].filter(Boolean);
  for (const c of cands) { try { return require(c); } catch (e) { /* 다음 후보 */ } }
  throw new Error('playwright 모듈을 못 찾음. PW_MODULE=<경로>');
}
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = process.argv[2]; if (!OUT) { console.error('사용: node help_check.js <출력 폴더>'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const WEBAPP_URL = (fs.readFileSync(path.join(ROOT, 'config.js'), 'utf8').match(/WEBAPP_URL:\s*"([^"]+)"/) || [])[1];
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
const J = o => ({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
const ago = m => new Date(Date.now() - m * 60000).toISOString();

(async () => {
  const CUR = await (await fetch(WEBAPP_URL + '?mode=curriculum')).json(); // 읽기 전용
  const STUDENT = { result: 'success', activities: [], presentationGrants: [], badges: [], messages: [], questions: [], feedback: [], classFeedback: [], announcements: [] };
  let HELP = []; // 가짜 시트
  const seed = () => { HELP = [
    { id: 'a1', studentId: '20503', studentName: '김하나', grade: '2', ban: '5', question: '2번 활동 사료가 무슨 뜻인지 모르겠어요', status: '대기', since: ago(6), doneAt: '' },
    { id: 'a2', studentId: '20511', studentName: '이두리', grade: '2', ban: '5', question: '', status: '대기', since: ago(2), doneAt: '' },
    { id: 'a3', studentId: '20612', studentName: '박세찬', grade: '2', ban: '6', question: '제출 버튼이 안 눌려요', status: '대기', since: ago(1), doneAt: '' },
    { id: 'a4', studentId: '30101', studentName: '앞반', grade: '3', ban: '1', question: '담당 반 밖', status: '대기', since: ago(3), doneAt: '' },
    { id: 'a5', studentId: '20507', studentName: '최미소', grade: '2', ban: '5', question: '', status: '해결', since: ago(20), doneAt: ago(15) },
  ]; };
  const calls = [];
  async function routeBackend(route) {
    const u = route.request().url(), m = route.request().method();
    if (m === 'GET') {
      if (u.includes('mode=helpMine')) { calls.push('helpMine'); const sid = new URL(u).searchParams.get('studentId'); const mine = HELP.filter(h => h.studentId === sid).pop() || null; return route.fulfill(J({ result: 'success', mine: mine && { id: mine.id, status: mine.status, question: mine.question, since: mine.since, doneAt: mine.doneAt } })); }
      if (u.includes('mode=helpAdmin')) { calls.push('helpAdmin'); return route.fulfill(J({ result: 'success', pending: HELP.filter(h => h.status === '대기'), done: HELP.filter(h => h.status !== '대기'), doneCount: HELP.filter(h => h.status === '해결').length })); }
      if (u.includes('mode=curriculumAdmin')) return route.fulfill(J({ result: 'success', lessons: [], gradeInfo: {} }));
      if (u.includes('mode=curriculum')) return route.fulfill(J(CUR));
      if (u.includes('mode=checkinPlan')) return route.fulfill(J({ result: 'success', plan: {} }));
      if (u.includes('mode=checkinToday')) return route.fulfill(J({ result: 'success', alreadyChecked: true, lessonId: '' }));
      if (u.includes('mode=student')) return route.fulfill(J(STUDENT));
      if (u.includes('token=') && !u.includes('mode=')) return route.fulfill(J({ result: 'success', rows: [], teacher: '효니' }));
      return route.fulfill(J({ result: 'success', rows: [], lessons: [] }));
    }
    let b = {}; try { b = JSON.parse(route.request().postData() || '{}'); } catch (e) { /* 빈 본문 */ }
    calls.push(b.action);
    if (b.action === 'login') return route.fulfill(J({ result: 'success', session: { token: 'fixture', exp: 4102444800000, sid: b.studentId, name: b.name } }));
    if (b.action === 'helpAsk') {
      const old = HELP.find(h => h.studentId === b.studentId && h.status === '대기');
      if (old) { if (b.question) old.question = b.question; return route.fulfill(J({ result: 'success', already: true, mine: old })); }
      const n = { id: 'n' + HELP.length, studentId: b.studentId, studentName: b.studentName, grade: b.studentId[0], ban: String(Number(b.studentId.slice(1, 3))), question: b.question || '', status: '대기', since: new Date().toISOString(), doneAt: '' };
      HELP.push(n); return route.fulfill(J({ result: 'success', already: false, mine: n }));
    }
    if (b.action === 'helpCancel') { let c = 0; HELP.forEach(h => { if (h.studentId === b.studentId && h.status === '대기') { h.status = '취소'; c++; } }); return route.fulfill(J({ result: 'success', cancelled: c })); }
    if (b.action === 'helpResolve') { let c = 0; HELP.forEach(h => { if (!b.ids.includes(h.id)) return; if (!b.undo && h.status === '대기') { h.status = '해결'; h.doneAt = new Date().toISOString(); c++; } else if (b.undo && h.status === '해결') { h.status = '대기'; h.doneAt = ''; c++; } }); return route.fulfill(J({ result: 'success', changed: c })); }
    return route.fulfill(J({ result: 'success' }));
  }
  await new Promise(r => srv.listen(8766, r));
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ channel: 'chrome' });
  const summary = {};
  async function open(w, h, touch) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: !!touch }); const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)); });
    await page.route(/script\.google\.com/, routeBackend);
    await page.goto('http://localhost:8766/index.html'); await page.waitForTimeout(600);
    return { ctx, page, errs };
  }
  const over = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const WIDTHS = [['phone', 375, 812], ['tablet', 768, 1024], ['tabletL', 1180, 820], ['pc', 1280, 900]];

  for (const [vn, w, h] of WIDTHS) { // 학생
    seed(); calls.length = 0;
    const { ctx, page, errs } = await open(w, h, w < 1000);
    await page.fill('#inputId', '20520'); await page.fill('#inputName', '테스트'); await page.fill('#inputPw', '1234'); await page.click('#btnLogin');
    await page.waitForSelector('#portalView.shown', { timeout: 15000 }); await page.waitForTimeout(800);
    const r = { fabVisible: await page.isVisible('#helpFab'), fab0: (await page.textContent('#helpFab')).trim(), mineCallsAtLogin: calls.filter(c => c === 'helpMine').length };
    const box = await page.locator('#helpFab').boundingBox(); r.fabInView = !!box && box.x + box.width <= w && box.y + box.height <= h; r.fabH = box && Math.round(box.height);
    await page.screenshot({ path: path.join(OUT, `student_${vn}.png`) });
    await page.click('#helpFab'); await page.waitForTimeout(300);
    r.dialogOpen = await page.evaluate(() => document.getElementById('helpDialog').open);
    if (vn === 'phone' || vn === 'tablet') await page.screenshot({ path: path.join(OUT, `student_dialog_${vn}.png`) });
    await page.fill('#helpInput', '3번 사료 해석이 어려워요'); await page.click('#helpSend'); await page.waitForTimeout(400);
    r.afterSend = { dialogOpen: await page.evaluate(() => document.getElementById('helpDialog').open), fab: (await page.textContent('#helpFab')).trim(), toast: (await page.textContent('#toast')).trim(), rows: HELP.filter(x => x.studentId === '20520').length };
    if (vn === 'phone') await page.screenshot({ path: path.join(OUT, `student_waiting_${vn}.png`) });
    await page.click('#helpFab'); await page.waitForTimeout(300);
    r.waitingDialog = await page.evaluate(() => ({ title: document.getElementById('helpDialogTitle').textContent, input: document.getElementById('helpInput').value, cancelShown: getComputedStyle(document.getElementById('helpCancel')).display !== 'none' }));
    if (vn === 'phone') await page.screenshot({ path: path.join(OUT, `student_waiting_dialog_${vn}.png`) });
    if (vn === 'phone') { // 질문 바꾸기 → 줄은 그대로 하나
      await page.fill('#helpInput', '바뀐 질문'); await page.click('#helpSend'); await page.waitForTimeout(400);
      r.edit = { rows: HELP.filter(x => x.studentId === '20520').length, q: HELP.find(x => x.studentId === '20520').question };
      // 교사가 해결 → 다음 확인 때 원래 버튼 + 토스트
      HELP.find(x => x.studentId === '20520').status = '해결';
      await page.evaluate(() => helpCheckMine_()); await page.waitForTimeout(400);
      r.resolved = { fab: (await page.textContent('#helpFab')).trim(), toast: (await page.textContent('#toast')).trim() };
      // 다시 불렀다가 혼자 해결
      await page.click('#helpFab'); await page.click('#helpSend'); await page.waitForTimeout(400);
      await page.click('#helpFab'); await page.click('#helpCancel'); await page.waitForTimeout(400);
      r.cancel = { fab: (await page.textContent('#helpFab')).trim(), toast: (await page.textContent('#toast')).trim(), status: HELP.filter(x => x.studentId === '20520').map(x => x.status) };
      // Esc로 닫힘
      await page.click('#helpFab'); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
      r.escCloses = !(await page.evaluate(() => document.getElementById('helpDialog').open));
      // 새로고침: 기다리는 중이면 들어올 때 상태를 묻고, 아니면 안 묻는다
      await page.click('#helpFab'); await page.click('#helpSend'); await page.waitForTimeout(300);
      calls.length = 0; await page.reload(); await page.waitForSelector('#portalView.shown', { timeout: 15000 }); await page.waitForTimeout(1200);
      r.reloadWaiting = { fab: (await page.textContent('#helpFab')).trim(), mineCalls: calls.filter(c => c === 'helpMine').length };
    }
    r.over = await over(page);
    summary['student_' + vn] = { ...r, errs: errs.length ? errs : '없음' };
    await ctx.close();
  }

  for (const [vn, w, h] of WIDTHS) { // 교사
    seed(); calls.length = 0;
    const { ctx, page, errs } = await open(w, h, w < 1000);
    await page.click('#btnTeacherMode'); await page.fill('#tokenInput', 'fixture-token'); await page.click('#btnGate');
    await page.waitForSelector('#dashView', { state: 'visible', timeout: 15000 }); await page.waitForTimeout(1500);
    // dashMyBans_를 2-5·2-6만 담당으로(가짜 커리큘럼 트랙이 없을 수 있어 직접 지정 — 실제 화면은 학년정보 트랙을 따른다)
    await page.evaluate(() => { window.dashMyBans_ = g => g === '2' ? [5, 6] : g === '3' ? [5, 6, 7, 8] : null; helpDashRender_(); });
    const r = { pill: await page.isVisible('#helpPill') && (await page.textContent('#helpPill')).trim(), tabBadge: (await page.textContent('#helpTabBadge')).trim(), title: await page.title() };
    if (vn === 'phone') await page.screenshot({ path: path.join(OUT, `dash_pill_${vn}.png`) });
    await page.click('#helpPill'); await page.waitForTimeout(500);
    r.card = await page.evaluate(() => ({ visible: document.getElementById('panelToday').style.display !== 'none', count: document.getElementById('helpCount').textContent,
      groups: [...document.querySelectorAll('#helpList .help-ban')].map(s => s.querySelector('.help-ban-head b').textContent + ':' + s.querySelectorAll('.help-row').length),
      front: document.getElementById('helpList').textContent.includes('앞반') }));
    await page.locator('#helpCard').screenshot({ path: path.join(OUT, `dash_card_${vn}.png`) });
    if (vn === 'pc' || vn === 'phone') await page.screenshot({ path: path.join(OUT, `dash_today_${vn}.png`), fullPage: true });
    if (vn === 'pc') {
      await page.locator('#helpList .help-row', { hasText: '박세찬' }).locator('button').click(); await page.waitForTimeout(500);
      r.afterOne = { count: await page.textContent('#helpCount'), badge: (await page.textContent('#helpTabBadge')).trim(), sheet: HELP.find(x => x.id === 'a3').status };
      await page.locator('#helpList .help-ban', { hasText: '5반' }).locator('.help-ban-head button').click(); await page.waitForTimeout(500);
      r.afterBan = { count: await page.textContent('#helpCount'), pill: await page.isVisible('#helpPill'), title: await page.title(), sheet: HELP.filter(x => x.ban === '5').map(x => x.status) };
      await page.click('#helpDone summary'); await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(OUT, 'dash_card_pc_done.png'), fullPage: false });
      await page.locator('#helpDoneList li', { hasText: '박세찬' }).locator('button').click(); await page.waitForTimeout(500);
      r.undo = { count: await page.textContent('#helpCount'), sheet: HELP.find(x => x.id === 'a3').status };
      // 새 요청이 들어오면 다음 읽기에서 반짝임
      HELP.push({ id: 'z9', studentId: '20601', studentName: '새학생', grade: '2', ban: '6', question: '', status: '대기', since: new Date().toISOString(), doneAt: '' });
      await page.evaluate(() => helpDashLoad_()); await page.waitForTimeout(400);
      r.newFlash = await page.evaluate(() => [...document.querySelectorAll('#helpList .help-row.is-new')].map(li => li.textContent.slice(0, 10)));
      await page.click('#btnDashOut'); await page.waitForTimeout(300);
      r.afterOut = { title: await page.title(), timer: await page.evaluate(() => !!HELP.dashTimer) };
    }
    r.over = await over(page);
    summary['dash_' + vn] = { ...r, errs: errs.length ? errs : '없음' };
    await ctx.close();
  }
  await browser.close(); srv.close();
  console.log(JSON.stringify(summary, null, 1));
})().catch(e => { console.error(e.stack || e.message); process.exit(1); });
