const KEY='life-dynasty-v3';const ranks=[['БРОДЯГА',0],['РАБОЧИЙ',25],['СПЕЦИАЛИСТ',100],['ИНВЕСТОР',400],['МИЛЛИОНЕР',1500],['ЛЕГЕНДА',5000]];const gear=['🔩','🧲','📟','📼','💾','🔮','💎','🧿'];const gearName=['Обломок','Магнит','Пейджер','Кассета','Модуль','Ядро','Кристалл','Реликвия'];let S=JSON.parse(localStorage.getItem(KEY)||'{"ldn":0,"silver":120,"energy":100,"items":[1,1,2],"income":0,"eventDone":false,"taps":0}');S.taps=S.taps||0;if(!localStorage.getItem('demo-silver-10000-v1')){S.silver=10000;localStorage.setItem('demo-silver-10000-v1','1');localStorage.setItem(KEY,JSON.stringify(S));}S.selected=null;S.sellMode=false;S.queue=S.queue||[];if(!Array.isArray(S.board)){S.board=[]}if(S.board.length!==30){let old=S.board.filter(Boolean);S.board=Array(30).fill(null);old.slice(0,30).forEach((v,i)=>S.board[i]=v);if(!old.length)(S.items||[1,1,2]).slice(0,30).forEach((v,i)=>S.board[i]=v);localStorage.setItem(KEY,JSON.stringify(S))}const one=q=>document.querySelector(q);const all=q=>Array.from(document.querySelectorAll(q));function tapCost(){return 0.1}function rank(){let r=0;ranks.forEach((x,i)=>{if(S.ldn>=x[1])r=i});return r}function save(){localStorage.setItem(KEY,JSON.stringify(S));render()}function toast(x){one('#toast').textContent=x;one('#toast').classList.add('show');setTimeout(()=>one('#toast').classList.remove('show'),800)}function render(){let r=rank();one('#ldn').textContent=S.ldn.toFixed(1);one('#silver').textContent=S.silver.toFixed(1);one('#income').textContent=S.income.toFixed(1);one('#rankTop').textContent=ranks[r][0];one('#heroTitle').textContent=ranks[r][0];one('#rankBadge').textContent='УРОВЕНЬ '+(r+1);one('#energyText').textContent='ЭНЕРГИЯ '+Math.floor(S.energy)+' / 100';one('#energyBar').style.width=S.energy+'%';one('#status').textContent=S.energy<20?'ВЫМОТАН':r?'ПОДНИМАЕТСЯ':'ВЫЖИВАЕТ';if(one('#depotSilver'))one('#depotSilver').textContent=Math.floor(S.silver);renderBoard();one('#upgrades').innerHTML=[['Подработка',50,.2],['Инструменты',150,.7],['Связи',500,2]].map((x,i)=>'<div class="upgrade"><b>'+x[0]+'</b><span>+'+x[2]+' LDN / мин</span><button data-up="'+i+'">'+x[1]+' ◉</button></div>').join('');all('[data-up]').forEach(b=>b.onclick=()=>upgrade(+b.dataset.up));one('#road').innerHTML=ranks.map((x,i)=>'<div class="'+(i<=r?'on':'')+'"><b>'+x[0]+'</b><span>'+(!i?'Начало истории':x[1]+' LDN')+'</span></div>').join('');}if(one('#tap'))one('#tap').onclick=()=>{if(S.energy<1)return toast('Нет сил — энергия восстановится');let cost=tapCost();if(S.silver<cost)return toast('Не хватает серебра · тап стоит '+cost+' ◉');S.silver-=cost;S.taps++;S.energy=Math.max(0,S.energy-1);S.ldn+=.1;dropArtifact();one('#person').classList.add('hit');setTimeout(()=>one('#person').classList.remove('hit'),170);save()};function dropArtifact(){let free=[];S.board.forEach((v,i)=>{if(v==null)free.push(i)});if(!free.length)return;let r=rank(),chance=.14+r*.025;if(Math.random()>chance)return;let roll=Math.random(),lv=1;if(r>=1&&roll<.22+r*.02)lv=2;if(r>=3&&roll<.07+r*.01)lv=3;if(r>=5&&roll<.02)lv=4;let cell=free[Math.floor(Math.random()*free.length)];S.board[cell]=lv;toast('Находка: '+gearName[lv-1]+' · LV '+lv)}let boardSig='';let depotDragReady=false;
function renderBoard(){
  let board=one('#mergeBoard');if(!board)return;
  let sig=S.board.map(v=>v||0).join(',');
  if(sig!==boardSig){
    boardSig=sig;
    board.innerHTML=S.board.map((lv,i)=>lv?'<button class="artifactCell" data-cell="'+i+'"><span>'+gear[Math.min(lv-1,7)]+'</span><b>LV '+lv+'</b></button>':'<button class="artifactCell empty" data-cell="'+i+'"></button>').join('');
  }
  let max=Math.max(1,...S.board.filter(Boolean));
  if(one('#maxArtifact'))one('#maxArtifact').textContent='LV '+max;
  if(one('#depotSilver'))one('#depotSilver').textContent=Math.floor(S.silver);
  setupDepotDrag();
}
function setupDepotDrag(){
  if(depotDragReady||typeof interact!=='function')return;
  depotDragReady=true;
  let dragFrom=null,hoverTarget=null;
  const clearTarget=()=>{all('.artifactCell').forEach(c=>c.classList.remove('mergeTarget','dropTarget'));hoverTarget=null};
  const chooseTarget=(x,y,from)=>{
    let av=S.board[from],same=[],empty=[];
    all('.artifactCell[data-cell]').forEach(c=>{
      let i=+c.dataset.cell;if(i===from)return;
      let r=c.getBoundingClientRect(),d=Math.hypot(x-(r.left+r.width/2),y-(r.top+r.height/2));
      if(S.board[i]===av)same.push([d,c]);
      else if(S.board[i]==null)empty.push([d,c]);
    });
    same.sort((a,b)=>a[0]-b[0]);empty.sort((a,b)=>a[0]-b[0]);
    if(same[0]&&same[0][0]<125)return same[0][1];
    if(empty[0]&&empty[0][0]<85)return empty[0][1];
    return null;
  };
  interact('.artifactCell:not(.empty)').draggable({
    inertia:false,
    listeners:{
      start(e){
        dragFrom=+e.target.dataset.cell;
        e.target.dataset.x='0';e.target.dataset.y='0';
        e.target.classList.add('draggingLive');
      },
      move(e){
        let t=e.target,x=(parseFloat(t.dataset.x)||0)+e.dx,y=(parseFloat(t.dataset.y)||0)+e.dy;
        t.style.transform='translate3d('+x+'px,'+y+'px,0) scale(1.12)';
        t.style.zIndex='9999';t.dataset.x=x;t.dataset.y=y;
        clearTarget();
        let r=t.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
        hoverTarget=chooseTarget(cx,cy,dragFrom);
        if(hoverTarget)hoverTarget.classList.add(S.board[+hoverTarget.dataset.cell]===S.board[dragFrom]?'mergeTarget':'dropTarget');
      },
      end(e){
        let t=e.target,r=t.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
        let target=chooseTarget(cx,cy,dragFrom),to=target?+target.dataset.cell:null;
        t.style.transform='';t.style.zIndex='';t.classList.remove('draggingLive');clearTarget();
        let from=dragFrom;dragFrom=null;
        if(to==null||from==null){renderBoard();return}
        let av=S.board[from],bv=S.board[to];
        if(av&&bv===av&&av<8){
          S.board[to]=av+1;S.board[from]=null;S.silver+=Math.pow(2,av-1);
          boardSig='';toast('СИНТЕЗ! '+gearName[av]+' · LV '+(av+1));save();return
        }
        if(av&&bv==null){S.board[to]=av;S.board[from]=null;boardSig='';save();return}
        renderBoard();
      }
    }
  });
}
function mergeTap(i){let l=S.items[i];if(S.sellMode){let v=Math.pow(3,l-1)*8;S.items.splice(i,1);S.silver+=v;S.sellMode=false;S.selected=null;toast('Продано: +'+v+' серебра');return save()}if(S.selected===null){S.selected=i;return render()}if(S.selected===i){S.selected=null;return render()}let a=S.selected;if(S.items[a]===l&&l<5){let hi=Math.max(a,i),lo=Math.min(a,i);S.items.splice(hi,1);S.items.splice(lo,1);S.items.push(l+1);S.selected=null;toast('MERGE! Получен LV '+(l+1));return save()}S.selected=i;render()}if(one('#sellMode'))if(one('#sellMode'))one('#sellMode').onclick=()=>{S.sellMode=!S.sellMode;S.selected=null;one('#sellMode').classList.toggle('active',S.sellMode);toast(S.sellMode?'Выбери предмет для продажи':'Продажа отменена')};function upgrade(i){let x=[[50,.2],[150,.7],[500,2]][i];if(S.silver<x[0])return toast('Не хватает серебра');S.silver-=x[0];S.income+=x[1];save();toast('Доход вырос')}function switchPage(id,btn){all('.page').forEach(p=>p.classList.remove('active'));let page=one('#'+id);if(page)page.classList.add('active');all('nav button').forEach(x=>x.classList.remove('on'));if(btn)btn.classList.add('on')}all('nav button[data-page]').forEach(b=>{b.onclick=function(e){e.preventDefault();switchPage(this.dataset.page,this)}});if(one('#wallet'))one('#wallet').onclick=()=>toast('Кошелёк — следующий этап');setInterval(()=>{S.energy=Math.min(100,S.energy+.5);S.ldn+=S.income/60;save()},1000);if(window.Telegram?.WebApp){Telegram.WebApp.ready();Telegram.WebApp.expand()}render();