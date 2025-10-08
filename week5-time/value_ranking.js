// Value Ranking App (clean implementation)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-analytics.js";
import { getDatabase, ref, push, set } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";

// Updated Firebase project (added databaseURL inferred for Realtime DB usage)
const firebaseConfig = {
  apiKey: "AIzaSyCTMrFlfV4rXm3zcvbmC8etwT8lqVKF4dY",
  authDomain: "sharedminds-c3e82.firebaseapp.com",
  projectId: "sharedminds-c3e82",
  storageBucket: "sharedminds-c3e82.firebasestorage.app",
  messagingSenderId: "349004784117",
  appId: "1:349004784117:web:e4bdaa9070ae812eda80bc",
  measurementId: "G-96S61SSPNV",
  databaseURL: "https://sharedminds-c3e82-default-rtdb.firebaseio.com"
};
const app = initializeApp(firebaseConfig);
let analytics = null;
try { analytics = getAnalytics(app); } catch(e) { /* analytics may fail on some environments (e.g. http) */ }
const db = getDatabase(app);

const VALUES = ["Money","Career","Health","Relationship","Freedom","Social Life","Spiritual / Inner World","Environment"];
function shuffle(a){return a.map(v=>({v,r:Math.random()})).sort((x,y)=>x.r-y.r).map(o=>o.v);} 
const state={pool:shuffle(VALUES),slots:Array(8).fill(null),dragging:null,floatingEl:null,submitted:false,pendingPrompt:false,promptTimer:null};
const root=document.getElementById('app');

build();

function build(){
  if(!root) return;
  root.innerHTML='';
  const wrap=div('wrap');
  const pool=div('pool'); pool.appendChild(h2('Available Values'));
  const poolGrid=div('items'); state.pool.forEach(v=>poolGrid.appendChild(chip(v,startDragFromPool))); pool.appendChild(poolGrid);
  const ranks=div('ranks'); ranks.appendChild(h2('Slots (1 Highest)'));
  const slotsWrap=div('slotsWrap'); state.slots.forEach((val,i)=>slotsWrap.appendChild(slot(i,val))); ranks.appendChild(slotsWrap);
  const actions=div('actions'); const rBtn=document.createElement('button'); rBtn.textContent='Reset'; rBtn.onclick=()=>reset(); actions.appendChild(rBtn);
  wrap.appendChild(pool); wrap.appendChild(ranks);
  root.appendChild(wrap); root.appendChild(actions);
}

// helpers
function div(c){const d=document.createElement('div'); if(c)d.className=c; return d;}
function h2(t){const h=document.createElement('h2'); h.textContent=t; return h;}
function chip(text,handler){const c=document.createElement('div'); c.className='chip'; c.textContent=text; c.dataset.value=text; c.onmousedown=handler; return c;}
function slot(i,val){const s=div('slot'+(val?'':' empty')); s.setAttribute('data-index',i); const idx=document.createElement('span'); idx.className='slotIdx'; idx.textContent=(i+1); s.appendChild(idx); if(val){const c=chip(val,(e)=>startDragFromSlot(e,i)); c.classList.add('placed'); s.appendChild(c);} return s;}

// drag
let moveL=null; let upL=null;
function startDragFromPool(e){ startDrag(e,e.currentTarget.dataset.value,'pool'); }
function startDragFromSlot(e,i){ startDrag(e,state.slots[i],'slot',i); }
function startDrag(e,value,origin,slotIndex){ if(!value)return; state.dragging={value,origin,slotIndex}; const ghost=document.createElement('div'); ghost.className='chip ghost'; ghost.textContent=value; document.body.appendChild(ghost); state.floatingEl=ghost; posGhost(e.pageX,e.pageY); moveL=(ev)=>posGhost(ev.pageX,ev.pageY); upL=(ev)=>endDrag(ev); window.addEventListener('mousemove',moveL); window.addEventListener('mouseup',upL,{once:true}); }
function posGhost(x,y){ if(!state.floatingEl)return; const g=state.floatingEl; g.style.position='absolute'; g.style.left=(x+5)+'px'; g.style.top=(y+5)+'px'; g.style.opacity='0.85'; g.style.pointerEvents='none'; g.style.zIndex='999'; }
function endDrag(e){ const t=document.elementFromPoint(e.clientX,e.clientY); const slotEl=t&&t.closest('.slot'); if(slotEl){ const idx=parseInt(slotEl.getAttribute('data-index')); placeInSlot(state.dragging.value,idx); } else if(state.dragging.origin==='slot'){ removeFromSlot(state.dragging.slotIndex); } cleanupDrag(); build(); maybeSubmit(); }
function cleanupDrag(){ if(state.floatingEl?.parentNode) state.floatingEl.parentNode.removeChild(state.floatingEl); state.floatingEl=null; state.dragging=null; window.removeEventListener('mousemove',moveL);} 
function placeInSlot(value,idx){ if(state.dragging.origin==='pool') state.pool=state.pool.filter(v=>v!==value); if(state.dragging.origin==='slot') state.slots[state.dragging.slotIndex]=null; const existing=state.slots[idx]; if(existing) state.pool.push(existing); state.slots[idx]=value; }
function removeFromSlot(idx){ const v=state.slots[idx]; if(!v)return; state.slots[idx]=null; if(!state.pool.includes(v)) state.pool.push(v); }

function reset(){ state.pool=shuffle(VALUES); state.slots=Array(8).fill(null); state.submitted=false; build(); }
function allFilled(){ return state.slots.every(v=>v); }
function maybeSubmit(){
  if(state.submitted || state.pendingPrompt) return;
  if(allFilled()){
    state.pendingPrompt=true;
    state.promptTimer = setTimeout(()=>{
      state.pendingPrompt=false; state.promptTimer=null;
      if(state.submitted) return;
      if(!allFilled()) return;
      const name=prompt('Enter your name');
      if(!name || !name.trim()) return; // user canceled or empty
      let ageRaw = prompt('Enter your age (number)');
      if(ageRaw===null) return; // canceled
      ageRaw = ageRaw.trim();
      let age = parseInt(ageRaw,10);
      if(isNaN(age) || age<1 || age>120){
        if(!confirm('Age not valid. Save without age?')) return; else age=null;
      }
      save(name.trim(), age);
    },1200);
  }
}
function save(name, age){ const refRank=ref(db,'valueRankings'); const newRef=push(refRank); set(newRef,{name,age:age??null,ranking:state.slots,timestamp:Date.now()}).then(()=>{ state.submitted=true; alert('Saved! View results page.'); }).catch(err=>{ console.error(err); alert('Error saving'); }); }

window.__valueRankingState=state;
