/* NexusTwin control deck — UI shell + preview twin (placeholder for the real three.js canvas) */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const C = { ink:'#121826', signal:'#FF5A1F', teal:'#0E9F8E', blue:'#2F5BFF', amber:'#E8A10C', red:'#E0322B', hair:'#E2DED2', paper:'#F3F1EA', mute:'#7A8090', violet:'#6B4DFF' };
const S = { playing:true, speed:1, tick:184220, simSec:14*3600+22*60+8, modes:{}, view:'3d', tool:'sel', paths:true, labels:true, sel:'AMR-07', heatLong:true };
const rnd = (a,b)=>a+Math.random()*(b-a), pick = a=>a[Math.floor(Math.random()*a.length)];
const fmt = n => n.toLocaleString('en-IN');

function toast(msg){ const t=$('#toast'); t.querySelector('span').textContent=msg; t.classList.add('on'); clearTimeout(t._h); t._h=setTimeout(()=>t.classList.remove('on'),2200); }

/* ───────── Facility model ───────── */
const W=84, H=52;
const racks=[], stations=[], chargers=[], aisles=[];
for(let i=0;i<8;i++){ const x=7+i*9; aisles.push(x+5.5);
  for(let j=0;j<4;j++) racks.push({id:`R-${String.fromCharCode(65+i)}${j+1}`,x,y:9+j*8,w:3.4,h:6.4,z:2+((i+j)%3)*.9}); }
[16,34,52,70].forEach((x,i)=>stations.push({id:`PK-0${i+1}`,x:x-3,y:44,w:6,h:4}));
[12,20,28,36].forEach((y,i)=>chargers.push({id:`DC-${i+1}`,x:1.2,y,w:2.4,h:2.4}));
const inbound={x:76,y:2,w:7,h:5};
const obstacles=[];
const PROFILES=['Light Picker','Heavy Transport','Express Sorter'];
const bots=[];
for(let i=0;i<48;i++){
  const b={id:`AMR-${String(i+1).padStart(2,'0')}`,x:pick(aisles),y:rnd(6,42),path:[],st:'NAV',spd:rnd(5,8),bat:rnd(28,98),prof:PROFILES[i%3],hue:0};
  if(i<7){b.st='CHG';const c=chargers[i%4];b.x=c.x+1.2;b.y=c.y+1.2;}
  else if(i<11) b.st='IDLE';
  bots.push(b);
}
const heat=new Float32Array(W*H);

function route(b){
  const tx = Math.random()<.45 ? pick(stations).x+3 : pick(aisles);
  const ty = tx===undefined?20: (stations.some(s=>s.x+3===tx)? 43 : rnd(9,40));
  const lane = b.y<24 ? 5 : 42.5;
  b.path=[{x:b.x,y:lane},{x:tx,y:lane},{x:tx,y:ty}];
}

function step(dt){
  const surge=S.modes.surge?1.5:1;
  bots.forEach(b=>{
    if(b.st==='FAULT'||b.st==='CHG'||b.st==='IDLE'){ if(b.st==='CHG') b.bat=Math.min(100,b.bat+dt*2); return; }
    if(!b.path.length) route(b);
    const p=b.path[0], dx=p.x-b.x, dy=p.y-b.y, d=Math.hypot(dx,dy);
    let v=b.spd*surge*dt;
    // yield if another bot is directly ahead (cheap ACS stand‑in)
    b.yield=false;
    for(const o of bots){ if(o===b) continue; const ox=o.x-b.x, oy=o.y-b.y; const dist=Math.hypot(ox,oy);
      if(dist<1.6 && (ox*dx+oy*dy)>0){ v*=.15; b.yield=true; break; } }
    for(const o of obstacles){ if(Math.hypot(o.x-b.x,o.y-b.y)<2.4){ v*=.1; b.yield=true; } }
    if(d<=v){ b.x=p.x; b.y=p.y; b.path.shift(); } else { b.x+=dx/d*v; b.y+=dy/d*v; b.dir=Math.atan2(dy,dx); }
    b.bat=Math.max(5,b.bat-dt*.08);
    const ci=Math.floor(b.y)*W+Math.floor(b.x); if(ci>=0&&ci<heat.length) heat[ci]+=dt*(S.heatLong?.4:1.4);
  });
  if(!S.heatLong) for(let i=0;i<heat.length;i++) heat[i]*=.985;
}

/* ───────── Projection ───────── */
const cv=$('#scene'), ctx=cv.getContext('2d');
let VW=0,VH=0,scale=1,ox=0,oy=0;
const COS=Math.cos(Math.PI/6), SIN=Math.sin(Math.PI/6);
function proj(x,y,z=0){
  if(S.view==='2d') return [ox+x*scale, oy+y*scale];
  return [ox+(x-y)*COS*scale, oy+(x+y)*SIN*scale - z*scale];
}
function unproj(sx,sy){
  if(S.view==='2d') return [(sx-ox)/scale,(sy-oy)/scale];
  const a=(sx-ox)/(COS*scale), c=(sy-oy)/(SIN*scale); return [(a+c)/2,(c-a)/2];
}
function fit(){
  const r=cv.parentElement.getBoundingClientRect(), dpr=devicePixelRatio||1;
  VW=r.width; VH=r.height; cv.width=VW*dpr; cv.height=VH*dpr; ctx.setTransform(dpr,0,0,dpr,0,0);
  const padX=VW*.09, padY=VH*.14;
  if(S.view==='2d'){ scale=Math.min((VW-2*padX)/W,(VH-2*padY)/H); ox=(VW-W*scale)/2; oy=(VH-H*scale)/2+6; }
  else { const sw=(W+H)*COS, sh=(W+H)*SIN; scale=Math.min((VW-2*padX)/sw,(VH-2*padY)/(sh+4)); ox=VW/2-(W-H)*COS*scale/2; oy=(VH-sh*scale)/2+16; }
}
new ResizeObserver(fit).observe(cv.parentElement);

