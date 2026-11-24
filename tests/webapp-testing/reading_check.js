/* v189(2026-11-24) — 교과 독서기록장 점검. help_check.js 본뜸: 포털을 로컬 서버로 띄우고 Apps Script 호출을 가짜 응답(상태 있는 흉내)으로 바꾼다.
 * 시트에는 아무것도 쓰지 않는다. 커리큘럼만 실제 ?mode=curriculum을 한 번 읽는다(읽기 전용).
 * 사용: node tests/webapp-testing/reading_check.js <출력 폴더>   (playwright 경로는 PW_MODULE=<경로>)
 * 보는 것: 학생 — 날짜 전엔 탭 숨김·?reading=1이면 보임·로그인 때 독서 조회 0번·탭 열 때 1번·판정 글자 0건·새로 쓰기·임시 저장·복사·고치기·
 *          지우기(앱 안 창)·오류 화면 재시도에도 한 행·미리보기는 읽지도 쓰지도 않음(폰 360·태블릿 768/1180·PC 1280)
 *          교사 — 반별 표·숫자 → 명단 팝업·복사·인정 후보 한꺼번에·학생별 판정 모아 저장·CSV 3종·도서 목록 미리보기→저장·나가기 비움(같은 네 폭) */
const fs = require('fs'), path = require('path'), http = require('http');
function loadPlaywright() {
  const cands = ['playwright', 'playwright-core', process.env.PW_MODULE || '',
    'C:/Users/user/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright',
    'C:/Users/alfzl/AppData/Local/npm-cache/_npx/daf98f25e57265ec/node_modules/playwright'].filter(Boolean);
  for (const c of cands) { try { return require(c); } catch (e) { /* 다음 후보 */ } }
  throw new Error('playwright 모듈을 못 찾음. PW_MODULE=<경로>');
}
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = process.argv[2]; if (!OUT) { console.error('사용: node reading_check.js <출력 폴더>'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const WEBAPP_URL = (fs.readFileSync(path.join(ROOT, 'config.js'), 'utf8').match(/WEBAPP_URL:\s*"([^"]+)"/) || [])[1];
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.webp': 'image/webp' };
const PORT = 8767;
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
const J = o => ({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
const ago = d => new Date(Date.now() - d * 86400000).toISOString();
const ESSAY = '역사는 과거와 현재의 대화라는 말이 처음엔 어려웠다. 그런데 오늘 수업에서 본 사료를 떠올리니 내가 지금 궁금한 것이 과거를 읽는 눈이 된다는 뜻 같았다. 앞으로는 사료를 읽을 때 누가 왜 썼는지를 먼저 물어보고 싶다. 그래야 내 생각도 분명해진다. 사료 속 사람들의 목소리를 더 듣고 싶다.';

(async () => {
  const CUR = await (await fetch(WEBAPP_URL + '?mode=curriculum')).json(); // 읽기 전용
  const STUDENT = { result: 'success', activities: [], presentationGrants: [], badges: [], messages: [], questions: [], feedback: [], classFeedback: [], announcements: [] };
  let REC = [], BOOKS = [], ROSTER = [], failNextSave = 0;
  const seed = () => {
    BOOKS = [{ grade: '2', title: '역사란 무엇인가', author: 'E. H. 카', isbn: '', publisher: '', order: 1, shown: true },
      { grade: '2', title: '난중일기', author: '이순신', isbn: '', publisher: '', order: 2, shown: true },
      { grade: '3', title: '백범일지', author: '김구', isbn: '', publisher: '', order: 1, shown: true }];
    ROSTER = ['20501:김하나', '20502:이두리', '20503:박세찬', '20504:최미소', '20520:테스트', '20601:정여섯', '20602:한둘'].map(x => ({ studentId: x.split(':')[0], studentName: x.split(':')[1] }));
    const mk = (id, sid, name, title, author, o) => Object.assign({ id, studentId: sid, studentName: name, title, author, isbn: '', date: '2027-03-10', pageFrom: 1, pageTo: 30,
      underline: '', question: '', review: '재밌다', essay: '', createdAt: ago(5), updatedAt: ago(5), judge: '', memo: '', judgedBy: '', judgedAt: '' }, o || {});
    REC = [
      mk('s1', '20520', '테스트', '난중일기', '이순신', { underline: '신에게는 아직 열두 척의 배가 있습니다', question: '왜 포기하지 않았을까?', essay: ESSAY, judge: '인정', judgedBy: '효니', judgedAt: ago(4) }),
      mk('a1', '20501', '김하나', '역사란 무엇인가', 'E. H. 카', { underline: '대화', question: '대화란?', essay: ESSAY }),
      mk('a2', '20501', '김하나', '난중일기', '이순신', { underline: '열두 척', question: '두려움은?', essay: ESSAY }),
      mk('b1', '20502', '이두리', '난중일기', '이순신', { review: '짧게 씀' }),
      mk('c1', '20503', '박세찬', '역사란 무엇인가', 'E. H. 카', { underline: 'x', question: 'y', essay: ESSAY, judge: '인정', judgedBy: '효니', judgedAt: ago(4), updatedAt: ago(1) }), // 판정 뒤 고침
      mk('d1', '20601', '정여섯', '난중일기', '=SUM(1)', { underline: 'u', question: 'q', essay: ESSAY }),
    ];
    for (let i = 0; i < 5; i++) REC.push(mk('e' + i, '20504', '최미소', '책' + i, '', { judge: '인정', judgedAt: ago(4), updatedAt: ago(5) }));
  };
  const calls = []; const posts = [];
  const mineOut = r => ({ id: r.id, title: r.title, author: r.author, isbn: r.isbn, date: r.date, pageFrom: r.pageFrom, pageTo: r.pageTo, underline: r.underline, question: r.question, review: r.review, essay: r.essay, createdAt: r.createdAt, updatedAt: r.updatedAt,
    judge: r.judge, memo: '선생님 메모가 학생에게 보이면 안 됨' }); // 판정 칸을 일부러 실어 보내 — 화면이 그리지 않는지 본다
  async function routeBackend(route) {
    const u = route.request().url(), m = route.request().method();
    if (m === 'GET') {
      if (u.includes('mode=readingMine')) { calls.push('readingMine'); const sid = new URL(u).searchParams.get('studentId');
        return route.fulfill(J({ result: 'success', records: REC.filter(r => r.studentId === sid).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(mineOut), books: BOOKS.filter(b => b.grade === sid[0]) })); }
      if (u.includes('mode=readingAdmin')) { calls.push('readingAdmin'); return route.fulfill(J({ result: 'success', records: REC.map(r => Object.assign({ grade: r.studentId[0], ban: String(Number(r.studentId.slice(1, 3))) }, r)), roster: ROSTER, books: BOOKS })); }
      if (u.includes('mode=helpMine') || u.includes('mode=helpAdmin')) return route.fulfill(J({ result: 'success', mine: null, pending: [], done: [], doneCount: 0 }));
      if (u.includes('mode=curriculumAdmin')) return route.fulfill(J({ result: 'success', lessons: [], gradeInfo: {} }));
      if (u.includes('mode=curriculum')) return route.fulfill(J(CUR));
      if (u.includes('mode=checkinPlan')) return route.fulfill(J({ result: 'success', plan: {} }));
      if (u.includes('mode=checkinToday')) return route.fulfill(J({ result: 'success', alreadyChecked: true, lessonId: '' }));
      if (u.includes('mode=student')) return route.fulfill(J(STUDENT));
      if (u.includes('token=') && !u.includes('mode=')) return route.fulfill(J({ result: 'success', rows: [], teacher: '효니' }));
      return route.fulfill(J({ result: 'success', rows: [], lessons: [] }));
    }
    let b = {}; try { b = JSON.parse(route.request().postData() || '{}'); } catch (e) { /* 빈 본문 */ }
    calls.push(b.action); posts.push(b);
    if (b.action === 'login') return route.fulfill(J({ result: 'success', session: { token: 'fixture', exp: 4102444800000, sid: b.studentId, name: b.name } }));
    if (b.action === 'readingSave') {
      const r0 = b.record || {};
      const hit = REC.find(r => r.id === r0.id);
      if (!hit) REC.push(Object.assign({ studentId: b.studentId, studentName: b.studentName, isbn: '', createdAt: new Date().toISOString(), judge: '', memo: '' }, r0, { pageFrom: Number(r0.pageFrom) || '', pageTo: Number(r0.pageTo) || '', updatedAt: new Date().toISOString() }));
      else Object.assign(hit, r0, { updatedAt: new Date().toISOString() });
      const rec = REC.find(r => r.id === r0.id);
      if (failNextSave > 0) { failNextSave--; return route.fulfill({ status: 200, contentType: 'text/html', body: '<html>Google 오류</html>' }); } // 저장은 됐는데 응답이 깨짐 → 다시 보냄
      return route.fulfill(J({ result: 'success', created: !hit, record: mineOut(rec) }));
    }
    if (b.action === 'readingDelete') { REC = REC.filter(r => r.id !== b.id); return route.fulfill(J({ result: 'success', deleted: b.id })); }
    if (b.action === 'readingJudge') { let n = 0; b.items.forEach(it => { const r = REC.find(x => x.id === it.id); if (r && r.judge !== it.judge) { r.judge = it.judge; r.judgedAt = new Date().toISOString(); n++; } }); return route.fulfill(J({ result: 'success', changed: n })); }
    if (b.action === 'readingBooksSave') { BOOKS = BOOKS.filter(x => x.grade !== b.grade).concat(b.books.map((x, i) => Object.assign({ grade: b.grade, order: i + 1 }, x))); return route.fulfill(J({ result: 'success', saved: b.books.length, books: BOOKS.filter(x => x.grade === b.grade) })); }
    return route.fulfill(J({ result: 'success' }));
  }
  await new Promise(r => srv.listen(PORT, r));
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ channel: 'chrome' });
  const summary = {};
  async function open(w, h, touch, q) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: !!touch, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)); });
    await page.route(/script\.google\.com/, routeBackend);
    await page.goto('http://localhost:' + PORT + '/index.html' + (q || '')); await page.waitForTimeout(600);
    return { ctx, page, errs };
  }
  const over = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const login = async page => { await page.fill('#inputId', '20520'); await page.fill('#inputName', '테스트'); await page.fill('#inputPw', '1234'); await page.click('#btnLogin');
    await page.waitForSelector('#portalView.shown', { timeout: 15000 }); await page.waitForTimeout(800); };
  const WIDTHS = [['phone', 360, 780], ['tablet', 768, 1024], ['tabletL', 1180, 820], ['pc', 1280, 900]];

  { // 날짜 전·?reading 없이 — 탭 숨김
    seed(); const { ctx, page, errs } = await open(360, 780, true, '');
    await login(page);
    summary.hiddenBeforeDate = { tabVisible: await page.isVisible('#qtabReading'), errs: errs.length ? errs : '없음' };
    await ctx.close();
  }

  for (const [vn, w, h] of WIDTHS) { // 학생
    seed(); calls.length = 0; posts.length = 0;
    const { ctx, page, errs } = await open(w, h, w < 1000, '?reading=1');
    await login(page);
    const r = { tabVisible: await page.isVisible('#qtabReading'), mineAtLogin: calls.filter(c => c === 'readingMine').length };
    await page.click('#qtabReading'); await page.waitForTimeout(500);
    r.mineAfterTab = calls.filter(c => c === 'readingMine').length;
    const panelText = () => page.textContent('#qpReading');
    r.list = await page.locator('#readingBox .rd-card').count();
    r.noJudgeText = !/인정|보류|선생님 메모/.test(await panelText());
    await page.screenshot({ path: path.join(OUT, `student_list_${vn}.png`), fullPage: vn === 'phone' });
    // 새로 쓰기
    await page.click('#readingBox >> text=＋ 새 기록 쓰기'); await page.waitForTimeout(300);
    await page.selectOption('#rdBook', '0'); await page.waitForTimeout(100);
    r.pickedTitle = await page.inputValue('#rdTitle');
    await page.fill('#rdUnder', '역사는 현재와 과거 사이의 끊임없는 대화'); await page.fill('#rdQ', '대화란 무엇일까?'); await page.fill('#rdReview', '어렵지만 재밌다');
    await page.fill('#rdEssay', ESSAY); await page.waitForTimeout(100);
    r.counter = (await page.textContent('#rdEssayCnt')).trim();
    if (vn === 'phone' || vn === 'tablet') await page.locator('#rdForm').screenshot({ path: path.join(OUT, `student_form_${vn}.png`) });
    if (vn === 'phone') { // 임시 저장: 새로고침해도 쓰던 글이 남음
      await page.reload(); await page.waitForSelector('#portalView.shown', { timeout: 15000 }); await page.waitForTimeout(800);
      await page.click('#qtabReading'); await page.waitForTimeout(400); await page.click('#readingBox >> text=＋ 새 기록 쓰기'); await page.waitForTimeout(300);
      r.draftKept = (await page.inputValue('#rdEssay')) === ESSAY && (await page.inputValue('#rdTitle')) === '역사란 무엇인가';
      failNextSave = 1; // 첫 응답이 오류 화면 → 같은 기록ID로 다시 보냄
    }
    const before = REC.length;
    await page.click('#rdSaveBtn'); await page.waitForTimeout(vn === 'phone' ? 4500 : 600);
    const savePosts = posts.filter(p => p.action === 'readingSave');
    r.save = { rowsAdded: REC.length - before, posts: savePosts.length, sameId: new Set(savePosts.map(p => p.record.id)).size === 1, cards: await page.locator('#readingBox .rd-card').count(),
      formClosed: !(await page.isVisible('#rdForm')), draftCleared: await page.evaluate(() => !localStorage.getItem('h26_reading_draft_20520')) };
    // 복사
    await page.locator('#readingBox .rd-card').first().locator('text=독서로에 옮겨 적기').click(); await page.waitForTimeout(200);
    r.copy = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '(못 읽음)');
    // 고치기
    await page.locator('#readingBox .rd-card').first().locator('summary').click();
    await page.locator('#readingBox .rd-card').first().locator('text=고치기').click(); await page.waitForTimeout(300);
    r.editPrefill = (await page.inputValue('#rdReview')) === '어렵지만 재밌다';
    await page.fill('#rdReview', '고친 한 줄 평'); const n0 = REC.length; await page.click('#rdSaveBtn'); await page.waitForTimeout(500);
    r.edit = { rows: REC.length - n0, shown: (await panelText()).includes('고친 한 줄 평') };
    // 지우기 — 앱 안 창
    await page.locator('#readingBox .rd-card').first().locator('summary').click();
    await page.locator('#readingBox .rd-card').first().locator('text=지우기').click(); await page.waitForTimeout(300);
    r.delDialog = await page.evaluate(() => document.getElementById('rdConfirm').open);
    if (vn === 'phone') await page.screenshot({ path: path.join(OUT, `student_delete_${vn}.png`) });
    await page.click('#rdConfirmYes'); await page.waitForTimeout(400);
    r.afterDelete = { cards: await page.locator('#readingBox .rd-card').count(), dialog: await page.evaluate(() => document.getElementById('rdConfirm').open) };
    r.noJudgeTextEnd = !/인정|보류|선생님 메모/.test(await panelText());
    r.over = await over(page);
    await page.screenshot({ path: path.join(OUT, `student_after_${vn}.png`), fullPage: vn === 'phone' });
    if (vn === 'phone') { // «책 덮기» — 쓰던 글·목록을 이 기기에서 지움(교실 태블릿 공용)
      await page.click('#readingBox >> text=＋ 새 기록 쓰기'); await page.fill('#rdEssay', '쓰다 만 글'); await page.waitForTimeout(100);
      const hadDraft = await page.evaluate(() => !!localStorage.getItem('h26_reading_draft_20520'));
      await page.click('#btnLogout'); await page.waitForTimeout(500);
      r.logout = { hadDraft, draftGone: await page.evaluate(() => !localStorage.getItem('h26_reading_draft_20520')), boxEmpty: await page.evaluate(() => document.getElementById('readingBox').innerHTML === '') };
    }
    summary['student_' + vn] = { ...r, errs: errs.length ? errs : '없음' };
    await ctx.close();
  }

  for (const [vn, w, h] of WIDTHS) { // 교사
    seed(); calls.length = 0; posts.length = 0;
    const { ctx, page, errs } = await open(w, h, w < 1000, '');
    await page.click('#btnTeacherMode'); await page.fill('#tokenInput', 'fixture-token'); await page.click('#btnGate');
    await page.waitForSelector('#dashView', { state: 'visible', timeout: 15000 }); await page.waitForTimeout(1200);
    await page.evaluate(() => { window.dashMyBans_ = g => g === '2' ? [5, 6] : g === '3' ? [5, 6, 7, 8] : null; });
    await page.click('.dash-tab[data-tab="reading"]'); await page.waitForTimeout(600);
    const r = { adminCalls: calls.filter(c => c === 'readingAdmin').length };
    r.banRows = await page.$$eval('#rdaBox .rd-table:not(.rd-stu) tbody tr', trs => trs.map(t => [...t.children].map(c => c.textContent.trim()).join('|')));
    r.chips = await page.$$eval('#rdaBox .gt-chip', cs => cs.map(c => c.textContent.trim()));
    await page.screenshot({ path: path.join(OUT, `dash_reading_${vn}.png`), fullPage: true });
    // 숫자 → 명단 팝업
    await page.locator('#rdaBox .rd-num[onclick*=zero]').first().click(); await page.waitForTimeout(300); // 0회
    r.modal = { open: await page.isVisible('#perfModal'), title: (await page.textContent('#perfModalTitle')).trim(), chips: await page.$$eval('#perfModalBody .perf-none-chip', cs => cs.map(c => c.textContent.trim())) };
    await page.click('#perfModalBody >> text=📋 명단 복사'); await page.waitForTimeout(200);
    r.modal.copy = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '(못 읽음)');
    if (vn === 'phone') await page.screenshot({ path: path.join(OUT, `dash_modal_${vn}.png`) });
    await page.click('.perf-modal-x'); await page.waitForTimeout(200);
    if (vn === 'pc' || vn === 'phone') {
      // 인정 후보 한꺼번에
      r.cands = await page.$$eval('#rdaCandCard .rd-cand > li', ls => ls.map(l => l.textContent.slice(0, 30)));
      await page.locator('#rdaCandCard .rd-cand input').first().uncheck(); await page.waitForTimeout(200);
      await page.click('#rdaCandCard >> text=/고른 \\d+개 인정/'); await page.waitForTimeout(500);
      const jp = posts.filter(p => p.action === 'readingJudge').pop();
      r.judgeBatch = { items: jp && jp.items, a1: REC.find(x => x.id === 'a1').judge, a2: REC.find(x => x.id === 'a2').judge, candsAfter: await page.locator('#rdaCandCard .rd-cand > li').count() };
      // 학생별: 펼쳐 보류로 바꾸고 모아 저장
      await page.locator('#rdaStuCard .rd-name', { hasText: '이두리' }).click(); await page.waitForTimeout(200);
      await page.locator('#rdaStuCard .rd-stu-detail .rd-seg', { hasText: '보류' }).first().click(); await page.waitForTimeout(200);
      r.pendbar = await page.isVisible('.rd-pendbar');
      if (vn === 'phone') await page.screenshot({ path: path.join(OUT, `dash_pending_${vn}.png`) });
      await page.click('.rd-pendbar >> text=한 번에 저장'); await page.waitForTimeout(500);
      r.pendSave = { b1: REC.find(x => x.id === 'b1').judge, bar: await page.isVisible('.rd-pendbar') };
      r.editedFlag = await page.locator('#rdaStuCard .rd-flag', { hasText: '고침' }).count();
      r.scoreFull = await page.$$eval('#rdaStuCard .rd-stu-row', trs => trs.filter(t => t.textContent.includes('최미소')).map(t => t.lastElementChild.textContent));
      // CSV
      const csv = {};
      for (const [k, label] of [['books', '반별 독서 목록'], ['records', '기록 전체'], ['score', '점수(']]) {
        const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#rdaBox >> text=' + label)]);
        const p = await dl.path(); const t = fs.readFileSync(p, 'utf8');
        csv[k] = { name: dl.suggestedFilename(), bom: t.charCodeAt(0) === 0xFEFF, head: t.slice(1).split('\r\n').slice(0, 3) };
      }
      r.csv = csv;
      // 도서 목록 미리보기 → 저장
      await page.click('#rdaBox .rd-books > summary'); await page.waitForTimeout(200);
      await page.fill('#rdaBooksInput', '징비록\t유성룡\t\t\n삼국유사 / 일연\n숨긴 책 / / / / 숨김\n'); await page.click('#rdaBox >> text=미리보기'); await page.waitForTimeout(200);
      r.bookPreview = await page.$$eval('#rdaBox .rd-books tbody tr', trs => trs.map(t => t.textContent));
      await page.click('#rdaBox >> text=/이대로 \\d+권 저장/'); await page.waitForTimeout(400);
      r.booksSaved = { posted: (posts.filter(p => p.action === 'readingBooksSave').pop() || {}).books, sheet: BOOKS.filter(b => b.grade === '2').map(b => b.title + (b.shown ? '' : '(숨김)')) };
      // 3학년으로
      await page.locator('#rdaBox .gt-year').nth(1).click(); await page.waitForTimeout(200);
      r.grade3Rows = await page.$$eval('#rdaBox .rd-table:not(.rd-stu) tbody tr', trs => trs.length);
      await page.click('#btnDashOut'); await page.waitForTimeout(300);
      r.afterOut = await page.evaluate(() => ({ box: document.getElementById('rdaBox').innerHTML.length, data: RDA.data, pend: Object.keys(RDA.pending).length }));
    }
    r.over = await over(page);
    summary['dash_' + vn] = { ...r, errs: errs.length ? errs : '없음' };
    await ctx.close();
  }
  await browser.close(); srv.close();
  console.log(JSON.stringify(summary, null, 1));
})().catch(e => { console.error(e.stack || e.message); process.exit(1); });
