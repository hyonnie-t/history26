#!/usr/bin/env node
// 수업 웹앱 기계 점검: 정해진 규칙(docs/webapp-rules.md, webapp-builder 섹션 1)을
// 코드만 읽어서 판정한다. 사람·AI 판단이 필요한 항목(학생 말, 정답 힌트, 직접 풀어 보기)은 여기서 보지 않는다.
//
// 쓰는 곳 두 군데
//   1) 바이브 테스트(docs/vibe-test.md): AI가 만든 앱마다 돌려 «조용한 실패» 개수를 센다.
//   2) 배포 직전 점검(webapp-builder 섹션 6 A-1): grep을 손으로 치는 대신 한 번에.
//
// 사용: node tests/vibe/check.mjs <앱 폴더> [--json]
//   여러 개: node tests/vibe/check.mjs out/A1 out/A2 out/B1 --json > result.json
// 종료 코드: «바닥» 실패가 하나라도 있으면 1.
//
// 등급은 webapp-builder 섹션 6의 «바닥·버릇·마감»을 따르되 세 군데가 다르다:
//   - preview(미리보기 모드)는 스킬 섹션 2 «모든 앱» 기본 요소라 바닥으로 센다.
//   - keep-all·reduced-motion·태블릿 폭은 섹션 2 기본 요소라 버릇으로 센다.
//   - 줄 간격은 제목·한 줄 칸까지 잡혀 오탐이 많아 마감으로 낮췄다(여러 줄 글이면 화면에서 본다).
// 한계: 문자열이 있는지만 본다. 동작(제출 전 버튼이 정말 숨는지 등)은 화면에서 확인한다.

import fs from 'node:fs';
import path from 'node:path';

const BACKEND_URL =
  'https://script.google.com/macros/s/AKfycbyXSjCfWY_HiZFqW_OBR-FQDoIfF1z_STqyKWUI31MacHeY3u7hbirFSFDvW-5yuUHaJQ/exec';
const PORTAL_AUTH = 'https://hyonnie-t.github.io/history26/snippets/portal_auth.js';
// 학생 화면에 나오면 안 되는 검증 라벨(webapp-builder 섹션 1의 6번과 같은 기준)
const LABELS = [/검수/, /원문 대조/, /대조 전/, /미확인/, /\[2차\]/, /\(2차\)/, /확인 전/];

function read(dir, name) {
  const p = path.join(dir, name);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

// 주석을 대충 걷어 낸다(문자열 안의 // 은 남을 수 있지만 판정에는 충분).
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1');
}

