/* OneTwoHire final AI click fix
   Fixes: quick suggestions/buttons not responding after page script errors.
   English only; works offline with local suggestions; upload button opens file picker; TXT CV autofill works locally.
*/
(function(){
  'use strict';
  const $ = (id)=>document.getElementById(id);
  const clean = (v)=>String(v||'').replace(/\s+/g,' ').trim();
  const esc = (v)=>String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const splitList=(v)=>String(v||'').split(/[,;|•\n]/).map(clean).filter(Boolean);

  function install(){
    if(!$('ai-assistant-panel') || !$('ai-assistant-toggle')) return;
    const panel=$('ai-assistant-panel');
    const toggle=$('ai-assistant-toggle');
    toggle.type='button';
    panel.style.zIndex='2147483001'; toggle.style.zIndex='2147483000';
    if(!$('ai-upload-cv-input')){
      const input=document.createElement('input'); input.type='file'; input.id='ai-upload-cv-input'; input.accept='.pdf,.docx,.txt,.png,.jpg,.jpeg,.webp'; input.style.display='none'; document.body.appendChild(input);
    }
  }
  function openAI(){ install(); const p=$('ai-assistant-panel'); if(!p) return; p.classList.add('active','ai-open'); p.style.setProperty('display','flex','important'); p.style.setProperty('visibility','visible','important'); p.style.setProperty('opacity','1','important'); p.style.setProperty('pointer-events','auto','important'); }
  function closeAI(){ const p=$('ai-assistant-panel'); if(!p) return; p.classList.remove('active','ai-open'); p.style.setProperty('display','none','important'); }
  function add(role,text){ openAI(); const box=$('ai-response-box'); if(!box) return; const d=document.createElement('div'); d.className='ai-message '+(role==='user'?'user':'ai'); d.innerHTML='<strong>'+(role==='user'?'You:':'AI:')+'</strong>'+esc(text); box.appendChild(d); box.scrollTop=box.scrollHeight; }
  function cv(){
    const val=(id)=>clean((($(id)||{}).value)||'');
    return {name:val('fullName'), title:val('jobTitle')||val('targetTitle')||'Professional', country:clean(localStorage.getItem('cvCountry')||localStorage.getItem('selectedCountry')||'selected country'), summary:val('summary'), skills:splitList(val('skills')||val('coreSkills')||val('computerSkills'))};
  }
  function suggest(prompt){
    const c=cv(); const title=c.title||'Professional'; const skills=c.skills.length?c.skills:['communication','problem solving','teamwork','Microsoft Excel','customer service']; const p=String(prompt||'').toLowerCase();
    if(p.includes('summary')) return `Professional Summary:\nResults-driven ${title} with strong experience in ${skills.slice(0,3).join(', ')}. Skilled at solving problems, coordinating work, and delivering clear results in fast-paced environments.`;
    if(p.includes('experience')) return `Rewrite Experience:\n• Managed daily responsibilities as a ${title} with focus on quality and accuracy.\n• Improved workflow by using ${skills[0]} and ${skills[1]}.\n• Coordinated with team members and stakeholders to complete tasks on time.\n• Delivered measurable results through organized planning and follow-up.`;
    if(p.includes('skill')) return `Suggested Skills:\n${['Leadership','Communication','Problem Solving','Time Management','Data Analysis','Microsoft Excel','Project Coordination','Customer Service','Reporting','Negotiation','Planning',...skills].filter((x,i,a)=>x&&a.indexOf(x)===i).slice(0,18).map(x=>'• '+x).join('\n')}`;
    if(p.includes('job title')) return `Suggested Job Titles:\n• ${title}\n• Senior ${title}\n• ${title} Specialist\n• ${title} Consultant\n• ${skills[0]} Specialist\n• Operations ${title}`;
    if(p.includes('education')) return `Improve Education:\nAdd the degree name, university, country, dates, relevant coursework, academic projects, honors, certifications, and tools used. Keep it clear and ATS-friendly.`;
    if(p.includes('ats')) return `ATS-Friendly Fixes:\n• Use standard headings: Summary, Experience, Education, Skills.\n• Add role keywords: ${[title,...skills.slice(0,5)].join(', ')}.\n• Use clear bullet points with action verbs.\n• Avoid important text inside images.\n• Keep dates and job titles easy to read.`;
    if(p.includes('grammar')) return `Grammar Fix:\nUse active voice and short sentences. Example: “Improved reporting accuracy and supported team performance through structured weekly tracking.”`;
    if(p.includes('job')) return `Matching Jobs:\nI will use your CV title, skills, education, country, and work type to find matching roles and show a match percentage.`;
    return `CV Advice:\nFor a ${title} CV, add measurable achievements, clear role keywords, and skills such as ${skills.slice(0,5).join(', ')}.`;
  }
  async function send(text){
    const inp=$('ai-user-input'); const msg=clean(text || (inp&&inp.value)); if(!msg) return; if(inp) inp.value=''; add('user',msg); add('ai','Thinking...'); const box=$('ai-response-box'); const last=box&&box.lastElementChild; setTimeout(()=>{ if(last) last.remove(); add('ai',suggest(msg)); },120);
  }
  function setVal(id,v){const el=$(id); if(el&&v){ el.value=v; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); }}
  function parseText(t){ const email=(t.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)||[''])[0]; const phone=(t.match(/\+?\d[\d\s().-]{7,}\d/)||[''])[0]; const lines=t.split(/\r?\n/).map(clean).filter(Boolean); const name=lines.find(l=>/^[A-Za-zÀ-ž'’ .-]{3,50}$/.test(l)&&!/cv|resume|profile|summary|experience|education|skill|email|phone/i.test(l))||''; const title=lines.find(l=>/(manager|developer|engineer|analyst|designer|accountant|finance|sales|marketing|specialist|consultant|director|assistant|coordinator|teacher|lawyer|doctor|nurse|hr|operations)/i.test(l))||''; return {name,title,email,phone,summary:lines.slice(0,8).join(' ').slice(0,500)}; }
  async function upload(file){
    if(!file) return;
    if (window.oneTwoHireUploadCV) return window.oneTwoHireUploadCV(file);
    openAI();
    add('user','Uploaded CV: '+file.name);
    if(/\.txt$/i.test(file.name)){
      const d=parseText(await file.text());
      setVal('fullName',d.name); setVal('targetJobTitle',d.title); setVal('jobTitle',d.title); setVal('email',d.email); setVal('phone',d.phone); setVal('summary',d.summary);
      add('ai','Your TXT CV was imported and the template fields were filled.');
      return;
    }
    add('ai','Start backend with OPENAI_API_KEY to read PDF/DOCX/image CV files.');
  }


  document.addEventListener('click',function(e){
    const t=e.target&&e.target.closest&&e.target.closest('#ai-assistant-toggle,#ai-close-btn,#ai-send-btn,#ai-upload-plus-btn,.ai-quick-btn');
    if(!t) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    if(t.id==='ai-assistant-toggle') return openAI();
    if(t.id==='ai-close-btn') return closeAI();
    if(t.id==='ai-send-btn') return send();
    if(t.id==='ai-upload-plus-btn') { const inp=$('ai-upload-cv-input'); if(inp) inp.click(); return; }
    if(t.classList.contains('ai-quick-btn')) return send(t.dataset.action || t.textContent || 'CV advice');
  },true);
  document.addEventListener('keydown',function(e){ if(e.target&&e.target.id==='ai-user-input'&&e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}},true);
  document.addEventListener('change',function(e){ if(e.target&&e.target.id==='ai-upload-cv-input') upload(e.target.files&&e.target.files[0]); },true);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install); else install();
  window.addEventListener('load',install);
})();
