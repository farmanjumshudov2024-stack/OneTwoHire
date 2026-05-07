(function(){
  'use strict';

  const $ = (id) => document.getElementById(id);
  const q = (sel, root=document) => root.querySelector(sel);
  const qa = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  function userKey(){
    const email = localStorage.getItem('currentUser') || localStorage.getItem('registeredEmail') || 'guest';
    return String(email || 'guest').trim().toLowerCase();
  }
  function cvStoreKey(){ return `userCVs_${userKey()}`; }

  function showToast(msg, type='success'){
    let t = $('oth-cv-save-toast');
    if(!t){
      t = document.createElement('div');
      t.id = 'oth-cv-save-toast';
      t.style.cssText = 'position:fixed;right:22px;bottom:22px;z-index:2147483647;padding:13px 16px;border-radius:14px;color:#fff;font-weight:700;box-shadow:0 18px 50px rgba(0,0,0,.25);max-width:360px;line-height:1.35;';
      document.body.appendChild(t);
    }
    t.style.background = type === 'error' ? '#dc2626' : '#16a34a';
    t.textContent = msg;
    clearTimeout(t._timer);
    t._timer = setTimeout(()=>t.remove(), 3200);
  }

  function progress(pct, label){
    let o = $('oth-main-upload-progress');
    if(!o){
      o = document.createElement('div');
      o.id = 'oth-main-upload-progress';
      o.innerHTML = `<div class="oth-progress-modal"><h3>Uploading CV</h3><p id="oth-main-upload-label">Preparing...</p><div class="oth-progress-line"><span id="oth-main-upload-bar"></span></div><strong id="oth-main-upload-pct">0%</strong></div>`;
      document.body.appendChild(o);
    }
    const n = Math.max(0, Math.min(100, Number(pct)||0));
    $('oth-main-upload-bar').style.width = n + '%';
    $('oth-main-upload-pct').textContent = Math.round(n) + '%';
    $('oth-main-upload-label').textContent = label || 'Processing...';
  }
  function hideProgress(){ const o = $('oth-main-upload-progress'); if(o) o.remove(); }

  function css(){
    if($('oth-save-upload-css')) return;
    const st = document.createElement('style');
    st.id = 'oth-save-upload-css';
    st.textContent = `
      .oth-cv-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-left:8px;}
      .oth-save-btn,.oth-upload-btn,.oth-mycvs-btn{white-space:nowrap;}
      #oth-main-upload-progress{position:fixed;inset:0;z-index:2147483647;background:rgba(2,6,23,.72);display:flex;align-items:center;justify-content:center;color:#0f172a;}
      .oth-progress-modal{width:min(430px,90vw);background:#fff;border-radius:22px;padding:26px;text-align:center;box-shadow:0 26px 80px rgba(0,0,0,.35);}
      .oth-progress-modal h3{margin:0 0 8px;font-size:22px;}
      .oth-progress-modal p{margin:0 0 14px;color:#64748b;}
      .oth-progress-line{height:12px;background:#e5e7eb;border-radius:999px;overflow:hidden;margin:14px 0;}
      .oth-progress-line span{display:block;height:100%;width:0%;background:#2563eb;border-radius:999px;transition:width .18s ease;}
      @media(max-width:900px){.preview-actions{gap:10px;flex-wrap:wrap}.oth-cv-tools{width:100%;margin-left:0}.oth-cv-tools .btn{flex:1;}}
    `;
    document.head.appendChild(st);
  }

  function safeValue(id){ const el=$(id); return el ? String(el.value||'').trim() : ''; }
  function setValue(id, value){ const el=$(id); if(el){ el.value = value || ''; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); } }
  function splitList(value){ return String(value||'').split(/[,;|\n•]+/).map(x=>x.trim()).filter(Boolean); }
  function uniq(arr){
    const seen = new Set();
    return (arr||[]).filter(x=>{
      const key = JSON.stringify(x).toLowerCase().replace(/\s+/g,' ').trim();
      if(!key || seen.has(key)) return false;
      seen.add(key); return true;
    });
  }

  function collectDynamic(listId, mapFn){ return qa(`#${listId} .dynamic-item`).map(mapFn).filter(item => Object.values(item).some(v => String(v||'').trim())); }
  function collectCV(){
    return {
      id: localStorage.getItem('activeCVEditId') || ('cv_' + Date.now()),
      fullName: safeValue('fullName') || 'Untitled CV',
      targetJobTitle: safeValue('targetJobTitle'),
      jobTitle: safeValue('targetJobTitle'),
      email: safeValue('email'), phone: safeValue('phone'), address: safeValue('address'), linkedin: safeValue('linkedin'),
      dob: safeValue('dob'), nationality: safeValue('nationality'), summary: safeValue('summary'),
      skills: splitList(safeValue('skills')), computerSkills: splitList(safeValue('computerSkills')),
      experience: collectDynamic('experience-list', n => ({
        title: q('.inp-title',n)?.value||'', company: q('.inp-company',n)?.value||'', dates: q('.inp-date',n)?.value||'', location: q('.inp-loc',n)?.value||'', desc: q('.inp-desc',n)?.value||''
      })),
      education: collectDynamic('education-list', n => ({
        title: q('.inp-title',n)?.value||'', degree: q('.inp-title',n)?.value||'', company: q('.inp-company',n)?.value||'', institution: q('.inp-company',n)?.value||'', dates: q('.inp-date',n)?.value||''
      })),
      projects: collectDynamic('project-list', n => ({ title: q('.inp-title',n)?.value||'', name: q('.inp-title',n)?.value||'', desc: q('.inp-desc',n)?.value||'' })),
      languages: collectDynamic('language-list', n => ({ name: q('.inp-lang',n)?.value||'', prof: q('.inp-prof',n)?.value||'', proficiency: q('.inp-prof',n)?.value||'' })),
      country: localStorage.getItem('selectedCountry') || document.body.dataset.selectedCountry || '',
      template: localStorage.getItem('selectedTemplate') || document.body.dataset.selectedTemplate || '',
      updatedAt: Date.now()
    };
  }

  function saveCurrentCV(silent=false){
    const cv = collectCV();
    cv.experience = uniq(cv.experience);
    cv.education = uniq(cv.education);
    cv.projects = uniq(cv.projects);
    cv.languages = uniq(cv.languages);
    cv.skills = [...new Set(cv.skills)];
    cv.computerSkills = [...new Set(cv.computerSkills)];
    const key = cvStoreKey();
    let list=[];
    try{ list = JSON.parse(localStorage.getItem(key)||'[]'); }catch(e){ list=[]; }
    const idx = list.findIndex(x => x.id === cv.id);
    if(idx >= 0) list[idx] = cv; else list.unshift(cv);
    localStorage.setItem(key, JSON.stringify(list));
    try { localStorage.setItem('oneTwoHireMyCvs', JSON.stringify(list)); } catch(e){}
    localStorage.setItem('activeCVEditId', cv.id);
    localStorage.setItem('lastSavedCVId', cv.id);
    if(!silent) showToast('CV saved to My CVs.');
    return cv;
  }

  function clearList(id){ const el=$(id); if(el) el.innerHTML=''; }
  function cloneTpl(id){ const tpl=$(id); return tpl && tpl.content ? tpl.content.cloneNode(true).querySelector('.dynamic-item') : null; }
  function addItem(type, data){
    const tplMap = {experience:'tpl-experience', education:'tpl-education', project:'tpl-project', language:'tpl-language'};
    const listMap = {experience:'experience-list', education:'education-list', project:'project-list', language:'language-list'};
    const node = cloneTpl(tplMap[type]); const list=$(listMap[type]);
    if(!node || !list) return;
    if(type==='experience'){
      q('.inp-title',node).value=data.title||''; q('.inp-company',node).value=data.company||''; q('.inp-date',node).value=data.dates||''; if(q('.inp-loc',node)) q('.inp-loc',node).value=data.location||''; q('.inp-desc',node).value=data.desc||data.description||'';
    } else if(type==='education'){
      q('.inp-title',node).value=data.title||data.degree||''; q('.inp-company',node).value=data.company||data.institution||''; q('.inp-date',node).value=data.dates||'';
    } else if(type==='project'){
      q('.inp-title',node).value=data.title||data.name||''; q('.inp-desc',node).value=data.desc||data.description||'';
    } else if(type==='language'){
      q('.inp-lang',node).value=data.name||''; q('.inp-prof',node).value=data.prof||data.proficiency||'';
    }
    node.querySelectorAll('input,textarea,select').forEach(el=>{ el.classList.add('live-input'); el.addEventListener('input', trigger); el.addEventListener('change', trigger); });
    const rm=q('.remove-btn',node); if(rm) rm.onclick=(e)=>{ e.preventDefault(); node.remove(); trigger(); };
    list.appendChild(node);
  }
  function trigger(){
    try{ if(typeof window.renderCVPreview==='function') window.renderCVPreview(); }catch(e){}
    const inp = document.querySelector('.live-input'); if(inp) inp.dispatchEvent(new Event('input',{bubbles:true}));
  }
  function fillFromCV(cv){
    if(!cv) return;
    if(window.oneTwoHireFillTemplateFromParsedCV){ window.oneTwoHireFillTemplateFromParsedCV(cv); return; }
    document.body.dataset.othRealCvData='1';
    setValue('fullName', cv.fullName); setValue('targetJobTitle', cv.targetJobTitle || cv.jobTitle); setValue('email', cv.email); setValue('phone', cv.phone); setValue('address', cv.address); setValue('linkedin', cv.linkedin); setValue('dob', cv.dob); setValue('nationality', cv.nationality); setValue('summary', cv.summary); setValue('skills', (cv.skills||[]).join(', ')); setValue('computerSkills', (cv.computerSkills||[]).join(', '));
    clearList('experience-list'); clearList('education-list'); clearList('project-list'); clearList('language-list');
    (cv.experience||[]).forEach(x=>addItem('experience',x)); (cv.education||[]).forEach(x=>addItem('education',x)); (cv.projects||[]).forEach(x=>addItem('project',x)); (cv.languages||[]).forEach(x=>addItem('language',x));
    trigger();
  }
  function restoreEditCV(){
    const id = localStorage.getItem('activeCVEditId'); if(!id) return;
    let list=[]; try{ list=JSON.parse(localStorage.getItem(cvStoreKey())||'[]'); }catch(e){}
    const cv = list.find(x=>x.id===id); if(cv) setTimeout(()=>fillFromCV(cv), 350);
  }

  function readLocalText(file){ return new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(String(r.result||'')); r.onerror=reject; r.readAsText(file); }); }
  function parsePlainText(text){
    const raw=String(text||''); const lines=raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    const email=(raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)||[''])[0];
    const phone=(raw.match(/\+?\d[\d\s().-]{7,}\d/)||[''])[0];
    const fullName=lines.find(l=>/^[A-Za-zÀ-ž'’ .-]{3,50}$/.test(l)&&!/cv|resume|profile|summary|experience|education|skills|email|phone/i.test(l))||'';
    const jobTitle=lines.find(l=>l!==fullName && /(manager|developer|engineer|analyst|designer|accountant|finance|sales|marketing|specialist|consultant|director|assistant|coordinator|teacher|lawyer|doctor|nurse|hr|operations)/i.test(l))||'';
    const skills=splitList((raw.match(/skills[:\s-]+([\s\S]{0,400})/i)||[])[1]||'');
    return {fullName, jobTitle, email, phone, summary: lines.filter(l=>l!==fullName&&l!==jobTitle).slice(0,5).join(' ').slice(0,700), skills};
  }
  async function uploadCV(file){
    if(!file) return;
    progress(5,'Preparing CV upload...');
    try{
      if(window.oneTwoHireUploadCV){
        await window.oneTwoHireUploadCV(file);
        progress(92,'Saving imported CV...');
        setTimeout(()=>{ saveCurrentCV(true); progress(100,'Done'); setTimeout(hideProgress,400); showToast('CV uploaded, filled and saved to My CVs.'); }, 900);
        return;
      }
      const fd=new FormData(); fd.append('cvFile',file); fd.append('file',file);
      const endpoints=['/api/upload-old-cv','/api/parse-cv-upload']; let parsed=null;
      for(const ep of endpoints){
        try{
          progress(35,'Analyzing CV...');
          const r=await fetch(ep,{method:'POST',body:fd}); if(r.ok){ parsed=await r.json(); break; }
        }catch(e){}
      }
      if(!parsed && /\.txt$/i.test(file.name)){ progress(65,'Reading text CV...'); parsed=parsePlainText(await readLocalText(file)); }
      if(!parsed) throw new Error('CV parser unavailable');
      progress(80,'Filling template...'); fillFromCV(parsed); progress(95,'Saving CV...'); saveCurrentCV(true); progress(100,'Done'); setTimeout(hideProgress,500); showToast('CV uploaded, filled and saved to My CVs.');
    }catch(e){ console.error(e); hideProgress(); showToast('Upload failed. Start backend and check OPENAI_API_KEY for image/PDF parsing.', 'error'); }
  }

  function injectUI(){
    css();
    if(!$('oth-cv-file-input')){
      const input=document.createElement('input'); input.type='file'; input.id='oth-cv-file-input'; input.accept='.pdf,.docx,.txt,.png,.jpg,.jpeg,.webp'; input.style.display='none'; document.body.appendChild(input);
      input.addEventListener('change',()=>uploadCV(input.files&&input.files[0]));
    }

    // Add My CVs under Profile in the existing 3-dots/profile dropdown
    const menu = document.getElementById('user-dropdown-content') || document.querySelector('.dropdown-content,.profile-menu,.user-menu');
    if(menu && !document.getElementById('menu-cvs')){
      const profile = document.getElementById('menu-profile') || Array.from(menu.children).find(x => /profile/i.test(x.textContent||''));
      const link = document.createElement('a');
      link.href = 'my-cvs.html'; link.id = 'menu-cvs';
      link.innerHTML = '<i class="fa-regular fa-file-lines"></i> My CVs';
      if(profile && profile.nextSibling) menu.insertBefore(link, profile.nextSibling); else menu.insertBefore(link, menu.firstChild);
    }

    const finalize=q('.wizard-step[data-step="5"] .text-center');
    if(finalize && !$('oth-save-cv-final')){
      const saveFinal=document.createElement('button'); saveFinal.type='button'; saveFinal.id='oth-save-cv-final'; saveFinal.className='btn btn-secondary btn-block'; saveFinal.style.marginTop='10px'; saveFinal.innerHTML='<i class="fa-solid fa-floppy-disk"></i> Save to My CVs'; finalize.appendChild(saveFinal);
    }
    const uploadInput = $('oth-cv-file-input');
    $('oth-save-cv-final') && ($('oth-save-cv-final').onclick=()=>saveCurrentCV(false));
  }

  document.addEventListener('DOMContentLoaded',()=>{ injectUI(); restoreEditCV(); });
  setTimeout(()=>{ injectUI(); restoreEditCV(); }, 1200);
  window.oneTwoHireSaveCurrentCV = saveCurrentCV;
})();
