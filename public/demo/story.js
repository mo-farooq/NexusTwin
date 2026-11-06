/* Story Mode controller: Build → Stress → Compare → Decide */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const fmt=n=>Math.round(n).toLocaleString('en-IN');
const inr=v=>Math.abs(v)>=1e7?'₹'+(v/1e7).toFixed(1)+' Cr':'₹'+Math.round(v/1e5)+' L';
function toast(m){ const t=$('#toast'); t.querySelector('span').textContent=m; t.classList.add('on'); clearTimeout(t._h); t._h=setTimeout(()=>t.classList.remove('on'),2200); }

const cfg={W:84,H:52,clusters:8,fleet:48,seed:7,ver:0};
const st={idx:0,speed:8,obstacle:false,surge:false};
const NAMES=['Build','Stress','Compare','Decide'];

/* ── twins ── */
const build=new Twin($('#cvBuild'),{...cfg,view:'2d',paths:true,labels:false,speed:4});
const stress=new Twin($('#cvStress'),{...cfg,view:'3d'});
const twA=new Twin($('#cvA'),{...cfg,view:'3d',labels:false,accent:'#121826'});
const twB=new Twin($('#cvB'),{...cfg,fleet:64,view:'3d',labels:false});
const ver={stress:0,cmp:0};
function relayout(t,fleet){ t.layout({W:cfg.W,H:cfg.H,clusters:cfg.clusters,fleet:fleet??cfg.fleet,seed:cfg.seed}); t.fit(); }

/* ── 01 Build ── */
const PRE=[[40,30,4,12],[84,52,8,48],[140,90,15,120]];
function applyBuild(){
  cfg.W=+bW.value; cfg.H=+bD.value; cfg.clusters=+bR.value; cfg.fleet=+bF.value; cfg.ver++;
  bWv.textContent=cfg.W+' m'; bDv.textContent=cfg.H+' m'; bRv.textContent=cfg.clusters; bFv.textContent=cfg.fleet;
  relayout(build);
  const area=cfg.W*cfg.H; sArea.textContent=fmt(area)+' m²'; sRacks.textContent=build.racks.length*2; sSt.textContent=build.stations.length;
  sCls.textContent=area<2000?'Dark store':area<8000?'Hub':'Mega';
  const per=area/cfg.fleet; bClear.textContent=per.toFixed(1)+' m²'; bClear.style.color=per<25?'#FF8A8A':'#FFB08F';
  $('#cAn').textContent=cfg.fleet;
}
['bW','bD','bR','bF'].forEach(id=>document.getElementById(id).oninput=()=>{ $$('#preset button').forEach(b=>b.classList.remove('on')); applyBuild(); });
$$('#preset button').forEach(b=>b.onclick=()=>{ $$('#preset button').forEach(x=>x.classList.toggle('on',x===b)); [bW,bD,bR,bF].forEach((el,i)=>el.value=PRE[b.dataset.p][i]); applyBuild(); });

/* ── 02 Stress ── */
function simClock(t){ const s=Math.floor(14*3600+t)%86400; return [s/3600,s/60%60,s%60].map(v=>String(Math.floor(v)).padStart(2,'0')).join(':'); }
function ev(cls,html){ const el=document.createElement('div'); el.className='evt '+cls; el.innerHTML=`<span class="t">${simClock(stress.t)}</span><span>${html}</span>`; $('#events').prepend(el); while($('#events').children.length>9) $('#events').lastChild.remove(); }
function resetStress(){ relayout(stress); stress.surge=1; st.surge=false; st.obstacle=false; ver.stress=cfg.ver; $$('#chaos button').forEach(b=>b.classList.remove('on')); $('#events').innerHTML='';
  ev('g',`<b>Twin online.</b> ${cfg.fleet} AMRs on a ${cfg.W}×${cfg.H} m floor, 2,400 orders/h demand.`); }
