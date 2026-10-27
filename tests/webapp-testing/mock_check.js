/* v120(2026-10-27) — 파이썬 없는 PC(효니 학교 PC)용 Node 점검 스크립트.
 * 포털을 로컬 정적 서버로 띄우고 Apps Script 호출을 가짜 응답으로 바꿔(route) 학생 화면·교사 대시보드를 세 폭으로 캡처한다.
 * 시트에는 아무것도 쓰지 않는다(POST는 전부 가짜 성공). 커리큘럼은 실제 ?mode=curriculum을 한 번 읽어(읽기 전용) 그대로 쓴다.
 *
 * 사용: node tests/webapp-testing/mock_check.js <출력 폴더> [student|dash|questions|all]
 *   예) node tests/webapp-testing/mock_check.js "$SCRATCH/shots" all
 * 결과: <출력 폴더>/student_{phone,tablet,pc}.png, dash_curriculum_{pc,phone}.png, dash_questions_{phone,tablet,tabletL,pc}.png(v123) + 콘솔에 요약 JSON. PNG는 Read로 열어 눈으로 본다.
 *
 * playwright는 shot.js처럼 알려진 후보 경로를 차례로 시도한다(설치하지 않는다). 브라우저는 설치된 Chrome(channel:'chrome').
 * 가짜 학생: 2학년 1반 1번 «테스트», 1차시와 마지막 2차시만 미완료(«지금 할 활동»·«밀린 활동» 확인용). */
const fs = require('fs'), path = require('path'), http = require('http');

