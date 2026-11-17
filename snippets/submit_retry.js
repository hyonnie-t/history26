/* submit_retry.js — 활동 웹앱 기본 제출 재시도 (v183, 2026-11-17)
 *
 * 이 파일은 «복사해 넣는 원본»이다. 활동 웹앱 app.js의 postToSheet(또는 postBody) 바로 위에 두 함수를 그대로 붙이고,
 * fetch + res.json() 부분을 `const json = await postWithRetry(CONFIG.SHEET_WEBAPP_URL, payload);` 한 줄로 바꾼다.
 * 바깥 파일로 불러오지 않는 까닭: 이 파일을 못 받으면 제출 자체가 막히기 때문(학교망·캐시).
 *
 * 왜: 2026-11-17 두 반이 겹친 수업에서 구글이 JSON 대신 오류 화면(HTML)을 돌려준 «0초 실패»가 108건 났다.
 *   옛 postToSheet는 res.json()이 바로 깨져 «저장 실패»가 뜨고 학생이 다시 눌러야 했다.
 * 하는 일:
 *   - 서버가 JSON이 아닌 답(오류 화면)·HTTP 오류를 주거나, 네트워크가 끊기거나, 30초 안에 답이 없으면 1~3초 무작위로 쉬고 최대 2번 더 보낸다.
 *   - 서버가 정상 JSON으로 답한 오류(순차 잠금·로그인 필요·시간 마감 등)는 다시 보내지 않고 그 JSON을 그대로 돌려준다.
 *   - 다시 보내는 것은 기본 제출(body에 action이 없는 것 — 짝 1차 판단 stage=judgment 포함)만. action이 있는 요청은 한 번만 보낸다
 *     (백엔드가 clientId로 중복을 막는 곳이 기본 제출뿐이라서).
 *   - 제출마다 clientId 하나를 만들어 재시도에도 같은 값을 보낸다. 앞 요청이 사실 저장됐어도(오래 걸려 끊긴 경우)
 *     백엔드 v183이 10분 안 같은 clientId면 새 행 없이 success(duplicate:true)를 돌려준다. 옛 백엔드는 clientId를 무시한다.
 *   - 모두 실패하면 학생에게 보일 문구를 담은 Error를 던진다(호출하는 쪽의 catch가 그대로 보여 준다).
 * 학생 말투가 «~해요»인 앱은 아래 두 문구만 그 말투로 바꾼다.
 */
async function postWithRetry(url, payload) {
  const body = Object.assign({}, payload);
  const canRetry = !body.action;
  if (canRetry && !body.clientId) body.clientId = newClientId();
  let lastErr = null;
  for (let i = 0; i < (canRetry ? 3 : 1); i++) {
    if (i) await new Promise(r => setTimeout(r, 1000 + submitRand() * 2000));
    const ctl = typeof AbortController === "function" ? new AbortController() : null; // 30초 넘게 멈추면 끊고 다시
    const timer = ctl ? setTimeout(() => ctl.abort(), 30000) : null;
    try {
      const res = await fetch(url, { method: "POST", body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined });
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch (e) { /* 구글 오류 화면(HTML) */ }
      if (res.ok && json && typeof json === "object") return json;
      lastErr = new Error("서버가 붐벼 저장하지 못했어. 잠시 뒤 다시 눌러 줘.");
    } catch (e) {
      lastErr = new Error("인터넷 연결이 불안정해 저장하지 못했어. 잠시 뒤 다시 눌러 줘.");
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  throw lastErr;
}
/* 제출 하나를 알아보는 무작위 값(영숫자·하이픈 8~64자 — 백엔드 submitClientId_ 규칙). */
function newClientId() {
  try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) { /* 아래로 */ }
  let s = "c" + Date.now().toString(36);
  for (let i = 0; i < 3; i++) s += Math.floor(submitRand() * 4294967296).toString(36);
  return s;
}
/* 0 이상 1 미만 무작위. Math.random을 안 쓰는 까닭: 일부 앱(survive-eras)의 검사기가 app.js 안 Math.random을 막는다(게임 판정은 학번으로만). */
function submitRand() {
  try { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; } catch (e) { return (Date.now() % 1000) / 1000; }
}
