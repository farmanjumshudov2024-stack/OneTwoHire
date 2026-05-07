/* OneTwoHire Auto Apply Direct Fix
   - Generates current editable CV as PDF
   - Shows full-screen progress
   - Sends CV to employer email through backend SMTP and CCs registered user email
   - If the job board has no direct application email/API, asks for the application email and never pretends a third-party job board was submitted.
*/
(function(){
  'use strict';
  const API_BASE = window.ONETWOHIRE_API_BASE || window.EMPLOYME_API_BASE || localStorage.getItem('ONETWOHIRE_API_BASE') || localStorage.getItem('EMPLOYME_API_BASE') || 'http://127.0.0.1:4000';
  const $ = (id)=>document.getElementById(id);
  const clean = (v)=>String(v||'').replace(/\s+/g,' ').trim();
  const esc = (v)=>String(v == null ? '' : v).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function getRegisteredEmail(){
    try {
      const direct = localStorage.getItem('currentUser') || localStorage.getItem('rememberedEmail');
      if (direct && /@/.test(direct)) return direct;
      const cvUser = JSON.parse(localStorage.getItem('cvUser') || 'null');
      if (cvUser && cvUser.email) return cvUser.email;
      const session = JSON.parse(localStorage.getItem('userSession') || 'null');
      if (session && session.email) return session.email;
    } catch(_){}
    const profile = $('profile-email');
    if (profile && profile.value) return profile.value;
    const email = $('email');
    return email && email.value ? email.value : '';
  }

  function getCVData(){
    const val = id => { const el=$(id); return el && 'value' in el ? clean(el.value) : ''; };
    const list = (sel, map)=>Array.from(document.querySelectorAll(sel + ' .dynamic-item')).map(map).filter(x=>Object.values(x).some(Boolean));
    const split = v => clean(v).split(/[,;|•\n]/).map(clean).filter(Boolean);
    return {
      country: localStorage.getItem('cvCountry') || 'germany',
      fullName: val('fullName'),
      jobTitle: val('targetJobTitle') || val('jobTitle') || 'Professional',
      email: val('email'), phone: val('phone'), address: val('address'), summary: val('summary'),
      skills: split(val('skills')), computerSkills: split(val('computerSkills')),
      workType: (($('job-search-type')||{}).value) || 'any',
      experience: list('#experience-list', i=>({title:clean((i.querySelector('.inp-title')||{}).value),company:clean((i.querySelector('.inp-company')||{}).value),dates:clean((i.querySelector('.inp-date')||{}).value),location:clean((i.querySelector('.inp-loc')||{}).value),desc:clean((i.querySelector('.inp-desc')||{}).value)})),
      education: list('#education-list', i=>({title:clean((i.querySelector('.inp-title')||{}).value),institution:clean((i.querySelector('.inp-company')||{}).value),dates:clean((i.querySelector('.inp-date')||{}).value)}))
    };
  }

  function ensureOverlay(){
    let o = $('auto-apply-progress');
    if (o) return o;
    o = document.createElement('div');
    o.id = 'auto-apply-progress';
    o.innerHTML = `<div class="aa-card"><h3>Auto Apply</h3><p id="aa-status">Preparing...</p><div class="aa-bar"><span id="aa-fill"></span></div><strong id="aa-pct">0%</strong></div>`;
    document.body.appendChild(o);
    const st = document.createElement('style');
    st.textContent = `#auto-apply-progress{position:fixed;inset:0;background:rgba(8,18,32,.72);backdrop-filter:blur(6px);z-index:2147483647;display:none;align-items:center;justify-content:center;font-family:inherit}.aa-card{width:min(420px,90vw);background:#fff;border-radius:22px;padding:28px;box-shadow:0 24px 70px rgba(0,0,0,.28);text-align:center}.aa-card h3{margin:0 0 8px;color:#0f172a}.aa-card p{margin:0 0 18px;color:#475569}.aa-bar{height:14px;background:#e5eef2;border-radius:999px;overflow:hidden}.aa-bar span{display:block;height:100%;width:0%;background:#247678;transition:width .25s ease}#aa-pct{display:block;margin-top:12px;color:#247678;font-size:20px}`;
    document.head.appendChild(st);
    return o;
  }
  function progress(p, text){
    const o=ensureOverlay(); o.style.display='flex';
    const fill=$('aa-fill'), pct=$('aa-pct'), status=$('aa-status');
    const n=Math.max(0,Math.min(100,Math.round(p)));
    if(fill) fill.style.width=n+'%'; if(pct) pct.textContent=n+'%'; if(status) status.textContent=text||'Working...';
  }
  function hideProgress(delay=800){ setTimeout(()=>{ const o=$('auto-apply-progress'); if(o) o.style.display='none'; }, delay); }

  async function cvPdfBase64(){
    const wrapper = $('cv-pages');
    if (!wrapper || !window.html2pdf) throw new Error('CV preview/PDF generator is not ready.');
    progress(20,'Rendering current CV pages...');
    const exportWrapper = document.createElement('div');
    Array.from(wrapper.querySelectorAll('.cv-page')).forEach((p, idx, arr)=>{
      const clone = p.cloneNode(true);
      clone.style.boxShadow = 'none'; clone.style.margin = '0'; clone.style.pageBreakAfter = idx === arr.length-1 ? 'auto' : 'always';
      exportWrapper.appendChild(clone);
    });
    const opt = { margin:0, image:{type:'jpeg',quality:.98}, html2canvas:{scale:2,useCORS:true,letterRendering:true,backgroundColor:'#ffffff'}, jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}, pagebreak:{mode:'css'} };
    progress(45,'Converting CV to PDF...');
    const blob = await html2pdf().set(opt).from(exportWrapper).outputPdf('blob');
    progress(65,'Attaching CV...');
    return await new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(String(r.result).split(',')[1]); r.onerror=reject; r.readAsDataURL(blob); });
  }

  function parseJobFromElement(el, fallbackUrl){
    const card = el && el.closest ? el.closest('.dynamic-item,.job-card') : null;
    const title = card ? clean((card.querySelector('h4')||{}).textContent) : 'Selected Job';
    const meta = card ? clean((card.querySelector('p,div')||{}).textContent) : '';
    return { title, company: meta.split('·')[0] || 'Company', source: meta.split('—')[0] || '', url: fallbackUrl || (card && card.querySelector('a[href]') ? card.querySelector('a[href]').href : '') };
  }

  async function directAutoApply(job, clickedEl){
    const userEmail = getRegisteredEmail();
    if (!userEmail || !/@/.test(userEmail)) { alert('Please login/register with your email first. The application copy will be sent to that email.'); return; }
    let applyEmail = job.applyEmail || job.email || '';
    if (!applyEmail) {
      applyEmail = prompt('This job site does not provide a direct apply API/email. Enter the employer application email to send your CV directly and CC your registered email:');
      if (!applyEmail) { if (job.url) window.open(job.url,'_blank','noopener,noreferrer'); return; }
    }
    try {
      progress(8,'Starting auto apply...');
      const cv = getCVData();
      const pdfBase64 = await cvPdfBase64();
      progress(78,'Sending application to employer...');
      const r = await fetch(API_BASE + '/api/auto-apply', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ userEmail, job:{...job, applyEmail}, cv, pdfBase64 }) });
      const data = await r.json().catch(()=>({}));
      if (data.success) { progress(100,'Application sent. Copy delivered to your registered email.'); alert(data.message || 'Application sent successfully.'); }
      else if (data.needsSmtp && data.mailto) { progress(100,'SMTP missing. Opening email draft...'); window.location.href = data.mailto; alert(data.message); }
      else { throw new Error(data.message || data.error || 'Auto apply failed.'); }
    } catch(err) {
      progress(100,'Auto apply stopped');
      alert((err && err.message) || 'Auto apply failed. Start backend and configure SMTP to send direct applications.');
    } finally { hideProgress(1100); }
  }

  window.autoApplyWithCV = function(url, title, company, applyEmail){
    directAutoApply({url, title:title||'Selected Job', company:company||'Company', applyEmail:applyEmail||''});
  };

  document.addEventListener('click', function(e){
    const t = e.target && e.target.closest ? e.target.closest('a,button') : null;
    if (!t) return;
    const label = clean(t.textContent);
    if (!/auto\s*apply/i.test(label)) return;
    e.preventDefault(); e.stopPropagation();
    const href = t.getAttribute('href') || '';
    const job = parseJobFromElement(t, href);
    directAutoApply(job, t);
  }, true);
})();