$('#chaos').onclick=e=>{ const b=e.target.closest('button'); if(!b) return; const c=b.dataset.c;
  if(c==='surge'){ st.surge=!st.surge; stress.surge=st.surge?3:1; b.classList.toggle('on',st.surge);
    ev(st.surge?'h':'g',st.surge?'<b>Diwali surge.</b> Demand ×3 → 7,200 orders/h. Watch backlog and SLA.':'<b>Surge ended.</b> Demand back to 2,400 orders/h.'); }
  if(c==='obstacle'){ st.obstacle=!st.obstacle; b.classList.toggle('on',st.obstacle); $('#cvStress').style.cursor=st.obstacle?'copy':'default'; if(st.obstacle) toast('Click anywhere on the floor to drop a pallet'); }
  if(c==='fault'){ const x=stress.breakdown(); if(x) ev('c',`<b>${x.id} motor stall.</b> Its order went back to the queue and was re‑dispatched.`); }
  if(c==='vip'){ stress.vip(8); ev('i','<b>VIP swarm.</b> 8 priority orders jump the queue; other robots give way to them.'); }
  if(c==='reset') resetStress();
};
$('#cvStress').addEventListener('click',e=>{ if(!st.obstacle) return; const r=e.target.getBoundingClientRect(); const [x,y]=stress.unP(e.clientX-r.left,e.clientY-r.top);
  if(x>0&&x<stress.W&&y>0&&y<stress.H){ stress.dropObstacle(x,y); ev('h',`<b>Pallet dropped</b> at (${x.toFixed(0)}, ${y.toFixed(0)}) m. Robots slow and squeeze past.`); } });
function stressHud(){ const m=stress.metrics();
  kThr.textContent=fmt(m.thr); kThrD.textContent=`demand ${fmt(2400*stress.surge)} / h`;
  kSla.textContent=m.sla.toFixed(1); kCong.textContent=(m.cong*100).toFixed(1); kUtil.textContent=`util ${Math.round(m.util*100)}% · ${m.states.Faulted} faulted`;
  kBack.textContent=m.backlog; kCyc.textContent=`cycle ${Math.round(m.cycle)} s`;
  tagSla.classList.toggle('hot',m.sla<90); tagCong.classList.toggle('hot',m.cong>.2); tagBack.classList.toggle('hot',m.backlog>40);
  if(m.sla<90&&!st.slaWarn){ st.slaWarn=true; ev('c',`<b>SLA breach.</b> On‑time fell to ${m.sla.toFixed(0)}%. This fleet can't absorb the surge.`); } if(m.sla>95) st.slaWarn=false; }

/* ── 03 Compare ── */
let mA=null,mB=null;
function restartCompare(){ const s=cS.value/10; relayout(twA,cfg.fleet); relayout(twB,+cF.value); twA.surge=twB.surge=s; ver.cmp=cfg.ver; $('#cAn').textContent=cfg.fleet; $('#cBn').textContent=cF.value; }
cF.oninput=()=>{ cFv.textContent=cF.value; restartCompare(); };
cS.oninput=()=>{ cSv.textContent='×'+(cS.value/10).toFixed(1); restartCompare(); };
cRun.onclick=()=>{ restartCompare(); toast('Both twins restarted with the same seed'); };
function dCard(k,a,b,unit,better,dec=0){ const d=b-a, good=better==='up'?d>=0:d<=0, pct=a?d/a*100:0;
  return `<div class="dl-card"><div class="k">${k}</div><div class="row"><span>${a.toFixed(dec)}${unit}</span><span>${b.toFixed(dec)}${unit}</span></div>
    <div class="delta" style="color:${Math.abs(pct)<1?'var(--mute)':good?'var(--teal)':'var(--red)'}">${d>=0?'+':''}${Math.abs(a)>0?pct.toFixed(0)+'%':d.toFixed(dec)}</div></div>`; }
