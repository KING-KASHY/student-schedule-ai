const $=s=>document.querySelector(s), iso=d=>d.toISOString().slice(0,10), today=()=>iso(new Date()), tomorrow=()=>{let d=new Date();d.setDate(d.getDate()+1);return iso(d)};
let D=JSON.parse(localStorage.getItem('ssa')||'null')||{tasks:[{id:1,name:'Math homework',due:today(),mins:45,p:3,done:false},{id:2,name:'Science reading',due:today(),mins:30,p:2,done:false}],commit:[],trial:null};
const save=()=>localStorage.setItem('ssa',JSON.stringify(D)), esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let page='today', month=new Date(), titles={today:['Today','Your plan, without the guesswork.'],calendar:['Calendar','Your month at a glance.'],tasks:['Tasks','Assignments and deadlines.'],week:['Week','Your next seven days.'],planner:['Planner AI','Only for changing your schedule.'],assistant:['AI Assistant','A general student assistant for school, planning, and everyday questions.'],settings:['Settings','Your preferences.']};
function task(x){return `<div class="task ${x.done?'completed':''}"><div><b class="${x.done?'done-name':''}">${esc(x.name)}</b><div class=muted>${x.due} · ${x.mins} min · ${x.p==3?'High':x.p==2?'Normal':'Low'}</div></div><button class="${x.done?'complete-green':''}" onclick="toggle(${x.id})">${x.done?'✓ Complete':'Complete'}</button></div>`}
function toggle(id){let x=D.tasks.find(x=>x.id==id);x.done=!x.done;save();render()}
function render(){let t=titles[page];$('#title').textContent=t[0];$('#sub').textContent=t[1];document.querySelectorAll('.nav').forEach(x=>x.classList.toggle('active',x.dataset.page==page));if(page==='today')todayPage();if(page==='tasks')tasksPage();if(page==='calendar')calendarPage();if(page==='week')weekPage();if(page==='planner')plannerPage();if(page==='assistant')assistantPage();if(page==='settings')settingsPage()}
function todayPage(){let a=D.tasks.filter(x=>!x.done).sort((a,b)=>a.due.localeCompare(b.due)||b.p-a.p);$('#page').innerHTML=`<div class=grid><div class=card><div class=muted>Open tasks</div><div class=stat>${a.length}</div></div><div class=card><div class=muted>Due today</div><div class=stat>${a.filter(x=>x.due==today()).length}</div></div><div class=card><div class=muted>Workload</div><div class=stat>${a.reduce((n,x)=>n+x.mins,0)}m</div></div></div><div class=card><h2>Priorities</h2>${a.map(task).join('')||'<p class=muted>You are caught up.</p>'}</div>`}
function tasksPage(){$('#page').innerHTML=`<div class=card><h2>All tasks</h2>${D.tasks.map(task).join('')}</div>`}
function calendarPage(){let y=month.getFullYear(),m=month.getMonth(),start=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate(),s=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(x=>`<div class=dow>${x}</div>`).join('');for(let i=0;i<start;i++)s+='<div class=day></div>';for(let d=1;d<=days;d++){let z=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`,ev=D.tasks.filter(x=>x.due==z&&!x.done).map(x=>x.name);s+=`<div class="day ${z==today()?'today':''}"><b>${d}</b>${ev.map(x=>`<div class=event>${esc(x)}</div>`).join('')}</div>`}$('#page').innerHTML=`<div class=card><div style="display:flex;justify-content:space-between;align-items:center"><button onclick="month.setMonth(month.getMonth()-1);render()">←</button><h2>${month.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</h2><button onclick="month.setMonth(month.getMonth()+1);render()">→</button></div><div class=calendar>${s}</div></div>`}
function weekPage(){let s='';for(let i=0;i<7;i++){let d=new Date();d.setDate(d.getDate()+i);let z=iso(d),a=D.tasks.filter(x=>x.due==z&&!x.done);s+=`<div class=card><b>${d.toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'})}</b><p class=muted>${a.length?a.map(x=>esc(x.name)).join(' · '):'No tasks due'}</p></div>`}$('#page').innerHTML=s}
function plannerPage(){$('#page').innerHTML=`<div class=card chat><div id=msgs class=messages><div class="msg bot">I only change your schedule. Tell me a real change like “add soccer at 6 PM,” “practice was cancelled,” “I finished science,” or “add 30 minutes of math tomorrow.”</div></div><div class=chips><button class=chip data-q="What should I do first?">What first?</button><button class=chip data-q="Practice was cancelled">Practice cancelled</button><button class=chip data-q="Add 30 minutes of math tomorrow">Add task</button></div><div class=chatrow><input id=pi placeholder="Tell me what changed..."><button id=ps>Send</button></div></div>`;$('#ps').onclick=sendPlanner;$('#pi').onkeydown=e=>e.key==='Enter'&&sendPlanner();document.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{$('#pi').value=b.dataset.q;sendPlanner()})}
function addMsg(id,t,c){let b=$(id);b.insertAdjacentHTML('beforeend',`<div class="msg ${c}">${esc(t)}</div>`);b.scrollTop=b.scrollHeight}
function sendPlanner(){let i=$('#pi'),q=i.value.trim();if(!q)return;addMsg('#msgs',q,'user');i.value='';addMsg('#msgs',plannerAnswer(q.toLowerCase()),'bot');save()}
function cleanText(s){
  return s.toLowerCase()
    .replace(/[’']/g,"'")
    .replace(/\bpls\b/g,"please")
    .replace(/\bplz\b/g,"please")
    .replace(/\btho\b/g,"though")
    .replace(/\btho\b/g,"though")
    .replace(/\btmrw\b/g,"tomorrow")
    .replace(/\btom\b/g,"tomorrow")
    .replace(/\btonite\b/g,"tonight")
    .replace(/\btonight\b/g,"tonight")
    .replace(/\s+/g," ").trim();
}
function findBestTask(q){
  const words=cleanText(q).split(/[^a-z0-9]+/).filter(w=>w.length>2);
  let best=null,bestScore=0;
  D.tasks.forEach(x=>{
    const n=cleanText(x.name);
    let score=0;
    words.forEach(w=>{
      if(n.includes(w)) score += w.length>=5 ? 3 : 1;
    });
    if(score>bestScore){bestScore=score;best=x;}
  });
  return best;
}
function findBestCommitment(q){
  const words=cleanText(q).split(/[^a-z0-9]+/).filter(w=>w.length>2);
  let best=null,bestScore=0;
  D.commit.forEach(x=>{
    const n=cleanText(x.name||"");
    let score=0;
    words.forEach(w=>{if(n.includes(w))score+=w.length>=5?3:1});
    if(score>bestScore){bestScore=score;best=x;}
  });
  return best;
}
function parseMinutes(q){
  let m=q.match(/(\d+)\s*(?:hours?|hrs?)\s*(?:and\s*)?(\d+)?\s*(?:minutes?|mins?)?/);
  if(m)return (+m[1]*60)+(+m[2]||0);
  m=q.match(/(\d+)\s*(?:minutes?|mins?)/);
  return m?+m[1]:null;
}
function prettyName(q){
  let s=q.replace(/\b(add|put|schedule|create|make|a|an|task|for|me|please|pls|tomorrow|today|tonight)\b/gi," ")
    .replace(/\s+/g," ").trim();
  return s.charAt(0).toUpperCase()+s.slice(1);
}
function plannerAnswer(raw){
  const q=cleanText(raw);

  // Remove/cancel/delete commitments or tasks using loose natural language.
  const removeIntent=/\b(get rid of|remove|delete|cancel|drop|take off|take out|no more|i don't have|dont have|don't have|dnt have)\b/.test(q);
  if(removeIntent){
    const isSoccer=/\b(soccer|football|practice|training|game)\b/.test(q);
    const c=findBestCommitment(q);
    const t=findBestTask(q);

    if(isSoccer && D.commit.length){
      const matches=D.commit.filter(x=>/\b(soccer|football|practice|training|game)\b/i.test(x.name||""));
      if(matches.length){
        matches.forEach(x=>D.commit=D.commit.filter(c=>c!==x));
        save();
        return `Done — I removed ${matches.map(x=>x.name).join(", ")} from your commitments. Your schedule can now use that time.`;
      }
    }
    if(c){
      D.commit=D.commit.filter(x=>x!==c);
      save();
      return `Done — I removed ${c.name} from your commitments.`;
    }
    if(t){
      D.tasks=D.tasks.filter(x=>x!==t);
      save();
      return `Done — I removed the task “${t.name}.”`;
    }
    return "I understand that you want something removed. I just need the name of the practice, event, or task so I don't remove the wrong thing.";
  }

  // Finish/complete/mark done.
  if(/\b(finished|finish|done with|completed|complete|mark.*done|did)\b/.test(q)){
    const t=findBestTask(q);
    if(t){
      t.done=true; save();
      return `Done — I marked “${t.name}” complete.`;
    }
  }

  // Add a commitment such as soccer practice at 6 PM.
  const addCommit=/\b(add|put|schedule|i have|got)\b/.test(q) &&
    /\b(soccer|practice|training|game|club|appointment|doctor|meeting|class)\b/.test(q);
  if(addCommit){
    const timeMatch=q.match(/\b(?:at|@)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
    const nameMatch=q.match(/\b(soccer|football|practice|training|game|club|appointment|doctor|meeting|class)(?:\s+practice)?\b/);
    const name=nameMatch ? (nameMatch[0].replace(/\s+/g," ")) : prettyName(q);
    const time=timeMatch ? `${timeMatch[1]}${timeMatch[2]?":"+timeMatch[2]:""}${timeMatch[3]?" "+timeMatch[3].toUpperCase():""}` : "unspecified time";
    D.commit.push({name,time});
    save();
    return `Added ${name} at ${time}. I’ll treat it as a fixed commitment when planning around your tasks.`;
  }

  // Add a task in many forms: "add math tomorrow", "I need to do bio for 45 mins".
  const addTask=/\b(add|put|create|make|need to|i have to|gotta|have)\b/.test(q);
  if(addTask){
    const mins=parseMinutes(q)||30;
    const due=/\btomorrow\b/.test(q)?tomorrow():/\b(today|tonight)\b/.test(q)?today():today();
    let name=prettyName(q);
    name=name.replace(/\bfor\s+\d+\s*(?:minutes?|mins?|hours?|hrs?).*$/i,"").trim();
    if(name && !/^(please|something|it)$/i.test(name)){
      D.tasks.push({id:Date.now(),name,due,mins,p:2,done:false});
      save();
      return `Added “${name}” for ${mins} minutes ${due===tomorrow()?"tomorrow":"today"}.`;
    }
  }

  // "move X to tomorrow"
  if(/\b(move|push|shift)\b/.test(q) && /\btomorrow\b/.test(q)){
    const t=findBestTask(q);
    if(t){t.due=tomorrow();save();return `Done — I moved “${t.name}” to tomorrow.`;}
  }

  // Overloaded/busy language.
  if(/\btoo much|overwhelmed|swamped|packed|busy|no time\b/.test(q)){
    const open=D.tasks.filter(x=>!x.done).sort((a,b)=>a.due.localeCompare(b.due)||b.p-a.p);
    const total=open.reduce((n,x)=>n+x.mins,0);
    return open.length
      ? `You have ${open.length} unfinished task${open.length===1?"":"s"} totaling about ${total} minutes. Start with “${open[0].name}.” If you tell me how much time you have tonight, I can break the work into smaller blocks.`
      : "You don't have any unfinished tasks right now.";
  }

  // "what first", "what should I do"
  if(/\b(what first|what should i do|where do i start|what do i do first|which task)\b/.test(q)){
    const x=D.tasks.filter(x=>!x.done).sort((a,b)=>a.due.localeCompare(b.due)||b.p-a.p)[0];
    return x?`Start with “${x.name}.” It is due ${x.due} and takes about ${x.mins} minutes.`:"You have no unfinished tasks.";
  }

  if(/\b(help|how do i|can you)\b/.test(q)){
    return "Yes. You can talk normally — for example: “get rid of soccer practice,” “I finished math,” “move science to tomorrow,” “add 45 mins of history,” or “I’m slammed tonight.” I’ll interpret the request and update the plan when appropriate.";
  }

  return "I understand normal wording and common slang. Try telling me what changed in your day, such as “get rid of soccer practice,” “I’m done with math,” “move bio to tomorrow,” or “I only have 30 mins tonight.”";
}
function assistantPage(){$('#page').innerHTML=`<div class=assistant><div class=card chat><div id=amsgs class=messages><div class="msg bot">I’m the general StudentSchedule AI assistant. I can help with school questions, studying, brainstorming, planning, writing, and everyday student problems. I’ll explain things step-by-step when useful and use your saved tasks when relevant.<br><br>This is a local assistant built into the free website, so it is not a full cloud model like ChatGPT and has no live web access.</div></div><div class=chips><button class=chip data-aq="Help me plan tonight">Plan tonight</button><button class=chip data-aq="Give me a study strategy">Study strategy</button><button class=chip data-aq="What should I work on first?">What first?</button></div><div class=chatrow><input id=ai placeholder="Ask me anything..."><button id=as>Send</button></div></div><div class=card><h2>Assistant style</h2><p>Clear, practical, calm, student-focused, and step-by-step when needed.</p><p class=muted>Planner AI is kept separate so this assistant can answer general questions without accidentally changing your calendar.</p></div></div>`;$('#as').onclick=sendAI;$('#ai').onkeydown=e=>e.key==='Enter'&&sendAI();document.querySelectorAll('[data-aq]').forEach(b=>b.onclick=()=>{$('#ai').value=b.dataset.aq;sendAI()})}
function sendAI(){let i=$('#ai'),q=i.value.trim();if(!q)return;addMsg('#amsgs',q,'user');i.value='';addMsg('#amsgs',aiAnswer(q),'bot')}
function aiAnswer(q){
  const raw=q.trim(), l=cleanText(raw);
  if(!raw)return "Tell me what you need help with.";
  if(/\b(hi|hey|hello|yo|sup)\b/.test(l))return "Hey. What are you working on? You can type normally — slang and imperfect wording are fine.";
  if(/\b(who are you|what are you)\b/.test(l))return "I'm StudentSchedule's general AI Assistant. I'm built to explain things clearly, help with school and planning, and understand normal student wording. Planner AI is the separate chat that changes your schedule.";
  if(/\b(plan tonight|what should i do|what first|where do i start)\b/.test(l)){
    const open=D.tasks.filter(x=>!x.done).sort((a,b)=>a.due.localeCompare(b.due)||b.p-a.p);
    if(!open.length)return "You're caught up on your saved tasks.";
    return `Based on your saved plan, start with “${open[0].name}.” It is due ${open[0].due} and takes about ${open[0].mins} minutes. If you tell me how much time you have, I can help split it into blocks.`;
  }
  if(/\b(study|studying|test|exam|quiz)\b/.test(l))
    return "For studying, start with the topic you are least confident about. Do a few problems without notes, check your mistakes, write down what caused each mistake, and retry a similar problem. If you tell me the subject and topic, I can work through it with you.";
  if(/\b(schedule|homework|assignment|task)\b/.test(l))
    return "I can help organize it. Tell me what you have, when it is due, and roughly how long each thing takes. You don't need perfect wording.";
  return "I can work with normal language, slang, typos, and incomplete sentences. Tell me the goal or problem in your own words, and I'll help you work through it.";
}
document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>{page=b.dataset.page;render()});$('#add').onclick=()=>{$('#modal').classList.remove('hidden');$('#due').value=today()};$('#cancel').onclick=()=>$('#modal').classList.add('hidden');$('#save').onclick=()=>{let n=$('#name').value.trim();if(!n)return;D.tasks.push({id:Date.now(),name:n,due:$('#due').value||today(),mins:+$('#mins').value||30,p:+$('#pri').value,done:false});save();$('#modal').classList.add('hidden');render()};$('#trialBtn').onclick=()=>{if(!D.trial){D.trial=Date.now();save();$('#trialText').textContent='Pro trial active for 3 days.';$('#trialBtn').textContent='Trial Active'}else alert('After the 3-day trial, connect a parent/guardian payment checkout for Pro.')};render();