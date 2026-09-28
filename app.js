/*
 * STUDENTSCHEDULE AI — FREE AGENT
 * Everything in this file runs locally in the student's browser.
 * No API key. No server. No data transmission.
 *
 * Customize AGENT_RULES to change the product's behavior.
 */
const AGENT_RULES = {
  protectSleep: true,
  breakEveryMinutes: 50,
  breakLength: 10,
  maxSingleStudyBlock: 60,
  urgentDueHours: 24,
  priorities: {High: 3, Medium: 2, Low: 1}
};

const $ = s => document.querySelector(s);
const commitments = $("#commitments"), tasks = $("#tasks");

function addCommitment(v={}) {
  const x=document.createElement("div"); x.className="row commitment";
  x.innerHTML=`<label>What<input class="c-name" placeholder="Soccer practice" value="${v.name||""}"></label>
  <label>Day<input class="c-day" placeholder="Tue" value="${v.day||""}"></label>
  <label>Start<input class="c-start" type="time" value="${v.start||"17:00"}"></label>
  <label>End<input class="c-end" type="time" value="${v.end||"18:30"}"></label>
  <button class="remove">×</button>`;
  x.querySelector(".remove").onclick=()=>x.remove(); commitments.appendChild(x);
}
function addTask(v={}) {
  const x=document.createElement("div"); x.className="row task";
  x.innerHTML=`<label>Task<input class="t-name" placeholder="Math homework" value="${v.name||""}"></label>
  <label>Due<input class="t-due" placeholder="Tonight" value="${v.due||""}"></label>
  <label>Minutes<input class="t-min" type="number" min="5" max="600" value="${v.minutes||45}"></label>
  <label>Priority<select class="t-priority"><option ${v.priority==="High"?"selected":""}>High</option><option ${v.priority==="Medium"||!v.priority?"selected":""}>Medium</option><option ${v.priority==="Low"?"selected":""}>Low</option></select></label>
  <button class="remove">×</button>`;
  x.querySelector(".remove").onclick=()=>x.remove(); tasks.appendChild(x);
}
function timeToMin(t){let [h,m]=t.split(":").map(Number);return h*60+m}
function fmt(n){n=((n%1440)+1440)%1440;let h=Math.floor(n/60),m=n%60;let ap=h>=12?"PM":"AM";h=h%12||12;return `${h}:${String(m).padStart(2,"0")} ${ap}`}
function collect(){
 return {
  wake:timeToMin($("#wake").value), bed:timeToMin($("#bed").value),
  school:$("#school").value, day:$("#day").value,
  request:$("#request").value,
  commitments:[...document.querySelectorAll(".commitment")].map(x=>({name:x.querySelector(".c-name").value,day:x.querySelector(".c-day").value,start:timeToMin(x.querySelector(".c-start").value),end:timeToMin(x.querySelector(".c-end").value)})).filter(x=>x.name),
  tasks:[...document.querySelectorAll(".task")].map(x=>({name:x.querySelector(".t-name").value,due:x.querySelector(".t-due").value,minutes:Math.max(5,Number(x.querySelector(".t-min").value)||5),priority:x.querySelector(".t-priority").value})).filter(x=>x.name)
 };
}

