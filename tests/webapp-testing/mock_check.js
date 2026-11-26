/* v120(2026-10-27) — 파이썬 없는 PC(효니 학교 PC)용 Node 점검 스크립트.
 * 포털을 로컬 정적 서버로 띄우고 Apps Script 호출을 가짜 응답으로 바꿔(route) 학생 화면·교사 대시보드를 세 폭으로 캡처한다.
 * 시트에는 아무것도 쓰지 않는다(POST는 전부 가짜 성공). 커리큘럼은 실제 ?mode=curriculum을 한 번 읽어(읽기 전용) 그대로 쓴다.
 *
 * 사용: node tests/webapp-testing/mock_check.js <출력 폴더> [student|dash|questions|all|exam|chips]
 *   exam(v124, all에 안 들어감): 3학년 시험기간 감정 체크인 쿠키 + 수행평가 «기말고사 목표 점수». PERF_SCORE=20 처럼 점수를 바꿔 볼 수 있다.
 *   예) node tests/webapp-testing/mock_check.js "$SCRATCH/shots" all
 * 결과: <출력 폴더>/student_{phone,tablet,pc}.png, dash_curriculum_{pc,phone}.png, dash_questions_{phone,tablet,tabletL,pc}.png(v123) + 콘솔에 요약 JSON. PNG는 Read로 열어 눈으로 본다.
 *
 * playwright는 shot.js처럼 알려진 후보 경로를 차례로 시도한다(설치하지 않는다). 브라우저는 설치된 Chrome(channel:'chrome').
 * 가짜 학생: 2학년 1반 1번 «테스트», 1차시와 마지막 2차시만 미완료(«지금 할 활동»·«밀린 활동» 확인용).
 * boot(v182, all에 안 들어감): 로그인 한 번에 백엔드 GET이 몇 개 나가는지 센다 — ① 비밀번호 로그인 ② 저장본+세션으로 자동 입장(shared=1)
 *   ③ BOOT_LEGACY=1이면 옛 백엔드(studentBoot를 모름)라 옛 조회 셋으로 돌아가는지. 결과는 summary의 gets(모드 목록). */
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
const BOOT_LEGACY = process.env.BOOT_LEGACY === '1'; // v182 — 옛 백엔드 흉내(studentBoot → 교사 조회 «인증 실패»)
const GETLOG = []; // v182 — 백엔드 GET의 mode(+shared) 기록
const POSTLOG = []; // v184 — retry 모드: 백엔드 POST의 action·clientId·응답 종류
const PERF_SCORE = Number(process.env.PERF_SCORE || 27); // v124 exam 모드: 가짜 수행평가 점수(30점 만점)
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
  // v194 units 모드: 2학년 차시에 시트 «단원» 칸을 흉내 — config UNIT_GROUPS에 없는 차시 하나(EMPTY)만 빈칸(앞 차시 단원으로 묶여야 함),
  // 그 앞은 «시험단원 가», 뒤는 «시험단원 나». 반별 공개·담당을 지워 1반 학생에게 모두 보이게 한다.
  const CFG_TEXT = fs.readFileSync(path.join(ROOT, 'config.js'), 'utf8');
  let EMPTY = -1;
  if (WHAT === 'units') {
    EMPTY = g2.findIndex((l, i) => i >= 2 && !CFG_TEXT.includes("'" + l.id + "'") && !CFG_TEXT.includes('"' + l.id + '"'));
    if (EMPTY < 0) EMPTY = 3;
    g2.forEach((l, i) => { delete l.unit; delete l.bans; l.owner = null; if (i < EMPTY) l.unit = '시험단원 가'; else if (i > EMPTY) l.unit = '시험단원 나'; });
  }
  const UNIT_POSTS = [];
  const skip = new Set([g2[0].id, g2[g2.length - 1].id, g2[g2.length - 2].id]);
  const acts = []; g2.forEach(l => { if (skip.has(l.id)) return; l.activities.forEach(a => acts.push({ activityId: a.id, timestamp: '2026-10-01T10:00:00Z', achievement: '중', summary: '', aiComment: '', reflection: '테스트 글' })); });
  const STUDENT = { result: 'success', activities: acts, presentationGrants: [], badges: [], messages: [], questions: [], feedback: [], classFeedback: [], announcements: [] };
  // 교사용 커리큘럼 행(학생용 응답에서 변환) + 기록: 2학년은 활동마다 2건, 단 한 활동(마지막 차시)은 0건으로 둬 «⚠ 제출 0건»을 본다
  let row = 2; const lessons = [];
  for (const g of Object.keys(CUR.grades)) for (const l of CUR.grades[g].lessons) { const a = l.activities || []; lessons.push({ _row: row++, grade: Number(g), id: l.id, title: l.title, unit: l.unit || '', type: a[0] ? a[0].type : 'module', urlText: a[0] ? (a[0].url || '') : '', activitiesRaw: a.length > 1 ? JSON.stringify(a) : '', activitiesCount: a.length, sequential: !!l.sequential, owner: '', public: true, isPast: false, desc: '' }); }
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
      { const q = new URL(u).searchParams; GETLOG.push((q.get('mode') || '(none)') + (q.get('shared') ? '+shared' : '')); }
      if (WHAT === 'lecturer') { // v195 — 강사 토큰: 학생 기록·메시지·질문함·피드백은 백엔드가 «인증 실패», whoami는 lecturer
        if (u.includes('mode=whoami')) return route.fulfill(J({ result: 'success', teacher: '강사님', role: 'lecturer' }));
        if ((u.includes('token=') && !u.includes('mode=')) || /mode=(messagesAdmin|questions|feedback|classFeedback)\b/.test(u)) return route.fulfill(J({ result: 'error', message: '인증 실패' }));
      }
      if (u.includes('mode=studentBoot')) { // v182
        if (BOOT_LEGACY) return route.fulfill(J({ result: 'error', message: '인증 실패' }));
        const sh = u.includes('shared=1') ? { curriculum: CUR, checkinPlan: { result: 'success', plan: {} } } : {};
        return route.fulfill(J(Object.assign({ result: 'success', boot: 182, student: STUDENT,
          announcements: { result: 'success', rows: [{ timestamp: '2026-11-17T00:00:00Z', grade: '전체', ban: '전체', content: '부트 공지 확인', status: '게시' }] },
          checkinToday: { result: 'success', alreadyChecked: true, lessonId: '' } }, sh)));
      }
      if (u.includes('mode=curriculumAdmin')) return route.fulfill(J({ result: 'success', lessons, gradeInfo: {} }));
      if (u.includes('mode=curriculum')) return route.fulfill(J(CUR));
      if (u.includes('mode=checkinPlan')) return route.fulfill(J({ result: 'success', plan: {} }));
      if (u.includes('mode=checkinToday')) return route.fulfill(J({ result: 'success', alreadyChecked: WHAT !== 'exam' && WHAT !== 'chips', lessonId: '' })); // v124: exam 모드는 감정 체크인을 띄운다
      if (u.includes('mode=perfScore')) return route.fulfill(J({ result: 'success', items: [{ title: '역사 포트폴리오', score: PERF_SCORE, max: 30, used: 10, c3: 9, c2: 0, c1: 0, c0: 1, written: 12, note: '', response: '이상 없음', respondedAt: '', answeredScore: PERF_SCORE }] }));
      if (u.includes('mode=student')) return route.fulfill(J(STUDENT));
      if (u.includes('mode=questions')) return route.fulfill(J({ result: 'success', rows: QUESTIONS }));
      if (u.includes('mode=messagesAdmin')) return route.fulfill(J({ result: 'success', rows: MESSAGES }));
      if (u.includes('mode=announcements')) return route.fulfill(J({ result: 'success', rows: [] }));
      if (u.includes('token=') && !u.includes('mode=')) return route.fulfill(J({ result: 'success', rows, teacher: '효니' }));
      return route.fulfill(J({ result: 'success', rows: [], lessons: [] }));
    }
    let b = {}; try { b = JSON.parse(route.request().postData() || '{}'); } catch (e) { /* 빈 본문 */ }
    if (WHAT === 'retry') { // v184 — action마다 첫 POST는 구글 오류 화면(HTML 200), 다음부터 정상
      const k = b.action || 'submit';
      const first = !POSTLOG.some(x => x.k === k);
      POSTLOG.push({ k, cid: b.clientId || '', res: first ? 'html' : 'json' });
      if (first) return route.fulfill({ status: 200, contentType: 'text/html', body: '<!DOCTYPE html><html><body>Google Drive 오류</body></html>' });
    }
    if (b.action === 'login') return route.fulfill(J({ result: 'success', session: { token: 'fixture', exp: 4102444800000, sid: b.studentId, name: b.name } }));
    if (b.action === 'setLessonUnits') { UNIT_POSTS.push(b.items); return route.fulfill(J({ result: 'success', count: (b.items || []).length })); } // v194
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
    await page.goto('http://localhost:8765/index.html' + (process.env.PAGE_QS || '')); await page.waitForTimeout(600);  // v187: PAGE_QS='?season=xmas' 처럼 확인용 주소 붙이기
    return { ctx, page, errs };
  }
  if (WHAT === 'student' || WHAT === 'all') {
    for (const [vn, w, h] of [['phone', 375, 812], ['tablet', 820, 1180], ['pc', 1280, 900]]) {
      const { ctx, page, errs } = await open(w, h);
      await page.fill('#inputId', '20101'); await page.fill('#inputName', '테스트'); await page.fill('#inputPw', '1234'); await page.click('#btnLogin');
      await page.waitForSelector('#portalView.shown', { timeout: 15000 }); await page.waitForTimeout(1200);
      const info = await page.evaluate(() => ({ next: document.getElementById('nextTitle').textContent, sub: document.getElementById('nextSub').textContent, otherHead: getComputedStyle(document.getElementById('otherHead')).display, over: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
      await page.screenshot({ path: path.join(OUT, `student_${vn}.png`), fullPage: true });
      if (process.env.PAGE_QS) await page.locator('#treeBox').screenshot({ path: path.join(OUT, `tree_${vn}.png`) });  // v187
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
  if (WHAT === 'units') { // v194 — 학생 연표가 시트 단원으로 묶이는지 + 대시보드 «단원 한꺼번에 정하기»·폼 단원 칸
    const want = { '시험단원 가': EMPTY + 1, '시험단원 나': g2.length - EMPTY - 1 }; // 빈 차시는 앞 차시 단원(가)으로
    for (const [vn, w, h] of [['phone360', 360, 780], ['tablet768', 768, 1024], ['tablet1180', 1180, 820], ['pc', 1280, 900]]) {
      const { ctx, page, errs } = await open(w, h);
      await page.fill('#inputId', '20101'); await page.fill('#inputName', '테스트'); await page.fill('#inputPw', '1234'); await page.click('#btnLogin');
      await page.waitForSelector('#portalView.shown', { timeout: 15000 }); await page.waitForTimeout(1200);
      const groups = await page.evaluate(() => [...document.querySelectorAll('#timeline .unit-group')].map(g => ({ name: g.dataset.unit, n: g.querySelectorAll('.lesson').length })));
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const ok = groups.length === 2 && groups.every(g => want[g.name] === g.n);
      await page.locator('#timeline').screenshot({ path: path.join(OUT, `units_student_${vn}.png`) });
      summary['units_student_' + vn] = { ok, groups, over, errs: errs.length ? errs : '없음' };
      await ctx.close();
    }
    for (const [vn, w, h] of [['pc', 1280, 900], ['tablet768', 768, 1024], ['phone360', 360, 780]]) {
      const { ctx, page, errs } = await open(w, h);
      await page.click('#btnTeacherMode'); await page.fill('#tokenInput', 'fixture-token'); await page.click('#btnGate');
      await page.waitForSelector('#dashView', { state: 'visible', timeout: 15000 }); await page.waitForTimeout(1500);
      await page.click('.dash-tab[data-tab="curriculum"]'); await page.waitForTimeout(500);
      await page.evaluate(() => clSetGrade_('2'));
      await page.locator('#panelCurriculum button', { hasText: '등록된 활동' }).first().click(); await page.waitForTimeout(300);
      await page.click('#clUnitBulk > summary'); await page.waitForTimeout(300);
      const before = await page.evaluate(() => ({ rows: [...document.querySelectorAll('#clUnitBulkList .cl-unit-input')].map(i => i.value), changed: document.querySelectorAll('#clUnitBulkList .cl-unit-row.changed').length, btn: document.getElementById('btnClUnitSave').textContent, meta: document.getElementById('clUnitBulkMeta').textContent, opts: document.querySelectorAll('#clUnitBulkOptions option').length }));
      await page.locator('#clUnitBulkList .cl-unit-input').first().fill('바꾼 단원');
      const after = await page.evaluate(() => ({ changed: document.querySelectorAll('#clUnitBulkList .cl-unit-row.changed').length, btn: document.getElementById('btnClUnitSave').textContent }));
      await page.locator('#clUnitBulk').screenshot({ path: path.join(OUT, `units_dash_${vn}.png`) });
      await page.click('#btnClUnitSave'); await page.waitForTimeout(300);
      const dlg = await page.evaluate(() => ({ open: document.getElementById('clUnitConfirm').open, items: document.querySelectorAll('#clUnitConfirmList li').length, desc: document.getElementById('clUnitConfirmDesc').textContent }));
      await page.screenshot({ path: path.join(OUT, `units_dialog_${vn}.png`) });
      const nPost = UNIT_POSTS.length;
      await page.click('#clUnitConfirmYes'); await page.waitForTimeout(1500);
      const sent = UNIT_POSTS.slice(nPost);
      const closed = await page.evaluate(() => !document.getElementById('clUnitConfirm').open);
      // 폼: 첫 차시 «수정» → 단원 칸 프리필, datalist에 그 학년 단원
      await page.locator('#clList .cl-grade-group[data-grade="2"] .cl-item').first().locator('button', { hasText: '수정' }).first().click().catch(() => {});
      await page.waitForTimeout(300);
      const form = await page.evaluate(() => ({ unit: document.getElementById('clUnit').value, opts: [...document.querySelectorAll('#clUnitOptions option')].map(o => o.value) }));
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const ok = before.rows.length === g2.length && before.changed === 1 && after.changed === 2 && dlg.open && dlg.items === 2 && sent.length === 1 && sent[0].length === 2 && closed;
      summary['units_dash_' + vn] = { ok, before, after, dlg, sent, closed, form, over, errs: errs.length ? errs : '없음' };
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
  // v124 — 3학년 시험기간(?exam=1): 감정 체크인 → «시험 응원 포춘쿠키» 문구가 시험 문구 은행에서 나오는지, 수행평가 카드의 «기말고사 목표 점수»
  if (WHAT === 'exam') {
    for (const [vn, w, h] of [['phone', 375, 812], ['tablet', 768, 1024], ['tabletL', 1180, 820], ['pc', 1280, 900]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } }); const page = await ctx.newPage(); const errs = [];
      page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 100)); });
      await page.route(/script\.google\.com/, routeBackend);
      await page.goto('http://localhost:8765/index.html?exam=1'); await page.waitForTimeout(600);
      await page.fill('#inputId', '30501'); await page.fill('#inputName', '테스트'); await page.fill('#inputPw', '1234'); await page.click('#btnLogin');
      await page.waitForSelector('#checkinView .temp-btn', { timeout: 15000 });
      await page.click('.temp-btn[data-temp="3"]'); await page.waitForTimeout(300);
      await page.click('.emo-chip'); await page.waitForSelector('#fcCookie'); await page.click('#fcCookie', { force: true }); /* 쿠키가 계속 흔들려(애니메이션) stable 대기를 건너뜀 */ await page.waitForTimeout(700);
      const cookie = await page.evaluate(() => {
        const slip = document.getElementById('fcSlip').textContent, ex = CHECKIN_EMOTION.examFortunes;
        return { eyebrow: document.querySelector('#ckRightBody .checkin-eyebrow').textContent, slip, fromExamBank: Object.values(ex).some(a => a.includes(slip)) };
      });
      await page.screenshot({ path: path.join(OUT, `exam_cookie_${vn}.png`), fullPage: true });
      await page.click('#fcGo'); await page.waitForSelector('#portalView.shown', { timeout: 15000 }); await page.waitForTimeout(800);
      await page.click('#perfOpenBtn'); await page.waitForSelector('.perf-target', { timeout: 5000 });
      const target = await page.evaluate(() => ({ head: document.querySelector('.perf-target-head').textContent, over: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
      await page.locator('#perfCard').screenshot({ path: path.join(OUT, `exam_target_${vn}.png`) });
      summary['exam_' + vn] = { cookie, target, errs: errs.length ? errs : '없음' };
      await ctx.close();
    }
  }
  // v128 — 감정 칩: 무거운 단어(h:1) 최대 1개 + 맨 끝 중립 칩 + 폭별 넘침 없음 + 중립 칩을 골랐을 때 중립 한마디(fortunes.n).
  if (WHAT === 'retry') { // v184 — 학생 저장 POST가 오류 화면 한 번 뒤 같은 clientId로 다시 가는지
    const { ctx, page, errs } = await open(375, 812);
    await page.fill('#inputId', '20101'); await page.fill('#inputName', '테스트'); await page.fill('#inputPw', '1234'); await page.click('#btnLogin');
    await page.waitForSelector('#portalView.shown', { timeout: 20000 }); await page.waitForTimeout(800);
    const toasts = [];
    await page.exposeFunction('__toast', t => toasts.push(t));
    await page.evaluate(() => { const o = window.showToast; window.showToast = function (t) { window.__toast(t); return o.apply(this, arguments); }; });
    await page.evaluate(() => { document.getElementById('questionInput').value = '재시도 질문'; return askQuestion(); });
    await page.evaluate(() => { const d = document.createElement('div'); d.className = 'lesson'; d.dataset.lid = 'x'; const b = document.createElement('button'); b.dataset.activity = 'L1'; d.appendChild(b); document.body.appendChild(d); return selfCheck(b); });
    await page.evaluate(() => { document.getElementById('msgInput').value = '답장'; return sendMessageReply(); });
    const by = k => POSTLOG.filter(x => x.k === k);
    const pair = k => { const r = by(k); return r.length === 2 && r[0].res === 'html' && r[1].res === 'json' && !!r[0].cid && r[0].cid === r[1].cid; };
    summary.retry = { posts: POSTLOG.slice(), loginRetried: pair('login'), askRetried: pair('askQuestion'), selfCheckRetried: pair('submit'), replyRetried: pair('replyMessage'), toasts, errs: errs.length ? errs : '없음' };
    await page.screenshot({ path: path.join(OUT, 'retry_phone.png') });
    await ctx.close();
  }
  if (WHAT === 'boot') { // v182
    // ① 처음 오는 기기, 비밀번호 로그인 — 방문 전체를 센다(저장본이 없어 부팅 때 커리큘럼·계획 + 로그인 studentBoot = 3)
    { GETLOG.length = 0;
      const { ctx, page, errs } = await open(375, 812);
      await page.fill('#inputId', '20101'); await page.fill('#inputName', '테스트'); await page.fill('#inputPw', '1234'); await page.click('#btnLogin');
      await page.waitForSelector('#portalView.shown', { timeout: 15000 }); await page.waitForTimeout(6500);
      const ann = await page.evaluate(() => document.body.innerText.includes('부트 공지 확인'));
      summary.boot_pw = { gets: GETLOG.slice(), annShown: ann, errs: errs.length ? errs : '없음' };
      // ② 같은 기기 다시 열기: 저장본(커리큘럼·계획)+세션 → 자동 입장, 부팅 갱신까지 6.5초 기다려 GET 수를 센다
      GETLOG.length = 0;
      await page.reload(); await page.waitForSelector('#portalView.shown', { timeout: 15000 }); await page.waitForTimeout(6500);
      const st = await page.evaluate(() => ({ cur: CURRICULUM_FROM_CACHE, plan: CHECKIN_PLAN_FROM_CACHE, ann: document.body.innerText.includes('부트 공지 확인') }));
      summary.boot_auto = { gets: GETLOG.slice(), stillFromCache: st, errs: errs.length ? errs : '없음' };
      // ③ 저장본은 있고 세션만 없는 기기(로그아웃·만료): 7초 기다려도 GET 0, 비밀번호 로그인 때 studentBoot+shared 하나
      await page.evaluate(() => localStorage.removeItem('h26_auth'));
      GETLOG.length = 0;
      await page.reload(); await page.waitForTimeout(7000);
      const idle = GETLOG.slice();
      await page.fill('#inputPw', '1234'); await page.click('#btnLogin');
      await page.waitForSelector('#portalView.shown', { timeout: 15000 }); await page.waitForTimeout(6500);
      summary.boot_nosession = { beforeLogin: idle, all: GETLOG.slice(), errs: errs.length ? errs : '없음' };
      await page.screenshot({ path: path.join(OUT, `boot${BOOT_LEGACY ? '_legacy' : ''}_phone.png`), fullPage: true });
      await ctx.close(); }
  }
  if (WHAT === 'lecturer') { // v195 — 강사 토큰으로 들어가면 수업 진행 탭만, 편집·효니 시간표 칸은 숨김, ?dash=로 막힌 탭을 열어도 오늘 탭, 나가면 되돌림
    for (const [vn, w, h] of [['phone', 375, 812], ['tablet', 820, 1180], ['pc', 1280, 900]]) {
      const { ctx, page, errs } = await open(w, h);
      await page.click('#btnTeacherMode'); await page.fill('#tokenInput', 'lecturer-token'); await page.click('#btnGate');
      await page.waitForSelector('#dashView', { state: 'visible', timeout: 15000 }); await page.waitForTimeout(800);
      const vis = sel => page.evaluate(s => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.offsetParent !== null; }, sel);
      const tabs = await page.evaluate(() => [...document.querySelectorAll('.dash-tab')].filter(b => b.offsetParent !== null).map(b => b.dataset.tab));
      const active = await page.evaluate(() => (document.querySelector('.dash-tab.active') || {}).dataset?.tab);
      const sideErr = await vis('#dashSideErr');
      const today = { help: await vis('#helpCard'), tdLogin: await vis('#tdLogin'), tdGrid: await vis('#tdGrid') };
      await page.evaluate(() => switchDashTab('grades'));
      const afterGrades = await page.evaluate(() => (document.querySelector('.dash-tab.active') || {}).dataset?.tab);
      await page.evaluate(() => switchDashTab('curriculum')); await page.waitForTimeout(300);
      const cur = { add: await vis('#clSubAdd'), list: await vis('#clSubList'), unitBulk: await vis('#clUnitBulk'), edit: await vis('#clList [onclick^="dashEditLesson"]'), del: await vis('#clList .cl-del'),
        pub: await vis('#clList [onclick^="dashToggleLessonPublic"]'), drag: await page.evaluate(() => document.querySelectorAll('#clList [draggable="true"]').length), csv: await vis('#btnCsv') };
      await page.screenshot({ path: path.join(OUT, `lecturer_curriculum_${vn}.png`), fullPage: true });
      await page.evaluate(() => switchDashTab('today')); await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `lecturer_today_${vn}.png`), fullPage: true });
      await page.click('#btnDashOut'); await page.waitForTimeout(300);
      const afterOut = await page.evaluate(() => ({ cls: document.body.classList.contains('dash-lecturer'), hidden: [...document.querySelectorAll('.dash-tab')].filter(b => b.style.display === 'none').length, role: DASH_ROLE }));
      summary['lecturer_' + vn] = { tabs, active, afterGrades, sideErr, today, cur, afterOut, errs: errs.length ? errs : '없음' };
      await ctx.close();
    }
  }
  if (WHAT === 'chips') {
    for (const [vn, w, h] of [['phone', 375, 812], ['tablet', 768, 1024], ['pc', 1280, 900]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } }); const page = await ctx.newPage(); const errs = [];
      page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 100)); });
      await page.route(/script\.google\.com/, routeBackend);
      await page.goto('http://localhost:8765/index.html' + (process.env.PAGE_QS || '')); await page.waitForTimeout(600);  // v187: PAGE_QS='?season=xmas' 처럼 확인용 주소 붙이기
      await page.fill('#inputId', '20101'); await page.fill('#inputName', '테스트'); await page.fill('#inputPw', '1234'); await page.click('#btnLogin');
      await page.waitForSelector('#checkinView .temp-btn', { timeout: 15000 });
      await page.click('.temp-btn[data-temp="3"]'); await page.waitForTimeout(300);
      const chips = await page.evaluate(() => {
        const list = [...document.querySelectorAll('.emo-chip')].map(b => b.textContent.trim());
        const pool = CHECKIN_EMOTION.pool, q = t => (pool.find(m => t.endsWith(m.t)) || {}).q, hv = t => !!(pool.find(m => t.endsWith(m.t)) || {}).h;
        return { list, quadrants: list.map(q), heavy: list.filter(hv).length, over: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      await page.screenshot({ path: path.join(OUT, `chips_${vn}.png`), fullPage: true });
      await page.locator('.emo-chip').last().click(); await page.waitForSelector('#fcCookie'); await page.click('#fcCookie', { force: true }); await page.waitForTimeout(700);
      const cookie = await page.evaluate(() => { const slip = document.getElementById('fcSlip').textContent; return { slip, fromNeutral: CHECKIN_EMOTION.fortunes.n.includes(slip) }; });
      summary['chips_' + vn] = { chips, ok: chips.quadrants[chips.quadrants.length - 1] === 'n' && chips.heavy <= 1 && chips.over <= 0, cookie, errs: errs.length ? errs : '없음' };
      await ctx.close();
    }
  }
  await browser.close(); srv.close();
  console.log(JSON.stringify(summary, null, 1));
})().catch(e => { console.error(e.message); process.exit(1); });
