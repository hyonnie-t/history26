/* v158(2026-11-10) — 대시보드 «👥 모둠·팀 → 🏺 문화사 발굴단» 점검(파이썬 없는 PC용 Node + Playwright, 시트에 안 씀).
 * mock_check.js처럼 포털을 로컬 정적 서버로 띄우고 Apps Script를 가짜 응답으로 바꾼다(POST도 가짜 — 보낸 본문만 기록).
 * culture-dig logic.js는 배포본을 그대로 읽는다(읽기 전용, 대시보드가 실제로 그렇게 부른다).
 *
 * 사용: node tests/webapp-testing/culture_check.js <출력 폴더>
 * 확인하는 것
 *  1) «🔄 다시 읽기»: 첫 조회 땐 발굴 제출 0건 → 버튼 → 제출 2건이 결산표에 보이는지(로그인 유지, 페이지 새로고침 없이)
 *  2) 팀 옮기기: 학생 한 명을 다른 팀으로 → cultureTeamsSave 본문에 새 팀·overwrite:true·결석 표시 유지 → 칠판용 표 갱신
 *  3) 두 명 맞바꾸기: 본문에 두 학생 팀이 서로 바뀌어 들어가는지
 *  4) 세 폭(폰 360·태블릿 820·PC 1280) 캡처: culture_{phone,tablet,pc}.png
 * 끝에 [PASS]/[FAIL] 요약, 실패가 있으면 exit 1. */
const fs = require('fs'), path = require('path'), http = require('http');

