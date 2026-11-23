/* v188(2026-11-23) — 교사 대시보드 «성적관리» 탭 점검(파이썬 없는 PC용 Node + Playwright, 시트에 안 씀).
 * 포털을 로컬 정적 서버로 띄우고 Apps Script를 가짜 응답으로 바꾼다(가짜 학생 이름만 씀).
 *
 * 사용: node tests/webapp-testing/grades_check.js <출력 폴더>
 * 확인하는 것
 *  1) 학년 고르기: 처음엔 2학년 — 지금 할 일 «미응시 N명 · M건», 미응시자 카드 펼침, 학기말 성적 묶음 숨김
 *  2) 3학년으로 바꾸면 학기말 성적·점수 확인 묶음이 접힌 채 보이고, 할 일 줄에 재확인·이상 있음·안 누름·공개 상태
 *  3) 미응시자 표: 번호·이름 칸 줄바꿈 없음, 평가는 꼬리표 하나씩, word-break keep-all, 머리 «N명 · M건»
 *  4) 고른 학년은 새로고침 뒤에도 유지(localStorage), 학생 표는 누를 때만 펼침, 반 막대를 누르면 펼침
 *  5) 네 폭(폰 360·768·1180·PC 1280) 캡처 + 가로 넘침 없음 + 첫 화면 안에 할 일 줄
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
if (!OUT) { console.error('사용: node grades_check.js <출력 폴더>'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.webp': 'image/webp' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
const J = o => ({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
const results = [];
const check = (name, ok, extra) => { results.push({ name, ok: !!ok }); console.log((ok ? '[PASS] ' : '[FAIL] ') + name + (extra ? ' — ' + extra : '')); };

/* 가짜 3학년 1·2반 각 6명 점수 확인 + 기말 점수, 2학년 미응시 2개 반 */
const sid = (ban, no) => ban + String(no).padStart(2, '0');
const PERF = [];
['301', '302'].forEach(ban => { for (let n = 1; n <= 6; n++) {
  const r = { studentId: sid(ban, n), name: '삼학년' + ban.slice(2) + '-' + n, score: 24, max: 30, response: '', answeredScore: '', checked: false };
  if (n <= 3) { r.response = '이상 없음'; r.answeredScore = 24; }
  if (n === 4) { r.response = '이상 있음'; r.answeredScore = 24; }
  if (n === 5) { r.response = '이상 없음'; r.answeredScore = 22; } // 재확인 대기
  PERF.push(r);
} });
const EXAMS = PERF.map((r, i) => ({ studentId: r.studentId, name: r.name, title: '2학기 기말고사', score: 60 + i * 3, max: 100, areas: [], feedback: '' }));
let FAIL = false; // true면 perfScoreAdmin이 실패를 돌려준다
const LONG = ['신항로 개척과 유럽 세계의 팽창 보고서', '절대 왕정 비교 카드뉴스', '시민 혁명 토론 글쓰기'];
const MISS = [
  { studentId: '20103', name: '이학년1-3', title: LONG[0], note: '' }, { studentId: '20103', name: '이학년1-3', title: LONG[1], note: '' },
  { studentId: '20103', name: '이학년1-3', title: LONG[2], note: '결석' }, { studentId: '20111', name: '이학년1-11', title: LONG[0], note: '' },
  { studentId: '20207', name: '이학년2-7', title: LONG[1], note: '' }, { studentId: '20221', name: '이학년2-21', title: LONG[0], note: '' },
  { studentId: '20221', name: '이학년2-21', title: LONG[2], note: '' },
  { studentId: '30109', name: '삼학년1-9', title: '조선 후기 사회 변화 탐구', note: '' },
];

