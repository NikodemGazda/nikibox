const $=id=>document.getElementById(id),role=document.body.dataset.role,ROOM='nb-',WORDS='Banana Volcano Robot Pancake Dragon Pickle Moon Castle Pizza Ghost Wizard Cactus Dinosaur Taco Mermaid Spaceship Yeti Trombone Donut Shark Unicorn Lighthouse Burrito Sloth Meteor Sandwich Pirate Teapot Giraffe Crown Jellyfish Tractor Sock Magnet Koala Backpack Snowman Hotdog Octopus Chair Pumpkin Ninja Waffle Whale Guitar Hammer Flamingo Telescope Cupcake Penguin'.split(' ');
let peer,me,conn,players=[],booklets=[],phase='lobby',step=0,answers={},picked='',strokes=[],drawing=false,rev=0,revStep=0,rg=null,errMsg='';
const code=()=>Math.random().toString(36).replace(/[^a-z]+/g,'').slice(0,4).toUpperCase(),esc=s=>(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])),send=(c,t,d={})=>c&&c.open&&c.send({t,...d}),broadcast=(t,d={})=>players.forEach(p=>send(p.c,t,d)),K=(x,y)=>x+','+y,D=[[1,0],[0,1],[1,1],[1,-1]];
if(role=='host') bootHost(); else bootPlayer();
function bootHost(){
  let room=code(); $('code').textContent=room; let url=new URL('player.html',location.href); url.searchParams.set('room',room); $('joinUrl').textContent=url.href;
  new QRCode($('qr'),{text:url.href,width:190,height:190}); peer=new Peer(ROOM+room);
  peer.on('connection',c=>{c.on('data',m=>onHost(c,m)); c.on('close',()=>drop(c));});
  $('start').onclick=startGame; $('ringo').onclick=startRingo; $('prev').onclick=()=>showReveal(-1); $('next').onclick=()=>showReveal(1); $('restart').onclick=home;
}
function onHost(c,m){switch(m.t){
  case'join': if(phase!='lobby')return send(c,'err',{msg:'Game already started'}); if(!players.find(p=>p.c==c)){players.push({id:c.peer,name:esc(m.name||'Player'),c}); c.on('close',()=>drop(c));} send(c,'joined',{players:pubPlayers()}); updateLobby(); broadcast('lobby',{players:pubPlayers()}); break;
  case'answer': if(!players[m.i]||players[m.i].c!=c||answers[m.i])return; answers[m.i]=m.v; checkAnswers(); break;
  case'ringo': ringoTap(c,m); break;
}}
function drop(c){players=players.filter(p=>p.c!=c); updateLobby(); if(phase=='lobby')broadcast('lobby',{players:pubPlayers()});}
function pubPlayers(){return players.map((p,i)=>({i,name:p.name}));}
function updateLobby(){$('players').innerHTML=players.map(p=>`<li>${p.name}</li>`).join(''); $('games').hidden=!players.length; $('ringo').disabled=players.length<2;}
function home(){phase='lobby'; step=rev=revStep=0; answers={}; booklets=[]; rg=null; errMsg=''; $('phase').className=''; $('reveal').hidden=1; $('play').hidden=1; $('lobby').hidden=0; $('hostBoard').innerHTML=''; updateLobby(); broadcast('home',{players:pubPlayers()});}

