const $=id=>document.getElementById(id),role=document.body.dataset.role,ROOM='nb-',WORDS='Banana Volcano Robot Pancake Dragon Pickle Moon Castle Pizza Ghost Wizard Cactus Dinosaur Taco Mermaid Spaceship Yeti Trombone Donut Shark Unicorn Lighthouse Burrito Sloth Meteor Sandwich Pirate Teapot Giraffe Crown Jellyfish Tractor Sock Magnet Koala Backpack Snowman Hotdog Octopus Chair Pumpkin Ninja Waffle Whale Guitar Hammer Flamingo Telescope Cupcake Penguin'.split(' ');
let mqttClient,myId,room,me,players=[],booklets=[],phase='lobby',step=0,answers={},picked='',strokes=[],drawing=false,rev=0,revStep=0,rg=null,errMsg='',deadline=0,totalTime=0,currentColor='#000000';
const code=()=>Math.random().toString(36).replace(/[^a-z]+/g,'').slice(0,4).toUpperCase(),esc=s=>(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])),send=(id,t,d={})=>mqttClient&&mqttClient.publish(`nk/${room}/p/${id}`,JSON.stringify({t,...d})),broadcast=(t,d={})=>mqttClient&&mqttClient.publish(`nk/${room}/all`,JSON.stringify({t,...d})),sendToHost=(t,d={})=>mqttClient&&mqttClient.publish(`nk/${room}/h`,JSON.stringify({id:myId,t,...d})),K=(x,y)=>x+','+y,D=[[1,0],[0,1],[1,1],[1,-1]];
if(role=='host') bootHost(); else bootPlayer();
function bootHost(){
  console.log('[HOST] Booting host...');
  room=localStorage.getItem('nk_room'); if(!room){room=code();localStorage.setItem('nk_room',room); console.log('[HOST] Generated new room:', room);}else{console.log('[HOST] Loaded existing room:', room);}
  $('code').textContent=room; let url=new URL('player.html',location.href); url.searchParams.set('room',room); $('joinUrl').textContent=url.href;
  new QRCode($('qr'),{text:url.href,width:190,height:190}); 
  console.log('[HOST] Connecting to MQTT...');
  mqttClient=mqtt.connect('wss://broker.emqx.io:8084/mqtt');
  mqttClient.on('connect', () => {
    console.log('[HOST] MQTT connected! Subscribing to:', `nk/${room}/h`);
    mqttClient.subscribe(`nk/${room}/h`);
  });
  mqttClient.on('message', (topic, payload) => {
    try { onHost(JSON.parse(payload.toString())); } catch(e){}
  });
  mqttClient.on('error', e => {
    console.error('[HOST] MQTT Error:', e);
    $('code').textContent='ERR: MQTT';
  });
  $('start').onclick=startGame; $('ringo').onclick=startRingo; $('prev').onclick=()=>showReveal(-1); $('next').onclick=()=>showReveal(1); $('restart').onclick=home;
  $('newRoomBtn').onclick=()=>{console.log('[HOST] New Room clicked'); localStorage.removeItem('nk_room');location.reload();};
  setInterval(() => {
    if (role == 'host' && phase == 'round' && deadline && Date.now() > deadline) {
      deadline = 0;
      players.forEach(p => {
        if (!answers[p.i]) {
          let tasks = {}; booklets.forEach((b,bi) => { if((b.owner+step)%players.length==p.i) tasks[bi] = ''; });
          answers[p.i] = tasks;
        }
      });
      checkAnswers();
    }
  }, 1000);
}
function cleanState(i) {
  let tasks={}; if(phase=='round') booklets.forEach((b,bi)=>{if((b.owner+step)%players.length==i)tasks[bi]=b.entries[b.entries.length-1];});
  return {phase, step, deadline, tasks, i, names:pubPlayers()};
}
function kickPlayer(id) { send(id, 'kicked'); drop(id); }
function onHost(m){switch(m.t){
  case'join': if(phase!='lobby'){
      return send(m.id,'err',{msg:'Game already started.'});
    }
    if(!players.find(p=>p.id==m.id)){players.push({id:m.id,name:esc(m.name||'Player')});} send(m.id,'joined',{players:pubPlayers()}); updateLobby(); broadcast('lobby',{players:pubPlayers()}); break;
  case'sync_req': 
    let p=players.find(x=>x.id==m.id); 
    if(p){ send(m.id,'sync_res',cleanState(p.i)); break; }
    send(m.id,'sync_res',{phase, names:pubPlayers()});
    break;
  case'claim_player':
    let claimP = players[m.i];
    if (claimP && claimP.id != m.id) {
      send(claimP.id, 'kicked');
      claimP.id = m.id;
      if (phase!='lobby') send(m.id,'sync_res',cleanState(m.i));
      else { send(m.id,'joined',{players:pubPlayers()}); updateLobby(); broadcast('lobby',{players:pubPlayers()}); }
    }
    break;
  case'answer': if(!players[m.i]||players[m.i].id!=m.id||answers[m.i])return; answers[m.i]=m.v; checkAnswers(); break;
  case'ringo': ringoTap(m.id,m); break;
}}
function drop(id){players=players.filter(p=>p.id!=id); updateLobby(); if(phase=='lobby')broadcast('lobby',{players:pubPlayers()});}
function pubPlayers(){return players.map((p,i)=>({i,name:p.name}));}
function updateBanner() {
  let b = $('host-banner'); if(!b) return;
  b.hidden = phase == 'lobby' && !players.length;
  let codeEl = $('banner-code'); if(codeEl) codeEl.textContent = room;
  let playersEl = $('banner-players'); if(playersEl) playersEl.innerHTML = players.map(p=>`<li>${p.name}</li>`).join('');
}
function updateLobby(){$('players').innerHTML=players.map(p=>`<li class="player-item" onclick="kickPlayer('${p.id}')" title="Click to kick">${p.name}</li>`).join(''); $('games').hidden=!players.length; $('ringo').disabled=players.length<2; updateBanner();}
function home(){phase='lobby'; step=rev=revStep=0; answers={}; booklets=[]; rg=null; errMsg=''; $('phase').className=''; $('reveal').hidden=1; $('play').hidden=1; $('lobby').hidden=0; $('hostBoard').innerHTML=''; updateLobby(); broadcast('home',{players:pubPlayers()});}
function startGame(){phase='prompt'; step=0; deadline=0; booklets=[]; players.forEach((p,i)=>p.i=i); answers={}; $('phase').className=''; $('lobby').hidden=1; $('reveal').hidden=1; $('play').hidden=0; $('hostBoard').innerHTML=''; $('phase').textContent='Telesketch: secret prompts'; count(); players.forEach(p=>send(p.id,'prompt',{i:p.i,players:pubPlayers(),deadline})); updateBanner();}
function checkAnswers(){
  count(); if(Object.keys(answers).length<players.length)return;
  deadline = 0;
  if(phase=='prompt')booklets=players.map((p,i)=>({owner:i,ownerName:p.name,entries:[{kind:'prompt',by:i,byName:p.name,v:answers[i]}]}));
  else {booklets.forEach((b,bi)=>{let by=(b.owner+step)%players.length,bn=players[by].name,last=b.entries[b.entries.length-1]; b.entries.push({kind:last.kind=='draw'?'guess':'draw',by,byName:bn,v:answers[by]?answers[by][bi]:''});}); step++;}
  if(step>=players.length)return reveal();
  answers={}; phase='round'; $('phase').textContent=`Telesketch: round ${step+1} of ${players.length}`; count();
  let nextIsDraw = booklets[0].entries[booklets[0].entries.length-1].kind != 'draw';
  deadline = Date.now() + (nextIsDraw ? 60000 : 30000);
  players.forEach((p,i)=>{let tasks={}; booklets.forEach((b,bi)=>{if((b.owner+step)%players.length==i)tasks[bi]=b.entries[b.entries.length-1];}); send(p.id,'task',{i,step,tasks,deadline});});
}
function count(){let n=Object.keys(answers).length; $('count').textContent=`${n}/${players.length} submitted`;}
function reveal(){phase='reveal'; broadcast('done'); $('play').hidden=1; $('reveal').hidden=0; rev=revStep=0; showReveal(0);}
function showReveal(d){let b=booklets[rev]; if(d){revStep+=d; if(revStep<0&&rev>0){rev--;revStep=booklets[rev].entries.length-1} if(revStep>=b.entries.length&&rev<booklets.length-1){rev++;revStep=0} revStep=Math.max(0,Math.min(revStep,booklets[rev].entries.length-1)); b=booklets[rev];}
  let e=b.entries[revStep]; $('revTitle').textContent=`${b.ownerName}'s booklet`; $('revStep').textContent=`${rev+1}/${booklets.length} · ${revStep+1}/${b.entries.length} · ${e.byName}`;
  $('revBody').innerHTML=e.kind=='draw'?`<img src="${e.v}" alt="drawing">`:`<div class="muted">${e.kind=='prompt'?'Original prompt':'Guess'}</div><div class="bigText">${esc(e.v)}</div>`;
}