function poly(pts,fill,stroke,lw=1){ ctx.beginPath(); pts.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p)); ctx.closePath(); if(fill){ctx.fillStyle=fill;ctx.fill();} if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke();} }
function box(r,z,top,side1,side2,stroke){
  const {x,y,w,h}=r;
  if(S.view==='3d' && z>0){
    poly([proj(x+w,y,0),proj(x+w,y+h,0),proj(x+w,y+h,z),proj(x+w,y,z)],side1,stroke,.6);
    poly([proj(x,y+h,0),proj(x+w,y+h,0),proj(x+w,y+h,z),proj(x,y+h,z)],side2,stroke,.6);
  }
  poly([proj(x,y,z),proj(x+w,y,z),proj(x+w,y+h,z),proj(x,y+h,z)],top,stroke,.8);
}

function draw(t){
  ctx.clearRect(0,0,VW,VH);
  const bp=S.view==='2d';
  // floor
  poly([proj(0,0),proj(W,0),proj(W,H),proj(0,H)], bp?'#1D3B8A':'#FFFFFF', bp?'#6E8BE0':'#D2CDBE',1.2);
  // grid
  ctx.strokeStyle=bp?'rgba(255,255,255,.08)':'rgba(18,24,38,.05)'; ctx.lineWidth=1;
  for(let x=0;x<=W;x+=4){ctx.beginPath();ctx.moveTo(...proj(x,0));ctx.lineTo(...proj(x,H));ctx.stroke();}
  for(let y=0;y<=H;y+=4){ctx.beginPath();ctx.moveTo(...proj(0,y));ctx.lineTo(...proj(W,y));ctx.stroke();}
  // heatmap
  if(S.modes.heat){ let mx=0; for(const v of heat) mx=Math.max(mx,v);
    for(let y=0;y<H;y+=2) for(let x=0;x<W;x+=2){ const v=(heat[y*W+x]+heat[y*W+x+1]+heat[(y+1)*W+x])/ (mx||1);
      if(v<.05) continue; const a=Math.min(.75,v*1.6);
      poly([proj(x,y),proj(x+2,y),proj(x+2,y+2),proj(x,y+2)], v>.5?`rgba(224,50,43,${a})`:v>.2?`rgba(255,90,31,${a})`:`rgba(232,161,12,${a})`); } }
  // aisle flow arrows
  ctx.fillStyle=bp?'rgba(255,255,255,.35)':'rgba(18,24,38,.18)'; ctx.font='9px SF Mono, monospace';
  aisles.forEach((x,i)=>{ const [sx,sy]=proj(x,24); ctx.fillText(i%2?'▲':'▼',sx-3,sy+3); });
  // zones: lanes
  [5,42.5].forEach(y=>{ ctx.setLineDash([4,4]); ctx.strokeStyle=bp?'rgba(255,255,255,.3)':'rgba(255,90,31,.35)'; ctx.beginPath(); ctx.moveTo(...proj(3,y)); ctx.lineTo(...proj(W-1,y)); ctx.stroke(); ctx.setLineDash([]); });
  // stations, chargers, inbound
  stations.forEach(s=>box(s,.8,bp?'rgba(255,255,255,.12)':'#121826',bp?null:'#0A0F1A',bp?null:'#232B3C',bp?'#fff':null));
  chargers.forEach(c=>box(c,.3,bp?'rgba(255,255,255,.1)':'#E4EAFF',null,null,bp?'#9DB4FF':'#2F5BFF'));
  box(inbound,.4,bp?'rgba(255,255,255,.1)':'#FCF1D6',bp?null:'#F2DFA8',bp?null:'#E8CF88',bp?'#fff':'#E8A10C');
  // racks (back to front)
  const rs=[...racks].sort((a,b)=>(a.x+a.y)-(b.x+b.y));
  rs.forEach(r=>{ const sel=S.sel===r.id;
    box(r, bp?0:r.z, bp?'rgba(255,255,255,.06)':(sel?'#FFE9DF':'#F6F4EE'), '#E2DED2','#D2CDBE', bp?'rgba(255,255,255,.85)':(sel?C.signal:'#B9B3A3'));
    if(!bp){ for(let k=1;k<4;k++){ const z=r.z*k/4; ctx.strokeStyle='rgba(18,24,38,.12)'; ctx.beginPath(); ctx.moveTo(...proj(r.x+r.w,r.y+r.h,z)); ctx.lineTo(...proj(r.x,r.y+r.h,z)); ctx.stroke(); } }
  });
  // obstacles
  obstacles.forEach(o=>{ const [sx,sy]=proj(o.x,o.y); ctx.fillStyle=C.amber; ctx.beginPath(); ctx.moveTo(sx,sy-14); ctx.lineTo(sx-7,sy+2); ctx.lineTo(sx+7,sy+2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(232,161,12,.5)'; ctx.setLineDash([3,3]); ctx.beginPath(); ctx.ellipse(sx,sy,2.4*scale*(bp?1:1.2),2.4*scale*(bp?1:.6),0,0,7); ctx.stroke(); ctx.setLineDash([]); });
  // paths
  if(S.paths) bots.forEach(b=>{ if(!b.path.length||b.st!=='NAV') return; ctx.strokeStyle=b.id===S.sel?C.signal:(bp?'rgba(255,255,255,.35)':'rgba(47,91,255,.28)'); ctx.lineWidth=b.id===S.sel?2:1; ctx.setLineDash([3,4]);
    ctx.beginPath(); ctx.moveTo(...proj(b.x,b.y)); b.path.forEach(p=>ctx.lineTo(...proj(p.x,p.y))); ctx.stroke(); ctx.setLineDash([]); });
  // bots
  bots.forEach(b=>{
    const [sx,sy]=proj(b.x,b.y,bp?0:.3);
    const col = b.st==='FAULT'?C.red : b.st==='CHG'?C.blue : b.st==='IDLE'?'#A7A08F' : b.vip?C.violet : b.yield?C.amber : C.signal;
    const r=Math.max(3,scale*.62);
    if(S.labels && b.st==='NAV'){ const a=b.dir||0; ctx.fillStyle=b.yield?'rgba(232,161,12,.16)':'rgba(14,159,142,.12)';
      const [px,py]=proj(b.x+Math.cos(a)*2.4,b.y+Math.sin(a)*2.4,bp?0:.3), [lx,ly]=proj(b.x+Math.cos(a+.6)*2,b.y+Math.sin(a+.6)*2,bp?0:.3), [rx,ry]=proj(b.x+Math.cos(a-.6)*2,b.y+Math.sin(a-.6)*2,bp?0:.3);
      ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(lx,ly); ctx.lineTo(px,py); ctx.lineTo(rx,ry); ctx.closePath(); ctx.fill(); }
    if(!bp){ ctx.fillStyle='rgba(18,24,38,.14)'; ctx.beginPath(); ctx.ellipse(sx,sy+r*.9,r*1.1,r*.45,0,0,7); ctx.fill(); }
    ctx.fillStyle=col; ctx.beginPath(); ctx.arc(sx,sy,r,0,7); ctx.fill();
    ctx.strokeStyle='#fff'; ctx.lineWidth=1.5; ctx.stroke();
    if(b.id===S.sel){ ctx.strokeStyle=C.signal; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(sx,sy,r+5+Math.sin(t/200)*2,0,7); ctx.stroke(); }
    if(b.st==='FAULT'){ ctx.strokeStyle='rgba(224,50,43,.5)'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(sx,sy,r+4+(t/30%12),0,7); ctx.stroke(); }
    if(S.labels && (b.id===S.sel || b.st==='FAULT' || bots.indexOf(b)%6===0)){
      ctx.font='600 9px SF Mono, Menlo, monospace'; const w=ctx.measureText(b.id).width+8;
      ctx.fillStyle=b.st==='FAULT'?C.red:C.ink; ctx.beginPath(); ctx.roundRect(sx-w/2,sy-r-17,w,13,3); ctx.fill();
      ctx.fillStyle='#fff'; ctx.fillText(b.id,sx-w/2+4,sy-r-7.5); }
  });
  // station labels
  ctx.font='700 9px Avenir Next, sans-serif'; ctx.fillStyle=bp?'#fff':C.ink;
  stations.forEach(s=>{ const [sx,sy]=proj(s.x+s.w/2,s.y+s.h+1.8); ctx.fillText(s.id,sx-14,sy+4); });
  const [ix,iy]=proj(inbound.x,inbound.y-1); ctx.fillStyle=bp?'#fff':'#A66F00'; ctx.fillText('INBOUND BAY',ix,iy);
  const [cx,cy]=proj(.5,9.5); ctx.fillStyle=bp?'#fff':C.blue; ctx.fillText('DC FAST',cx,cy);
  // measurement
  if(S.measure){ const m=S.measure; const a=proj(m.a[0],m.a[1]), b=proj(m.b[0],m.b[1]); ctx.strokeStyle=C.ink; ctx.lineWidth=1.5; ctx.setLineDash([5,3]);
    ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); ctx.setLineDash([]);
    const d=Math.hypot(m.b[0]-m.a[0],m.b[1]-m.a[1]); ctx.font='700 11px SF Mono, monospace'; const lbl=d.toFixed(1)+' m'; const w=ctx.measureText(lbl).width+10;
    ctx.fillStyle=C.ink; ctx.beginPath(); ctx.roundRect((a[0]+b[0])/2-w/2,(a[1]+b[1])/2-18,w,16,4); ctx.fill(); ctx.fillStyle='#fff'; ctx.fillText(lbl,(a[0]+b[0])/2-w/2+5,(a[1]+b[1])/2-6.5); }
}

let last=performance.now(), acc=0, frames=0, fpsT=0;
function loop(t){
  const dt=Math.min(.05,(t-last)/1000); last=t;
  if(S.playing){ const sdt=dt*S.speed; step(sdt); acc+=sdt; S.simSec+=sdt; S.tick+=Math.round(sdt*10); }
  draw(t); frames++; fpsT+=dt;
  if(fpsT>.5){ $('#fps').textContent=Math.round(frames/fpsT); $('#ftime').textContent=(fpsT/frames*1000).toFixed(1)+'ms'; frames=0; fpsT=0; }
  requestAnimationFrame(loop);
}

/* ───────── Canvas interaction ───────── */
cv.addEventListener('click',e=>{
  const r=cv.getBoundingClientRect(), sx=e.clientX-r.left, sy=e.clientY-r.top;
  const [wx,wy]=unproj(sx,sy);
  if(S.modes.obstacle){ if(wx>0&&wx<W&&wy>0&&wy<H){ obstacles.push({x:wx,y:wy}); pushAlert('h','Aisle obstruction placed',`(${wx.toFixed(1)}, ${wy.toFixed(1)}) · fleet rerouting`); pushLedger('safe',{t:'TURNOUT',c:'y',w:`<b>${pick(bots).id}</b> replanned A* around obstacle · +3.8 m detour`}); } return; }
  if(S.tool==='ruler'){ if(!S.measure||S.measure.done) S.measure={a:[wx,wy],b:[wx,wy]}; else { S.measure.b=[wx,wy]; S.measure.done=true; } return; }
  let best=null,bd=1e9; bots.forEach(b=>{ const [bx,by]=proj(b.x,b.y,S.view==='2d'?0:.3); const d=Math.hypot(bx-sx,by-sy); if(d<bd){bd=d;best=b;} });
  if(best&&bd<18){ S.sel=best.id; S.insp='bot'; renderInsp(); return; }
  const rk=racks.find(k=>wx>=k.x&&wx<=k.x+k.w&&wy>=k.y&&wy<=k.y+k.h); if(rk){ S.sel=rk.id; S.insp='rack'; renderInsp(); return; }
  const st=stations.find(k=>wx>=k.x-1&&wx<=k.x+k.w+1&&wy>=k.y-1&&wy<=k.y+k.h+1); if(st){ S.sel=st.id; S.insp='station'; renderInsp(); }
});
cv.addEventListener('mousemove',e=>{ if(S.tool==='ruler'&&S.measure&&!S.measure.done){ const r=cv.getBoundingClientRect(); S.measure.b=unproj(e.clientX-r.left,e.clientY-r.top);} });

/* ───────── Panels ───────── */
const SUBS=[['Warehouse Core Logic','ok'],['Outbound Conveyor Lines','ok'],['DC Fast Charging Pads','warn'],['Wireless Mesh Network','ok'],['LiDAR Anti‑Collision (ACS)','ok']];
function renderHealth(){
  $('#health').innerHTML=SUBS.map(([n,s])=>`<div class="hrow"><span class="led ${s==='ok'?'':s}"></span><span class="nm">${n}</span>
    <span style="display:flex;gap:8px;align-items:center"><span class="spark">${Array.from({length:12},()=>`<span style="height:${rnd(25,100)}%;${s!=='ok'?'background:'+(s==='err'?C.red:C.amber):''}"></span>`).join('')}</span>
    <span class="st">${s==='ok'?'99.9%':s==='warn'?'86% CAP':'DOWN'}</span></span></div>`).join('');
  const ok=SUBS.filter(s=>s[1]==='ok').length; $('#hSum').textContent=`${ok} / 5 nominal`;
}
const alerts=[];
function pushAlert(sev,ttl,meta){ alerts.unshift({sev,ttl,meta,t:clock(),acked:false}); if(alerts.length>12) alerts.pop(); renderAlerts(); }
function renderAlerts(){
  $('#alerts').innerHTML=alerts.map((a,i)=>`<div class="alert ${a.sev} ${a.acked?'acked':''}"><span class="bar"></span>
    <div><div class="ttl">${a.ttl}</div><div class="meta">${a.t} · ${a.meta}</div></div>
    <button class="ack" data-i="${i}">${a.acked?'✓':'ACK'}</button></div>`).join('');
}
$('#alerts').addEventListener('click',e=>{ const b=e.target.closest('.ack'); if(b){ alerts[b.dataset.i].acked=true; renderAlerts(); } });
$('#ackAll').onclick=()=>{ alerts.forEach(a=>a.acked=true); renderAlerts(); };

function clock(){ const s=Math.floor(S.simSec)%86400; return [s/3600,s/60%60,s%60].map(v=>String(Math.floor(v)).padStart(2,'0')).join(':'); }

const PRI=['LOW','NORMAL','NORMAL','NORMAL','HIGH'];
let tasks=[];
function mkTask(pri){ const t=Math.random()<.78; return {id:'T-'+Math.floor(rnd(48000,49999)),type:t?'Pick & Pack':'Put‑Away',pri:pri||pick(PRI),rack:pick(racks).id+'-L'+Math.ceil(rnd(0,4)),st:t?pick(stations).id:'INB-01',amr:pick(bots).id,p:rnd(0,.9)}; }
for(let i=0;i<14;i++) tasks.push(mkTask());
function renderQueue(){
  const order={FLASH_SURGE:0,HIGH:1,NORMAL:2,LOW:3}; tasks.sort((a,b)=>order[a.pri]-order[b.pri]);
  $('#queue').innerHTML=tasks.slice(0,14).map(t=>`<tr><td><b>${t.id}</b></td><td class="typ">${t.type}</td><td><span class="pri ${t.pri}">${t.pri.replace('_',' ')}</span></td>
    <td>${t.rack} → ${t.st}</td><td>${t.amr}</td><td><div class="prog"><span class="b"><i style="width:${t.p*100}%"></i></span>${t.p>.97?'<span style="color:var(--teal)">DONE</span>':Math.round(t.p*100)+'%'}</div></td></tr>`).join('');
}

/* donut */
function fleetCounts(){ const c={Active:0,Charging:0,Idle:0,Faulted:0}; bots.forEach(b=>{ c[b.st==='NAV'?'Active':b.st==='CHG'?'Charging':b.st==='IDLE'?'Idle':'Faulted']++; }); return c; }
function renderDonut(){
  const c=fleetCounts(), cols={Active:C.signal,Charging:C.blue,Idle:'#C9C2AF',Faulted:C.red}, tot=bots.length; let a=-Math.PI/2; const R=50,r=34;
  let s=''; Object.entries(c).forEach(([k,v])=>{ if(!v) return; const e=a+v/tot*Math.PI*2-.03;
    const p=(ang,rad)=>[60+Math.cos(ang)*rad,60+Math.sin(ang)*rad]; const L=e-a>Math.PI?1:0;
    const [x1,y1]=p(a,R),[x2,y2]=p(e,R),[x3,y3]=p(e,r),[x4,y4]=p(a,r);
    s+=`<path d="M${x1} ${y1}A${R} ${R} 0 ${L} 1 ${x2} ${y2}L${x3} ${y3}A${r} ${r} 0 ${L} 0 ${x4} ${y4}Z" fill="${cols[k]}"/>`; a=e+.03; });
  s+=`<text x="60" y="58" text-anchor="middle" font-family="DIN Alternate,Avenir Next" font-weight="700" font-size="24" fill="${C.ink}">${Math.round(c.Active/tot*100)}%</text><text x="60" y="73" text-anchor="middle" font-size="8" letter-spacing="1.2" fill="${C.mute}">ACTIVE</text>`;
  if($('#donut')) $('#donut').innerHTML=s;
  if($('#donutL')) $('#donutL').innerHTML=Object.entries(c).map(([k,v])=>`<div><i style="background:${cols[k]}"></i>${k}<b>${v}</b></div>`).join('');
  $('#fActive').textContent=c.Active; $('#fCharge').textContent=c.Charging; $('#fIdle').textContent=c.Idle+c.Faulted;
}

/* lifecycle */
const life=[['Inbound',412],['Racked',1880],['Picked',96],['Packaged',58],['Dispatched',3418]];
function renderLife(){ $('#life').innerHTML=life.map(([k,n],i)=>`<div class="stage ${i<3?'done':i===3?'act':''}">${i===3?'<span class="flow"></span>':''}<div class="n">${fmt(Math.round(n))}</div><div class="k">${k}</div></div>`).join(''); }

/* pace chart */
const labels=[], actual=[], target=[]; let cum=0;
for(let i=0;i<24;i++){ labels.push(`${String(8+Math.floor(i/4)).padStart(2,'0')}:${String(i%4*15).padStart(2,'0')}`); cum+=rnd(240,360); actual.push(Math.round(cum)); target.push(300*(i+1)); }
const chart=new Chart($('#paceChart'),{type:'line',data:{labels,datasets:[
  {label:'Actual',data:actual,borderColor:C.signal,borderWidth:2.4,pointRadius:0,tension:.35,fill:{target:'origin'},backgroundColor:ctx=>{const g=ctx.chart.ctx.createLinearGradient(0,0,0,ctx.chart.height);g.addColorStop(0,'rgba(255,90,31,.22)');g.addColorStop(1,'rgba(255,90,31,0)');return g;}},
  {label:'Target',data:target,borderColor:C.ink,borderWidth:1.2,borderDash:[4,4],pointRadius:0}]},
  options:{responsive:true,maintainAspectRatio:false,animation:{duration:500},interaction:{mode:'index',intersect:false},
    plugins:{legend:{display:false},tooltip:{backgroundColor:C.ink,titleFont:{family:'SF Mono'},bodyFont:{family:'SF Mono'},padding:8,cornerRadius:8}},
    scales:{x:{grid:{display:false},ticks:{font:{size:9,family:'SF Mono'},color:C.mute,maxTicksLimit:6},border:{color:C.hair}},
      y:{grid:{color:'rgba(18,24,38,.05)'},ticks:{font:{size:9,family:'SF Mono'},color:C.mute,maxTicksLimit:4,callback:v=>v>=1000?(v/1000)+'k':v},border:{display:false}}}}});
new ResizeObserver(()=>chart.resize()).observe($('#paceChart').parentElement);

/* ledger */
const ledgers={disp:[],safe:[]};
const REASONS=[['proximity 4.2 m',''],['battery buffer 62%','c'],['L1 tier · 0 s crane',''],['bypass aisle C (congested)','s'],['FLASH priority preempt','s'],['L4 crane latency 11 s','s']];
function pushLedger(k,item){ ledgers[k].unshift({...item,ts:clock()}); if(ledgers[k].length>14) ledgers[k].pop(); if(S.led===k) renderLedger(); }
function dispItem(){ const b=pick(bots), t=mkTask(); const rs=[...REASONS].sort(()=>Math.random()-.5).slice(0,3);
  return {w:`<b>${t.id}</b> → <b>${b.id}</b> · ${t.rack} → ${t.st}<div class="why">${rs.map(r=>`<span class="${r[1]}">${r[0]}</span>`).join('')}</div>`}; }
const SAFE=[['YIELD','y','right‑of‑way to {b} at aisle junction D4'],['REVERSE','r','retreat 1.2 m · head‑on in aisle F'],['COBOT','h','human picker 1.8 m · slowed to 0.3 m/s'],['TURNOUT','t','took passing bay B2 · saved 6 s']];
function safeItem(){ const s=pick(SAFE); return {t:s[0],c:s[1],w:`<span class="ev ${s[1]}">${s[0]}</span><b>${pick(bots).id}</b> ${s[2].replace('{b}',pick(bots).id)}`}; }
S.led='disp';
for(let i=0;i<8;i++){ ledgers.disp.push({...dispItem(),ts:clock()}); ledgers.safe.push({...safeItem(),ts:clock()}); }
function renderLedger(){ $('#ledger').innerHTML=ledgers[S.led].map(l=>`<div class="lg"><span class="t">${l.ts}</span><div class="w">${l.c&&!l.w.includes('class="ev')?`<span class="ev ${l.c}">${l.t}</span>`:''}${l.w}</div></div>`).join(''); }
$('#ledTabs').onclick=e=>{ const b=e.target.closest('button'); if(!b) return; $$('#ledTabs button').forEach(x=>x.classList.toggle('on',x===b)); S.led=b.dataset.l; renderLedger(); };

/* inspector */
const FSM=['NAVIGATING_TO_PICKUP','PICKING','NAVIGATING_TO_DELIVERY','DELIVERING','CHARGING','YIELDING','BACKING_OFF'];
S.insp='bot';
function renderInsp(){
  $$('#inspTabs button').forEach(b=>b.classList.toggle('on',b.dataset.i===S.insp));
  const el=$('#insp');
  if(S.insp==='bot'){
    const b=bots.find(x=>x.id===S.sel)||bots[11]; S.sel=b.id;
    const fs=b.st==='CHG'?'CHARGING':b.st==='FAULT'?'BACKING_OFF':b.yield?'YIELDING':b.st==='IDLE'?'—':(b.path.length>1?'NAVIGATING_TO_PICKUP':'NAVIGATING_TO_DELIVERY');
    const cells=Math.round(b.bat/10), v=b.st==='NAV'?(b.yield?.3:b.spd/5).toFixed(2):'0.00';
    const near=bots.filter(o=>o!==b).map(o=>({o,d:Math.hypot(o.x-b.x,o.y-b.y)})).sort((a,c)=>a.d-c.d)[0];
    el.innerHTML=`<div class="insp-head"><div class="botpic"><svg><use href="#i-bot"/></svg></div><div style="flex:1"><div class="id">${b.id}</div><div class="prof">${b.prof} · payload ${b.prof==='Heavy Transport'?'184':'22'} kg</div></div></div>
      <span class="fsm" style="${b.st==='FAULT'?'background:var(--red-soft);color:var(--red)':b.yield?'background:var(--amber-soft);color:#94640A':''}">● ${fs}</span>
      <div class="fsm-track">${FSM.map(f=>`<span class="${f===fs?'on':''}">${f.replace(/_/g,' ').replace('NAVIGATING','NAV')}</span>`).join('')}</div>
      <div class="batt"><span class="cell">${Array.from({length:10},(_,i)=>`<span class="${i<cells?'on':''}" style="${b.bat<25&&i<cells?'background:var(--red)':''}"></span>`).join('')}</span><span class="pct">${Math.round(b.bat)}%</span><span class="eta">fast‑charge<br><b>${Math.round((100-b.bat)*.32)} min</b> to full</span></div>
      <div class="tele"><div><div class="k">Position (x, y)</div><div class="v">${b.x.toFixed(1)}, ${b.y.toFixed(1)}<small> m</small></div></div><div><div class="k">Velocity</div><div class="v">${v}<small> m/s</small></div></div>
      <div><div class="k">Odometer</div><div class="v">${fmt(12000+bots.indexOf(b)*311)}<small> m</small></div></div><div><div class="k">Energy</div><div class="v">${fmt(840+bots.indexOf(b)*17)}<small> Wh</small></div></div></div>
      <div class="radar"><svg viewBox="0 0 96 96"><circle cx="48" cy="48" r="44" fill="none" stroke="#2C3448"/><circle cx="48" cy="48" r="29" fill="none" stroke="#2C3448"/><circle cx="48" cy="48" r="14" fill="none" stroke="#2C3448"/>
        <path d="M48 48 L48 4 A44 44 0 0 1 86 26 Z" fill="rgba(63,208,185,.22)"><animateTransform attributeName="transform" type="rotate" from="0 48 48" to="360 48 48" dur="2.4s" repeatCount="indefinite"/></path>
        <circle cx="${48+Math.min(40,near.d*9)*.7}" cy="${48-Math.min(40,near.d*9)*.7}" r="3.5" fill="#FF8A5C"/><circle cx="48" cy="48" r="3" fill="#fff"/></svg>
        <div><div class="k">LiDAR · nearest</div><div class="v"><b>${near.o.id}</b></div><div class="k">Distance</div><div class="v">${near.d.toFixed(2)} m</div><div class="k">Safe margin</div><div class="v" style="color:${near.d<1.6?'#FF8A5C':'#3FD0B9'}">${(near.d-1.2).toFixed(2)} m ${near.d<1.6?'· YIELD':'· CLEAR'}</div></div></div>`;
  } else if(S.insp==='rack'){
    const r=racks.find(x=>x.id===S.sel)||racks[5]; S.sel=r.id;
    const T=[['L4','Heavy Lift · Atta 25 kg','pick 11.2 s',1],['L3','Detergent 4 L','pick 6.4 s',2],['L2','Biscuits multipack','pick 3.8 s',3],['L1','Fast‑Pick · Amul Milk 1 L','pick 1.1 s',5]];
    el.innerHTML=`<div class="insp-head"><div class="botpic" style="background:var(--paper-2)"><svg viewBox="0 0 24 24" style="width:26px;height:26px"><path fill="none" stroke="#121826" stroke-width="2" d="M4 3v18M20 3v18M4 7h16M4 12h16M4 17h16"/></svg></div><div><div class="id">${r.id}</div><div class="prof">Zone ${r.id[2]} · Aisle ${r.id[2]} · Bay ${r.id[3]} · 4‑tier selective</div></div></div>
      <div class="tiers">${T.map(t=>`<div class="tier"><span class="l">${t[0]}</span><div><div class="s">${t[1]}</div><div class="m">${t[2]} · ${Math.floor(rnd(12,140))} units</div></div><span class="vel">${[1,2,3,4,5].map(i=>`<span class="${i<=t[3]?'on':''}"></span>`).join('')}</span></div>`).join('')}</div>
      <div class="life-tele"><span>Fill <b>78%</b></span><span>Picks / h <b>142</b></span><span>Re‑slot score <b style="color:var(--teal)">A</b></span></div>`;
  } else {
    const s=stations.find(x=>x.id===S.sel)||stations[1]; S.sel=s.id; const q=Math.floor(rnd(2,7));
    el.innerHTML=`<div class="insp-head"><div class="botpic"><svg viewBox="0 0 24 24" style="width:26px;height:26px"><path fill="none" stroke="#fff" stroke-width="2" d="M3 9h18v11H3zM7 9V5h10v4M9 14h6"/></svg></div><div><div class="id">${s.id}</div><div class="prof">Packing Station · 2 operators</div></div></div>
      <div class="tele"><div><div class="k">Queue depth</div><div class="v">${q}<small> bots</small></div></div><div><div class="k">Output</div><div class="v">${Math.floor(rnd(280,340))}<small> /h</small></div></div></div>
      <div class="sec" style="margin-top:12px">Incoming robots</div>
      ${bots.slice(12,12+q).map((b,i)=>`<div class="ledger-row" style="font-size:11px"><span class="mono">${b.id}</span><span class="mono" style="color:var(--mute)">ETA ${8+i*11}s</span></div>`).join('')}`;
  }
}
$('#inspTabs').onclick=e=>{ const b=e.target.closest('button'); if(!b) return; S.insp=b.dataset.i; S.sel=null; renderInsp(); };

/* ───────── Header controls ───────── */
$('#playBtn').onclick=()=>{ S.playing=!S.playing; $('#playBtn').innerHTML=`<svg><use href="#i-${S.playing?'pause':'play'}"/></svg>`; const l=$('#liveBadge'); l.innerHTML=S.playing?'<i></i>LIVE':'❚❚ PAUSED'; l.style.color=S.playing?'':'var(--mute)'; };
$$('#transport [data-speed]').forEach(b=>b.onclick=()=>{ S.speed=+b.dataset.speed; $$('#transport [data-speed]').forEach(x=>x.classList.toggle('on',x===b)); });
$$('#viewSw button').forEach(b=>b.onclick=()=>{ S.view=b.dataset.v; $$('#viewSw button').forEach(x=>x.classList.toggle('on',x===b)); fit(); });
$$('#camSw button').forEach(b=>b.onclick=()=>{ $$('#camSw button').forEach(x=>x.classList.toggle('on',x===b)); toast('Camera → '+b.textContent.trim()); });
$$('#tools [data-tool]').forEach(b=>b.onclick=()=>{ S.tool=b.dataset.tool; S.measure=null; $$('#tools [data-tool]').forEach(x=>x.classList.toggle('on',x===b)); cv.style.cursor=S.tool==='ruler'?'crosshair':S.tool==='pan'?'grab':'default'; });
$$('#tools [data-layer]').forEach(b=>b.onclick=()=>{ b.classList.toggle('on'); S[b.dataset.layer]=b.classList.contains('on'); });

$('#chaos').addEventListener('click',e=>{
  const b=e.target.closest('[data-mode]'); if(!b) return; const m=b.dataset.mode;
  if(m==='heat'){ if(S.modes.heat && S.heatLong){ S.heatLong=false; $('#heatLbl').textContent='DECAY'; toast('Heatmap: short‑term congestion decay'); return; }
    S.modes.heat=!S.modes.heat; S.heatLong=true; $('#heatLbl').textContent='LONG'; b.classList.toggle('on',S.modes.heat); return; }
  if(m==='surge'){ S.modes.surge=!S.modes.surge; b.classList.toggle('on',S.modes.surge); $('#surgeBanner').classList.toggle('on',S.modes.surge);
    if(S.modes.surge){ for(let i=0;i<6;i++) tasks.unshift(mkTask('FLASH_SURGE')); pushAlert('h','FMCG demand spike · Diwali surge','order rate ×3.2 · 6 flash tasks queued'); bots.filter(x=>x.st==='IDLE').forEach(x=>x.st='NAV'); } renderQueue(); return; }
  if(m==='obstacle'){ S.modes.obstacle=!S.modes.obstacle; b.classList.toggle('on',S.modes.obstacle); cv.style.cursor=S.modes.obstacle?'copy':'default'; if(S.modes.obstacle) toast('Click the floor to drop an obstruction'); return; }
  if(m==='fault'){ const v=bots.filter(x=>x.st==='NAV'); const t=pick(v); t.st='FAULT'; S.sel=t.id; S.insp='bot'; renderInsp();
    pushAlert('c',`${t.id} motor stall · fault injected`,`tasks reassigned to ${pick(v).id}`); pushLedger('safe',{t:'REVERSE',c:'r',w:`<span class="ev r">FAILOVER</span><b>${t.id}</b> halted · 2 neighbours rerouted`});
    SUBS[0][1]='warn'; renderHealth(); b.classList.add('on'); setTimeout(()=>b.classList.remove('on'),600); return; }
  if(m==='vip'){ bots.filter(x=>x.st==='NAV').slice(0,5).forEach(x=>{x.vip=true; x.path=[]; setTimeout(()=>x.vip=false,9000);}); for(let i=0;i<5;i++) tasks.unshift(mkTask('HIGH')); renderQueue();
    pushAlert('i','VIP swarm · 5 priority orders','preempting NORMAL traffic in Zones B–D'); toast('5 VIP orders spawned · preempting standard traffic'); return; }
  if(m==='slot'){ b.classList.add('on'); toast('AI slotting: moving 38 high‑velocity SKUs to L1 near PK‑02'); setTimeout(()=>{ b.classList.remove('on'); pushAlert('i','Re‑slot complete','avg pick path −14% · 38 SKUs moved'); },1800); }
});

document.addEventListener('keydown',e=>{ if(e.target.tagName==='INPUT') return; if(e.code==='Space'){e.preventDefault();$('#playBtn').click();} });

/* ───────── Live ticker ───────── */
let done=3418;
setInterval(()=>{
  $('#clock').textContent=clock(); $('#tick').textContent=fmt(S.tick);
  if(!S.playing) return;
  const surge=S.modes.surge?3.2:1;
  done+=Math.round(rnd(0,2)*S.speed); $('#done').textContent=fmt(done); life[4][1]=done;
  life.forEach((l,i)=>{ if(i<4) l[1]=Math.max(10,l[1]+rnd(-3,4)*surge); }); renderLife();
  const pace=Math.round(1200+rnd(40,120)*(S.modes.surge?.4:1)+(S.modes.surge?-60:0)); $('#pace').textContent=fmt(pace); $('#paceBar').style.width=Math.min(100,pace/1500*100)+'%';
  $('#inflight').textContent=Math.round(55+rnd(0,12)*surge); $('#cycle').textContent=Math.round(138+rnd(0,8)+(S.modes.surge?24:0));
  $('#sla').textContent=(S.modes.surge?94.1:97.4+rnd(-.2,.2)).toFixed(1); $('#util').textContent=Math.round(fleetCounts().Active/bots.length*100);
  $('#astar').textContent=(rnd(.3,.6)*(S.modes.surge?1.8:1)).toFixed(2)+'ms';
  tasks.forEach(t=>t.p=Math.min(1,t.p+rnd(.01,.06)*S.speed)); tasks=tasks.filter(t=>t.p<1.04); while(tasks.length<14) tasks.push(mkTask(S.modes.surge&&Math.random()<.4?'FLASH_SURGE':null));
  $('#qCount').textContent=`${Math.round(60*surge)} live tasks`;
  renderQueue(); renderDonut(); if(S.insp==='bot') renderInsp();
},1000);
setInterval(()=>{ if(!S.playing) return; pushLedger('disp',dispItem()); if(Math.random()<.6) pushLedger('safe',safeItem());
  const last=actual[actual.length-1]; actual.push(Math.round(last+rnd(240,360)*(S.modes.surge?1.35:1))); target.push(target[target.length-1]+300); labels.push(''); if(actual.length>30){actual.shift();target.shift();labels.shift();} chart.update('none'); },2600);
setInterval(()=>{ if(!S.playing) return; const A=[['h','Charging dock saturation','DC pads 6 / 7 occupied · queue 3'],['i','Cobot proximity slow','AMR in Zone C · human 1.6 m'],['h','Temporary aisle bottleneck','Aisle D · 4 bots queued · 18 s wait'],['i','FMCG demand spike','Beverages +42% in last 15 min']]; pushAlert(...pick(A)); },9000);

/* boot */
renderHealth(); renderQueue(); renderDonut(); renderLife(); renderLedger(); renderInsp();
pushAlert('i','Cobot proximity slow','AMR‑22 Zone C · human 1.6 m'); pushAlert('h','Charging dock saturation','DC pads 6 / 7 occupied'); pushAlert('h','FMCG demand spike','Beverages +42% · Zone B');
fit(); requestAnimationFrame(loop);
