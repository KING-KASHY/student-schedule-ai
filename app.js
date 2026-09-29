/* StudentSchedule AI — browser-only adaptive planner.
   No API key required. The assistant is a local reasoning engine, not a cloud LLM.
   A secure paid version should move subscription verification to a server. */
const KEY='ssa_adaptive_v5';
const DAY=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const defaults={settings:{wake:'06:00',bed:'22:30',schoolStart:'08:00',schoolEnd:'15:30'},tasks:[],commitments:[],completed:[],createdAt:Date.now(),lastBuilt:null,trialChoice:null,trialStartedAt:null};
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

function trial(){
  if(!state.trialStartedAt) return {started:false,days:0,left:3,expired:false};
  const days=(Date.now()-Number(state.trialStartedAt))/86400000;
  return {started:true,days,left:Math.max(0,Math.ceil(3-days)),expired:days>=3};
}
function isPro(){const t=trial(); return !t.expired && t.started;}
function updateTrial(){
  const t=trial(); const card=$('#trialCard'); if(!card)return;
  if(!t.started){card.innerHTML='<strong>Free plan</strong>Start your 3-day Pro trial to unlock the full adaptive planner.<button class="trial-cta" id="startTrialSide">Start free trial</button>'; $('#startTrialSide')?.addEventListener('click',startTrial); return;}
  if(t.expired){card.innerHTML='<strong>Trial ended</strong>Your Pro trial is over.<button class="trial-cta" id="upgradeSide">Continue with Pro · $3/mo</button>'; $('#upgradeSide')?.addEventListener('click',showUpgradeModal); return;}
  card.innerHTML=`<strong>${t.left} day${t.left===1?'':'s'} left</strong>Your 3-day Pro trial includes the full planner.<button class="trial-cta" id="upgradeSide">View Pro</button>`; $('#upgradeSide')?.addEventListener('click',showUpgradeModal);
}
function showStartTrialModal(){const m=$('#trialModal'); if(!m)return; $('#trialModalPill').textContent='3-day Pro trial'; $('#trialModalTitle').textContent='Try Pro free for 3 days'; $('#trialModalText').textContent='Use the full adaptive planner for 3 days. No payment is requested during the trial. When the trial ends, you can choose whether to continue for $3/month.'; $('#startTrialBtn').classList.remove('hidden'); $('#upgradeBtn').classList.add('hidden'); $('#keepFreeBtn').classList.remove('hidden'); m.classList.remove('hidden');}
function showUpgradeModal(){const m=$('#trialModal'); if(!m)return; $('#trialModalPill').textContent='Pro plan'; $('#trialModalTitle').textContent='Continue with StudentSchedule AI Pro'; $('#trialModalText').textContent='Your trial has ended. Continue with adaptive planning, weekly planning, and the full Planner AI for $3/month.'; $('#startTrialBtn').classList.add('hidden'); $('#upgradeBtn').classList.remove('hidden'); $('#keepFreeBtn').classList.remove('hidden'); m.classList.remove('hidden');}
function startTrial(){state.trialStartedAt=Date.now();state.trialChoice=null;save();$('#trialModal')?.classList.add('hidden');updateTrial();toast('Your 3-day Pro trial has started.');}
function maybeTrialModal(){const t=trial(); if(!t.started){setTimeout(showStartTrialModal,500); return;} if(t.expired&&!state.trialChoice)setTimeout(showUpgradeModal,500);}