function blockedIntervals(c){
 const arr=c.commitments.filter(x=>!x.day || /today/i.test(x.day) || x.day.toLowerCase().includes(c.day.toLowerCase().slice(0,3))).map(x=>[x.start,x.end,x.name]);
 // Treat school hours as a fixed block only if they resemble a normal school day.
 if(c.school) arr.push([480,930,"School"]);
 return arr.sort((a,b)=>a[0]-b[0]);
}
function freeSlots(c){
 const blocked=blockedIntervals(c), slots=[]; let cursor=Math.max(c.wake,0), end=c.bed;
 for(const [s,e,n] of blocked){
   if(s>cursor) slots.push([cursor,Math.min(s,end)]);
   cursor=Math.max(cursor,e);
 }
 if(cursor<end) slots.push([cursor,end]);
 // Protect early morning before school if wake time is unusually early; user can still use it.
 return slots.filter(x=>x[1]-x[0]>=10);
}
function score(t){
 let s=AGENT_RULES.priorities[t.priority]||2;
 const d=t.due.toLowerCase();
 if(/today|tonight|tomorrow|now/.test(d))s+=4;
 if(/monday|tuesday|wednesday|thursday|friday|saturday|sunday/.test(d))s+=1;
 return s;
}
function buildPlan(c){
 let slots=freeSlots(c), work=[...c.tasks].sort((a,b)=>score(b)-score(a));
 let lines=[], warnings=[], used=0, breaks=0;
 for(let t of work){
   let remaining=t.minutes, placed=false;
   for(let i=0;i<slots.length && remaining>0;i++){
     let [a,b]=slots[i];
     if(b-a<15)continue;
     let chunk=Math.min(remaining,AGENT_RULES.maxSingleStudyBlock,b-a);
     if(chunk<15)continue;
     let start=a,end=a+chunk;
     lines.push({start,end,name:t.name,detail:`${t.priority} priority • due ${t.due||"unspecified"}`});
     used+=chunk; remaining-=chunk; placed=true;
     slots[i][0]=end;
     if(remaining>0 && end+AGENT_RULES.breakLength< b){
       slots[i][0]=end+AGENT_RULES.breakLength;
       breaks++; 
     }
   }
   if(!placed || remaining>0) warnings.push(`${t.name}: ${remaining} minutes could not fit realistically.`);
 }
 lines.sort((a,b)=>a.start-b.start);
 let out=`KEY CONSTRAINTS\nWake: ${fmt(c.wake)}\nBedtime: ${fmt(c.bed)}\nSchool: ${c.school}\n\nRECOMMENDED SCHEDULE\n`;
 if(!lines.length) out+="No homework blocks could be scheduled. Add tasks or check your fixed commitments.\n";
 for(const x of lines) out+=`${fmt(x.start)}–${fmt(x.end)}  ${x.name}\n    ${x.detail}\n`;
 if(breaks) out+=`\nBreaks: ${breaks} short break${breaks===1?"":"s"} are built between work blocks.\n`;
 out+=`\nTOP PRIORITIES\n`;
 work.slice(0,3).forEach((x,i)=>out+=`${i+1}. ${x.name} — ${x.priority} priority, due ${x.due||"unspecified"}\n`);
 if(warnings.length) out+=`\nWHAT DOESN'T FIT\n${warnings.join("\n")}\n\nIf this happens repeatedly, move lower-priority work earlier or talk with a parent/teacher about the workload.`;
 else out+=`\nEverything entered fits into the available time.`;
 return out;
}
function answer(q,c){
 q=q.toLowerCase();
 if(/first|priorit|what should i do/.test(q)){
   const t=[...c.tasks].sort((a,b)=>score(b)-score(a))[0];
   return t?`Start with "${t.name}" because it has the strongest urgency/priority combination. Then move to the next-highest priority task.`:"Add your homework/tasks first, and I can prioritize them.";
 }
 if(/45|30|20|60|minutes/.test(q)){
   const n=(q.match(/(\d+)\s*minutes?/)||[])[1];
   if(n){let sorted=[...c.tasks].sort((a,b)=>score(b)-score(a));return `With ${n} minutes, choose the highest-priority task and work on it for ${Math.min(Number(n),AGENT_RULES.maxSingleStudyBlock)} minutes. If there are several tasks, split the time rather than starting everything.`}
 }
 if(/sleep|bed/.test(q))return `Your target bedtime is ${fmt(c.bed)}. The planner treats that as a protected boundary, so unfinished work should be moved earlier or discussed rather than automatically pushing bedtime later.`;
 if(/overload|too much|can't|cannot|impossible/.test(q))return `If everything does not fit, do not simply remove sleep. Finish the most urgent/high-priority work, defer lower-priority work, and consider asking a teacher or parent about deadlines or workload.`;
 return `I can help prioritize tasks, protect your sleep, and fit homework around fixed commitments. Try asking "What should I do first?" or "I only have 45 minutes."`;
}

$("#addCommitment").onclick=()=>addCommitment();
$("#addTask").onclick=()=>addTask();
$("#generate").onclick=()=>{$("#result").textContent=buildPlan(collect())};

$("#ask").onclick=()=>{
 const q=$("#chatInput").value.trim(); if(!q)return;
 const c=collect(); addBubble("user",q); addBubble("bot",answer(q,c)); $("#chatInput").value="";
};
$("#chatInput").addEventListener("keydown",e=>{if(e.key==="Enter")$("#ask").click()});
function addBubble(type,text){let d=document.createElement("div");d.className="bubble "+type;d.textContent=text;$("#chat").appendChild(d)}

$("#demo").onclick=()=>{
 $("#wake").value="04:50"; $("#bed").value="22:00"; $("#school").value="8:00 AM–3:30 PM"; $("#day").value="Today";
 commitments.innerHTML=""; tasks.innerHTML="";
 addCommitment({name:"Morning soccer",day:"Today",start:"05:00",end:"07:00"});
 addCommitment({name:"Tabla",day:"Today",start:"19:00",end:"20:00"});
 addTask({name:"Math homework",due:"Tonight",minutes:45,priority:"High"});
 addTask({name:"Science review",due:"Friday",minutes:30,priority:"Medium"});
 $("#request").value="Make a realistic plan and protect my sleep.";
};
addCommitment(); addTask();
