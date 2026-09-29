/* StudentSchedule AI — browser-only adaptive planner.
   No API key required. The assistant is a local reasoning engine, not a cloud LLM.
   A secure paid version should move subscription verification to a server. */
const KEY='ssa_adaptive_v3';
const DAY=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const defaults={settings:{wake:'06:00',bed:'22:30',schoolStart:'08:00',schoolEnd:'15:30'},tasks:[],commitments:[],completed:[],createdAt:Date.now(),lastBuilt:null,trialChoice:null};
let state=load();

function load(){try{return {...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return structuredClone(defaults)}}
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function todayISO(d=new Date()){return d.toISOString().slice(0,10)}
function addDays(iso,n){const d=new Date(iso+'T12:00:00');d.setDate(d.getDate()+n);return todayISO(d)}
function fmtDate(iso){return new Date(iso+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'})}
function mins(t){const [h,m]=t.split(':').map(Number);return h*60+m}
function hm(m){m=Math.round(m);const h=Math.floor(m/60)%24, mm=String(m%60).padStart(2,'0');return `${String(h).padStart(2,'0')}:${mm}`}
function prettyTime(m){const h=Math.floor(m/60)%24, mm=String(m%60).padStart(2,'0');const ap=h>=12?'PM':'AM';return `${h%12||12}:${mm} ${ap}`}
function uid(){return Math.random().toString(36).slice(2,9)}
function esc(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}

const $=s=>document.querySelector(s); const $$=s=>[...document.querySelectorAll(s)];
function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2200)}

function trial(){const age=Date.now()-state.createdAt;const days=Math.floor(age/86400000);return {days,left:Math.max(0,3-days),expired:days>=3}}
function updateTrial(){const t=trial();$('#trialCard').innerHTML=t.expired?'<strong>Trial ended</strong>Continue with Pro for the full adaptive planner.':`<strong>${t.left} day${t.left===1?'':'s'} left</strong>Your 3-day trial includes the full planner.`}
function maybeTrialModal(){if(trial().expired&&!state.trialChoice){$('#trialModal').classList.remove('hidden')}}

function init(){
  if(!state.tasks.length){
    const d=todayISO();state.tasks=[{id:uid(),name:'Math homework',minutes:45,due:d,priority:3},{id:uid(),name:'Science reading',minutes:30,due:d,priority:2},{id:uid(),name:'English assignment',minutes:40,due:addDays(d,1),priority:2}];
    state.commitments=[{id:uid(),name:'Soccer practice',day:new Date().getDay(),start:'17:00',end:'18:30}];save();
  }
  bind(); render(); updateTrial();
  if(!state.lastBuilt) buildSchedule();
  setTimeout(maybeTrialModal,400);
  addChat('ai',`I’m your planner. I don’t just answer questions—I can change the plan when your day changes. Try: “practice was cancelled” or “I have 40 minutes before practice.”`);
}
function loadUsefulDemo(){
  if(!confirm('Load a realistic example day? This replaces your current tasks and commitments.')) return;
  const d=todayISO(), day=new Date(d+'T12:00:00').getDay();
  state.tasks=[
    {id:uid(),name:'Math homework',minutes:45,due:d,priority:3},
    {id:uid(),name:'Science reading',minutes:30,due:d,priority:2},
    {id:uid(),name:'English assignment',minutes:50,due:addDays(d,1),priority:2},
    {id:uid(),name:'Study for math quiz',minutes:35,due:addDays(d,2),priority:3},
    {id:uid(),name:'History notes',minutes:25,due:addDays(d,3),priority:1}
  ];
  state.commitments=[
    {id:uid(),name:'School',day:day,start:'08:00',end:'15:30'},
    {id:uid(),name:'Soccer practice',day:day,start:'17:00',end:'18:30'},
    {id:uid(),name:'Tabla',day:(day+2)%7,start:'20:00',end:'21:00'}
  ];
  state.completed=[]; state.lastBuilt=null; state.trialChoice=null; save(); buildSchedule(); render();
  toast('Example loaded. The schedule was built around school, soccer, and deadlines.');
}

function bind(){
  $('#demoBtn').onclick=loadUsefulDemo;
  $$('.nav-btn').forEach(b=>b.onclick=()=>showView(b.dataset.view));
  $$('[data-view-jump]').forEach(b=>b.onclick=()=>showView(b.dataset.viewJump));
  $('#addTaskBtn').onclick=()=>$('#taskForm').classList.remove('hidden');$('#addTaskTop').onclick=()=>{showView('tasks');$('#taskForm').classList.remove('hidden');$('#taskName').focus()};$('#cancelTask').onclick=()=>$('#taskForm').classList.add('hidden');$('#saveTask').onclick=saveTask;
  $('#refreshBtn').onclick=()=>{buildSchedule();toast('Schedule rebuilt around your current data.')};$('#weekRebuild').onclick=()=>{buildSchedule();render();toast('Week rebalanced.')};
  $('#sendChat').onclick=sendChat;$('#chatInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat()}});$$('.suggestions button').forEach(b=>b.onclick=()=>{ $('#chatInput').value=b.dataset.prompt;sendChat()});
  $('#saveSettings').onclick=saveSettings;$('#addCommitment').onclick=addCommitment;
  $('#closeTrial').onclick=()=>$('#trialModal').classList.add('hidden');$('#keepFreeBtn').onclick=()=>{state.trialChoice='free';save();$('#trialModal').classList.add('hidden');toast('You can keep using the free version.')};$('#upgradeBtn').onclick=()=>{toast('Add your Stripe Payment Link in app.js to activate checkout.');};
}
function showView(v){$$('.view').forEach(x=>x.classList.remove('active'));$('#view-'+v).classList.add('active');$$('.nav-btn').forEach(x=>x.classList.toggle('active',x.dataset.view===v));$('#pageTitle').textContent={today:'Today',tasks:'Tasks',week:'Week',chat:'Planner AI',settings:'Settings'}[v]}

function saveTask(){const name=$('#taskName').value.trim();if(!name)return;state.tasks.push({id:uid(),name,minutes:Math.max(5,Number($('#taskMinutes').value)||30),due:$('#taskDue').value||todayISO(),priority:Number($('#taskPriority').value)});save();['taskName','taskDue'].forEach(x=>$('#'+x).value='');$('#taskForm').classList.add('hidden');buildSchedule();render();toast('Task added and schedule updated.')}
function saveSettings(){state.settings={wake:$('#wakeTime').value,bed:$('#bedTime').value,schoolStart:$('#schoolStart').value,schoolEnd:$('#schoolEnd').value};save();buildSchedule();render();toast('Planning preferences saved.')}
function addCommitment(){const name=prompt('Commitment name');if(!name)return;const start=prompt('Start time (e.g. 17:00)','17:00');const end=prompt('End time (e.g. 18:30)','18:30');const day=Number(prompt('Day number: 0 Sun, 1 Mon … 6 Sat',new Date().getDay()));if(!/^\d\d:\d\d$/.test(start)||!/^\d\d:\d\d$/.test(end))return toast('Use HH:MM times.');state.commitments.push({id:uid(),name,start,end,day:Math.min(6,Math.max(0,day))});save();buildSchedule();render()}

function availableWindows(dateIso){
  const d=new Date(dateIso+'T12:00:00'), day=d.getDay();const s=state.settings;let start=mins(s.wake),end=mins(s.bed);const schoolStart=mins(s.schoolStart),schoolEnd=mins(s.schoolEnd);
  let blocks=[{start,end}];
  const blockers=[{start:schoolStart,end:schoolEnd},...state.commitments.filter(c=>Number(c.day)===day).map(c=>({start:mins(c.start),end:mins(c.end)}))];
  blockers.sort((a,b)=>a.start-b.start).forEach(b=>{blocks=blocks.flatMap(x=>x.end<=b.start||x.start>=b.end?[x]:[{start:x.start,end:Math.max(x.start,b.start)},{start:Math.min(x.end,b.end),end:x.end}].filter(z=>z.end>z.start))});
  return blocks.filter(x=>x.end-x.start>=15).map(x=>({...x}));
}
function taskScore(t,date){const d=Math.max(0,Math.ceil((new Date(t.due+'T23:59:00')-new Date(date+'T12:00:00'))/86400000));let score=t.priority*30+(d===0?75:d===1?48:d<=3?25:8);score+=Math.min(t.minutes,120)/10; if(t.due<date)score+=100;return score}
function buildSchedule(){
  const today=todayISO();let tasks=state.tasks.filter(t=>!state.completed.includes(t.id));
  const schedule={};
  for(let di=0;di<7;di++){
    const date=addDays(today,di);schedule[date]=[];let windows=availableWindows(date);
    // Put overdue/due-soon work first, but never exceed the available windows.
    const candidates=tasks.filter(t=>t.due>=date || t.due<date).sort((a,b)=>taskScore(b,date)-taskScore(a,date));
    for(const t of candidates){let remaining=t.minutes;if(remaining<=0)continue;
      for(const w of windows){
        if(remaining<=0)break; let cursor=w.start;
        while(cursor+15<=w.end&&remaining>0){
          // preserve a short break after ~50 min of focus
          const already=schedule[date].filter(x=>x.type==='task').reduce((a,x)=>a+x.minutes,0);const chunk=Math.min(remaining,50,w.end-cursor);
          if(chunk<15)break;schedule[date].push({type:'task',task:t,start:cursor,end:cursor+chunk,minutes:chunk});remaining-=chunk;cursor+=chunk;
          if(remaining>0&&cursor+10<=w.end){schedule[date].push({type:'break',name:'Short break',start:cursor,end:cursor+10,minutes:10});cursor+=10}
        }
        if(remaining<=0)break;
      }
    }
    // Add fixed commitments into display.
    state.commitments.filter(c=>Number(c.day)===new Date(date+'T12:00:00').getDay()).forEach(c=>schedule[date].push({type:'commitment',name:c.name,start:mins(c.start),end:mins(c.end),minutes:mins(c.end)-mins(c.start)}));
    schedule[date].sort((a,b)=>a.start-b.start);
  }
  state.lastBuilt={at:Date.now(),schedule};save();
}
function todaySchedule(){return state.lastBuilt?.schedule?.[todayISO()]||[]}
function render(){
  $('#dateLabel').textContent=new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});
  $('#wakeTime').value=state.settings.wake;$('#bedTime').value=state.settings.bed;$('#schoolStart').value=state.settings.schoolStart;$('#schoolEnd').value=state.settings.schoolEnd;
  const open=state.tasks.filter(t=>!state.completed.includes(t.id));const sched=todaySchedule();const focus=sched.filter(x=>x.type==='task').reduce((a,x)=>a+x.minutes,0);const free=availableWindows(todayISO()).reduce((a,x)=>a+x.end-x.start,0);
  $('#focusMinutes').textContent=focus;$('#taskCount').textContent=open.length;$('#freeMinutes').textContent=Math.max(0,free-focus);$('#updatedLabel').textContent=state.lastBuilt?'Updated '+new Date(state.lastBuilt.at).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}):'';
  renderSchedule();renderTasks();renderWeek();renderCommitments();updateTrial();
}
function renderSchedule(){const el=$('#scheduleList');const arr=todaySchedule();if(!arr.length){el.innerHTML='<div class="card"><div><div class="card-title">No schedule yet</div><div class="card-meta">Add tasks or commitments and rebuild the plan.</div></div></div>';return}el.innerHTML=arr.map(x=>`<div class="schedule-item ${x.type}"><div class="schedule-time">${prettyTime(x.start)}<br>${prettyTime(x.end)}</div><div class="schedule-dot"></div><div><div class="schedule-title">${esc(x.type==='task'?x.task.name:x.name)}</div><div class="schedule-meta">${x.type==='task'?`${x.minutes} min focus${x.task.due===todayISO()?' · due today':''}`:x.type==='break'?'Reset and switch tasks':'Fixed commitment'}</div></div><span class="schedule-badge">${x.type==='task'?'Focus':x.type==='break'?'Break':'Busy'}</span></div>`).join('')}
function renderTasks(){const el=$('#taskList');const arr=state.tasks.filter(t=>!state.completed.includes(t.id)).sort((a,b)=>taskScore(b,todayISO())-taskScore(a,todayISO()));el.innerHTML=arr.length?arr.map(t=>`<div class="card"><div class="card-main"><div class="card-title">${esc(t.name)}</div><div class="card-meta">${t.minutes} min · due ${fmtDate(t.due)} · ${['','Low','Normal','High','Urgent'][t.priority]}</div></div><div class="task-actions"><button class="icon-btn" onclick="completeTask('${t.id}')">Done</button><button class="icon-btn" onclick="removeTask('${t.id}')">Delete</button></div></div>`).join(''):'<div class="card"><div><div class="card-title">All clear</div><div class="card-meta">No open tasks.</div></div></div>'}
function renderWeek(){const el=$('#weekGrid'),today=todayISO();el.innerHTML=Array.from({length:7},(_,i)=>{const date=addDays(today,i),arr=state.lastBuilt?.schedule?.[date]||[],tasks=arr.filter(x=>x.type==='task');const load=tasks.reduce((a,x)=>a+x.minutes,0);return `<div class="week-day"><h4>${i===0?'Today':DAY[new Date(date+'T12:00:00').getDay()]} · ${fmtDate(date)}</h4><div class="load">${load} min planned</div>${tasks.slice(0,5).map(x=>`<div class="mini-task"><strong>${esc(x.task.name)}</strong>${x.minutes} min</div>`).join('')}${tasks.length>5?`<div class="load">+${tasks.length-5} more</div>`:''}</div>`}).join('')}
function renderCommitments(){const el=$('#commitmentList');el.innerHTML=state.commitments.map(c=>`<div class="commitment-row"><span><b>${esc(c.name)}</b> <small>${DAY[c.day]} · ${prettyTime(mins(c.start))}–${prettyTime(mins(c.end))}</small></span><button class="icon-btn" onclick="removeCommitment('${c.id}')">Delete</button></div>`).join('')||'<div class="card"><div class="card-meta">No fixed commitments yet.</div></div>'}
window.completeTask=id=>{state.completed.push(id);save();buildSchedule();render();toast('Task completed. Schedule updated.')};window.removeTask=id=>{state.tasks=state.tasks.filter(t=>t.id!==id);save();buildSchedule();render()};window.removeCommitment=id=>{state.commitments=state.commitments.filter(c=>c.id!==id);save();buildSchedule();render()};