function loadPlaywright() {
  const cands = ['playwright', 'playwright-core',
    process.env.PW_MODULE || '',
    'C:/Users/user/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright', // 효니 학교 PC: tistory-mcp npx 캐시
    '/opt/node22/lib/node_modules/playwright', '/usr/lib/node_modules/playwright', '/usr/local/lib/node_modules/playwright'].filter(Boolean);
  for (const c of cands) { try { return require(c); } catch (e) { /* 다음 후보 */ } }
  throw new Error('playwright 모듈을 못 찾음. PW_MODULE=<경로>로 알려 주거나 후보에 추가: ' + cands.join(', '));
}

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = process.argv[2]; const WHAT = process.argv[3] || 'all';
if (!OUT) { console.error('사용: node mock_check.js <출력 폴더> [student|dash|all]'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const WEBAPP_URL = (fs.readFileSync(path.join(ROOT, 'config.js'), 'utf8').match(/WEBAPP_URL:\s*"([^"]+)"/) || [])[1];
if (!WEBAPP_URL) { console.error('config.js에서 WEBAPP_URL을 못 읽음'); process.exit(2); }
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
const J = o => ({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });

(async () => {
  const CUR = await (await fetch(WEBAPP_URL + '?mode=curriculum')).json(); // 읽기 전용
  const g2 = CUR.grades['2'].lessons;
  const skip = new Set([g2[0].id, g2[g2.length - 1].id, g2[g2.length - 2].id]);
  const acts = []; g2.forEach(l => { if (skip.has(l.id)) return; l.activities.forEach(a => acts.push({ activityId: a.id, timestamp: '2026-10-01T10:00:00Z', achievement: '중', summary: '', aiComment: '', reflection: '테스트 글' })); });
  const STUDENT = { result: 'success', activities: acts, presentationGrants: [], badges: [], messages: [], questions: [], feedback: [], classFeedback: [], announcements: [] };
  // 교사용 커리큘럼 행(학생용 응답에서 변환) + 기록: 2학년은 활동마다 2건, 단 한 활동(마지막 차시)은 0건으로 둬 «⚠ 제출 0건»을 본다
  let row = 2; const lessons = [];
  for (const g of Object.keys(CUR.grades)) for (const l of CUR.grades[g].lessons) { const a = l.activities || []; lessons.push({ _row: row++, grade: Number(g), id: l.id, title: l.title, type: a[0] ? a[0].type : 'module', urlText: a[0] ? (a[0].url || '') : '', activitiesRaw: a.length > 1 ? JSON.stringify(a) : '', activitiesCount: a.length, sequential: !!l.sequential, owner: '', public: true, isPast: false, desc: '' }); }
  const rows = []; let k = 0; const zeroId = g2[g2.length - 1].activities[0].id;
  for (const l of g2) for (const a of l.activities || []) { if (a.id === zeroId) continue; for (let i = 0; i < 2; i++) rows.push({ _row: 100 + k++, studentId: '2010' + (1 + i), studentName: '학생' + i, gameName: a.id, timestamp: '2026-10-01T10:00:00Z', achievement: '중', summary: '', aiComment: '', reflection: '', choiceSummary: '' }); }

  // v123 — 교사 질문함 학생별 묶음 확인용: 질문 대기·답장 도착·답변 완료만·메시지만 학생을 섞는다
  const QUESTIONS = [
    { _row: 2, timestamp: '2026-10-20T01:00:00Z', studentId: '20101', studentName: '김하나', grade: 2, ban: 1, question: '십자군 전쟁은 왜 여러 번 일어났나요?', answer: '교황과 왕들의 목적이 계속 달랐기 때문이야.', answerTime: '2026-10-20T05:00:00Z', status: '답변완료' },
    { _row: 3, timestamp: '2026-10-26T02:00:00Z', studentId: '20101', studentName: '김하나', grade: 2, ban: 1, question: '흑사병 이후 농노의 처지가 정말 나아졌나요? 지역마다 달랐다는데 아주 길게 물어보는 질문입니다.', answer: '', answerTime: '', status: '대기' },
    { _row: 4, timestamp: '2026-10-25T03:00:00Z', studentId: '20205', studentName: '이두리', grade: 2, ban: 2, question: '교황권이 약해진 결정적 사건은?', answer: '아비뇽 유수를 먼저 보자.', answerTime: '2026-10-25T06:00:00Z', status: '답변완료' },
    { _row: 5, timestamp: '2026-10-24T03:00:00Z', studentId: '30310', studentName: '박세찬', grade: 3, ban: 3, question: '고려가 거란과 싸운 횟수는?', answer: '', answerTime: '', status: '대기' },
  ];
  const MESSAGES = [
    { _row: 2, timestamp: '2026-10-22T01:00:00Z', studentId: '20205', studentName: '이두리', grade: 2, ban: 2, from: '교사', content: '지난 글 잘 썼어! 근거 하나만 더 찾아볼래?', read: true, teacher: '효니' },
    { _row: 3, timestamp: '2026-10-26T04:00:00Z', studentId: '20205', studentName: '이두리', grade: 2, ban: 2, from: '학생', content: '네 교과서 120쪽에서 찾아볼게요', read: false, teacher: '' },
    { _row: 4, timestamp: '2026-10-21T01:00:00Z', studentId: '20312', studentName: '최미소', grade: 2, ban: 3, from: '교사', content: '체크인 온도가 낮던데 괜찮아?', read: false, teacher: '효니' },
  ];
  async function routeBackend(route) {
    const u = route.request().url(), m = route.request().method();
    if (m === 'GET') {
      if (u.includes('mode=curriculumAdmin')) return route.fulfill(J({ result: 'success', lessons, gradeInfo: {} }));
      if (u.includes('mode=curriculum')) return route.fulfill(J(CUR));
      if (u.includes('mode=checkinPlan')) return route.fulfill(J({ result: 'success', plan: {} }));
      if (u.includes('mode=checkinToday')) return route.fulfill(J({ result: 'success', alreadyChecked: true, lessonId: '' }));
      if (u.includes('mode=student')) return route.fulfill(J(STUDENT));
      if (u.includes('mode=questions')) return route.fulfill(J({ result: 'success', rows: QUESTIONS }));
      if (u.includes('mode=messagesAdmin')) return route.fulfill(J({ result: 'success', rows: MESSAGES }));
      if (u.includes('mode=announcements')) return route.fulfill(J({ result: 'success', rows: [] }));
      if (u.includes('token=') && !u.includes('mode=')) return route.fulfill(J({ result: 'success', rows, teacher: '효니' }));
      return route.fulfill(J({ result: 'success', rows: [], lessons: [] }));
    }
    let b = {}; try { b = JSON.parse(route.request().postData() || '{}'); } catch (e) { /* 빈 본문 */ }
    if (b.action === 'login') return route.fulfill(J({ result: 'success', session: { token: 'fixture', exp: 4102444800000, sid: b.studentId, name: b.name } }));
    return route.fulfill(J({ result: 'success' }));
  }

  await new Promise(r => srv.listen(8765, r));
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ channel: 'chrome' });
  const summary = {};
  async function open(w, h) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } }); const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 100)); });
    await page.route(/script\.google\.com/, routeBackend);
    await page.goto('http://localhost:8765/index.html'); await page.waitForTimeout(600);
    return { ctx, page, errs };
  }
  if (WHAT === 'student' || WHAT === 'all') {
    for (const [vn, w, h] of [['phone', 375, 812], ['tablet', 820, 1180], ['pc', 1280, 900]]) {
      const { ctx, page, errs } = await open(w, h);
      await page.fill('#inputId', '20101'); await page.fill('#inputName', '테스트'); await page.fill('#inputPw', '1234'); await page.click('#btnLogin');
      await page.waitForSelector('#portalView.shown', { timeout: 15000 }); await page.waitForTimeout(1200);
      const info = await page.evaluate(() => ({ next: document.getElementById('nextTitle').textContent, sub: document.getElementById('nextSub').textContent, otherHead: getComputedStyle(document.getElementById('otherHead')).display, over: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
      await page.screenshot({ path: path.join(OUT, `student_${vn}.png`), fullPage: true });
      summary['student_' + vn] = { ...info, errs: errs.length ? errs : '없음' };
      await ctx.close();
    }
  }
  if (WHAT === 'dash' || WHAT === 'all') {
    for (const [vn, w, h] of [['pc', 1280, 900], ['phone', 375, 812]]) {
      const { ctx, page, errs } = await open(w, h);
      await page.click('#btnTeacherMode'); await page.fill('#tokenInput', 'fixture-token'); await page.click('#btnGate');
      await page.waitForSelector('#dashView', { state: 'visible', timeout: 15000 }); await page.waitForTimeout(1500);
      await page.click('.dash-tab[data-tab="curriculum"]'); await page.waitForTimeout(500);
      const listBtn = page.locator('#panelCurriculum button', { hasText: '등록된 활동' }); if (await listBtn.count()) await listBtn.first().click();
      await page.waitForTimeout(500);
      const info = await page.evaluate(() => { const metas = [...document.querySelectorAll('#panelCurriculum .cl-meta')].map(e => e.textContent.trim()); return { items: metas.length, warn: metas.filter(t => t.includes('제출 0건')).length, over: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
      await page.screenshot({ path: path.join(OUT, `dash_curriculum_${vn}.png`), fullPage: true });
      summary['dash_' + vn] = { ...info, errs: errs.length ? errs : '없음' };
      await ctx.close();
    }
  }
  if (WHAT === 'questions' || WHAT === 'all') {
    for (const [vn, w, h] of [['phone', 375, 812], ['tablet', 768, 1024], ['tabletL', 1180, 820], ['pc', 1280, 900]]) {
      const { ctx, page, errs } = await open(w, h);
      await page.click('#btnTeacherMode'); await page.fill('#tokenInput', 'fixture-token'); await page.click('#btnGate');
      await page.waitForSelector('#dashView', { state: 'visible', timeout: 15000 }); await page.waitForTimeout(1500);
      await page.click('.dash-tab[data-tab="questions"]'); await page.waitForTimeout(400);
      const read = () => page.evaluate(() => ({
        badge: document.getElementById('dqBadge').textContent,
        line: document.querySelector('.dq-summary-line') ? document.querySelector('.dq-summary-line').textContent.trim() : '',
        groups: [...document.querySelectorAll('#dqList details.dq-student')].map(d => ({ sid: d.dataset.sid, open: d.open, waiting: d.classList.contains('waiting'),
          items: d.querySelectorAll('.dq-timeline > .msg-bubble, .dq-timeline > .dq-q').length })),
        over: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
      const before = await read();
      await page.screenshot({ path: path.join(OUT, `dash_questions_${vn}.png`), fullPage: true });
      let after = null;
      if (vn === 'pc') { // 대기 질문에 답하기 → 김하나 묶음이 펼친 채 남는지(30310은 담당 반 밖이라 안 보여야 함), 배지 줄어드는지 / 메시지 보내기
        const g = page.locator('details.dq-student[data-sid="20101"]');
        await g.locator('.dq-q.wait .dq-reply-text').fill('지역마다 달랐어. 영국은 임금이 올랐어.'); await g.locator('.dq-q.wait button').click(); await page.waitForTimeout(400);
        const m = page.locator('details.dq-student[data-sid="20312"]'); await m.locator('summary').click();
        await m.locator('.msg-text-input').fill('질문 좋아!'); await m.locator('.msg-wrap button').click(); await page.waitForTimeout(400);
        after = await read();
        await page.screenshot({ path: path.join(OUT, 'dash_questions_pc_after.png'), fullPage: true });
      }
      summary['questions_' + vn] = { before, after, errs: errs.length ? errs : '없음' };
      await ctx.close();
    }
  }
  await browser.close(); srv.close();
  console.log(JSON.stringify(summary, null, 1));
})().catch(e => { console.error(e.message); process.exit(1); });
