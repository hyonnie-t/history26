/* ── 발표자 뽑기 (v127, picker.html 전용) ──
 * 교사 토큰 없이 교실 PC에서 바로 여는 별도 페이지. 포털 js/01~07과 따로 돌고 config.js의 BAN_SIZE만 읽는다.
 * 이름은 다루지 않는다(번호만) — 이 레포는 public이고, 이름을 받으려면 교사 토큰이 필요하기 때문.
 * 반 번호에서 한 명을 뽑아 십의 자리·일의 자리 릴을 차례로 멈추는 연출로 보여 준다.
 * 공정성: ① 난수는 crypto.getRandomValues + 거절 샘플링(나머지 편향 없음).
 * ② «한 바퀴» 방식 — 이번 바퀴에 이미 뽑힌 번호는 후보에서 빠지고, 전원이 한 번씩 나오면 새 바퀴.
 *    새 바퀴 첫 번째는 직전 바퀴 마지막 학생을 빼고 뽑아 같은 학생이 연달아 나오지 않게 한다.
 * 기록은 이 기기 localStorage(h26_picker_v1)에만 — 반마다 교실 PC가 따로라 반 기록이 그 교실 PC에 쌓인다.
 * 결석 표시와 «오늘 발표» 목록은 날짜가 바뀌면 비워진다. 서버에 쓰지 않는다.
 * v130 — 후보는 «실제 학급 번호»다(전출로 빈 번호·인원수보다 큰 번호가 있어 1~BAN_SIZE로는 틀린다).
 *   우선순위: 이 기기에서 «번호 명단»으로 고친 값(h26_picker_v1.nums) > config.js BAN_NUMS > 1~BAN_SIZE. */
