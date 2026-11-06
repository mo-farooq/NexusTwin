/* Twin: a small deterministic warehouse sim + iso/blueprint renderer.
   Preview stand‑in for the real three.js engine; Story Mode runs several instances side by side. */
(function(){
const COS=Math.cos(Math.PI/6), SIN=Math.sin(Math.PI/6);
const COL={signal:'#FF5A1F',teal:'#0E9F8E',blue:'#2F5BFF',amber:'#E8A10C',red:'#E0322B',ink:'#121826',violet:'#6B4DFF',idle:'#A7A08F'};
function rng(seed){ let a=seed>>>0; return ()=>{ a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

class Twin{
  constructor(canvas,opt={}){
    this.cv=canvas; this.ctx=canvas.getContext('2d');
    this.view=opt.view||'3d'; this.paths=opt.paths??true; this.labels=opt.labels??true; this.accent=opt.accent||COL.signal;
    this.speed=opt.speed||8; this.playing=true; this.onEvent=opt.onEvent||(()=>{});
    this.layout({W:opt.W||84,H:opt.H||52,clusters:opt.clusters||8,fleet:opt.fleet||48,seed:opt.seed||7});
    new ResizeObserver(()=>this.fit()).observe(canvas.parentElement); this.fit();
  }
  layout({W,H,clusters,fleet,seed}){
    Object.assign(this,{W,H,clusters,fleetN:fleet,seed});
    this.r=rng(seed); this.orderR=rng(seed*31+1);
    this.racks=[]; this.aisles=[]; this.stations=[]; this.chargers=[]; this.obstacles=[];
    const gap=(W-10)/clusters, rows=Math.max(1,Math.floor((H-20)/8));
    for(let i=0;i<clusters;i++){ const x=6+i*gap; this.aisles.push(x+Math.min(3.4,gap*.45)+ (gap-Math.min(3.4,gap*.45))/2);
      for(let j=0;j<rows;j++) this.racks.push({id:`R-${String.fromCharCode(65+i%26)}${j+1}`,x,y:9+j*8,w:Math.min(3.4,gap*.45),h:6.4,z:2+((i+j)%3)*.9,ax:this.aisles[i]}); }
    const ns=Math.max(2,Math.min(6,Math.round(W/20)));
    for(let k=0;k<ns;k++){ const cx=W*(k+1)/(ns+1); this.stations.push({id:`PK-0${k+1}`,x:cx-3,y:H-8,w:6,h:4,cx}); }
    const nc=Math.max(2,Math.min(6,Math.round(fleet/10)));
    for(let k=0;k<nc;k++) this.chargers.push({id:`DC-${k+1}`,x:1.2,y:9+k*((H-22)/nc),w:2.4,h:2.4,busy:null});
    this.laneTop=5; this.laneBot=H-10.5;
    this.bots=[]; for(let i=0;i<fleet;i++) this.addBot(i);
    this.t=0; this.orders=[]; this.done=[]; this.yieldT=0; this.moveT=0; this.energy=0; this.surge=1; this.baseRate=opt0.rate; this.orderAcc=0; this.idSeq=48000;
  }
  addBot(i){ const r=this.r; this.bots.push({id:`AMR-${String(i+1).padStart(2,'0')}`,x:this.aisles[i%this.aisles.length],y:this.laneTop+r()*(this.laneBot-this.laneTop),
      st:'IDLE',path:[],dwell:0,bat:40+r()*58,spd:1.5+r()*.3,dir:0,yield:false,fault:false,vip:false}); }
  setFleet(n){ while(this.bots.length<n) this.addBot(this.bots.length); while(this.bots.length>n) this.bots.pop(); this.fleetN=n; }

  /* ── routing on aisle/lane graph ── */
  route(b,tx,ty){
    const p=[]; const sameAisle=Math.abs(b.x-tx)<.2;
    if(sameAisle){ p.push({x:tx,y:ty}); }
    else{ const dTop=Math.abs(b.y-this.laneTop)+Math.abs(ty-this.laneTop), dBot=Math.abs(b.y-this.laneBot)+Math.abs(ty-this.laneBot);
      const lane=dTop<dBot?this.laneTop:this.laneBot; p.push({x:b.x,y:lane},{x:tx,y:lane},{x:tx,y:ty}); }
    b.path=p;
  }
  spawnOrder(pri){ const r=this.orderR; const rk=this.racks[Math.floor(r()*this.racks.length)]; const st=this.stations[Math.floor(r()*this.stations.length)];
    this.orders.push({id:'T-'+(this.idSeq++),rack:rk,st,t0:this.t,pri:pri||'NORMAL',bot:null}); }
  assign(){
    const open=this.orders.filter(o=>!o.bot).sort((a,b)=>(b.pri==='VIP')-(a.pri==='VIP'));
    if(!open.length) return; const free=this.bots.filter(b=>b.st==='IDLE'&&!b.fault);
    for(const o of open){ if(!free.length) break; let bi=0,bd=1e9; free.forEach((b,i)=>{ const d=Math.abs(b.x-o.rack.ax)+Math.abs(b.y-o.rack.y); if(d<bd){bd=d;bi=i;} });
      const b=free.splice(bi,1)[0]; o.bot=b; b.order=o; b.st='TO_PICK'; b.vip=o.pri==='VIP'; this.route(b,o.rack.ax,o.rack.y+o.rack.h/2); }
  }
  step(dt){
    this.t+=dt;
    this.orderAcc+=dt*this.baseRate*this.surge/3600; while(this.orderAcc>=1){ this.orderAcc--; this.spawnOrder(); }
    this.assign();
    for(const b of this.bots){
      if(b.fault){ continue; }
      if(b.st==='CHG'){ b.bat=Math.min(100,b.bat+dt*.6); if(b.bat>90){ b.charger.busy=null; b.st='IDLE'; } continue; }
      if(b.st==='IDLE'){ if(b.bat<22){ const c=this.chargers.find(c=>!c.busy); if(c){ c.busy=b; b.charger=c; b.st='TO_CHG'; this.route(b,c.x+1.2,c.y+1.2);} } continue; }
      if(b.dwell>0){ b.dwell-=dt; if(b.dwell<=0) this.arrive(b,true); continue; }
      if(!b.path.length){ this.arrive(b); continue; }
      const p=b.path[0], dx=p.x-b.x, dy=p.y-b.y, d=Math.hypot(dx,dy);
      let v=b.spd*dt; b.yield=false;
      for(const o of this.bots){ if(o===b) continue; const ox=o.x-b.x, oy=o.y-b.y; if(Math.abs(ox)>1.6||Math.abs(oy)>1.6) continue;
        if(Math.hypot(ox,oy)<1.4&&(ox*dx+oy*dy)>0&&!(b.vip&&!o.vip)){ v*=.12; b.yield=true; break; } }
      for(const o of this.obstacles) if(Math.hypot(o.x-b.x,o.y-b.y)<2.2){ v*=.15; b.yield=true; }
      if(b.yield) this.yieldT+=dt; this.moveT+=dt;
      if(d<=v){ b.x=p.x; b.y=p.y; b.path.shift(); } else { b.x+=dx/d*v; b.y+=dy/d*v; b.dir=Math.atan2(dy,dx); }
      b.bat=Math.max(3,b.bat-dt*.012); this.energy+=dt*0.42/3600; // kWh at ~420 W per moving AMR
    }
  }
  arrive(b,afterDwell){
    if(b.st==='TO_PICK'){ if(!afterDwell){ b.dwell=6; return; } b.st='TO_DROP'; this.route(b,b.order.st.cx,b.order.st.y-1); }
    else if(b.st==='TO_DROP'){ if(!afterDwell){ b.dwell=4; return; } const o=b.order; o.t1=this.t; this.done.push(o); this.orders.splice(this.orders.indexOf(o),1); b.order=null; b.st='IDLE'; b.vip=false; }
    else if(b.st==='TO_CHG'){ b.st='CHG'; }
  }
  metrics(){
    const win=600, recent=this.done.filter(o=>o.t1>this.t-win), span=Math.min(win,Math.max(60,this.t));
    const thr=recent.length/span*3600;
    const cyc=recent.length?recent.reduce((s,o)=>s+(o.t1-o.t0),0)/recent.length:0;
    const onTime=recent.length?recent.filter(o=>o.t1-o.t0<600).length/recent.length:1;
    const waiting=this.orders.filter(o=>!o.bot&&this.t-o.t0>600).length;
    const sla=Math.max(0,onTime*100-waiting*.15);
    const busy=this.bots.filter(b=>b.st==='TO_PICK'||b.st==='TO_DROP').length;
    return {thr,cycle:cyc,sla,cong:this.moveT?this.yieldT/this.moveT:0,backlog:this.orders.filter(o=>!o.bot).length,util:busy/this.bots.length,energy:this.energy,done:this.done.length,
      states:{Active:busy,Charging:this.bots.filter(b=>b.st==='CHG'||b.st==='TO_CHG').length,Idle:this.bots.filter(b=>b.st==='IDLE'&&!b.fault).length,Faulted:this.bots.filter(b=>b.fault).length}};
  }
  breakdown(){ const c=this.bots.filter(b=>!b.fault&&(b.st==='TO_PICK'||b.st==='TO_DROP')); if(!c.length) return null; const b=c[Math.floor(this.r()*c.length)]; b.fault=true;
    if(b.order){ b.order.bot=null; b.order=null; } return b; }
  vip(n=6){ for(let i=0;i<n;i++) this.spawnOrder('VIP'); }
  dropObstacle(x,y){ this.obstacles.push({x,y}); }

  /* ── render ── */
  fit(){ const r=this.cv.parentElement.getBoundingClientRect(), dpr=devicePixelRatio||1; this.VW=r.width; this.VH=r.height;
    this.cv.width=r.width*dpr; this.cv.height=r.height*dpr; this.ctx.setTransform(dpr,0,0,dpr,0,0);
    const {W,H}=this, px=this.VW*.06, py=this.VH*.1;
    if(this.view==='2d'){ this.s=Math.min((this.VW-2*px)/W,(this.VH-2*py)/H); this.ox=(this.VW-W*this.s)/2; this.oy=(this.VH-H*this.s)/2; }
    else{ const sw=(W+H)*COS, sh=(W+H)*SIN; this.s=Math.min((this.VW-2*px)/sw,(this.VH-2*py)/(sh+4)); this.ox=this.VW/2-(W-H)*COS*this.s/2; this.oy=(this.VH-sh*this.s)/2+12; } }
  P(x,y,z=0){ return this.view==='2d'?[this.ox+x*this.s,this.oy+y*this.s]:[this.ox+(x-y)*COS*this.s,this.oy+(x+y)*SIN*this.s-z*this.s]; }
  unP(sx,sy){ if(this.view==='2d') return [(sx-this.ox)/this.s,(sy-this.oy)/this.s]; const a=(sx-this.ox)/(COS*this.s), c=(sy-this.oy)/(SIN*this.s); return [(a+c)/2,(c-a)/2]; }
  poly(pts,f,s,lw=1){ const c=this.ctx; c.beginPath(); pts.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p)); c.closePath(); if(f){c.fillStyle=f;c.fill();} if(s){c.strokeStyle=s;c.lineWidth=lw;c.stroke();} }
  box(r,z,top,s1,s2,st){ const {x,y,w,h}=r,P=this.P.bind(this);
    if(this.view==='3d'&&z>0){ this.poly([P(x+w,y),P(x+w,y+h),P(x+w,y+h,z),P(x+w,y,z)],s1,st,.6); this.poly([P(x,y+h),P(x+w,y+h),P(x+w,y+h,z),P(x,y+h,z)],s2,st,.6); }
    this.poly([P(x,y,z),P(x+w,y,z),P(x+w,y+h,z),P(x,y+h,z)],top,st,.8); }
  draw(now){
    const c=this.ctx,P=this.P.bind(this),bp=this.view==='2d',{W,H}=this; c.clearRect(0,0,this.VW,this.VH);
    this.poly([P(0,0),P(W,0),P(W,H),P(0,H)],bp?'#1D3B8A':'#fff',bp?'#9DB4FF':'#D2CDBE',1.2);
    c.strokeStyle=bp?'rgba(255,255,255,.08)':'rgba(18,24,38,.05)'; c.lineWidth=1;
    for(let x=0;x<=W;x+=4){c.beginPath();c.moveTo(...P(x,0));c.lineTo(...P(x,H));c.stroke();}
    for(let y=0;y<=H;y+=4){c.beginPath();c.moveTo(...P(0,y));c.lineTo(...P(W,y));c.stroke();}
    [this.laneTop,this.laneBot].forEach(y=>{ c.setLineDash([4,4]); c.strokeStyle=bp?'rgba(255,255,255,.3)':'rgba(255,90,31,.32)'; c.beginPath(); c.moveTo(...P(3,y)); c.lineTo(...P(W-1,y)); c.stroke(); c.setLineDash([]); });
    c.font='9px SF Mono, monospace'; c.fillStyle=bp?'#FFB08F':'rgba(18,24,38,.2)'; this.aisles.forEach((x,i)=>{ const [sx,sy]=P(x,H/2-4); c.fillText(i%2?'▲':'▼',sx-3,sy+3); });
    this.stations.forEach(s=>this.box(s,.8,bp?'rgba(255,255,255,.85)':'#121826','#0A0F1A','#232B3C',bp?'#fff':null));
    this.chargers.forEach(k=>this.box(k,.3,bp?'rgba(157,180,255,.15)':'#E4EAFF',null,null,bp?'#9DB4FF':'#2F5BFF'));
    [...this.racks].sort((a,b)=>(a.x+a.y)-(b.x+b.y)).forEach(r=>{ this.box(r,bp?0:r.z,bp?'rgba(255,255,255,.07)':'#F6F4EE','#E2DED2','#D2CDBE',bp?'rgba(255,255,255,.85)':'#B9B3A3');
      if(!bp) for(let k=1;k<4;k++){ const z=r.z*k/4; c.strokeStyle='rgba(18,24,38,.12)'; c.beginPath(); c.moveTo(...P(r.x+r.w,r.y+r.h,z)); c.lineTo(...P(r.x,r.y+r.h,z)); c.stroke(); } });
    this.obstacles.forEach(o=>{ const [sx,sy]=P(o.x,o.y); c.fillStyle=COL.amber; c.beginPath(); c.moveTo(sx,sy-14); c.lineTo(sx-7,sy+2); c.lineTo(sx+7,sy+2); c.closePath(); c.fill();
      c.strokeStyle='rgba(232,161,12,.55)'; c.setLineDash([3,3]); c.beginPath(); c.ellipse(sx,sy,2.2*this.s*(bp?1:1.2),2.2*this.s*(bp?1:.6),0,0,7); c.stroke(); c.setLineDash([]); });
    if(this.paths) this.bots.forEach(b=>{ if(!b.path.length||b.fault) return; c.strokeStyle=bp?'rgba(255,255,255,.3)':(b.vip?'rgba(107,77,255,.5)':'rgba(47,91,255,.22)'); c.lineWidth=1; c.setLineDash([3,4]);
      c.beginPath(); c.moveTo(...P(b.x,b.y)); b.path.forEach(p=>c.lineTo(...P(p.x,p.y))); c.stroke(); c.setLineDash([]); });
    const R=Math.max(2.6,this.s*.6);
    this.bots.forEach((b,i)=>{ const [sx,sy]=P(b.x,b.y,bp?0:.3);
      const col=b.fault?COL.red:(b.st==='CHG'||b.st==='TO_CHG')?COL.blue:b.st==='IDLE'?COL.idle:b.vip?COL.violet:b.yield?COL.amber:this.accent;
      if(this.labels&&(b.st==='TO_PICK'||b.st==='TO_DROP')&&!b.fault){ const a=b.dir; c.fillStyle=b.yield?'rgba(232,161,12,.16)':'rgba(14,159,142,.11)';
        const q=(ang,d)=>P(b.x+Math.cos(ang)*d,b.y+Math.sin(ang)*d,bp?0:.3); const [lx,ly]=q(a+.6,2),[px,py]=q(a,2.4),[rx,ry]=q(a-.6,2);
        c.beginPath(); c.moveTo(sx,sy); c.lineTo(lx,ly); c.lineTo(px,py); c.lineTo(rx,ry); c.closePath(); c.fill(); }
      if(!bp){ c.fillStyle='rgba(18,24,38,.14)'; c.beginPath(); c.ellipse(sx,sy+R*.9,R*1.1,R*.45,0,0,7); c.fill(); }
      c.fillStyle=col; c.beginPath(); c.arc(sx,sy,R,0,7); c.fill(); c.strokeStyle='#fff'; c.lineWidth=1.4; c.stroke();
      if(b.fault){ c.strokeStyle='rgba(224,50,43,.5)'; c.lineWidth=1.5; c.beginPath(); c.arc(sx,sy,R+3+(now/30%12),0,7); c.stroke(); }
      if(this.labels&&(b.fault||i%8===0)){ c.font='600 9px SF Mono, Menlo, monospace'; const w=c.measureText(b.id).width+8;
        c.fillStyle=b.fault?COL.red:COL.ink; c.beginPath(); c.roundRect(sx-w/2,sy-R-16,w,13,3); c.fill(); c.fillStyle='#fff'; c.fillText(b.id,sx-w/2+4,sy-R-6.5); } });
    c.font='700 9px Avenir Next, sans-serif'; c.fillStyle=bp?'#fff':COL.ink;
    this.stations.forEach(s=>{ const [sx,sy]=P(s.x+s.w/2,s.y+s.h+1.8); c.fillText(s.id,sx-14,sy+4); });
  }
}
const opt0={rate:2400};
Twin.rng=rng; window.Twin=Twin;
})();