function loadPlaywright() {
  const cands = ['playwright', 'playwright-core', process.env.PW_MODULE || '',
    'C:/Users/user/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright',
    '/opt/node22/lib/node_modules/playwright', '/usr/lib/node_modules/playwright', '/usr/local/lib/node_modules/playwright'].filter(Boolean);
  for (const c of cands) { try { return require(c); } catch (e) { /* 다음 후보 */ } }
  throw new Error('playwright 모듈을 못 찾음. PW_MODULE=<경로>로 알려 주기');
}

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = process.argv[2];
if (!OUT) { console.error('사용: node culture_check.js <출력 폴더>'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
const J = o => ({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
const results = [];
const check = (name, ok, extra) => { results.push({ name, ok: !!ok }); console.log((ok ? '[PASS] ' : '[FAIL] ') + name + (extra ? ' — ' + extra : '')); };

/* 가짜 3학년 5반: 1~8번, 확정 팀 2명씩, 3번은 발굴 결석 */
const TEAMS0 = { '1': '붓', '2': '붓', '3': '곡괭이', '4': '곡괭이', '5': '돋보기', '6': '돋보기', '7': '나침반', '8': '나침반' };
function savedFrom(teams, absDig) {
  const o = {};
  Object.keys(teams).forEach(n => { o['305' + String(n).padStart(2, '0')] = { team: teams[n], absDig: absDig.includes(Number(n)), absEsc: false }; });
  return o;
}
function digRow(no, score) {
  return { timestamp: new Date().toISOString(), studentId: '305' + String(no).padStart(2, '0'), studentName: '테스트' + no, gameName: '문화사_유물발굴',
    choiceSummary: '점수 ' + score, choicesJson: JSON.stringify({ score: { score } }), groupId: '3-5-붓' };
}

(async () => {
  await new Promise(r => srv.listen(0, r));
  const port = srv.address().port;
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch());
  let state = { teams: Object.assign({}, TEAMS0), absDig: [3], rows: [], posts: [] };
  async function routeBackend(route) {
    const req = route.request(), u = req.url();
    if (req.method() === 'GET') {
      if (u.includes('mode=cultureTeams')) return route.fulfill(J({ result: 'success', teams: savedFrom(state.teams, state.absDig) }));
      if (u.includes('mode=curriculumAdmin')) return route.fulfill(J({ result: 'success', lessons: [], gradeInfo: {} }));
      if (u.includes('mode=curriculum')) return route.continue(); // 공개 조회(읽기 전용) — 대시보드 «새로고침»이 실제 모양을 기대한다
      if (u.includes('mode=perfScoreAdmin')) return route.fulfill(J({ result: 'success', rows: [], exams: [] }));
      if (u.includes('mode=groups')) return route.fulfill(J({ result: 'success', groups: {} }));
      if (u.includes('token=') && !u.includes('mode=')) {
        const game = new URL(u).searchParams.get('game'); // 백엔드 teacherGet_의 game= 필터와 같게
        if (game) state.gameCalls = (state.gameCalls || 0) + 1;
        return route.fulfill(J({ result: 'success', rows: game ? state.rows.filter(r => r.gameName === game) : state.rows, teacher: '효니' }));
      }
      return route.fulfill(J({ result: 'success', rows: [], lessons: [] }));
    }
    let b = {}; try { b = JSON.parse(req.postData() || '{}'); } catch (e) { /* 빈 본문 */ }
    state.posts.push(b);
    if (b.action === 'cultureTeamsSave') {
      state.teams = {}; Object.keys(b.teams).forEach(k => { state.teams[k] = b.teams[k]; });
      state.absDig = (b.absent && b.absent.dig || []).map(Number);
    }
    return route.fulfill(J({ result: 'success' }));
  }
  async function openCulture(vp) {
    const page = await browser.newPage({ viewport: vp });
    const errs = []; page.on('pageerror', e => errs.push(String(e)));
    page.on('dialog', d => d.accept());
    await page.route(/script\.google(usercontent)?\.com/, routeBackend);
    await page.goto(`http://localhost:${port}/index.html`);
    await page.click('#btnTeacherMode'); await page.fill('#tokenInput', 'fixture-token'); await page.click('#btnGate');
    await page.waitForSelector('#dashView', { state: 'visible', timeout: 15000 });
    await page.evaluate(() => { switchDashTab('groups'); grSetSub_('culture'); });
    await page.waitForFunction(() => document.querySelector('#ctBox .ct-board'), null, { timeout: 15000 });
    return { page, errs };
  }

  /* 1) 다시 읽기 */
  {
    const { page, errs } = await openCulture({ width: 1280, height: 900 });
    const before = await page.textContent('#ctBox');
    check('처음엔 발굴 제출 0건', /제출 0명/.test(before));
    state.rows = [digRow(1, 80), digRow(5, 60)];
    await page.click('#ctBox button:has-text("다시 읽기")');
    await page.waitForFunction(() => /제출 2명/.test(document.querySelector('#ctBox').textContent), null, { timeout: 15000 }).catch(() => {});
    const after = await page.textContent('#ctBox');
    check('«다시 읽기» 뒤 제출 2건·결산표가 보임(페이지 새로고침 없이)', /제출 2명/.test(after) && /순위 포인트/.test(after));
    check('다시 읽은 뒤에도 대시보드 화면 그대로(로그인 유지)', await page.isVisible('#dashView'));
    check('페이지 오류 없음(1)', !errs.length, errs.join(' | '));

    /* 2) 한 명 옮기기: 2번(붓) → 나침반 */
    state.posts = [];
    await page.selectOption('#ctMoveNo', '2');
    await page.selectOption('#ctMoveTo', '나침반');
    await page.click('body', { position: { x: 5, y: 5 } }); // 포커스를 빼고 자동 다시 읽기가 돈 경우(검토 2026-11-10 재현 건)
    await page.evaluate(() => ctRefresh_(true));
    check('자동 다시 읽기 뒤에도 고른 번호·갈 곳 유지', await page.$eval('#ctMoveNo', e => e.value) === '2' && await page.$eval('#ctMoveTo', e => e.value) === '나침반');
    await page.click('#ctBox button:has-text("옮기기")');
    await page.waitForTimeout(800);
    const p1 = state.posts.find(x => x.action === 'cultureTeamsSave');
    check('옮기기 → cultureTeamsSave 한 번', !!p1);
    check('본문: 2번 = 나침반, 나머지 그대로', p1 && p1.teams['2'] === '나침반' && p1.teams['1'] === '붓' && Object.keys(p1.teams).length === 8);
    check('본문: overwrite:true, 결석(발굴 3번) 유지', p1 && p1.overwrite === true && (p1.absent.dig || []).map(Number).includes(3));
    const board = await page.$$eval('#ctBox .ct-col[data-team="나침반"] .ct-nos span', els => els.map(e => e.textContent));
    check('칠판용 표 바로 갱신(나침반 = 2·7·8번)', board.join() === '2,7,8', board.join());
    check('옮긴 번호 강조(.ct-moved)', await page.$eval('#ctBox .ct-col[data-team="나침반"]', el => !!el.querySelector('span.ct-moved')));

    /* 2-1) 탭을 다시 열면 제출 기록을 새로 읽는다(전엔 들어올 때 한 번만) */
    state.rows = [digRow(1, 80), digRow(5, 60), digRow(6, 70)];
    const calls0 = state.gameCalls || 0;
    await page.evaluate(() => { grSetSub_('class'); grSetSub_('culture'); });
    await page.waitForFunction(() => /제출 3명/.test(document.querySelector('#ctBox').textContent), null, { timeout: 15000 }).catch(() => {});
    check('탭 다시 열면 제출 3건으로 갱신', /제출 3명/.test(await page.textContent('#ctBox')));
    check('문화사 3활동만 game= 필터로 읽음', (state.gameCalls || 0) - calls0 === 3, String((state.gameCalls || 0) - calls0));
    check('자동 다시 읽기 타이머가 켜짐', await page.evaluate(() => !!CT_TIMER));
    check('다시 읽은 시각 표시', /에 읽음/.test(await page.textContent('#ctBox')));

    /* 2-2) 대시보드 맨 위 «새로고침»도 이 탭을 다시 그린다(11-10 사고의 원인) */
    state.rows = [digRow(1, 80), digRow(5, 60), digRow(6, 70), digRow(7, 90)];
    await page.evaluate(() => { window.dashRefreshActivityOptions = () => {}; }); // 가짜 응답엔 교사용 차시 목록이 없어 이 함수만 비운다(문화사 탭과 무관)
    await page.click('#btnDashRefresh');
    await page.waitForFunction(() => /제출 4명/.test(document.querySelector('#ctBox').textContent), null, { timeout: 15000 }).catch(() => {});
    check('맨 위 «새로고침» 뒤 문화사 탭도 제출 4건', /제출 4명/.test(await page.textContent('#ctBox')));

    /* 3) 맞바꾸기: 1번(붓) ↔ 5번(돋보기) */
    state.posts = [];
    await page.selectOption('#ctMoveNo', '1');
    await page.selectOption('#ctMoveTo', 'swap:5');
    await page.click('#ctBox button:has-text("옮기기")');
    await page.waitForTimeout(800);
    const p2 = state.posts.find(x => x.action === 'cultureTeamsSave');
    check('맞바꾸기 본문: 1번=돋보기, 5번=붓', p2 && p2.teams['1'] === '돋보기' && p2.teams['5'] === '붓');
    check('페이지 오류 없음(2)', !errs.length, errs.join(' | '));
    await page.close();
  }

  /* 4) 세 폭 캡처 */
  state = { teams: Object.assign({}, TEAMS0), absDig: [3], rows: [digRow(1, 80), digRow(5, 60)], posts: [] };
  for (const [vn, vp] of [['phone', { width: 360, height: 780 }], ['tablet', { width: 820, height: 1180 }], ['pc', { width: 1280, height: 900 }]]) {
    const { page, errs } = await openCulture(vp);
    await page.waitForTimeout(400);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`${vn}: 가로 넘침 없음`, over <= 1, 'scrollWidth 차이 ' + over);
    await page.$eval('#ctBox', el => el.scrollIntoView());
    await page.screenshot({ path: path.join(OUT, `culture_${vn}.png`), fullPage: true });
    check(`${vn}: 페이지 오류 없음`, !errs.length, errs.join(' | '));
    await page.close();
  }

  /* 5) 로그인 없는 공개 보기(groups.html·발표자 뽑기 모둠 창)에 문화사 팀 — 가짜 groupsPublic(반·팀·번호만) */
  const PUB = { result: 'success', groups: { '2-1': [{ no: 1, nums: [1, 2, 21] }, { no: 2, nums: [3, 22] }] },
    culture: { '3-5': [{ team: '붓', nums: [1, 2] }, { team: '곡괭이', nums: [3, 4] }, { team: '돋보기', nums: [5, 6] }, { team: '나침반', nums: [7, 8] }] } };
  const routePub = route => route.fulfill(J(PUB));
  for (const [vn, vp] of [['phone', { width: 360, height: 780 }], ['tablet', { width: 820, height: 1180 }], ['pc', { width: 1280, height: 900 }]]) {
    const page = await browser.newPage({ viewport: vp });
    const errs = []; page.on('pageerror', e => errs.push(String(e)));
    await page.route(/script\.google(usercontent)?\.com/, routePub);
    await page.goto(`http://localhost:${port}/groups.html?ban=3-5&me=7`);
    await page.waitForSelector('.gp-tcol', { timeout: 15000 }).catch(() => {});
    const info = await page.evaluate(() => ({
      tabs: [...document.querySelectorAll('#gpTabs button')].map(b => b.textContent),
      teams: [...document.querySelectorAll('.gp-tcol')].map(c => c.dataset.team + ':' + [...c.querySelectorAll('.gp-nos span')].map(s => s.textContent).join(',')),
      me: [...document.querySelectorAll('.gp-nos span.is-me')].map(s => s.textContent).join(),
      over: document.documentElement.scrollWidth - window.innerWidth }));
    if (vn === 'pc') {
      check('groups.html: 반 탭에 2-1(모둠)·3-5(팀) 둘 다', info.tabs.join() === '2-1반,3-5반', info.tabs.join());
      check('groups.html: 3-5 문화사 팀 4개·번호', info.teams.join(' ') === '붓:1,2 곡괭이:3,4 돋보기:5,6 나침반:7,8', info.teams.join(' '));
      check('groups.html: ?me=7 → 7번만 강조', info.me === '7', info.me);
      check('groups.html: 화면에 이름·학번 없음(번호만)', !/30507|테스트/.test(await page.textContent('body')));
    }
    check(`groups.html ${vn}: 가로 넘침 없음`, info.over <= 1, String(info.over));
    check(`groups.html ${vn}: 페이지 오류 없음`, !errs.length, errs.join(' | '));
    await page.screenshot({ path: path.join(OUT, `groups_${vn}.png`), fullPage: true });
    await page.close();
  }
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errs = []; page.on('pageerror', e => errs.push(String(e)));
    await page.route(/script\.google(usercontent)?\.com/, routePub);
    await page.goto(`http://localhost:${port}/picker.html`);
    await page.waitForTimeout(800);
    const opts = await page.$$eval('select option, #pkClass option', os => os.map(o => o.value));
    const sel = await page.$('select');
    if (sel && opts.includes('3-5')) await sel.selectOption('3-5');
    else await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /3-5/.test(x.textContent)); if (b) b.click(); });
    await page.click('#pkGroupsBtn');
    await page.waitForSelector('#pkGroupsBox .gp-tcol', { timeout: 10000 }).catch(() => {});
    const n = await page.$$eval('#pkGroupsBox .gp-tcol', els => els.length);
    check('발표자 뽑기 모둠 창: 3-5에 문화사 팀 4칸', n === 4, String(n) + ' / 제목 ' + await page.textContent('#pkGroupsTitle'));
    check('발표자 뽑기: 팀만 있는 반은 모둠 뽑기 버튼 숨김', await page.$eval('#pkGroupDrawBtn', b => b.hidden));
    check('발표자 뽑기: 페이지 오류 없음', !errs.length, errs.join(' | '));
    await page.screenshot({ path: path.join(OUT, 'picker_groups_pc.png') });
    await page.close();
  }
  await browser.close(); srv.close();
  const bad = results.filter(r => !r.ok).length;
  console.log(`\n요약: ${results.length - bad}/${results.length} 통과`);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); srv.close(); process.exit(1); });
