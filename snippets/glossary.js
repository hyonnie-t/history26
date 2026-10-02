/* glossary.js — 수업 웹앱 공용: 본문의 어려운 낱말에 밑줄을 긋고 눌러서 뜻을 보게 한다 (history26 v70)
 *
 * 쓰는 법 (앱의 data.js에 GLOSSARY 객체가 있다고 하고):
 *   Glossary.start({ terms: GLOSSARY });                         // 풀이 UI가 없는 앱 — 하단 시트까지 이 파일이 만든다
 *   Glossary.start({ terms: GLOSSARY, tag: 'span', sheet: false, style: false, skip: ['#termTip'] });
 *                                                                // 이미 풀이 UI·.term 스타일이 있는 앱 — 밑줄만 입힌다
 *
 * 설계 메모
 * - 앱의 렌더링 코드를 안 고친다. 화면에 그려진 글자(DOM 텍스트 노드)에서 사전의 키를 찾아 .term 으로 감싸고,
 *   MutationObserver로 화면이 다시 그려질 때마다 다시 입힌다. 그래서 앱마다 렌더링 방식이 달라도 똑같이 동작한다.
 * - 건드리지 않는 곳: textarea·input·button·a·label·summary(눌러야 하는 것 안에 또 누르는 것을 넣지 않는다), 제목(h1~h6),
 *   onclick 속성·tab 역할·nav 안, 이미 .term 인 곳, 풀이 시트, 이탈 경고 배너, skip 옵션으로 넘긴 선택자, data-no-gloss 속성이 붙은 곳.
 * - addEventListener로 눌리는 span/div(예: 진행 단계 칩)는 속성으로 알아볼 수 없다. 그런 곳은 start의 skip 옵션으로 선택자를 넘긴다.
 * - 같은 낱말은 한 문단(블록)에서 첫 번째만 밑줄을 긋는다. 앱이 직접 입힌 .term(예: {용어})도 센다.
 * - 한 글자 키(예: 율)는 글자 앞뒤가 한글이면(효율·비율) 건너뛴다. 뒤에 조사(에·은·는·이·가·을·를·의·로·과·와·도)만 붙는 경우는 허용한다.
 * - 사료 원문·번역은 바꾸지 않는다(글자는 그대로, 감싸기만 한다). textContent는 달라지지 않는다.
 * - 빌드 없는 plain JS, 정규식 lookbehind를 쓰지 않는다(구형 태블릿 Safari 대비).
 */
