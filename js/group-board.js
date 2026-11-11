/* v152 — 확정 모둠 불러오기·그리기. groups.html과 picker.html이 같이 쓴다.
 * 교사 토큰 없이 mode=groupsPublic만 읽는다(반·모둠·번호뿐, 이름 없음). 쓰기 없음. 모양은 style.css의 .gp-*.
 * v158 — 같은 응답의 culture(3학년 문화사 발굴단: 반·팀·번호만)도 받아 teamBoard로 그린다. 옛 백엔드는 culture가 없어 {}로 본다. */
window.GroupBoard = (function(){
  const CULTURE_EMOJI = { '붓': '🖌️', '곡괭이': '⛏️', '돋보기': '🔍', '나침반': '🧭' }; // js/09-dash-culture.js CT_TEAMS와 같은 값
  const fetchOnce_ = async () => { const res = await fetch(window.PORTAL_CONFIG.WEBAPP_URL + '?mode=groupsPublic', { cache: 'no-store' }); return res.json(); };
  /* 일시 오류에 한 번 더 시도한다. 반환: { groups: {'2-1': [{no, nums}]}, culture: {'3-5': [{team, nums}]} } / 서버가 아직 준비 안 됐으면 null / 네트워크 실패는 throw */
  async function fetchAll(){
    let j;
    try { j = await fetchOnce_(); } catch(e){ await new Promise(r => setTimeout(r, 800)); j = await fetchOnce_(); }
    if(!(j.result === 'success' && j.groups && typeof j.groups === 'object')) return null;
    return { groups: j.groups, culture: j.culture && typeof j.culture === 'object' ? j.culture : {} };
  }
  function col_(cls, i, title, count, nums, me){
    const col = document.createElement('div'); col.className = cls; col.style.setProperty('--i', i);
    const head = document.createElement('div'); head.className = 'gp-head'; head.textContent = title + ' ';
    const small = document.createElement('small'); small.textContent = count + '명'; head.appendChild(small);
    const nos = document.createElement('div'); nos.className = 'gp-nos';
    nums.forEach(n => {
      const s = document.createElement('span'); s.textContent = n;
      if(me && Number(me) === n){ s.className = 'is-me'; s.title = '나'; col.classList.add('has-me'); }
      nos.appendChild(s);
    });
    col.appendChild(head); col.appendChild(nos);
    return col;
  }
  /* 모둠 칸들을 만들어 돌려준다. 값은 textContent로만 넣는다. me(번호)를 주면 그 번호를 강조한다(v158). */
  function board(list, me){
    const wrap = document.createElement('div'); wrap.className = 'gp-board';
    list.forEach((g, i) => { const col = col_('gp-col', i, g.no + '모둠', g.nums.length, g.nums, me); col.dataset.no = g.no; wrap.appendChild(col); });
    return wrap;
  }
  /* v158 — 문화사 발굴단 팀 칸. 발표자 뽑기의 모둠 표시(.gp-col 찾기)와 섞이지 않게 클래스를 따로 둔다. */
  function teamBoard(list, me){
    const wrap = document.createElement('div'); wrap.className = 'gp-board gp-teams';
    list.forEach((t, i) => { const col = col_('gp-tcol', i, (CULTURE_EMOJI[t.team] || '') + ' ' + t.team + ' 발굴단', t.nums.length, t.nums, me); col.dataset.team = t.team; wrap.appendChild(col); });
    return wrap;
  }
  return { fetchAll, board, teamBoard };
})();