function cmpHud(){ mA=twA.metrics(); mB=twB.metrics();
  const tot=Math.max(1,mA.thr+mB.thr);
  $('#deltas').innerHTML=`<div class="vs">BASELINE · PROPOSED</div>
    <div class="dl-card"><div class="k">Throughput · orders/h</div><div class="row"><span>${fmt(mA.thr)}</span><span>${fmt(mB.thr)}</span></div>
      <div class="race"><i style="width:${mA.thr/tot*100}%;background:var(--ink)"></i><i style="width:${mB.thr/tot*100}%;background:var(--signal)"></i></div>
      <div class="delta" style="color:${mB.thr>=mA.thr?'var(--teal)':'var(--red)'}">${mB.thr>=mA.thr?'+':''}${mA.thr?((mB.thr-mA.thr)/mA.thr*100).toFixed(0):0}%</div></div>`
    +dCard('On‑time SLA',mA.sla,mB.sla,'%','up',1)+dCard('Congestion · % yielding',mA.cong*100,mB.cong*100,'%','down',1)+dCard('Cycle time',mA.cycle,mB.cycle,' s','down');
  const simMin=Math.floor(twA.t/60);
  let say=`<div class="k">READ‑OUT · ${simMin} SIM‑MIN</div>`;
  if(simMin<4) say+='Warming up. Give both twins a few simulated minutes…';
  else if(mB.thr>mA.thr*1.05&&mB.cong<.3) say+=`<b>${cF.value} AMRs</b> ship <b>${fmt(mB.thr-mA.thr)} more orders/h</b> during the surge, without gridlock. Worth pricing out.`;
  else if(mB.cong>mA.cong*1.6&&mB.thr<mA.thr*1.05) say+=`Diminishing returns: <b>${cF.value} AMRs</b> spend <b>${(mB.cong*100).toFixed(0)}%</b> of their time giving way. The aisles, not the fleet, are the limit.`;
  else say+='Little difference so far. Try a bigger surge or a different fleet size.';
  $('#cSay').innerHTML=say; }

/* ── 04 Decide ── */
let cash;
function headlessWarm(){ if(twA.t>=420) return; for(let i=0;i<(600-twA.t)/.5;i++){ twA.step(.5); twB.step(.5); } toast('Ran 10 simulated minutes headless for the numbers'); }
function decide(){
  mA=twA.metrics(); mB=twB.metrics();
  const w=+iW.value, q=+iQ.value, unit=iC.value*1e4, m=iM.value/100, el=iE.value/10, mg=+iO.value;
  iWv.textContent='₹'+w; iQv.textContent=q; iCv.textContent='₹'+(unit/1e5).toFixed(1)+' L'; iMv.textContent=Math.round(m*100)+'%'; iEv.textContent='₹'+el.toFixed(1); iOv.textContent='₹'+mg;
  const N=twB.bots.length, hours=8*312, normal=Math.min(2400,mB.thr||2400);
  const pickerH=normal/q*hours, labour=pickerH*w;
  const surgeGain=Math.max(0,mB.thr-mA.thr)*8*20*mg;
  const kwhH=twB.t>0?twB.energy/(twB.t/3600):N*.25; const energy=kwhH*hours*el;
  const capex=N*unit, maint=capex*m, net=labour+surgeGain-energy-maint, pb=net>0?capex/(net/12):Infinity;
  lL.textContent=inr(labour); lS.textContent=inr(surgeGain); lE.textContent='−'+inr(energy); lM.textContent='−'+inr(maint); lN.textContent=inr(net); lN.style.color=net>0?'var(--teal)':'var(--red)';
  dPb.innerHTML=(isFinite(pb)?Math.round(pb):'∞')+'<small>months</small>';
  const cls=pb<=24?'go':pb<=42?'maybe':'no'; dStamp.className='stamp '+cls; dStamp.textContent=cls==='go'?'GO · STRONG CASE':cls==='maybe'?'PILOT FIRST':'NO‑GO AT THESE INPUTS';
  dNet.textContent=inr(net); dCap.textContent=inr(capex); d5.textContent=inr(net*5-capex);
  dSay.innerHTML=isFinite(pb)?`A <b>${N}‑robot fleet</b> replaces about <b>${fmt(normal/q)} picker positions</b> per shift and pays back in <b>${Math.round(pb)} months</b>. ${cls==='go'?'Under two years: take it to the board.':cls==='maybe'?'Borderline: pilot one zone, or test a smaller fleet in Compare.':'Fleet CapEx outweighs savings. Go back to Compare and shrink the fleet.'}`:'At these inputs the fleet never pays back. Lower CapEx or fleet size.';
  dSim.innerHTML=`Proposed fleet <b>${N} AMRs</b> · surge throughput <b>${fmt(mB.thr)}</b> vs <b>${fmt(mA.thr)}</b> orders/h · fleet draw <b>${kwhH.toFixed(1)} kWh/h</b> · SLA <b>${mB.sla.toFixed(1)}%</b>.`;
  const months=Array.from({length:61},(_,i)=>i), data=months.map(i=>Math.round((-capex+net/12*i)/1e5));
  const ds={labels:months,datasets:[{data,borderColor:'#FFB08F',borderWidth:2.4,pointRadius:0,tension:.15,fill:{target:{value:0},above:'rgba(63,208,185,.22)',below:'rgba(255,138,138,.16)'}}]};
  if(!cash) cash=new Chart(cvCash,{type:'line',data:ds,options:{responsive:true,maintainAspectRatio:false,animation:{duration:350},plugins:{legend:{display:false},tooltip:{callbacks:{title:t=>'Month '+t[0].label,label:c=>'₹'+c.raw+' L cumulative'}}},
    scales:{x:{grid:{display:false},ticks:{color:'#8B93A7',font:{size:9},maxTicksLimit:7,callback:(v,i)=>i%12===0?'M'+i:''},border:{color:'rgba(255,255,255,.15)'}},y:{grid:{color:'rgba(255,255,255,.06)'},ticks:{color:'#8B93A7',font:{size:9},callback:v=>'₹'+v+'L'},border:{display:false}}}}});
  else { cash.data=ds; cash.update(); }
}
['iW','iQ','iC','iM','iE','iO'].forEach(id=>document.getElementById(id).oninput=decide);

