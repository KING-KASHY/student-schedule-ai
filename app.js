const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const store="studentScheduleV5";
let D=JSON.parse(localStorage.getItem(store)||"null")||{account:null,trialStart:null,tasks:[],blocks:[],settings:{start:"16:00",end:"22:00",buffer:10}};
const save=()=>localStorage.setItem(store,JSON.stringify(D));
const today=()=>new Date().toISOString().slice(0,10);
const uid=()=>Date.now()+Math.floor(Math.random()*100000);
const esc=x=>String(x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pLabel=p=>["","Low","Normal","Important","High","Critical"][p]||"Normal";
const pClass=p=>p>=5?"p5":p>=4?"p4":p>=3?"p3":"";
const dateText=k=>new Date(k+"T12:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric"});

function tasksFor(day){return D.tasks.filter(t=>t.due===day)}
function taskHTML(t){
  return `<div class="task ${t.done?"done":""}">
    <button class="check" data-complete="${t.id}" aria-label="Complete task"></button>
    <div><div class="task-name"><b>${esc(t.name)}</b> ${t.fixed?'<span class="badge fixed">Fixed</span>':''}</div>
    <div class="task-meta">${t.minutes} min · due ${dateText(t.due)} · <span class="badge ${pClass(t.priority)}">${pLabel(t.priority)}</span>${t.preferred!=="any"?` · ${t.preferred}`:""}</div></div>
    <button class="danger" data-delete="${t.id}">Delete</button>
  </div>`;
}
function scoreTask(t){
  const days=Math.max(0,Math.ceil((new Date(t.due+"T23:59:59")-new Date())/86400000));
  return t.priority*100 + Math.max(0,20-days*4) + (t.fixed?80:0);
}
function toMinutes(v){let[a,b]=v.split(":").map(Number);return a*60+b}
function clock(v){let h=Math.floor(v/60),m=v%60,ap=h>=12?"PM":"AM";h=h%12||12;return `${h}:${String(m).padStart(2,"0")} ${ap}`}
function parseTime(v){return toMinutes(v)}
function overlaps(a,b,c,d){return a<d&&b>c}

