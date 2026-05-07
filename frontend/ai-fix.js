/* OneTwoHire AI Assistant HARD FIX
   - AI panel always opens
   - Suggestions work without backend (English only)
   - Backend is used when available
   - CV upload shows full-screen percentage progress
   - TXT imports locally; PDF/DOCX/Image imports through backend and fills template
*/
(function () {
  'use strict';

  const API_BASE = window.ONETWOHIRE_API_BASE || window.EMPLOYME_API_BASE || localStorage.getItem('ONETWOHIRE_API_BASE') || localStorage.getItem('EMPLOYME_API_BASE') || 'http://127.0.0.1:4000';
  const $ = (id) => document.getElementById(id);
  async function checkBackend() {
    try {
      const r = await fetch(API_BASE + '/health', { cache: 'no-store' });
      return await r.json();
    } catch (_) {
      return { ok: false, openaiConfigured: false, keySourceHint: 'Backend is not running at ' + API_BASE };
    }
  }
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();
  const splitList = (v) => Array.isArray(v) ? v.map(clean).filter(Boolean) : String(v || '').split(/[,;|•\n]/).map(clean).filter(Boolean);

  const QUICK_ACTIONS = [
    'Improve Summary',
    'Rewrite Experience',
    'Suggest Skills',
    'Suggest Job Titles',
    'Improve Education',
    'Make ATS Friendly',
    'Fix Grammar',
    'Find Matching Jobs'
  ];

  function installStyles() {
    if ($('oth-ai-hardfix-style')) return;
    const st = document.createElement('style');
    st.id = 'oth-ai-hardfix-style';
    st.textContent = `
      #ai-assistant-toggle.ai-fab-btn{position:fixed!important;right:28px!important;bottom:28px!important;z-index:2147483000!important;display:flex!important;align-items:center!important;gap:8px!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;border:0!important;border-radius:999px!important;padding:12px 22px!important;background:#247678!important;color:#fff!important;font-weight:800!important;box-shadow:0 14px 34px rgba(0,0,0,.22)!important;cursor:pointer!important;}
      #ai-assistant-panel.ai-panel{position:fixed!important;right:28px!important;bottom:92px!important;width:min(430px,calc(100vw - 32px))!important;height:min(620px,calc(100vh - 125px))!important;background:#fff!important;border:1px solid #dce6ee!important;border-radius:18px!important;box-shadow:0 28px 80px rgba(0,0,0,.28)!important;z-index:2147483001!important;overflow:hidden!important;display:none!important;flex-direction:column!important;visibility:hidden!important;opacity:0!important;transform:none!important;pointer-events:none!important;}
      #ai-assistant-panel.ai-open,#ai-assistant-panel.active{display:flex!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;}
      #ai-assistant-panel .ai-header{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;padding:14px 16px!important;background:#247678!important;color:#fff!important;}
      #ai-assistant-panel .ai-header h3{margin:0!important;font-size:1rem!important;color:#fff!important;}
      #ai-assistant-panel .btn-icon{border:0!important;background:rgba(255,255,255,.15)!important;color:#fff!important;border-radius:10px!important;width:34px!important;height:34px!important;cursor:pointer!important;}
      #ai-assistant-panel .ai-body{display:flex!important;flex-direction:column!important;gap:10px!important;padding:12px!important;height:100%!important;min-height:0!important;}
      #ai-response-box{flex:1!important;min-height:190px!important;overflow:auto!important;background:#f7fafc!important;border:1px solid #e5edf3!important;border-radius:14px!important;padding:10px!important;}
      .ai-message{margin:0 0 8px!important;padding:10px 12px!important;border-radius:12px!important;background:#fff!important;border:1px solid #e5edf3!important;color:#152238!important;line-height:1.45!important;font-size:.92rem!important;white-space:pre-wrap!important;overflow-wrap:anywhere!important;}
      .ai-message.user{background:#e8f4f4!important;border-color:#cfe5e5!important;}
      .ai-message.ai strong,.ai-message.user strong{display:block!important;margin-bottom:4px!important;}
      #ai-assistant-panel .ai-quick-actions{display:flex!important;flex-wrap:wrap!important;gap:6px!important;max-height:96px!important;overflow:auto!important;}
      #ai-assistant-panel .ai-quick-btn{border:1px solid #cfe0e6!important;background:#fff!important;border-radius:999px!important;padding:7px 10px!important;font-size:.78rem!important;cursor:pointer!important;color:#183044!important;}
      #ai-assistant-panel .ai-quick-btn:hover{background:#edf7f7!important;border-color:#247678!important;}
      #ai-assistant-panel .ai-input-area{display:flex!important;align-items:flex-end!important;gap:8px!important;}
      #ai-user-input{resize:none!important;border:1px solid #d6e2ea!important;border-radius:12px!important;padding:9px 10px!important;min-height:42px!important;color:#142033!important;background:#fff!important;}
      #ai-upload-plus-btn,#ai-send-btn{height:42px!important;min-width:42px!important;border-radius:12px!important;cursor:pointer!important;}
      .oth-upload-overlay{position:fixed!important;inset:0!important;z-index:2147483647!important;background:rgba(7,18,32,.72)!important;display:flex!important;align-items:center!important;justify-content:center!important;color:#fff!important;}
      .oth-upload-card{width:min(460px,90vw)!important;background:#fff!important;color:#102033!important;border-radius:22px!important;padding:26px!important;box-shadow:0 26px 80px rgba(0,0,0,.38)!important;text-align:center!important;}
      .oth-progress-track{height:15px!important;background:#e6edf3!important;border-radius:999px!important;overflow:hidden!important;margin:16px 0!important;}
      .oth-progress-bar{height:100%!important;width:0%!important;background:#247678!important;transition:width .18s linear!important;}
      @media(max-width:540px){#ai-assistant-toggle.ai-fab-btn{right:14px!important;bottom:18px!important;}#ai-assistant-panel.ai-panel{right:12px!important;bottom:78px!important;width:calc(100vw - 24px)!important;height:min(560px,calc(100vh - 95px))!important;}}
    `;
    document.head.appendChild(st);
  }

  function getCountry() {
    return clean(localStorage.getItem('cvCountry') || localStorage.getItem('selectedCountry') || (($('country-select') || {}).value) || 'canada').toLowerCase();
  }
  function val(id) { const el = $(id); return el && 'value' in el ? clean(el.value) : ''; }

  function collectList(selector, mapper) {
    return Array.from(document.querySelectorAll(selector + ' .dynamic-item')).map(mapper).filter((x) => Object.values(x).some(Boolean));
  }

  function getCurrentCVData() {
    return {
      country: getCountry(),
      fullName: val('fullName'),
      jobTitle: val('targetJobTitle') || val('jobTitle') || 'Professional',
      email: val('email'),
      phone: val('phone'),
      address: val('address'),
      summary: val('summary'),
      skills: splitList(val('skills')),
      computerSkills: splitList(val('computerSkills')),
      workType: (($('job-search-type') || {}).value) || 'any',
      experience: collectList('#experience-list', (i) => ({
        title: clean((i.querySelector('.inp-title') || {}).value),
        company: clean((i.querySelector('.inp-company') || {}).value),
        dates: clean((i.querySelector('.inp-date') || {}).value),
        location: clean((i.querySelector('.inp-loc') || {}).value),
        desc: clean((i.querySelector('.inp-desc') || {}).value)
      })),
      education: collectList('#education-list', (i) => ({
        title: clean((i.querySelector('.inp-title') || {}).value),
        institution: clean((i.querySelector('.inp-company') || {}).value),
        dates: clean((i.querySelector('.inp-date') || {}).value)
      })),
      languages: collectList('#language-list', (i) => ({
        name: clean((i.querySelector('.inp-lang') || {}).value),
        prof: clean((i.querySelector('.inp-prof') || {}).value)
      }))
    };
  }

  function ensureAIElements() {
    installStyles();
    let toggle = $('ai-assistant-toggle');
    if (!toggle) {
      toggle = document.createElement('button');
      toggle.id = 'ai-assistant-toggle';
      toggle.className = 'ai-fab-btn';
      document.body.appendChild(toggle);
    }
    toggle.type = 'button';
    toggle.innerHTML = '<i class="fa-solid fa-robot"></i> AI';

    let panel = $('ai-assistant-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'ai-assistant-panel';
      panel.className = 'ai-panel';
      document.body.appendChild(panel);
    }
    panel.innerHTML = `
      <div class="ai-header">
        <h3><i class="fa-solid fa-wand-magic-sparkles"></i> AI CV Assistant</h3>
        <button id="ai-close-btn" class="btn-icon" type="button">×</button>
      </div>
      <div class="ai-body">
        <div id="ai-response-box" class="ai-response-box"><div class="ai-message ai"><strong>AI:</strong>Hi! I can improve your CV, suggest stronger content, import an old CV, and find matching jobs.</div></div>
        <div class="ai-quick-actions">${QUICK_ACTIONS.map((a) => `<button class="ai-quick-btn" type="button" data-action="${esc(a)}">${esc(a)}</button>`).join('')}</div>
        <div class="ai-input-area">
          <input type="file" id="ai-upload-cv-input" accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp" style="display:none;">
          <button type="button" id="ai-upload-plus-btn" class="btn btn-outline btn-sm" title="Upload old CV">+</button>
          <textarea id="ai-user-input" rows="2" placeholder="Ask AI or upload old CV..." style="flex:1;"></textarea>
          <button id="ai-send-btn" type="button" class="btn btn-primary btn-sm">➤</button>
        </div>
      </div>`;
    return { toggle, panel };
  }

  function openAI() {
    const { panel } = ensureAIElements();
    panel.classList.add('active', 'ai-open');
    panel.style.setProperty('display', 'flex', 'important');
    panel.style.setProperty('visibility', 'visible', 'important');
    panel.style.setProperty('opacity', '1', 'important');
    panel.style.setProperty('pointer-events', 'auto', 'important');
  }
  function closeAI() {
    const panel = $('ai-assistant-panel');
    if (!panel) return;
    panel.classList.remove('active', 'ai-open');
    panel.style.setProperty('display', 'none', 'important');
    panel.style.setProperty('visibility', 'hidden', 'important');
    panel.style.setProperty('opacity', '0', 'important');
    panel.style.setProperty('pointer-events', 'none', 'important');
  }
  function toggleAI() {
    const panel = $('ai-assistant-panel');
    if (panel && panel.classList.contains('ai-open')) closeAI(); else openAI();
  }

  function addMsg(role, text, html) {
    const box = $('ai-response-box');
    if (!box) return null;
    const d = document.createElement('div');
    d.className = 'ai-message ' + (role === 'user' ? 'user' : 'ai');
    d.innerHTML = '<strong>' + (role === 'user' ? 'You:' : 'AI:') + '</strong>' + (html || esc(text));
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
    return d;
  }

  function localSuggestion(action) {
    const cv = getCurrentCVData();
    const title = cv.jobTitle || 'Professional';
    const skills = cv.skills.length ? cv.skills.slice(0, 7) : ['communication', 'problem solving', 'teamwork', 'Microsoft Excel', 'customer focus'];
    const exp = cv.experience[0] || {};
    const edu = cv.education[0] || {};
    const key = String(action || '').toLowerCase();

    if (key.includes('summary')) return `Professional Summary:\nResults-driven ${title} with experience in ${skills.slice(0, 3).join(', ')}. Strong at coordinating tasks, solving practical problems, and delivering clear results. Ready to contribute to a professional team in the ${cv.country.toUpperCase()} job market.`;
    if (key.includes('experience')) return `Stronger experience bullets for ${exp.title || title}:\n• Improved daily workflow by using ${skills[0]} and ${skills[1]}.\n• Coordinated tasks with team members and stakeholders to deliver work on time.\n• Analyzed problems, prepared practical solutions, and improved reporting quality.\n• Supported measurable business results through organized execution and follow-up.`;
    if (key.includes('skill')) return `Recommended skills for ${title}:\n${['Leadership','Communication','Problem Solving','Time Management','Stakeholder Management','Data Analysis','Microsoft Excel','Project Coordination','Customer Service','Reporting','Negotiation','Planning', ...skills].filter((v, i, a) => v && a.indexOf(v) === i).slice(0, 16).map(s => '• ' + s).join('\n')}`;
    if (key.includes('job title') || key === 'title') return `Suggested job titles:\n• ${title}\n• Senior ${title}\n• ${title} Specialist\n• ${title} Consultant\n• Operations ${title}\n• ${skills[0]} Specialist`;
    if (key.includes('education')) return `Education improvement:\n${edu.title ? `Keep “${edu.title}” visible and add institution, dates, country, relevant coursework, academic projects, honors, and tools used.` : 'Add degree name, university, dates, country, relevant coursework, academic projects, certifications, and GPA/honors if strong.'}`;
    if (key.includes('ats')) return `ATS checklist:\n• Use standard headings: Professional Summary, Experience, Education, Skills.\n• Add exact role keywords: ${[title, ...skills.slice(0, 5)].join(', ')}.\n• Use bullet points with action verbs and measurable results.\n• Avoid putting important text inside images.\n• Keep dates, company names, and job titles clear.`;
    if (key.includes('grammar')) return `Grammar improvement:\nUse short active sentences and consistent tense. Example: “Managed cross-functional tasks and improved reporting accuracy through structured weekly tracking.”`;
    if (key.includes('job')) return `Job matching is ready. I will use your CV title, skills, experience, education, country, and work type to rank roles and show match percentages.`;
    return `CV advice for ${title}: focus on measurable achievements, add keywords such as ${skills.slice(0, 5).join(', ')}, and keep every section clear for ATS systems.`;
  }

  async function askAI(message) {
    const cvData = getCurrentCVData();
    const payload = { message: `Answer only in English. Give practical CV help. User request: ${message}`, cvData, history: [], mode: /job|matching|vacancy/i.test(message) ? 'jobs' : 'general' };
    try {
      const r = await fetch(API_BASE + '/api/ai-cv-assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await r.json().catch(() => ({}));
      if (r.ok && (data.reply || data.result || data.content)) return data.reply || data.result || data.content;
    } catch (_) {}
    return localSuggestion(message);
  }

  async function send(message) {
    const inp = $('ai-user-input');
    const text = clean(message || (inp && inp.value));
    if (!text) return;
    if (inp) inp.value = '';
    openAI();
    addMsg('user', text);
    const loading = addMsg('ai', 'Thinking...');
    const answer = await askAI(text);
    if (loading) loading.remove();
    addMsg('ai', answer);
  }

  function showProgress(percent, label) {
    let overlay = $('oth-upload-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'oth-upload-overlay';
      overlay.className = 'oth-upload-overlay';
      overlay.innerHTML = '<div class="oth-upload-card"><h3 style="margin:0 0 8px;">Uploading CV</h3><p id="oth-upload-label" style="margin:0;color:#526173;">Preparing...</p><div class="oth-progress-track"><div id="oth-progress-bar" class="oth-progress-bar"></div></div><strong id="oth-progress-text">0%</strong></div>';
      document.body.appendChild(overlay);
    }
    const p = Math.max(0, Math.min(100, Math.round(percent || 0)));
    const bar = $('oth-progress-bar'), txt = $('oth-progress-text'), lab = $('oth-upload-label');
    if (bar) bar.style.width = p + '%';
    if (txt) txt.textContent = p + '%';
    if (lab) lab.textContent = label || 'Uploading and reading your CV...';
  }
  function hideProgress() { const o = $('oth-upload-overlay'); if (o) o.remove(); }

  function setValue(id, value) {
    const el = $(id);
    if (!el || value == null || value === '') return;
    el.value = Array.isArray(value) ? value.filter(Boolean).join(', ') : value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function clearList(id) { const list = $(id); if (list) list.innerHTML = ''; }

  function addDynamic(type, data) {
    const map = { experience: ['experience-list', 'tpl-experience'], education: ['education-list', 'tpl-education'], project: ['project-list', 'tpl-project'], language: ['language-list', 'tpl-language'] };
    const pair = map[type];
    if (!pair) return;
    const list = $(pair[0]), tpl = $(pair[1]);
    if (!list || !tpl || !tpl.content) return;
    const node = tpl.content.cloneNode(true).querySelector('.dynamic-item');
    if (!node) return;
    if (type === 'experience') {
      (node.querySelector('.inp-title') || {}).value = data.title || '';
      (node.querySelector('.inp-company') || {}).value = data.company || data.institution || '';
      (node.querySelector('.inp-date') || {}).value = data.dates || data.date || '';
      (node.querySelector('.inp-loc') || {}).value = data.location || '';
      (node.querySelector('.inp-desc') || {}).value = data.desc || data.description || '';
    }
    if (type === 'education') {
      (node.querySelector('.inp-title') || {}).value = data.title || data.degree || '';
      (node.querySelector('.inp-company') || {}).value = data.company || data.institution || data.school || '';
      (node.querySelector('.inp-date') || {}).value = data.dates || data.date || '';
    }
    if (type === 'project') {
      (node.querySelector('.inp-title') || {}).value = data.title || data.name || '';
      (node.querySelector('.inp-desc') || {}).value = data.desc || data.description || '';
    }
    if (type === 'language') {
      (node.querySelector('.inp-lang') || {}).value = data.name || data.language || '';
      (node.querySelector('.inp-prof') || {}).value = data.prof || data.proficiency || '80';
    }
    node.querySelectorAll('input, textarea, select').forEach((el) => {
      el.classList.add('live-input');
      el.addEventListener('input', rerender);
      el.addEventListener('change', rerender);
    });
    const remove = node.querySelector('.remove-btn');
    if (remove) remove.onclick = (ev) => { ev.preventDefault(); node.remove(); rerender(); };
    list.appendChild(node);
  }

  function rerender() {
    try { if (typeof window.renderCVPreview === 'function') window.renderCVPreview(); } catch (_) {}
    try { if (typeof window.updatePreview === 'function') window.updatePreview(); } catch (_) {}
    const first = document.querySelector('.live-input');
    if (first) first.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function asArray(v) {
    if (!v) return [];
    if (Array.isArray(v)) return v.filter(Boolean);
    return String(v).split(/[,;|\n•]+/).map(clean).filter(Boolean);
  }
  function normalizeParsedCV(parsed) {
    const p = parsed || {};
    const out = { ...p };
    out.fullName = p.fullName || p.name || p.full_name || '';
    out.jobTitle = p.jobTitle || p.targetJobTitle || p.title || p.currentRole || p.profession || '';
    out.email = p.email || (p.contact && p.contact.email) || '';
    out.phone = p.phone || (p.contact && p.contact.phone) || '';
    out.address = p.address || p.location || (p.contact && (p.contact.address || p.contact.location)) || '';
    out.linkedin = p.linkedin || p.linkedIn || p.website || p.portfolio || '';
    out.summary = p.summary || p.profile || p.about || p.objective || '';
    const hard = asArray(p.skills).concat(asArray(p.coreSkills), asArray(p.softSkills));
    const tech = asArray(p.computerSkills).concat(asArray(p.technicalSkills), asArray(p.tools), asArray(p.software), asArray(p.programmingLanguages));
    const certs = asArray(p.certificates).concat(asArray(p.certifications), asArray(p.licenses));
    const awards = asArray(p.awards).concat(asArray(p.achievements), asArray(p.honors));
    out.skills = [...new Set(hard)].slice(0, 30);
    out.computerSkills = [...new Set(tech)].slice(0, 30);
    out.experience = Array.isArray(p.experience) ? p.experience : Array.isArray(p.workExperience) ? p.workExperience : Array.isArray(p.employment) ? p.employment : [];
    out.education = Array.isArray(p.education) ? p.education : Array.isArray(p.academicBackground) ? p.academicBackground : [];
    out.languages = Array.isArray(p.languages) ? p.languages : [];
    const projects = Array.isArray(p.projects) ? [...p.projects] : [];
    certs.forEach(x => projects.push({ title: 'Certification', desc: x }));
    awards.forEach(x => projects.push({ title: 'Achievement / Award', desc: x }));
    asArray(p.interests).forEach(x => projects.push({ title: 'Interest', desc: x }));
    out.projects = projects;
    return out;
  }
  function fillTemplate(parsed) {
    if (!parsed) return;
    if (document.body && document.body.dataset) document.body.dataset.othRealCvData = '1';
    parsed = normalizeParsedCV(parsed);

    // IMPORTANT: once a real CV is imported, remove all template/example data first.
    // The preview must show only the uploaded CV data (plus categorized extra info), not demo rows.
    ['experience-list','education-list','project-list','language-list'].forEach(clearList);

    setValue('fullName', parsed.fullName);
    setValue('targetJobTitle', parsed.jobTitle);
    setValue('email', parsed.email);
    setValue('phone', parsed.phone);
    setValue('address', parsed.address);
    setValue('linkedin', parsed.linkedin);
    setValue('summary', parsed.summary);
    setValue('skills', parsed.skills);
    setValue('computerSkills', parsed.computerSkills);
    if (Array.isArray(parsed.experience) && parsed.experience.length) { clearList('experience-list'); parsed.experience.forEach((x) => addDynamic('experience', x)); }
    if (Array.isArray(parsed.education) && parsed.education.length) { clearList('education-list'); parsed.education.forEach((x) => addDynamic('education', x)); }
    const extraProjects = [];
    if (Array.isArray(parsed.projects)) extraProjects.push(...parsed.projects);
    ['certifications','awards','interests','publications','volunteer','courses','references','other'].forEach((k) => {
      if (Array.isArray(parsed[k])) parsed[k].filter(Boolean).forEach((x) => extraProjects.push(typeof x === 'string' ? { title: k.charAt(0).toUpperCase()+k.slice(1), desc: x } : { title: x.title || x.name || k.charAt(0).toUpperCase()+k.slice(1), desc: x.desc || x.description || x.details || JSON.stringify(x) }));
      else if (parsed[k]) extraProjects.push({ title: k.charAt(0).toUpperCase()+k.slice(1), desc: String(parsed[k]) });
    });
    if (extraProjects.length) { clearList('project-list'); extraProjects.forEach((x) => addDynamic('project', x)); }
    if (Array.isArray(parsed.languages) && parsed.languages.length) { clearList('language-list'); parsed.languages.forEach((x) => addDynamic('language', x)); }
    rerender();
    setTimeout(() => { if (window.othAfterCvAutofill) window.othAfterCvAutofill(); if (window.normalizeCVPreviewLanguage) window.normalizeCVPreviewLanguage(localStorage.getItem('othCvPreviewLang') || document.querySelector('.lang-btn.active')?.dataset.lang || 'en'); }, 200);
  }

  function parseTextCV(text) {
    const raw = String(text || '');
    const lines = raw.split(/\r?\n/).map(clean).filter(Boolean);
    const email = (raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [''])[0];
    const phone = (raw.match(/\+?\d[\d\s().-]{7,}\d/) || [''])[0];
    const fullName = lines.find((l) => /^[A-Za-zÀ-ž'’ .-]{3,45}$/.test(l) && !/resume|cv|profile|summary|experience|education|skill|phone|email/i.test(l)) || '';
    const jobTitle = lines.find((l) => l !== fullName && /(manager|developer|engineer|analyst|designer|accountant|finance|sales|marketing|specialist|consultant|director|assistant|coordinator|teacher|lawyer|doctor|nurse|hr|operations)/i.test(l)) || '';
    const skillsStart = lines.findIndex((l) => /^(skills|technical skills|core skills)/i.test(l));
    const skills = skillsStart >= 0 ? splitList(lines.slice(skillsStart, Math.min(skillsStart + 5, lines.length)).join(', ').replace(/^(skills|technical skills|core skills)[:\s-]*/i, '')) : [];
    return { fullName, jobTitle, email, phone, summary: lines.filter((l) => l !== fullName && l !== jobTitle).slice(0, 4).join(' ').slice(0, 550), skills };
  }

  async function uploadCV(file) {
    if (!file) return;
    openAI();
    addMsg('user', 'Uploaded CV: ' + file.name);
    showProgress(2, 'Preparing CV upload...');

    let fake = 2;
    const tick = setInterval(() => {
      fake = Math.min(88, fake + (fake < 35 ? 4 : 1.5));
      showProgress(fake, fake < 45 ? 'Uploading CV...' : 'Reading CV and extracting fields...');
    }, 260);

    try {
      if (/\.txt$/i.test(file.name || '')) {
        const text = await file.text();
        showProgress(75, 'Reading TXT CV locally...');
        fillTemplate(parseTextCV(text));
        clearInterval(tick);
        showProgress(100, 'Done. Template fields were filled.');
        setTimeout(hideProgress, 650);
        addMsg('ai', 'Your TXT CV was imported successfully. All matching fields in the selected template were filled.');
        return;
      }

      const health = await checkBackend();
      if (!health.ok) throw new Error('Backend is not running. Double-click start-backend.bat and keep that window open.');
      if (!health.openaiConfigured && /\.(png|jpe?g|webp)$/i.test(file.name || '')) {
        throw new Error('Backend is running, but OPENAI_API_KEY is not loaded. Put your key in backend/.env or project .env, then restart start-backend.bat.');
      }

      const fd = new FormData();
      fd.append('cv', file);
      fd.append('cvFile', file);
      const endpoints = ['/api/parse-cv-upload', '/api/upload-old-cv'];
      let lastError = null;
      for (const ep of endpoints) {
        try {
          const data = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', API_BASE + ep, true);
            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable) showProgress(Math.min(78, 8 + (e.loaded / e.total) * 55), 'Uploading CV...');
            };
            xhr.onreadystatechange = () => {
              if (xhr.readyState !== 4) return;
              showProgress(92, 'Filling template fields...');
              let json = {};
              try { json = JSON.parse(xhr.responseText || '{}'); } catch (_) {}
              if (xhr.status >= 200 && xhr.status < 300 && (json.success || json.parsed)) resolve(json);
              else reject(new Error(json.error || 'CV parser did not return data.'));
            };
            xhr.onerror = () => reject(new Error('Backend request failed.'));
            xhr.send(fd);
          });
          const parsed = data.parsed || data.data || data.cv || data;
          fillTemplate(parsed);
          clearInterval(tick);
          showProgress(100, 'Done. CV data added to the template.');
          setTimeout(hideProgress, 700);
          addMsg('ai', 'Your CV was imported successfully. I filled every matching field available in this template: name, title, contact, summary, skills, experience, education and languages.');
          return;
        } catch (err) { lastError = err; }
      }
      throw lastError || new Error('Upload failed.');
    } catch (err) {
      clearInterval(tick);
      showProgress(100, 'Upload stopped');
      setTimeout(hideProgress, 900);
      addMsg('ai', `I could not read this CV yet. ${(err && err.message) || 'Unknown error'}\n\nCheck: backend/.env must contain OPENAI_API_KEY=sk-... and backend must be restarted with start-backend.bat. PDF/DOCX/image CV parsing needs the backend; TXT works locally.`);
    } finally {
      const input = $('ai-upload-cv-input');
      if (input) input.value = '';
    }
  }

  function localJobs(cv) {
    const countryMap = { germany: 'Germany', azerbaijan: 'Azerbaijan', usa: 'United States', uk: 'United Kingdom', france: 'France', spain: 'Spain', canada: 'Canada', singapore: 'Singapore', china: 'China' };
    const country = countryMap[cv.country] || cv.country || 'Canada';
    const title = cv.jobTitle || 'Professional';
    const skills = cv.skills.length ? cv.skills : ['communication', 'teamwork', 'analysis'];
    const q = encodeURIComponent([title, ...skills.slice(0, 3), cv.workType !== 'any' ? cv.workType : ''].join(' '));
    const loc = encodeURIComponent(country);
    const siteMap = {
      germany: [{ company: 'StepStone Germany', url: `https://www.stepstone.de/jobs/${q}/in-${loc}` }, { company: 'LinkedIn Germany', url: `https://www.linkedin.com/jobs/search/?keywords=${q}&location=${loc}` }],
      azerbaijan: [{ company: 'Boss.az', url: `https://boss.az/vacancies?search%5Bkeyword%5D=${q}` }, { company: 'LinkedIn Azerbaijan', url: `https://www.linkedin.com/jobs/search/?keywords=${q}&location=${loc}` }],
      usa: [{ company: 'Indeed USA', url: `https://www.indeed.com/jobs?q=${q}&l=${loc}` }, { company: 'LinkedIn USA', url: `https://www.linkedin.com/jobs/search/?keywords=${q}&location=${loc}` }],
      uk: [{ company: 'Reed UK', url: `https://www.reed.co.uk/jobs/${q}-jobs` }, { company: 'LinkedIn UK', url: `https://www.linkedin.com/jobs/search/?keywords=${q}&location=${loc}` }]
    };
    const sites = siteMap[cv.country] || [{ company: 'LinkedIn', url: `https://www.linkedin.com/jobs/search/?keywords=${q}&location=${loc}` }, { company: 'Indeed', url: `https://www.indeed.com/jobs?q=${q}&l=${loc}` }];
    return [title, `${title} Specialist`, `${title} Consultant`, `Senior ${title}`, `${skills[0]} ${title}`].map((role, i) => ({
      title: role,
      company: sites[i % sites.length].company,
      location: country,
      url: sites[i % sites.length].url,
      matchScore: Math.max(74, 94 - i * 4),
      reason: `Matches your CV title and keywords: ${[title, ...skills.slice(0, 4)].join(', ')}. Work type: ${cv.workType}.`,
      keywords: [title, ...skills.slice(0, 5)]
    }));
  }

  async function findMatchingJobs() {
    const container = $('jobs-container');
    const btn = $('find-jobs-btn');
    if (!container) { send('Find Matching Jobs'); return; }
    const old = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = 'Matching CV...'; }
    const cv = getCurrentCVData();
    container.innerHTML = '<div class="job-card">Analyzing CV keywords...</div>';
    let jobs = [];
    try {
      const r = await fetch(API_BASE + '/api/job-suggestions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cvData: cv, country: cv.country, workType: cv.workType }) });
      const data = await r.json().catch(() => ({}));
      if (r.ok && data.success && Array.isArray(data.jobs)) jobs = data.jobs;
    } catch (_) {}
    if (!jobs.length) jobs = localJobs(cv);
    container.innerHTML = jobs.map((j) => `<div class="job-card" style="background:#fff;border:1px solid #dce6ee;border-radius:14px;padding:1rem;margin-bottom:.8rem;">
      <div style="display:flex;justify-content:space-between;gap:1rem;"><div><h4 style="margin:0 0 .25rem;">${esc(j.title)}</h4><p style="margin:0;color:#667085;font-size:.9rem;">${esc(j.company)} · ${esc(j.location)}</p></div><strong style="color:#247678;">${esc(j.matchScore)}% chance</strong></div>
      <p style="font-size:.88rem;line-height:1.45;margin:.75rem 0;">${esc(j.reason)}</p>
      <p style="font-size:.8rem;color:#667085;">Keywords: ${esc((j.keywords || []).join(', '))}</p>
      <a href="${esc(j.url)}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">Auto Apply with CV</a>
    </div>`).join('');
    if (btn) { btn.disabled = false; btn.innerHTML = old || 'Find Matching Jobs'; }
  }

  function bindAI() {
    ensureAIElements();
    const toggle = $('ai-assistant-toggle');
    if (toggle) toggle.onclick = (e) => { e.preventDefault(); e.stopPropagation(); toggleAI(); };
    const close = $('ai-close-btn');
    if (close) close.onclick = (e) => { e.preventDefault(); closeAI(); };
    const sendBtn = $('ai-send-btn');
    if (sendBtn) sendBtn.onclick = (e) => { e.preventDefault(); send(); };
    const inp = $('ai-user-input');
    if (inp) inp.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
    const upBtn = $('ai-upload-plus-btn');
    const upInp = $('ai-upload-cv-input');
    if (upBtn && upInp) {
      upBtn.onclick = (e) => { e.preventDefault(); upInp.click(); };
      upInp.onchange = () => uploadCV(upInp.files && upInp.files[0]);
    }
    document.querySelectorAll('.ai-quick-btn').forEach((b) => {
      b.onclick = (e) => {
        e.preventDefault();
        const action = b.dataset.action || b.textContent || '';
        if (/Find Matching Jobs/i.test(action)) findMatchingJobs(); else send(action);
      };
    });
    const jobBtn = $('find-jobs-btn');
    if (jobBtn) jobBtn.onclick = (e) => { e.preventDefault(); findMatchingJobs(); };
    closeAI();
  }

  // Capture clicks too, so old handlers cannot break the AI button.
  document.addEventListener('click', function (e) {
    const t = e.target && e.target.closest && e.target.closest('#ai-assistant-toggle,#ai-close-btn,#ai-send-btn,#ai-upload-plus-btn,.ai-quick-btn');
    if (!t) return;
    if (t.id === 'ai-assistant-toggle') { e.preventDefault(); e.stopPropagation(); toggleAI(); }
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindAI); else bindAI();
  window.addEventListener('load', bindAI);
  window.openOneTwoHireAI = openAI;
  window.closeOneTwoHireAI = closeAI;
  window.oneTwoHireFindMatchingJobs = findMatchingJobs;
  window.oneTwoHireUploadCV = uploadCV;
  window.oneTwoHireCheckBackend = checkBackend;
  window.oneTwoHireFillTemplateFromParsedCV = fillTemplate;
})();

(function(){
  function $(id){ return document.getElementById(id); }
  function hasRealFieldValue(){
    return ['fullName','targetJobTitle','email','phone','address','summary','skills','computerSkills'].some(function(id){
      var el=$(id); return el && String(el.value||'').trim().length>0;
    });
  }
  function clearExampleDynamicRows(){
    if (!document.body || !document.body.dataset || document.body.dataset.othRealCvData !== '1') return;
    ['experience-list','education-list','project-list','language-list'].forEach(function(listId){
      var list=$(listId); if(!list) return;
      Array.from(list.querySelectorAll('.dynamic-item')).forEach(function(row){
        var vals=Array.from(row.querySelectorAll('input,textarea')).map(function(x){return String(x.value||'').trim();}).filter(Boolean);
        var joined=vals.join(' | ').toLowerCase();
        var demo = /key account manager|pixelperfekt|name des|masterstudiengang|operations overhaul|deutsch\s*\|\s*100|professional title/.test(joined);
        if (demo && hasRealFieldValue()) row.remove();
      });
    });
  }
  document.addEventListener('input', function(e){
    if (e.target && (e.target.classList.contains('live-input') || e.target.closest('.dynamic-item'))) {
      if (hasRealFieldValue() && document.body && document.body.dataset) document.body.dataset.othRealCvData='1';
      setTimeout(clearExampleDynamicRows, 0);
    }
  }, true);
  window.othAfterCvAutofill = function(){
    if (document.body && document.body.dataset) document.body.dataset.othRealCvData='1';
    clearExampleDynamicRows();
    if (typeof window.triggerRender === 'function') window.triggerRender();
    else document.dispatchEvent(new Event('input', {bubbles:true}));
  };
})();
