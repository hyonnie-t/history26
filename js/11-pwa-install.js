/* v157 — «홈 화면에 추가» 버튼. 안드로이드/크롬은 설치 창(beforeinstallprompt), iOS·그 밖엔 방법 안내 창.
   이미 홈 화면에서 연 상태(standalone)면 버튼을 숨긴다. 서버·학생 기록과 무관(쓰기 없음). */
(function(){
  let deferred = null;
  const standalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const ua = navigator.userAgent || '';
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  const isMobile = isIOS || isAndroid;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; refresh(); });
  window.addEventListener('appinstalled', () => { deferred = null; try{ localStorage.setItem('h26_pwa_installed','1'); }catch(e){} refresh(); });
  if('serviceWorker' in navigator){ window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {})); }

  function refresh(){
    const b = document.getElementById('btnAddHome');
    if(!b) return;
    let done = false; try{ done = localStorage.getItem('h26_pwa_installed') === '1'; }catch(e){}
    b.style.display = (!standalone() && !done && (deferred || isMobile)) ? '' : 'none';
  }
  function steps(){
    if(isIOS) return ['아이폰·아이패드는 <b>사파리</b>로 열어야 해요.', '화면 아래(또는 위)의 <b>공유 버튼 ⬆️</b>을 눌러요.', '목록에서 <b>「홈 화면에 추가」</b>를 눌러요.', '오른쪽 위 <b>추가</b>를 누르면 끝!'];
    return ['오른쪽 위 <b>⋮ 메뉴</b>를 눌러요.', '<b>「홈 화면에 추가」</b>(또는 「앱 설치」)를 눌러요.', '<b>추가</b>를 누르면 끝!'];
  }
  function openGuide(){
    const d = document.getElementById('addHomeDialog');
    document.getElementById('addHomeSteps').innerHTML = steps().map(s => '<li>' + s + '</li>').join('');
    d.style.display = 'flex';
  }
  async function onClick(){
    if(deferred){
      const p = deferred; deferred = null;
      p.prompt();
      try{ await p.userChoice; }catch(e){}
      refresh();
      return;
    }
    openGuide();
  }
  function init(){
    const b = document.getElementById('btnAddHome');
    if(!b) return;
    b.addEventListener('click', onClick);
    document.getElementById('addHomeClose').addEventListener('click', () => { document.getElementById('addHomeDialog').style.display = 'none'; });
    refresh();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
