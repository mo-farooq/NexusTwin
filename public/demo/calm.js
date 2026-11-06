/* Operator view: tabbed right panel, camera menu, fleet state bar */
(()=>{
  const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)];
  qa('#pTabs button').forEach(b=>b.onclick=()=>{ qa('#pTabs button').forEach(x=>x.classList.toggle('on',x===b)); qa('.pane').forEach(p=>p.classList.toggle('on',p.dataset.pane===b.dataset.p)); });
  // clicking an asset on the floor should bring the inspector forward
  q('#scene').addEventListener('click',()=>{ if(!S.modes.obstacle&&S.tool==='sel') q('#pTabs [data-p="insp"]').click(); });
  const menu=q('#camSw');
  q('#camBtn').onclick=e=>{ e.stopPropagation(); menu.classList.toggle('open'); };
  qa('#camSw button').forEach(b=>b.addEventListener('click',()=>{ q('#camLbl').textContent=b.textContent; menu.classList.remove('open'); }));
  document.addEventListener('click',e=>{ if(!e.target.closest('#camSw')) menu.classList.remove('open'); });
  qa('#floorSw button').forEach(b=>b.onclick=()=>{ qa('#floorSw button').forEach(x=>x.classList.toggle('on',x===b)); if(b.textContent!=='G') toast(`Floor ${b.textContent}: multi‑floor support is on the roadmap`); });
  const bar=q('#stateBar'), cols={Active:'var(--signal)',Charging:'var(--blue)',Idle:'#C9C2AF',Faulted:'var(--red)'};
  const paint=()=>{ const c=fleetCounts(), n=bots.length; bar.innerHTML=Object.entries(c).filter(([,v])=>v).map(([k,v])=>`<i title="${k} ${v}" style="width:${v/n*100}%;background:${cols[k]}"></i>`).join(''); };
  paint(); setInterval(paint,1000);
})();
