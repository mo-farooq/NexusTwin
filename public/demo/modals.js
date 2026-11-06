/* Drawers & modals: What‑If Engine, Decision Sandbox (ROI), Warehouse Studio */
const OV=document.getElementById('overlays');
OV.innerHTML=`
<aside class="drawer" id="whatif">
  <div class="mh"><div class="ic" style="background:var(--signal)"><svg><use href="#i-flask"/></svg></div>
    <div><div class="t">Headless What‑If Engine</div><div class="s">100× Monte Carlo · same layout, same seed, no rendering</div></div><span class="sp"></span>
    <button class="close" data-close><svg width="14" height="14"><use href="#i-x"/></svg></button></div>
  <div class="mb">
    <div class="two" style="margin-bottom:16px">
      <div class="scn"><div class="h"><b>Baseline</b><span>CURRENT</span></div>
        <div class="ledger-row"><span>Fleet size</span><b>48</b></div><div class="ledger-row"><span>Storage racks</span><b>32</b></div><div class="ledger-row"><span>Order surge</span><b>×1.0</b></div></div>
      <div class="scn prop"><div class="h"><b>Proposed</b><span>SCENARIO B</span></div>
        <div class="field"><div class="row"><label>Fleet size</label><span class="val" id="wFv">60</span></div><input type="range" id="wF" min="24" max="96" value="60"></div>
        <div class="field"><div class="row"><label>Storage racks</label><span class="val" id="wRv">36</span></div><input type="range" id="wR" min="20" max="56" value="36"></div>
        <div class="field" style="margin:0"><div class="row"><label>Order surge rate</label><span class="val" id="wSv">×2.5</span></div><input type="range" id="wS" min="10" max="40" value="25"></div></div>
    </div>
    <div class="sec">Delta vs baseline</div>
    <div class="three" style="grid-template-columns:repeat(4,minmax(0,1fr));margin-bottom:14px">
      <div class="kpi"><div class="k">Throughput Δ</div><div class="v" id="kT" style="color:var(--teal)">+18.4%</div><div class="s" id="kTs">1,520 u/h · p90 1,610</div></div>
      <div class="kpi"><div class="k">Congestion index</div><div class="v" id="kC">0.42</div><div class="s" id="kCs">baseline 0.31</div></div>
      <div class="kpi"><div class="k">Energy / shift</div><div class="v" id="kE">212<small style="font-size:13px"> kWh</small></div><div class="s" id="kEs">+38 kWh</div></div>
      <div class="kpi"><div class="k">Deadlocks</div><div class="v" id="kD">0</div><div class="s">across 100 runs</div></div>
    </div>
    <div class="two">
      <div class="panel"><div class="sec" style="margin-top:0">Bottleneck heatmap · proposed</div><div class="heat" id="wHeat"></div>
        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--mute);margin-top:6px"><span>Inbound</span><span>Aisle C–D hot spot</span><span>Packing</span></div></div>
      <div class="panel"><div class="sec" style="margin-top:0">Throughput distribution · 100 runs</div><div class="mc"><canvas id="wDist"></canvas></div></div>
    </div>
  </div>
  <div class="mf"><span class="note" id="wNote">Last run · 100 seeds · 2.1 s wall clock</span><span class="sp"></span>
    <button class="btn">Export CSV</button><button class="btn primary run" id="wRun">▶ Run 100× Monte Carlo<span class="prog"></span></button></div>
</aside>

<div class="modal" id="sandbox">
  <div class="mh"><div class="ic" style="background:var(--ink)"><svg><use href="#i-coin"/></svg></div>
    <div><div class="t">Decision Sandbox</div><div class="s">CapEx / OpEx model · manual vs automated · all figures editable</div></div><span class="sp"></span>
    <div class="seg" style="width:220px"><button class="on">Manual vs AMR</button><button>Vendor A vs B</button></div>
    <button class="close" data-close><svg width="14" height="14"><use href="#i-x"/></svg></button></div>
  <div class="mb">
    <div class="roi-hero"><div><div class="k">Payback period</div><div class="pb" id="pb">19<small>months</small></div></div>
      <div><div class="k">Verdict</div><div class="l" id="verdict">At 48 AMRs replacing 62 pickers, NexusTwin projects the fleet pays for itself in <b>19 months</b>, then saves <b>₹2.1 Cr / year</b>. Sensitivity: every +₹20/h in labour wage pulls payback in by ~2 months.</div></div></div>
    <div class="two">
      <div class="panel">
        <div class="sec" style="margin-top:0">Inputs</div>
        <div class="field"><div class="row"><label>Labour wage (₹ / hour)</label><span class="val" id="iWv">₹180</span></div><input type="range" id="iW" min="90" max="400" value="180"></div>
        <div class="field"><div class="row"><label>Pickers replaced</label><span class="val" id="iPv">62</span></div><input type="range" id="iP" min="10" max="200" value="62"></div>
        <div class="field"><div class="row"><label>Electricity (₹ / kWh)</label><span class="val" id="iEv">₹8.5</span></div><input type="range" id="iE" min="40" max="160" value="85"></div>
        <div class="field"><div class="row"><label>Robot CapEx (₹ lakh / unit)</label><span class="val" id="iCv">₹6.5L</span></div><input type="range" id="iC" min="20" max="200" value="65"></div>
        <div class="field"><div class="row"><label>Fleet size</label><span class="val" id="iNv">48</span></div><input type="range" id="iN" min="8" max="160" value="48"></div>
        <div class="field" style="margin:0"><div class="row"><label>Maintenance reserve (% CapEx / yr)</label><span class="val" id="iMv">8%</span></div><input type="range" id="iM" min="2" max="20" value="8"></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:14px;min-width:0">
        <div class="panel"><div class="sec" style="margin-top:0">Annual ledger</div>
          <div class="ledger-row"><span>Labour cost avoided</span><b id="oL" style="color:var(--teal)">₹3.2 Cr</b></div>
          <div class="ledger-row"><span>Fleet electricity</span><b id="oE">−₹9.1 L</b></div>
          <div class="ledger-row"><span>Maintenance reserve</span><b id="oM">−₹25 L</b></div>
          <div class="ledger-row tot"><span>Net annual saving</span><b id="oN">₹2.1 Cr</b></div>
          <div class="ledger-row" style="border:0"><span>Upfront CapEx</span><b id="oC">₹3.1 Cr</b></div></div>
        <div class="panel"><div class="sec" style="margin-top:0">Cumulative cash · 48 months</div><div class="mc" style="height:150px"><canvas id="roiChart"></canvas></div></div>
      </div>
    </div>
  </div>
  <div class="mf"><span class="note">Assumes 1 shift × 8 h × 312 days · utilisation from live twin (81%)</span><span class="sp"></span><button class="btn">Download board memo</button><button class="btn ink">Send to What‑If →</button></div>
</div>

<div class="modal" id="studio">
  <div class="mh"><div class="ic" style="background:var(--blue)"><svg><use href="#i-cube"/></svg></div>
    <div><div class="t">Warehouse Studio</div><div class="s">Layout builder · changes rebuild the twin and the A* cost grid</div></div><span class="sp"></span>
    <button class="close" data-close><svg width="14" height="14"><use href="#i-x"/></svg></button></div>
  <div class="mb"><div class="studio">
    <div style="display:flex;flex-direction:column;gap:14px;min-width:0">
      <div><div class="sec" style="margin-top:0">Preset</div><div class="seg" id="sPreset"><button>Dark store</button><button class="on">Hub</button><button>Mega</button></div></div>
      <div><div class="field"><div class="row"><label>Facility width</label><span class="val" id="sWv">84 m</span></div><input type="range" id="sW" min="30" max="160" value="84"></div>
      <div class="field"><div class="row"><label>Facility depth</label><span class="val" id="sDv">52 m</span></div><input type="range" id="sD" min="20" max="110" value="52"></div>
      <div class="field"><div class="row"><label>Rack clusters</label><span class="val" id="sRv">8</span></div><input type="range" id="sR" min="2" max="14" value="8"></div></div>
      <div><div class="sec">Place</div><div class="palette" id="sPal">
        <button class="on"><i style="background:#D2CDBE"></i>Rack cluster</button><button><i style="background:var(--ink)"></i>Packing station</button>
        <button><i style="background:var(--blue)"></i>DC charging bay</button><button><i style="background:var(--signal)"></i>One‑way aisle</button></div></div>
      <div class="panel" style="padding:10px"><div class="ledger-row" style="padding:4px 0"><span>Floor area</span><b id="sA">4,368 m²</b></div><div class="ledger-row" style="padding:4px 0;border:0"><span>Rack positions</span><b id="sP">1,024</b></div></div>
    </div>
    <div class="bp"><svg id="bpSvg" preserveAspectRatio="xMidYMid meet"></svg></div>
  </div></div>
  <div class="mf"><span class="note">Aisle flow is enforced in the pathfinder as a 250× reverse‑direction penalty</span><span class="sp"></span><button class="btn" data-close>Cancel</button><button class="btn primary" id="sApply">Apply to twin</button></div>
</div>`;

