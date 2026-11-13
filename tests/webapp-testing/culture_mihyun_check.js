/* v174(2026-11-13) — 대시보드 «🏺 문화사 발굴단» 반 버튼이 토큰 교사에 맞는지 점검(Node + Playwright, 시트에 안 씀).
 * culture_check.js와 같은 틀: 포털을 로컬 정적 서버로 띄우고 Apps Script를 가짜 응답으로 바꾼다(POST도 가짜 — 본문만 기록).
 * 사용: node tests/webapp-testing/culture_mihyun_check.js <출력 폴더>
 * 확인하는 것
 *  1) 미현쌤 토큰: 반 버튼이 3-1~3-4뿐, 처음 반 = 3-1
 *  2) 명단 없는 반: 번호 칸이 «문화사 기록을 낸 번호»(1-2, 4, 7, 9)로 차고 안내 문구가 보임
 *  3) 뽑기 → 확정: cultureTeamsSave 본문 ban=1, 번호 5명
 *  4) 효니 토큰: 반 버튼이 3-5~3-8뿐
 *  5) 폰 360 폭 가로 넘침 없음, 페이지 오류 없음 */
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
if (!OUT) { console.error('사용: node culture_mihyun_check.js <출력 폴더>'); process.exit(2); }
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

const sid = (ban, no) => '3' + String(ban).padStart(2, '0') + String(no).padStart(2, '0');
function quizRow(ban, no) {
  return { timestamp: new Date().toISOString(), studentId: sid(ban, no), studentName: '테스트' + no, gameName: '문화사_팀테스트',
    choiceSummary: '지망', choicesJson: JSON.stringify({ ranking: ['붓', '곡괭이', '돋보기', '나침반'] }), groupId: '' };
}
function digRow(ban, no) {
  return { timestamp: new Date().toISOString(), studentId: sid(ban, no), studentName: '테스트' + no, gameName: '문화사_유물발굴',
    choiceSummary: '점수 10', choicesJson: JSON.stringify({ score: { score: 10 } }), groupId: '' };
}

(async () => {
  await new Promise(r => srv.listen(0, r));
  const port = srv.address().port;
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch());

  async function openCulture(teacher, rows, vp) {
    const state = { posts: [] };
    const page = await browser.newPage({ viewport: vp || { width: 1280, height: 900 } });
    const errs = []; page.on('pageerror', e => errs.push(String(e)));
    page.on('dialog', d => d.accept());
    await page.route(/script\.google(usercontent)?\.com/, async route => {
      const req = route.request(), u = req.url();
      if (req.method() === 'GET') {
        if (u.includes('mode=cultureTeams')) return route.fulfill(J({ result: 'success', teams: {} }));
        if (u.includes('mode=curriculumAdmin')) return route.fulfill(J({ result: 'success', lessons: [], gradeInfo: {} }));
        if (u.includes('mode=curriculum')) return route.continue();
        if (u.includes('mode=perfScoreAdmin')) return route.fulfill(J({ result: 'success', rows: [], exams: [] }));
        if (u.includes('mode=groups')) return route.fulfill(J({ result: 'success', groups: {} }));
        if (u.includes('token=') && !u.includes('mode=')) {
          const game = new URL(u).searchParams.get('game');
          return route.fulfill(J({ result: 'success', rows: game ? rows.filter(r => r.gameName === game) : rows, teacher }));
        }
        return route.fulfill(J({ result: 'success', rows: [], lessons: [] }));
      }
      let b = {}; try { b = JSON.parse(req.postData() || '{}'); } catch (e) { /* 빈 본문 */ }
      state.posts.push(b);
      return route.fulfill(J({ result: 'success' }));
    });
    await page.goto(`http://localhost:${port}/index.html`);
    await page.click('#btnTeacherMode'); await page.fill('#tokenInput', 'fixture-token'); await page.click('#btnGate');
    await page.waitForSelector('#dashView', { state: 'visible', timeout: 15000 });
    await page.evaluate(() => { switchDashTab('groups'); grSetSub_('culture'); });
    await page.waitForSelector('#ctNums', { timeout: 15000 });
    const banBtns = await page.$$eval('#ctBox .ct-top button', els => els.map(e => e.textContent.trim()).filter(t => /^3-\d$/.test(t)));
    return { page, errs, state, banBtns };
  }

  /* 1~3) 미현쌤 */
  {
    const rows = [quizRow(1, 1), quizRow(1, 2), quizRow(1, 4), digRow(1, 7), digRow(1, 9), quizRow(5, 3)];
    const { page, errs, state, banBtns } = await openCulture('미현쌤', rows);
    check('미현쌤: 반 버튼 3-1~3-4뿐', banBtns.join() === '3-1,3-2,3-3,3-4', banBtns.join());
    check('미현쌤: 처음 반 = 3-1', /3학년 1반/.test(await page.textContent('#ctBox')));
    const nums = await page.$eval('#ctNums', e => e.value);
    check('명단 없는 반: 번호 칸 = 기록 낸 번호(다른 반 번호 섞이지 않음)', nums === '1-2, 4, 7, 9', nums);
    check('명단 없는 반: «빠진 번호를 넣어» 안내 보임', /아직 아무것도 안 낸 학생 번호/.test(await page.textContent('#ctBox')));
    await page.click('#ctBox button:has-text("뽑기")');
    await page.waitForSelector('#ctBox button:has-text("확정")', { timeout: 10000 });
    await page.click('#ctBox button:has-text("확정")');
    await page.waitForTimeout(800);
    const p = state.posts.find(x => x.action === 'cultureTeamsSave');
    check('확정 → cultureTeamsSave ban=1, 5명', p && Number(p.ban) === 1 && Object.keys(p.teams).length === 5, p ? JSON.stringify({ ban: p.ban, n: Object.keys(p.teams).length }) : '없음');
    await page.screenshot({ path: path.join(OUT, 'mihyun_pc.png'), fullPage: false });
    check('미현쌤: 페이지 오류 없음', !errs.length, errs.join(' | '));
    await page.close();
  }
  /* 4) 효니 */
  {
    const { page, errs, banBtns } = await openCulture('효니', [quizRow(5, 1)]);
    check('효니: 반 버튼 3-5~3-8뿐', banBtns.join() === '3-5,3-6,3-7,3-8', banBtns.join());
    check('효니: 명단 있는 반은 안내 문구 없음', !/아직 아무것도 안 낸 학생 번호/.test(await page.textContent('#ctBox')));
    check('효니: 페이지 오류 없음', !errs.length, errs.join(' | '));
    await page.close();
  }
  /* 5) 폰 폭 */
  {
    const { page, errs } = await openCulture('미현쌤', [quizRow(1, 1)], { width: 360, height: 780 });
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check('폰 360: 가로 넘침 없음', over <= 0, String(over));
    await page.screenshot({ path: path.join(OUT, 'mihyun_phone.png'), fullPage: false });
    check('폰 360: 페이지 오류 없음', !errs.length, errs.join(' | '));
    await page.close();
  }

  await browser.close(); srv.close();
  const fail = results.filter(r => !r.ok).length;
  console.log('\n요약: ' + (results.length - fail) + '/' + results.length + ' 통과');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
