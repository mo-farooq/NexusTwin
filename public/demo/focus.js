/* Focus / Full switch for the operator view.
   Focus moves existing panels into on-demand containers (popovers, dock, slide-in inspector);
   Full puts them back where they were. Elements keep their IDs, so app.js keeps updating them. */
(()=>{
  const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)];
  const app=q('.app'), vp=q('#vp');
  const [cFleet,cPerf,cSys,cInc]=qa('.col.l > .card');
  const bottomCards=qa('.bottom > .card');
  const cRight=q('.col.r > .card');
  const homes=new Map();
  [cSys,cInc,cRight,...bottomCards].forEach(el=>{ const m=document.createComment('home'); el.before(m); homes.set(el,m); });

  const popSys=q('#popSys'), popInc=q('#popInc'), dock=q('#dock'), sheet=q('#dockSheet'), inspDock=q('#inspDock');
  let mode=localStorage.getItem('nt-mode')||'focus';

  function setMode(m){
    mode=m; localStorage.setItem('nt-mode',m);
    app.classList.toggle('focus',m==='focus');
    qa('#modeSw button').forEach(b=>b.classList.toggle('on',b.dataset.m===m));
    if(m==='focus'){
      popSys.append(cSys); popInc.append(cInc); inspDock.append(cRight); bottomCards.forEach(c=>sheet.append(c));
    } else {
      closeAll(); homes.forEach((mark,el)=>{ mark.after(el); el.classList.remove('on'); });
    }
    window.dispatchEvent(new Event('resize'));
  }

  /* popovers */
  function togglePop(pop,btn){ const open=!pop.classList.contains('on'); closePops(); if(open){ pop.classList.add('on'); btn.classList.add('on'); } }
  function closePops(){ [popSys,popInc].forEach(p=>p.classList.remove('on')); qa('.kbtn').forEach(b=>b.classList.remove('on')); }
  q('#sysPill').onclick=e=>{ e.stopPropagation(); togglePop(popSys,e.currentTarget); };
  q('#incBtn').onclick=e=>{ e.stopPropagation(); togglePop(popInc,e.currentTarget); };
  document.addEventListener('click',e=>{ if(!e.target.closest('.pop,.kbtn')) closePops(); });

  /* inspector slide-in */
  function openInsp(tab='insp'){ if(mode!=='focus') return; inspDock.classList.add('on'); vp.classList.add('insp-open'); q(`#pTabs [data-p="${tab}"]`).click(); }
  function closeInsp(){ inspDock.classList.remove('on'); vp.classList.remove('insp-open'); }
  q('#inspX').onclick=closeInsp;
  let selBefore=null;
  q('#scene').addEventListener('mousedown',()=>{ selBefore=S.sel; });
  q('#scene').addEventListener('click',()=>{ if(S.modes.obstacle||S.tool!=='sel') return; if(S.sel!==selBefore) openInsp(); else if(mode==='focus') closeInsp(); });
  q('#chaos').addEventListener('click',e=>{ if(e.target.closest('[data-mode="fault"]')) setTimeout(()=>openInsp(),0); });

  /* analytics dock */
  let dockIdx=null;
  function openDock(i){
    if(i==='ledger'){ openInsp('ledger'); return; }
    i=+i; if(dockIdx===i){ dock.classList.remove('open'); dockIdx=null; }
    else { dockIdx=i; dock.classList.add('open'); bottomCards.forEach((c,k)=>c.classList.toggle('on',k===i)); }
    qa('#dockTabs button').forEach(b=>b.classList.toggle('on',dockIdx!==null&&+b.dataset.d===dockIdx));
    setTimeout(()=>window.dispatchEvent(new Event('resize')),380);
  }
  qa('#dockTabs button').forEach(b=>b.onclick=()=>openDock(b.dataset.d));

  function closeAll(){ closePops(); closeInsp(); dock.classList.remove('open'); dockIdx=null; qa('#dockTabs button').forEach(b=>b.classList.remove('on')); }

  /* mode switch + keys */
  qa('#modeSw button').forEach(b=>b.onclick=()=>setMode(b.dataset.m));
  document.addEventListener('keydown',e=>{
    if(e.target.tagName==='INPUT') return;
    if(e.key==='f'||e.key==='F') setMode(mode==='focus'?'full':'focus');
    if(e.key==='Escape'&&mode==='focus') closeAll();
  });

  /* incidents: badge counts unacknowledged; critical ones ping the button */
  const origPush=window.pushAlert;
  window.pushAlert=function(sev,...rest){ origPush(sev,...rest); paint(); if(mode==='focus'&&sev==='c'){ const b=q('#incBtn'); b.classList.remove('ping'); void b.offsetWidth; b.classList.add('ping'); toast('Critical incident · open Incidents to review'); } };
  q('#popInc').addEventListener('click',()=>setTimeout(paint,0));

  /* mirror live values into the strip */
  const cols={Active:'var(--signal)',Charging:'var(--blue)',Idle:'#C9C2AF',Faulted:'var(--red)'};
  function paint(){
    q('#fkPace').textContent=q('#pace').textContent; q('#fkSla').textContent=q('#sla').textContent;
    q('#fkCyc').textContent=q('#cycle').textContent; q('#fkFly').textContent=q('#inflight').textContent;
    q('#fkSla').closest('.kq').classList.toggle('warn',parseFloat(q('#sla').textContent)<95);
    const c=fleetCounts(), n=bots.length; q('#fkMov').textContent=c.Active; q('#fkMov').parentElement.lastChild.textContent=` of ${n} moving`;
    q('#fkBar').innerHTML=Object.entries(c).filter(([,v])=>v).map(([k,v])=>`<i title="${k}: ${v}" style="width:${v/n*100}%;background:${cols[k]}"></i>`).join('');
    const open=alerts.filter(a=>!a.acked).length, bd=q('#incBadge'); bd.textContent=open; bd.classList.toggle('zero',!open);
    const err=SUBS.filter(s=>s[1]==='err').length, warn=SUBS.filter(s=>s[1]==='warn').length, pill=q('#sysPill');
    pill.className='kbtn'+(err?' err':warn?' warn':'')+(popSys.classList.contains('on')?' on':'');
    q('#sysLed').className='led'+(err?' err':warn?' warn':'');
    q('#sysTxt').textContent=err?`${err} system down`:warn?`${warn} system${warn>1?'s need':' needs'} attention`:'All systems nominal';
    q('#dkQ').textContent=(q('#qCount').textContent.match(/\d+/)||[''])[0];
  }
  setInterval(paint,1000);

  setMode(mode); paint();
  if(mode==='focus'&&!localStorage.getItem('nt-tip')){ localStorage.setItem('nt-tip','1'); setTimeout(()=>toast('Tip: click any robot or rack to inspect it · press F for the full view'),900); }
})();
