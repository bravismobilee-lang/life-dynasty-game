(()=>{
const cfg=window.LIFE_DYNASTY_SUPABASE;
if(!cfg)return;
const GROUP='https://t.me/+ZI8mrpzNTOswMzFi';
const SITE='https://bravismobilee-lang.github.io/life-dynasty-game/';
function playerId(){
  const id=window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
  if(id)return Number(id);
  let fallback=localStorage.getItem('life-dynasty-player-id');
  if(!fallback){fallback=String(Date.now()*1000+Math.floor(Math.random()*999));localStorage.setItem('life-dynasty-player-id',fallback)}
  return Number(fallback);
}
async function rpc(name,args){
  const res=await fetch(cfg.url+'/rest/v1/rpc/'+name,{method:'POST',headers:{'Content-Type':'application/json','apikey':cfg.publishableKey,'Authorization':'Bearer '+cfg.publishableKey},body:JSON.stringify(args)});
  const data=await res.json().catch(()=>null);
  if(!res.ok)throw new Error(data?.message||data?.error||'Ошибка сервера');
  return data;
}
function setStatus(text){const el=document.querySelector('#breedStatus');if(el)el.textContent=text}
function active(){
  try{return {card:cardState(),meta:heroCards[heroIndex],index:heroIndex}}catch(_){return null}
}
async function createOffer(){
  const x=active();if(!x||x.card.level<2)return;
  const input=document.querySelector('#breedLink');
  const accept=document.querySelector('#acceptBreed');
  if(accept)accept.hidden=true;
  setStatus('Создаём уникальную ссылку…');
  try{
    const token=await rpc('create_breed_offer',{p_owner_id:playerId(),p_card_index:x.index,p_card_level:x.card.level,p_rarity:x.meta.rarity});
    x.card.breedToken=token;x.card.breedStatus='OPEN';x.card.breedingUntil=null;
    localStorage.setItem(KEY,JSON.stringify(S));
    const link=SITE+'?breed='+encodeURIComponent(token);
    if(input)input.value=link;
    setStatus('Ссылка готова. Скопируй её и отправь в группу.');
  }catch(e){setStatus('Не удалось создать ссылку: '+e.message)}
}
async function acceptOffer(){
  const token=new URLSearchParams(location.search).get('breed'),x=active();
  if(!token||!x)return;
  setStatus('Проверяем карточки и создаём пару…');
  try{
    const rows=await rpc('accept_breed_offer',{p_token:token,p_player_id:playerId(),p_card_index:x.index,p_card_level:x.card.level,p_rarity:x.meta.rarity});
    const row=Array.isArray(rows)?rows[0]:rows;
    x.card.breedToken=token;x.card.breedStatus='BREEDING';x.card.breedingUntil=row.completes_at;
    localStorage.setItem(KEY,JSON.stringify(S));render();
    setStatus('Скрещивание началось. Карточка заблокирована на 24 часа.');
    const btn=document.querySelector('#acceptBreed');if(btn)btn.hidden=true;
  }catch(e){setStatus('Пара не создана: '+e.message)}
}
async function syncCard(card){
  if(!card.breedToken)return;
  try{
    const rows=await rpc('get_breed_status',{p_token:card.breedToken,p_player_id:playerId()});
    const row=Array.isArray(rows)?rows[0]:rows;if(!row)return;
    card.breedStatus=row.offer_status;card.breedingUntil=row.completes_at;
    if(row.offer_status==='BREEDING'&&row.completes_at&&Date.parse(row.completes_at)<=Date.now()){
      const rewards=await rpc('claim_breeding_reward_by_token',{p_token:card.breedToken,p_player_id:playerId()});
      const reward=Array.isArray(rewards)?rewards[0]:rewards;
      if(reward){
        S.kittens=S.kittens||[];
        if(!S.kittens.some(k=>k.token===card.breedToken))S.kittens.push({token:card.breedToken,template:reward.kitten_no,rarity:reward.rarity,bornAt:new Date().toISOString()});
        toast('Родился котёнок '+reward.rarity+'!');
      }
      card.breedStatus='DONE';card.breedToken=null;card.breedingUntil=null;
    }
  }catch(_){}
}
async function syncAll(){if(!Array.isArray(S.cards))return;for(const card of S.cards)await syncCard(card);localStorage.setItem(KEY,JSON.stringify(S));render()}
function init(){
  const open=document.querySelector('#openBreedGroup');if(open)open.onclick=()=>window.open(GROUP,'_blank');
  const accept=document.querySelector('#acceptBreed');
  const token=new URLSearchParams(location.search).get('breed');
  if(token){
    const modal=document.querySelector('#cardModal');if(modal)modal.classList.add('open');
    const input=document.querySelector('#breedLink');if(input)input.value=location.href;
    if(accept){accept.hidden=false;accept.onclick=acceptOffer}
    setStatus('Выбери подходящего кота того же уровня и редкости, затем подтверди пару.');
  }
  syncAll();setInterval(syncAll,30000);
}
window.Breeding={createOffer,acceptOffer,syncAll};
init();
})();