(function(){
  const CONFIG = window.PORTAL_CONFIG || {};
  const PK_KEY = 'h26_picker_v1';
  const $ = id => document.getElementById(id);
  let PK_CLASS = '';
  let PK_SPINNING = false;
  let PK_AUDIO = null;

  function today_(){ const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function loadAll_(){ try{ return JSON.parse(localStorage.getItem(PK_KEY)) || {}; }catch(e){ return {}; } }
  function saveAll_(all){
    try{ localStorage.setItem(PK_KEY, JSON.stringify(all)); }
    catch(e){ if(!saveAll_.warned){ saveAll_.warned = true; say_('이 브라우저는 기록 저장이 막혀 있어요(시크릿 창?). 새로고침하면 바퀴가 처음부터 다시 돌아요.'); } }
  }
  function state_(key){
    const all = loadAll_();
    const st = Object.assign({ picked: [], last: null, absent: [], day: '', todayNums: [] }, (all.classes || {})[key] || {});
    if(st.day !== today_()){ st.absent = []; st.todayNums = []; st.day = today_(); }
    return st;
  }
  function saveState_(key, st){
    const all = loadAll_(); all.classes = all.classes || {}; all.classes[key] = st; saveAll_(all);
  }
  function randInt_(n){ // 0..n-1 균등
    const c = window.crypto;
    if(!c || !c.getRandomValues) return Math.floor(Math.random() * n);
    const lim = Math.floor(0x100000000 / n) * n, a = new Uint32Array(1);
    do { c.getRandomValues(a); } while(a[0] >= lim);
    return a[0] % n;
  }
  function classes_(){
    const out = [];
    const sizes = CONFIG.BAN_SIZE || {};
    Object.keys(sizes).sort().forEach(g => {
      Object.keys(sizes[g]).map(Number).filter(b => sizes[g][b] > 0).sort((a, b) => a - b)
        .forEach(b => out.push({ key: g + '-' + b, label: g + '학년 ' + b + '반', size: sizes[g][b] }));
    });
    return out;
  }
  /* v130 — "1-12, 14, 16~28" 같은 글을 번호 배열로. 형식이 틀리면 null. */
  function parseNums_(text){
    const out = new Set();
    const parts = String(text || '').split(/[,\s]+/).filter(Boolean);
    for(const p of parts){
      const m = p.match(/^(\d{1,2})(?:[-~](\d{1,2}))?$/);
      if(!m) return null;
      const a = Number(m[1]), b = m[2] ? Number(m[2]) : a;
      if(a < 1 || b < a) return null;
      for(let i = a; i <= b; i++) out.add(i);
    }
    return Array.from(out).sort((x, y) => x - y);
  }
  function fmtNums_(nums){ // [1,2,3,5] → "1-3, 5"
    const out = [];
    for(let i = 0; i < nums.length; i++){
      let j = i;
      while(j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
      out.push(j > i + 1 ? nums[i] + '-' + nums[j] : j === i + 1 ? nums[i] + ', ' + nums[j] : String(nums[i]));
      i = j;
    }
    return out.join(', ');
  }
  /* v130 — 실제 학급 번호. src: 'local'(이 기기에서 고침) / 'config'(BAN_NUMS) / 'size'(1~인원수) */
  function rosterInfo_(key){
    const local = (loadAll_().nums || {})[key];
    if(Array.isArray(local) && local.length) return { nums: local.slice(), src: 'local' };
    const cfg = parseNums_((CONFIG.BAN_NUMS || {})[key]);
    if(cfg && cfg.length) return { nums: cfg, src: 'config' };
    const c = classes_().find(o => o.key === key);
    const nums = [];
    for(let i = 1; i <= (c ? c.size : 0); i++) nums.push(i);
    return { nums, src: 'size' };
  }
  function roster_(key){ return rosterInfo_(key).nums; }
  function pool_(roster, st){
    const present = roster.filter(n => st.absent.indexOf(n) < 0);
    return { present, left: present.filter(n => st.picked.indexOf(n) < 0) };
  }
  function say_(msg){
    const el = $('pkToast'); el.textContent = msg; el.classList.add('is-show');
    clearTimeout(say_.t); say_.t = setTimeout(() => el.classList.remove('is-show'), 2600);
  }

  function selectClass_(key){
    PK_CLASS = key; $('pkNumsBox').hidden = true;
    const all = loadAll_(); all.lastClass = key; saveAll_(all); // 교실 PC는 다음에 열 때 이 반으로 바로 시작
    render_();
  }
  function render_(){
    const grid = $('pkGrid');
    if(!PK_CLASS){ grid.innerHTML = ''; $('pkStatus').textContent = '담당 반 정보(config.js의 BAN_SIZE)가 없어요.'; return; }
    const roster = roster_(PK_CLASS), st = state_(PK_CLASS), pool = pool_(roster, st);
    $('pkStatus').textContent = `${roster.length}명(${fmtNums_(roster)}번) · 이번 바퀴: ${pool.present.length}명 중 ${pool.present.length - pool.left.length}명 발표 · 남은 후보 ${pool.left.length}명`
      + (st.absent.length ? ` · 결석 ${st.absent.length}명` : '');
    grid.innerHTML = roster.map(n => {
      const cls = st.absent.indexOf(n) >= 0 ? ' is-absent' : st.picked.indexOf(n) >= 0 ? ' is-picked' : '';
      const tip = cls === ' is-picked' ? '눌러서 다시 후보에 넣기' : '눌러서 결석 표시/해제';
      return `<button type="button" class="pk-chip${cls}" data-num="${n}" title="${tip}" aria-label="${n}번 ${tip}">${n}</button>`;
    }).join('');
    $('pkToday').textContent = st.todayNums.length ? st.todayNums.map(n => n + '번').join(', ') : '아직 없어요';
    $('pkCopy').hidden = !st.todayNums.length;
  }
  function toggleChip_(num){
    if(PK_SPINNING || !$('pkStage').hidden) return; // 결과 무대가 떠 있을 땐 뒤쪽 칩이 Tab·스페이스로 눌리지 않게
    const st = state_(PK_CLASS);
    const pi = st.picked.indexOf(num), ai = st.absent.indexOf(num);
    if(pi >= 0){
      if(!confirm(num + '번을 이번 바퀴 후보에 다시 넣을까요?')) return;
      st.picked.splice(pi, 1);
    } else if(ai >= 0) st.absent.splice(ai, 1);
    else st.absent.push(num);
    saveState_(PK_CLASS, st); render_();
  }
  function resetRound_(){
    if(PK_SPINNING || !PK_CLASS) return;
    if(!confirm('이번 바퀴 기록을 지우고 모두 다시 후보에 넣을까요?')) return;
    const st = state_(PK_CLASS); st.picked = []; saveState_(PK_CLASS, st); render_();
  }
  /* v130 — 번호 명단 고치기(이 기기 localStorage에만 저장). 명단에서 빠진 번호는 바퀴·결석 기록에서도 지운다. */
  function numsOpen_(){
    if(PK_SPINNING || !PK_CLASS) return;
    const info = rosterInfo_(PK_CLASS);
    $('pkNumsInput').value = fmtNums_(info.nums);
    $('pkNumsNote').textContent = info.src === 'local' ? '이 컴퓨터에서 고친 명단을 쓰고 있어요.'
      : info.src === 'config' ? '공통 명단(config.js)을 쓰고 있어요.' : '아직 명단이 없어 1번부터 인원수까지로 뽑고 있어요.';
    $('pkNumsBox').hidden = false; $('pkNumsInput').focus();
  }
  function numsClose_(){ $('pkNumsBox').hidden = true; $('pkNumsBtn').focus(); }
  function numsApply_(nums){
    const all = loadAll_(); all.nums = all.nums || {};
    if(nums) all.nums[PK_CLASS] = nums; else delete all.nums[PK_CLASS];
    saveAll_(all);
    const roster = roster_(PK_CLASS), st = state_(PK_CLASS), inR = n => roster.indexOf(n) >= 0;
    st.picked = st.picked.filter(inR); st.absent = st.absent.filter(inR);
    if(st.last != null && !inR(st.last)) st.last = null;
    saveState_(PK_CLASS, st);
    $('pkNumsBox').hidden = true; render_();
  }
  function numsSave_(){
    const nums = parseNums_($('pkNumsInput').value);
    if(!nums || !nums.length){ say_('번호를 "1-12, 14, 16-28"처럼 적어 주세요.'); $('pkNumsInput').focus(); return; }
    numsApply_(nums); say_(nums.length + '명으로 저장했어요.');
  }
  function numsReset_(){ numsApply_(null); say_('기본 명단으로 돌렸어요.'); }
  function beep_(freq, dur){
    if(!$('pkSound').checked) return;
    try{
      PK_AUDIO = PK_AUDIO || new (window.AudioContext || window.webkitAudioContext)();
      const o = PK_AUDIO.createOscillator(), g = PK_AUDIO.createGain(), t = PK_AUDIO.currentTime;
      o.type = 'triangle'; o.frequency.value = freq;
      g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
      o.connect(g); g.connect(PK_AUDIO.destination); o.start(t); o.stop(t + dur);
    }catch(e){}
  }
  /* 릴 하나를 duration(ms) 동안 돌리다가 target에서 멈춘다. 끝으로 갈수록 느려진다. */
  function spinReel_(el, target, duration){
    return new Promise(resolve => {
      const t0 = performance.now();
      let d = randInt_(10);
      el.classList.remove('is-stop'); el.classList.add('is-spin');
      (function step(){
        const left = duration - (performance.now() - t0);
        if(left <= 0){
          el.textContent = target; el.classList.remove('is-spin'); el.classList.add('is-stop');
          beep_(880, .18); resolve(); return;
        }
        d = (d + 1) % 10; el.textContent = d; beep_(320 + d * 25, .03);
        setTimeout(step, left > 1000 ? 55 : 55 + (1000 - left) * .28);
      })();
    });
  }
  /* v129 — 고양이 테마. 그림 세 장(up·down·cheer)을 갈아 끼우는 플립북: 뽑는 동안 앞발 번쩍↔쾅을 반복하고,
   * 마지막 자리가 멈추면 팻말 든 그림으로 바꾸고 팻말에 번호를 «샥» 띄운다. 결과(번호)는 연출 전에 이미 정해져 있다. */
  const CAT = { up: 'images/cat/cat-up.jpg', down: 'images/cat/cat-down.jpg', cheer: 'images/cat/cat-cheer.jpg' };
  let CAT_TIMER = null;
  function catOn_(){ return document.body.classList.contains('pk-theme-cat'); }
  function applyTheme_(cat){
    document.body.classList.toggle('pk-theme-cat', cat);
    $('pkCatTheme').checked = cat;
  }
  function setTheme_(cat){
    applyTheme_(cat);
    const all = loadAll_(); all.theme = cat ? 'cat' : ''; saveAll_(all);
  }
  function catFrame_(name){ $('pkCatImg').src = CAT[name]; $('pkCat').classList.toggle('is-slam', name === 'down'); }
  function catStart_(){
    if(!catOn_()) return;
    $('pkCat').classList.remove('is-done'); $('pkCatSign').textContent = '';
    catFrame_('up');
    if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let down = false;
    CAT_TIMER = setInterval(() => { down = !down; catFrame_(down ? 'down' : 'up'); if(down) beep_(140, .06); }, 170);
  }
  function catStop_(num){
    clearInterval(CAT_TIMER); CAT_TIMER = null;
    if(!catOn_()) return;
    catFrame_('cheer');
    $('pkCatSign').textContent = num;
    $('pkCat').classList.add('is-done'); // 팻말 번호·«샥!» 튀어나오기(CSS 애니메이션)
  }

  async function draw_(){
    if(PK_SPINNING || !PK_CLASS || !$('pkNumsBox').hidden) return;
    const roster = roster_(PK_CLASS), st = state_(PK_CLASS);
    let pool = pool_(roster, st);
    if(!pool.present.length){ say_('뽑을 학생이 없어요(전원 결석 표시).'); return; }
    if(!pool.left.length){ // 한 바퀴 끝 → 새 바퀴. 직전 학생은 첫 번째에서 뺀다.
      st.picked = []; pool = pool_(roster, st);
      say_('모두 한 번씩 나왔어요. 새 바퀴를 시작해요.');
    }
    let cand = pool.left;
    if(cand.length > 1 && st.last != null) cand = cand.filter(n => n !== st.last);
    const pick = cand[randInt_(cand.length)];
    // 번호를 먼저 확정·저장한 뒤 연출을 돌린다(연출은 결과에 영향 없음, 중간에 창을 닫아도 기록은 남는다).
    st.picked.push(pick); st.last = pick; st.todayNums.push(pick);
    saveState_(PK_CLASS, st);
    PK_SPINNING = true;
    $('pkDrawBtn').disabled = true; $('pkActions').hidden = true;
    const [grade, ban] = PK_CLASS.split('-');
    $('pkStageClass').textContent = `${grade}학년 ${ban}반 발표자는…`;
    $('pkHint').textContent = '';
    $('pkResult').classList.remove('is-show');
    $('pkStage').hidden = false;
    const fast = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const two = String(pick).padStart(2, '0');
    $('pkReel0').textContent = '?'; $('pkReel1').textContent = '?';
    $('pkReel0').classList.remove('is-stop'); $('pkReel1').classList.remove('is-stop');
    catStart_();
    try{
      await spinReel_($('pkReel0'), two[0], fast ? 400 : 1800);
      // 실제로 뽑힐 수 있었던 후보 중 같은 십의 자리 수
      const sameTens = cand.filter(n => String(n).padStart(2, '0')[0] === two[0]).length;
      $('pkHint').textContent = `${two[0] === '0' ? '한 자리' : two[0] + '0번대'} 번호 ${sameTens}명 중 한 명!`;
      await spinReel_($('pkReel1'), two[1], fast ? 500 : 2600);
      catStop_(pick);
      $('pkResult').textContent = pick + '번 발표!';
      $('pkResult').classList.add('is-show');
      beep_(660, .12); setTimeout(() => beep_(990, .3), 130);
      $('pkActions').hidden = false;
      $('pkAgainBtn').focus();
    }finally{
      if(CAT_TIMER){ clearInterval(CAT_TIMER); CAT_TIMER = null; }
      PK_SPINNING = false; $('pkDrawBtn').disabled = false;
      render_();
    }
  }
  function closeStage_(){ if(!PK_SPINNING){ $('pkStage').hidden = true; $('pkDrawBtn').focus(); } }
  function copyToday_(){
    const st = state_(PK_CLASS);
    const [grade, ban] = PK_CLASS.split('-');
    const text = `${grade}학년 ${ban}반 ${st.day} 발표: ` + st.todayNums.map(n => n + '번').join(', ');
    const done = () => say_('복사했어요. 대시보드 탐구포인트 탭에서 지급하세요.');
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => prompt('복사해서 쓰세요', text));
    else prompt('복사해서 쓰세요', text);
  }
  function toggleFullscreen_(){
    const d = document;
    if(d.fullscreenElement){ d.exitFullscreen && d.exitFullscreen(); return; }
    const el = d.documentElement;
    if(el.requestFullscreen) el.requestFullscreen().catch(() => say_('이 브라우저는 전체 화면을 막았어요. F11을 눌러 보세요.'));
  }

  function init_(){
    const opts = classes_();
    const q = new URLSearchParams(location.search).get('ban');
    const saved = loadAll_().lastClass;
    PK_CLASS = [q, saved, (opts[0] || {}).key].find(k => k && opts.some(o => o.key === k)) || '';
    $('pkClass').innerHTML = opts.map(o => `<option value="${o.key}"${o.key === PK_CLASS ? ' selected' : ''}>${o.label}</option>`).join('');
    $('pkClass').addEventListener('change', e => selectClass_(e.target.value));
    $('pkDrawBtn').addEventListener('click', draw_);
    $('pkAgainBtn').addEventListener('click', draw_);
    $('pkCloseBtn').addEventListener('click', closeStage_);
    $('pkResetBtn').addEventListener('click', resetRound_);
    $('pkCopy').addEventListener('click', copyToday_);
    $('pkFullBtn').addEventListener('click', toggleFullscreen_);
    $('pkNumsBtn').addEventListener('click', numsOpen_); // v130
    $('pkNumsSave').addEventListener('click', numsSave_);
    $('pkNumsReset').addEventListener('click', numsReset_);
    $('pkNumsCancel').addEventListener('click', numsClose_);
    $('pkNumsInput').addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); numsSave_(); } else if(e.key === 'Escape') numsClose_(); });
    applyTheme_(loadAll_().theme === 'cat' || new URLSearchParams(location.search).get('theme') === 'cat'); // v129
    $('pkCatTheme').addEventListener('change', e => setTheme_(e.target.checked));
    $('pkGrid').addEventListener('click', e => {
      const b = e.target.closest('.pk-chip'); if(b) toggleChip_(Number(b.dataset.num));
    });
    // 발표 리모컨(→·PageDown)·스페이스로도 뽑는다. 스페이스는 버튼·입력칸에 포커스가 있으면 그 요소의 기본 동작에 맡긴다.
    document.addEventListener('keydown', ev => {
      if(ev.key === 'Escape' && !$('pkStage').hidden){ closeStage_(); return; }
      if(ev.repeat || ev.altKey || ev.ctrlKey || ev.metaKey) return; // 꾹 누름·브라우저 단축키(Alt+→ 등)는 뽑기로 가로채지 않는다
      const tag = (ev.target && ev.target.tagName) || '';
      if((ev.key === 'PageDown' || ev.key === 'ArrowRight') && tag !== 'SELECT' && tag !== 'INPUT'){ ev.preventDefault(); draw_(); return; }
      if(ev.key === ' ' && !/^(BUTTON|SELECT|INPUT|TEXTAREA|LABEL)$/.test(tag)){ ev.preventDefault(); draw_(); }
    });
    render_();
  }
  init_();
})();
