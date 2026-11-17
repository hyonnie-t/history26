// node snippets/submit_retry.test.mjs — submit_retry.js의 postWithRetry를 가짜 fetch로 시험한다(네트워크 없음).
// 활동 웹앱에 복사한 사본도 같은 시험을 돌리려면: node snippets/submit_retry.test.mjs <앱 app.js 경로>
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const src = process.argv[2] || fileURLToPath(new URL('./submit_retry.js', import.meta.url));
const text = fs.readFileSync(src, 'utf8');
const a = text.indexOf('async function postWithRetry');
const b = text.indexOf('\n}', text.indexOf('function submitRand', a)) + 2;
if (a < 0 || b < 2) { console.error('함수를 못 찾음: ' + src); process.exit(1); }
const code = text.slice(a, b);

let calls = [], script = [], waits = [];
const ctx = {
  window: {}, crypto: globalThis.crypto, Math, JSON, Object, Promise, Error, Date, AbortController,
  setTimeout: (fn, ms) => { if (ms !== 30000) waits.push(ms); return setTimeout(fn, ms === 30000 ? ms : 0); },
  clearTimeout,
  fetch: async (url, init) => {
    calls.push(JSON.parse(init.body));
    const step = script.shift();
    if (step === 'net') throw new TypeError('Failed to fetch');
    if (step === 'html') return { ok: true, text: async () => '<!DOCTYPE html><html>오류</html>' };
    if (step === '500') return { ok: false, text: async () => '{"result":"error"}' };
    return { ok: true, text: async () => JSON.stringify(step) };
  },
};
ctx.window.crypto = globalThis.crypto;
vm.createContext(ctx);
vm.runInContext(code + '\nthis.postWithRetry = postWithRetry; this.newClientId = newClientId;', ctx);

const results = [];
const ok = (name, cond, extra) => results.push((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : ' — ' + (extra || '')));
async function run(steps, payload) {
  calls = []; script = steps.slice(); waits = [];
  try { return { json: await ctx.postWithRetry('https://x', payload) }; } catch (e) { return { err: e }; }
}
const base = { studentId: '20101', studentName: '가', gameName: 'L1' };

let r = await run([{ result: 'success' }], base);
ok('정상: 한 번에 성공', r.json && r.json.result === 'success' && calls.length === 1);
ok('정상: clientId를 붙인다(8~64자 영숫자·하이픈)', /^[A-Za-z0-9_-]{8,64}$/.test(calls[0].clientId || ''), calls[0].clientId);
ok('원래 payload 객체는 그대로', base.clientId === undefined);

r = await run(['html', { result: 'success' }], base);
ok('오류 화면 뒤 재시도 성공', r.json && r.json.result === 'success' && calls.length === 2);
ok('재시도도 같은 clientId', calls[0].clientId && calls[0].clientId === calls[1].clientId);
ok('재시도 전 1~3초 쉰다', waits.length === 1 && waits[0] >= 1000 && waits[0] <= 3000, JSON.stringify(waits));

r = await run(['net', 'net', 'net'], base);
ok('네트워크 3번 실패면 Error(학생 문구)', r.err && /저장하지 못했어/.test(r.err.message) && calls.length === 3, r.err && r.err.message);
ok('최대 2번 더(총 3번)', calls.length === 3);

r = await run(['500', 'html', { result: 'success', duplicate: true }], base);
ok('HTTP 오류·오류 화면 뒤 성공(중복 응답도 success)', r.json && r.json.result === 'success' && calls.length === 3);

r = await run([{ result: 'error', message: '앞 활동을 먼저', locked: true }], base);
ok('정상 JSON 오류는 다시 안 보낸다', r.json && r.json.result === 'error' && r.json.locked === true && calls.length === 1);

r = await run(['html', 'html'], Object.assign({ action: 'helpAsk' }, base));
ok('action 있는 요청은 한 번만, clientId 없음', r.err && calls.length === 1 && calls[0].clientId === undefined);

r = await run(['html', { result: 'success' }], Object.assign({ stage: 'judgment', groupId: 'G1' }, base));
ok('짝 1차 판단(stage=judgment)도 재시도', r.json && calls.length === 2 && calls[0].clientId === calls[1].clientId);

r = await run([{ result: 'success' }], Object.assign({ clientId: 'given-id-0001' }, base));
ok('이미 있는 clientId는 그대로', calls[0].clientId === 'given-id-0001');

const ids = new Set(Array.from({ length: 200 }, () => ctx.newClientId()));
ok('clientId는 매번 다르다', ids.size === 200);

console.log(results.join('\n'));
const fails = results.filter(x => x.startsWith('FAIL')).length;
console.log(`\n${results.length - fails}/${results.length} 통과 (${src})`);
process.exit(fails ? 1 : 0);