const scrim=document.getElementById('scrim');
function openOv(id){ document.querySelectorAll('.drawer,.modal').forEach(m=>m.classList.remove('on')); document.getElementById(id).classList.add('on'); scrim.classList.add('on'); if(id==='sandbox') roi(); if(id==='studio') studio(); if(id==='whatif') whatif(); }
function closeOv(){ document.querySelectorAll('.drawer,.modal').forEach(m=>m.classList.remove('on')); scrim.classList.remove('on'); }
document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openOv(b.dataset.open));
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeOv);
scrim.onclick=closeOv;
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeOv(); if(e.target.tagName!=='INPUT'&&e.key.toLowerCase()==='w') openOv('whatif'); });
const inr=v=>v>=1e7?'₹'+(v/1e7).toFixed(1)+' Cr':'₹'+Math.round(v/1e5)+' L';

/* What‑if */
let dist;
function whatif(){
  const F=+wF.value, R=+wR.value, Sg=wS.value/10;
  wFv.textContent=F; wRv.textContent=R; wSv.textContent='×'+Sg.toFixed(1);
  const sat=Math.min(1,F/(28+R*.9)), thr=(F/48)*Math.pow(.92,Math.max(0,F-60)/6)*(1+(R-32)*.006);
  const dT=(thr-1)*100, cong=Math.min(.95,.31*(F/48)*(Sg/1.6)*(32/R)**.4);
  kT.textContent=(dT>=0?'+':'')+dT.toFixed(1)+'%'; kT.style.color=dT>=0?'var(--teal)':'var(--red)';
  kTs.textContent=`${Math.round(1284*thr).toLocaleString('en-IN')} u/h · p90 ${Math.round(1284*thr*1.06).toLocaleString('en-IN')}`;
  kC.textContent=cong.toFixed(2); kC.style.color=cong>.6?'var(--red)':cong>.4?'var(--amber)':'var(--ink)';
  const e=Math.round(174*F/48*(1+cong*.3)); kE.innerHTML=e+'<small style="font-size:13px"> kWh</small>'; kEs.textContent=(e-174>=0?'+':'')+(e-174)+' kWh';
  kD.textContent=cong>.7?Math.round((cong-.7)*20):0; kD.style.color=cong>.7?'var(--red)':'var(--teal)';
  wHeat.innerHTML=Array.from({length:18*7},(_,i)=>{ const x=i%18,y=Math.floor(i/18); const hot=Math.exp(-((x-8)**2/14+(y-3)**2/5))*cong*1.6+Math.random()*.12;
    const c=hot>.6?'#E0322B':hot>.35?'#FF5A1F':hot>.18?'#E8A10C':hot>.08?'#F6D98A':'#EFEBE0'; return `<span style="background:${c}"></span>`; }).join('');
  const bins=Array.from({length:16},(_,i)=>Math.round(100*Math.exp(-((i-8-dT/6)**2)/6)/4.3));
  const data={labels:bins.map((_,i)=>Math.round(1100+i*40*thr)),datasets:[{data:bins,backgroundColor:bins.map((_,i)=>i>=7&&i<=9?'#FF5A1F':'#E2DED2'),borderRadius:3}]};
  if(!dist) dist=new Chart(wDist,{type:'bar',data,options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{font:{size:9},maxTicksLimit:6}},y:{display:false}}}});
  else { dist.data=data; dist.update(); }
}
['wF','wR','wS'].forEach(id=>document.getElementById(id).oninput=whatif);
wRun.onclick=()=>{ const p=wRun.querySelector('.prog'); p.style.transition='none'; p.style.width='0'; requestAnimationFrame(()=>{ p.style.transition='width 1.6s linear'; p.style.width='100%'; });
  let n=0; const iv=setInterval(()=>{ n+=7; wNote.textContent=`Running seed ${Math.min(100,n)} / 100 …`; if(n>=100){ clearInterval(iv); whatif(); wNote.textContent='Last run · 100 seeds · 1.6 s wall clock · just now'; } },110); };

