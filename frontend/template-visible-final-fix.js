/* OneTwoHire FINAL TEMPLATE VISIBILITY FIX
   Keeps all editor fields editable, makes every selected template visible, and adds safe pagination.
   This file only touches the CV preview/template rendering layer. */
(function(){
  const A4_HEIGHT = 1122; // px approximation for 297mm at browser preview scale
  const esc = (v)=>String(v||'').replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
  const val = (id, fb='') => (document.getElementById(id)?.value || fb).trim();
  const lines = (id, fb='') => (val(id, fb).split(/,|\n/).map(s=>s.trim()).filter(Boolean));
  const getData = () => {
    const exps = [...document.querySelectorAll('#experience-list .entry-card, #experience-list .experience-item, #experience-list .dynamic-item')].map((el, i)=>({
      title: el.querySelector('[name*="title"], .exp-title, input[placeholder*="Title" i]')?.value || (i?'Operations Specialist':'Key Account Manager'),
      company: el.querySelector('[name*="company"], .exp-company, input[placeholder*="Company" i]')?.value || (i?'Northwind Group':'PixelPerfekt Werbung'),
      dates: el.querySelector('[name*="date"], .exp-dates, input[placeholder*="Date" i]')?.value || (i?'2020 - 2022':'2022 - Present'),
      desc: el.querySelector('textarea, [name*="desc"]')?.value || 'Managed daily operations and improved measurable business results.\nCoordinated communication across teams and stakeholders.'
    }));
    const edus = [...document.querySelectorAll('#education-list .entry-card, #education-list .education-item, #education-list .dynamic-item')].map((el, i)=>({
      title: el.querySelector('[name*="degree"], [name*="title"], input[placeholder*="Degree" i]')?.value || 'Master of Business Administration (MBA)',
      company: el.querySelector('[name*="institution"], [name*="school"], input[placeholder*="University" i]')?.value || 'Technical University of Munich',
      dates: el.querySelector('[name*="date"], input[placeholder*="Date" i]')?.value || '2014 - 2018'
    }));
    return {
      fullName: val('fullName', val('full-name','Farman Jumshudov')),
      jobTitle: val('jobTitle', val('targetJobTitle','HR Manager')),
      email: val('email','farmanj@example.com'),
      phone: val('phone','+1 555 019 990'),
      address: val('address','Berlin, Germany'),
      summary: val('summary','Dedicated professional with a proven track record leading cross-functional teams, improving operations, and delivering measurable results.'),
      skills: lines('skills','Leadership, Communication, Teamwork, Problem Solving, Time Management, Negotiation, Strategic Planning'),
      computerSkills: lines('computerSkills','Microsoft Office, SAP, Salesforce, Power BI, Excel'),
      languages: lines('languages','English, German, Azerbaijani'),
      experience: exps.length?exps:[{title:'Key Account Manager', company:'PixelPerfekt Werbung', dates:'08/2022 - Present', desc:'Managed strategic accounts and improved client communication.\nDelivered measurable process improvements and business results.'}],
      education: edus.length?edus:[{title:'Master of Business Administration (MBA)', company:'Technical University of Munich', dates:'10/2014 - 07/2018'}]
    };
  };
  function variant(layout){
    const l=String(layout||'').toLowerCase();
    const n=parseInt((l.match(/(\d+)/)||[])[1]||'1',10);
    if(l.includes('az')) return ['teal-side','navy-top','gold-left','clean-line','dark-head','soft-blue','red-accent','green-side','purple-card','minimal'][Math.max(0,(n-1)%10)] || 'teal-side';
    if(l.includes('de')) return ['slate-side','dark-side','timeline','blue-corp','red-exec','luxe','grey-classic','formal-photo','yellow-ats','editorial'][Math.max(0,(n-1)%10)] || 'slate-side';
    if(l.includes('us')) return ['yellow-editorial','teal-band','pastel','gradient','blue-awards','cyan-corp','navy-round','mustard-tech','interior-blue','orange-brown'][Math.max(0,(n-1)%10)] || 'yellow-editorial';
    if(l.includes('uk')) return ['burgundy','green-black','navy-photo','simple-blue','gold','tan','orange','royal','mono','classic'][Math.max(0,(n-1)%10)] || 'classic';
    return ['global-1','global-2','global-3','global-4','global-5','global-6','global-7','global-8','global-9','global-10'][Math.max(0,(n-1)%10)] || 'global-1';
  }
  function section(title, body){ return `<section class="ot-section"><h3 contenteditable="true">${esc(title)}</h3>${body}</section>`; }
  function renderTemplatePage(data, layout, pageNo, itemsHtml){
    const v = variant(layout);
    const photo = `<div class="ot-photo" contenteditable="false">Photo</div>`;
    const contact = `<div class="ot-contact"><p contenteditable="true">${esc(data.email)}</p><p contenteditable="true">${esc(data.phone)}</p><p contenteditable="true">${esc(data.address)}</p></div>`;
    const skillHtml = `<ul>${data.skills.map(s=>`<li contenteditable="true">${esc(s)}</li>`).join('')}</ul>`;
    const compHtml = `<ul>${data.computerSkills.map(s=>`<li contenteditable="true">${esc(s)}</li>`).join('')}</ul>`;
    const langHtml = `<ul>${data.languages.map(s=>`<li contenteditable="true">${esc(s)}</li>`).join('')}</ul>`;
    const side = `<aside class="ot-side">${photo}<h4>CONTACT</h4>${contact}<h4>SKILLS</h4>${skillHtml}<h4>SOFTWARE</h4>${compHtml}<h4>LANGUAGES</h4>${langHtml}</aside>`;
    const head = `<header class="ot-head"><h1 contenteditable="true">${esc(data.fullName)}</h1><h2 contenteditable="true">${esc(data.jobTitle)}</h2></header>`;
    const main = `<main class="ot-main">${pageNo===1?head:''}<div class="ot-flow">${itemsHtml}</div></main>`;
    return `<div class="cv-page ot-visible-template ot-${v}" data-page="${pageNo}" data-layout="${esc(layout)}">${side}${main}</div>`;
  }
  function buildSections(data){
    const exp = data.experience.map(e=>section('PROFESSIONAL EXPERIENCE', `<div class="ot-item"><b contenteditable="true">${esc(e.title)}</b><span contenteditable="true">${esc(e.dates)}</span><em contenteditable="true">${esc(e.company)}</em><p contenteditable="true">${esc(e.desc).replace(/\n/g,'<br>')}</p></div>`));
    const edu = data.education.map(e=>section('EDUCATION', `<div class="ot-item"><b contenteditable="true">${esc(e.title)}</b><span contenteditable="true">${esc(e.dates)}</span><em contenteditable="true">${esc(e.company)}</em></div>`));
    return [section('PROFESSIONAL SUMMARY', `<p contenteditable="true">${esc(data.summary)}</p>`), ...exp, ...edu];
  }
  function renderSafe(){
    const root = document.getElementById('cv-preview'); if(!root) return;
    const layout = localStorage.getItem('cvTemplate') || 'de-live-01';
    const current = root.querySelector('.cv-page');
    const bad = !current || current.textContent.trim().length < 25 || current.offsetHeight < 200 || current.querySelector('.cv-main:empty,.ot-flow:empty');
    if(!bad && !root.dataset.forceVisibleFix) return;
    const data = getData();
    const sections = buildSections(data);
    root.innerHTML = '<div class="cv-pages ot-pages"></div>';
    const wrap = root.querySelector('.ot-pages');
    let pageNo = 1, bucket=[];
    const flush=()=>{ if(bucket.length){ wrap.insertAdjacentHTML('beforeend', renderTemplatePage(data, layout, pageNo++, bucket.join(''))); bucket=[]; } };
    sections.forEach((s,i)=>{ bucket.push(s); if(bucket.length>=3 && i<sections.length-1) flush(); });
    flush();
    // browser measurement second pass: if a page still overflows, move last sections to next page
    [...wrap.querySelectorAll('.ot-visible-template')].forEach(pg=>{
      let guard=0;
      while(pg.scrollHeight > A4_HEIGHT && pg.querySelectorAll('.ot-section').length > 1 && guard++<20){
        const last = pg.querySelector('.ot-flow .ot-section:last-child');
        let next = pg.nextElementSibling;
        if(!next){ wrap.insertAdjacentHTML('beforeend', renderTemplatePage(data, layout, pageNo++, '')); next = wrap.lastElementChild; }
        next.querySelector('.ot-flow').insertBefore(last, next.querySelector('.ot-flow').firstChild);
      }
    });
  }


  function cleanLiteralLabels(){
    const map={"'+L.contact+'":"CONTACT","'+L.skills+'":"SKILLS","'+L.languages+'":"LANGUAGES","'+L.about+'":"PROFILE","'+L.projects+'":"PROJECTS","'+L.education+'":"EDUCATION","'+L.summary+'":"PROFESSIONAL SUMMARY","'+L.interests+'":"INTERESTS"};
    const root=document.getElementById('cv-preview'); if(!root) return;
    root.querySelectorAll('h1,h2,h3,h4,h5,p,span,b,strong,li').forEach(el=>{
      let t=el.textContent.trim();
      if(map[t]) el.textContent=map[t];
      else Object.keys(map).forEach(k=>{ if(el.innerHTML.includes(k)) el.innerHTML=el.innerHTML.split(k).join(map[k]); });
    });
  }
  function fixAllCvPages(){
    const root=document.getElementById('cv-preview'); if(!root) return;
    cleanLiteralLabels();
    root.querySelectorAll('.cv-page, .ot-visible-template, [class*="live-page"], [class*="-page"]').forEach(pg=>{
      pg.classList.add('oth-safe-page');
      pg.querySelectorAll('p,li,span,div,h1,h2,h3,h4,b,strong,em').forEach(el=>el.classList.add('oth-safe-text'));
    });
    const wraps=[...root.querySelectorAll('.cv-pages,.usa-live-pages,.caex-pages,.frx-pages,.cnx-pages,.ukx-pages,.intl-pages,.ot-pages')];
    wraps.forEach(wrap=>{
      let guard=0;
      [...wrap.children].forEach(pg=>{
        if(!(pg instanceof HTMLElement)) return;
        let flow=pg.querySelector('.ot-flow,.usa-flow,.caex-flow,.frx-flow,.cnx-flow,.ukx-flow,.intl-flow,.cv-flow,.main-flow,main');
        while(pg.scrollHeight>1140 && flow && flow.children.length>1 && guard++<80){
          const last=flow.lastElementChild;
          let next=pg.nextElementSibling;
          if(!next || !(next instanceof HTMLElement)){
            next=pg.cloneNode(true);
            next.dataset.page=String(wrap.children.length+1);
            next.classList.add('oth-continuation-page');
            const nf=next.querySelector('.ot-flow,.usa-flow,.caex-flow,.frx-flow,.cnx-flow,.ukx-flow,.intl-flow,.cv-flow,.main-flow,main');
            if(nf) nf.innerHTML='';
            next.querySelectorAll('header,.ot-head,.usa-head,.caex-head,.frx-head,.cnx-head,.ukx-head,.intl-head').forEach((h,i)=>{ if(i===0) h.remove(); });
            wrap.appendChild(next);
          }
          const nf=next.querySelector('.ot-flow,.usa-flow,.caex-flow,.frx-flow,.cnx-flow,.ukx-flow,.intl-flow,.cv-flow,.main-flow,main');
          if(!last || !nf || last===nf) break;
          nf.insertBefore(last,nf.firstChild);
        }
      });
    });
  }

  function install(){
    document.querySelectorAll('.premium-image-preview img').forEach(img=>{
      img.onerror=function(){ this.style.display='none'; const p=this.parentElement; if(p&&!p.querySelector('.img-fallback')){p.insertAdjacentHTML('beforeend','<div class="img-fallback">Template preview</div>')} };
    });
    const root=document.getElementById('cv-preview');
    if(root){ new MutationObserver(()=>setTimeout(renderSafe,120)).observe(root,{childList:true,subtree:true}); }
    setTimeout(()=>{renderSafe();fixAllCvPages();},400); setTimeout(()=>{renderSafe();fixAllCvPages();},1200); setInterval(fixAllCvPages,1500);
  }
  document.addEventListener('DOMContentLoaded', install);
  window.OneTwoHireTemplateVisibleFix = { renderSafe, cleanLiteralLabels, fixAllCvPages };
})();