function checkApp(dir) {
  const html = read(dir, 'index.html');
  const css = fs.readdirSync(dir).filter((f) => f.endsWith('.css')).map((f) => read(dir, f)).join('\n');
  const jsFiles = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.js') && !/^(focus_guard|draft_guard|glossary)\.js$/.test(f));
  const jsAll = jsFiles.map((f) => read(dir, f)).join('\n');
  const app = read(dir, 'app.js') || jsAll; // app.js가 없으면(단일 index.html 앱) 전부를 본다
  const inlineJs = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
  const code = stripComments(app + '\n' + inlineJs);
  const screenText = html + '\n' + read(dir, 'data.js') + '\n' + code; // 학생 화면에 나갈 수 있는 글

  const hasWriting = /<textarea/i.test(html) || /createElement\(\s*['"]textarea/.test(code) || /<textarea/.test(code);
  const hasCopy = /copyBtn/.test(html + code);
  const r = [];
  // 제출하지 않는 앱(final-practice·final-test 같은 연습·자기채점 앱)은 이 기준으로 채점하지 않는다.
  if (!/SHEET_WEBAPP_URL|gameName\s*:/.test(code)) {
    r.push({ id: 'not-submit-app', grade: '마감', ok: null, note: '포털에 제출하는 앱이 아니라 판정 생략' });
    return { app: path.basename(path.resolve(dir)), results: r };
  }
  const add = (id, grade, ok, note, applies = true) => r.push({ id, grade, ok: applies ? ok : null, note: applies ? note : '해당 없음' });

  // ── 바닥(배포 금지) ──
  add('files', '바닥', !!html && !!(app || inlineJs), 'index.html과 앱 스크립트가 있다');

  const pkg = read(dir, 'package.json');
  const usesBuild =
    /from\s+['"]react['"]|require\(['"]react['"]\)|\bReactDOM\b|vite|webpack/.test(code + pkg) ||
    /"build"\s*:/.test(pkg) ||
    fs.readdirSync(dir).some((f) => /\.(tsx?|jsx|vue|svelte)$/.test(f));
  add('no-build', '바닥', !usesBuild, '빌드 도구·프레임워크 없이 plain HTML/CSS/JS');

  const head = (html.match(/<head[\s\S]*?<\/head>/i) || [''])[0];
  const authIdx = head.indexOf(PORTAL_AUTH);
  const firstOtherScript = head.search(/<script[^>]*\bsrc=(?![^>]*portal_auth)/); // 외부 파일을 부르는 첫 스크립트
  add(
    'portal-auth',
    '바닥',
    authIdx >= 0 && (firstOtherScript < 0 || authIdx < firstOtherScript),
    '<head>에서 portal_auth.js를 다른 스크립트보다 먼저 부른다'
  );

  const urls = [...code.matchAll(/https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec/g)].map((m) => m[0]);
  add('backend-url', '바닥', urls.length > 0 && urls.every((u) => u === BACKEND_URL), `백엔드 URL이 원본과 한 글자도 안 다르다 (찾은 것 ${urls.length}개)`);

  // 제출 body의 gameName이 비어 있지 않은 이름을 가리키는지. CONFIG.GAME_NAME 하나인 앱이 기본이고,
  // 활동마다 이름이 다른 앱(culture-dig의 GAME_QUIZ·GAME_DIG, nation-building의 GAME_NAMES)도 있다.
  const refs = [...code.matchAll(/gameName\s*:\s*(CONFIG\.(\w+)|['"`]([^'"`]+)['"`])/g)];
  const named = refs.map((m) => {
    if (m[3]) return m[3];
    const def = code.match(new RegExp(m[2] + '\\s*:\\s*[\'"`]([^\'"`]+)[\'"`]'));
    if (def) return def[1];
    // 빈 값으로 두고 실행 중에 채우는 앱(suneung-dungeon: CONFIG.GAME_NAME = CONFIG.GAME_PREFIX + ...)
    if (new RegExp('CONFIG\\.' + m[2] + '\\s*=[^=]').test(code)) return `${m[2]}(실행 중에 채움)`;
    return /GAME_NAMES\s*:\s*\{/.test(code) ? `${m[2]}(GAME_NAMES에서 채움)` : null;
  });
  add(
    'game-name',
    '바닥',
    refs.length > 0 && named.every(Boolean),
    refs.length
      ? `제출 이름: ${named.map((n) => n || '(빈 값)').join(', ')} (커리큘럼 id와 같은지는 사람이 확인)`
      : '제출 body에 gameName이 없다'
  );

  add('reflection', '바닥', /\breflection\s*:/.test(code), '제출 body 최상위에 reflection 키', hasWriting);

  // TDZ: 마지막 실행문이 init() 호출이어야 한다(webapp-builder 섹션 1의 4번)
  const lines = stripComments(app).split('\n').map((l) => l.trim()).filter(Boolean);
  const last = lines[lines.length - 1] || '';
  const topCalls = lines.filter((l) => /^(init|main|start)\(\s*\)\s*;?$/.test(l)).length; // 맨 끝 말고 중간에도 부르면 TDZ
  add(
    'init-last',
    '바닥',
    (/^(init|main|start)\(\s*\)\s*;?$/.test(last) && topCalls === 1) || /DOMContentLoaded/.test(last),
    `파일 맨 끝에서 init()을 한 번만 부른다 (마지막 줄: ${last.slice(0, 40)}, 맨 바깥 호출 ${topCalls}번)`,
    !!read(dir, 'app.js')
  );

  add('focus-guard', '바닥', /FocusGuard\.start\(/.test(code) && /FocusGuard\.payload\(\)/.test(code), 'FocusGuard.start와 제출 body의 FocusGuard.payload()');

  add('draft-guard', '바닥', /DraftGuard\.start\(/.test(code) && /DraftGuard\.clear\(\)/.test(code), 'DraftGuard.start와 제출 성공 뒤 DraftGuard.clear()', hasWriting);

  // 코드에서 부르기만 하고 화면에 요소가 없으면 안 되므로, html의 id나 코드에서 만드는 id를 본다.
  const padletEl = /id\s*=\s*["']padletBtn["']/.test(html) || /id\s*[:=]\s*["']padletBtn["']/.test(code);
  add('padlet-btn', '바닥', padletEl, 'copyBtn이 있으면 화면에 padletBtn 요소도 있다', hasCopy);
  add('hidden-rule', '바닥', /\[hidden\]\s*\{[^}]*display\s*:\s*none/.test(css), 'CSS에 [hidden]{display:none} 규칙', hasCopy);
  add('submit-copy-one', '바닥', /제출하고 복사하기/.test(html + code), '«제출하고 복사하기» 한 버튼', hasCopy);

  const labelHits = LABELS.filter((re) => re.test(screenText)).map(String);
  add('no-verify-labels', '바닥', labelHits.length === 0, labelHits.length ? `검증 라벨 발견: ${labelHits.join(' ')}` : '검증 라벨 0건');

  const vh = css.match(/(^|[^-])height\s*:\s*100vh/g);
  add('no-100vh', '바닥', !vh, '화면을 height:100vh로 고정하지 않는다(100dvh)');

  add('preview', '바닥', /preview/.test(code), '?preview=1 미리보기 모드');

  // ── 버릇(AI가 자주 빠지는 기본값, 주석 «면제:»가 있으면 통과) ──
  const exempt = (key) => new RegExp('면제:[^*\\n]*' + key).test(css);
  const grad = /linear-gradient\([^)]*(#(7c3aed|8b5cf6|a855f7|6366f1)|purple|violet)/i.test(css);
  add('no-purple-gradient', '버릇', !grad || exempt('그라데이션'), '보라 계열 그라데이션 없음');
  const lh = [...css.matchAll(/line-height\s*:\s*(1(?:\.[01]\d*)?|0?\.\d+)\s*[;}]/g)].length;
  add('line-height', '마감', lh === 0, `줄 간격 1.2 미만 ${lh}곳 (제목·한 줄 칸이면 괜찮음, 여러 줄 글이면 1.3 이상으로)`);
  add('keep-all', '버릇', /word-break\s*:\s*keep-all/.test(css), '한국어 칩·버튼 word-break:keep-all');
  const moves = /@keyframes|transition\s*:/.test(css);
  add('reduced-motion', '버릇', /prefers-reduced-motion/.test(css), '움직임이 있으면 prefers-reduced-motion으로 끈다', moves);
  add('tablet-widths', '버릇', /@media[^{]*min-width\s*:\s*(7[0-9]{2}|8[0-9]{2}|9[0-9]{2})px/.test(css), '태블릿 폭(768~999px) 미디어 쿼리');

  // ── 마감(보고만) ──
  const logs = (code.match(/console\.log\(/g) || []).length;
  add('no-console-log', '마감', logs === 0, `남은 console.log ${logs}개`);
  const small = [...css.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/g)].map((m) => +m[1]).filter((n) => n < 14);
  add('small-font', '마감', small.length === 0, `14px 미만 글자 ${small.length}곳 (본문 16px 이상인지는 화면으로 확인)`);

  return { app: path.basename(path.resolve(dir)), results: r };
}

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const dirs = args.filter((a) => a !== '--json');
if (!dirs.length) {
  console.error('사용: node tests/vibe/check.mjs <앱 폴더> [...] [--json]');
  process.exit(2);
}
const all = dirs.map(checkApp);
let floorFail = false;
for (const a of all) {
  a.summary = { 바닥: 0, 버릇: 0, 마감: 0 };
  for (const x of a.results) if (x.ok === false) a.summary[x.grade]++;
  if (a.summary.바닥) floorFail = true;
}
if (asJson) {
  process.stdout.write(JSON.stringify(all, null, 2) + '\n');
} else {
  for (const a of all) {
    console.log(`\n■ ${a.app}  — 바닥 ${a.summary.바닥} · 버릇 ${a.summary.버릇} · 마감 ${a.summary.마감}`);
    for (const x of a.results) {
      const mark = x.ok === null ? '·' : x.ok ? '○' : '✕';
      console.log(`  ${mark} [${x.grade}] ${x.id}: ${x.note}`);
    }
  }
}
process.exit(floorFail ? 1 : 0);