function startGame(){phase='prompt'; step=0; booklets=[]; players.forEach((p,i)=>p.i=i); answers={}; $('phase').className=''; $('lobby').hidden=1; $('reveal').hidden=1; $('play').hidden=0; $('hostBoard').innerHTML=''; $('phase').textContent='Telesketch: secret prompts'; count(); players.forEach(p=>send(p.c,'prompt',{i:p.i,players:pubPlayers()}));}
function checkAnswers(){
  count(); if(Object.keys(answers).length<players.length)return;
  if(phase=='prompt')booklets=players.map((p,i)=>({owner:i,ownerName:p.name,entries:[{kind:'prompt',by:i,byName:p.name,v:answers[i]}]}));
  else {booklets.forEach((b,bi)=>{let by=(b.owner+step)%players.length,bn=players[by].name,last=b.entries[b.entries.length-1]; b.entries.push({kind:last.kind=='draw'?'guess':'draw',by,byName:bn,v:answers[by][bi]});}); step++;}
  if(step>=players.length)return reveal();
  answers={}; phase='round'; $('phase').textContent=`Telesketch: round ${step+1} of ${players.length}`; count();
  players.forEach((p,i)=>{let tasks={}; booklets.forEach((b,bi)=>{if((b.owner+step)%players.length==i)tasks[bi]=b.entries[b.entries.length-1];}); send(p.c,'task',{i,step,tasks});});
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
  $('hostBoard').innerHTML=boardHTML(rg.b,'host'); players.forEach((p,i)=>send(p.c,'ringo',{i,state:cleanRingo(),msg:i==rg.turn?rNeed():roleName(i)}));
  if(rg.win)setTimeout(home,4500);
}
function cleanRingo(){return{b:rg.b,duel:rg.duel,turn:rg.turn,phase:rg.phase,pick:rg.pick,win:rg.win,names:pubPlayers()};}
function roleName(i){let n=rg.duel.indexOf(i); return n<0?'Spectating Ringo':`You are ${n?'Blue':'Red'}. Waiting for ${players[rg.turn].name}.`;}
function rCol(i){return rg.duel[0]==i?'r':rg.duel[1]==i?'b':'';}
function rStat(){let n=players[rg.turn].name,c=rCol(rg.turn)=='r'?'Red':'Blue'; return `${n}'s turn (${c}) · ${rNeed()}`+(errMsg?` · ${errMsg}`:'');}
function rNeed(){return rg.phase=='disc'?`place or move a disc`:rg.phase=='ringPick'?`pick an empty ring`:`place the ring`;}
function ringoTap(c,m){
  if(phase!='ringo'||rg.win)return; let i=players.findIndex(p=>p.c==c); if(i!=rg.turn)return send(c,'rerr',{msg:'Not your turn'}); errMsg='';
  let ok=rMove(i,+m.x,+m.y); if(!ok)return send(c,'rerr',{msg:errMsg}); ringoSync();
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

function bootPlayer(){$('room').value=(new URLSearchParams(location.search).get('room')||'').toUpperCase(); $('joinForm').onsubmit=e=>{e.preventDefault(); join();};}
function join(){let room=$('room').value.trim().toUpperCase(),name=$('name').value.trim()||'Player'; if(room.length!=4)return err('Enter a 4-letter room code'); peer=new Peer(); peer.on('open',()=>{conn=peer.connect(ROOM+room,{reliable:true}); conn.on('open',()=>send(conn,'join',{name})); conn.on('data',onPlayer); conn.on('close',()=>err('Disconnected'));});}
function err(s){$('err').textContent=s;}
function onPlayer(m){switch(m.t){
  case'err': err(m.msg); break; case'rerr': $('taskTitle').textContent=m.msg; break;
  case'joined': $('join').hidden=1; $('wait').hidden=0; break; case'lobby': break;
  case'prompt': me=m.i; promptUI(); break; case'task': me=m.i; taskUI(m.tasks); break;
  case'done': $('task').hidden=1; $('wait').hidden=0; $('waitMsg').textContent='Reveal time. Look at the host screen!'; break;
  case'home': $('join').hidden=1; $('task').hidden=1; $('wait').hidden=0; $('waitMsg').textContent='Waiting for host to choose a game...'; break;
  case'ringo': me=m.i; ringoUI(m.state,m.msg); break;
}}
function showTask(title,html){$('wait').hidden=1; $('task').hidden=0; $('taskTitle').textContent=title; $('taskBody').innerHTML=html; $('submit').hidden=0; $('submit').disabled=0;}
function promptUI(){let w=[...WORDS].sort(()=>Math.random()-.5).slice(0,6); showTask('Pick a secret prompt',`<div class="words">${w.map(x=>`<button type="button">${x}</button>`).join('')}</div><textarea id="custom" placeholder="Or type your own"></textarea>`); picked=''; [...document.querySelectorAll('.words button')].forEach(b=>b.onclick=()=>{picked=b.textContent; document.querySelectorAll('.words button').forEach(x=>x.classList.toggle('pick',x==b));}); $('submit').onclick=()=>submit(($('custom').value.trim()||picked));}
function taskUI(tasks){let id=Object.keys(tasks)[0],last=tasks[id]; if(last.kind=='draw')guessUI(id,last.v); else drawUI(id,last.v);}
function submit(v){if(!v)return; $('submit').disabled=1; send(conn,'answer',{i:me,v}); $('task').hidden=1; $('wait').hidden=0; $('waitMsg').textContent='Submitted. Waiting for the others...';}
function guessUI(id,img){showTask('What is this?',`<img class="guessImg" src="${img}" alt="drawing"><textarea id="guess" placeholder="Your guess"></textarea>`); $('submit').onclick=()=>{let v=$('guess').value.trim(); if(v)submit({[id]:v});};}
function drawUI(id,text){showTask('Draw this',`<div class="bigText">${esc(text)}</div><canvas id="can" class="draw" width="800" height="600"></canvas><div class="tools"><button id="undo" type="button">Undo</button><button id="clear" type="button">Clear</button></div>`); canvas(); $('undo').onclick=()=>{strokes.pop(); redraw();}; $('clear').onclick=()=>{strokes=[]; redraw();}; $('submit').onclick=()=>submit({[id]:$('can').toDataURL('image/png')});}
function ringoUI(s,msg){rg=s; $('wait').hidden=1; $('task').hidden=0; $('submit').hidden=1; $('taskTitle').textContent=s.win?'Game over':msg; $('taskBody').innerHTML=boardHTML(s.b,'play'); [...document.querySelectorAll('#taskBody .cell')].forEach(el=>el.onclick=()=>send(conn,'ringo',{x:el.dataset.x,y:el.dataset.y}));}
function boardHTML(b,cls){let xs=b.map(o=>o.x),ys=b.map(o=>o.y),mnx=Math.min(...xs)-1,mxx=Math.max(...xs)+1,mny=Math.min(...ys)-1,mxy=Math.max(...ys)+1,mp={}; b.forEach(o=>mp[K(o.x,o.y)]=o); let h=`<div class="rboard ${cls}" style="--cols:${mxx-mnx+1};--rows:${mxy-mny+1}">`; for(let y=mny;y<=mxy;y++)for(let x=mnx;x<=mxx;x++){let o=mp[K(x,y)]; h+=`<button class="cell" data-x="${x}" data-y="${y}">${o?`<i class="${o.r}">${o.d?`<b class="${o.d}"></b>`:''}</i>`:''}</button>`} return h+'</div>'}
function canvas(){let c=$('can'),x=c.getContext('2d'); strokes=[]; x.lineCap=x.lineJoin='round'; x.lineWidth=7; x.strokeStyle='#000'; const p=e=>{let r=c.getBoundingClientRect(),t=e.touches?e.touches[0]:e; return[(t.clientX-r.left)*c.width/r.width,(t.clientY-r.top)*c.height/r.height];}; const down=e=>{e.preventDefault(); drawing=1; strokes.push([p(e)]); redraw();}; const move=e=>{if(!drawing)return; e.preventDefault(); strokes[strokes.length-1].push(p(e)); redraw();}; c.onmousedown=c.ontouchstart=down; c.onmousemove=c.ontouchmove=move; addEventListener('mouseup',()=>drawing=0); addEventListener('touchend',()=>drawing=0); redraw();}
function redraw(){let c=$('can'),x=c.getContext('2d'); x.clearRect(0,0,c.width,c.height); strokes.forEach(s=>{x.beginPath(); s.forEach((p,i)=>i?x.lineTo(...p):x.moveTo(...p)); x.stroke();});}
