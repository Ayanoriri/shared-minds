import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-analytics.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";

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
let analytics=null; try { analytics=getAnalytics(app);} catch(e){}
const db = getDatabase(app);

const container = document.getElementById('results');

function escapeHTML(s){ return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }

function buildAggregate(list){
  // counts[value][rankIndex] -> count
  const counts={};
  list.forEach(r=>{
    (r.ranking||[]).forEach((val,rankIdx)=>{
      if(!counts[val]) counts[val]=Array(8).fill(0);
      counts[val][rankIdx]++;
    });
  });
  return counts;
}

function renderAggregate(counts){
  const keys = Object.keys(counts).sort();
  if(!keys.length) return document.createTextNode('');
  // compute max for color scale
  let max=0; keys.forEach(k=>counts[k].forEach(v=>{ if(v>max) max=v; }));
  const table=document.createElement('table'); table.className='resultsTable heatmap';
  const thead=document.createElement('thead');
  thead.innerHTML='<tr><th>Value</th>'+Array.from({length:8},(_,i)=>`<th>${i+1}</th>`).join('')+'</tr>';
  table.appendChild(thead);
  const tbody=document.createElement('tbody');
  keys.forEach(val=>{
    const tr=document.createElement('tr');
    const first=document.createElement('td'); first.textContent=val; tr.appendChild(first);
    counts[val].forEach((cnt,idx)=>{
      const td=document.createElement('td');
      const ratio = max? cnt/max : 0;
      const hue = 210 - Math.round(ratio*210); // blue -> light
      const light = 95 - Math.round(ratio*55); // lighter for low counts
      td.style.background = cnt? `hsl(${hue} 70% ${light}%)` : '#f7f7f7';
      td.style.position='relative';
      td.textContent = cnt || '';
      td.title = `${val} ranked ${idx+1} : ${cnt}`;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  const wrap=document.createElement('div');
  const heading=document.createElement('h2'); heading.textContent='Value Frequency per Rank'; heading.style.marginTop='30px'; heading.style.fontSize='18px';
  wrap.appendChild(heading);
  wrap.appendChild(table);
  return wrap;
}

function render(list){
  container.innerHTML='';
  if(!list.length){ container.textContent='No submissions yet.'; return; }
  // Individual submissions table (without time, with age)
  const table=document.createElement('table'); table.className='resultsTable';
  const head=document.createElement('thead'); head.innerHTML='<tr><th>Name</th><th>Age</th><th>Ranking (1→8)</th></tr>'; table.appendChild(head);
  const tbody=document.createElement('tbody');
  list.sort((a,b)=>b.timestamp-a.timestamp).forEach(r=>{
    const tr=document.createElement('tr');
    const ageCell = (r.age===null || r.age===undefined)? '' : escapeHTML(String(r.age));
    tr.innerHTML=`<td>${escapeHTML(r.name||'')}</td><td>${ageCell}</td><td>${(r.ranking||[]).map(v=>`<span class=\"miniChip\">${escapeHTML(v)}</span>`).join('')}</td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);

  // Aggregate heatmap
  const aggCounts = buildAggregate(list);
  container.appendChild(renderAggregate(aggCounts));
}

onValue(ref(db,'valueRankings'), snap => {
  const data = snap.val() || {};
  const arr = Object.keys(data).map(k=>data[k]);
  render(arr);
});