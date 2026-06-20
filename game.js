const $=id=>document.getElementById(id),role=document.body.dataset.role,ROOM='ts-',WORDS='Banana Volcano Robot Pancake Dragon Pickle Moon Castle Pizza Ghost Wizard Cactus Dinosaur Taco Mermaid Spaceship Yeti Trombone Donut Shark Unicorn Lighthouse Burrito Sloth Meteor Sandwich Pirate Teapot Giraffe Crown Jellyfish Tractor Sock Magnet Koala Backpack Snowman Hotdog Octopus Chair Pumpkin Ninja Waffle Whale Guitar Hammer Flamingo Telescope Cupcake Penguin'.split(' ');
let peer,host,me,conn,players=[],booklets=[],phase='lobby',step=0,answers={},picked='',strokes=[],drawing=false,rev=0,revStep=0;
const code=()=>Math.random().toString(36).replace(/[^a-z]+/g,'').slice(0,4).toUpperCase(),esc=s=>(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])),send=(c,t,d={})=>c&&c.open&&c.send({t,...d}),broadcast=(t,d={})=>players.forEach(p=>send(p.c,t,d));
if(role=='host') bootHost(); else bootPlayer();
function bootHost(){
  let room=code(); $('code').textContent=room; let url=new URL('player.html',location.href); url.searchParams.set('room',room); $('joinUrl').textContent=url.href;
  new QRCode($('qr'),{text:url.href,width:190,height:190}); peer=new Peer(ROOM+room);
  peer.on('connection',c=>{c.on('data',m=>onHost(c,m)); c.on('close',()=>drop(c));});
  $('start').onclick=startGame; $('prev').onclick=()=>showReveal(-1); $('next').onclick=()=>showReveal(1); $('restart').onclick=resetGame;
}
function onHost(c,m){switch(m.t){
  case'join': if(phase!='lobby')return send(c,'err',{msg:'Game already started'}); if(!players.find(p=>p.c==c)){players.push({id:c.peer,name:esc(m.name||'Player'),c}); c.on('close',()=>drop(c));} send(c,'joined',{players:pubPlayers()}); updateLobby(); broadcast('lobby',{players:pubPlayers()}); break;
  case'answer': if(!players[m.i]||players[m.i].c!=c||answers[m.i])return; answers[m.i]=m.v; checkAnswers(); break;
}}
function drop(c){players=players.filter(p=>p.c!=c); updateLobby(); if(phase=='lobby')broadcast('lobby',{players:pubPlayers()});}
function pubPlayers(){return players.map((p,i)=>({i,name:p.name}));}
function updateLobby(){$('players').innerHTML=players.map(p=>`<li>${p.name}</li>`).join(''); $('start').hidden=!players.length;}
function startGame(){phase='prompt'; step=0; booklets=[]; players.forEach((p,i)=>p.i=i); answers={}; $('lobby').hidden=1; $('reveal').hidden=1; $('play').hidden=0; $('phase').textContent='Secret prompts'; count(); players.forEach(p=>send(p.c,'prompt',{i:p.i,players:pubPlayers()}));}
function checkAnswers(){
  count(); if(Object.keys(answers).length<players.length)return;
  if(phase=='prompt')booklets=players.map((p,i)=>({owner:i,ownerName:p.name,entries:[{kind:'prompt',by:i,byName:p.name,v:answers[i]}]}));
  else {booklets.forEach((b,bi)=>{let by=(b.owner+step)%players.length,bn=players[by].name,last=b.entries[b.entries.length-1]; b.entries.push({kind:last.kind=='draw'?'guess':'draw',by,byName:bn,v:answers[by][bi]});}); step++;}
  if(step>=players.length)return reveal();
  answers={}; phase='round'; $('phase').textContent=`Round ${step+1} of ${players.length}`; count();
  players.forEach((p,i)=>{let tasks={}; booklets.forEach((b,bi)=>{if((b.owner+step)%players.length==i)tasks[bi]=b.entries[b.entries.length-1];}); send(p.c,'task',{i,step,tasks});});
}
function count(){let n=Object.keys(answers).length; $('count').textContent=`${n}/${players.length} submitted`;}
function reveal(){phase='reveal'; broadcast('done'); $('play').hidden=1; $('reveal').hidden=0; rev=revStep=0; showReveal(0);}
function resetGame(){phase='lobby'; step=rev=revStep=0; answers={}; booklets=[]; $('reveal').hidden=1; $('play').hidden=1; $('lobby').hidden=0; updateLobby(); broadcast('reset',{players:pubPlayers()});}
function showReveal(d){let b=booklets[rev]; if(d){revStep+=d; if(revStep<0&&rev>0){rev--;revStep=booklets[rev].entries.length-1} if(revStep>=b.entries.length&&rev<booklets.length-1){rev++;revStep=0} revStep=Math.max(0,Math.min(revStep,booklets[rev].entries.length-1)); b=booklets[rev];}
  let e=b.entries[revStep]; $('revTitle').textContent=`${b.ownerName}'s booklet`; $('revStep').textContent=`${rev+1}/${booklets.length} · ${revStep+1}/${b.entries.length} · ${e.byName}`;
  $('revBody').innerHTML=e.kind=='draw'?`<img src="${e.v}" alt="drawing">`:`<div class="muted">${e.kind=='prompt'?'Original prompt':'Guess'}</div><div class="bigText">${esc(e.v)}</div>`;
}
function bootPlayer(){
  $('room').value=(new URLSearchParams(location.search).get('room')||'').toUpperCase(); $('joinBtn').onclick=join;
}
function join(){
  let room=$('room').value.trim().toUpperCase(),name=$('name').value.trim()||'Player'; if(room.length!=4)return err('Enter a 4-letter room code');
  peer=new Peer(); peer.on('open',()=>{conn=peer.connect(ROOM+room,{reliable:true}); conn.on('open',()=>send(conn,'join',{name})); conn.on('data',onPlayer); conn.on('close',()=>err('Disconnected'));});
}
function err(s){$('err').textContent=s;}
function onPlayer(m){switch(m.t){
  case'err': err(m.msg); break;
  case'joined': $('join').hidden=1; $('wait').hidden=0; break;
  case'lobby': break;
  case'prompt': me=m.i; promptUI(); break;
  case'task': me=m.i; taskUI(m.tasks); break;
  case'done': $('task').hidden=1; $('wait').hidden=0; $('waitMsg').textContent='Reveal time. Look at the host screen!'; break;
  case'reset': $('task').hidden=1; $('wait').hidden=0; $('waitMsg').textContent='Waiting for host to start...'; break;
}}
function showTask(title,html){$('wait').hidden=1; $('task').hidden=0; $('taskTitle').textContent=title; $('taskBody').innerHTML=html; $('submit').disabled=0;}
function promptUI(){let w=[...WORDS].sort(()=>Math.random()-.5).slice(0,6); showTask('Pick a secret prompt',`<div class="words">${w.map(x=>`<button type="button">${x}</button>`).join('')}</div><textarea id="custom" placeholder="Or type your own"></textarea>`); picked=''; [...document.querySelectorAll('.words button')].forEach(b=>b.onclick=()=>{picked=b.textContent; document.querySelectorAll('.words button').forEach(x=>x.classList.toggle('pick',x==b));}); $('submit').onclick=()=>submit(($('custom').value.trim()||picked));}
function taskUI(tasks){let id=Object.keys(tasks)[0],last=tasks[id]; if(last.kind=='draw')guessUI(id,last.v); else drawUI(id,last.v);}
function submit(v){if(!v)return; $('submit').disabled=1; send(conn,'answer',{i:me,v}); $('task').hidden=1; $('wait').hidden=0; $('waitMsg').textContent='Submitted. Waiting for the others...';}
function guessUI(id,img){showTask('What is this?',`<img class="guessImg" src="${img}" alt="drawing"><textarea id="guess" placeholder="Your guess"></textarea>`); $('submit').onclick=()=>{let v=$('guess').value.trim(); if(v)submit({[id]:v});};}
function drawUI(id,text){showTask('Draw this',`<div class="bigText">${esc(text)}</div><canvas id="can" class="draw" width="800" height="600"></canvas><div class="tools"><button id="undo" type="button">Undo</button><button id="clear" type="button">Clear</button></div>`); canvas(); $('undo').onclick=()=>{strokes.pop(); redraw();}; $('clear').onclick=()=>{strokes=[]; redraw();}; $('submit').onclick=()=>submit({[id]:$('can').toDataURL('image/png')});}
function canvas(){let c=$('can'),x=c.getContext('2d'); strokes=[]; x.lineCap=x.lineJoin='round'; x.lineWidth=7; x.strokeStyle='#000'; const p=e=>{let r=c.getBoundingClientRect(),t=e.touches?e.touches[0]:e; return[(t.clientX-r.left)*c.width/r.width,(t.clientY-r.top)*c.height/r.height];}; const down=e=>{e.preventDefault(); drawing=1; strokes.push([p(e)]); redraw();}; const move=e=>{if(!drawing)return; e.preventDefault(); strokes[strokes.length-1].push(p(e)); redraw();}; c.onmousedown=c.ontouchstart=down; c.onmousemove=c.ontouchmove=move; addEventListener('mouseup',()=>drawing=0); addEventListener('touchend',()=>drawing=0); redraw();}
function redraw(){let c=$('can'),x=c.getContext('2d'); x.clearRect(0,0,c.width,c.height); strokes.forEach(s=>{x.beginPath(); s.forEach((p,i)=>i?x.lineTo(...p):x.moveTo(...p)); x.stroke();});}
