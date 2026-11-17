/* v184 — 포털 학생 저장 POST 재시도(portalPost_, js/01-core-login.js) 시험. 브라우저·서버 없이 node로 돈다.
 * 쓰는 법: node tests/webapp-testing/post_retry_check.js
 * js/01에서 PORTAL_POST_RETRY_ACTIONS ~ portalClientId_ 부분만 잘라 가짜 fetch·타이머로 돌린다. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', '..', 'js', '01-core-login.js'), 'utf8');
const a = src.indexOf('const PORTAL_POST_RETRY_ACTIONS');
const b = src.indexOf('/* v171 — 학생 로그인 조회');
if (a < 0 || b < a) { console.error('portalPost_ 부분을 못 찾음'); process.exit(1); }
const code = src.slice(a, b) + '\nthis.portalPost_ = portalPost_; this.portalClientId_ = portalClientId_;';

const results = [];
const ok = (name, cond, info) => results.push((cond ? 'ok   ' : 'FAIL ') + name + (cond || !info ? '' : ' — ' + info));

function makeCtx(script) {
  const calls = [];
  const delays = [];
  const ctx = {
    CONFIG: { WEBAPP_URL: 'https://example.invalid/exec' },
    console, Math, Date, JSON, Object, Promise, Error, String,
    AbortController,
    window: { crypto: { randomUUID: () => 'uuid-' + Math.random().toString(36).slice(2, 12) } },
    crypto: { randomUUID: () => 'uuid-' + Math.random().toString(36).slice(2, 12) },
    setTimeout: (fn, ms) => { delays.push(ms); return setTimeout(fn, ms >= 30000 ? 5 : 0); },
    clearTimeout: t => clearTimeout(t),
    fetch: (url, init) => {
      const body = JSON.parse(init.body);
      calls.push(body);
      const step = script[Math.min(calls.length - 1, script.length - 1)];
      if (step === 'net') return Promise.reject(new TypeError('Failed to fetch'));
      if (step === 'hang') return new Promise((res, rej) => {
        init.signal.addEventListener('abort', () => rej(new Error('AbortError')));
      });
      return Promise.resolve({ ok: step.status === 200, status: step.status, text: () => Promise.resolve(step.text) });
    },
  };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return { ctx, calls, delays };
}
const HTML = { status: 200, text: '<!DOCTYPE html><html>Google 오류</html>' };
const J = o => ({ status: 200, text: JSON.stringify(o) });

(async () => {
  // 1. 오류 화면 한 번 → 두 번째에 성공, 같은 clientId
  {
    const { ctx, calls, delays } = makeCtx([HTML, J({ result: 'success' })]);
    const r = await ctx.portalPost_({ action: 'askQuestion', studentId: '20102', question: 'q' });
    ok('오류 화면 뒤 다시 보내 성공', r.result === 'success' && calls.length === 2);
    ok('재시도에도 같은 clientId', !!calls[0].clientId && calls[0].clientId === calls[1].clientId, JSON.stringify(calls));
    ok('clientId 모양(영숫자·하이픈 8~64자)', /^[A-Za-z0-9_-]{8,64}$/.test(calls[0].clientId), calls[0].clientId);
    ok('쉬는 시간 1~3초', delays.some(ms => ms >= 1000 && ms <= 3000), JSON.stringify(delays));
  }
  // 2. 네트워크 끊김 세 번 → netFail 던짐, 3번 보냄
  {
    const { ctx, calls } = makeCtx(['net']);
    let err = null;
    try { await ctx.portalPost_({ action: 'replyMessage', content: 'x' }); } catch (e) { err = e; }
    ok('세 번 다 끊기면 netFail Error', err && err.netFail === true && calls.length === 3, String(err) + ' calls ' + calls.length);
  }
  // 3. 정상 JSON 오류는 다시 안 보내고 그대로
  {
    const { ctx, calls } = makeCtx([J({ result: 'error', message: '학번·이름·비밀번호가 맞지 않아요.' })]);
    const r = await ctx.portalPost_({ action: 'login', studentId: '20102', name: '둘', password: '1' });
    ok('정상 JSON 오류(로그인 실패)는 한 번만', r.result === 'error' && calls.length === 1);
  }
  // 4. 목록 밖 action(changePassword)은 한 번만, clientId 안 붙임
  {
    const { ctx, calls } = makeCtx([HTML, J({ result: 'success' })]);
    let err = null;
    try { await ctx.portalPost_({ action: 'changePassword', oldPassword: '1', newPassword: '2' }); } catch (e) { err = e; }
    ok('changePassword는 오류 화면이어도 한 번만', err && err.netFail && calls.length === 1 && !calls[0].clientId, JSON.stringify(calls));
  }
  // 5. HTTP 오류(JSON 본문이어도) → 다시 보냄
  {
    const { ctx, calls } = makeCtx([{ status: 500, text: '{"result":"error"}' }, J({ result: 'success' })]);
    const r = await ctx.portalPost_({ action: 'helpAsk' });
    ok('HTTP 500이면 다시 보냄', r.result === 'success' && calls.length === 2);
  }
  // 6. 30초 넘게 멈추면 끊고 다시
  {
    const { ctx, calls, delays } = makeCtx(['hang', J({ result: 'success', duplicate: true })]);
    const r = await ctx.portalPost_({ action: 'cancelSelfCheck', activityId: 'L1' });
    ok('30초 초과면 끊고 다시 보냄(중복 응답도 success)', r.result === 'success' && calls.length === 2 && delays.indexOf(30000) >= 0, JSON.stringify(delays));
  }
  // 7. 기본 제출(자가체크, action 없음)도 재시도 + clientId
  {
    const { ctx, calls } = makeCtx(['net', J({ result: 'success' })]);
    const r = await ctx.portalPost_({ studentId: '20102', gameName: 'L1', choiceSummary: '자가체크' });
    ok('자가체크 기본 제출도 다시 보냄', r.result === 'success' && calls.length === 2 && calls[0].clientId === calls[1].clientId);
  }
  // 8. 원래 payload를 바꾸지 않는다(clientId는 복사본에만)
  {
    const { ctx } = makeCtx([J({ result: 'success' })]);
    const p = { action: 'checkin', lessonId: 'x' };
    await ctx.portalPost_(p);
    ok('부른 쪽 payload는 그대로', !('clientId' in p));
  }
  // 9. 목록에 없는 학생 action이 늘어나도 기본은 한 번만 — 목록 내용 확인
  {
    const { ctx } = makeCtx([J({})]);
    const list = vm.runInContext('PORTAL_POST_RETRY_ACTIONS', ctx);
    ok('재시도 목록에 changePassword·ackMessages·교사 action 없음', ['changePassword', 'ackMessages', 'ackFeedback', 'requestPasswordReset', 'helpResolve'].every(x => list.indexOf(x) < 0), JSON.stringify(list));
  }
  console.log(results.join('\n'));
  const fails = results.filter(x => x.startsWith('FAIL')).length;
  console.log(`\n${results.length - fails}/${results.length} 통과`);
  process.exit(fails ? 1 : 0);
})();