function addChat(who,text){const box=$('#chatMessages');const d=document.createElement('div');d.className='msg '+who;d.textContent=text;box.appendChild(d);box.scrollTop=box.scrollHeight}
function sendChat(){const input=$('#chatInput'),msg=input.value.trim();if(!msg)return;input.value='';addChat('user',msg);setTimeout(()=>{const reply=reason(msg);addChat('ai',reply)},150)}
function reason(raw){const m=raw.toLowerCase();let changed=false;
  // Detect common schedule changes and apply them to local state.
  if(/cancel(led)?|no (practice|class)|practice.*cancel/.test(m)){const c=state.commitments.find(c=>/practice|class|club/i.test(c.name));if(c){state.commitments=state.commitments.filter(x=>x.id!==c.id);changed=true;}}
  const moveMatch=m.match(/move (.+?) to (tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);if(moveMatch){const needle=moveMatch[1].trim();const t=state.tasks.find(t=>t.name.toLowerCase().includes(needle));if(t){const names=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];const target=names.indexOf(moveMatch[2]);let d=new Date();let diff=(target-d.getDay()+7)%7;if(diff===0)diff=7;t.due=addDays(todayISO(),diff);changed=true;}}
  const minMatch=m.match(/(\d{1,3})\s*(?:minutes?|mins?)/);if(/free|before|have/.test(m)&&minMatch){const n=Number(minMatch[1]);const next=nextBestTask(n);if(next)return `You have about ${n} minutes. I’d use it for “${next.name}” (${Math.min(n,next.minutes)} min). It is currently one of the highest-value tasks based on deadline and priority.`}
  if(/what should i do first|next|priority|start/.test(m)){const t=nextBestTask(999);if(t)return `Start with “${t.name}” — ${t.minutes} min, due ${fmtDate(t.due)}. It has the highest current planning score. I’ll move the other work around it.`}
  if(/too much|overwhelmed|not enough time|can't finish|cannot finish/.test(m)){const open=state.tasks.filter(t=>!state.completed.includes(t.id)).sort((a,b)=>taskScore(b,todayISO())-taskScore(a,todayISO()));const total=open.reduce((a,t)=>a+t.minutes,0),free=availableWindows(todayISO()).reduce((a,x)=>a+x.end-x.start,0);return `You have ${total} minutes of open work and about ${free} minutes of usable time today. I would protect the most urgent work first, then push lower-priority work forward rather than filling your whole evening. Rebuild the schedule and I’ll rebalance it.`}
  if(/unfinished|move.*tomorrow|tomorrow/.test(m)){const tomorrow=addDays(todayISO(),1);state.tasks.filter(t=>!state.completed.includes(t.id)&&t.due===todayISO()).forEach(t=>t.due=tomorrow);changed=true}
  if(changed){save();buildSchedule();render();return 'I changed the plan based on that update. I removed or moved the affected item and rebuilt the schedule around the remaining deadlines.'}
  if(/how.*work|how.*plan/.test(m))return 'I score each open task using urgency, deadline, priority, duration, and whether it is overdue. I then place work only inside your available windows, avoiding school and fixed commitments. Larger tasks can be split into focus blocks with breaks.';
  if(/schedule|plan/.test(m)){buildSchedule();render();return 'I rebuilt your schedule from the current tasks, deadlines, commitments, school hours, and sleep window. Open Today to see the updated blocks.'}
  return 'I can adapt the schedule when you tell me what changed. For example: “practice was cancelled,” “I have 30 minutes before soccer,” “move science to tomorrow,” or “I have too much homework tonight.”';
}
function nextBestTask(cap){return state.tasks.filter(t=>!state.completed.includes(t.id)&&t.minutes>0).sort((a,b)=>taskScore(b,todayISO())-taskScore(a,todayISO())).find(t=>t.minutes<=cap)||state.tasks.filter(t=>!state.completed.includes(t.id)).sort((a,b)=>taskScore(b,todayISO())-taskScore(a,todayISO()))[0]}

init();