/* ROI */
let roiC;
function roi(){
  const w=+iW.value, P=+iP.value, el=iE.value/10, cap=iC.value*1e5/10, N=+iN.value, m=iM.value/100;
  iWv.textContent='₹'+w; iPv.textContent=P; iEv.textContent='₹'+el.toFixed(1); iCv.textContent='₹'+(cap/1e5).toFixed(1)+'L'; iNv.textContent=N; iMv.textContent=Math.round(m*100)+'%';
  const hours=8*312, labour=w*P*hours, energy=N*0.45*16*312*el, capex=cap*N, maint=capex*m, net=labour-energy-maint;
  const pb=net>0?capex/(net/12):Infinity;
  oL.textContent=inr(labour); oE.textContent='−'+inr(energy); oM.textContent='−'+inr(maint); oN.textContent=inr(net); oC.textContent=inr(capex);
  oN.style.color=net>0?'var(--teal)':'var(--red)';
  pb_el.innerHTML=(isFinite(pb)?Math.round(pb):'∞')+'<small>months</small>'; pb_el.style.color=pb<24?'#FFB08F':pb<48?'#F6D98A':'#FF8A8A';
  verdict.innerHTML=isFinite(pb)?`At <b>${N} AMRs</b> replacing <b>${P} pickers</b>, the fleet pays for itself in <b>${Math.round(pb)} months</b>, then saves <b>${inr(net)} / year</b>. ${pb<24?'Strong case: under a two‑year payback.':pb<48?'Marginal: test a smaller fleet in the What‑If Engine.':'Weak case: the fleet is oversized for this labour pool.'}`:'Automation never pays back at these inputs. Reduce fleet size or CapEx.';
  const months=Array.from({length:49},(_,i)=>i), cum=months.map(i=>Math.round((-capex+net/12*i)/1e5));
  const data={labels:months,datasets:[{data:cum,borderColor:'#121826',borderWidth:2,pointRadius:0,tension:.2,fill:{target:{value:0},above:'rgba(14,159,142,.18)',below:'rgba(224,50,43,.12)'}}]};
  if(!roiC) roiC=new Chart(roiChart,{type:'line',data,options:{responsive:true,maintainAspectRatio:false,animation:{duration:300},plugins:{legend:{display:false},tooltip:{callbacks:{title:t=>'Month '+t[0].label,label:c=>'₹'+c.raw+' L'}}},
    scales:{x:{grid:{display:false},ticks:{font:{size:9},maxTicksLimit:9}},y:{grid:{color:'rgba(18,24,38,.06)'},ticks:{font:{size:9},callback:v=>'₹'+v+'L'}}}}});
  else { roiC.data=data; roiC.update(); }
}
const pb_el=document.getElementById('pb');
['iW','iP','iE','iC','iN','iM'].forEach(id=>document.getElementById(id).oninput=roi);