function renderToday(){
  const a=tasksFor(today()), done=a.filter(t=>t.done).length, mins=a.filter(t=>!t.done).reduce((n,t)=>n+t.minutes,0), top=[...a].filter(t=>!t.done).sort((x,y)=>scoreTask(y)-scoreTask(x))[0];
  $("#view").innerHTML=`<div class="hero"><h2>${D.account?`${esc(D.account.name)}’s day`:"Today"}</h2>
    <p>Your schedule is based on what matters most, how long each task takes, and the time you actually have.</p>
    <div class="hero-grid"><div class="hero-stat"><small>Tasks</small><b>${a.length}</b></div><div class="hero-stat"><small>Work left</small><b>${mins} min</b></div><div class="hero-stat"><small>Next priority</small><b>${top?pLabel(top.priority):"—"}</b></div></div>
  </div><div class="card"><div class="section-title"><h2>Today's tasks</h2><button class="secondary" id="todayBuild">Rebuild day</button></div>
  ${a.length?a.sort((x,y)=>y.priority-x.priority||x.due.localeCompare(y.due)).map(taskHTML).join(""):'<div class="empty">No tasks yet. Add what you need to get done.</div>'}</div>
  <div class="card" style="margin-top:16px"><div class="section-title"><h2>Generated plan</h2><span class="badge">Priority-based</span></div><div id="todayPlan">${renderGenerated()}</div></div>`;
}
function renderTasks(){
  const a=[...D.tasks].sort((x,y)=>x.done-y.done||x.due.localeCompare(y.due)||y.priority-x.priority);
  $("#view").innerHTML=`<div class="card"><div class="section-title"><h2>All tasks</h2><button class="primary" id="taskAdd2">+ Add task</button></div>${a.length?a.map(taskHTML).join(""):'<div class="empty">No tasks yet.</div>'}</div>`;
}
function renderBuilder(){
  const blocks=D.blocks.filter(b=>b.day===today());
  $("#view").innerHTML=`<div class="builder">
    <div class="card controls">
      <div><h2>Build your day</h2><p class="muted">Set the limits first. Then the planner fits your work inside them.</p></div>
      <div class="row"><label class="label">Start<input id="dayStart" type="time" value="${D.settings.start}"></label><label class="label">End<input id="dayEnd" type="time" value="${D.settings.end}"></label></div>
      <label class="label">Break between tasks<select id="buffer"><option value="0">0 min</option><option value="5">5 min</option><option value="10">10 min</option><option value="15">15 min</option></select></label>
      <div><b>Unavailable today</b><div class="availability" style="margin-top:8px">
        ${blocks.length?blocks.map(b=>`<div class="block-row"><span>${clock(b.start)}–${clock(b.end)} · ${esc(b.label)}</span><button class="danger" data-block-del="${b.id}">Remove</button></div>`).join(""):'<div class="notice">Nothing blocked.</div>'}
      </div></div>
      <button class="secondary" id="addBlock">+ Add unavailable time</button>
      <button class="primary" id="generate">Generate schedule</button>
      <div class="notice">Tasks are ranked by priority and deadline. Fixed commitments stay fixed. Unavailable periods are skipped.</div>
    </div>
    <div class="card"><div class="section-title"><h2>Generated schedule</h2><span class="badge">Built around your availability</span></div><div>${renderGenerated()}</div></div>
  </div>`;
  $("#buffer").value=D.settings.buffer;
}
function generatePlan(){
  D.settings.start=$("#dayStart")?.value||D.settings.start;D.settings.end=$("#dayEnd")?.value||D.settings.end;D.settings.buffer=Number($("#buffer")?.value||D.settings.buffer);
  const date=today(), blocks=D.blocks.filter(b=>b.day===date), start=toMinutes(D.settings.start), end=toMinutes(D.settings.end), buffer=D.settings.buffer;
  let fixed=tasksFor(date).filter(t=>t.fixed&&!t.done).map(t=>({...t}));
  let normal=tasksFor(date).filter(t=>!t.fixed&&!t.done).sort((a,b)=>scoreTask(b)-scoreTask(a));
  let placements=[];
  const ranges=blocks.map(b=>[parseTime(b.start),parseTime(b.end)]).sort((a,b)=>a[0]-b[0]);
  const isBlocked=(s,e)=>ranges.some(r=>overlaps(s,e,r[0],r[1]));
  function nextOpen(t){
    let x=t;
    for(const r of ranges){if(x<r[1]&&x>=r[0])x=r[1]}
    return x;
  }
  // Place fixed tasks first at their existing preferred slot when a fixed time exists.
  // In this browser-only version, fixed commitments without a fixed clock time are
  // treated as high-priority tasks that cannot be displaced once scheduled.
  let cursor=start;
  for(const t of fixed){
    cursor=nextOpen(cursor);
    if(cursor+t.minutes<=end&&!isBlocked(cursor,cursor+t.minutes)){placements.push({task:t,start:cursor,end:cursor+t.minutes,fixed:true});cursor+=t.minutes+buffer}
  }
  for(const t of normal){
    let p=nextOpen(cursor), placed=false;
    while(p+t.minutes<=end){
      if(!isBlocked(p,p+t.minutes)){
        placements.push({task:t,start:p,end:p+t.minutes});cursor=p+t.minutes+buffer;placed=true;break;
      }
      p=nextOpen(p+15);
      if(p>=end)break;
    }
  }
  D.generated={day:date,items:placements,totalMinutes:placements.reduce((n,x)=>n+x.task.minutes,0)};
  save();
}
function renderGenerated(){
  const g=D.generated?.day===today()?D.generated:null;
  if(!g)return '<div class="empty">Generate a schedule to see where each task fits.</div>';
  if(!g.items.length)return '<div class="empty">Nothing fits inside the available time. Add more time or reduce the workload.</div>';
  return `<div class="timeline">${g.items.map(x=>`<div class="slot"><div class="slot-time">${clock(x.start)}<br>${clock(x.end)}</div><div class="slot-box ${x.fixed?"fixed":""}"><b>${esc(x.task.name)}</b><small>${x.task.minutes} min · ${pLabel(x.task.priority)} priority${x.fixed?" · fixed":""}</small></div></div>`).join("")}</div>`;
}
function renderCalendar(){
  let cells="";
  for(let i=0;i<7;i++){let d=new Date();d.setDate(d.getDate()-d.getDay()+i);let k=d.toISOString().slice(0,10);
    cells+=`<div class="day ${k===today()?"today":""}"><div class="dayhead">${d.toLocaleDateString(undefined,{weekday:"short"})}</div><div class="date">${d.getDate()}</div>${tasksFor(k).map(t=>`<div class="event ${t.done?"done":""}">${esc(t.name)} · ${t.minutes}m</div>`).join("")}</div>`;
  }
  $("#view").innerHTML=`<div class="card"><h2>Calendar</h2><p class="muted">Your next seven days.</p><div class="calendar">${cells}</div></div>`;
}
function renderWeek(){
  let s="";
  for(let i=0;i<7;i++){let d=new Date();d.setDate(d.getDate()+i);let k=d.toISOString().slice(0,10);let a=tasksFor(k).sort((x,y)=>y.priority-x.priority);
    s+=`<div class="slot"><div class="slot-time">${dateText(k)}</div><div>${a.length?a.map(taskHTML).join(""):'<div class="notice">No tasks</div>'}</div></div>`;
  }
  $("#view").innerHTML=`<div class="card"><h2>Next 7 days</h2><div class="timeline">${s}</div></div>`;
}
function renderPricing(){
  const active=D.trialStart&&(Date.now()-D.trialStart<259200000), daysLeft=active?Math.ceil((259200000-(Date.now()-D.trialStart))/86400000):0;
  $("#view").innerHTML=`<div class="pricing-grid">
    <div class="card price"><h2>Free</h2><div class="amount">$0</div><p class="muted">Core planning.</p><ul><li>Tasks and deadlines</li><li>Calendar</li><li>Manual organization</li></ul><button class="secondary" disabled>Current plan</button></div>
    <div class="card price pro"><span class="badge">${active?`${daysLeft} day${daysLeft===1?"":"s"} left`:"Pro"}</span><h2>Pro</h2><div class="amount">$4.99<small>/month</small></div><p class="muted">Automatic schedule building.</p><ul><li>Priority + deadline scheduling</li><li>Unavailable-time planning</li><li>Automatic daily schedule</li><li>Workload-aware planning</li><li>Advanced weekly planning</li></ul><button class="primary" id="pricingUpgrade">${active?"Pro trial active":"Start 3-day free trial"}</button></div>
  </div>`;
}
function renderSettings(){
  $("#view").innerHTML=`<div class="card"><h2>Settings</h2><p class="muted">${esc(D.account.email)}</p><div class="settings-grid">
  <label>Default start<input id="setStart" type="time" value="${D.settings.start}"></label><label>Default end<input id="setEnd" type="time" value="${D.settings.end}"></label>
  </div><br><button class="primary" id="saveSettings">Save settings</button></div>`;
}
const meta={today:["Today","Your day, organized around what matters most."],builder:["Schedule Builder","Set tasks, time needed, priorities, deadlines, and unavailable periods."],tasks:["Tasks","Everything you need to finish."],calendar:["Calendar","Your workload across the week."],week:["Week","The next seven days at a glance."],pricing:["Pro & Pricing","Start with a 3-day Pro trial, then choose your plan."],settings:["Settings","Account and scheduling preferences."]};
function render(v="today"){$("#pageTitle").textContent=meta[v][0];$("#pageSub").textContent=meta[v][1];$$(".nav").forEach(b=>b.classList.toggle("active",b.dataset.view===v));({today:renderToday,builder:renderBuilder,tasks:renderTasks,calendar:renderCalendar,week:renderWeek,pricing:renderPricing,settings:renderSettings}[v])();window.currentView=v}
function openModal(){$("#taskModal").classList.remove("hidden");$("#taskDue").value=today();$("#taskName").focus()}function closeModal(){$("#taskModal").classList.add("hidden")}
function boot(){if(!D.account){$("#authGate").classList.remove("hidden");return}$("#authGate").classList.add("hidden");$("#app").classList.remove("hidden");$("#accountName").textContent=D.account.name;updateTrial();render("today")}
function updateTrial(){const active=D.trialStart&&(Date.now()-D.trialStart<259200000);$("#trialStatus").textContent=active?"3-day Pro trial active":"Free plan"}
$("#signupForm").addEventListener("submit",e=>{e.preventDefault();D.account={name:$("#nameInput").value.trim(),email:$("#emailInput").value.trim()};D.trialStart=Date.now();save();boot()});
$("#landingPricing").addEventListener("click",()=>alert("Free: $0/month. Pro: $4.99/month after a 3-day free trial."));
$("#quickAdd").addEventListener("click",openModal);$("#quickBuild").addEventListener("click",()=>render("builder"));$("#closeTask").addEventListener("click",closeModal);
$("#taskForm").addEventListener("submit",e=>{e.preventDefault();D.tasks.push({id:uid(),name:$("#taskName").value.trim(),minutes:Number($("#taskMinutes").value),priority:Number($("#taskPriority").value),due:$("#taskDue").value||today(),preferred:$("#taskPreferred").value,fixed:$("#taskFixed").checked,done:false});save();closeModal();render("tasks")});
document.addEventListener("click",e=>{
  const n=e.target.closest(".nav");if(n){render(n.dataset.view);return}
  if(e.target.id==="taskAdd2"){openModal();return}
  if(e.target.id==="todayBuild"){render("builder");return}
  if(e.target.id==="generate"){generatePlan();render("builder");return}
  if(e.target.id==="addBlock"){let start=prompt("Start time, for example 18:00");let end=prompt("End time, for example 19:30");if(start&&end){let label=prompt("What is this time for?","Soccer practice")||"Unavailable";D.blocks.push({id:uid(),day:today(),start,end,label});save();render("builder")}return}
  if(e.target.dataset.blockDel){D.blocks=D.blocks.filter(b=>b.id!=e.target.dataset.blockDel);save();render("builder");return}
  if(e.target.dataset.complete){let t=D.tasks.find(x=>x.id==e.target.dataset.complete);if(t){t.done=!t.done;save();render(window.currentView||"today")}return}
  if(e.target.dataset.delete){D.tasks=D.tasks.filter(t=>t.id!=e.target.dataset.delete);save();render(window.currentView||"tasks");return}
  if(e.target.id==="saveSettings"){D.settings.start=$("#setStart").value;D.settings.end=$("#setEnd").value;save();render("builder");return}
  if(e.target.id==="pricingUpgrade")alert("Your trial is free. Any real Pro purchase should use a parent/guardian checkout account."); 
});
boot();
