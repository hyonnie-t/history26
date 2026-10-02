#!/usr/bin/env node
// vocab_check.mjs — 어려운 낱말에 풀이가 달려 있는지 검사한다 (history26 v70, webapp-builder ⑦ 어휘 점검의 기계 검사 부분)
//
// 사용: node vocab_check.mjs <앱 폴더> [--words=hard_words.json] [--exclude=낱말,낱말] [--warn]
//   hard_words.json 에 있는 낱말이 앱의 학생 화면 문장(data.js·app.js·logic.js·index.html, 주석 제외)에 나오는데
//   앱의 GLOSSARY 키에 없으면 누락으로 센다. 누락이 있으면 종료 코드 1 (--warn 이면 0).
// 한계: "어떤 낱말이 어렵냐"는 판단이라 목록(hard_words.json)이 아는 낱말만 잡는다. 새 앱을 만들 땐 스킬 ⑦의 사람 점검이 먼저고,
//   거기서 뽑은 낱말을 이 목록에 추가해 두면 다음 앱부터 자동으로 잡힌다. 버튼·제목 안의 낱말은 화면에서 밑줄이 안 그어지는데
//   이 검사는 그걸 구분하지 못한다(GLOSSARY에 있기만 하면 통과).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const dir = args.find(a => !a.startsWith('--'));
if (!dir) { console.error('사용: node vocab_check.mjs <앱 폴더> [--words=...] [--exclude=a,b] [--warn]'); process.exit(2); }
const opt = (n) => { const a = args.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : null; };
const here = path.dirname(fileURLToPath(import.meta.url));
const wordsPath = opt('words') || path.join(here, 'hard_words.json');
const exclude = new Set((opt('exclude') || '').split(',').map(s => s.trim()).filter(Boolean));
const warnOnly = args.includes('--warn');

const words = JSON.parse(fs.readFileSync(wordsPath, 'utf8'));
const files = ['data.js', 'app.js', 'logic.js', 'index.html'].map(f => path.join(dir, f)).filter(f => fs.existsSync(f));
if (!files.length) { console.error('앱 파일(data.js/app.js/index.html)을 못 찾음: ' + dir); process.exit(2); }

// GLOSSARY = { ... } 리터럴을 중괄호 짝으로 잘라 낸다(문자열 안의 중괄호는 무시).
function cutObject(src, start) {
  let depth = 0, q = null;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return [start, i + 1]; }
  }
  return null;
}

const glossary = new Set();
let text = '';
for (const f of files) {
  let src = fs.readFileSync(f, 'utf8');
  const m = /GLOSSARY\s*=\s*\{/.exec(src);
  if (m) {
    const start = src.indexOf('{', m.index);
    const cut = cutObject(src, start);
    if (cut) {
      try {
        const obj = vm.runInNewContext('(' + src.slice(cut[0], cut[1]) + ')');
        Object.keys(obj).forEach(k => glossary.add(k));
      } catch (e) { console.error('GLOSSARY 해석 실패(' + path.basename(f) + '): ' + e.message); process.exit(2); }
      src = src.slice(0, cut[0]) + src.slice(cut[1]);
    }
  }
  src = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/<!--[\s\S]*?-->/g, ' ').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');
  text += '\n' + src;
}

// 사전 키가 차지한 자리는 지운다 — 키가 더 긴 낱말의 일부일 때(독점권 ⊃ 독점) 이중으로 세지 않으려는 것.
let rest = text;
[...glossary].sort((a, b) => b.length - a.length).forEach(k => { rest = rest.split(k).join(' '.repeat(k.length)); });

const PARTICLE = /^(?:에|은|는|이|가|을|를|의|로|과|와|도)(?![가-힣])/;
function count(word) {
  let n = 0, i = -1;
  while ((i = rest.indexOf(word, i + 1)) !== -1) {
    if (word.length === 1) {
      if (i > 0 && /[가-힣]/.test(rest[i - 1])) continue;
      const after = rest.slice(i + 1);
      if (/^[가-힣]/.test(after) && !PARTICLE.test(after)) continue;
    }
    n++;
  }
  return n;
}

const missing = [];
for (const w of words) {
  if (exclude.has(w) || glossary.has(w)) continue;
  const n = count(w);
  if (n) missing.push([w, n]);
}
const unused = [...glossary].filter(k => !text.includes(k));

console.log(`[vocab_check] ${path.basename(path.resolve(dir))}: 사전 ${glossary.size}개 · 목록 ${words.length}개`);
if (unused.length) console.log(`  참고: 화면 문장에 안 나오는 사전 낱말 ${unused.length}개 — ${unused.join(', ')}`);
if (!missing.length) { console.log('  풀이 누락 0건 ✔'); process.exit(0); }
console.log(`  풀이 누락 ${missing.length}개:`);
missing.forEach(([w, n]) => console.log(`   - ${w} (${n}회)`));
process.exit(warnOnly ? 0 : 1);