(function () {
  var terms = {};
  var re = null;
  var cfg = { root: null, tag: 'button', sheet: true, style: true, skip: [] };
  var skipSel = '';
  var observer = null;
  var scheduled = false;
  var started = false;

  var BASE_SKIP = 'textarea,input,select,option,script,style,button,a,summary,label,h1,h2,h3,h4,h5,h6,' +
    '.term,[data-no-gloss],[contenteditable="true"],[onclick],[role="tab"],[role="tablist"],nav,#glSheet,#focusGuardBanner';
  var BLOCK = 'p,li,dd,dt,td,th,blockquote,figcaption,div';
  var PARTICLE = /^(?:에|은|는|이|가|을|를|의|로|과|와|도)(?![가-힣])/;

  function escapeReg(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function buildRegex() {
    var keys = Object.keys(terms).filter(function (k) { return k; });
    keys.sort(function (a, b) { return b.length - a.length; });
    re = keys.length ? new RegExp(keys.map(escapeReg).join('|'), 'g') : null;
  }

  function singleCharOk(text, i) {
    if (i > 0 && /[가-힣]/.test(text.charAt(i - 1))) return false;
    var rest = text.slice(i + 1);
    return !/^[가-힣]/.test(rest) || PARTICLE.test(rest);
  }

  function makeTerm(key) {
    var el = document.createElement(cfg.tag);
    if (cfg.tag === 'button') el.type = 'button';
    else { el.setAttribute('role', 'button'); el.tabIndex = 0; }
    el.className = 'term';
    el.setAttribute('data-term', key);
    el.textContent = key;
    return el;
  }

  function wrapNode(node, seen) {
    var text = node.nodeValue;
    var parent = node.parentElement;
    var block = parent.closest(BLOCK) || document.body;
    var used = seen.get(block);
    if (!used) {
      used = {};
      var made = block.querySelectorAll('.term[data-term]');
      for (var j = 0; j < made.length; j++) used[made[j].getAttribute('data-term')] = true;
      seen.set(block, used);
    }
    var frag = null, last = 0, m;
    re.lastIndex = 0;
    while ((m = re.exec(text))) {
      var key = m[0], i = m.index;
      if (key.length === 1 && !singleCharOk(text, i)) continue;
      if (used[key]) continue;
      used[key] = true;
      if (!frag) frag = document.createDocumentFragment();
      if (i > last) frag.appendChild(document.createTextNode(text.slice(last, i)));
      frag.appendChild(makeTerm(key));
      last = i + key.length;
    }
    if (!frag) return;
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    node.parentNode.replaceChild(frag, node);
  }

  function annotate() {
    if (!re || !cfg.root) return;
    var walker = document.createTreeWalker(cfg.root, NodeFilter.SHOW_TEXT, null, false);
    var nodes = [], n;
    while ((n = walker.nextNode())) {
      if (!n.nodeValue || !/[가-힣]/.test(n.nodeValue)) continue;
      var p = n.parentElement;
      if (!p || p.closest(skipSel)) continue;
      nodes.push(n);
    }
    var seen = new WeakMap();
    for (var i = 0; i < nodes.length; i++) wrapNode(nodes[i], seen);
  }

  function run() {
    scheduled = false;
    if (observer) observer.disconnect();
    try { annotate(); } catch (e) { /* 풀이 실패가 앱을 막으면 안 된다 */ }
    if (observer) observer.observe(cfg.root, { childList: true, subtree: true, characterData: true });
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    (window.requestAnimationFrame || window.setTimeout)(run, 16);
  }

  /* ── 하단 시트 (풀이 UI가 없는 앱용) ── */
  function injectStyle() {
    if (document.getElementById('glStyle')) return;
    var accent = 'var(--seal, var(--coral, #B03A2E))';
    var st = document.createElement('style');
    st.id = 'glStyle';
    var css = '';
    if (cfg.style) {
      css += '.term{font:inherit;font-weight:700;color:' + accent + ';background:none;border:0;' +
        'text-decoration:underline dashed;text-decoration-thickness:2px;text-underline-offset:4px;' +
        'padding:9px 2px;margin:-9px 0;cursor:pointer;}';
    }
    if (cfg.sheet) {
      css += '#glSheet{position:fixed;left:0;right:0;bottom:0;z-index:99000;box-sizing:border-box;' +
        'transform:translateY(105%);transition:transform .2s ease;background:var(--card,#fff);' +
        'color:var(--ink,#23262C);border-top:3px solid ' + accent + ';box-shadow:0 -6px 18px rgba(0,0,0,.18);' +
        'padding:14px 18px 22px;max-height:50vh;overflow:auto;font-size:1rem;line-height:1.6;}' +
        '#glSheet.open{transform:translateY(0);}' +
        '#glSheet .gl-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:6px;}' +
        '#glSheet .gl-title{font-weight:700;font-size:1.1rem;color:' + accent + ';}' +
        '#glSheet .gl-close{min-height:44px;min-width:64px;padding:0 14px;border:1.5px solid ' + accent + ';' +
        'border-radius:6px;background:#fff;color:' + accent + ';font:inherit;font-weight:700;cursor:pointer;}' +
        '@media (prefers-reduced-motion:reduce){#glSheet{transition:none;}}';
    }
    st.textContent = css;
    document.head.appendChild(st);
  }

  function ensureSheet() {
    var el = document.getElementById('glSheet');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'glSheet';
    el.setAttribute('data-no-gloss', '');
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = '<div class="gl-head"><span class="gl-title" id="glTitle"></span>' +
      '<button type="button" class="gl-close" id="glClose">닫기</button></div><div id="glBody"></div>';
    document.body.appendChild(el);
    document.getElementById('glClose').addEventListener('click', closeSheet);
    return el;
  }
  function openSheet(key) {
    var def = terms[key];
    if (!def) return;
    var el = ensureSheet();
    document.getElementById('glTitle').textContent = key;
    document.getElementById('glBody').textContent = def;
    el.classList.add('open');
  }
  function closeSheet() {
    var el = document.getElementById('glSheet');
    if (el) el.classList.remove('open');
  }
  function onDocClick(e) {
    var t = e.target.closest && e.target.closest('.term[data-term]');
    if (t) { openSheet(t.getAttribute('data-term')); return; }
    if (!(e.target.closest && e.target.closest('#glSheet'))) closeSheet();
  }

  function start(opts) {
    if (started) return;
    started = true;
    opts = opts || {};
    terms = opts.terms || {};
    if (opts.tag) cfg.tag = opts.tag;
    if (opts.sheet === false) cfg.sheet = false;
    if (opts.style === false) cfg.style = false;
    cfg.skip = opts.skip || [];
    cfg.root = opts.root || document.body;
    skipSel = BASE_SKIP + (cfg.skip.length ? ',' + cfg.skip.join(',') : '');
    buildRegex();
    injectStyle();
    if (cfg.sheet) {
      ensureSheet();
      document.addEventListener('click', onDocClick);
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });
    }
    if (window.MutationObserver) observer = new MutationObserver(schedule);
    run();
  }

  window.Glossary = { start: start, refresh: schedule, has: function (k) { return !!terms[k]; } };
})();
