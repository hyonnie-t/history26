/* ══════════════ 탐구 나무 일러스트 (v64) ══════════════
 * treeSvg(stage, leaves, totalLessons) → SVG 문자열. index.html의 renderPortal()이 #treeBox에 넣는다.
 *   stage        칭호 단계 0~7 (RANKS 인덱스와 1:1 — 0=새싹 … 7=큰 나무)
 *   leaves       완료한 차시 수, totalLessons 전체 차시 수 → 진행률만큼 "새잎"(밝은 잎)이 돋는다
 * 예전(v32) 원 몇 개를 겹친 도형에서 바꿈: 줄기·가지·뿌리, 겹겹이 쌓은 잎 덩어리(어두운 층 → 중간 → 밝은 층 → 하이라이트),
 * 잎사귀 질감, 그림자, 풀. 무작위 배치는 시드 고정(mulberry32)이라 같은 단계는 항상 같은 모양이다.
 *
 * 계절: 10월(Date.getMonth()===9)에만 단풍 팔레트 + 낙엽. 확인용으로 ?season=autumn / ?season=default 로 강제 가능.
 * 그 밖의 달은 초록 잎 + (3·4단계) 연분홍 꽃 + (5단계~) 열매.
 * 빌드 단계 없이 <script src="tree.js">로 직접 불러온다. */

function treeSeason_(){
  try{
    const q = new URLSearchParams(location.search).get('season');
    if(q === 'autumn' || q === 'default') return q;
  }catch(e){}
  return new Date().getMonth() === 9 ? 'autumn' : 'default';
}

