/* 세 폭(폰 360·태블릿 820·PC 1280) 스크린샷 + 콘솔 오류 확인.
 *
 * 사용: node tests/webapp-testing/shot.js <URL> <출력 폴더> [이름접두어]
 *   예) python3 -m http.server 8765 &      # 포털은 file:// 말고 로컬 서버로
 *       node tests/webapp-testing/shot.js http://localhost:8765/index.html "$SCRATCH" portal
 * 결과 PNG는 Read로 열어 눈으로 확인한다.
 *
 * playwright 모듈 위치가 컨테이너마다 달라서(세션마다 경로를 새로 찾던 문제) 알려진 후보를
 * 순서대로 시도한다. 브라우저는 PWTEST_CHROMIUM_PATH → /opt/pw-browsers/chromium 순.
 * 설치(`playwright install`)는 하지 않는다. */
const fs = require('fs');
const path = require('path');

function loadPlaywright() {
  const cands = ['playwright', 'playwright-core',
    '/opt/node22/lib/node_modules/playwright', '/opt/node-tools/node_modules/playwright',
    '/usr/lib/node_modules/playwright', '/usr/local/lib/node_modules/playwright'];
  for (const c of cands) { try { return require(c); } catch (e) { /* 다음 후보 */ } }
  throw new Error('playwright 모듈을 못 찾음. 후보: ' + cands.join(', '));
}

const VIEWPORTS = [['phone', 360, 800], ['tablet', 820, 1100], ['pc', 1280, 900]];

(async () => {
  const [url, out, prefix = 'shot'] = process.argv.slice(2);
  if (!url || !out) { console.error('사용: node shot.js <URL> <출력 폴더> [접두어]'); process.exit(2); }
  fs.mkdirSync(out, { recursive: true });
  const { chromium } = loadPlaywright();
  const exe = process.env.PWTEST_CHROMIUM_PATH ||
    (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  for (const [name, w, h] of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(url);
    await page.waitForTimeout(600);
    const file = path.join(out, `${prefix}_${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(file, '콘솔 오류:', errs.length ? errs : '없음');
  }
  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
