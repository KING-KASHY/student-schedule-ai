const $=s=>document.querySelector(s);
const todayISO=()=>{const d=new Date();return d.toISOString().slice(0,10)};
let data=JSON.parse(localStorage.getItem("ssa_data")||"null")||{
 tasks:[
  {id:1,name:"Math homework",due:todayISO(),minutes:45,priority:3,done:false},
  {id:2,name:"Science reading",due:todayISO(),minutes:30,priority:2,done:false},
  {id:3,name:"History notes",due:new Date(Date.now()+86400000).toISOString().slice(0,10),minutes:35,priority:2,done:false}
 ],
 commitments:[
  {date:todayISO(),time:"18:00",name:"Soccer practice"},
  {date:todayISO(),time:"20:00",name:"Tabla"}
 ], settings:{wake:"06:00",sleep:"22:30",schoolStart:"08:00",schoolEnd:"15:30"}
};
let page="today", calDate=new Date();
const save=()=>localStorage.setItem("ssa_data",JSON.stringify(data));
const fmt=d=>new Date(d+"T12:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric"});
function render(){
 const titles={today:["Today","Your plan, without the guesswork."],calendar:["Calendar","See your month at a glance."],tasks:["Tasks","Assignments automatically adapt to your deadlines."],week:["Week","Your next seven days."],planner:["Planner AI","Tell the planner what changed. The chatbot edits your plan."],settings:["Settings","Tell StudentSchedule how your day actually works."]};
 $("#title").textContent=titles[page][0];$("#subtitle").textContent=titles[page][1];
 document.querySelectorAll(".nav").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
 if(page==="today") today(); if(page==="calendar") calendar(); if(page==="tasks") tasks(); if(page==="week") week(); if(page==="planner") planner(); if(page==="settings") settings();
}
function today(){
 const t=todayISO(), due=data.tasks.filter(x=>!x.done).sort((a,b)=>(a.due>b.due?1:-1)||b.priority-a.priority);
 $("#page").innerHTML=`<div class="grid"><div class="card"><div class="muted">Open tasks</div><div class="stat">${due.length}</div></div><div class="card"><div class="muted">Due today</div><div class="stat">${due.filter(x=>x.due===t).length}</div></div><div class="card"><div class="muted">Workload</div><div class="stat">${due.reduce((a,x)=>a+x.minutes,0)}m</div></div></div><div class="card"><h2>Today's priorities</h2>${due.slice(0,6).map(taskHTML).join("")||"<p class=muted>Nothing left. You're clear.</p>"}</div><div class="card"><h2>Today's commitments</h2>${data.commitments.filter(x=>x.date===t).map(c=>`<div class=task><span>${c.time} — ${c.name}</span></div>`).join("")||"<p class=muted>No fixed commitments today.</p>"}</div>`;
}
function taskHTML(x){return `<div class="task"><div><b>${x.name}</b><div class="muted">${fmt(x.due)} · ${x.minutes} min · ${x.priority===3?"High":x.priority===2?"Normal":"Low"}</div></div><button onclick="done(${x.id})">${x.done?"Done":"Complete"}</button></div>`}
function tasks(){
 $("#page").innerHTML=`<div class="card"><h2>Assignments</h2>${data.tasks.sort((a,b)=>a.done-b.done||a.due.localeCompare(b.due)).map(taskHTML).join("")}</div>`;
}
function done(id){const x=data.tasks.find(t=>t.id===id);if(x){x.done=!x.done;save();render()}}
function calendar(){
 const y=calDate.getFullYear(),m=calDate.getMonth(), first=new Date(y,m,1), days=new Date(y,m+1,0).getDate(), start=first.getDay();
 let cells=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(x=>`<div class=dow>${x}</div>`).join("");
 for(let i=0;i<start;i++)cells+=`<div class=day></div>`;
 for(let d=1;d<=days;d++){const iso=`${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`, ev=[...data.tasks.filter(x=>x.due===iso&&!x.done).map(x=>x.name),...data.commitments.filter(x=>x.date===iso).map(x=>x.name)];cells+=`<div class="day ${iso===todayISO()?"today":""}"><div class=num>${d}</div>${ev.slice(0,4).map(e=>`<div class=event>${e}</div>`).join("")}</div>`}
 $("#page").innerHTML=`<div class=card><div class=calendar-head><button onclick="moveMonth(-1)">←</button><h2>${calDate.toLocaleDateString(undefined,{month:"long",year:"numeric"})}</h2><div><button onclick="calDate=new Date();render()">Today</button> <button onclick="moveMonth(1)">→</button></div></div><div class=calendar>${cells}</div></div>`;
}
function moveMonth(n){calDate=new Date(calDate.getFullYear(),calDate.getMonth()+n,1);render()}
function week(){
 let out="";for(let i=0;i<7;i++){let d=new Date();d.setDate(d.getDate()+i);let iso=d.toISOString().slice(0,10), ts=data.tasks.filter(x=>x.due===iso&&!x.done);out+=`<div class=card><b>${d.toLocaleDateString(undefined,{weekday:"long",month:"short",day:"numeric"})}</b><div class=muted>${ts.length?ts.map(x=>x.name).join(" · "):"No tasks due"}</div></div>`}
 $("#page").innerHTML=out;
}
function planner(){
 $("#page").innerHTML=`<div class="card chat"><div id=messages class=messages><div class="msg bot">I’m your scheduling assistant. Tell me what changed and I’ll update your tasks or commitments.<br><br>Try: “I have soccer at 6 PM today”, “add 30 minutes of biology for tomorrow”, “science is finished”, or “practice was cancelled”.</div></div><div class=chatrow><input id=chatInput placeholder="Tell me what changed..."><button class=primary id=send>Send</button></div></div>`;
 $("#send").onclick=sendChat;$("#chatInput").onkeydown=e=>{if(e.key==="Enter")sendChat()};
}
function sendChat(){
 const input=$("#chatInput"), q=input.value.trim();if(!q)return;
 addMsg(q,"user");input.value="";
 let r=process(q.toLowerCase());addMsg(r,"bot");save();
}
function addMsg(t,c){const box=$("#messages");if(!box)return;box.insertAdjacentHTML("beforeend",`<div class="msg ${c}">${t}</div>`);box.scrollTop=box.scrollHeight}
function process(q){
 if(q.includes("cancel")&&q.includes("practice")){data.commitments=data.commitments.filter(c=>!(c.name.toLowerCase().includes("soccer")&&c.date===todayISO()));return"Done. I cancelled today's soccer commitment and updated your plan."}
 const finish=data.tasks.find(t=>q.includes(t.name.toLowerCase())&&(q.includes("finish")||q.includes("done")||q.includes("completed")));
 if(finish){finish.done=true;return`Done. I marked ${finish.name} complete.`}
 const add=q.match(/(?:add|create)\s+(?:a\s+)?(\d+)\s*(?:min|minutes?)\s+(?:of\s+)?(.+?)(?:\s+for\s+tomorrow|\s+tomorrow)?$/);
 if(add){let due=q.includes("tomorrow")?new Date(Date.now()+86400000).toISOString().slice(0,10):todayISO();data.tasks.push({id:Date.now(),name:add[2].trim(),due,minutes:+add[1],priority:2,done:false});return`Added ${add[2].trim()} for ${fmt(due)} (${add[1]} minutes).`}
 const soccer=q.match(/(?:soccer|practice).*?(\d{1,2})(?::(\d\d))?\s*(am|pm)?/);
 if(soccer){let h=+soccer[1],min=+(soccer[2]||0);if((soccer[3]||"").toLowerCase()==="pm"&&h<12)h+=12;data.commitments.push({date:todayISO(),time:`${String(h).padStart(2,"0")}:${String(min).padStart(2,"0")}`,name:"Soccer practice"});return"Added soccer practice to today's commitments. Your calendar and priorities are updated."}
 if(q.includes("what should")||q.includes("priorit")){let t=data.tasks.filter(x=>!x.done).sort((a,b)=>a.due.localeCompare(b.due)||b.priority-a.priority)[0];return t?`Start with ${t.name}. It is due ${fmt(t.due)} and takes about ${t.minutes} minutes.`:"You have no unfinished tasks."}
 return"Tell me a specific change, such as adding an assignment, finishing one, moving a commitment, or cancelling practice. I’ll update the planner when I can identify the change.";
}
function settings(){
 $("#page").innerHTML=`<div class="card settings"><h2>Your schedule settings</h2><label>Wake time</label><input id=wake type=time value="${data.settings.wake}"><label>Bedtime</label><input id=sleep type=time value="${data.settings.sleep}"><label>School starts</label><input id=ss type=time value="${data.settings.schoolStart}"><label>School ends</label><input id=se type=time value="${data.settings.schoolEnd}"><br><br><button class=primary onclick="saveSettings()">Save settings</button></div>`;
}
function saveSettings(){data.settings={wake:$("#wake").value,sleep:$("#sleep").value,schoolStart:$("#ss").value,schoolEnd:$("#se").value};save();alert("Settings saved.");}
$("#quickAdd").onclick=()=>{$("#modal").classList.remove("hidden");$("#taskDue").value=todayISO()};
$("#cancel").onclick=()=>$("#modal").classList.add("hidden");
$("#saveTask").onclick=()=>{let n=$("#taskName").value.trim();if(!n)return;data.tasks.push({id:Date.now(),name:n,due:$("#taskDue").value||todayISO(),minutes:+$("#taskMinutes").value||30,priority:+$("#taskPriority").value,done:false});save();$("#modal").classList.add("hidden");$("#taskName").value="";render()};
document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>{page=b.dataset.page;render()});
$("#trialBtn").onclick=()=>{localStorage.setItem("ssa_trial",String(Date.now()));updateTrial()};
function updateTrial(){let s=localStorage.getItem("ssa_trial");if(!s){$("#trialText").textContent="Try all Pro planning features.";$("#trialBtn").textContent="Start Free Trial";return}let left=3-(Date.now()-+s)/86400000;if(left>0){$("#trialText").textContent=`Pro trial: ${Math.ceil(left)} day${Math.ceil(left)==1?"":"s"} left.`;$("#trialBtn").textContent="Pro Trial Active"}else{$("#trialText").textContent="Your 3-day trial has ended. Continue with Pro for $3/month.";$("#trialBtn").textContent="Continue with Pro";$("#trialBtn").onclick=()=>alert("Connect your parent/guardian's Stripe Payment Link here.")}}
updateTrial();setInterval(updateTrial,60000);render();