function treeRand_(seed){
  let a = seed >>> 0;
  return function(){
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function treeMix_(c1, c2, t){
  const h = c => [1, 3, 5].map(i => parseInt(c.substr(i, 2), 16));
  const a = h(c1), b = h(c2);
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

/* 잎 덩어리 색: [위쪽 색, 아래쪽 색] — 위는 햇빛 받아 밝고 아래는 그늘져 어둡다 */
const TREE_PALETTE = {
  default: {
    dark:  ['#2F7048', '#1F4D35'], mid:   ['#48915F', '#2F6E48'],
    light: ['#78BD79', '#4E9A63'], hi:    ['#B3DE8F', '#86C77B'],
    leaf:  ['#9BD283', '#5FAE6A', '#7CC27A'], fresh: '#C7EB7E',
    bloom: '#F8D3DD', fruit: '#D9553F', fruitHi: '#F2A08F', calyx: '#4B8A4B'
  },
  autumn: {
    dark:  ['#C25A1F', '#8C2A19'], mid:   ['#E48A2A', '#B93F27'],
    light: ['#F3B33B', '#DC6A2E'], hi:    ['#FBD86A', '#F09A3E'],
    leaf:  ['#F0A432', '#D8562B', '#F7CB55', '#B8321F'], fresh: '#FFE07A',
    bloom: '#F8D3DD', fruit: '#F08A24', fruitHi: '#FFC46B', calyx: '#5C8A3C'
  }
};

/* 단계별 모양: tw=줄기 굵기, cx/cy=잎 덩어리 중심, rx/ry=반지름, n=잎 덩어리 수, r=덩어리 크기 */
const TREE_STAGES = [
  null, null,
  { tw: 5,  cy: 124, rx: 22, ry: 16, n: 7,  r: 13, branches: 0 },
  { tw: 7,  cy: 112, rx: 36, ry: 26, n: 11, r: 16, branches: 2 },
  { tw: 9,  cy: 104, rx: 46, ry: 32, n: 15, r: 18, branches: 2 },
  { tw: 11, cy: 98,  rx: 56, ry: 38, n: 19, r: 20, branches: 3 },
  { tw: 13, cy: 92,  rx: 64, ry: 44, n: 24, r: 21, branches: 3 },
  { tw: 15, cy: 88,  rx: 72, ry: 50, n: 30, r: 22, branches: 4 }
];

function treeLeafPath_(x, y, angle, scale, fill, opacity){
  return `<path transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle.toFixed(0)}) scale(${scale.toFixed(2)})" `
    + `d="M0 0 C3 -4.5 10 -4.5 14 0 C10 4.5 3 4.5 0 0Z" fill="${fill}" opacity="${opacity == null ? 1 : opacity}"/>`;
}

/* 단계별로 위쪽 빈 하늘을 잘라 낸 viewBox — 새싹이 카드 한가운데 뜬 채 위가 텅 비어 보이던 것을 막는다.
 * 폭(200)은 항상 같아서 확대 비율이 같고, 나무가 자랄수록 그림 영역이 위로 넓어진다(=자라는 게 눈에 보임). */
const TREE_TOP = [116, 100, 86, 60, 44, 30, 16, 6];
function treeViewBox_(stage){ return `0 ${TREE_TOP[stage]} 200 ${176 - TREE_TOP[stage]}`; }

function treeSvg(stage, leaves, totalLessons){
  stage = Math.max(0, Math.min(7, stage || 0));
  leaves = leaves || 0;
  totalLessons = totalLessons || 0;
  const season = treeSeason_();
  const C = TREE_PALETTE[season];
  const autumn = season === 'autumn';
  const rnd = treeRand_(stage * 97 + 13);
  const BX = 100, GY = 164; // 줄기 밑동 x, 땅 y
  const ratio = totalLessons > 0 ? Math.min(leaves / totalLessons, 1) : 0;

  /* 공통: 그림자·땅·풀 */
  const defs = `
    <defs>
      <radialGradient id="tGround" cx="50%" cy="50%" r="50%">
        <stop offset="0" stop-color="#CFC7AA"/><stop offset="1" stop-color="#E9E4D2" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="tBark" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stop-color="#94643A"/><stop offset=".45" stop-color="#6E4728"/><stop offset="1" stop-color="#4A2F1A"/>
      </linearGradient>
    </defs>`;
  const ground = `<ellipse cx="${BX}" cy="${GY + 3}" rx="${56 + stage * 3}" ry="9" fill="url(#tGround)"/>`;
  const tufts = [[-34, 1], [-20, -1], [22, 1], [36, 0], [-46, 2], [48, 2]].map(([dx, dy], i) => {
    const x = BX + dx, y = GY + dy;
    const col = i % 2 ? '#5E9A5E' : '#79B06B';
    return `<path d="M${x} ${y} q-2 -7 -5 -9 M${x} ${y} q0 -8 1 -11 M${x} ${y} q2 -6 5 -8" stroke="${col}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
  }).join('');

  /* 낙엽(10월) — 땅 위와 나무 옆 공중 */
  let fallen = '';
  if(autumn && stage >= 1){
    const fr = treeRand_(4242);
    const n = 4 + stage * 2;
    for(let i = 0; i < n; i++){
      const onGround = i % 3 !== 0;
      const x = BX + (fr() - 0.5) * (onGround ? 120 : 150);
      const y = onGround ? GY + 2 + fr() * 6 : 96 + fr() * 60;
      fallen += treeLeafPath_(x, y, fr() * 360, 0.5 + fr() * 0.45, C.leaf[Math.floor(fr() * C.leaf.length)], onGround ? 0.9 : 0.85);
    }
  }

  /* 0단계 새싹, 1단계 어린 묘목은 잎 덩어리 없이 잎 몇 장으로 */
  if(stage <= 1){
    const soil = `<ellipse cx="${BX}" cy="${GY}" rx="20" ry="5" fill="#8B6B48"/><ellipse cx="${BX}" cy="${GY - 1.5}" rx="15" ry="3.4" fill="#A98561"/>`;
    const g1 = autumn ? '#7FB65E' : '#5FAE6A', g2 = autumn ? '#5E9A4A' : '#3F8A5C';
    let sprout;
    if(stage === 0){
      sprout = `
        <path d="M${BX} ${GY - 2} C${BX} ${GY - 14} ${BX + 1} ${GY - 24} ${BX + 1} ${GY - 32}" stroke="${g2}" stroke-width="3" fill="none" stroke-linecap="round"/>
        ${treeLeafPath_(BX + 1, GY - 32, -150, 1.5, g1)}
        ${treeLeafPath_(BX + 1, GY - 32, -28, 1.6, g2)}`;
    } else {
      const spots = [[-1, 14, -160, 1.5], [1, 22, -20, 1.5], [-1, 31, -155, 1.5], [1, 39, -25, 1.45], [0, 48, -100, 1.3]];
      const stem = `<path d="M${BX} ${GY - 2} C${BX - 2} ${GY - 22} ${BX + 2} ${GY - 36} ${BX} ${GY - 50}" stroke="#7A5230" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;
      sprout = stem + spots.map(([dx, h, ang, sc], i) =>
        treeLeafPath_(BX + dx, GY - h, ang, sc, autumn ? C.leaf[i % C.leaf.length] : (i % 2 ? g1 : g2))).join('');
    }
    return `<svg viewBox="${treeViewBox_(stage)}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${defs}${ground}${soil}${sprout}${tufts}${fallen}</svg>`;
  }

  /* 2단계 이상: 줄기 + 가지 + 잎 덩어리 */
  const P = TREE_STAGES[stage];
  const trunkTop = P.cy + P.ry * 0.3;
  const w = P.tw;
  const trunk = `<path d="M${BX - w * 1.0} ${GY} C${BX - w * 0.55} ${GY - 5} ${BX - w * 0.5} ${GY - (GY - trunkTop) * 0.5} ${BX - w * 0.32} ${trunkTop} `
    + `L${BX + w * 0.32} ${trunkTop} C${BX + w * 0.5} ${GY - (GY - trunkTop) * 0.5} ${BX + w * 0.55} ${GY - 5} ${BX + w * 1.0} ${GY} Z" fill="url(#tBark)"/>`;
  const bark = [0.2, 0.42, 0.66].map((f, i) => {
    const y = GY - (GY - trunkTop) * f;
    const dx = (i % 2 ? 1 : -1) * w * 0.12;
    return `<path d="M${BX + dx} ${y} q${w * 0.1} -5 ${-dx * 0.5} -9" stroke="#3E2714" stroke-width="1" fill="none" opacity=".4" stroke-linecap="round"/>`;
  }).join('');
  let branches = '';
  const bdir = [-1, 1, -1, 1];
  for(let i = 0; i < P.branches; i++){
    const d = bdir[i];
    const y0 = trunkTop + (GY - trunkTop) * (0.05 + i * 0.05);
    const x1 = BX + d * P.rx * (0.42 + 0.1 * (i % 2));
    const y1 = P.cy - P.ry * (0.05 + 0.18 * (i % 2)) + i * 3;
    branches += `<path d="M${BX} ${y0} Q${BX + d * P.rx * 0.12} ${(y0 + y1) / 2} ${x1} ${y1}" stroke="#66421F" stroke-width="${Math.max(2.4, w * 0.36)}" fill="none" stroke-linecap="round"/>`;
  }

  /* 잎 덩어리: 황금각 나선으로 타원 안을 채우고 살짝 흔든다. t = 0(위) … 1(아래) */
  const blobs = [];
  for(let i = 0; i < P.n; i++){
    const ang = i * 2.39996 + rnd() * 0.5;
    const rad = Math.sqrt((i + 0.6) / P.n);
    const x = BX + Math.cos(ang) * rad * P.rx * (0.86 + rnd() * 0.2);
    const y = P.cy + Math.sin(ang) * rad * P.ry * (0.86 + rnd() * 0.2);
    const r = P.r * (0.78 + rnd() * 0.45);
    blobs.push({ x, y, r, t: Math.max(0, Math.min(1, (y - (P.cy - P.ry)) / (2 * P.ry))) });
  }
  blobs.sort((a, b) => b.y - a.y); // 아래쪽부터 그려 위쪽이 앞에 오게

  const shade = (pair, t, jitter) => treeMix_(pair[0], pair[1], Math.max(0, Math.min(1, t + jitter)));
  let canopy = '';
  blobs.forEach(b => { canopy += `<circle cx="${b.x.toFixed(1)}" cy="${b.y.toFixed(1)}" r="${(b.r * 1.08).toFixed(1)}" fill="${shade(C.dark, b.t, (rnd() - 0.5) * 0.25)}"/>`; });
  blobs.forEach(b => { canopy += `<circle cx="${(b.x - b.r * 0.1).toFixed(1)}" cy="${(b.y - b.r * 0.14).toFixed(1)}" r="${(b.r * 0.86).toFixed(1)}" fill="${shade(C.mid, b.t, (rnd() - 0.5) * 0.3)}"/>`; });
  blobs.forEach(b => { canopy += `<circle cx="${(b.x - b.r * 0.22).toFixed(1)}" cy="${(b.y - b.r * 0.3).toFixed(1)}" r="${(b.r * 0.55).toFixed(1)}" fill="${shade(C.light, b.t, (rnd() - 0.5) * 0.3)}"/>`; });
  blobs.forEach(b => { canopy += `<circle cx="${(b.x - b.r * 0.32).toFixed(1)}" cy="${(b.y - b.r * 0.42).toFixed(1)}" r="${(b.r * 0.24).toFixed(1)}" fill="${shade(C.hi, b.t, (rnd() - 0.5) * 0.3)}" opacity=".85"/>`; });

  /* 잎사귀 질감: 덩어리 가장자리에 작은 잎 */
  let texture = '';
  const texN = P.n * 2;
  for(let i = 0; i < texN; i++){
    const b = blobs[Math.floor(rnd() * blobs.length)];
    const a = rnd() * Math.PI * 2;
    const x = b.x + Math.cos(a) * b.r * 0.9, y = b.y + Math.sin(a) * b.r * 0.9;
    texture += treeLeafPath_(x, y, (a * 180 / Math.PI) + (rnd() - 0.5) * 50, 0.42 + rnd() * 0.3,
      C.leaf[Math.floor(rnd() * C.leaf.length)], 0.9);
  }

  /* 진행률 새잎 — 예전 규칙(단계별 상한 × 진행률)을 유지: 완료한 차시 비율만큼 밝은 새잎이 돋는다 */
  const leafCap = [0, 0, 4, 5, 6, 7, 9, 10][stage];
  const flowerCap = autumn ? 0 : [0, 0, 0, 3, 4, 0, 0, 0][stage];   // 3·4단계에서만 개화(단풍철엔 안 핌)
  const fruitCap = [0, 0, 0, 0, 0, 3, 4, 6][stage];                    // 5단계부터 결실
  const spotsN = 10;
  const shown = Math.round(ratio * spotsN);
  const spots = [];
  const sr = treeRand_(stage * 31 + 5);
  for(let i = 0; i < spotsN; i++){
    const a = i * 2.39996 * 1.3 + sr() * 0.4;
    const rad = 0.35 + 0.6 * sr();
    spots.push({ x: BX + Math.cos(a) * rad * P.rx * 0.95, y: P.cy + Math.sin(a) * rad * P.ry * 0.9 });
  }
  const fresh = spots.slice(0, Math.min(shown, leafCap)).map((p, i) =>
    treeLeafPath_(p.x, p.y, -60 + i * 37, 0.85, C.fresh, 0.95)).join('');
  const flowers = spots.slice(0, Math.min(shown, flowerCap)).map(p =>
    `<circle cx="${(p.x + 3).toFixed(1)}" cy="${(p.y + 4).toFixed(1)}" r="3.2" fill="${C.bloom}"/><circle cx="${(p.x + 3).toFixed(1)}" cy="${(p.y + 4).toFixed(1)}" r="1.1" fill="#F0C56B"/>`).join('');
  const fruits = spots.slice(0, Math.min(shown, fruitCap)).map(p => {
    const fx = p.x + 3, fy = p.y + 7;
    return `<line x1="${fx.toFixed(1)}" y1="${(fy - 3.5).toFixed(1)}" x2="${fx.toFixed(1)}" y2="${(fy - 7).toFixed(1)}" stroke="#5A3A1E" stroke-width="1"/>`
      + `<circle cx="${fx.toFixed(1)}" cy="${fy.toFixed(1)}" r="4" fill="${C.fruit}"/>`
      + `<circle cx="${(fx - 1.3).toFixed(1)}" cy="${(fy - 1.4).toFixed(1)}" r="1.3" fill="${C.fruitHi}" opacity=".9"/>`
      + (autumn ? `<path d="M${(fx - 2.4).toFixed(1)} ${(fy - 3.4).toFixed(1)} q2.4 -2 4.8 0 q-2.4 1.4 -4.8 0Z" fill="${C.calyx}"/>` : '');
  }).join('');

  return `<svg viewBox="${treeViewBox_(stage)}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    ${defs}${ground}${trunk}${bark}${branches}${canopy}${texture}${fresh}${flowers}${fruits}${tufts}${fallen}
  </svg>`;
}

/* ══════════════ v94 — 그림 나무 장면(힉스필드 일러스트) + 3학년 시험기간 연출 ══════════════
 * treeScene(stage, leaves, totalLessons, grade) → HTML 문자열. renderPortal()이 #treeBox에 넣는다.
 *   - 단풍철(10월, ?season=autumn)엔 images/tree/tree_0~7.webp(귀여운 얼굴 나무 8단계) 위에 새잎·열매 그림을 얹는다.
 *     진행률 규칙은 treeSvg와 같다(완료 차시 비율 × 단계별 상한). 나무가 바람에 살짝 흔들리고 낙엽이 천천히 떨어진다.
 *   - 그 밖의 달은 예전 SVG 나무(treeSvg)를 그대로 쓴다.
 *   - 시험기간(CONFIG.EXAM_PERIOD, 학년별)엔 저녁 하늘·반딧불·스탠드 소품을 더한다. 문구는 treeExamCheer_().
 * 위치는 모두 장면 상자(480x520) 대비 %라서 카드 크기가 바뀌어도 어긋나지 않는다. */

/* 단계별 잎 덩어리 타원(장면 대비 비율): 새잎·열매가 놓일 자리 */
const TREE_CANOPY = [
  null, null,
  { cx: .495, cy: .563, rx: .146, ry: .124 },
  { cx: .504, cy: .532, rx: .188, ry: .134 },
  { cx: .505, cy: .469, rx: .221, ry: .152 },
  { cx: .505, cy: .458, rx: .233, ry: .155 },
  { cx: .498, cy: .425, rx: .235, ry: .165 },
  { cx: .502, cy: .382, rx: .266, ry: .178 }
];

function treeExamActive_(grade){
  try{
    const q = new URLSearchParams(location.search).get('exam');
    if(q === '1') return true;
    if(q === '0') return false;
  }catch(e){}
  const cfg = window.PORTAL_CONFIG && window.PORTAL_CONFIG.EXAM_PERIOD && window.PORTAL_CONFIG.EXAM_PERIOD[grade];
  if(!cfg) return false;
  const d = new Date();
  const today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  return today >= cfg.from && today <= cfg.to;
}

const TREE_CHEERS = [
  '기말고사 기간이에요. 한 문제씩, 차분하게!',
  '오늘 공부한 건 자기 전에 한 번만 더 떠올려 봐요.',
  '나무도 쑥쑥, 여러분 실력도 쑥쑥 자라고 있어요.',
  '잠은 꼭 자요. 푹 쉬어야 기억이 정리돼요.',
  '헷갈리는 건 표시해 두면 시험 때 더 잘 보여요.'
];
function treeExamCheer_(){
  const d = new Date();
  const day = Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 86400000);
  return TREE_CHEERS[day % TREE_CHEERS.length];
}

function treeScene(stage, leaves, totalLessons, grade){
  stage = Math.max(0, Math.min(7, stage || 0));
  const exam = treeExamActive_(grade);
  const autumn = treeSeason_() === 'autumn';
  const ratio = totalLessons > 0 ? Math.min((leaves || 0) / totalLessons, 1) : 0;
  const IMG = 'images/tree/';
  const pct = v => (v * 100).toFixed(1) + '%';

  let body;
  if(autumn){
    /* 새잎·열매: 시드 고정이라 같은 단계는 항상 같은 자리 */
    let fx = '';
    const C = TREE_CANOPY[stage];
    if(C){
      const leafCap = [0, 0, 4, 5, 6, 7, 9, 10][stage];
      const acornCap = [0, 0, 0, 2, 3, 0, 0, 0][stage];
      const fruitCap = [0, 0, 0, 0, 0, 3, 4, 6][stage];
      const spotsN = 10, shown = Math.round(ratio * spotsN);
      const sr = treeRand_(stage * 31 + 5);
      const spots = [];
      for(let i = 0; i < spotsN; i++){
        const a = i * 2.39996 * 1.3 + sr() * 0.4, rad = 0.35 + 0.6 * sr();
        spots.push({ x: C.cx + Math.cos(a) * rad * C.rx, y: C.cy + Math.sin(a) * rad * C.ry, r: sr() });
      }
      const put = (p, cls, file, w, rot) =>
        `<img class="tree-fx ${cls}" src="${IMG}${file}" alt="" style="left:${pct(p.x)};top:${pct(p.y)};width:${w}%;--rot:${rot}deg;--i:${(p.r * 3).toFixed(2)}s" draggable="false">`;
      spots.slice(0, Math.min(shown, leafCap)).forEach((p, i) => { fx += put(p, 'tree-fx-leaf', 'leaf.webp', 7.5, -50 + i * 33); });
      spots.slice(0, Math.min(shown, acornCap)).forEach(p => { fx += put({ x: p.x + 0.02, y: p.y + 0.04, r: p.r }, 'tree-fx-fruit', 'acorn.webp', 7, 0); });
      spots.slice(0, Math.min(shown, fruitCap)).forEach(p => { fx += put({ x: p.x + 0.02, y: p.y + 0.05, r: p.r }, 'tree-fx-fruit', 'persimmon.webp', 8.5, 0); });
    }
    /* 낙엽: 초록 잎 그림을 주황빛으로 물들여 재활용(CSS filter). 2단계부터 */
    let fall = '';
    if(stage >= 2){
      const fr = treeRand_(777);
      const n = Math.min(6, 2 + Math.floor(stage / 2));
      for(let i = 0; i < n; i++){
        fall += `<img class="tree-fall" src="${IMG}leaf.webp" alt="" draggable="false" style="--x:${(18 + fr() * 64).toFixed(0)}%;--s:${(3.2 + fr() * 1.6).toFixed(1)}%;--t:${(7 + fr() * 5).toFixed(1)}s;--d:${(-fr() * 10).toFixed(1)}s">`;
      }
    }
    body = `<div class="tree-sway"><img class="tree-img" src="${IMG}tree_${stage}.webp" alt="" width="480" height="520" decoding="async" draggable="false">${fx}</div>${fall}`;
  } else {
    body = treeSvg(stage, leaves, totalLessons);
  }

  let extra = '';
  if(exam){
    const sr = treeRand_(2026);
    let sparks = '';
    for(let i = 0; i < 9; i++){
      sparks += `<span class="tree-spark" style="left:${(6 + sr() * 88).toFixed(0)}%;top:${(4 + sr() * 62).toFixed(0)}%;--d:${(sr() * 4).toFixed(1)}s;--z:${(3 + sr() * 3).toFixed(1)}px"></span>`;
    }
    extra = `<span class="tree-glow"></span>${sparks}<img class="tree-prop" src="${IMG}study_prop.webp" alt="" width="300" height="270" draggable="false">`;
  }
  return `<div class="tree-scene${exam ? ' is-exam' : ''}">${body}${extra}</div>`;
}