function startRingo(){
  if(players.length<2)return; phase='ringo'; errMsg=''; let a=[...players.keys()].sort(()=>Math.random()-.5).slice(0,2),cs='rrrrbbbb'.split('').sort(()=>Math.random()-.5),xy=[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
  rg={b:xy.map((p,i)=>({x:p[0],y:p[1],r:cs[i],d:''})),duel:a,turn:a[Math.random()<.5?0:1],phase:'disc',pick:null,win:null};
  $('lobby').hidden=1; $('reveal').hidden=1; $('play').hidden=0; ringoSync();
}
function ringoSync(){
  let names=rg.duel.map((i,n)=>players[i].name+' '+(n?'Blue':'Red')); $('phase').className=rg.win?'flash':''; $('phase').textContent=rg.win?`${players[rg.win.i].name} wins Ringo by ${rg.win.k}!`:'Ringo'; $('count').textContent=rg.win?names.join(' vs '):rStat();
  $('hostBoard').innerHTML=boardHTML(rg.b,'host'); players.forEach((p,i)=>send(p.id,'ringo',{i,state:cleanRingo(),msg:i==rg.turn?rNeed():roleName(i)}));
  if(rg.win)setTimeout(home,4500);
}
function cleanRingo(){return{b:rg.b,duel:rg.duel,turn:rg.turn,phase:rg.phase,pick:rg.pick,win:rg.win,names:pubPlayers()};}
function roleName(i){let n=rg.duel.indexOf(i); return n<0?'Spectating Ringo':`You are ${n?'Blue':'Red'}. Waiting for ${players[rg.turn].name}.`;}
function rCol(i){return rg.duel[0]==i?'r':rg.duel[1]==i?'b':'';}
function rStat(){let n=players[rg.turn].name,c=rCol(rg.turn)=='r'?'Red':'Blue'; return `${n}'s turn (${c}) · ${rNeed()}`+(errMsg?` · ${errMsg}`:'');}
function rNeed(){return rg.phase=='disc'?`place or move a disc`:rg.phase=='ringPick'?`pick an empty ring`:`place the ring`;}
function ringoTap(id,m){
  if(phase!='ringo'||rg.win)return; let i=players.findIndex(p=>p.id==id); if(i!=rg.turn)return send(id,'rerr',{msg:'Not your turn'}); errMsg='';
  let ok=rMove(i,+m.x,+m.y); if(!ok)return send(id,'rerr',{msg:errMsg}); ringoSync();
}
function rMove(i,x,y){let c=rCol(i),q=at(x,y),mine=o=>o&&o.d==c,placed=rg.b.filter(o=>o.d==c).length;
  if(rg.phase=='disc'){
    if(placed<8){if(!q||q.d)return bad('Tap a vacant ring'); q.d=c; rg.phase='ringPick'; return 1}
    if(!rg.pick){if(!mine(q))return bad('Pick one of your discs'); if(!joined(rg.b.filter(o=>o.d&&o!=q)))return bad('That disc holds the board together'); rg.pick={x,y,d:c}; q.d=''; return 1}
    if(!q||q.d)return bad('Move to a vacant ring'); q.d=c; rg.pick=null; rg.phase='ringPick'; return 1
  }
  if(rg.phase=='ringPick'){if(!q||q.d)return bad('Pick an empty ring'); rg.pick={x,y,r:q.r}; rg.b=rg.b.filter(o=>o!=q); rg.phase='ringPlace'; return 1}
  if(at(x,y))return bad('That space already has a ring'); if(!adj(x,y))return bad('Place next to another ring'); rg.b.push({x,y,r:rg.pick.r,d:''}); rg.pick=null; let w=winner(); if(w){rg.win={i:rg.duel[w.c=='r'?0:1],k:w.k}; return 1} rg.phase='disc'; rg.turn=rg.duel[1-rg.duel.indexOf(i)]; return 1;
}
function bad(s){errMsg=s; ringoSync(); return 0}
function at(x,y){return rg.b.find(o=>o.x==x&&o.y==y)}
function adj(x,y){return rg.b.some(o=>Math.max(Math.abs(o.x-x),Math.abs(o.y-y))==1)}
function joined(a){if(a.length<2)return 1; let s=[a[0]],seen={[K(a[0].x,a[0].y)]:1}; for(let n=0;n<s.length;n++)a.forEach(o=>{let k=K(o.x,o.y); if(!seen[k]&&Math.max(Math.abs(o.x-s[n].x),Math.abs(o.y-s[n].y))==1){seen[k]=1; s.push(o)}}); return s.length==a.length}
function winner(){for(let k of['d','r'])for(let c of['r','b'])for(let o of rg.b)for(let [dx,dy]of D){let a=[]; for(let n=0;n<4;n++){let q=at(o.x+dx*n,o.y+dy*n); if(!q||q[k]!=c)break; a.push(q)} if(a.length==4){let p=at(o.x-dx,o.y-dy),e=at(o.x+dx*4,o.y+dy*4); if((!p||p[k]!=c)&&(!e||e[k]!=c))return{c,k:k=='d'?'discs':'rings'}}}}

function saveRoom(r) {
  let rms = JSON.parse(localStorage.getItem('nk_recent_rooms')||'[]');
  if (!rms.includes(r)) { rms.push(r); if(rms.length>5) rms.shift(); localStorage.setItem('nk_recent_rooms', JSON.stringify(rms)); }
}
function bootPlayer(){console.log('[PLAYER] Booting player...'); $('room').value=(new URLSearchParams(location.search).get('room')||'').toUpperCase(); $('joinForm').onsubmit=e=>{e.preventDefault(); console.log('[PLAYER] Join form submitted'); join();}; addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&room&&myId)sendToHost('sync_req');});
  let rms = JSON.parse(localStorage.getItem('nk_recent_rooms')||'[]');
  if(rms.length) {
    let rc = $('recent-rooms-container'); if(rc) rc.hidden = 0;
    let rl = $('recent-rooms-list'); if(rl) rl.innerHTML = rms.map(r=>`<button type="button" onclick="checkRecent('${r}')">${r}</button>`).join('');
  }
}
function checkRecent(r) {
  err('Connecting to room...');
  room = r; myId = code()+code(); mqttClient=mqtt.connect('wss://broker.emqx.io:8084/mqtt');
  mqttClient.on('connect',()=>{mqttClient.subscribe(`nk/${room}/p/${myId}`); mqttClient.subscribe(`nk/${room}/all`); sendToHost('sync_req');});
  mqttClient.on('message',(topic,payload)=>{try{onPlayer(JSON.parse(payload.toString()));}catch(e){}});
  mqttClient.on('error',e=>{console.error('[PLAYER] MQTT Error:', e); err('Network error');});
  setTimeout(()=>{ if($('claim').hidden && $('wait').hidden && $('task').hidden) err('Room not reachable — is the host online?'); }, 8000);
}
function claim(i) { sendToHost('claim_player', {i}); }
let claimMode=0;
function claimPick(i){ if(claimMode!=1)return; if(!confirm('Take over this seat? The other player will be removed.'))return; $('claim-err').textContent='Taking over...'; claim(i); }
function claimReplaceToggle(){ claimMode = claimMode==1?0:1; claimHint(); }
function claimHint(inLobby){
  let list=$('claim-players-list'), msg=$('claim-msg');
  if(!list)return;
  if(typeof inLobby==='undefined'){ let nb=$('claim-new-box'); inLobby = !nb || !nb.hidden; }
  list.classList.toggle('claim-replace', claimMode==1);
  if(msg) msg.textContent = claimMode==1 ? 'Tap a player below to take over their seat.' : (inLobby ? 'This room is open. Join as a new player, or tap "Replace player" to take over a spot.' : 'A game is in progress. Tap "Replace player" to take over a spot.');
}
function claimNewJoin(){
  let n=$('claim-new-name').value.trim();
  if(!n){ $('claim-err').textContent='Enter your name.'; return; }
  saveRoom(room);
  $('claim-err').textContent='Joining...';
  sendToHost('join',{name:n});
}
function claimCancel(){ $('claim').hidden=1; $('join').hidden=0; try{ mqttClient&&mqttClient.end(); }catch(e){} }
function join(){room=$('room').value.trim().toUpperCase();let name=$('name').value.trim()||'Player'; if(room.length!=4)return err('Enter a 4-letter room code'); err('Connecting...'); saveRoom(room); console.log('[PLAYER] Joining room:', room, 'as', name); myId=code()+code(); mqttClient=mqtt.connect('wss://broker.emqx.io:8084/mqtt'); mqttClient.on('connect',()=>{console.log('[PLAYER] MQTT connected! ID:', myId); mqttClient.subscribe(`nk/${room}/p/${myId}`); mqttClient.subscribe(`nk/${room}/all`); console.log('[PLAYER] Sending join to host...'); sendToHost('join',{name});}); mqttClient.on('message',(topic,payload)=>{try{onPlayer(JSON.parse(payload.toString()));}catch(e){}}); mqttClient.on('error',e=>{console.error('[PLAYER] MQTT Error:', e); err('Network error');});}
function err(s){$('err').textContent=s;}
function pErr(s){ let ce=$('claim-err'); if(ce && !$('claim').hidden) ce.textContent=s; else err(s); }
function roster(ps){let el=$('roster'); if(!el)return; el.innerHTML=(ps&&ps.length)?ps.map(p=>`<li>${p.name}</li>`).join(''):'<li class="muted">No one else here yet</li>';}
function onPlayer(m){switch(m.t){
  case'err': pErr(m.msg); break; case'rerr': $('taskTitle').textContent=m.msg; break;
  case'joined': $('join').hidden=1; $('claim').hidden=1; $('wait').hidden=0; $('waitMsg').textContent='Waiting for host to choose a game...'; roster(m.players); break;
  case'lobby': roster(m.players); break;
  case'kicked': $('join').hidden=0; $('wait').hidden=1; $('task').hidden=1; err('You were kicked by the host.'); break;
  case'sync_res': 
    if (m.names && !m.tasks) {
      $('join').hidden=1; $('claim').hidden=0;
      let inLobby = m.phase=='lobby';
      $('claim-new-box').hidden = !inLobby;
      $('claim-new-name').value='';
      $('claim-err').textContent='';
      $('claim-players-list').innerHTML = m.names.map(n=>`<li class="player-item" data-i="${n.i}" onclick="claimPick(${n.i})">${n.name}</li>`).join('');
      claimMode=0; claimHint(inLobby);
      return;
    }
    let cb = $('claim'); if(cb) cb.hidden=1; $('join').hidden=1;
    me=m.i; deadline=m.deadline; totalTime=m.phase=='prompt'?30000:(m.tasks&&Object.values(m.tasks)[0]&&Object.values(m.tasks)[0].kind=='draw'?30000:60000); if(m.phase=='prompt')promptUI(); else if(m.phase=='round')taskUI(m.tasks); else if(m.phase=='reveal'){$('task').hidden=1; $('wait').hidden=0; $('waitMsg').textContent='Reveal time. Look at the host screen!';} else if(m.phase=='lobby'){$('claim').hidden=1; $('join').hidden=1; $('wait').hidden=0; $('waitMsg').textContent='Waiting for host to choose a game...'; roster(m.names);} break;
  case'prompt': me=m.i; deadline=m.deadline; totalTime=30000; promptUI(); break; case'task': me=m.i; deadline=m.deadline; totalTime=Object.values(m.tasks)[0].kind=='draw'?30000:60000; taskUI(m.tasks); break;
  case'done': $('task').hidden=1; $('wait').hidden=0; $('waitMsg').textContent='Reveal time. Look at the host screen!'; break;
  case'home': $('join').hidden=1; $('task').hidden=1; $('wait').hidden=0; $('waitMsg').textContent='Waiting for host to choose a game...'; break;
  case'ringo': me=m.i; ringoUI(m.state,m.msg); break;
}}
function showTask(title,html){$('wait').hidden=1; $('task').hidden=0; $('taskTitle').textContent=title; $('taskBody').innerHTML=html; $('submit').hidden=0; $('submit').disabled=0;}
function promptUI(){let w=[...WORDS].sort(()=>Math.random()-.5).slice(0,6); showTask('Pick a secret prompt',`<div class="words">${w.map(x=>`<button type="button">${x}</button>`).join('')}</div><textarea id="custom" placeholder="Or type your own"></textarea>`); picked=''; [...document.querySelectorAll('.words button')].forEach(b=>b.onclick=()=>{picked=b.textContent; document.querySelectorAll('.words button').forEach(x=>x.classList.toggle('pick',x==b));}); $('submit').onclick=()=>submit(($('custom').value.trim()||picked));}
function taskUI(tasks){let id=Object.keys(tasks)[0],last=tasks[id]; if(last.kind=='draw')guessUI(id,last.v); else drawUI(id,last.v);}
function submit(v){if(!v)return; $('submit').disabled=1; sendToHost('answer',{i:me,v}); $('task').hidden=1; $('wait').hidden=0; $('waitMsg').textContent='Submitted. Waiting for the others...';}
function guessUI(id,img){showTask('What is this?',`<img class="guessImg" src="${img}" alt="drawing"><textarea id="guess" placeholder="Your guess"></textarea>`); $('submit').onclick=()=>{let v=$('guess').value.trim(); if(v)submit({[id]:v});};}
function setColor(c) { currentColor = c; let cc = $('customColor'); if(cc && c.length===7) cc.value = c; }
function drawUI(id,text){
  const cols = ['#000000','#ffffff','#dd2222','#19a974','#2d7ff9'];
  const palette = `<div class="palette-group">` + cols.map(c=>`<button class="palette-btn" style="background:${c}" type="button" onclick="setColor('${c}')"></button>`).join('') + `<input type="color" class="palette-btn" id="customColor" onchange="setColor(this.value)"></div>`;
  showTask('Draw this',`<div class="bigText">${esc(text)}</div><canvas id="can" class="draw" width="800" height="600"></canvas><div class="tools">${palette}<div class="action-group"><button id="undo" type="button">Undo</button><button id="clear" type="button">Clear</button></div></div>`); 
  canvas(); $('undo').onclick=()=>{strokes.pop(); redraw();}; $('clear').onclick=()=>{strokes=[]; redraw();}; $('submit').onclick=()=>submit({[id]:$('can').toDataURL('image/png')});
}
function ringoUI(s,msg){rg=s; $('wait').hidden=1; $('task').hidden=0; $('submit').hidden=1; $('taskTitle').textContent=s.win?'Game over':msg; $('taskBody').innerHTML=boardHTML(s.b,'play'); [...document.querySelectorAll('#taskBody .cell')].forEach(el=>el.onclick=()=>sendToHost('ringo',{x:el.dataset.x,y:el.dataset.y}));}
function boardHTML(b,cls){let xs=b.map(o=>o.x),ys=b.map(o=>o.y),mnx=Math.min(...xs)-1,mxx=Math.max(...xs)+1,mny=Math.min(...ys)-1,mxy=Math.max(...ys)+1,mp={}; b.forEach(o=>mp[K(o.x,o.y)]=o); let h=`<div class="rboard ${cls}" style="--cols:${mxx-mnx+1};--rows:${mxy-mny+1}">`; for(let y=mny;y<=mxy;y++)for(let x=mnx;x<=mxx;x++){let o=mp[K(x,y)]; h+=`<button class="cell" data-x="${x}" data-y="${y}">${o?`<i class="${o.r}">${o.d?`<b class="${o.d}"></b>`:''}</i>`:''}</button>`} return h+'</div>'}
function canvas(){let c=$('can'),x=c.getContext('2d'); strokes=[]; currentColor='#000000'; x.lineCap=x.lineJoin='round'; x.lineWidth=7; const p=e=>{let r=c.getBoundingClientRect(),t=e.touches?e.touches[0]:e; return[(t.clientX-r.left)*c.width/r.width,(t.clientY-r.top)*c.height/r.height];}; const down=e=>{e.preventDefault(); drawing=1; strokes.push({c:currentColor,pts:[p(e)]}); redraw();}; const move=e=>{if(!drawing)return; e.preventDefault(); strokes[strokes.length-1].pts.push(p(e)); redraw();}; c.onmousedown=c.ontouchstart=down; c.onmousemove=c.ontouchmove=move; addEventListener('mouseup',()=>drawing=0); addEventListener('touchend',()=>drawing=0); redraw();}
function redraw(){let c=$('can'),x=c.getContext('2d'); x.clearRect(0,0,c.width,c.height); strokes.forEach(s=>{x.strokeStyle=s.c; x.beginPath(); s.pts.forEach((p,i)=>i?x.lineTo(...p):x.moveTo(...p)); x.stroke();});}
function tickTimer() {
  requestAnimationFrame(tickTimer);
  let bar = $('timer-bar');
  if (!bar || !deadline) { if(bar) bar.hidden=1; return; }
  let rem = deadline - Date.now(), total = phase=='prompt'?30000:60000;
  if (role != 'host') total = totalTime;
  else if (phase == 'round') {
     let nextIsDraw = booklets[0] && booklets[0].entries[booklets[0].entries.length-1].kind != 'draw';
     total = nextIsDraw ? 60000 : 30000;
  }
  if (rem < 0) rem = 0;
  bar.hidden = 0;
  bar.style.width = (rem / total * 100) + '%';
  bar.style.background = rem < 5000 ? '#d22' : '#19a974';
}
requestAnimationFrame(tickTimer);