/* ── navigation ── */
function go(i){
  i=Math.max(0,Math.min(3,i)); st.idx=i;
  $$('.scene').forEach((s,k)=>{ s.classList.toggle('on',k===i); s.classList.toggle('prev',k<i); });
  $$('.step').forEach((s,k)=>{ s.classList.toggle('on',k===i); s.classList.toggle('done',k<i); });
  $$('.link-line').forEach((l,k)=>l.classList.toggle('done',k<i));
  progBar.style.width=(i+1)*25+'%'; prev.style.visibility=i?'visible':'hidden';
  next.textContent=i<3?`Next: ${NAMES[i+1]} →`:'Open operator view →';
  if(i===1&&ver.stress!==cfg.ver) resetStress();
  if(i===2&&ver.cmp!==cfg.ver) restartCompare();
  if(i===3){ if(ver.cmp!==cfg.ver) restartCompare(); headlessWarm(); decide(); }
  [build,stress,twA,twB].forEach(t=>t.fit());
}
$$('.step').forEach(s=>s.onclick=()=>go(+s.dataset.s));
next.onclick=()=>st.idx<3?go(st.idx+1):location.href='index.html';
prev.onclick=()=>go(st.idx-1);
document.addEventListener('keydown',e=>{ if(e.target.tagName==='INPUT') return; if(e.key==='ArrowRight') go(st.idx+1); if(e.key==='ArrowLeft') go(st.idx-1); });
$$('#speed button').forEach(b=>b.onclick=()=>{ st.speed=+b.dataset.x; $$('#speed button').forEach(x=>x.classList.toggle('on',x===b)); });

/* ── loop: only the visible scene simulates ── */
let last=performance.now(), hudT=0;
function loop(now){
  const dt=Math.min(.05,(now-last)/1000); last=now; hudT+=dt;
  const active=[[build],[stress],[twA,twB],[]][st.idx];
  const sim=dt*(st.idx===0?2:st.speed);
  active.forEach(t=>{ let r=sim; while(r>0){ const h=Math.min(.25,r); t.step(h); r-=h; } t.draw(now); });
  if(hudT>.4){ hudT=0; if(st.idx===1) stressHud(); if(st.idx===2) cmpHud(); }
  requestAnimationFrame(loop);
}
applyBuild(); resetStress(); restartCompare(); go(0); requestAnimationFrame(loop);
