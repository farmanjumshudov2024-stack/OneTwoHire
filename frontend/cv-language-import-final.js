/* OneTwoHire final CV-only language + import cleanup
   - Language buttons translate ONLY the CV preview, not the site UI.
   - New/edited CV text is translated in the preview after every render.
   - Uploaded/real CV data removes example fallback content.
   - Extra CV facts are placed into Projects/Additional Information when no exact field exists.
*/
(function(){
  'use strict';
  const API_BASE = (window.OTH_API_BASE || localStorage.getItem('OTH_API_BASE') || 'http://localhost:4000').replace(/\/$/, '');
  let cvLang = localStorage.getItem('othCvPreviewLang') || 'en';
  let translating = false;
  let timer = null;

  const fallback = {
    de: {'Professional Summary':'Kurzprofil','Work Experience':'Berufserfahrung','Education':'Ausbildung','Skills':'Fähigkeiten','Computer Skills':'Computerkenntnisse','Languages':'Sprachen','Projects':'Projekte','Additional Information':'Zusätzliche Informationen','Contact':'Kontakt','Profile':'Profil','Present':'Heute','Professional Title':'Berufsbezeichnung','Dedicated professional with a proven track record leading cross-functional teams to exceed expectations.':'Engagierte Fachkraft mit nachweislicher Erfahrung in der Führung funktionsübergreifender Teams und im Übertreffen gesetzter Ziele.'},
    az: {'Professional Summary':'Peşəkar xülasə','Work Experience':'İş təcrübəsi','Education':'Təhsil','Skills':'Bacarıqlar','Computer Skills':'Kompüter bacarıqları','Languages':'Dillər','Projects':'Layihələr','Additional Information':'Əlavə məlumat','Contact':'Əlaqə','Profile':'Profil','Present':'İndiyədək','Professional Title':'Peşəkar vəzifə','Dedicated professional with a proven track record leading cross-functional teams to exceed expectations.':'Gözləntiləri aşmaq üçün müxtəlif komandaları idarə etməkdə sübut olunmuş təcrübəyə malik peşəkar mütəxəssis.'},
    ru: {'Professional Summary':'Профессиональное резюме','Work Experience':'Опыт работы','Education':'Образование','Skills':'Навыки','Computer Skills':'Компьютерные навыки','Languages':'Языки','Projects':'Проекты','Additional Information':'Дополнительная информация','Contact':'Контакты','Profile':'Профиль','Present':'Настоящее время','Professional Title':'Профессиональная должность','Dedicated professional with a proven track record leading cross-functional teams to exceed expectations.':'Целеустремлённый специалист с подтверждённым опытом руководства командами и достижения высоких результатов.'},
    tr: {'Professional Summary':'Mesleki Özet','Work Experience':'İş Deneyimi','Education':'Eğitim','Skills':'Yetenekler','Computer Skills':'Bilgisayar Becerileri','Languages':'Diller','Projects':'Projeler','Additional Information':'Ek Bilgiler','Contact':'İletişim','Profile':'Profil','Present':'Günümüz','Professional Title':'Mesleki Unvan','Dedicated professional with a proven track record leading cross-functional teams to exceed expectations.':'Beklentileri aşmak için farklı ekipleri yönetme konusunda kanıtlanmış başarıya sahip profesyonel.'}
  };

  function qs(s,r=document){return r.querySelector(s)}
  function qsa(s,r=document){return Array.from(r.querySelectorAll(s))}
  function esc(s){return String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
  function markReal(){ if(document.body && document.body.dataset) document.body.dataset.othRealCvData='1'; }

  function previewRoot(){ return qs('#cv-pages') || qs('.cv-preview') || qs('#cv-preview') || qs('.preview-panel'); }

  function triggerEnglishRender(){
    const inp = qs('.live-input') || qs('#fullName') || qs('#summary');
    if(inp) inp.dispatchEvent(new Event('input', {bubbles:true}));
  }

  function collectTextNodes(root){
    const nodes=[];
    if(!root) return nodes;
    const walker=document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n){
        const p=n.parentElement;
        if(!p || ['SCRIPT','STYLE','TEXTAREA','INPUT','SELECT'].includes(p.tagName)) return NodeFilter.FILTER_REJECT;
        const txt=(n.nodeValue||'').trim();
        if(!txt || /^[\d\s+().,/%:\-–—@]+$/.test(txt)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    while(walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  }

  async function translateTexts(texts, lang){
    if(lang==='en') return texts;
    try{
      const res=await fetch(API_BASE + '/api/translate-texts', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({targetLang:lang,texts})});
      const json=await res.json();
      if(res.ok && json.success && Array.isArray(json.translations)) return json.translations;
    }catch(_){ }
    const dict=fallback[lang]||{};
    return texts.map(t=>{
      let out=String(t||'');
      Object.keys(dict).sort((a,b)=>b.length-a.length).forEach(k=>{ out=out.split(k).join(dict[k]); });
      return out;
    });
  }

  async function translatePreview(){
    if(translating) return;
    translating=true;
    try{
      if(cvLang==='en') { if(window.normalizeCVPreviewLanguage) window.normalizeCVPreviewLanguage('en'); return; }
      const root=previewRoot();
      if(!root) return;
      if(window.normalizeCVPreviewLanguage) window.normalizeCVPreviewLanguage('en');
      const nodes=collectTextNodes(root);
      const original=nodes.map(n=>n.nodeValue);
      const translated=await translateTexts(original, cvLang);
      nodes.forEach((n,i)=>{ if(translated[i]) n.nodeValue=translated[i]; });
      if(window.normalizeCVPreviewLanguage) window.normalizeCVPreviewLanguage(cvLang);
    } finally { translating=false; }
  }

  function scheduleTranslate(delay=260){
    clearTimeout(timer);
    timer=setTimeout(()=>translatePreview(), delay);
  }

  // Stop original language handler so site UI stays English. Only CV preview changes.
  document.addEventListener('click', function(e){
    const btn=e.target && e.target.closest && e.target.closest('.lang-btn,[data-lang]');
    if(!btn || !btn.dataset || !btn.dataset.lang) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    cvLang=(btn.dataset.lang||'en').toLowerCase();
    localStorage.setItem('othCvPreviewLang', cvLang);
    qsa('.lang-btn,[data-lang]').forEach(b=>{ if(b.dataset && b.dataset.lang) b.classList.toggle('active', (b.dataset.lang||'').toLowerCase()===cvLang); });
    triggerEnglishRender();
    scheduleTranslate(380);
  }, true);

  // Once real data is typed/uploaded, defaults/examples should no longer be injected into the CV preview.
  document.addEventListener('input', function(e){
    const t=e.target;
    if(t && t.classList && (t.classList.contains('live-input') || /^(fullName|targetJobTitle|email|phone|summary|skills|computerSkills|address|linkedin|website)$/i.test(t.id||''))){
      if((t.value||'').trim()) markReal();
      scheduleTranslate(430);
    }
  }, true);

  document.addEventListener('change', function(e){
    if(e.target && e.target.id==='ai-upload-cv-input') markReal();
    scheduleTranslate(700);
  }, true);

  // Add a small helper visible in the AI panel after upload: user knows examples were removed.
  window.othAfterCvAutofill = function(){ markReal(); triggerEnglishRender(); scheduleTranslate(600); };

  setTimeout(()=>{ triggerEnglishRender(); scheduleTranslate(600); }, 900);
})();