(async () => {
  await new Promise(r => srv.listen(0, r));
  const port = srv.address().port;
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch());
  async function routeBackend(route) {
    const req = route.request(), u = req.url();
    if (req.method() === 'GET') {
      if (u.includes('mode=perfScoreAdmin') && FAIL) return route.fulfill(J({ result: 'error', message: '가짜 실패' }));
      if (u.includes('mode=perfScoreAdmin')) return route.fulfill(J({ result: 'success', rows: PERF, exams: EXAMS, examShow: 'ON' }));
      if (u.includes('mode=perfMissing')) return route.fulfill(J({ result: 'success', rows: MISS, notes: ['11-24 수업 때 미응시 처리'], at: '2026-11-23 09:00' }));
      if (u.includes('mode=curriculum')) return route.fulfill(J({ result: 'success', grades: {}, lessons: [], gradeInfo: {} }));
      if (u.includes('token=') && !u.includes('mode=')) return route.fulfill(J({ result: 'success', rows: [], teacher: '효니' }));
      return route.fulfill(J({ result: 'success', rows: [], lessons: [] }));
    }
    return route.fulfill(J({ result: 'success' }));
  }
  const ctx = await browser.newContext();
  async function open(vp, page0) {
    const page = page0 || await ctx.newPage();
    await page.setViewportSize(vp);
    const errs = []; page.on('pageerror', e => errs.push(String(e)));
    await page.route(/script\.google(usercontent)?\.com/, routeBackend);
    await page.goto(`http://localhost:${port}/index.html`);
    await page.click('#btnTeacherMode'); await page.fill('#tokenInput', 'fixture-token'); await page.click('#btnGate');
    await page.waitForSelector('#dashView', { state: 'visible', timeout: 15000 });
    await page.evaluate(() => switchDashTab('grades'));
    await page.waitForFunction(() => /지금 할 일/.test(document.querySelector('#gradesTodo').textContent), null, { timeout: 15000 });
    return { page, errs };
  }

  /* 1) 2학년 기본 */
  const { page, errs } = await open({ width: 1280, height: 900 });
  await page.evaluate(() => { localStorage.removeItem('dash_grades_year'); });
  await page.evaluate(() => gradesPickYear_('2'));
  const todo2 = await page.textContent('#gradesTodo');
  check('2학년: 할 일 줄 «미응시 4명 · 7건»', /2학년 · 지금 할 일/.test(todo2) && /미응시 4명 · 7건/.test(todo2), todo2);
  check('2학년: 미응시자 카드 보임·머리 «4명 · 7건»', await page.isVisible('#perfMissCard') && /^4명 · 7건/.test(await page.textContent('#perfMissHead')));
  check('2학년: 3학년 미응시(30109)는 안 보임', !/삼학년1-9/.test(await page.textContent('#perfMissBox')));
  check('2학년: 학기말 성적 묶음 숨김', !(await page.isVisible('#semFold')));
  check('2학년: 점수 확인 묶음 요약 «올라온 점수 없음»', /올라온 점수 없음/.test(await page.textContent('#perfFoldNote')));
  const missCells = await page.$$eval('.gt-miss-table tbody tr', trs => trs.map(tr => ({
    noWrap: getComputedStyle(tr.querySelector('.no')).whiteSpace, nmWrap: getComputedStyle(tr.querySelector('.nm')).whiteSpace,
    tags: tr.querySelectorAll('.gt-tag').length, wb: tr.querySelector('.gt-tag') && getComputedStyle(tr.querySelector('.gt-tag')).wordBreak })));
  check('미응시 표: 번호·이름 nowrap, 평가마다 꼬리표, keep-all', missCells.length === 4 && missCells.every(c => c.noWrap === 'nowrap' && c.nmWrap === 'nowrap' && c.wb === 'keep-all') && missCells[0].tags === 3, JSON.stringify(missCells[0]));
  check('미응시 반 머리 «2명 · 4건»(1반)', /1반 2명 · 4건/.test(await page.textContent('.gt-miss-ban h3')));

  /* 2) 3학년 */
  await page.click('.gt-year[data-year="3"]');
  const todo3 = await page.textContent('#gradesTodo');
  check('3학년: 할 일 줄 재확인 2 · 이상 있음 2 · 안 누름 2 · 공개 중', /재확인 대기 2/.test(todo3) && /이상 있음 2 \(확인 전 2\)/.test(todo3) && /안 누름 2/.test(todo3) && /학기말 성적 공개 중/.test(todo3), todo3);
  check('3학년: 미응시 1명 · 1건', /미응시 1명 · 1건/.test(todo3));
  check('3학년: 학기말·점수 확인 묶음 보이고 접힘', await page.isVisible('#semFold') && !(await page.$eval('#semFold', d => d.open)) && !(await page.$eval('#perfFold', d => d.open)));
  check('3학년: 묶음 요약 «학생 화면에 공개 중 · 12명»', /학생 화면에 공개 중 · 12명/.test(await page.textContent('#semFoldNote')));
  await page.click('#semFold > summary');
  check('학생 표는 처음엔 접힘', !(await page.$eval('#semStuFold', d => d.open)));
  await page.click('#semAdminBox button.sem-dist-row >> nth=1');
  check('반 막대(2반)를 누르면 학생 표 펼침·2반', await page.$eval('#semStuFold', d => d.open) && /3-2반|2반/.test(await page.textContent('#semStuFold .sem-tab.is-on')));
  await page.click('.gt-chip:has-text("재확인 대기")');
  await page.waitForTimeout(300);
  check('«재확인 대기» 칩 → 점수 확인 묶음 펼침', await page.$eval('#perfFold', d => d.open));
  check('학생별 점수·조정은 접힘, 펼치면 반 고르기', !(await page.$eval('#perfStuFold', d => d.open)));
  await page.click('#perfStuFold > summary');
  check('학생별 점수·조정 펼침 → 학생 목록', await page.$eval('#perfStudentBox', b => b.children.length > 0));
  await page.click('.gt-chip:has-text("안 누름")');
  check('«안 누름» 칩 → 3학년 명단 팝업', /3학년 아직 안 누른 학생 2명/.test(await page.textContent('#perfModalTitle')));
  await page.evaluate(() => perfModalClose_());
  await page.click('#perfAdminBox button:has-text("반별 한눈에 보기")');
  check('반별 한눈에 보기 = 3학년 반만', /3학년 반별 한눈에 보기/.test(await page.textContent('#perfModalTitle')) && (await page.$$('.perf-ov-card')).length === 2);
  await page.evaluate(() => perfModalClose_());
  check('페이지 오류 없음', !errs.length, errs.join(' | '));

  /* 4) 새로고침 뒤 학년 유지 */
  const r2 = await open({ width: 1280, height: 900 }, page);
  check('새로고침 뒤에도 3학년 유지', /3학년 · 지금 할 일/.test(await r2.page.textContent('#gradesTodo')) && await r2.page.$eval('.gt-year[data-year="3"]', b => b.classList.contains('is-on')));
  await r2.page.evaluate(() => gradesPickYear_('2'));

  /* 4-2) 현황 조회 실패 뒤 학년을 바꿔도 오류·다시 시도가 남는지(검토 2026-11-23 재현 건) */
  FAIL = true;
  {
    const pg = r2.page;
    await pg.evaluate(() => dashLoadPerfStatus_()); // 맨 위 ↻ 새로고침과 같은 길
    await pg.click('.gt-year[data-year="3"]');
    const t = await pg.textContent('#perfAdminBox');
    check('조회 실패 뒤 학년을 바꿔도 오류·다시 시도 유지', /불러오지 못했어/.test(t) && /다시 시도/.test(t), t.slice(0, 60));
    check('조회 실패 중에도 학년 단추 표시', await pg.$eval('.gt-year[data-year="3"]', b => b.classList.contains('is-on')));
    await pg.click('.gt-year[data-year="2"]');
  }
  FAIL = false;

  /* 5) 네 폭 */
  for (const [name, w, h] of [['phone', 360, 780], ['w768', 768, 1024], ['w1180', 1180, 820], ['pc', 1280, 900]]) {
    const { page: p, errs: e2 } = await open({ width: w, height: h });
    await p.evaluate(() => window.scrollTo(0, 0));
    const m = await p.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, todoBottom: document.querySelector('#gradesTodo').getBoundingClientRect().bottom, vh: innerHeight }));
    check(name + ': 가로 넘침 없음', m.over <= 1, 'over=' + m.over);
    check(name + ': 할 일 줄이 첫 화면 안', m.todoBottom <= m.vh, JSON.stringify(m));
    await p.screenshot({ path: path.join(OUT, 'grades2_' + name + '.png'), fullPage: true });
    await p.evaluate(() => gradesPickYear_('3'));
    await p.evaluate(() => { document.getElementById('semFold').open = true; });
    await p.waitForTimeout(400); // 학년 단추 색 바뀜(.2s)이 끝난 뒤 찍는다
    await p.screenshot({ path: path.join(OUT, 'grades3_' + name + '.png'), fullPage: true });
    await p.evaluate(() => { document.getElementById('semFold').open = false; gradesPickYear_('2'); });
    check(name + ': 페이지 오류 없음', !e2.length, e2.join(' | '));
    await p.close();
  }
  await browser.close(); srv.close();
  const fail = results.filter(r => !r.ok).length;
  console.log(`\n요약: ${results.length - fail}/${results.length} 통과`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