function init(){
  try {
    if(!state.tasks.length){
      const d=todayISO();
      state.tasks=[
        {id:uid(),name:'Math homework',minutes:45,due:d,priority:3},
        {id:uid(),name:'Science reading',minutes:30,due:d,priority:2},
        {id:uid(),name:'English assignment',minutes:40,due:addDays(d,1),priority:2}
      ];
      state.commitments=[{id:uid(),name:'Soccer practice',day:new Date().getDay(),start:'17:00',end:'18:30'}];
      save();
    }
    bind();
    buildSchedule();
    render();
    updateTrial();
    setTimeout(maybeTrialModal,400);
    addChat('ai',`I can actually change your plan. Try “I have soccer at 6 PM today”, “math is finished”, “move science to tomorrow”, or “I only have 45 minutes tonight.” I’ll update the schedule and explain what changed.`);
  } catch(err) {
    console.error('StudentSchedule startup error:',err);
    const box=$('#chatMessages');
    if(box){
      const d=document.createElement('div'); d.className='msg ai';
      d.textContent='The planner loaded, but something went wrong during startup. Refresh the page once.'; box.appendChild(d);
    }
  }
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
  const on=(sel,event,fn)=>{const el=$(sel); if(el) el.addEventListener(event,fn);};
  on('#demoBtn','click',loadUsefulDemo);
  $$('.nav-btn').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
  $$('[data-view-jump]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.viewJump)));
  on('#addTaskBtn','click',()=>$('#taskForm')?.classList.remove('hidden'));
  on('#addTaskTop','click',()=>{showView('tasks');$('#taskForm')?.classList.remove('hidden');$('#taskName')?.focus()});
  on('#cancelTask','click',()=>$('#taskForm')?.classList.add('hidden'));
  on('#saveTask','click',saveTask);
  on('#refreshBtn','click',()=>{buildSchedule();render();toast('Schedule rebuilt around your current data.')});
  on('#weekRebuild','click',()=>{buildSchedule();render();toast('Week rebalanced.')});
  on('#sendChat','click',sendChat);
  on('#chatInput','keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat()}});
  $$('.suggestions button').forEach(b=>b.addEventListener('click',()=>{ $('#chatInput').value=b.dataset.prompt;sendChat()}));
  on('#saveSettings','click',saveSettings);
  on('#addCommitment','click',addCommitment);
  on('#closeTrial','click',()=>$('#trialModal')?.classList.add('hidden'));
  on('#startTrialBtn','click',startTrial);
  on('#upgradeBtn','click',()=>{
    const url=window.PAYMENT_LINK||'';
    if(url) window.location.href=url; else toast('Your Pro payment link is not connected yet.');
  });
  on('#keepFreeBtn','click',()=>{state.trialChoice='free';save();$('#trialModal')?.classList.add('hidden');updateTrial();toast('You can keep using the free version.');});
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
function parseTime(text){
  const m=text.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/i); if(!m)return null;
  let h=Number(m[1]), min=Number(m[2]||0); const ap=m[3].toLowerCase(); if(ap==='pm'&&h!==12)h+=12; if(ap==='am'&&h===12)h=0; return h*60+min;
}
function addMinutesToTime(start,duration){return hm(start+duration)}
function findTask(text){const clean=text.toLowerCase(); return state.tasks.find(t=>clean.includes(t.name.toLowerCase())) || state.tasks.find(t=>{const words=t.name.toLowerCase().split(/\s+/).filter(w=>w.length>3);return words.some(w=>clean.includes(w))});}
function findCommitment(text){const clean=text.toLowerCase();return state.commitments.find(c=>clean.includes(c.name.toLowerCase()) || (c.name.length>3 && clean.includes(c.name.toLowerCase().split(/\s+/)[0])));}
function reason(raw){
  const m=raw.toLowerCase().trim(); let changed=false; let response='';
  const today=todayISO();

  // Mark work complete.
  if(/\b(done|finished|completed|complete)\b/.test(m)){
    const t=findTask(m); if(t){ if(!state.completed.includes(t.id)) state.completed.push(t.id); changed=true; response=`Marked “${t.name}” complete and rebuilt the schedule around the work that remains.`; }
  }

  // Cancel a commitment such as soccer/practice/class.
  if(!response && /\b(cancel|cancelled|canceled|no longer)\b/.test(m)){
    const c=findCommitment(m) || state.commitments.find(c=>/practice|soccer|club|class/i.test(c.name)&&m.includes(c.name.split(/\s+/)[0].toLowerCase()));
    if(c){state.commitments=state.commitments.filter(x=>x.id!==c.id);changed=true;response=`Removed “${c.name}” from your commitments and rebuilt the schedule.`;}
  }

  // Add a real-time commitment: “I have soccer at 6 PM today”, optionally with a duration.
  if(!response && /\b(i have|there is|add|schedule|put)\b/.test(m)){
    const time=parseTime(m); const durMatch=m.match(/(?:for|lasting)\s+(\d+(?:\.\d+)?)\s*(minutes?|mins?|hours?|hrs?)/i);
    if(time && /\b(soccer|practice|training|club|class|lesson|meeting|work|game|appointment)\b/i.test(m)){
      let dur=90; if(durMatch){dur=Number(durMatch[1])*(/hour|hr/.test(durMatch[2].toLowerCase())?60:1)}
      const dayOffset=/tomorrow/.test(m)?1:0; const target=new Date(today+'T12:00:00'); target.setDate(target.getDate()+dayOffset); const day=target.getDay();
      let name='Commitment'; const n=m.match(/(?:i have|there is|add|schedule|put)\s+(.+?)\s+(?:at|from)\s+/i); if(n)name=n[1].trim().replace(/\btoday\b|\btomorrow\b/gi,'').trim();
      state.commitments.push({id:uid(),name:name||'Commitment',day,start:hm(time),end:addMinutesToTime(time,dur)}); changed=true; response=`Added “${name||'Commitment'}” at ${prettyTime(time)} for about ${dur} minutes and rebuilt your schedule around it.`;
    }
  }

  // Move a named task to another day.
  if(!response){
    const move=m.match(/\bmove\s+(.+?)\s+to\s+(tomorrow|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
    if(move){const t=findTask(move[1]); if(t){let target=move[2].toLowerCase(); if(target==='tomorrow')t.due=addDays(today,1); else if(target==='next week')t.due=addDays(today,7); else {const names=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];let diff=(names.indexOf(target)-new Date().getDay()+7)%7;if(diff===0)diff=7;t.due=addDays(today,diff);} changed=true;response=`Moved “${t.name}” to ${fmtDate(t.due)} and rebuilt the schedule.`;}}
  }
  if(!response && /\bmove (everything|all|all my work) (to )?next week\b/.test(m)){
    state.tasks.filter(t=>!state.completed.includes(t.id)).forEach(t=>t.due=addDays(t.due,7)); changed=true; response='I moved all unfinished tasks one week later and rebuilt the schedule. Fixed commitments were left unchanged.';
  }

  // Create a task from natural language.
  if(!response && /\b(add|create|remember|i need to|i have to)\b/.test(m)){
    const dur=m.match(/(\d+)\s*(minutes?|mins?|hours?|hrs?)/i); const timeNeeded=dur?Number(dur[1])*(/hour|hr/.test(dur[2].toLowerCase())?60:1):30;
    const due=/tomorrow/.test(m)?addDays(today,1):/next week/.test(m)?addDays(today,7):today;
    let name=m.replace(/\b(add|create|remember|i need to|i have to)\b/,'').replace(/\bfor\s+\d+\s*(minutes?|mins?|hours?|hrs?)\b/,'').replace(/\bby\s+(tomorrow|today|next week)\b/,'').trim();
    if(name.length>2 && !/soccer|practice|training|club|class|lesson|meeting/i.test(name)){state.tasks.push({id:uid(),name:name.charAt(0).toUpperCase()+name.slice(1),minutes:timeNeeded,due,priority:/urgent|asap|important/i.test(m)?3:2});changed=true;response=`Added “${state.tasks[state.tasks.length-1].name}” as a ${timeNeeded}-minute task and rebuilt the schedule.`;}
  }

  // “I only have 45 minutes tonight” / “before soccer”.
  const minMatch=m.match(/(\d{1,3})\s*(?:minutes?|mins?)/); if(!response && minMatch && /\b(free|before|only have|have)\b/.test(m)){const n=Number(minMatch[1]);const next=nextBestTask(n); if(next)return `You have about ${n} minutes. I would use it for “${next.name}” (${Math.min(n,next.minutes)} min). It is currently the highest-value task based on deadline and priority. I can rebuild the schedule around that time block.`;}

  if(!response && /\b(what should i do first|what do i do first|next|priority|start)\b/.test(m)){const t=nextBestTask(999);if(t)return `Start with “${t.name}” — ${t.minutes} minutes, due ${fmtDate(t.due)}. It has the highest current planning score because of its deadline and priority.`;}
  if(!response && /\b(too much|overwhelmed|not enough time|can't finish|cannot finish)\b/.test(m)){const open=state.tasks.filter(t=>!state.completed.includes(t.id));const total=open.reduce((a,t)=>a+t.minutes,0),free=availableWindows(today).reduce((a,x)=>a+x.end-x.start,0);buildSchedule();render();return `You have ${total} minutes of open work and about ${free} minutes of usable time today. I rebuilt the plan to protect the most urgent work first and push lower-priority work later.`;}
  if(!response && /\b(unfinished|move.*tomorrow|push.*tomorrow)\b/.test(m)){const tomorrow=addDays(today,1);state.tasks.filter(t=>!state.completed.includes(t.id)&&t.due===today).forEach(t=>t.due=tomorrow);changed=true;response='I moved today’s unfinished tasks to tomorrow and rebuilt the schedule.';}
  if(changed){save();buildSchedule();render();return response||'I updated the plan and rebuilt your schedule.';}
  if(/\b(how.*work|how.*plan|why)\b/.test(m))return 'I use your open tasks, deadlines, priority, task length, school hours, sleep window, and fixed commitments. When you tell me something changed, I update the underlying data first and then rebuild the schedule instead of just giving you a generic answer.';
  if(/\b(schedule|plan|rebuild|replan)\b/.test(m)){buildSchedule();render();return 'I rebuilt your schedule using your current tasks, deadlines, commitments, school hours, and sleep window.';}
  return 'I can change the plan when you tell me something specific. Try “I have soccer at 6 PM today,” “math is finished,” “move science to tomorrow,” “I only have 45 minutes tonight,” or “move everything next week.”';
}
function nextBestTask(cap){return state.tasks.filter(t=>!state.completed.includes(t.id)&&t.minutes>0).sort((a,b)=>taskScore(b,todayISO())-taskScore(a,todayISO())).find(t=>t.minutes<=cap)||state.tasks.filter(t=>!state.completed.includes(t.id)).sort((a,b)=>taskScore(b,todayISO())-taskScore(a,todayISO()))[0]}

window.PAYMENT_LINK = ''; // Put your parent/guardian's public checkout link here.

// Final click safety net: keeps navigation working even if an individual listener is missed.
document.addEventListener('click',e=>{
  const b=e.target.closest('.nav-btn');
  if(b) showView(b.dataset.view);
  const jump=e.target.closest('[data-view-jump]');
  if(jump) showView(jump.dataset.viewJump);
});

init();