/* Studio blueprint */
function studio(){
  const Wd=+sW.value, D=+sD.value, R=+sR.value; sWv.textContent=Wd+' m'; sDv.textContent=D+' m'; sRv.textContent=R;
  sA.textContent=(Wd*D).toLocaleString('en-IN')+' m²'; sP.textContent=(R*4*Math.floor((D-16)/2)*4).toLocaleString('en-IN');
  const s=bpSvg; s.setAttribute('viewBox',`-6 -6 ${Wd+12} ${D+12}`);
  let g=`<defs><pattern id="gp" width="2" height="2" patternUnits="userSpaceOnUse"><path d="M2 0H0V2" fill="none" stroke="rgba(255,255,255,.08)" stroke-width=".08"/></pattern></defs>
    <rect x="0" y="0" width="${Wd}" height="${D}" fill="url(#gp)" stroke="#fff" stroke-width=".35"/>`;
  const gap=(Wd-10)/R;
  for(let i=0;i<R;i++){ const x=6+i*gap; g+=`<rect x="${x}" y="7" width="${Math.min(3.4,gap*.4)}" height="${D-17}" fill="rgba(255,255,255,.08)" stroke="#fff" stroke-width=".18"/>`;
    const ax=x+gap*.7; g+=`<text x="${ax}" y="${D/2}" fill="#FFB08F" font-size="2.2" text-anchor="middle">${i%2?'▲':'▼'}</text>`; }
  [D-6].forEach(y=>{ for(let k=0;k<4;k++){ const x=Wd*(k+1)/5-3; g+=`<rect x="${x}" y="${y}" width="6" height="3.6" fill="#fff" opacity=".9"/><text x="${x+3}" y="${y+2.5}" font-size="1.6" text-anchor="middle" fill="#1D3B8A" font-weight="700">PK-0${k+1}</text>`; } });
  for(let k=0;k<4;k++) g+=`<rect x="0.8" y="${8+k*5}" width="2.4" height="2.4" fill="none" stroke="#9DB4FF" stroke-width=".3"/><text x="2" y="${9.7+k*5}" font-size="1.3" text-anchor="middle" fill="#9DB4FF">DC</text>`;
  g+=`<line x1="0" y1="${D+3}" x2="${Wd}" y2="${D+3}" stroke="#9DB4FF" stroke-width=".15"/><text x="${Wd/2}" y="${D+5}" fill="#9DB4FF" font-size="1.8" text-anchor="middle">${Wd} m</text>
    <line x1="${Wd+3}" y1="0" x2="${Wd+3}" y2="${D}" stroke="#9DB4FF" stroke-width=".15"/><text x="${Wd+4.5}" y="${D/2}" fill="#9DB4FF" font-size="1.8" transform="rotate(90 ${Wd+4.5} ${D/2})" text-anchor="middle">${D} m</text>
    <text x="1" y="-2" fill="#fff" font-size="1.8" letter-spacing=".3">NEXUSTWIN · BLR‑DC‑04 · REV C</text>`;
  s.innerHTML=g;
}
['sW','sD','sR'].forEach(id=>document.getElementById(id).oninput=studio);
document.querySelectorAll('#sPreset button').forEach((b,i)=>b.onclick=()=>{ document.querySelectorAll('#sPreset button').forEach(x=>x.classList.toggle('on',x===b)); [[36,24,3],[84,52,8],[150,100,14]][i].forEach((v,j)=>[sW,sD,sR][j].value=v); studio(); });
document.querySelectorAll('#sPal button').forEach(b=>b.onclick=()=>document.querySelectorAll('#sPal button').forEach(x=>x.classList.toggle('on',x===b)));
sApply.onclick=()=>{ closeOv(); toast('Layout applied · twin & A* cost grid rebuilt'); };
