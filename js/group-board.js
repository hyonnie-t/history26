/* v152 — 확정 모둠 불러오기·그리기. groups.html과 picker.html이 같이 쓴다.
 * 교사 토큰 없이 mode=groupsPublic만 읽는다(반·모둠·번호뿐, 이름 없음). 쓰기 없음. 모양은 style.css의 .gp-*. */
window.GroupBoard = (function(){
  const fetchOnce_ = async () => { const res = await fetch(window.PORTAL_CONFIG.WEBAPP_URL + '?mode=groupsPublic'); return res.json(); };
  /* 일시 오류에 한 번 더 시도한다. 반환: { '2-1': [{no, nums}] } / 서버가 아직 준비 안 됐으면 null / 네트워크 실패는 throw */
  async function fetchGroups(){
    let j;
    try { j = await fetchOnce_(); } catch(e){ await new Promise(r => setTimeout(r, 800)); j = await fetchOnce_(); }
    return j.result === 'success' && j.groups && typeof j.groups === 'object' ? j.groups : null;
  }
  /* 모둠 칸들을 만들어 돌려준다. 값은 textContent로만 넣는다. */
  function board(list){
    const wrap = document.createElement('div'); wrap.className = 'gp-board';
    list.forEach((g, i) => {
      const col = document.createElement('div'); col.className = 'gp-col'; col.dataset.no = g.no; col.style.setProperty('--i', i);
      const head = document.createElement('div'); head.className = 'gp-head'; head.textContent = g.no + '모둠 ';
      const small = document.createElement('small'); small.textContent = g.nums.length + '명'; head.appendChild(small);
      const nos = document.createElement('div'); nos.className = 'gp-nos';
      g.nums.forEach(n => { const s = document.createElement('span'); s.textContent = n; nos.appendChild(s); });
      col.appendChild(head); col.appendChild(nos); wrap.appendChild(col);
    });
    return wrap;
  }
  return { fetchGroups, board };
})();
