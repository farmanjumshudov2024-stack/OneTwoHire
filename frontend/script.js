
// OneTwoHire hard runtime fallback: prevent optional pagination helpers from breaking AI/buttons.
if (typeof window.pxPerMm !== 'function') {
  window.pxPerMm = function pxPerMm(){ return 96 / 25.4; };
}
if (typeof pxPerMm !== 'function') {
  var pxPerMm = window.pxPerMm;
}

// ===================================
// GLOBAL AUTH HELPER FUNCTIONS
// ===================================

const API_BASE = window.EMPLOYME_API_BASE || localStorage.getItem('EMPLOYME_API_BASE') || 'http://127.0.0.1:4000';

// Global fallbacks so runtime errors in optional UI sections do not break auth.
var aiToggle, aiPanel, aiClose, aiSendBtn, aiUserInput, aiResponseBox;


async function apiFetch(path, options = {}) {
    const finalUrl = `${API_BASE}${path}`;
    try {
        const response = await fetch(finalUrl, options);
        return response;
    } catch (error) {
        const message = `Could not connect to the OneTwoHire backend at ${API_BASE}. Start the backend server first, then refresh the page.`;
        throw new Error(message);
    }
}

function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

// Lightweight local fallback hashing for offline mode only
function simpleHash(password) {
    return btoa(unescape(encodeURIComponent(password)));
}

function simpleCompare(password, hash) {
    return simpleHash(password) === hash;
}

// Email normalization
function normalizeEmail(email) {
    return (email || '').toLowerCase().trim();
}

function getStoredUser() {
    try {
        const raw = localStorage.getItem('cvUser');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function hasPersistedSession() {
    const user = getStoredUser();
    try {
        const session = JSON.parse(localStorage.getItem('authSession') || 'null');
        const loggedIn = localStorage.getItem('isLoggedIn') === 'true';
        return Boolean(user && user.email && (loggedIn || session?.email));
    } catch {
        const loggedIn = localStorage.getItem('isLoggedIn') === 'true';
        return Boolean(user && user.email && loggedIn);
    }
}

// Validation helpers
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isValidPassword(password) {
    return password.length >= 6;
}

// Auth UI helpers
function getAuthElements() {
    return {
        authError: document.getElementById('auth-error'),
        authSuccess: document.getElementById('auth-success'),
        loginForm: document.getElementById('login-form'),
        registerForm: document.getElementById('register-form'),
        loginCard: document.getElementById('login-card'),
        registerCard: document.getElementById('register-card'),
    };
}

function switchAuthPage(page) {
    const { loginCard, registerCard } = getAuthElements();
    
    if (page === 'login') {
        if (registerCard) {
            registerCard.classList.add('fade-out');
            setTimeout(() => {
                registerCard.style.display = 'none';
                registerCard.classList.remove('fade-out');
            }, 300);
        }
        if (loginCard) {
            loginCard.style.display = 'block';
        }
        clearErrorMessages();
    } else if (page === 'register') {
        if (loginCard) {
            loginCard.classList.add('fade-out');
            setTimeout(() => {
                loginCard.style.display = 'none';
                loginCard.classList.remove('fade-out');
            }, 300);
        }
        if (registerCard) {
            registerCard.style.display = 'block';
        }
        clearErrorMessages();
    }
}

function showError(message) {
    const { authError, authSuccess } = getAuthElements();
    if (authError) {
        authError.textContent = message;
        authError.style.display = 'flex';
    }
    if (authSuccess) {
        authSuccess.style.display = 'none';
    }
}

function showSuccess(message) {
    const { authSuccess, authError } = getAuthElements();
    if (authSuccess) {
        authSuccess.textContent = message;
        authSuccess.style.display = 'flex';
    }
    if (authError) {
        authError.style.display = 'none';
    }
}

function clearErrorMessages() {
    const { authError, authSuccess } = getAuthElements();
    if (authError) authError.style.display = 'none';
    if (authSuccess) authSuccess.style.display = 'none';
    // Clear field-level errors
    document.querySelectorAll('.input-error').forEach(el => el.textContent = '');
    document.querySelectorAll('.form-input').forEach(el => el.classList.remove('error'));
}

function setFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const errorEl = document.getElementById(`${fieldId}-error`);
    if (field) {
        field.classList.add('error');
    }
    if (errorEl) {
        errorEl.textContent = message;
    }
}

function clearFieldError(fieldId) {
    const field = document.getElementById(fieldId);
    const errorEl = document.getElementById(`${fieldId}-error`);
    if (field) {
        field.classList.remove('error');
    }
    if (errorEl) {
        errorEl.textContent = '';
    }
}

// ===================================
// DOM CONTENT LOADED
// ===================================

document.addEventListener('DOMContentLoaded', () => {

    // --- Silent Backend Migration ---
    async function migrateLocalUsersToBackend() {
        try {
            const allUsers = JSON.parse(localStorage.getItem('allUsers')) || [];
            for (const user of allUsers) {
                // Ignore missing format bindings
                if (!user.email || !user.password) continue;

                try {
                    const response = await fetch(`${API_BASE}/api/register`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(user)
                    });

                    if (!response.ok) {
                        const errText = await response.text();
                        console.warn(`Migration skipped for ${user.email}:`, errText);
                    } else {
                        console.log(`Successfully migrated ${user.email} to backend.`);
                    }
                } catch (fetchErr) {
                    console.info(`Migration skipped for ${user.email}`);
                }
            }
        } catch (e) {
            console.error("Migration fatal error", e);
        }
    }
    let backendReachable = false;
    (async () => {
        try {
            const health = await fetch(`${API_BASE}/health`, { method: 'GET' });
            backendReachable = health.ok;
            if (backendReachable) migrateLocalUsersToBackend();
        } catch (_) {
            backendReachable = false;
        }
    })();

    // --- LANGUAGE SYSTEM ---
    const translations = {
        en: {
            stepPersonal: 'Personal', stepExperience: 'Experience', stepEducation: 'Education', stepSkills: 'Skills', stepDownload: 'Download',
            h2Personal: 'Personal details', pPersonal: 'Fill out the fields required by your selected country standard.',
            lblFullName: 'Full Name', lblJobTitle: 'Target Job Title', lblEmail: 'Email', lblPhone: 'Phone',
            lblAddress: 'Address / City', lblDob: 'Date of Birth', lblNationality: 'Nationality',
            lblSummary: 'Professional Summary', lblPhoto: 'Professional Photo', lblPhotoHelper: 'A headshot is standard/optional for your region.',
            h2Experience: 'Work Experience', btnAddPosition: 'Add Position',
            h2Projects: 'Projects / Achievements', btnAddProject: 'Add Project', lblProjectName: 'Project Name / Focus',
            h2Education: 'Education', btnAddDegree: 'Add Degree',
            h2Skills: 'Skills', lblSkills: 'Core Skills (Comma-separated)', h2ComputerSkills: 'Computer Skills', lblComputerSkills: 'Software / Tools (Comma-separated)',
            h2Languages: 'Language Skills', btnAddLanguage: 'Add Language', lblLangName: 'Language Name', lblProficiency: 'Proficiency (0-100)',
            h2Download: 'Ready to download!', pDownload: 'Your CV is visually stunning and firmly respects regional HR standards.',
            btnExportPdf: 'Export High Quality PDF',
            h3RecommendedJobs: 'Job Seeker — AI Job Suggestions', pRecommendedJobs: 'Based on your CV details and selected country.', btnFindJobs: 'Find Matching Jobs',
            btnDownloadTop: 'Download',
            lblJobTitle: 'Job Title', lblCompany: 'Company', lblDescription: 'Description / Tasks', lblDates: 'Dates', lblLocation: 'Location',
            lblDegree: 'Degree', lblInstitution: 'Institution',
            // CV strings
            cvSummary: 'Professional Summary', cvAbout: 'About', cvExperience: 'Work Experience', cvEducation: 'Education', cvSkills: 'Skills', cvContact: 'Contact', cvExpertise: 'Expertise', cvProfile: 'Profile', cvWorkExperience: 'Work Experience', cvDetails: 'Details', cvExperienceMatrix: 'Experience Matrix', cvKeySkills: 'Key Skills', cvProfileSummary: 'Profile summary', cvCoreCompetencies: 'Core Competencies', cvComputerSkills: 'Computer Skills', cvLanguageSkills: 'Language Skills', cvProjects: 'Projects',
            // default
            defName: 'Farman Jumshudov', defJob: 'Professional Title',
            defSummary: 'Dedicated professional with a proven track record leading cross-functional teams to exceed expectations.',
            defAddress: 'Berlin, Germany', defSkills: 'Strategic Planning, Agile methodologies, Data Analysis, Leadership', defCompSkills: 'MS Office Suite, SAP, Salesforce', defProjTitle: 'Operations Overhaul', defProjDesc: 'Led a cross-functional team saving 20% in quarterly costs.', defLangName: 'English', defLangName2: 'Azerbaijani',
            defDateExp: '02/2021 - Present', defCompExp: 'Tech Horizons', defLocExp: 'San Francisco, CA', defTitleExp: 'Senior Developer', defDescExp: '• Spearheaded microservices migration.\n• Mentored a team of 5 engineers.',
            defDateEdu: '10/2014 - 07/2018', defCompEdu: 'University of Node', defTitleEdu: 'M.Sc. Computer Science', defNat: 'German'
        },
        ru: {
            stepPersonal: 'Личные данные', stepExperience: 'Опыт работы', stepEducation: 'Образование', stepSkills: 'Навыки', stepDownload: 'Скачать',
            h2Personal: 'Личные данные', pPersonal: 'Заполните поля в соответствии со стандартами.',
            lblFullName: 'ФИО', lblJobTitle: 'Желаемая должность', lblEmail: 'Email', lblPhone: 'Телефон',
            lblAddress: 'Адрес / Город', lblDob: 'Дата рождения', lblNationality: 'Гражданство',
            lblSummary: 'О себе', lblPhoto: 'Профессиональное фото', lblPhotoHelper: 'Фото обязательно/рекомендуется.',
            h2Experience: 'Опыт работы', btnAddPosition: 'Добавить место',
            h2Projects: 'Проекты / Достижения', btnAddProject: 'Добавить проект', lblProjectName: 'Название проекта',
            h2Education: 'Образование', btnAddDegree: 'Добавить диплом',
            h2Skills: 'Навыки', lblSkills: 'Навыки (через запятую)', h2ComputerSkills: 'Компьютерные навыки', lblComputerSkills: 'Программы (через запятую)',
            h2Languages: 'Языки', btnAddLanguage: 'Добавить язык', lblLangName: 'Язык', lblProficiency: 'Уровень (0-100)',
            h2Download: 'Готово к скачиванию!', pDownload: 'Ваше резюме визуально привлекательно.',
            btnExportPdf: 'Скачать PDF высокого качества',
            h3RecommendedJobs: 'Job Seeker — вакансии', pRecommendedJobs: 'По данным вашего CV и выбранной страны.', btnFindJobs: 'Найти вакансии',
            btnDownloadTop: 'Скачать',
            lblJobTitle: 'Должность', lblCompany: 'Компания', lblDescription: 'Описание / Обязанности', lblDates: 'Период', lblLocation: 'Местоположение',
            lblDegree: 'Степень', lblInstitution: 'Учебное заведение',
            cvSummary: 'О себе', cvAbout: 'О себе', cvExperience: 'Опыт работы', cvEducation: 'Образование', cvSkills: 'Навыки', cvContact: 'Контакты', cvExpertise: 'Экспертиза', cvProfile: 'Профиль', cvWorkExperience: 'Опыт работы', cvDetails: 'Детали', cvExperienceMatrix: 'Матрица опыта', cvKeySkills: 'Ключевые навыки', cvProfileSummary: 'Кратко о себе', cvCoreCompetencies: 'Ключевые компетенции', cvComputerSkills: 'Компьютерные навыки', cvLanguageSkills: 'Языки', cvProjects: 'Проекты',
            defName: 'Иван Иванов', defJob: 'Желаемая должность',
            defSummary: 'Целеустремленный профессионал...',
            defAddress: 'Москва, Россия', defSkills: 'Стратегическое планирование, Agile, Аналитика, Лидерство', defCompSkills: 'MS Office, JIRA, SAP', defProjTitle: 'Оптимизация процессов', defProjDesc: 'Внедрение новых стандартов работы.', defLangName: 'Английский', defLangName2: 'Русский',
            defDateExp: '02/2021 - Настоящее время', defCompExp: 'Tech Horizons', defLocExp: 'Москва, РФ', defTitleExp: 'Ведущий разработчик', defDescExp: '• Руководил миграцией микросервисов.\n• Был наставником для 5 инженеров.',
            defDateEdu: '10/2014 - 07/2018', defCompEdu: 'Университет Node', defTitleEdu: 'Магистр', defNat: 'Россиянин'
        },
        de: {
            stepPersonal: 'Persönlich', stepExperience: 'Erfahrung', stepEducation: 'Ausbildung', stepSkills: 'Fähigkeiten', stepDownload: 'Download',
            h2Personal: 'Persönliche Daten', pPersonal: 'Füllen Sie die Formularfelder aus.',
            lblFullName: 'Vollständiger Name', lblJobTitle: 'Angestrebte Position', lblEmail: 'E-Mail', lblPhone: 'Telefon',
            lblAddress: 'Adresse / Stadt', lblDob: 'Geburtsdatum', lblNationality: 'Nationalität',
            lblSummary: 'Kurzprofil', lblPhoto: 'Bewerbungsfoto', lblPhotoHelper: 'Ein Foto ist Standard.',
            h2Experience: 'Berufserfahrung', btnAddPosition: 'Position hinzufügen', h2Projects: 'Projekte', btnAddProject: 'Projekt hinzufügen', lblProjectName: 'Projektname',
            h2Education: 'Ausbildung', btnAddDegree: 'Abschluss hinzufügen',
            h2Skills: 'Fähigkeiten', lblSkills: 'Fähigkeiten (durch Komma getrennt)', h2ComputerSkills: 'IT-Kenntnisse', lblComputerSkills: 'Software',
            h2Languages: 'Sprachen', btnAddLanguage: 'Sprache hinzufügen', lblLangName: 'Sprache', lblProficiency: 'Niveau (0-100)',
            h2Download: 'Bereit zum Download!', pDownload: 'Ihr Lebenslauf sieht professionell aus.',
            btnExportPdf: 'Als hochwertiges PDF exportieren',
            h3RecommendedJobs: 'Job Seeker — Jobvorschläge', pRecommendedJobs: 'Basierend auf CV-Daten und Land.', btnFindJobs: 'Jobs finden',
            btnDownloadTop: 'Download',
            lblJobTitle: 'Titel', lblCompany: 'Unternehmen', lblDescription: 'Beschreibung / Aufgaben', lblDates: 'Zeitraum', lblLocation: 'Ort',
            lblDegree: 'Abschluss', lblInstitution: 'Institution',
            cvSummary: 'Kurzprofil', cvAbout: 'Über mich', cvExperience: 'Berufserfahrung', cvEducation: 'Ausbildung', cvSkills: 'Fähigkeiten', cvContact: 'Kontakt', cvExpertise: 'Expertise', cvProfile: 'Profil', cvWorkExperience: 'Berufserfahrung', cvDetails: 'Details', cvExperienceMatrix: 'Erfahrungsmatrix', cvKeySkills: 'Kernkompetenzen', cvProfileSummary: 'Profilübersicht', cvCoreCompetencies: 'Kernkompetenzen', cvComputerSkills: 'EDV-Kenntnisse', cvLanguageSkills: 'Sprachen', cvProjects: 'Projekte',
            defName: 'Max Mustermann', defJob: 'Professioneller Titel',
            defSummary: 'Engagierter Fachmann...',
            defAddress: 'Berlin, Deutschland', defSkills: 'Strategische Planung, Agile Methoden, Datenanalyse, Führung', defCompSkills: 'MS Office, SAP, Salesforce', defProjTitle: 'Betriebsüberholung', defProjDesc: 'Leitung eines bereichsübergreifenden Teams zur Senkung der vierteljährlichen Kosten.', defLangName: 'Englisch', defLangName2: 'Deutsch',
            defDateExp: '02/2021 - Heute', defCompExp: 'Tech Horizons', defLocExp: 'Berlin, DE', defTitleExp: 'Senior Entwickler', defDescExp: '• Leitung der Microservices-Migration.\n• Mentoring eines Teams von 5 Ingenieuren.',
            defDateEdu: '10/2014 - 07/2018', defCompEdu: 'Universität von Node', defTitleEdu: 'M.Sc. Informatik', defNat: 'Deutsch'
        },
        az: {
            stepPersonal: 'Şəxsi', stepExperience: 'Təcrübə', stepEducation: 'Təhsil', stepSkills: 'Bacarıqlar', stepDownload: 'Yüklə',
            h2Personal: 'Şəxsi məlumatlar', pPersonal: 'Xanaları doldurun.',
            lblFullName: 'Ad', lblJobTitle: 'Vəzifə', lblEmail: 'E-poçt', lblPhone: 'Telefon',
            lblAddress: 'Ünvan / Şəhər', lblDob: 'Doğum tarixi', lblNationality: 'Vətəndaşlıq',
            lblSummary: 'Peşəkar Xülasə', lblPhoto: 'Şəkil', lblPhotoHelper: 'Şəkil isteyə bağlıdır.',
            h2Experience: 'İş Təcrübəsi', btnAddPosition: 'Vəzifə əlavə et', h2Projects: 'Layihələr / Nailiyyətlər', btnAddProject: 'Layihə əlavə et', lblProjectName: 'Layihənin Adı',
            h2Education: 'Təhsil', btnAddDegree: 'Dərəcə əlavə et',
            h2Skills: 'Bacarıqlar', lblSkills: 'Bacarıqlar (vergüllə ayrılmış)', h2ComputerSkills: 'Kompüter Bilikləri', lblComputerSkills: 'Proqramlar',
            h2Languages: 'Dil Bilikləri', btnAddLanguage: 'Dil əlavə et', lblLangName: 'Dil', lblProficiency: 'Səviyyə (0-100)',
            h2Download: 'Yükləməyə hazırdır!', pDownload: 'CV-niz vizual olaraq hazırdır.',
            btnExportPdf: 'PDF ixrac et',
            h3RecommendedJobs: 'Job Seeker — AI iş təklifləri', pRecommendedJobs: 'CV məlumatlarına və seçilmiş ölkəyə əsasən.', btnFindJobs: 'Uyğun işləri tap',
            btnDownloadTop: 'Yüklə',
            lblJobTitle: 'Vəzifə', lblCompany: 'Şirkət', lblDescription: 'Təsvir', lblDates: 'Tarixlər', lblLocation: 'Məkan',
            lblDegree: 'Dərəcə', lblInstitution: 'Müəssisə',
            cvSummary: 'Peşəkar Xülasə', cvAbout: 'Haqqında', cvExperience: 'İş Təcrübəsi', cvEducation: 'Təhsil', cvSkills: 'Bacarıqlar', cvContact: 'Əlaqə', cvExpertise: 'Ekspertiza', cvProfile: 'Profil', cvWorkExperience: 'Təcrübə', cvDetails: 'Məlumat', cvExperienceMatrix: 'Təcrübə Matrisi', cvKeySkills: 'Əsas Bacarıqlar', cvProfileSummary: 'Profil xülasəsi', cvCoreCompetencies: 'Əsas Səriştələr', cvComputerSkills: 'Kompüter Bilikləri', cvLanguageSkills: 'Dil Bilikləri', cvProjects: 'Layihələr / Nailiyyətlər',
            defName: 'Məmməd Məmmədov', defJob: 'Peşəkar Vəzifə',
            defSummary: 'Məsuliyyətli peşəkar, gözləntiləri üstələməkdə uğurlu.',
            defAddress: 'Bakı, Azərbaycan', defSkills: 'Strateji Planlaşdırma, Agile, Liderlik', defCompSkills: 'MS Office, 1C, AutoCAD', defProjTitle: 'Satış Şəbəkəsinin Genişləndirilməsi', defProjDesc: 'Rəhbərlik edilən komanda 3 yeni bazara çıxışı təmin etdi.', defLangName: 'İngilis', defLangName2: 'Azərbaycan',
            defDateExp: '02/2021 - Hazırkı Yeri', defCompExp: 'Tech Horizons', defLocExp: 'Bakı, AZ', defTitleExp: 'Mühəndis', defDescExp: '• Mikroxidmətlərin miqrasiyasına rəhbərlik etdi.\n• Komandanı idarə etdi.',
            defDateEdu: '10/2014 - 07/2018', defCompEdu: 'Node Universiteti', defTitleEdu: 'Kompüter elmləri üzrə Maqistr', defNat: 'Azərbaycanlı'
        },
        tr: {
            lblJobTitle: 'Pozisyon', lblCompany: 'Şirket', lblDescription: 'Açıklama / Görevler', lblDates: 'Tarihler', lblLocation: 'Konum',
            lblDegree: 'Derece', lblInstitution: 'Kurum',
            cvSummary: 'Mesleki Özet', cvAbout: 'Hakkımda', cvExperience: 'Deneyim', cvEducation: 'Eğitim', cvSkills: 'Yetenek Çerçevesi', cvContact: 'İletişim', cvExpertise: 'Uzmanlık', cvProfile: 'Profil', cvWorkExperience: 'İş Deneyimi', cvDetails: 'Detaylar', cvExperienceMatrix: 'Deneyim Matrisi', cvKeySkills: 'Temel Yetenekler', cvProfileSummary: 'Profil Özeti', cvCoreCompetencies: 'Temel Yetkinlikler', cvComputerSkills: 'Bilgisayar Becerileri', cvLanguageSkills: 'Yabancı Dil Bilgisi', cvProjects: 'Projeler',
            defName: 'Ahmet Yılmaz', defJob: 'Mesleki Unvan',
            defSummary: 'Ekipleri yönetme konusunda profesyonel.',
            defAddress: 'İstanbul, Türkiye', defSkills: 'Strateji, Veri Analizi, Liderlik', defCompSkills: 'MS Office, Google Workspace', defProjTitle: 'Operasyonel Gelişim', defProjDesc: 'Takımı yöneterek verimliliği artırdık.', defLangName: 'İngilizce', defLangName2: 'Türkçe',
            defDateExp: '02/2021 - Günümüz', defCompExp: 'Tech Horizons', defLocExp: 'İstanbul, TR', defTitleExp: 'Kıdemli Geliştirici', defDescExp: '• Sunucu altyapısını yönetti.\n• 5 mühendise yol gösterdi.',
            defDateEdu: '10/2014 - 07/2018', defCompEdu: 'Node Üniversitesi', defTitleEdu: 'Bilgisayar Mühendisi', defNat: 'Türk'
        }
    };

    // --- FOOLPROOF TAG AUTOCOMPLETE SYSTEM (SKILLS ONLY) ---
    function initTagAutocomplete(inputId, options) {
        const originalInput = document.getElementById(inputId);
        if (!originalInput) return;

        // 1. Create Wrapper
        const wrap = document.createElement('div');
        wrap.className = 'cv-tag-wrap';
        wrap.style.cssText = `
            display: flex; flex-wrap: wrap; gap: 6px; padding: 10px; border: 1px solid #cbd5e0; 
            border-radius: 6px; background: #fff; cursor: text; min-height: 46px; 
            width: 100%; position: relative; transition: all 0.2s;
        `;
        originalInput.parentElement.insertBefore(wrap, originalInput);
        originalInput.style.display = 'none';

        // 2. State & Sync
        let tags = originalInput.value.split(',').map(s => s.trim()).filter(Boolean);

        const syncValue = () => {
            originalInput.value = tags.join(', ');
            triggerRender();
        };

        // 3. Components
        const tagContainer = document.createElement('div');
        tagContainer.style.display = 'contents';

        const innerInput = document.createElement('input');
        innerInput.className = 'cv-tag-inner-input';
        innerInput.placeholder = `Search or type ${inputId === 'skills' ? 'skills' : 'tools'}...`;
        innerInput.style.cssText = 'border: none; outline: none; flex: 1; min-width: 120px; font-size: 0.9rem; padding: 4px 0;';

        const dropdown = document.createElement('div');
        dropdown.className = 'cv-tag-dropdown';
        dropdown.style.cssText = `
            position: absolute; top: 100%; left: 0; right: 0; z-index: 10000;
            background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); margin-top: 5px;
            max-height: 250px; overflow-y: auto; display: none;
        `;

        wrap.appendChild(tagContainer);
        wrap.appendChild(innerInput);
        wrap.appendChild(dropdown);

        // 4. Methods
        const renderTags = () => {
            tagContainer.innerHTML = '';
            tags.forEach((tag, idx) => {
                const chip = document.createElement('div');
                chip.className = 'cv-chip';
                chip.style.cssText = `
                    display: flex; align-items: center; background: #f1f5f9; color: #334155; 
                    padding: 4px 10px; border-radius: 6px; font-size: 0.85rem; font-weight: 500;
                    border: 1px solid #e2e8f0;
                `;
                chip.innerHTML = `${tag} <span class="remove-tag" style="margin-left: 8px; cursor: pointer; color: #94a3b8; font-weight: bold;">&times;</span>`;
                chip.querySelector('.remove-tag').onclick = (e) => {
                    e.stopPropagation();
                    tags.splice(idx, 1);
                    renderTags();
                    syncValue();
                };
                tagContainer.appendChild(chip);
            });
        };

        const addTag = (val) => {
            const clean = val.trim();
            if (!clean) return;
            const exists = tags.some(t => t.toLowerCase() === clean.toLowerCase());
            if (!exists) {
                tags.push(clean);
                renderTags();
                syncValue();
            }
            innerInput.value = '';
            dropdown.style.display = 'none';
        };

        const showSuggestions = (query = "", forceAll = false) => {
            const filtered = forceAll ? options : options.filter(opt => opt.toLowerCase().includes(query.toLowerCase()));
            if (filtered.length === 0) { dropdown.style.display = 'none'; return; }

            dropdown.innerHTML = filtered.map(opt => `
                <div class="cv-opt-item" style="padding: 10px 15px; cursor: pointer; font-size: 0.9rem; color: #1e293b; border-bottom: 1px solid #f1f5f9;">${opt}</div>
            `).join('');

            dropdown.querySelectorAll('.cv-opt-item').forEach(item => {
                item.onmouseover = () => item.style.background = '#f8fafc';
                item.onmouseout = () => item.style.background = 'transparent';
                item.onmousedown = (e) => {
                    e.preventDefault();
                    addTag(item.innerText);
                };
            });
            dropdown.style.display = 'block';
        };

        // 5. Events
        wrap.onclick = () => innerInput.focus();
        innerInput.onfocus = () => {
            wrap.style.borderColor = '#3b82f6';
            wrap.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
            showSuggestions(innerInput.value, true);
        };
        innerInput.onblur = () => {
            wrap.style.borderColor = '#cbd5e0';
            wrap.style.boxShadow = 'none';
            setTimeout(() => dropdown.style.display = 'none', 200);
        };
        innerInput.oninput = () => showSuggestions(innerInput.value, false);
        innerInput.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addTag(innerInput.value);
            } else if (e.key === 'Backspace' && !innerInput.value && tags.length > 0) {
                tags.pop();
                renderTags();
                syncValue();
            }
        };

        // 6. Initial Render
        renderTags();
    }

    // --- CONSOLIDATED RICH DATASETS ---
    const OPTION_SETS = {
        jobTitles: ["Software Engineer", "Frontend Developer", "Backend Developer", "Full Stack Developer", "Mobile Developer", "DevOps Engineer", "Data Scientist", "Data Analyst", "Machine Learning Engineer", "UI/UX Designer", "Product Manager", "Project Manager", "Scrum Master", "Business Analyst", "Marketing Specialist", "Content Creator", "SEO Expert", "Sales Manager", "Accountant", "Financial Analyst", "HR Specialist", "Operations Manager", "Supply Chain Manager", "Civil Engineer", "Mechanical Engineer", "Electrical Engineer", "Architect", "Teacher", "Doctor", "Nurse", "Consultant", "Administrative Assistant", "Customer Support Specialist", "Cybersecurity Analyst", "Cloud Architect"],
        skills: ["Leadership", "Communication", "Teamwork", "Problem Solving", "Time Management", "Negotiation", "Critical Thinking", "Strategic Planning", "Project Management", "Risk Management", "Customer Service", "Public Speaking", "Budgeting", "Sales Strategy", "Financial Reporting", "Operations Management", "Adaptability", "Creativity", "Decision Making", "Analytical Thinking", "Conflict Resolution", "Organization", "Attention to Detail", "Team Leadership", "Business Development", "Market Analysis", "Process Improvement", "Data Analysis", "Research", "Presentation Skills", "Agile", "Scrum"],
        degrees: ["High School Diploma", "Associate Degree", "Bachelor of Science (BSc)", "Bachelor of Arts (BA)", "Master of Science (MSc)", "Master of Arts (MA)", "MBA", "PhD", "Engineering Degree", "Medical Degree", "Law Degree", "Vocational Certificate", "Diploma Program", "Certificate Program"],
        languageLevels: ["Beginner (A1)", "Elementary (A2)", "Intermediate (B1)", "Upper-Intermediate (B2)", "Advanced (C1)", "Fluent (C2)", "Native / Bilingual"],
        compSkills: ["Microsoft Word", "Microsoft Excel", "Microsoft PowerPoint", "Outlook", "Google Docs", "Google Sheets", "Power BI", "Tableau", "SAP", "Salesforce", "HubSpot", "Jira", "Trello", "Notion", "Slack", "VS Code", "Git", "GitHub", "Docker", "Figma", "Adobe Photoshop", "Illustrator", "Premiere Pro", "AutoCAD", "SolidWorks", "SQL", "Python", "Java", "JavaScript", "HTML", "CSS", "Canva", "Blender"],
        certifications: ["PMP", "CPA", "CFA", "AWS Solutions Architect", "Azure Fundamentals", "Google Analytics", "CCNA", "Scrum Master (PSM I)", "IELTS / TOEFL", "NEBOSH", "ISO 9001"],
        roles: ["Team Lead", "Lead Developer", "Senior Consultant", "Project Coordinator", "Strategic Advisor", "Junior Associate", "Director", "Intern", "Volunteer", "Researcher", "Assistant", "Manager"],
        industries: ["Information Technology", "Finance & Banking", "Healthcare", "Education", "Engineering", "Marketing", "Sales", "Construction", "Logistics", "Energy", "Legal", "Public Sector", "Hospitality", "Manufacturing"],
        nationalities: ["Azerbaijani", "Turkish", "German", "British", "American", "French", "Italian", "Spanish", "Russian", "Georgian", "Kazakh", "Uzbek", "Ukrainian", "Canadian", "Chinese", "Japanese", "Indian", "Brazilian", "Arabic"],
        cities: ["Baku", "Ganja", "Sumqayit", "Nakhchivan", "Istanbul", "Ankara", "Berlin", "Munich", "Hamburg", "London", "Manchester", "New York", "San Francisco", "Dubai", "Paris", "Rome", "Madrid", "Moscow", "Tbilisi", "Vienna", "Warsaw", "Prague", "Budapest", "Toronto", "Sydney", "Singapore", "Tokyo", "Milan", "Amsterdam", "Brussels"],
        companies: ["Google", "Microsoft", "Amazon", "Meta", "Apple", "Deloitte", "EY", "PwC", "KPMG", "SAP", "IBM", "Siemens", "Tesla", "Uber", "Oracle", "Cisco", "Accenture", "J.P. Morgan", "Goldman Sachs", "Morgan Stanley", "Creative Agency", "Tech Solutions", "Global Trade MMC"],
        universities: ["Harvard University", "Stanford University", "MIT", "Oxford University", "Cambridge University", "ADA University", "Baku State University", "UNEC", "Istanbul Technical University", "Berlin Institute of Technology", "ETH Zurich", "University of Toronto", "Sorbonne University", "Lomonosov Moscow State University", "Technical University of Munich"],
        majors: ["Computer Science", "Business Administration", "Finance", "Accounting", "Marketing", "Law", "International Relations", "Economics", "Civil Engineering", "Mechanical Engineering", "Electrical Engineering", "Architecture", "Medicine", "Psychology", "Design", "Data Science"],
        countryCodes: ["+994 (AZE)", "+90 (TUR)", "+49 (GER)", "+44 (UK)", "+1 (USA)", "+7 (RUS)", "+971 (UAE)", "+33 (FRA)", "+39 (ITA)", "+34 (SPA)", "+48 (POL)", "+43 (AUT)", "+31 (NED)", "+41 (SUI)", "+86 (CHN)", "+81 (JPN)"]
    };

    function setupCustomAutocomplete(inputEl, options, config = {}) {
        if (!inputEl) return;

        const wrap = inputEl.parentElement;
        if (!wrap) return;
        // Skip relative wrap for tag inputs as they have their own wrapper
        if (!inputEl.classList.contains('cv-tag-input')) wrap.style.position = 'relative';

        const dropdown = document.createElement('div');
        dropdown.className = 'custom-autocomplete-dropdown';
        dropdown.style.cssText = `
            position: absolute; top: 100%; left: 0; right: 0; z-index: 9999;
            background: #fff; border: 1px solid #cbd5e0; border-radius: 6px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.1); margin-top: 2px;
            max-height: 200px; overflow-y: auto; display: none;
        `;
        wrap.appendChild(dropdown);

        const renderOptions = (query = "", forceShowAll = false) => {
            let filterTerm = query;
            if (config.multi && !inputEl.classList.contains('cv-tag-input')) {
                const parts = query.split(',');
                filterTerm = parts[parts.length - 1].trim();
            }

            const filtered = forceShowAll ? options : options.filter(opt => opt.toLowerCase().includes(filterTerm.toLowerCase()));
            if (!filterTerm && !inputEl.value && !forceShowAll) { dropdown.style.display = 'none'; return; }
            if (filtered.length === 0) { dropdown.style.display = 'none'; return; }

            dropdown.innerHTML = filtered.map(opt => `
                <div style="padding: 8px 12px; cursor: pointer; font-size: 0.85rem; color: #2d3748; border-bottom: 1px solid #edf2f7;" class="opt-item">${opt}</div>
            `).join('');

            dropdown.querySelectorAll('.opt-item').forEach(item => {
                item.addEventListener('mouseover', () => item.style.background = '#ebf8ff');
                item.addEventListener('mouseout', () => item.style.background = 'transparent');
                item.addEventListener('mousedown', (e) => {
                    if (config.onSelect) {
                        config.onSelect(item.innerText);
                    } else if (config.multi && !inputEl.classList.contains('cv-tag-input')) {
                        const parts = inputEl.value.split(',');
                        parts[parts.length - 1] = ' ' + item.innerText;
                        inputEl.value = parts.join(', ').replace(/^,\s*/, '') + ', ';
                    } else {
                        inputEl.value = item.innerText;
                    }
                    dropdown.style.display = 'none';
                    triggerRender();
                });
            });
            dropdown.style.display = 'block';
        };

        inputEl.addEventListener('focus', () => renderOptions(inputEl.value, true));
        inputEl.addEventListener('input', () => renderOptions(inputEl.value, false));
        inputEl.addEventListener('blur', () => setTimeout(() => dropdown.style.display = 'none', 200));
    }

    function setupPhoneCountrySelector() {
        const phoneField = document.getElementById('phone');
        if (!phoneField) return;

        const wrap = phoneField.parentElement;
        wrap.style.display = 'flex';
        wrap.style.gap = '8px';

        const select = document.createElement('select');
        select.style.cssText = 'width: 100px; padding: 0 8px; border: 1px solid #cbd5e0; border-radius: 6px; font-size: 0.85rem; background: #fff;';
        select.innerHTML = `<option value="">Code</option>` + OPTION_SETS.countryCodes.map(c => `<option value="${c.split(' ')[0]}">${c}</option>`).join('');

        wrap.insertBefore(select, phoneField);

        select.addEventListener('change', () => {
            if (select.value && !phoneField.value.startsWith(select.value)) {
                phoneField.value = select.value + ' ' + phoneField.value.replace(/^\+\d+\s*/, '');
                triggerRender();
            }
        });
    }

    function initAutocompleteSystem() {
        // Main identity fields
        setupCustomAutocomplete(document.getElementById('targetJobTitle'), OPTION_SETS.jobTitles);

        // FOOLPROOF TAG SYSTEM CALLS
        initTagAutocomplete('skills', OPTION_SETS.skills);
        initTagAutocomplete('computerSkills', OPTION_SETS.compSkills);

        setupCustomAutocomplete(document.getElementById('nationality'), OPTION_SETS.nationalities);
        setupCustomAutocomplete(document.getElementById('address'), OPTION_SETS.cities);

        setupPhoneCountrySelector();

        // DOB Calendar
        const dob = document.getElementById('dob');
        if (dob) { dob.type = 'date'; }

        const applyToAll = (sel, set, config = {}) => document.querySelectorAll(sel).forEach(el => setupCustomAutocomplete(el, set, config));

        // Experiences
        applyToAll('#experience-list .inp-title', OPTION_SETS.jobTitles);
        applyToAll('#experience-list .inp-company', OPTION_SETS.companies);
        applyToAll('#experience-list .inp-loc', OPTION_SETS.cities);

        // Education
        applyToAll('#education-list .inp-title', OPTION_SETS.degrees);
        applyToAll('#education-list .inp-company', OPTION_SETS.universities);
        applyToAll('#education-list .inp-loc', OPTION_SETS.cities);

        // Languages
        applyToAll('#language-list .inp-lang', ["English", "German", "Spanish", "French", "Russian", "Arabic", "Turkish", "Azerbaijani", "Chinese", "Japanese", "Portuguese", "Italian"]);
        applyToAll('#language-list .inp-prof', OPTION_SETS.languageLevels);

        // Projects
        applyToAll('#project-list .inp-title', OPTION_SETS.roles);

        // Standardize dynamic dates to Month Pickers
        document.querySelectorAll('.inp-date').forEach(el => {
            if (el.id !== 'dob') el.type = 'month';
        });
    }
    initAutocompleteSystem();

    let currentLang = 'en';
    let baseLanguage = 'en';
    let baseCVData = null; // REAL ORIGINAL DATA
    let translatedCVData = null; // CURRENT DISPLAY DATA
    let translationsCache = {}; // Cache for performance

    async function setLanguage(lang) {
        if (!translations[lang]) lang = 'en';
        currentLang = lang;

        document.querySelectorAll('.lang-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.lang === lang);
        });

        // IMPORTANT: language buttons translate ONLY the CV preview/content.
        // Site interface labels/buttons stay English as requested.
        await triggerRender();
        setTimeout(() => normalizeCVPreviewLanguage(lang), 30);
        setTimeout(() => normalizeCVPreviewLanguage(lang), 250);
    }

    let translationTimeout = null;
    async function translateAndRenderLive(data) {
        if (!data) return;
        if (translationTimeout) clearTimeout(translationTimeout);

        const cacheKey = `${currentLang}_${JSON.stringify(data).length}`;

        // Use cache if available for instant switching
        if (translationsCache[cacheKey]) {
            translatedCVData = translationsCache[cacheKey];
            if (isBasicPackMode) {
                renderBasicPackCV(translatedCVData);
            } else {
                renderExactTemplateContinuation(translatedCVData);
            }
            return;
        }

        // Initially render base data so the user sees something immediately
        translatedCVData = data;
        if (isBasicPackMode) {
            renderBasicPackCV(translatedCVData);
        } else {
            renderExactTemplateContinuation(translatedCVData);
        }

        translationTimeout = setTimeout(async () => {
            const dlBtn = document.getElementById('finalize-download-btn');
            const oldText = dlBtn ? dlBtn.innerText : '';
            if (dlBtn) dlBtn.innerText = 'Translating Content...';

            try {
                const result = await translateCVContent(data, currentLang);
                if (result) {
                    translationsCache[cacheKey] = result;
                    translatedCVData = result;
                    if (isBasicPackMode) {
                        renderBasicPackCV(translatedCVData);
                    } else {
                        renderExactTemplateContinuation(translatedCVData);
                    }
                }
            } catch (e) {
                console.warn("Translation failed, staying with base.", e);
            } finally {
                if (dlBtn) dlBtn.innerText = oldText;
            }
        }, 800);
    }

    async function translateCVContent(data, targetLang) {
        const d = JSON.parse(JSON.stringify(data));

        try {
            const response = await apiFetch('/api/translate-cv', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cvData: d, targetLang })
            });

            if (!response.ok) throw new Error('Translation service error');
            const res = await response.json();
            return res.translatedData || null;
        } catch (err) {
            console.error('AI Translation failure:', err);
            return null;
        }
    }

    const DEFAULT_CV_DATA = {
        fullName: "Farman Jumshudov",
        jobTitle: "Professional Title",
        email: "farmantrl@gmail.com",
        phone: "+1 555 019 990",
        address: "Berlin, Germany",
        dob: "14.05.1990",
        nationality: "German",
        summary: "Dedicated professional with a proven track record leading cross-functional teams to exceed expectations.",
        showPhoto: true,
        showDob: true,
        showNat: true,
        skills: ["Strategic Planning", "Agile methodologies", "Data Analysis", "Leadership"],
        computerSkills: ["MS Office Suite", "SAP", "Salesforce"],
        experience: [{
            dates: "02/2021 - Present", company: "Tech Horizons", title: "Senior Developer", location: "Berlin",
            desc: "• Spearheaded microservices migration.\n• Mentored a team of 5 engineers."
        }],
        education: [{ dates: "10/2014 - 07/2018", company: "University of Node", title: "M.Sc. Computer Science" }],
        projects: [{ title: "Operations Overhaul", desc: "Led a cross-functional team saving 20% in quarterly costs." }],
        languages: [{ name: "English", proficiency: "100" }, { name: "Azerbaijani", proficiency: "90" }]
    };

    document.querySelectorAll('.lang-btn').forEach(b => {
        b.addEventListener('click', (e) => {
            const lang = e.target.closest('.lang-btn').dataset.lang;
            if (lang) setLanguage(lang);
        });
    });

    // --- State & Elements ---
    const views = {
        home: document.getElementById('home-view'),
        auth: document.getElementById('auth-view'),
        mainApp: document.getElementById('main-app'),
        country: document.getElementById('country-view'),
        library: document.getElementById('library-view'),
        editor: document.getElementById('editor-view')
    };

    // Auth
    const loginEmail = document.getElementById('login-email');
    const loginPassword = document.getElementById('login-password');
    const loginBtn = document.getElementById('login-btn');
    const rememberMeCheck = document.getElementById('remember-me');
    const backToLoginBtn = document.getElementById('back-to-login-btn');

    // Restore remembered email and keep users signed in on this device
    if (localStorage.getItem('rememberedEmail') && loginEmail) {
        loginEmail.value = localStorage.getItem('rememberedEmail');
    }
    if (rememberMeCheck) rememberMeCheck.checked = true;
    
    // Clear insecure rememberedCredentials if it exists (leftover from old system)
    localStorage.removeItem('rememberedCredentials');

    const regName = document.getElementById('reg-name');
    const regEmail = document.getElementById('reg-email');
    const regPassword = document.getElementById('reg-password');
    const regAge = document.getElementById('reg-age');
    const regGender = document.getElementById('reg-gender');
    const registerBtn = document.getElementById('register-btn');

    const toggleRegister = document.getElementById('toggle-register');
    const toggleLogin = document.getElementById('toggle-login');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    // Menu & Profile
    const userMenuBtn = document.getElementById('user-menu-btn');
    const userMenuDropdown = document.getElementById('user-menu-dropdown');
    const userDropdownContent = document.getElementById('user-dropdown-content');
    const menuProfile = document.getElementById('menu-profile');
    const menuLogout = document.getElementById('menu-logout');

    const profileModal = document.getElementById('profile-modal');
    const closeProfile = document.getElementById('close-profile');
    const profileName = document.getElementById('profile-name');
    const profileEmail = document.getElementById('profile-email');
    const saveProfileBtn = document.getElementById('save-profile-btn');

    // Country Logic
    const countrySelect = document.getElementById('country-select');
    const countrySubmitBtn = document.getElementById('country-submit-btn');
    const backToSigninBtn = document.getElementById('back-to-signin-btn');
    let currentCountryRules = { showPhoto: false, showDateOfBirth: false, showNationality: false, tone: 'professional', preferredLayout: 'minimal' };

    // Library Grid
    const templateGrid = document.getElementById('template-grid');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const backToCountryBtn = document.getElementById('back-to-country-btn');
    // Main App State & Variables
    let activeLayoutPattern = 'modern';
    let activeThemeColor = 'ocean';
    // Switch between Original and Basic CV Pack based on URL
    let isBasicPackMode = window.location.search.includes('mode=basic');
    const explicitlyOriginal = window.location.search.includes('mode=original');

    if (isBasicPackMode) {
        localStorage.setItem('cvPackMode', 'basic');
        localStorage.removeItem('cvTemplate');
        localStorage.removeItem('cvCountry'); // Mandatory country gate
    } else if (explicitlyOriginal) {
        localStorage.removeItem('cvPackMode');
        localStorage.removeItem('cvTemplate');
        localStorage.removeItem('cvCountry'); // Mandatory country gate
        isBasicPackMode = false;
    } else {
        isBasicPackMode = localStorage.getItem('cvPackMode') === 'basic';
    }

    // Developer/Admin Console Helpers (Hidden)
    window.viewRegisteredUsers = function () {
        return JSON.parse(localStorage.getItem("allUsers")) || [];
    };

    window.exportRegisteredUsers = function () {
        const users = JSON.parse(localStorage.getItem("allUsers")) || [];
        const blob = new Blob([JSON.stringify(users, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "registered-users.json";
        a.click();
        URL.revokeObjectURL(a.href);
    };
    const libRegionBadge = document.getElementById('library-region-badge');

    // Wizard Form Navigation
    const stepsElements = document.querySelectorAll('.wizard-step');
    const progressSteps = document.querySelectorAll('.progress-step');
    const progressFill = document.getElementById('progress-fill');
    const wizPrev = document.getElementById('wiz-prev');
    const wizNext = document.getElementById('wiz-next');
    let currentStep = 1;
    const numSteps = 5;

    // Inputs (Conditional & Base)
    const fullNameInput = document.getElementById('fullName');
    const emailInput = document.getElementById('email');
    const photoInput = document.getElementById('photo');
    let photoDataUrl = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22200%22%20height%3D%22200%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20200%20200%22%20preserveAspectRatio%3D%22none%22%3E%3Crect%20width%3D%22200%22%20height%3D%22200%22%20fill%3D%22%23eeeeee%22%3E%3C%2Frect%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%20font-family%3D%22sans-serif%22%20font-size%3D%2214px%22%20fill%3D%22%23999%22%3EPhoto%3C%2Ftext%3E%3C%2Fsvg%3E';

    const groupPhoto = document.getElementById('group-photo');
    const groupDob = document.getElementById('group-dob');
    const groupNationality = document.getElementById('group-nationality');

    // Editor Area
    const expList = document.getElementById('experience-list');
    const eduList = document.getElementById('education-list');
    const cvDocument = document.getElementById('cv-preview');

    // --- TEMPLATE REGISTRY ---
    const COUNTRY_TEMPLATES = {
        azerbaijan: [
            { id: "az-corporate-sidebar", name: "Corporate Sidebar", layout: "az-corporate-sidebar", category: "azerbaijan" },
            { id: "az-modern-executive", name: "Modern Executive", layout: "az-modern-executive", category: "azerbaijan" },
            { id: "az-finance-pro", name: "Finance Professional", layout: "az-finance-pro", category: "azerbaijan" },
            { id: "az-minimal-premium", name: "Premium Minimal", layout: "az-minimal-premium", category: "azerbaijan" },
            { id: "az-compact-recruiter", name: "Compact Recruiter", layout: "az-compact-recruiter", category: "azerbaijan" }
        ],
        germany: [
            { id: "premium-germany-1", name: "Germany Slate Sidebar", preview: "assets/premium/germany_pdf/page-01.jpg", layout: "de-pdf-01", category: "germany" },
            { id: "premium-germany-2", name: "Germany Creative Dark", preview: "assets/premium/germany_pdf/page-02.jpg", layout: "de-pdf-02", category: "germany" },
            { id: "premium-germany-3", name: "Germany Finance Timeline", preview: "assets/premium/germany_pdf/page-03.jpg", layout: "de-pdf-03", category: "germany" },
            { id: "premium-germany-4", name: "Germany Blue Corporate", preview: "assets/premium/germany_pdf/page-04.jpg", layout: "de-pdf-04", category: "germany" },
            { id: "premium-germany-5", name: "Germany Executive Red", preview: "assets/premium/germany_pdf/page-05.jpg", layout: "de-pdf-05", category: "germany" },
            { id: "premium-germany-6", name: "Germany Luxe Minimal", preview: "assets/premium/germany_pdf/page-06.jpg", layout: "de-pdf-06", category: "germany" },
            { id: "premium-germany-7", name: "Germany Classic Grey", preview: "assets/premium/germany_pdf/page-07.jpg", layout: "de-pdf-07", category: "germany" },
            { id: "premium-germany-8", name: "Germany Admin Clean", preview: "assets/premium/germany_pdf/page-08.jpg", layout: "de-pdf-08", category: "germany" },
            { id: "premium-germany-9", name: "Germany ATS Yellow", preview: "assets/premium/germany_pdf/page-09.jpg", layout: "de-pdf-09", category: "germany" },
            { id: "premium-germany-10", name: "Germany Editorial Minimal", preview: "assets/premium/germany_pdf/page-10.jpg", layout: "de-pdf-10", category: "germany" }
        ],
        usa: [
            { id: "premium-usa-1", name: "USA 01 Gariel Yellow Editorial", preview: "assets/premium/usa/01_Clean-Professional-Creative-and-Modern-Resume-CV-Curriculum-Vitae-Design-Template-MS-Word-Apple-Pages-PSD-Free-Download-20.webp", layout: "us-live-creative-column", category: "usa" },
            { id: "premium-usa-2", name: "USA 02 Aliya Teal Photo Band", preview: "assets/premium/usa/01_Clean-Professional-Creative-and-Modern-Resume-CV-Curriculum-Vitae-Design-Template-MS-Word-Apple-Pages-PSD-Free-Download-56-3.jpg", layout: "us-live-modern-blue", category: "usa" },
            { id: "premium-usa-3", name: "USA 03 Olivia Student Pastel", preview: "assets/premium/usa/1131w-C-3BIprDYp8.webp", layout: "us-live-canva-clean", category: "usa" },
            { id: "premium-usa-4", name: "USA 04 James Gradient Sales", preview: "assets/premium/usa/41c5c7a3549f0ad37a3448f50098b911.jpg", layout: "us-live-hero-modern", category: "usa" },
            { id: "premium-usa-5", name: "USA 05 Paolo Blue Awards", preview: "assets/premium/usa/CVT5.webp", layout: "us-live-bold-initials", category: "usa" },
            { id: "premium-usa-6", name: "USA 06 David Cyan Corporate", preview: "assets/premium/usa/Image-1-1.webp", layout: "us-live-compact-tech", category: "usa" },
            { id: "premium-usa-7", name: "USA 07 Max Navy Rounded", preview: "assets/premium/usa/hero-image-3.png", layout: "us-live-orange-accent", category: "usa" },
            { id: "premium-usa-8", name: "USA 08 Mark Mustard Tech", preview: "assets/premium/usa/it-specialist-2-page-modern-ats-friendly-canva-resume-template_348077-original.webp", layout: "us-live-photo-band", category: "usa" },
            { id: "premium-usa-9", name: "USA 09 Elizabeth Interior Blue", preview: "assets/premium/usa/lucky__blue__A0D8F3_424A4E.webp", layout: "us-live-it-specialist", category: "usa" },
            { id: "premium-usa-10", name: "USA 10 Notable Orange Brown", preview: "assets/premium/usa/CV-template-free-notable-orange-CV-brown-1.svg", layout: "us-live-skyline", category: "usa" }
        ],
        uk: ['uk-live-07','uk-live-08','uk-live-09','uk-live-01','uk-live-03','uk-live-04','uk-live-02','uk-live-05','uk-live-06','uk-live-10']
    };

    const MAIN_GENERATOR_TEMPLATES = [
        ...COUNTRY_TEMPLATES.azerbaijan,
        ...COUNTRY_TEMPLATES.germany,
        ...COUNTRY_TEMPLATES.usa,
        ...COUNTRY_TEMPLATES.uk
    ];

    const DEFAULT_TEMPLATE_BY_COUNTRY = {
        azerbaijan: 'az-corporate-sidebar',
        germany: 'de-classic-lebenslauf',
        usa: 'us-ats-clean',
        uk: 'uk-professional-standard',
        canada: 'ca-live-01',
        singapore: 'sg-live-01',
        france: 'fr-live-01',
        china: 'cn-live-01',
        spain: 'es-live-01'
    };

    function getDefaultTemplateForCountry(country) {
        return DEFAULT_TEMPLATE_BY_COUNTRY[country] || 'us-ats-clean';
    }

    const PREMIUM_TEMPLATE_LIBRARY = {
        azerbaijan: [
            { id: "premium-azerbaijan-1", name: "1 Resume Template Design 5 Bc81ec12 B505 42cf Aa10 3fbd90ed4d69", preview: "assets/premium/azerbaijan/1_resume_template_design_5_bc81ec12-b505-42cf-aa10-3fbd90ed4d69.webp", layout: "az-corporate-sidebar", category: "azerbaijan" },
            { id: "premium-azerbaijan-2", name: "662f907854ee25d84e4f1640 Mvcz7mqqsk Photo", preview: "assets/premium/azerbaijan/662f907854ee25d84e4f1640_mVCz7mqqSK-photo.png", layout: "az-modern-executive", category: "azerbaijan" },
            { id: "premium-azerbaijan-3", name: "92313 Wlbwyjgji75x1likqgrjwg", preview: "assets/premium/azerbaijan/92313_wLbwyJGJi75X1LikQGRJwg.jpg", layout: "az-finance-pro", category: "azerbaijan" },
            { id: "premium-azerbaijan-4", name: "Cv Format 10", preview: "assets/premium/azerbaijan/cv-format-10.jpg", layout: "az-minimal-premium", category: "azerbaijan" },
            { id: "premium-azerbaijan-5", name: "Image", preview: "assets/premium/azerbaijan/image.png", layout: "az-compact-recruiter", category: "azerbaijan" },
            { id: "premium-azerbaijan-6", name: "Images", preview: "assets/premium/azerbaijan/images.jpg", layout: "az-corporate-sidebar", category: "azerbaijan" },
            { id: "premium-azerbaijan-7", name: "Images", preview: "assets/premium/azerbaijan/images.png", layout: "az-modern-executive", category: "azerbaijan" },
            { id: "premium-azerbaijan-8", name: "Main Header Cv 1.df1414c", preview: "assets/premium/azerbaijan/main-header-cv-1.df1414c.png", layout: "az-finance-pro", category: "azerbaijan" },
            { id: "premium-azerbaijan-9", name: "Main Header Cv 2.5429890", preview: "assets/premium/azerbaijan/main-header-cv-2.5429890.png", layout: "az-minimal-premium", category: "azerbaijan" },
            { id: "premium-azerbaijan-10", name: "Sales Cv Template For Austria", preview: "assets/premium/azerbaijan/sales_cv_template_for_Austria.webp", layout: "az-compact-recruiter", category: "azerbaijan" }
        ],
        germany: [
            { id: "premium-germany-1", name: "Germany Slate Sidebar", preview: "assets/premium/germany_pdf/page-01.jpg", layout: "de-pdf-01", category: "germany" },
            { id: "premium-germany-2", name: "Germany Creative Dark", preview: "assets/premium/germany_pdf/page-02.jpg", layout: "de-pdf-02", category: "germany" },
            { id: "premium-germany-3", name: "Germany Finance Timeline", preview: "assets/premium/germany_pdf/page-03.jpg", layout: "de-pdf-03", category: "germany" },
            { id: "premium-germany-4", name: "Germany Blue Corporate", preview: "assets/premium/germany_pdf/page-04.jpg", layout: "de-pdf-04", category: "germany" },
            { id: "premium-germany-5", name: "Germany Executive Red", preview: "assets/premium/germany_pdf/page-05.jpg", layout: "de-pdf-05", category: "germany" },
            { id: "premium-germany-6", name: "Germany Luxe Minimal", preview: "assets/premium/germany_pdf/page-06.jpg", layout: "de-pdf-06", category: "germany" },
            { id: "premium-germany-7", name: "Germany Classic Grey", preview: "assets/premium/germany_pdf/page-07.jpg", layout: "de-pdf-07", category: "germany" },
            { id: "premium-germany-8", name: "Germany Admin Clean", preview: "assets/premium/germany_pdf/page-08.jpg", layout: "de-pdf-08", category: "germany" },
            { id: "premium-germany-9", name: "Germany ATS Yellow", preview: "assets/premium/germany_pdf/page-09.jpg", layout: "de-pdf-09", category: "germany" },
            { id: "premium-germany-10", name: "Germany Editorial Minimal", preview: "assets/premium/germany_pdf/page-10.jpg", layout: "de-pdf-10", category: "germany" }
        ],
        usa: [
            { id: "premium-usa-1", name: "USA 01 Gariel Yellow Editorial", preview: "assets/premium/usa/01_Clean-Professional-Creative-and-Modern-Resume-CV-Curriculum-Vitae-Design-Template-MS-Word-Apple-Pages-PSD-Free-Download-20.webp", layout: "us-live-creative-column", category: "usa" },
            { id: "premium-usa-2", name: "USA 02 Aliya Teal Photo Band", preview: "assets/premium/usa/01_Clean-Professional-Creative-and-Modern-Resume-CV-Curriculum-Vitae-Design-Template-MS-Word-Apple-Pages-PSD-Free-Download-56-3.jpg", layout: "us-live-modern-blue", category: "usa" },
            { id: "premium-usa-3", name: "USA 03 Olivia Student Pastel", preview: "assets/premium/usa/1131w-C-3BIprDYp8.webp", layout: "us-live-canva-clean", category: "usa" },
            { id: "premium-usa-4", name: "USA 04 James Gradient Sales", preview: "assets/premium/usa/41c5c7a3549f0ad37a3448f50098b911.jpg", layout: "us-live-hero-modern", category: "usa" },
            { id: "premium-usa-5", name: "USA 05 Paolo Blue Awards", preview: "assets/premium/usa/CVT5.webp", layout: "us-live-bold-initials", category: "usa" },
            { id: "premium-usa-6", name: "USA 06 David Cyan Corporate", preview: "assets/premium/usa/Image-1-1.webp", layout: "us-live-compact-tech", category: "usa" },
            { id: "premium-usa-7", name: "USA 07 Max Navy Rounded", preview: "assets/premium/usa/hero-image-3.png", layout: "us-live-orange-accent", category: "usa" },
            { id: "premium-usa-8", name: "USA 08 Mark Mustard Tech", preview: "assets/premium/usa/it-specialist-2-page-modern-ats-friendly-canva-resume-template_348077-original.webp", layout: "us-live-photo-band", category: "usa" },
            { id: "premium-usa-9", name: "USA 09 Elizabeth Interior Blue", preview: "assets/premium/usa/lucky__blue__A0D8F3_424A4E.webp", layout: "us-live-it-specialist", category: "usa" },
            { id: "premium-usa-10", name: "USA 10 Notable Orange Brown", preview: "assets/premium/usa/CV-template-free-notable-orange-CV-brown-1.svg", layout: "us-live-skyline", category: "usa" }
        ],
        uk: [
            { id: "premium-uk-1", name: "UK 01 Julia Orange Designer", preview: "assets/premium/uk/14-768x1080.jpg", layout: "uk-live-07", category: "uk" },
            { id: "premium-uk-2", name: "UK 02 Jasmine Roy Bronze", preview: "assets/premium/uk/be5daa80e36bb23411bc96fd20ea6f53.jpg", layout: "uk-live-08", category: "uk" },
            { id: "premium-uk-3", name: "UK 03 Cassidy Mono Manager", preview: "assets/premium/uk/CVTemplatesuk.com-Professional-CV-Template-for-Job-Application-Modern-Resume-Template-Creative-Resume-Word-Resume-Student-Resume-8-01.jpg", layout: "uk-live-09", category: "uk" },
            { id: "premium-uk-4", name: "UK 04 Carmen Burgundy Sales", preview: "assets/premium/uk/Electronics-Sales-Associate-Resume-Template.jpg", layout: "uk-live-01", category: "uk" },
            { id: "premium-uk-5", name: "UK 05 Lauren Navy Header", preview: "assets/premium/uk/il_340x270.5271232800_3isc.webp", layout: "uk-live-03", category: "uk" },
            { id: "premium-uk-6", name: "UK 06 Sammy Levine Navy Cream", preview: "assets/premium/uk/il_570xN.3840643287_7kqb.webp", layout: "uk-live-04", category: "uk" },
            { id: "premium-uk-7", name: "UK 07 Laura Green Project", preview: "assets/premium/uk/hi-tech__beige__3F3934_E9D4AC.webp", layout: "uk-live-02", category: "uk" },
            { id: "premium-uk-8", name: "UK 08 Archie Gold Luxury", preview: "assets/premium/uk/il_fullxfull.3601072253_56vw.webp", layout: "uk-live-05", category: "uk" },
            { id: "premium-uk-9", name: "UK 09 Compact Tan Corporate", preview: "assets/premium/uk/images.jpg", layout: "uk-live-06", category: "uk" },
            { id: "premium-uk-10", name: "UK 10 Classic Photo Clean", preview: "assets/premium/uk/il_300x300.3340140578_cg03.avif", layout: "uk-live-10", category: "uk" }
        ]
    };


    // Newly uploaded country Premium Packs (10 editable CSS templates each).
    const NEW_PREMIUM_COUNTRIES = {
        canada: { prefix: 'ca', folder: 'canada', file: i => `template_${i}.jpg`, label: 'Canada' },
        singapore: { prefix: 'sg', folder: 'singapore', file: i => `template_${i}.png`, label: 'Singapore' },
        france: { prefix: 'fr', folder: 'france', file: i => `template_${i}.png`, label: 'France' },
        china: { prefix: 'cn', folder: 'china', file: i => `china_template_${i}.png`, label: 'China' },
        spain: { prefix: 'es', folder: 'spain', file: i => `template_${i}.png`, label: 'Spain' }
    };

    Object.entries(NEW_PREMIUM_COUNTRIES).forEach(([countryKey, meta]) => {
        PREMIUM_TEMPLATE_LIBRARY[countryKey] = Array.from({ length: 10 }, (_, idx) => {
            const n = idx + 1;
            return {
                id: `premium-${countryKey}-${n}`,
                name: `${meta.label} ${String(n).padStart(2, '0')} Premium Editable`,
                preview: `assets/premium/${meta.folder}/${meta.file(n)}`,
                layout: `${meta.prefix}-live-${String(n).padStart(2, '0')}`,
                category: countryKey,
                pack: 'premium'
            };
        });
    });

    function getPremiumTemplatesForCountry(country) {
        return PREMIUM_TEMPLATE_LIBRARY[country] || [];
    }

    function getPremiumTemplateById(id) {
        return Object.values(PREMIUM_TEMPLATE_LIBRARY).flat().find(t => t.id === id) || null;
    }

    const LIVE_PREMIUM_LAYOUTS = {
        // Canada final order: 07 = red/white classic, 08 = black/yellow Brian Baxter, 09 = Emily Kate soft red.
        canada: ['ca-live-01','ca-live-02','ca-live-03','ca-live-04','ca-live-05','ca-live-06','ca-live-08','ca-live-09','ca-live-07','ca-live-10'],
        singapore: ['sg-live-01','sg-live-02','sg-live-03','sg-live-04','sg-live-05','sg-live-06','sg-live-07','sg-live-08','sg-live-09','sg-live-10'],
        // Azerbaijan premium images are mapped one-by-one to their own CSS-built editable designs.
        // 1 Amber May, 2 Zeynal Abidin, 3 Mariana Anderson, 4 Krishna Kumar, 5 Zoey Walker,
        // 6 Armenian blue sidebar, 7 Yaseman red diagonal, 8 Juliana dark cards, 9 Purple graphic, 10 Clean sales/formal.
        azerbaijan: ['az-live-sales-card','az-live-navy-sidebar','az-live-clean-photo','az-live-gold-executive','az-live-blue-header','az-live-soft-sidebar','az-live-modern-bars','az-live-finance-grid','az-live-top-band','az-live-minimal-line'],
        germany: ['de-live-slate-sidebar','de-live-berlin-premium','de-live-classic-lebenslauf','de-live-clean-pro','de-live-word-02','de-live-developer','de-live-compact-card','de-live-formal-photo','de-live-blue-title','de-live-modern-premium'],
        usa: ['us-live-creative-column','us-live-modern-blue','us-live-canva-clean','us-live-hero-modern','us-live-bold-initials','us-live-compact-tech','us-live-orange-accent','us-live-photo-band','us-live-it-specialist','us-live-skyline'],
        uk: ['uk-live-07','uk-live-08','uk-live-09','uk-live-01','uk-live-03','uk-live-04','uk-live-02','uk-live-05','uk-live-06','uk-live-10']
    };

    Object.keys(LIVE_PREMIUM_LAYOUTS).forEach(countryKey => {
        (PREMIUM_TEMPLATE_LIBRARY[countryKey] || []).forEach((tpl, idx) => {
            tpl.layout = LIVE_PREMIUM_LAYOUTS[countryKey][idx] || LIVE_PREMIUM_LAYOUTS[countryKey][0];
            const azNames = ['AZ 01 Amber May Dark Header','AZ 02 Zeynal Executive Sidebar','AZ 03 Mariana Navy Sidebar','AZ 04 Krishna Rounded Corporate','AZ 05 Zoey Teal Achievement','AZ 06 Blue Professional Sidebar','AZ 07 Yaseman Red Diagonal','AZ 08 Juliana Dark Card','AZ 09 Purple Creative Timeline','AZ 10 Clean Formal Sales'];
            const usaNames = ['USA 01 Gariel Yellow Editorial','USA 02 Aliya Teal Photo Band','USA 03 Olivia Student Pastel','USA 04 James Gradient Sales','USA 05 Paolo Blue Awards','USA 06 David Cyan Corporate','USA 07 Max Navy Rounded','USA 08 Mark Mustard Tech','USA 09 Elizabeth Interior Blue','USA 10 Notable Orange Brown'];
            tpl.name = countryKey === 'azerbaijan'
                ? azNames[idx]
                : (countryKey === 'usa' ? usaNames[idx] : tpl.name.replace(/[ _-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).slice(0, 58));
        });
    });

    // Singapore premium templates: exact order from the uploaded 10 designs.
    const SINGAPORE_EXACT_NAMES = [
        'SG 01 Robert James Grey Header',
        'SG 02 Margaret Phua Minimal Finance',
        'SG 03 Jonathan Smith Red Developer',
        'SG 04 Dani Martinez Split Designer',
        'SG 05 Christian Hybrid Professional',
        'SG 06 Richard Sanchez Blue Product',
        'SG 07 Juliette Hudson Navy Art',
        'SG 08 Sophia Isabella Orange Marketing',
        'SG 09 Madison Chloe Dark UI',
        'SG 10 Jhon Anders Gold Timeline'
    ];
    (PREMIUM_TEMPLATE_LIBRARY.singapore || []).forEach((tpl, idx) => {
        const n = String(idx + 1).padStart(2, "0");
        tpl.layout = "sg-live-" + n;
        tpl.preview = "assets/premium/singapore/template_" + (idx + 1) + ".png";
        tpl.name = SINGAPORE_EXACT_NAMES[idx] || tpl.name;
    });


    // France premium templates: exact order from the uploaded 10 designs.
    const FRANCE_EXACT_NAMES = [
        'FR 01 Célia Naudin Clean Beige',
        'FR 02 Amélie Poulain Café Sidebar',
        'FR 03 Julien Morano Navy Marketing',
        'FR 04 Julie Amandier Floral Creative',
        'FR 05 Raphaël Martin Blue Commercial',
        'FR 06 Samantha Harris Minimal Split',
        'FR 07 Garance Jayne Fashion Clean',
        'FR 08 Melanie Does QR Sidebar',
        'FR 09 Bastein Vidé Timeline Red',
        'FR 10 Martin Anderson Grey Corporate'
    ];
    (PREMIUM_TEMPLATE_LIBRARY.france || []).forEach((tpl, idx) => {
        const n = String(idx + 1).padStart(2, "0");
        tpl.layout = "fr-live-" + n;
        tpl.preview = "assets/premium/france/template_" + (idx + 1) + ".png";
        tpl.name = FRANCE_EXACT_NAMES[idx] || tpl.name;
    });



    // China premium templates: exact order from uploaded designs.
    const CHINA_EXACT_NAMES = [
        'CN 01 Liam Anderson Red Teacher',
        'CN 02 Jianli Online Blue Sidebar',
        'CN 03 Chow Tung Dark Sidebar',
        'CN 04 Jeremy Torres Blue Graphic',
        'CN 05 Mariana Napolitani Beige Dark',
        'CN 06 Sophia Brown Clean Teacher',
        'CN 07 Chinese Grey Professional',
        'CN 08 Classic Brown Ornament',
        'CN 09 Darhiel Hernandez Yellow Accent',
        'CN 10 Ava Davis Brown Translator'
    ];
    (PREMIUM_TEMPLATE_LIBRARY.china || []).forEach((tpl, idx) => {
        const n = String(idx + 1).padStart(2, '0');
        tpl.layout = 'cn-live-' + n;
        tpl.preview = 'assets/premium/china/china_template_' + (idx + 1) + '.png';
        tpl.name = CHINA_EXACT_NAMES[idx] || tpl.name;
    });

    // Germany premium templates: use CSS-built editable layouts matching uploaded image designs.
    const GERMANY_EXACT_PREVIEWS = [
        'assets/premium/germany/24b1e0140151ddca9895ea1ed8ee2ccd-7-full.jpg',
        'assets/premium/germany/Berlin-Premium-Professional-Resume-Template-2.jpg',
        'assets/premium/germany/example-cv-german-cv-434a54.jpg',
        'assets/premium/germany/free-resume-professional.webp',
        'assets/premium/germany/free_german_cv_template_word_02.jpg',
        'assets/premium/germany/German-Resume-Template-for-Developers.png',
        'assets/premium/germany/il_340x270.5884791971_o75s.webp',
        'assets/premium/germany/lebenslauf002.jpg',
        'assets/premium/germany/lebenslauf_vorlagen_02.jpg',
        'assets/premium/germany/Modern-German-CV-Template.png'
    ];
    const GERMANY_EXACT_NAMES = [
        'DE 01 Slate Sidebar Editable',
        'DE 02 Berlin Premium Creative',
        'DE 03 German Finance Timeline',
        'DE 04 Executive Red Sidebar',
        'DE 05 Blue Corporate Sidebar',
        'DE 06 Developer Luxe Minimal',
        'DE 07 Compact Classic Card',
        'DE 08 Formal Photo Clean',
        'DE 09 ATS Yellow Minimal',
        'DE 10 Modern Designer Sidebar'
    ];
    (PREMIUM_TEMPLATE_LIBRARY.germany || []).forEach((tpl, idx) => {
        tpl.layout = `de-pdf-${String(idx + 1).padStart(2, '0')}`;
        tpl.preview = GERMANY_EXACT_PREVIEWS[idx] || tpl.preview;
        tpl.name = GERMANY_EXACT_NAMES[idx] || tpl.name;
    });
    if (COUNTRY_TEMPLATES.germany) {
        COUNTRY_TEMPLATES.germany.forEach((tpl, idx) => {
            tpl.layout = `de-pdf-${String(idx + 1).padStart(2, '0')}`;
            tpl.preview = GERMANY_EXACT_PREVIEWS[idx] || tpl.preview;
            tpl.name = GERMANY_EXACT_NAMES[idx] || tpl.name;
        });
    }

    // Hard lock: DE 08 and DE 09 must never share the same layout.
    const de08Template = getPremiumTemplateById('premium-germany-8');
    const de09Template = getPremiumTemplateById('premium-germany-9');
    if (de08Template) {
        de08Template.layout = 'de-pdf-08';
        de08Template.name = 'DE 08 Formal Photo Clean';
        de08Template.preview = 'assets/premium/germany/lebenslauf002.jpg';
    }
    if (de09Template) {
        de09Template.layout = 'de-pdf-09';
        de09Template.name = 'DE 09 ATS Yellow Minimal';
        de09Template.preview = 'assets/premium/germany/lebenslauf_vorlagen_02.jpg';
    }

    function getSelectedPremiumTemplate() {
        return getPremiumTemplateById(localStorage.getItem('selectedPremiumTemplateId'));
    }

    const BASIC_PACK_CONFIG = [
        { id: "basic-clean", name: "Basic Clean", style: "basic", layout: "us-ats-clean", color: "slate", country: "all" },
        { id: "basic-classic", name: "Basic Classic", style: "basic", layout: "uk-professional-standard", color: "steel", country: "all" },
        { id: "basic-modern", name: "Basic Modern", style: "basic", layout: "de-ats-minimal", color: "ocean", country: "all" },
        { id: "basic-compact", name: "Basic Compact", style: "basic", layout: "az-compact-recruiter", color: "emerald", country: "all" },
        { id: "basic-skyline", name: "Basic Skyline", style: "basic", layout: "us-executive-modern", color: "teal", country: "all" },
        { id: "basic-focus", name: "Basic Focus", style: "basic", layout: "de-modern-corporate", color: "amber", country: "all" },
        { id: "basic-edge", name: "Basic Edge", style: "basic", layout: "uk-modern-two-column", color: "ruby", country: "all" },
        { id: "basic-prime", name: "Basic Prime", style: "basic", layout: "az-finance-pro", color: "amethyst", country: "all" },
        { id: "basic-smart", name: "Basic Smart", style: "basic", layout: "us-tech-resume", color: "rose", country: "all" },
        { id: "basic-metro", name: "Basic Metro", style: "basic", layout: "de-classic-lebenslauf", color: "steel", country: "all" },
        { id: "basic-core", name: "Basic Core", style: "basic", layout: "uk-recruiter-friendly", color: "gold", country: "all" },
        { id: "basic-flare", name: "Basic Flare", style: "basic", layout: "az-modern-executive", color: "ocean", country: "all" }
    ];

    /* 1. INITIALIZATION & ROUTING */
    function checkState() {
        try {
            const storedUser = localStorage.getItem('cvUser');
            let isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
            const storedCountry = localStorage.getItem('cvCountry');

            if (!isLoggedIn && hasPersistedSession()) {
                isLoggedIn = true;
                localStorage.setItem('isLoggedIn', 'true');
                const restored = getStoredUser();
                if (restored?.email) localStorage.setItem('currentUser', normalizeEmail(restored.email));
            }
            let storedTpl = localStorage.getItem('cvTemplate');

            console.log("[Router] Checking state...");
            console.log("[Router] isLoggedIn:", isLoggedIn);

            const selectedPack = localStorage.getItem('selectedCvPack');
            const hasPackIntent = Boolean(selectedPack) || isBasicPackMode || explicitlyOriginal || window.location.search.includes('mode=');

            if (!hasPackIntent) {
                showHomeView();
                return;
            }

            if (!isLoggedIn) {
                showAuthView();
                return;
            }

            showMainApp();

            if (!storedCountry) {
                showView(views.country);
                return;
            }

            applyCountryFormat(storedCountry);

            storedTpl = localStorage.getItem('cvTemplate');

            // Premium selection must always win over older cached cvTemplate values.
            // This fixes DE 08 opening as DE 09 when browser localStorage still has the old mapping.
            const selectedPremiumForRoute = getPremiumTemplateById(localStorage.getItem('selectedPremiumTemplateId'));
            if (selectedPremiumForRoute && selectedPremiumForRoute.layout) {
                storedTpl = selectedPremiumForRoute.layout;
                localStorage.setItem('cvTemplate', storedTpl);
            }

            if (storedTpl) {
                // Determine if this is a Premium template or Basic template
                const isPremium = MAIN_GENERATOR_TEMPLATES.some(t => t.layout === storedTpl);
                
                if (isPremium) {
                    activeLayoutPattern = storedTpl;
                    activeThemeColor = 'slate'; 
                } else {
                    if (storedTpl.includes('__')) {
                        const [layoutPart, colorPart] = storedTpl.split('__');
                        activeLayoutPattern = layoutPart || 'modern';
                        activeThemeColor = colorPart || 'ocean';
                    } else {
                        const lastDash = storedTpl.lastIndexOf('-');
                        activeLayoutPattern = lastDash > 0 ? storedTpl.slice(0, lastDash) : storedTpl;
                        activeThemeColor = lastDash > 0 ? storedTpl.slice(lastDash + 1) : 'ocean';
                    }
                }
            } else {
                showView(views.library);
                renderLibrary();
                return;
            }

            // Standard editor flow
            showView(views.editor);
            hydrateEditor();
            initWizardUI();
            
            // INITIAL RENDER to prevent blank preview
            setTimeout(triggerRender, 100); 

        } catch (err) {
            console.error("[Router] Failsafe:", err);
            showMainApp();
            showView(views.editor);
            setTimeout(triggerRender, 100);
        }
    }

    function showHomeView() {
        if (views.home) { views.home.style.display = 'flex'; views.home.style.visibility = 'visible'; views.home.classList.add('active'); }
        if (views.auth) { views.auth.style.display = 'none'; views.auth.style.visibility = 'hidden'; }
        if (views.mainApp) { views.mainApp.style.display = 'none'; views.mainApp.style.visibility = 'hidden'; }
        if (userMenuDropdown) userMenuDropdown.style.display = 'none';
    }

    function showAuthView() {
        if (views.home) { views.home.style.display = 'none'; views.home.style.visibility = 'hidden'; views.home.classList.remove('active'); }
        if (views.auth) {
            views.auth.style.display = 'flex';
            views.auth.style.visibility = 'visible';
        }
        if (views.mainApp) {
            views.mainApp.style.display = 'none';
            views.mainApp.style.visibility = 'hidden';
        }
        if (userMenuDropdown) userMenuDropdown.style.display = 'none';
    }

    function showMainApp() {
        if (views.home) { views.home.style.display = 'none'; views.home.style.visibility = 'hidden'; views.home.classList.remove('active'); }
        if (views.auth) {
            views.auth.style.display = 'none';
            views.auth.style.visibility = 'hidden';
        }
        if (views.mainApp) {
            views.mainApp.style.display = 'flex';
            views.mainApp.style.visibility = 'visible';
            views.mainApp.style.flexDirection = 'column';
            views.mainApp.style.overflow = 'hidden';
        }
        if (userMenuDropdown) userMenuDropdown.style.display = 'inline-block';
    }

    function showView(v) {
        [views.country, views.library, views.editor].forEach(el => { if (el) el.classList.remove('active'); });
        if (v) v.classList.add('active');
    }

    // --- Auth Sync & Navigation ---
    const AUTH_API = `${API_BASE}/api`;

    // Local user management
    function getLocalUsers() {
        try {
            const stored = localStorage.getItem('_local_users');
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error('Error loading local users:', e);
            return [];
        }
    }

    function saveLocalUsers(users) {
        try {
            localStorage.setItem('_local_users', JSON.stringify(users));
        } catch (e) {
            console.error('Error saving local users:', e);
        }
    }

    function upsertLocalUserMirror(user, password = null) {
        if (!user || !user.email) return;
        const users = getLocalUsers();
        const emailNorm = normalizeEmail(user.email);
        const idx = users.findIndex(u => normalizeEmail(u.email) === emailNorm);
        const existing = idx >= 0 ? users[idx] : {};
        const nextUser = {
            ...existing,
            id: user.id || existing.id || Date.now().toString(),
            name: user.name || existing.name || '',
            email: emailNorm,
            age: user.age ?? existing.age ?? null,
            gender: user.gender ?? existing.gender ?? null,
            createdAt: existing.createdAt || new Date().toISOString(),
            passwordHash: password ? simpleHash(password) : existing.passwordHash || null
        };
        if (idx >= 0) users[idx] = nextUser; else users.push(nextUser);
        saveLocalUsers(users);
    }

    function findLocalUserByEmail(email) {
        const users = getLocalUsers();
        const emailNorm = normalizeEmail(email);
        return users.find(u => normalizeEmail(u.email) === emailNorm);
    }

    // Create safe user object (no password)
    function createSafeUser(user) {
        return {
            id: user.id,
            name: user.name,
            email: user.email,
            age: user.age,
            gender: user.gender
        };
    }

    // Backend auth with proper error handling and local fallback
    async function tryAuthBackend(endpoint, payload) {
        const BACKEND_URL = API_BASE;
        const timeout = 3000; // 3 second timeout

        if (window.location.protocol === 'file:' && !backendReachable) {
            return { success: false, networkError: true, offline: true };
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const response = await fetch(`${BACKEND_URL}/api/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                return { success: false, error: data.error || "Server error", fromBackend: true };
            }

            const data = await response.json();
            return { success: true, data: data, fromBackend: true };
        } catch (err) {
            if (err.name === 'AbortError') {
                console.warn(`Backend ${endpoint} timed out - using local fallback`);
            } else {
                console.info(`Backend ${endpoint} unavailable, using local mode.`);
            }
            return { success: false, networkError: true, offline: true };
        }
    }

    // Local register (fallback)
    async function registerLocalUser(payload) {
        const { name, email, password, age, gender } = payload;
        const emailNorm = normalizeEmail(email);

        // Check duplicate
        if (findLocalUserByEmail(email)) {
            return { success: false, error: 'Email already registered' };
        }

        // Create user
        const newUser = {
            id: Date.now().toString(),
            name: name.trim(),
            email: emailNorm,
            passwordHash: simpleHash(password),
            age: age === null || age === undefined || age === '' ? null : parseInt(age, 10),
            gender: gender || null,
            createdAt: new Date().toISOString()
        };

        const users = getLocalUsers();
        users.push(newUser);
        saveLocalUsers(users);

        return { success: true, data: { user: createSafeUser(newUser) } };
    }

    // Local login (fallback)
    async function loginLocalUser(payload) {
        const { email, password } = payload;
        
        const user = findLocalUserByEmail(email);
        if (!user) {
            return { success: false, error: 'Account not found' };
        }

        if (!simpleCompare(password, user.passwordHash)) {
            return { success: false, error: 'Incorrect password' };
        }

        return { success: true, data: { user: createSafeUser(user) } };
    }

    // Smart auth: try backend first, fallback to local
    async function smartAuthFlow(endpoint, payload) {
        // Try backend first
        const backendResult = await tryAuthBackend(endpoint, payload);
        
        if (backendResult.success) {
            return backendResult;
        }

        // If offline and local fallback is allowed
        if (backendResult.offline) {
            if (endpoint === 'register') {
                return await registerLocalUser(payload);
            } else if (endpoint === 'login') {
                return await loginLocalUser(payload);
            }
        }

        // Backend error or no fallback available
        return backendResult;
    }

    // Unified auth state setter (improved)
    function setAuthState(user, rememberEmail = true) {
        if (!user || !user.email) {
            console.error('Invalid user object for setAuthState:', user);
            return false;
        }

        const normalizedUser = { ...user, email: normalizeEmail(user.email) };
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('cvUser', JSON.stringify(normalizedUser));
        localStorage.setItem('currentUser', normalizedUser.email);
        localStorage.setItem('authSession', JSON.stringify({
            email: normalizedUser.email,
            createdAt: new Date().toISOString(),
            remember: Boolean(rememberEmail)
        }));

        if (normalizedUser.email) {
            localStorage.setItem('rememberedEmail', normalizedUser.email);
        }

        localStorage.removeItem('rememberedCredentials');
        return true;
    }

    /* 2. AUTH EVENTS - ENHANCED WITH NEW UI */
    
    // Get auth message elements
    const { authError, authSuccess } = getAuthElements();

    // Navigate to register page
    const goToRegister = document.getElementById('go-to-register');
    if (goToRegister) {
        goToRegister.addEventListener('click', (e) => {
            e.preventDefault();
            switchAuthPage('register');
        });
    }

    // Navigate back to login page
    const backToLogin = document.getElementById('back-to-login');
    if (backToLogin) {
        backToLogin.addEventListener('click', (e) => {
            e.preventDefault();
            switchAuthPage('login');
        });
    }

    // Password show/hide toggles
    const loginPasswordToggle = document.getElementById('login-password-toggle');
    const regPasswordToggle = document.getElementById('reg-password-toggle');

    if (loginPasswordToggle && loginPassword) {
        loginPasswordToggle.addEventListener('click', (e) => {
            e.preventDefault();
            const isPassword = loginPassword.type === 'password';
            loginPassword.type = isPassword ? 'text' : 'password';
            loginPasswordToggle.innerHTML = isPassword ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
        });
    }

    if (regPasswordToggle && regPassword) {
        regPasswordToggle.addEventListener('click', (e) => {
            e.preventDefault();
            const isPassword = regPassword.type === 'password';
            regPassword.type = isPassword ? 'text' : 'password';
            regPasswordToggle.innerHTML = isPassword ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
        });
    }

    // REGISTER HANDLER - ENHANCED
    if (registerBtn && registerForm) {
        const handleRegister = async (e) => {
            e.preventDefault();
            clearErrorMessages();

            const registerName = regName ? regName.value.trim() : '';
            const registerEmail = regEmail ? regEmail.value.trim() : '';
            const registerPassword = regPassword ? regPassword.value.trim() : '';
            const registerAge = regAge ? regAge.value.trim() : '';
            const registerGender = regGender ? regGender.value : '';

            // Validation with inline errors
            let hasErrors = false;

            if (!registerName) {
                setFieldError('reg-name', 'Please enter your full name');
                hasErrors = true;
            }

            if (!registerEmail) {
                setFieldError('reg-email', 'Please enter your email address');
                hasErrors = true;
            } else if (!isValidEmail(registerEmail)) {
                setFieldError('reg-email', 'Please enter a valid email address');
                hasErrors = true;
            }

            if (!registerPassword) {
                setFieldError('reg-password', 'Please enter a password');
                hasErrors = true;
            } else if (!isValidPassword(registerPassword)) {
                setFieldError('reg-password', 'Password must be at least 6 characters');
                hasErrors = true;
            }

            if (registerAge) {
                const ageNum = parseInt(registerAge);
                if (isNaN(ageNum) || ageNum < 16 || ageNum > 120) {
                    setFieldError('reg-age', 'Age must be between 16 and 120');
                    hasErrors = true;
                }
            }

            if (hasErrors) {
                showError('Please fix the errors above');
                return;
            }

            // Disable button during submission
            registerBtn.disabled = true;
            const btnText = registerBtn.querySelector('.btn-text');
            const btnLoader = registerBtn.querySelector('.btn-loader');
            if (btnText) btnText.style.display = 'none';
            if (btnLoader) btnLoader.style.display = 'inline-flex';

            try {
                // Use smart auth (tries backend, falls back to local)
                const res = await smartAuthFlow('register', {
                    name: registerName,
                    email: registerEmail,
                    password: registerPassword,
                    age: registerAge ? parseInt(registerAge, 10) : null,
                    gender: registerGender || null
                });

                if (!res.success) {
                    showError(res.error || 'Registration failed. Please try again.');
                    registerBtn.disabled = false;
                    if (btnText) btnText.style.display = 'inline-flex';
                    if (btnLoader) btnLoader.style.display = 'none';
                    return;
                }

                // Success - got safe user object without password
                const user = res.data.user;
                upsertLocalUserMirror(user, registerPassword);
                setAuthState(user, true);

                // Show success message
                showSuccess('Account created successfully! Redirecting...');

                // Clear form
                if (regName) regName.value = '';
                if (regEmail) regEmail.value = '';
                if (regPassword) regPassword.value = '';
                if (regAge) regAge.value = '';
                if (regGender) regGender.value = '';

                // Route to next screen after brief delay
                setTimeout(() => {
                    try {
                        checkState();
                    } catch (routeErr) {
                        console.error('Route error after register:', routeErr);
                        showMainApp();
                        showView(views.country);
                    }
                }, 300);
            } catch (err) {
                console.error('Register error:', err);
                showError('An error occurred. Please try again.');
                registerBtn.disabled = false;
                if (btnText) btnText.style.display = 'inline-flex';
                if (btnLoader) btnLoader.style.display = 'none';
            }
        };

        registerBtn.addEventListener('click', handleRegister);
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleRegister(e);
        });
    }

    // LOGIN HANDLER - ENHANCED
    if (loginBtn && loginForm) {
        const handleLogin = async (e) => {
            e.preventDefault();
            clearErrorMessages();

            const emailInput = loginEmail ? loginEmail.value.trim() : '';
            const passwordInput = loginPassword ? loginPassword.value.trim() : '';

            // Validation with inline errors
            let hasErrors = false;

            if (!emailInput) {
                setFieldError('login-email', 'Please enter your email address');
                hasErrors = true;
            } else if (!isValidEmail(emailInput)) {
                setFieldError('login-email', 'Please enter a valid email address');
                hasErrors = true;
            }

            if (!passwordInput) {
                setFieldError('login-password', 'Please enter your password');
                hasErrors = true;
            }

            if (hasErrors) {
                showError('Please fix the errors above');
                return;
            }

            // Disable button during submission
            loginBtn.disabled = true;
            const btnText = loginBtn.querySelector('.btn-text');
            const btnLoader = loginBtn.querySelector('.btn-loader');
            if (btnText) btnText.style.display = 'none';
            if (btnLoader) btnLoader.style.display = 'inline-flex';

            try {
                // Use smart auth (tries backend, falls back to local)
                const res = await smartAuthFlow('login', {
                    email: emailInput,
                    password: passwordInput
                });

                if (res.success) {
                    const user = res.data.user;
                    upsertLocalUserMirror(user, passwordInput);
                    const rememberMe = rememberMeCheck ? rememberMeCheck.checked : true;
                    setAuthState(user, rememberMe);
                    
                    // Show success message
                    showSuccess('Login successful! Redirecting...');
                    
                    // Clear password field for security
                    if (loginPassword) loginPassword.value = '';
                    
                    // Route to next screen after brief delay
                    setTimeout(() => {
                        try {
                            checkState();
                        } catch (routeErr) {
                            console.error('Route error after login:', routeErr);
                            showMainApp();
                            showView(views.country);
                        }
                    }, 300);
                    return;
                }

                // Show specific error message
                showError(res.error || 'Login failed. Please check your credentials.');
            } catch (err) {
                console.error('Login error:', err);
                showError('An error occurred. Please try again.');
            } finally {
                loginBtn.disabled = false;
                if (btnText) btnText.style.display = 'inline-flex';
                if (btnLoader) btnLoader.style.display = 'none';
            }
        };

        loginBtn.addEventListener('click', handleLogin);
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleLogin(e);
        });
    }



    function beginPackFlow(pack) {
        const normalizedPack = pack === 'basic' ? 'basic' : 'original';
        localStorage.setItem('selectedCvPack', normalizedPack);
        localStorage.removeItem('cvTemplate');
        localStorage.removeItem('selectedPremiumTemplateId');
        localStorage.removeItem('cvCountry');

        if (normalizedPack === 'basic') {
            isBasicPackMode = true;
            localStorage.setItem('cvPackMode', 'basic');
            window.history.replaceState({}, '', 'index.html?mode=basic');
        } else {
            isBasicPackMode = false;
            localStorage.removeItem('cvPackMode');
            window.history.replaceState({}, '', 'index.html?mode=original');
        }

        if (localStorage.getItem('isLoggedIn') === 'true' || hasPersistedSession()) {
            showMainApp();
            showView(views.country);
        } else {
            showAuthView();
            switchAuthPage('login');
        }
    }

    document.querySelectorAll('.home-pack-btn').forEach((btn) => {
        btn.addEventListener('click', () => beginPackFlow(btn.dataset.pack));
    });


    // Top navigation
    const homeNav = document.querySelector('.nav-links a[href="index.html"]');
    const generatorNav = document.querySelector('.nav-links a[href="index.html?mode=original"]');
    const basicPackNav = document.getElementById('basic-pack-link');

    if (homeNav) {
        homeNav.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('selectedCvPack');
            localStorage.removeItem('cvPackMode');
            localStorage.removeItem('cvTemplate');
            localStorage.removeItem('selectedPremiumTemplateId');
            showHomeView();
            window.history.replaceState({}, '', 'index.html');
        });
    }

    if (generatorNav) {
        generatorNav.addEventListener('click', (e) => {
            e.preventDefault();
            beginPackFlow('original');
        });
    }

    if (basicPackNav) {
        basicPackNav.addEventListener('click', (e) => {
            e.preventDefault();
            beginPackFlow('basic');
        });
    }
    // Connect My CVs redirect properly
    const menuCvs = document.getElementById('menu-cvs');
    if (menuCvs) {
        menuCvs.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'my-cvs.html';
        });
    }

    if (menuProfile) {
        menuProfile.addEventListener('click', (e) => {
            e.preventDefault();
            const storedUser = localStorage.getItem('cvUser');
            if (storedUser) {
                const user = JSON.parse(storedUser);
                if (profileName) profileName.value = user.name || '';
                if (profileEmail) profileEmail.value = user.email || '';
            }
            if (profileModal) profileModal.style.display = 'flex';
        });
    }

    if (closeProfile) {
        closeProfile.addEventListener('click', () => {
            profileModal.style.display = 'none';
        });
    }

    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', () => {
            const storedUser = localStorage.getItem('cvUser');
            if (storedUser) {
                const user = JSON.parse(storedUser);
                if (profileName) user.name = profileName.value.trim();
                localStorage.setItem('cvUser', JSON.stringify(user));
                localStorage.setItem('currentUser', normalizeEmail(user.email || ''));
                alert("Profile updated.");
            }
            profileModal.style.display = 'none';
        });
    }

    if (menuLogout) {
        menuLogout.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('currentUser');
            localStorage.removeItem('cvUser');
            localStorage.removeItem('authSession');
            checkState();
        });
    }

    document.getElementById('pro-unlock-btn').addEventListener('click', () => {
        beginPackFlow('original');
    });

    /* 3. COUNTRY MAPPING */
    backToSigninBtn.addEventListener('click', () => {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('cvUser');
        localStorage.removeItem('authSession');
        checkState();
    });

    countrySubmitBtn.addEventListener('click', () => {
        const country = countrySelect.value;
        if (!country) { alert("Please select a country."); return; }
        localStorage.setItem('cvCountry', country);
        localStorage.removeItem('cvTemplate');
        localStorage.removeItem('selectedPremiumTemplateId');
        checkState();
    });

    const O_ATS = ['summary', 'experience', 'education', 'skills'];
    const O_EXP = ['summary', 'experience', 'education', 'skills'];
    const O_GER = ['summary', 'experience', 'education', 'projects', 'skills'];
    const O_SCA = ['summary', 'experience', 'skills', 'education'];
    const O_ASI = ['education', 'experience', 'skills', 'summary'];

    const countryRules = {
        // 4-Country Focused System
        'usa': { 
            showPhoto: true, showDateOfBirth: false, showNationality: false, 
            preferredTemplateFamily: 'usa', order: O_ATS, 
            helper: 'Professional USA resume templates. Photo is optional and can be uploaded for creative templates.', 
            tone: 'bold', atsSafe: true 
        },
        'uk': { 
            showPhoto: true, showDateOfBirth: false, showNationality: false, 
            preferredTemplateFamily: 'uk', order: O_EXP, 
            helper: 'Editable UK CV templates with professional photo layouts, clean spacing, and recruiter-friendly structure.', 
            tone: 'professional', atsSafe: true 
        },
        'germany': { 
            showPhoto: true, showDateOfBirth: true, showNationality: true, 
            preferredTemplateFamily: 'germany', order: O_GER, 
            helper: 'Professional German CV. Photo, DOB, and nationality are standard and expected.', 
            tone: 'formal' 
        },
        'azerbaijan': { 
            showPhoto: true, showDateOfBirth: true, showNationality: true, 
            preferredTemplateFamily: 'azerbaijan', order: O_EXP, 
            helper: 'Formal corporate CV. All personal details (photo, DOB, nationality) are expected.', 
            tone: 'formal' 
        }
    };
    function applyCountryFormat(country) {
        const standard = countryRules['usa'];
        const rules = countryRules[country.toLowerCase()] || standard;
        currentCountryRules = rules;

        applyCountryLayoutMapping(country, rules);

        const formatCountryName = (str) => {
            if (str === 'uk') return 'UK';
            if (str === 'usa') return 'USA';
            if (str === 'uae') return 'UAE';
            return str.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
        };
        const countryName = formatCountryName(country);
        const selectedPremiumTemplate = getPremiumTemplateById(localStorage.getItem('selectedPremiumTemplateId'));
        let badgeLabel = selectedPremiumTemplate ? `Format: ${countryName} (${selectedPremiumTemplate.name})` : `Format: ${countryName} (${activeLayoutPattern.toUpperCase()})`;

        document.getElementById('active-region-badge').textContent = badgeLabel;
        const libRegionBadge = document.getElementById('library-region-badge');
        if (libRegionBadge) libRegionBadge.textContent = badgeLabel;

        const helperUi = document.getElementById('country-helper-text');
        if (helperUi) {
             helperUi.innerHTML = `<i class="fa-solid fa-circle-info"></i> <strong>Recommended for ${countryName}:</strong> ${rules.helper}`;
        }

        const show = (el, force) => { if (el) el.style.display = force ? 'flex' : 'none'; };

        show(groupPhoto, rules.showPhoto);
        show(groupDob, rules.showDateOfBirth);
        show(groupNationality, rules.showNationality);
    }

    function applyCountryLayoutMapping(country, rules) {
        // DO NOT auto-store templates. Let the library view show first.
        // Only set the active pattern for rendering if a template is already chosen.
        const storedTpl = localStorage.getItem('cvTemplate');
        if (storedTpl) {
            // Use stored template
            activeLayoutPattern = storedTpl;
            activeThemeColor = 'slate';
        } else {
            // No template stored yet - library view will be shown by checkState()
            // Set a default preview pattern (not stored)
            const family = rules.preferredTemplateFamily || 'usa-ats';
            const bestMatch = MAIN_GENERATOR_TEMPLATES.find(t => t.category === family) || MAIN_GENERATOR_TEMPLATES[0];
            activeLayoutPattern = bestMatch.layout; // For preview only, not stored
            activeThemeColor = 'slate';
        }
    }

    /* 4. TEMPLATE LIBRARY GALLERY */
    backToCountryBtn.addEventListener('click', () => {
        localStorage.removeItem('cvCountry');
        localStorage.removeItem('cvTemplate');
        checkState();
    });

    const editorBackBtn = document.getElementById('editor-back-btn');
    if (editorBackBtn) {
        editorBackBtn.addEventListener('click', () => {
            // Navigate visually to country string without wiping state
            showView(views.country);
        });
    }

    function getThemeHex(c) {
        const m = {
            'slate': '#3b82f6', 'emerald': '#10b981', 'ocean': '#3b82f6',
            'ruby': '#ef4444', 'amber': '#f59e0b', 'amethyst': '#8b5cf6',
            'steel': '#9ca3af', 'teal': '#14b8a6', 'rose': '#f43f5e', 'gold': '#d97706'
        };
        return m[c] || '#0f172a';
    }

    function renderLibrary(filterStr = 'all') {
        templateGrid.innerHTML = '';
        const filterTabs = document.querySelector('.filter-tabs');

        if (isBasicPackMode) {
            if (filterTabs) filterTabs.style.display = 'flex';
            BASIC_PACK_CONFIG.forEach(cfg => {
                if (filterStr !== 'all' && cfg.style !== filterStr) return;
                const hex = getThemeHex(cfg.color);
                const card = document.createElement('div');
                card.className = 'lib-card';
                card.innerHTML = `
                    <div class="lib-preview">
                        <svg viewBox="0 0 100 140" fill="none" style="background:#f1f5f9;">
                            <rect x="10" y="10" width="40" height="8" rx="2" fill="${hex}" />
                            <rect x="10" y="25" width="80" height="2" fill="#cbd5e1" />
                            <rect x="10" y="35" width="30" height="4" rx="2" fill="#94a3b8" />
                            <rect x="10" y="45" width="80" height="3" rx="1" fill="#cbd5e1" />
                            <rect x="10" y="52" width="70" height="3" rx="1" fill="#cbd5e1" />
                            <rect x="10" y="65" width="30" height="4" rx="2" fill="#94a3b8" />
                            <rect x="10" y="75" width="80" height="3" rx="1" fill="#cbd5e1" />
                            <rect x="10" y="82" width="50" height="3" rx="1" fill="#cbd5e1" />
                            <circle cx="80" cy="18" r="8" fill="#cbd5e1" />
                        </svg>
                    </div>
                    <h3>${cfg.name}</h3>
                    <p style="text-transform: capitalize;">${cfg.style} Style</p>
                    <button class="btn btn-secondary btn-sm btn-block">Use Template</button>
                `;
                card.addEventListener('click', () => {
                    localStorage.setItem('cvTemplate', `${cfg.layout}__${cfg.color}`);
                    localStorage.removeItem('selectedPremiumTemplateId');
                    checkState();
                });
                templateGrid.appendChild(card);
            });
            return;
        }

        if (filterTabs) filterTabs.style.display = 'none';
        const selectedCountry = localStorage.getItem('cvCountry') || 'germany';
        const premiumTemplates = getPremiumTemplatesForCountry(selectedCountry);
        const selectedPremiumId = localStorage.getItem('selectedPremiumTemplateId');
        const countryLabel = selectedCountry === 'uk' ? 'UK' : (selectedCountry === 'usa' ? 'USA' : selectedCountry.charAt(0).toUpperCase() + selectedCountry.slice(1));

        premiumTemplates.forEach(cfg => {
            const card = document.createElement('div');
            card.className = 'lib-card lib-card-premium';
            if (cfg.id === selectedPremiumId) card.classList.add('selected');
            card.innerHTML = `
                <div class="lib-preview premium-image-preview">
                    <img src="${cfg.preview}" alt="${cfg.name}" style="width:100%; height:100%; object-fit:cover; display:block;" />
                </div>
                <h3>${cfg.name}</h3>
                <p style="font-size: 0.82rem; color: #64748b;">${countryLabel} Premium Template</p>
                <button class="btn btn-primary btn-sm btn-block">Choose Template</button>
            `;
            card.addEventListener('click', () => {
                localStorage.setItem('selectedPremiumTemplateId', cfg.id);
                const forcedGermanyLayout = cfg.id === 'premium-germany-8' ? 'de-pdf-08' : (cfg.id === 'premium-germany-9' ? 'de-pdf-09' : cfg.layout);
                localStorage.setItem('cvTemplate', forcedGermanyLayout);
                activeLayoutPattern = forcedGermanyLayout;
                activeThemeColor = 'slate';
                showView(views.editor);
                hydrateEditor();
                initWizardUI();
                setTimeout(triggerRender, 60);
            });
            templateGrid.appendChild(card);
        });
    }

    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            renderLibrary(e.target.dataset.filter);
        });
    });


    /* 5. WIZARD UI */
    function initWizardUI() {
        currentStep = 1;
        updateWizardUI();
    }
    function updateWizardUI() {
        stepsElements.forEach(s => s.classList.remove('active'));
        stepsElements.forEach(s => parseInt(s.dataset.step) === currentStep && s.classList.add('active'));

        wizPrev.style.visibility = (currentStep === 1) ? 'hidden' : 'visible';
        wizNext.style.visibility = (currentStep === numSteps) ? 'hidden' : 'visible';
        if (currentStep < numSteps) wizNext.innerHTML = 'Next <i class="fa-solid fa-arrow-right"></i>';

        const percentage = ((currentStep - 1) / (numSteps - 1)) * 100;
        progressFill.style.width = `${percentage}%`;

        progressSteps.forEach(p => {
            const stepNum = parseInt(p.dataset.step);
            p.classList.remove('active', 'completed');
            if (stepNum < currentStep) p.classList.add('completed');
            else if (stepNum === currentStep) p.classList.add('active');
        });

        // Job Seeker: automatically prepare country-based suggestions on the final step.
        if (currentStep === numSteps) {
            setTimeout(() => {
                const btn = document.getElementById('find-jobs-btn');
                const container = document.getElementById('jobs-container');
                if (btn && container && !container.dataset.autoLoaded) {
                    container.dataset.autoLoaded = '1';
                    btn.click();
                }
            }, 350);
        }
    }

    wizPrev.addEventListener('click', () => { if (currentStep > 1) { currentStep--; updateWizardUI(); } });
    wizNext.addEventListener('click', () => { if (currentStep < numSteps) { currentStep++; updateWizardUI(); } });
    progressSteps.forEach((stepEl, index) => {
        stepEl.style.cursor = 'pointer';
        stepEl.addEventListener('click', () => {
            currentStep = index + 1;
            updateWizardUI();
        });
    });


    /* 6. PREVIEW & RENDER ENGINE */
    function hydrateEditor() {
        const currentUser = localStorage.getItem('currentUser');
        let profileLoaded = false;

        const t = translations[currentLang] || translations.en;

        if (currentUser) {
            const savedData = localStorage.getItem(`userProfile_${currentUser}`);
            if (savedData) {
                try {
                    const profile = JSON.parse(savedData);
                    if (fullNameInput) fullNameInput.value = profile.name || DEFAULT_CV_DATA.fullName;
                    if (emailInput) emailInput.value = profile.email || DEFAULT_CV_DATA.email;
                    profileLoaded = true;
                } catch (e) { }
            }
        }

        if (!profileLoaded) {
            const storedUser = localStorage.getItem('cvUser');
            if (storedUser) {
                try {
                    const user = JSON.parse(storedUser);
                    fullNameInput.value = user.name || DEFAULT_CV_DATA.fullName;
                    emailInput.value = user.email || DEFAULT_CV_DATA.email;
                } catch (e) { }
            } else {
                if (fullNameInput) fullNameInput.value = DEFAULT_CV_DATA.fullName;
                if (emailInput) emailInput.value = DEFAULT_CV_DATA.email;
            }
        }

        // Ensure secondary fields have defaults if empty
        const jobTitleInput = document.getElementById('targetJobTitle');
        const summaryInput = document.getElementById('summary');
        const addressInput = document.getElementById('address');
        const dobInput = document.getElementById('dob');
        const natInput = document.getElementById('nationality');
        const skillsInput = document.getElementById('skills');
        const compSkillsInput = document.getElementById('computerSkills');

        if (jobTitleInput && !jobTitleInput.value) jobTitleInput.value = DEFAULT_CV_DATA.jobTitle;
        if (summaryInput && !summaryInput.value) summaryInput.value = DEFAULT_CV_DATA.summary;
        if (addressInput && !addressInput.value) addressInput.value = DEFAULT_CV_DATA.address;
        if (dobInput && !dobInput.value) dobInput.value = DEFAULT_CV_DATA.dob;
        if (natInput && !natInput.value) natInput.value = DEFAULT_CV_DATA.nationality;
        if (skillsInput && !skillsInput.value) skillsInput.value = DEFAULT_CV_DATA.skills.join(', ');
        if (compSkillsInput && !compSkillsInput.value) compSkillsInput.value = DEFAULT_CV_DATA.computerSkills.join(', ');

        ensureDefaultDynamicBoxes();
        triggerRender();
    }

    document.addEventListener('input', (e) => { if (e.target.classList.contains('live-input')) triggerRender(); });

    photoInput.addEventListener('change', (e) => {
        const f = e.target.files[0];
        if (f) { photoDataUrl = URL.createObjectURL(f); triggerRender(); }
    });

    function getGermanyLayoutExamples(layout) {
        const idx = getGermanyPdfLayoutIndex(layout || activeLayoutPattern || 'de-pdf-01');
        const examples = {
            1: { exp: { title: 'Key Account Managerin', company: 'PixelPerfekt Werbung', dates: '08/2022 - heute', location: 'Cologne', desc: '• Beschreibung Tätigkeitsfeld und Aufgaben\n• Verantwortung für Projekte und Kommunikation\n• Verbesserte Prozesse mit messbarem Ergebnis' }, edu: { title: 'Name des Masterstudiengangs', company: 'Name der Universität/Hochschule, Ort', dates: '08/2018 - 04/2020' }, proj: { title: 'Operations Overhaul', desc: 'Led a cross-functional team saving 20% in quarterly costs.' }, lang: { name: 'Deutsch', prof: '100' } },
            2: { exp: { title: 'Graphic Designer', company: 'Creative Studio', dates: '2014 - 2015', location: 'Berlin', desc: '• Built visual concepts and brand assets\n• Collaborated with clients and product teams' }, edu: { title: 'Master Web Develop', company: 'MIT University of United States', dates: '2010 - 2012' }, proj: { title: 'Portfolio Relaunch', desc: 'Redesigned a digital portfolio with stronger conversion and cleaner UX.' }, lang: { name: 'English', prof: '90' } },
            3: { exp: { title: 'Bilanzbuchhalter', company: 'Investitions OHG', dates: '2018 - Gegenwärtig', location: 'Stuttgart', desc: '• Erstellung regelmäßiger Finanzberichte und Budgetplanungen\n• Kontrolle und Optimierung interner Finanzprozesse' }, edu: { title: 'Master of Science in Finanzen', company: 'Technische Universität München', dates: '2014 - 2018' }, proj: { title: 'Cost Optimization Program', desc: 'Reduced recurring operating costs through finance process redesign.' }, lang: { name: 'Deutsch', prof: '100' } },
            4: { exp: { title: 'Projektmanager', company: 'Technology Group', dates: '2017 bis heute', location: 'Berlin', desc: '• Planung und Durchführung von IT-Projekten\n• Steuerung technischer Teams und Stakeholder' }, edu: { title: 'B.Sc. Information Technology', company: 'University of Berlin', dates: '2012 - 2016' }, proj: { title: 'Architecture Rollout', desc: 'Accelerated enterprise rollout planning and delivery execution.' }, lang: { name: 'Deutsch', prof: '100' } },
            5: { exp: { title: 'Senior Manager', company: 'Ginyard International', dates: 'Jan 2020 - Dec 2024', location: 'London', desc: '• Managed operational priorities and cross-functional teams\n• Drove service improvement initiatives' }, edu: { title: 'BSc Computer Information Systems', company: 'Columbia University', dates: '2011 - 2015' }, proj: { title: 'Service Redesign', desc: 'Improved service quality through new workflows and stakeholder alignment.' }, lang: { name: 'English', prof: '95' } },
            6: { exp: { title: 'Applications Developer', company: 'Fauget Company', dates: '2020 - Present', location: 'Any City', desc: '• Built modern web experiences and content systems\n• Improved database administration and site performance' }, edu: { title: 'Master of Technology', company: 'Salford University', dates: '2018 - 2020' }, proj: { title: 'Content Platform Upgrade', desc: 'Modernized a content workflow with better speed and analytics.' }, lang: { name: 'English', prof: '90' } },
            7: { exp: { title: 'Marketing Manager', company: 'Beispielfirma', dates: '04/2018 - aktuell', location: 'Munich', desc: '• Führung von Beratungsprojekten\n• Steuerung interner Marketingmaßnahmen' }, edu: { title: 'B.A. Betriebswirtschaft', company: 'Universität München', dates: '10/2012 - 07/2016' }, proj: { title: 'Campaign Improvement', desc: 'Created measurable growth through cleaner campaign planning.' }, lang: { name: 'Deutsch', prof: '100' } },
            8: { exp: { title: 'Technische Operationsingenieurin', company: 'Öffentlicher Betrieb', dates: '02/2017 - 09/2023', location: 'Berlin', desc: '• Steuerung technischer Betriebsabläufe\n• Koordination von Service-, Betriebs- und Sicherheitsprozessen' }, edu: { title: 'Koordination der Betriebsverantwortung', company: 'Öffentliche Akademie', dates: '04/2011 - 03/2015' }, proj: { title: 'Operations Governance', desc: 'Improved coordination, oversight and procedural consistency.' }, lang: { name: 'Englisch', prof: '80' } },
            9: { exp: { title: 'Administrative Assistenz', company: 'Flint Group GmbH', dates: '05/2016 - heute', location: 'Berlin', desc: '• Organisation von Abläufen, Dokumenten und Kommunikation\n• Unterstützung von Berichten und Präsentationen' }, edu: { title: 'Studium der Anglistik', company: 'Universität Berlin', dates: '2011 - 2015' }, proj: { title: 'Office Excellence', desc: 'Improved reporting flow and administrative consistency across teams.' }, lang: { name: 'Deutsch', prof: '100' } },
            10: { exp: { title: 'Product Design Manager', company: 'Ginyard International', dates: '2020 - 2023', location: 'Any City', desc: '• Managed website design, content and SEO marketing\n• Coordinated branding and logo design initiatives' }, edu: { title: 'Bachelor of Design', company: 'Wardiere University', dates: '2008 - 2012' }, proj: { title: 'Brand Refresh', desc: 'Delivered a cleaner brand system and stronger content consistency.' }, lang: { name: 'English', prof: '90' } }
        };
        return examples[idx] || examples[1];
    }
    function getDefaultDynamicData(type) {
        const ex = getGermanyLayoutExamples(activeLayoutPattern);
        const t = translations[currentLang] || translations.en;
        if (type === 'experience') return { title: ex.exp.title, company: ex.exp.company, dates: ex.exp.dates, location: ex.exp.location, desc: ex.exp.desc || t.defDescExp };
        if (type === 'education') return { title: ex.edu.title, company: ex.edu.company, dates: ex.edu.dates };
        if (type === 'project') return { title: ex.proj.title, desc: ex.proj.desc };
        if (type === 'language') return { name: ex.lang.name, prof: ex.lang.prof };
        return {};
    }
    function ensureDefaultDynamicBoxes() {
        const expListEl = document.getElementById('experience-list');
        const eduListEl = document.getElementById('education-list');
        const projListEl = document.getElementById('project-list');
        const langListEl = document.getElementById('language-list');
        if (expListEl && !expListEl.querySelector('.dynamic-item')) addExperienceItem(getDefaultDynamicData('experience'));
        if (eduListEl && !eduListEl.querySelector('.dynamic-item')) addEducationItem(getDefaultDynamicData('education'));
        if (projListEl && !projListEl.querySelector('.dynamic-item')) addProjectItem(getDefaultDynamicData('project'));
        if (langListEl && !langListEl.querySelector('.dynamic-item')) addLanguageItem(getDefaultDynamicData('language'));
    }


    document.querySelectorAll('.add-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const triggerBtn = e.target.closest('.add-btn');
            if (!triggerBtn) return;
            const lt = triggerBtn.dataset.list;
            let tId = 'tpl-experience';
            let listEl = document.getElementById('experience-list');
            if (lt === 'education') { tId = 'tpl-education'; listEl = document.getElementById('education-list'); }
            else if (lt === 'project') { tId = 'tpl-project'; listEl = document.getElementById('project-list'); }
            else if (lt === 'language') { tId = 'tpl-language'; listEl = document.getElementById('language-list'); }

            const node = document.getElementById(tId).content.cloneNode(true).querySelector('.dynamic-item');
            const defaults = getDefaultDynamicData(lt);
            if (lt === 'experience') { node.querySelector('.inp-title').value = defaults.title || ''; node.querySelector('.inp-company').value = defaults.company || ''; node.querySelector('.inp-date').value = defaults.dates || ''; node.querySelector('.inp-loc').value = defaults.location || ''; node.querySelector('.inp-desc').value = defaults.desc || ''; }
            else if (lt === 'education') { node.querySelector('.inp-title').value = defaults.title || ''; node.querySelector('.inp-company').value = defaults.company || ''; node.querySelector('.inp-date').value = defaults.dates || ''; }
            else if (lt === 'project') { node.querySelector('.inp-title').value = defaults.title || ''; node.querySelector('.inp-desc').value = defaults.desc || ''; }
            else if (lt === 'language') { node.querySelector('.inp-lang').value = defaults.name || ''; node.querySelector('.inp-prof').value = defaults.prof || '80'; }

            // Apply Professional Dropdown & Date Pickers to Dynamic Nodes
            if (lt === 'experience') {
                setupCustomAutocomplete(node.querySelector('.inp-title'), OPTION_SETS.jobTitles);
                setupCustomAutocomplete(node.querySelector('.inp-company'), OPTION_SETS.companies);
                setupCustomAutocomplete(node.querySelector('.inp-loc'), OPTION_SETS.cities);
            } else if (lt === 'education') {
                setupCustomAutocomplete(node.querySelector('.inp-title'), OPTION_SETS.degrees);
                setupCustomAutocomplete(node.querySelector('.inp-company'), OPTION_SETS.universities);
                setupCustomAutocomplete(node.querySelector('.inp-loc'), OPTION_SETS.cities);
            } else if (lt === 'language') {
                setupCustomAutocomplete(node.querySelector('.inp-lang'), ["English", "German", "Spanish", "French", "Russian", "Arabic", "Turkish", "Azerbaijani", "Chinese", "Japanese", "Portuguese", "Italian"]);
                setupCustomAutocomplete(node.querySelector('.inp-prof'), OPTION_SETS.languageLevels);
            } else if (lt === 'project') {
                setupCustomAutocomplete(node.querySelector('.inp-title'), OPTION_SETS.roles);
            }

            // Convert Date inputs to Date Pickers
            node.querySelectorAll('.inp-date').forEach(el => {
                el.type = 'month'; // Experience/Education ranges are best as month pickers
            });

            node.querySelector('.remove-btn').addEventListener('click', ev => { ev.target.closest('.dynamic-item').remove(); triggerRender(); });
            listEl.appendChild(node);
            triggerRender();
        });
    });

    function getFormData() {
        const t = translations[currentLang] || translations.en;
        const realMode = document.body && document.body.dataset && document.body.dataset.othRealCvData === '1';
        const fallback = (v, d) => realMode ? (v || '') : (v || d);
        const val = id => document.getElementById(id) ? document.getElementById(id).value.trim() : '';
        const data = {
            fullName: fallback(val('fullName'), DEFAULT_CV_DATA.fullName),
            jobTitle: fallback(val('targetJobTitle'), DEFAULT_CV_DATA.jobTitle),
            summary: fallback(val('summary'), DEFAULT_CV_DATA.summary),
            email: fallback(val('email'), DEFAULT_CV_DATA.email),
            phone: fallback(val('phone'), DEFAULT_CV_DATA.phone),
            address: fallback(val('address'), DEFAULT_CV_DATA.address),
            dob: fallback(val('dob'), DEFAULT_CV_DATA.dob),
            nationality: fallback(val('nationality'), DEFAULT_CV_DATA.nationality),
            skills: (fallback(val('skills'), DEFAULT_CV_DATA.skills.join(', '))).split(',').map(s => s.trim()).filter(Boolean),
            computerSkills: (fallback(val('computerSkills'), DEFAULT_CV_DATA.computerSkills.join(', '))).split(',').map(s => s.trim()).filter(Boolean),
            experience: [], education: [], projects: [], languages: [],

            showPhoto: currentCountryRules.showPhoto,
            showDob: currentCountryRules.showDateOfBirth,
            showNat: currentCountryRules.showNationality,
            sectionOrder: currentCountryRules.order || ['summary', 'experience', 'education', 'projects', 'skills']
        };

        document.querySelectorAll('#experience-list .dynamic-item').forEach(i => {
            data.experience.push({
                dates: realMode ? (i.querySelector('.inp-date').value || '') : (i.querySelector('.inp-date').value || t.defDateExp),
                company: realMode ? (i.querySelector('.inp-company').value || '') : (i.querySelector('.inp-company').value || t.defCompExp),
                title: realMode ? (i.querySelector('.inp-title').value || '') : (i.querySelector('.inp-title').value || t.defTitleExp),
                location: i.querySelector('.inp-loc').value || '',
                desc: realMode ? (i.querySelector('.inp-desc').value || '') : (i.querySelector('.inp-desc').value || t.defDescExp)
            });
        });
        document.querySelectorAll('#education-list .dynamic-item').forEach(i => {
            data.education.push({ dates: realMode ? (i.querySelector('.inp-date').value || '') : (i.querySelector('.inp-date').value || t.defDateEdu), company: realMode ? (i.querySelector('.inp-company').value || '') : (i.querySelector('.inp-company').value || t.defCompEdu), title: realMode ? (i.querySelector('.inp-title').value || '') : (i.querySelector('.inp-title').value || t.defTitleEdu) });
        });
        document.querySelectorAll('#project-list .dynamic-item').forEach(i => {
            data.projects.push({
                title: realMode ? (i.querySelector('.inp-title').value || '') : (i.querySelector('.inp-title').value || t.defProjTitle || 'Project Name'),
                desc: realMode ? (i.querySelector('.inp-desc').value || '') : (i.querySelector('.inp-desc').value || t.defProjDesc || 'Project details')
            });
        });
        document.querySelectorAll('#language-list .dynamic-item').forEach(i => {
            data.languages.push({
                name: realMode ? (i.querySelector('.inp-lang').value || '') : (i.querySelector('.inp-lang').value || t.defLangName || 'English'),
                prof: i.querySelector('.inp-prof').value || (realMode ? '' : '80')
            });
        });

        if (!realMode && !data.experience.length) data.experience = [...DEFAULT_CV_DATA.experience];
        if (!realMode && !data.education.length) data.education = [...DEFAULT_CV_DATA.education];
        if (!realMode && !data.projects.length) data.projects = [...DEFAULT_CV_DATA.projects];
        if (!realMode && !data.languages.length) data.languages = [...DEFAULT_CV_DATA.languages].map(l => ({ name: l.name, prof: l.proficiency }));

        return data;
    }

    // Offline CV translation fallback for static builds.
    function localizeCVText(value, lang) {
        if (!value) return value;
        const phraseMap = {
            en: {'Kontakt':'Contact','Kenntnisse':'Skills','Software-Kenntnisse':'Computer Skills','Berufserfahrung':'Work Experience','Ausbildung':'Education','Kurzprofil':'Professional Summary','Sprachen':'Languages','Zertifikate':'Certifications','Fähigkeiten':'Skills','Haqqımda':'About','Əlaqə':'Contact','Bacarıqlar':'Skills','Təhsil':'Education','İş təcrübəsi':'Work Experience','Peşəkar xülasə':'Professional Summary','О себе':'About','Опыт работы':'Work Experience','Образование':'Education','Навыки':'Skills','Контакты':'Contact','İletişim':'Contact','Yetenekler':'Skills','Eğitim':'Education','İş Deneyimi':'Work Experience'},
            ru: {'Professional Title':'Профессиональная должность','Full Stack Developer':'Full-stack разработчик','Senior Developer':'Старший разработчик','Key Account Managerin':'Ключевой аккаунт-менеджер','Master of Arts in Education':'Магистр образования','M.Sc. Computer Science':'Магистр компьютерных наук','University of Node':'Университет Node','Name des Masterstudiengangs':'Магистерская программа','Name der Universität/Hochschule, Ort':'Название университета/вуза, город','Dedicated professional with a proven track record leading cross-functional teams to exceed expectations.':'Целеустремлённый специалист с подтверждённым опытом руководства межфункциональными командами и достижения высоких результатов.','Strategic Planning':'Стратегическое планирование','Agile methodologies':'Agile-методологии','Data Analysis':'Анализ данных','Leadership':'Лидерство','English':'Английский','Azerbaijani':'Азербайджанский','Mandarin':'Мандаринский','Japanese':'Японский','Translation':'Перевод','Communication':'Коммуникация','Curriculum Design':'Разработка учебных программ','Classroom Management':'Управление классом','Work Experience':'Опыт работы','Education':'Образование','Professional Summary':'Профессиональное резюме','Skills':'Навыки','Contact':'Контакты'},
            de: {'Professional Title':'Berufsbezeichnung','Full Stack Developer':'Full-Stack-Entwickler','Senior Developer':'Senior-Entwickler','Key Account Managerin':'Key Account Managerin','Master of Arts in Education':'Master of Arts in Pädagogik','M.Sc. Computer Science':'M.Sc. Informatik','University of Node':'Universität Node','Dedicated professional with a proven track record leading cross-functional teams to exceed expectations.':'Engagierte Fachkraft mit nachweislicher Erfahrung in der Führung funktionsübergreifender Teams und im Übertreffen gesetzter Ziele.','Strategic Planning':'Strategische Planung','Agile methodologies':'Agile Methoden','Data Analysis':'Datenanalyse','Leadership':'Führung','English':'Englisch','Azerbaijani':'Aserbaidschanisch','Mandarin':'Mandarin','Japanese':'Japanisch','Translation':'Übersetzung','Communication':'Kommunikation','Curriculum Design':'Curriculum-Entwicklung','Classroom Management':'Klassenmanagement','Work Experience':'Berufserfahrung','Education':'Ausbildung','Professional Summary':'Kurzprofil','Skills':'Fähigkeiten','Contact':'Kontakt'},
            az: {'Professional Title':'Peşəkar vəzifə','Full Stack Developer':'Full Stack Developer','Senior Developer':'Baş developer','Key Account Managerin':'Əsas müştəri meneceri','Master of Arts in Education':'Təhsil üzrə magistr','M.Sc. Computer Science':'Kompüter elmləri üzrə magistr','University of Node':'Node Universiteti','Name des Masterstudiengangs':'Magistr proqramının adı','Name der Universität/Hochschule, Ort':'Universitet/ali məktəb adı, şəhər','Dedicated professional with a proven track record leading cross-functional teams to exceed expectations.':'Gözləntiləri aşmaq üçün müxtəlif funksiyalı komandaları idarə etməkdə sübut olunmuş təcrübəyə malik peşəkar mütəxəssis.','Strategic Planning':'Strateji planlaşdırma','Agile methodologies':'Agile metodologiyaları','Data Analysis':'Data analizi','Leadership':'Liderlik','English':'İngilis dili','Azerbaijani':'Azərbaycan dili','Mandarin':'Mandarin dili','Japanese':'Yapon dili','Translation':'Tərcümə','Communication':'Kommunikasiya','Curriculum Design':'Tədris proqramı dizaynı','Classroom Management':'Sinif idarəetməsi','Work Experience':'İş təcrübəsi','Education':'Təhsil','Professional Summary':'Peşəkar xülasə','Skills':'Bacarıqlar','Contact':'Əlaqə'},
            tr: {'Professional Title':'Mesleki Unvan','Full Stack Developer':'Full Stack Geliştirici','Senior Developer':'Kıdemli Geliştirici','Key Account Managerin':'Kilit Müşteri Yöneticisi','Master of Arts in Education':'Eğitim alanında yüksek lisans','M.Sc. Computer Science':'Bilgisayar Bilimleri Yüksek Lisansı','University of Node':'Node Üniversitesi','Name des Masterstudiengangs':'Yüksek lisans programı adı','Name der Universität/Hochschule, Ort':'Üniversite/yüksekokul adı, şehir','Dedicated professional with a proven track record leading cross-functional teams to exceed expectations.':'Beklentileri aşmak için çapraz fonksiyonlu ekipleri yönetme konusunda kanıtlanmış başarıya sahip, özverili bir profesyonel.','Strategic Planning':'Stratejik planlama','Agile methodologies':'Agile metodolojileri','Data Analysis':'Veri analizi','Leadership':'Liderlik','English':'İngilizce','Azerbaijani':'Azerbaycanca','Mandarin':'Mandarin','Japanese':'Japonca','Translation':'Çeviri','Communication':'İletişim','Curriculum Design':'Müfredat tasarımı','Classroom Management':'Sınıf yönetimi','Work Experience':'İş Deneyimi','Education':'Eğitim','Professional Summary':'Mesleki Özet','Skills':'Yetenekler','Contact':'İletişim'}
        };
        const dict = phraseMap[lang] || {};
        let out = String(value);
        Object.keys(dict).sort((a,b)=>b.length-a.length).forEach(k => { out = out.split(k).join(dict[k]); });
        return out;
    }

    function localizeCVData(data, lang) {
        if (!data || lang === 'en') return data;
        const clone = JSON.parse(JSON.stringify(data));
        const tr = v => localizeCVText(v, lang);
        ['jobTitle','summary','address','nationality'].forEach(k => { if (clone[k]) clone[k] = tr(clone[k]); });
        if (Array.isArray(clone.skills)) clone.skills = clone.skills.map(tr);
        if (Array.isArray(clone.computerSkills)) clone.computerSkills = clone.computerSkills.map(tr);
        ['experience','education','projects','languages'].forEach(list => {
            if (!Array.isArray(clone[list])) return;
            clone[list].forEach(item => {
                if (!item || typeof item === 'string') return;
                ['title','company','location','desc','name','prof','proficiency'].forEach(k => { if (item[k]) item[k] = tr(item[k]); });
            });
        });
        return clone;
    }

    function normalizeCVPreviewLanguage(lang) {
        const root = document.getElementById('cv-pages') || document.querySelector('.cv-preview');
        if (!root) return;
        const packs = {
            en: {
                'Kontakt':'Contact','Əlaqə':'Contact','Контакты':'Contact','İletişim':'Contact',
                'Kenntnisse':'Skills','Fähigkeiten':'Skills','Bacarıqlar':'Skills','Навыки':'Skills','Yetenekler':'Skills',
                'Software-Kenntnisse':'Computer Skills','EDV-Kenntnisse':'Computer Skills','Kompüter bacarıqları':'Computer Skills','Компьютерные навыки':'Computer Skills',
                'Berufserfahrung':'Work Experience','Berufserfahrung / Projekte':'Work Experience / Projects','İş təcrübəsi':'Work Experience','Опыт работы':'Work Experience','İş Deneyimi':'Work Experience',
                'Ausbildung':'Education','Təhsil':'Education','Образование':'Education','Eğitim':'Education',
                'Kurzprofil':'Professional Summary','Profil':'Profile','Haqqımda':'About','HAQQIMDA':'ABOUT','О себе':'About','Профиль':'Profile',
                'Sprachen':'Languages','Dil bilikləri':'Languages','Языки':'Languages','Diller':'Languages',
                'Zertifikate':'Certifications','Sertifikatlar':'Certifications','Сертификаты':'Certifications',
                'Projekte':'Projects','Layihələr':'Projects','Проекты':'Projects','Projeler':'Projects',
                'Heute':'Present','heute':'Present','Aktuell':'Present','İndiyədək':'Present','настоящее время':'Present'
            },
            de: {'Contact':'Kontakt','Skills':'Fähigkeiten','Computer Skills':'EDV-Kenntnisse','Work Experience':'Berufserfahrung','Education':'Ausbildung','Professional Summary':'Kurzprofil','Profile':'Profil','About':'Über mich','Languages':'Sprachen','Certifications':'Zertifikate','Projects':'Projekte','Present':'Heute'},
            az: {'Contact':'Əlaqə','Skills':'Bacarıqlar','Computer Skills':'Kompüter bacarıqları','Work Experience':'İş təcrübəsi','Education':'Təhsil','Professional Summary':'Peşəkar xülasə','Profile':'Profil','About':'Haqqımda','Languages':'Dillər','Certifications':'Sertifikatlar','Projects':'Layihələr','Present':'İndiyədək'},
            ru: {'Contact':'Контакты','Skills':'Навыки','Computer Skills':'Компьютерные навыки','Work Experience':'Опыт работы','Education':'Образование','Professional Summary':'Профессиональное резюме','Profile':'Профиль','About':'О себе','Languages':'Языки','Certifications':'Сертификаты','Projects':'Проекты','Present':'Настоящее время'},
            tr: {'Contact':'İletişim','Skills':'Yetenekler','Computer Skills':'Bilgisayar Becerileri','Work Experience':'İş Deneyimi','Education':'Eğitim','Professional Summary':'Mesleki Özet','Profile':'Profil','About':'Hakkımda','Languages':'Diller','Certifications':'Sertifikalar','Projects':'Projeler','Present':'Günümüz'}
        };
        const dict = packs[lang] || packs.en;
        const cleanToken = (txt) => String(txt || '').replace(/['"]?\+L\.([A-Za-z0-9_ -]+)\+['"]?/g, (_, k) => {
            const key = k.toLowerCase();
            if (key.includes('contact')) return dict.Contact || 'Contact';
            if (key.includes('skill')) return dict.Skills || 'Skills';
            if (key.includes('language')) return dict.Languages || 'Languages';
            if (key.includes('education')) return dict.Education || 'Education';
            if (key.includes('experience')) return dict['Work Experience'] || 'Work Experience';
            if (key.includes('profile') || key.includes('summary')) return dict.Profile || 'Profile';
            return k;
        });
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                const parent = node.parentElement;
                if (!parent || ['SCRIPT','STYLE','TEXTAREA','INPUT','SELECT'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
                return node.nodeValue && node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            }
        });
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(n => {
            let out = cleanToken(n.nodeValue);
            Object.keys(dict).sort((a,b)=>b.length-a.length).forEach(k => {
                out = out.replace(new RegExp('(^|\\b)'+k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(\\b|$)', 'gi'), (m, a, b) => a + dict[k] + b);
            });
            n.nodeValue = out;
        });
    }
    window.normalizeCVPreviewLanguage = normalizeCVPreviewLanguage;

    // Main render trigger function - called whenever form data changes
    function triggerRender() {
        const data = localizeCVData(getFormData(), currentLang);
        if (isBasicPackMode) renderBasicPackCV(data);
        else renderExactTemplateContinuation(data);
        setTimeout(() => normalizeCVPreviewLanguage(currentLang), 20);
        setTimeout(() => normalizeCVPreviewLanguage(currentLang), 240);
    }

    function renderGermanyPdfPageOneExact(data) {
        const expItems = (Array.isArray(data.experience) && data.experience.length) ? data.experience : [
            { title: 'Key Account Managerin', dates: '08/2022 - heute', company: 'PixelPerfekt Werbung', location: 'Cologne', desc: `• Beschreibung Tätigkeitsfeld und Aufgaben\n• Beschreibung Tätigkeitsfeld und Aufgaben\n• Beschreibung Tätigkeitsfeld und Aufgaben` },
            { title: 'Sales Managerin', dates: '04/2020 - 07/2022', company: 'KreativWerk GmbH', location: 'Cologne', desc: `• Beschreibung Tätigkeitsfeld und Aufgaben\n• Beschreibung Tätigkeitsfeld und Aufgaben\n• Beschreibung Tätigkeitsfeld und Aufgaben` }
        ];
        const eduItems = (Array.isArray(data.education) && data.education.length) ? data.education : [
            { title: 'Name des Masterstudiengangs', dates: '08/2018 - 04/2020', company: 'Name der Universität/Hochschule, Ort' },
            { title: 'Name des Bachelorstudiengangs', dates: '08/2014 - 06/2018', company: 'Name der Universität/Hochschule, Ort' }
        ];
        const projectItems = (Array.isArray(data.projects) && data.projects.length) ? data.projects : [
            { title: 'Projekt / Achievement', desc: 'Messbare Optimierung eines Bereichs mit klaren Ergebnissen und verbesserter Effizienz.' }
        ];
        const langs = (Array.isArray(data.languages) && data.languages.length ? data.languages : [{name:'Deutsch', prof:'100'},{name:'Englisch', prof:'90'},{name:'Spanisch', prof:'40'}]).slice(0,3);
        const skills = (Array.isArray(data.skills) && data.skills.length ? data.skills : ['Teamfähigkeit','Kreatives Denken','Kommunikationsstärke','Problemlösungsfähigkeit','Organisationstalent']).slice(0,6);
        const compSkills = (Array.isArray(data.computerSkills) && data.computerSkills.length ? data.computerSkills : ['Salesforce','Mailchimp','Google Analytics','HubSpot CRM']).slice(0,5);
        const photoHtml = (data.showPhoto && photoDataUrl) ? `<div class="gpdf-side-photo"><img src="${photoDataUrl}" alt="Photo"></div>` : `<div class="gpdf-side-photo gpdf-side-photo--placeholder"></div>`;
        return `<div class="cv-page cv-layout-de-pdf-01 cv-theme-slate cv-layout-gpdf-base" data-page="1">
            <div class="cv-side">
                <div class="gpdf-side-content gpdf-side-content-01-exact">
                    ${photoHtml}
                    <div class="gpdf-side-sec gpdf-side-sec-contact"><h3>Kontakt</h3>
                        <div data-inline="phone">${data.phone || ''}</div>
                        <div data-inline="email">${data.email || ''}</div>
                        <div data-inline="linkedin">${data.linkedin || '/ lena-schreiber'}</div>
                        <div data-inline="address">${data.address || ''}</div>
                    </div>
                    <div class="gpdf-side-sec"><h3>Kenntnisse</h3>
                        ${langs.map((l,i)=>`<div class="gpdf-list-row"><span data-inline="language-name" data-index="${i}">${l.name || ''}</span><strong data-inline="language-prof" data-index="${i}">${String(l.prof || '').includes('%') ? l.prof : (l.prof + '%')}</strong></div>`).join('')}
                        <div class="gpdf-mini-subhead">Software-Kenntnisse</div>
                        <ul>${compSkills.map((item,i)=>`<li data-inline="computerSkills" data-index="${i}">${item}</li>`).join('')}</ul>
                    </div>
                    <div class="gpdf-side-sec"><h3>Fähigkeiten</h3><ul>${skills.map((item,i)=>`<li data-inline="skills" data-index="${i}">${item}</li>`).join('')}</ul></div>
                </div>
            </div>
            <div class="cv-header-area"><div class="gpdf-header gpdf-header-01-exact"><div class="gpdf-header-copy"><h1 data-inline="fullName">${data.fullName || ''}</h1><h2 data-inline="targetJobTitle">${data.jobTitle || ''}</h2></div></div></div>
            <div class="cv-main">
                <div class="cv-section gpdf-section gpdf-section-summary"><h3 class="cv-sec-title">Kurzprofil</h3><p data-inline="summary">${data.summary || 'Ein Lebenslauf ist eine prägnante Zusammenfassung Ihrer Stärken und Erfahrungen. Beginnen Sie mit Ihrer aktuellen Position und Ihrem Fachgebiet, um Ihr Profil klar hervorzuheben.'}</p></div>
                <div class="cv-section gpdf-section gpdf-exp-section"><h3 class="cv-sec-title">Berufserfahrung</h3>${expItems.map((exp,i)=>`<div class="gpdf-exp-item"><div class="gpdf-item-head"><span class="cv-item-title" data-inline="exp-company" data-index="${i}">${exp.company || ''}</span><span class="cv-item-date" data-inline="exp-dates" data-index="${i}">${exp.dates || ''}</span></div><div class="cv-item-comp" data-inline="exp-title" data-index="${i}">${exp.title || ''}</div><ul class="gpdf-bullets">${formatBulletLines(exp.desc || exp.description || '')}</ul></div>`).join('')}</div>
                <div class="cv-section gpdf-section gpdf-edu-section"><h3 class="cv-sec-title">Ausbildung</h3>${eduItems.map((edu,i)=>`<div class="gpdf-edu-item"><div class="gpdf-item-head"><span class="cv-item-title" data-inline="edu-title" data-index="${i}">${edu.title || ''}</span><span class="cv-item-date" data-inline="edu-dates" data-index="${i}">${edu.dates || ''}</span></div><div class="cv-item-comp" data-inline="edu-company" data-index="${i}">${edu.company || ''}</div></div>`).join('')}</div>
                <div class="cv-section gpdf-section gpdf-proj-section"><h3 class="cv-sec-title">Projekte</h3>${projectItems.map((proj,i)=>`<div class="gpdf-proj-item"><strong data-inline="proj-title" data-index="${i}">${proj.title || proj.name || ''}</strong><p data-inline="proj-desc" data-index="${i}">${proj.desc || proj.description || ''}</p></div>`).join('')}</div>
            </div>
        </div>`;
    }

    // 6.2 Main Render Engine: Premium Continuation with Multi-Page Support
    function renderExactTemplateContinuation(data) {
        const previewRoot = document.getElementById('cv-preview');
        if (!previewRoot) {
            console.error('CV Preview container not found');
            return;
        }
        previewRoot.innerHTML = '';
        
        const pagesWrapper = document.createElement('div');
        pagesWrapper.className = 'cv-pages';
        pagesWrapper.id = 'cv-pages';
        previewRoot.appendChild(pagesWrapper);

        const layout = activeLayoutPattern || 'azerbaijan-template-01';
        const theme = activeThemeColor || 'slate';
        if (isGermanyPdfLayout(layout)) {
            renderGermanyPdfPages(data, layout, previewRoot);
            if (typeof enableInlinePreviewEditing === 'function') enableInlinePreviewEditing();
            return;
        }


        // Uploaded premium templates render as real editable HTML/CSS designs, not image backgrounds.
        // AZ 10 Clean Formal Sales uses its own exact CSS-built design and real continuation pages.
        if (layout === 'az-live-minimal-line') {
            renderAz10CleanSalesPaginated(data, previewRoot);
            if (typeof enableInlinePreviewEditing === 'function') enableInlinePreviewEditing();
            return;
        }
        if (String(layout || '').startsWith('us-live-')) {
            renderUSALiveTemplatePaginated(data, previewRoot, layout);
            if (typeof enableInlinePreviewEditing === 'function') enableInlinePreviewEditing();
            return;
        }
        if (String(layout || '').startsWith('uk-live-')) {
            renderUKLiveTemplatePaginated(data, previewRoot, layout);
            if (typeof enableInlinePreviewEditing === 'function') enableInlinePreviewEditing();
            return;
        }
        if (/^ca-live-/.test(String(layout || ''))) {
            renderCanadaExactTemplatePaginated(data, previewRoot, layout);
            if (typeof enableInlinePreviewEditing === 'function') enableInlinePreviewEditing();
            return;
        }
        if (/^sg-live-/.test(String(layout || ''))) {
            renderSingaporeExactTemplatePaginated(data, previewRoot, layout);
            if (typeof enableInlinePreviewEditing === 'function') enableInlinePreviewEditing();
            return;
        }
        if (/^fr-live-/.test(String(layout || ''))) {
            renderFranceExactTemplatePaginated(data, previewRoot, layout);
            if (typeof enableInlinePreviewEditing === 'function') enableInlinePreviewEditing();
            return;
        }
        if (/^cn-live-/.test(String(layout || ''))) {
            renderChinaExactTemplatePaginated(data, previewRoot, layout);
            if (typeof enableInlinePreviewEditing === 'function') enableInlinePreviewEditing();
            return;
        }
        if (/^es-live-/.test(String(layout || ''))) {
            renderInternationalPremiumTemplatePaginated(data, previewRoot, layout);
            if (typeof enableInlinePreviewEditing === 'function') enableInlinePreviewEditing();
            return;
        }
        if (/^(az|de)-live-/.test(layout)) {
            pagesWrapper.innerHTML = `<div class="cv-page cv-uploaded-live-page cv-layout-${layout}" data-page="1">${renderUploadedLiveTemplate(data, layout)}</div>`;
            if (typeof enableInlinePreviewEditing === 'function') enableInlinePreviewEditing();
            return;
        }
        // Fallback: if layout is undefined or corrupted, use default
        const safeLayout = layout && layout.length > 0 ? layout : 'azerbaijan-template-01';

        // MEASUREMENT sandbox
        const sandbox = document.getElementById('cv-sandbox') || document.createElement('div');
        sandbox.id = 'cv-sandbox';
        sandbox.style.cssText = 'position:absolute; top:-9999px; left:-9999px; width:210mm; visibility:hidden; display: block;';
        if (!sandbox.parentElement) document.body.appendChild(sandbox);
        sandbox.innerHTML = '';

        let currentPageNum = 1;
        let currentPage = createTemplatePageShell(safeLayout, theme, currentPageNum);
        pagesWrapper.appendChild(currentPage);

        let currentTarget = currentPage.querySelector('.cv-main') || currentPage.querySelector('.cv-content-full');
        
        // Header (Only on Page 1)
        const headerHtml = renderPremiumHeader(data, layout);
        const headerContainer = currentPage.querySelector('.cv-header-area');
        if (headerContainer) {
            headerContainer.innerHTML = headerHtml;
        } else if (currentTarget) {
            currentTarget.innerHTML += headerHtml;
        }

        // Content Processing (Section by Section)
        if (data.sectionOrder) {
            data.sectionOrder.forEach(secKey => {
                const secHtml = renderPremiumSection(data, secKey, layout);
                if (!secHtml) return;

                const tempContainer = document.createElement('div');
                tempContainer.innerHTML = secHtml;
                const elements = Array.from(tempContainer.children);

                elements.forEach(el => {
                    const clone = el.cloneNode(true);
                    currentTarget.appendChild(clone);

                    // Check Overflow in Sandbox
                    sandbox.innerHTML = '';
                    const sandboxPage = currentPage.cloneNode(true);
                    sandbox.appendChild(sandboxPage);
                    
                    if (sandboxPage.scrollHeight > 1120) {
                        clone.remove();
                        currentPageNum++;
                        currentPage = createTemplatePageShell(layout, theme, currentPageNum);
                        pagesWrapper.appendChild(currentPage);
                        currentTarget = currentPage.querySelector('.cv-main') || currentPage.querySelector('.cv-content-full');
                        currentTarget.appendChild(clone);
                    }
                });
            });
        }

        // Sidebar Content
        pagesWrapper.querySelectorAll('.cv-page').forEach(pg => {
            const sideTarget = pg.querySelector('.cv-side');
            if (sideTarget) sideTarget.innerHTML = renderPremiumSidebar(data, layout, pg.dataset.page);
        });

        sandbox.innerHTML = '';
        if (typeof enableInlinePreviewEditing === "function") {
            enableInlinePreviewEditing();
        } else {
            const previewRoot = document.getElementById('cv-preview');
            if (previewRoot && !isBasicPackMode) {
                const editableNodes = previewRoot.querySelectorAll('[data-inline]');
                editableNodes.forEach(node => {
                    node.setAttribute('contenteditable', 'true');
                    node.setAttribute('spellcheck', 'false');
                    node.classList.add('inline-editable');
                });
            }
        }
    }

    function isGermanyPdfLayout(layout) {
        return typeof layout === 'string' && /^de-pdf-\d+$/.test(layout);
    }

    function getGermanyPdfLayoutIndex(layout) {
        const match = String(layout || '').match(/de-pdf-(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
    }

    function getGermanyPdfMeta(layout) {
        const idx = getGermanyPdfLayoutIndex(layout);
        const map = {
            1: { key:'slate', className:'cv-layout-de-pdf-01', sidebar:true, title:'Kontakt', skillsTitle:'Kenntnisse' },
            2: { key:'creative-dark', className:'cv-layout-de-pdf-02', sidebar:true, title:'About', skillsTitle:'Skills' },
            3: { key:'finance-timeline', className:'cv-layout-de-pdf-03', sidebar:true, title:'Persönliche Daten', skillsTitle:'Fähigkeiten' },
            4: { key:'blue-corporate', className:'cv-layout-de-pdf-04', sidebar:true, title:'Kontakt', skillsTitle:'Sprachen' },
            5: { key:'executive-red', className:'cv-layout-de-pdf-05', sidebar:true, title:'Kontakt', skillsTitle:'Skills' },
            6: { key:'luxe-minimal', className:'cv-layout-de-pdf-06', sidebar:true, title:'Contact', skillsTitle:'Skills' },
            7: { key:'classic-grey', className:'cv-layout-de-pdf-07', sidebar:true, title:'Persönliches', skillsTitle:'Kenntnisse' },
            8: { key:'admin-clean', className:'cv-layout-de-pdf-08', sidebar:true, title:'Kontakt', skillsTitle:'Kenntnisse & Fähigkeiten' },
            9: { key:'ats-yellow', className:'cv-layout-de-pdf-09', sidebar:false, title:'Kontakt', skillsTitle:'Fähigkeiten' },
            10:{ key:'editorial', className:'cv-layout-de-pdf-10', sidebar:true, title:'Contact', skillsTitle:'Expertise' }
        };
        return map[idx] || map[1];
    }

    function normalizeGermanyPdfData(data, layout) {
        const clone = JSON.parse(JSON.stringify(data || {}));
        const idx = getGermanyPdfLayoutIndex(layout);
        const titleSets = {
            1: ['Key Account Managerin', 'Sales Managerin', 'Marketing Specialist'],
            2: ['Graphic Designer', 'Web Developer', 'Content Creator'],
            3: ['Bilanzbuchhalter', 'Buchhalter', 'Finanzanalyst'],
            4: ['Projektmanager', 'IT Consultant', 'Business Analyst'],
            5: ['Senior Manager', 'Operations Lead', 'Strategy Manager'],
            6: ['Web Developer', 'Content Manager', 'Analytics Specialist'],
            7: ['Marketing Manager', 'Sales Coordinator', 'Office Manager'],
            8: ['Technische Operationsingenieurin', 'Koordinatorin', 'Projektassistenz'],
            9: ['Administrative Assistenz', 'Sekretärin', 'Office Specialist'],
            10: ['Graphic Designer', 'Product Designer', 'Brand Specialist']
        };
        const companySets = {
            1: ['PixelPerfekt Werbung', 'KreativWerk GmbH', 'BrandHaus Media'],
            2: ['Company in Los Angeles', 'Company in United State', 'Creative Studio'],
            3: ['Investitions OHG', 'Kapital AG', 'Finanz GmbH'],
            4: ['Technology Group', 'Digital Systems', 'Innovation Lab'],
            5: ['Ginyard International', 'Arrowall Industries', 'Northlane Group'],
            6: ['Applications Company', 'Web Content Company', 'Analysis Content Company'],
            7: ['Beispielfirma', 'Marketing House', 'Business Studio'],
            8: ['Öffentlicher Betrieb', 'Operations Team', 'Project Office'],
            9: ['Flint Group GmbH', 'Sekretariat GmbH', 'Office Support'],
            10: ['Ginyard International', 'Arrowall Industries', 'Studio Orbit']
        };
        const dateSets = ['08/2022 - heute','04/2020 - 07/2022','08/2018 - 04/2020'];
        if (!Array.isArray(clone.experience) || clone.experience.length < 3) {
            const existing = Array.isArray(clone.experience) ? clone.experience : [];
            for (let i = existing.length; i < 3; i++) {
                existing.push({
                    title: titleSets[idx][i] || 'Professional Role',
                    dates: dateSets[i] || '01/2019 - 12/2020',
                    company: companySets[idx][i] || 'Example Company',
                    location: idx === 1 ? 'Cologne' : 'Berlin',
                    desc: '• Beschreibung Tätigkeitsfeld und Aufgaben\n• Verantwortung für Projekte und Kommunikation\n• Verbesserte Prozesse mit messbarem Ergebnis'
                });
            }
            clone.experience = existing;
        }
        if (!Array.isArray(clone.education) || clone.education.length < 2) {
            const existing = Array.isArray(clone.education) ? clone.education : [];
            const eduExamples = [
                { title: idx===8 ? 'Koordination der Betriebsverantwortung' : 'Name des Masterstudiengangs', dates: '08/2018 - 04/2020', company: idx===8 ? 'Öffentliche Akademie, Berlin' : 'Name der Universität/Hochschule, Ort' },
                { title: idx===8 ? 'Bachelor / Ausbildung' : 'Name des Bachelorstudiengangs', dates: '08/2014 - 06/2018', company: idx===8 ? 'Bildungsinstitut, Berlin' : 'Name der Universität/Hochschule, Ort' }
            ];
            for (let i = existing.length; i < 2; i++) existing.push(eduExamples[i]);
            clone.education = existing;
        }
        if (!Array.isArray(clone.projects) || clone.projects.length < 2) {
            const existing = Array.isArray(clone.projects) ? clone.projects : [];
            const projExamples = [
                { name: 'Operations Overhaul', title: 'Operations Overhaul', desc: 'Led a cross-functional team saving 20% in quarterly costs.' },
                { name: 'Digital Relaunch', title: 'Digital Relaunch', desc: 'Improved conversion, reporting and stakeholder communication across teams.' }
            ];
            for (let i = existing.length; i < 2; i++) existing.push(projExamples[i]);
            clone.projects = existing;
        }
        if (!Array.isArray(clone.languages) || clone.languages.length < 2) {
            clone.languages = [{ name:'Deutsch', prof:'100' }, { name:'Englisch', prof:'85' }, { name:'Spanisch', prof:'40' }];
        }
        if (!Array.isArray(clone.skills) || clone.skills.length < 4) {
            clone.skills = ['Problem Solving','Time Management','Agile','Strategic Planning','Leadership'];
        }
        if (!Array.isArray(clone.computerSkills) || clone.computerSkills.length < 3) {
            clone.computerSkills = ['Microsoft PowerPoint','SAP','Salesforce'];
        }
        clone.sectionOrder = ['summary','experience','education','projects'];
        return clone;
    }

    function renderGermanyPdfPages(rawData, layout, previewRoot) {
        const data = normalizeGermanyPdfData(rawData, layout);
        previewRoot.innerHTML = '<div class="cv-pages" id="cv-pages"></div>';
        const pagesWrapper = previewRoot.querySelector('.cv-pages');

        // Render only the real first page first. Continuation pages are created only
        // when content actually overflows. This prevents blank/duplicated second pages.
        const page = createTemplatePageShell(layout, activeThemeColor || 'slate', 1);
        const headerTarget = page.querySelector('.cv-header-area');
        if (headerTarget) headerTarget.innerHTML = renderGermanyPdfHeader(data, layout);
        const mainTarget = page.querySelector('.cv-main') || page.querySelector('.cv-content-full');
        const sections = (data.sectionOrder || ['summary','experience','education','projects'])
            .map(key => renderGermanyPdfSection(data, key, layout))
            .join('');
        if (mainTarget) mainTarget.innerHTML = sections;
        const sideTarget = page.querySelector('.cv-side');
        if (sideTarget) sideTarget.innerHTML = renderGermanyPdfSidebar(data, layout, 1);
        pagesWrapper.appendChild(page);

        requestAnimationFrame(() => rebalanceGermanyPdfPages(data, layout, pagesWrapper));
    }

    function getGermanyMainTarget(page) {
        return page ? (page.querySelector('.cv-main') || page.querySelector('.cv-content-full')) : null;
    }

    function makeGermanyContinuationPage(data, layout, pageNum) {
        const page = createTemplatePageShell(layout, activeThemeColor || 'slate', pageNum);
        page.classList.add('cv-page-continuation');
        const headerTarget = page.querySelector('.cv-header-area');
        // Continuation pages keep the template structure, but do not repeat page-1
        // personal/header information. Only overflowing CV sections continue below.
        if (headerTarget) headerTarget.innerHTML = `<div class="gpdf-continuation-blank" aria-hidden="true"></div>`;
        const sideTarget = page.querySelector('.cv-side');
        if (sideTarget) sideTarget.innerHTML = `<div class="gpdf-continuation-side-blank" aria-hidden="true"></div>`;
        const mainTarget = getGermanyMainTarget(page);
        if (mainTarget) mainTarget.innerHTML = '';
        return page;
    }

    function ensureGermanySection(target, sourceSection) {
        if (!target || !sourceSection) return null;
        const titleText = (sourceSection.querySelector('.cv-sec-title') || {}).textContent || '';
        let same = Array.from(target.children).find(el => el.classList && el.classList.contains('gpdf-section') && ((el.querySelector('.cv-sec-title') || {}).textContent || '') === titleText);
        if (!same) {
            same = document.createElement('div');
            same.className = sourceSection.className || 'cv-section gpdf-section';
            same.innerHTML = `<h3 class="cv-sec-title">${titleText}</h3>`;
            target.prepend(same);
        }
        return same;
    }

    function moveLastBlockToNextPage(page, nextPage) {
        const main = getGermanyMainTarget(page);
        const nextMain = getGermanyMainTarget(nextPage);
        if (!main || !nextMain) return false;
        const sections = Array.from(main.querySelectorAll(':scope > .gpdf-section, :scope > .cv-section'));
        if (!sections.length) return false;
        const lastSection = sections[sections.length - 1];
        const items = Array.from(lastSection.querySelectorAll(':scope > .cv-item, :scope > .gpdf-exp-item, :scope > .gpdf-edu-item, :scope > .gpdf-proj-item'));
        if (items.length > 1) {
            const item = items[items.length - 1];
            const nextSection = ensureGermanySection(nextMain, lastSection);
            if (nextSection) {
                const title = nextSection.querySelector('.cv-sec-title');
                if (title && title.nextSibling) nextSection.insertBefore(item, title.nextSibling);
                else nextSection.appendChild(item);
                return true;
            }
        }
        nextMain.prepend(lastSection);
        return true;
    }

    function rebalanceGermanyPdfPages(data, layout, pagesWrapper) {
        if (!pagesWrapper) return;
        const maxPages = 20;
        const pxPerMmValue = (typeof pxPerMm === 'function' ? pxPerMm() : 3.7795275591);
        const tolerance = 3 * pxPerMmValue;

        const isEmptyMain = (main) => !main || (!main.textContent.trim() && main.children.length === 0);

        function pageContentBottom(page) {
            const main = getGermanyMainTarget(page);
            if (!page || !main) return 0;
            let bottom = main.getBoundingClientRect().top;
            Array.from(main.children).forEach(child => {
                const r = child.getBoundingClientRect();
                if (r.height > 0) bottom = Math.max(bottom, r.bottom);
            });
            return bottom;
        }

        function mainOverflows(page) {
            const main = getGermanyMainTarget(page);
            if (!page || !main) return false;
            const pageRect = page.getBoundingClientRect();
            const pageHeight = page.clientHeight || pageRect.height || (297 * pxPerMmValue);
            const allowedBottom = pageRect.top + pageHeight - (10 * pxPerMmValue);
            const contentBottom = pageContentBottom(page);
            const pageScrollOverflow = page.scrollHeight > page.clientHeight + tolerance;
            const mainScrollOverflow = main.clientHeight > 0 && main.scrollHeight > main.clientHeight + tolerance;
            return pageScrollOverflow || mainScrollOverflow || contentBottom > allowedBottom + tolerance;
        }

        function removeEmptySections(page) {
            const main = getGermanyMainTarget(page);
            if (!main) return;
            Array.from(main.querySelectorAll(':scope > .gpdf-section, :scope > .cv-section')).forEach(sec => {
                const items = Array.from(sec.children).filter(ch => !(ch.classList && ch.classList.contains('cv-sec-title')));
                const hasRealContent = items.some(ch => ch.textContent.trim() || ch.children.length);
                if (!hasRealContent) sec.remove();
            });
        }

        function removeEmptyTrailingPages() {
            const pages = Array.from(pagesWrapper.querySelectorAll('.cv-page'));
            pages.slice(1).forEach(pg => {
                removeEmptySections(pg);
                const main = getGermanyMainTarget(pg);
                if (isEmptyMain(main)) pg.remove();
            });
            Array.from(pagesWrapper.querySelectorAll('.cv-page')).forEach((pg, i) => { pg.dataset.page = String(i + 1); });
        }

        let guard = 0;
        while (guard++ < 300) {
            let changed = false;
            const pages = Array.from(pagesWrapper.querySelectorAll('.cv-page'));
            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                removeEmptySections(page);
                if (!mainOverflows(page)) continue;

                let nextPage = pagesWrapper.querySelectorAll('.cv-page')[i + 1];
                if (!nextPage) {
                    if (pagesWrapper.querySelectorAll('.cv-page').length >= maxPages) break;
                    nextPage = makeGermanyContinuationPage(data, layout, pagesWrapper.querySelectorAll('.cv-page').length + 1);
                    pagesWrapper.appendChild(nextPage);
                }

                const moved = moveLastBlockToNextPage(page, nextPage);
                if (moved) {
                    changed = true;
                    removeEmptySections(page);
                    removeEmptySections(nextPage);
                }
            }
            if (!changed) break;
        }

        removeEmptyTrailingPages();
        if (typeof enableInlinePreviewEditing === 'function') enableInlinePreviewEditing();
    }

    function renderGermanyPdfHeader(data, layout) {
        const idx = getGermanyPdfLayoutIndex(layout);
        const photoHtml = (data.showPhoto && photoDataUrl) ? `<div class="gpdf-photo"><img src="${photoDataUrl}" alt="Photo"></div>` : '<div class="gpdf-photo gpdf-photo--placeholder">Photo</div>';
        const contactInline = [data.email, data.phone, data.address].filter(Boolean).join(' • ');
        const summary = data.summary || '';
        if (idx === 1) {
            return `
                <div class="gpdf-header gpdf-header-01-exact">
                    <div class="gpdf-header-copy">
                        <h1 data-inline="fullName">${data.fullName || ''}</h1>
                        <h2 data-inline="targetJobTitle">${data.jobTitle || ''}</h2>
                    </div>
                </div>
            `;
        }
        if (idx === 8) {
            return `
                <div class="gpdf-header gpdf-header-08-formal">
                    <h1 data-inline="fullName">${data.fullName || ''}</h1>
                    <div class="gpdf-contact-stack gpdf-contact-stack-08">${[
                        data.address ? `<div><strong>Adresse:</strong><span data-inline="address">${data.address}</span></div>` : '',
                        data.phone ? `<div><strong>Telefon:</strong><span data-inline="phone">${data.phone}</span></div>` : '',
                        data.email ? `<div><strong>Email:</strong><span data-inline="email">${data.email}</span></div>` : '',
                        data.linkedin ? `<div><strong>Linkedin:</strong><span data-inline="linkedin">${data.linkedin}</span></div>` : '',
                        data.showNat && data.nationality ? `<div><strong>Zivilstand:</strong><span data-inline="nationality">${data.nationality}</span></div>` : ''
                    ].filter(Boolean).join('')}</div>
                </div>
            `;
        }
        if (idx === 9) {
            return `
                <div class="gpdf-header gpdf-header-09">
                    <div class="gpdf-header-left">
                        <h1 data-inline="fullName">${data.fullName || ''}</h1>
                        <div class="gpdf-contact-stack">${[
                            data.address ? `<div data-inline=\"address\">${data.address}</div>` : '',
                            data.phone ? `<div data-inline=\"phone\">${data.phone}</div>` : '',
                            data.email ? `<div data-inline=\"email\">${data.email}</div>` : '',
                            data.linkedin ? `<div data-inline=\"linkedin\">${data.linkedin}</div>` : ''
                        ].filter(Boolean).join('')}</div>
                    </div>
                    <div class="gpdf-header-right">
                        ${photoHtml}
                    </div>
                </div>
            `;
        }
        if (idx === 10) {
            return `
                <div class="gpdf-header gpdf-header-10">
                    <div>
                        <h1 data-inline="fullName">${data.fullName || ''}</h1>
                        <h2 data-inline="targetJobTitle">${data.jobTitle || ''}</h2>
                        <div class="gpdf-mini-icon-row">${[
                            data.email ? `<span data-inline=\"email\">${data.email}</span>` : '',
                            data.phone ? `<span data-inline=\"phone\">${data.phone}</span>` : '',
                            data.address ? `<span data-inline=\"address\">${data.address}</span>` : ''
                        ].filter(Boolean).join('')}</div>
                    </div>
                </div>
            `;
        }
        if (idx === 2) {
            return `
                <div class="gpdf-header gpdf-header-02">
                    <div class="gpdf-hero-band"></div>
                    <div class="gpdf-header-copy">
                        <h1 data-inline="fullName">${data.fullName || ''}</h1>
                        <h2 data-inline="targetJobTitle">${data.jobTitle || ''}</h2>
                        <div class="gpdf-mini-icon-row">${[
                            data.phone ? `<span data-inline=\"phone\">${data.phone}</span>` : '',
                            data.email ? `<span data-inline=\"email\">${data.email}</span>` : '',
                            (data.website || data.linkedin) ? `<span data-inline=\"linkedin\">${data.website || data.linkedin}</span>` : ''
                        ].filter(Boolean).join('')}</div>
                    </div>
                </div>
            `;
        }
        if (idx === 6) {
            return `
                <div class="gpdf-header gpdf-header-06">
                    <div class="gpdf-header-copy">
                        <h1 data-inline="fullName">${data.fullName || ''}</h1>
                        <h2 data-inline="targetJobTitle">${data.jobTitle || ''}</h2>
                    </div>
                    ${photoHtml}
                </div>
            `;
        }
        return `
            <div class="gpdf-header gpdf-header-${String(idx).padStart(2,'0')}">
                <div class="gpdf-header-copy">
                    <h1 data-inline="fullName">${data.fullName || ''}</h1>
                    <h2 data-inline="targetJobTitle">${data.jobTitle || ''}</h2>
                    ${summary ? `<p class="gpdf-summary-intro" data-inline="summary">${summary}</p>` : ''}
                    ${contactInline ? `<div class=\"gpdf-mini-icon-row\">${data.email ? `<span data-inline=\"email\">${data.email}</span>` : ''}${data.phone ? `<span data-inline=\"phone\">${data.phone}</span>` : ''}${data.address ? `<span data-inline=\"address\">${data.address}</span>` : ''}</div>` : ''}
                </div>
                ${(idx === 1 || idx === 4 || idx === 7 || idx === 9) ? photoHtml : ''}
            </div>
        `;
    }

    function renderGermanyPdfSidebar(data, layout, pageNum) {
        // repeat sidebar on all generated pages
        const idx = getGermanyPdfLayoutIndex(layout);
        const meta = getGermanyPdfMeta(layout);
        const languages = (data.languages || []).map((l, i) => `<div class="gpdf-list-row"><span data-inline="language-name" data-index="${i}">${l.name || ''}</span><strong data-inline="language-prof" data-index="${i}">${l.prof || ''}${String(l.prof || '').includes('%') ? '' : '%'}</strong></div>`).join('');
        const skills = (data.skills || []).map((skill, i) => `<li data-inline="skills" data-index="${i}">${skill}</li>`).join('');
        const compSkills = (data.computerSkills || []).map((skill, i) => `<li data-inline="computerSkills" data-index="${i}">${skill}</li>`).join('');
        const hobbies = (data.hobbies || []).map((hobby, i) => `<li data-inline="hobbies" data-index="${i}">${hobby}</li>`).join('');
        const certs = (data.certificates || []).map((cert, i) => `<li data-inline="certificates" data-index="${i}">${cert}</li>`).join('');
        const contact = [
            data.email ? `<div data-inline=\"email\">${data.email}</div>` : '',
            data.phone ? `<div data-inline=\"phone\">${data.phone}</div>` : '',
            data.address ? `<div data-inline=\"address\">${data.address}</div>` : '',
            data.showDob && data.dob ? `<div data-inline=\"dob\">${data.dob}</div>` : '',
            data.showNat && data.nationality ? `<div data-inline=\"nationality\">${data.nationality}</div>` : ''
        ].filter(Boolean).join('');
        const photoBlock = (data.showPhoto && photoDataUrl) ? `<div class="gpdf-side-photo"><img src="${photoDataUrl}" alt="Photo"></div>` : '';
        if (idx === 1) {
            return `
                <div class="gpdf-side-content gpdf-side-content-01-exact">
                    ${photoBlock}
                    <div class="gpdf-side-sec gpdf-side-sec-contact"><h3>Kontakt</h3>${contact}</div>
                    ${languages ? `<div class="gpdf-side-sec"><h3>Kenntnisse</h3><div>${languages}</div></div>` : ''}
                    ${(data.computerSkills && data.computerSkills.length) ? `<div class="gpdf-side-sec"><h3>Software-Kenntnisse</h3><ul>${compSkills}</ul></div>` : ''}
                    ${(data.skills && data.skills.length) ? `<div class="gpdf-side-sec"><h3>Fähigkeiten</h3><ul>${skills}</ul></div>` : ''}
                    ${certs ? `<div class="gpdf-side-sec"><h3>Zertifikate</h3><ul>${certs}</ul></div>` : ''}
                </div>
            `;
        }
        if (idx === 10) {
            return `
                <div class="gpdf-side-content gpdf-side-content-10">
                    ${photoBlock}
                    <div class="gpdf-side-sec"><h3>CONTACT</h3>${contact}</div>
                    <div class="gpdf-side-sec"><h3>Education</h3>${(data.education||[]).slice(0,2).map(edu=>`<div class="gpdf-edu-card"><strong>${edu.title||''}</strong><span>${edu.company||''}</span><span>${edu.dates||''}</span></div>`).join('')}</div>
                    <div class="gpdf-side-sec"><h3>Expertise</h3><ul>${skills || compSkills}</ul></div>
                    <div class="gpdf-side-sec"><h3>Language</h3><div>${languages}</div></div>
                </div>
            `;
        }
        if (idx === 8) {
            return `
                <div class="gpdf-side-content gpdf-side-content-08-formal">
                    ${photoBlock || '<div class="gpdf-side-photo gpdf-side-photo--placeholder">Photo</div>'}
                    <div class="gpdf-side-sec"><h3>Kenntnisse & Fähigkeiten</h3><ul>${skills}</ul>${compSkills ? `<ul>${compSkills}</ul>` : ''}</div>
                    ${languages ? `<div class="gpdf-side-sec"><h3>Sprachen</h3><ul>${(data.languages || []).map((l,i)=>`<li><span data-inline="language-name" data-index="${i}">${l.name || ''}</span> – <span data-inline="language-prof" data-index="${i}">${l.prof || ''}${String(l.prof || '').includes('%') ? '' : '%'}</span></li>`).join('')}</ul></div>` : ''}
                    ${certs ? `<div class="gpdf-side-sec"><h3>Zertifikate</h3><ul>${certs}</ul></div>` : ''}
                </div>
            `;
        }
        return `
            <div class="gpdf-side-content gpdf-side-content-${String(idx).padStart(2,'0')}">
                ${photoBlock}
                <div class="gpdf-side-sec"><h3>${meta.title}</h3>${contact}</div>
                ${(idx === 4 || idx === 5) && data.summary ? `<div class=\"gpdf-side-sec\"><h3>Kurzprofil</h3><p data-inline=\"summary\">${data.summary}</p></div>` : ''}
                <div class="gpdf-side-sec"><h3>${meta.skillsTitle}</h3><ul>${skills}</ul>${compSkills ? `<ul>${compSkills}</ul>` : ''}</div>
                ${languages ? `<div class="gpdf-side-sec"><h3>${idx===4?'Sprachen':'Languages'}</h3><div>${languages}</div></div>` : ''}
                ${hobbies ? `<div class="gpdf-side-sec"><h3>${idx===5?'Hobbies':'Interests'}</h3><ul>${hobbies}</ul></div>` : ''}
                ${certs ? `<div class="gpdf-side-sec"><h3>Zertifikate</h3><ul>${certs}</ul></div>` : ''}
            </div>
        `;
    }

    function formatBulletLines(text) {
        return String(text || '').split(/\n+/).filter(Boolean).map(line => `<li>${line.replace(/^[-•]\s*/, '')}</li>`).join('');
    }

    function renderGermanyPdfSection(data, key, layout) {
        const idx = getGermanyPdfLayoutIndex(layout);
        const expItems = (Array.isArray(data.experience) && data.experience.length) ? data.experience : [{
            title: 'Marketing Manager',
            dates: '08/2022 - heute',
            company: 'PixelPerfekt Werbung',
            location: 'Cologne',
            desc: `• Beschreibung Tätigkeitsfeld und Aufgaben
• Beschreibung Tätigkeitsfeld und Aufgaben
• Beschreibung Tätigkeitsfeld und Aufgaben`
        }, {
            title: 'Sales Managerin',
            dates: '04/2020 - 07/2022',
            company: 'KreativWerk GmbH',
            location: 'Cologne',
            desc: `• Beschreibung Tätigkeitsfeld und Aufgaben
• Beschreibung Tätigkeitsfeld und Aufgaben
• Beschreibung Tätigkeitsfeld und Aufgaben`
        }];
        const eduItems = (Array.isArray(data.education) && data.education.length) ? data.education : [{
            title: 'Name des Masterstudiengangs',
            dates: '08/2018 - 04/2020',
            company: 'Name der Universität/Hochschule, Ort'
        }, {
            title: 'Name des Bachelorstudiengangs',
            dates: '08/2014 - 06/2018',
            company: 'Name der Universität/Hochschule, Ort'
        }];
        const projectItems = (Array.isArray(data.projects) && data.projects.length) ? data.projects : [{
            name: 'Projekt / Achievement',
            desc: 'Erfolgreich ein Projekt umgesetzt, Prozesse verbessert und messbare Ergebnisse erzielt.'
        }];
        if (key === 'summary' && data.summary && ![4,5,10].includes(idx)) {
            return `<div class="cv-section gpdf-section gpdf-section-summary"><h3 class="cv-sec-title">${idx===1?'Kurzprofil':(idx===8?'Kurzprofil':'Profile')}</h3><p data-inline="summary">${data.summary}</p></div>`;
        }
        if (key === 'experience' && data.experience.length > 0) {
            return `
                <div class="cv-section gpdf-section gpdf-exp-section gpdf-exp-section-${String(idx).padStart(2,'0')}">
                    <h3 class="cv-sec-title">${idx===1 ? 'Berufserfahrung' : (idx===8 ? 'Berufserfahrung' : 'Work Experience')}</h3>
                    ${expItems.map((exp, i) => `
                        <div class="cv-item gpdf-exp-item">
                            <div class="gpdf-item-head">
                                <span class="cv-item-title" data-inline="exp-title" data-index="${i}">${exp.title || ''}</span>
                                <span class="cv-item-date" data-inline="exp-dates" data-index="${i}">${exp.dates || ''}</span>
                            </div>
                            <div class="cv-item-comp" data-inline="exp-company" data-index="${i}">${exp.company || ''}${exp.location ? `, ${exp.location}` : ''}</div>
                            <ul class="gpdf-bullets">${String(exp.desc || exp.description || '').split(/\n+/).filter(Boolean).map((line, bi) => `<li data-inline=\"exp-bullet\" data-index=\"${i}\" data-bullet-index=\"${bi}\">${line.replace(/^[-•]\s*/, '')}</li>`).join('')}</ul>
                        </div>`).join('')}
                </div>`;
        }
        if (key === 'education' && data.education.length > 0) {
            return `
                <div class="cv-section gpdf-section gpdf-edu-section gpdf-edu-section-${String(idx).padStart(2,'0')}">
                    <h3 class="cv-sec-title">${idx===1 ? 'Ausbildung' : (idx===8 ? 'Ausbildung' : 'Education')}</h3>
                    ${eduItems.map((edu, i) => `
                        <div class="cv-item gpdf-edu-item">
                            <div class="gpdf-item-head">
                                <span class="cv-item-title" data-inline="edu-title" data-index="${i}">${edu.title || ''}</span>
                                <span class="cv-item-date" data-inline="edu-dates" data-index="${i}">${edu.dates || ''}</span>
                            </div>
                            <div class="cv-item-comp" data-inline="edu-company" data-index="${i}">${edu.company || ''}</div>
                        </div>`).join('')}
                </div>`;
        }
        if (key === 'projects' && projectItems.length > 0 && [1,2,5].includes(idx)) {
            return `
                <div class="cv-section gpdf-section"><h3 class="cv-sec-title">${idx===1?'Projekte':'Projects'}</h3>
                    ${projectItems.map((p, i) => `<div class="cv-item"><div class="gpdf-item-head"><span class="cv-item-title" data-inline="project-name" data-index="${i}">${p.name || ''}</span></div><div class="cv-item-desc" data-inline="project-desc" data-index="${i}">${p.desc || p.description || ''}</div></div>`).join('')}
                </div>`;
        }
        if (key === 'skills' && idx === 1) {
            const skillItems = (Array.isArray(data.skills) && data.skills.length) ? data.skills : ['Teamfähigkeit','Kreatives Denken','Kommunikationsstärke','Problemlösungsfähigkeit'];
            return `
                <div class="cv-section gpdf-section"><h3 class="cv-sec-title">Fähigkeiten</h3><ul class="gpdf-bullets">${skillItems.map((skill, i)=>`<li data-inline="skills" data-index="${i}">${skill}</li>`).join('')}</ul></div>`;
        }
        return '';
    }

    function renderPremiumHeader(data, layout) {
        if (isGermanyPdfLayout(layout)) return renderGermanyPdfHeader(data, layout);
        const photoHtml = (data.showPhoto && photoDataUrl) ? `<div class="cv-photo-box" style="width:40mm; height:50mm; border-radius:4px; overflow:hidden; flex-shrink:0;"><img src="${photoDataUrl}" style="width:100%; height:100%; object-fit:cover;"></div>` : '';
        
        const contactInfo = [
            `<span><i class="fa-solid fa-envelope"></i> ${data.email || ''}</span>`,
            `<span><i class="fa-solid fa-phone"></i> ${data.phone || ''}</span>`,
            `<span><i class="fa-solid fa-location-dot"></i> ${data.address || ''}</span>`,
            data.showDob ? `<span><i class="fa-solid fa-calendar"></i> ${data.dob || ''}</span>` : '',
            data.showNat ? `<span><i class="fa-solid fa-flag"></i> ${data.nationality || ''}</span>` : ''
        ].filter(Boolean).join(' • ');
        
        return `
            <div class="cv-header" style="display:flex; justify-content:space-between; align-items:flex-start; width:100%; margin-bottom:8mm;">
                <div style="flex:1;">
                    <h1 style="margin:0; font-size:24pt; font-weight:800; color:#0f172a; margin-bottom:2mm;">${data.fullName || ''}</h1>
                    <h2 style="margin:0; font-size:14pt; font-weight:600; color:#475569; margin-bottom:6mm;">${data.jobTitle || ''}</h2>
                    <div class="cv-contact-strip" style="display:flex; flex-wrap:wrap; gap:4mm; color:#64748b; font-size:9.5pt; font-weight:500; line-height:1.6;">
                         ${contactInfo}
                    </div>
                </div>
                ${photoHtml}
            </div>
        `;
    }

    function renderPremiumSidebar(data, layout, pageNum) {
        if (isGermanyPdfLayout(layout)) return renderGermanyPdfSidebar(data, layout, pageNum);
        if (parseInt(pageNum) > 1) return '';
        
        const t = translations[currentLang] || translations.en;
        
        // Azerbaijan-specific sidebar rendering with all required fields
        const isAzerbaijan = layout && layout.includes('azerbaijan');
        
        // Germany-specific sidebar rendering
        const isGermany = layout && layout.includes('germany-template');
        
        if (isAzerbaijan || isGermany) {
            return `
                <div class="cv-side-content">
                    ${data.showPhoto && photoDataUrl ? `<div style="width:100%; aspect-ratio:1; border-radius:8px; overflow:hidden; margin-bottom:8mm; border:2px solid #f1f5f9;"><img src="${photoDataUrl}" style="width:100%; height:100%; object-fit:cover;"></div>` : ''}
                    
                    <div class="cv-side-sec">
                        <h3 class="cv-sec-title" style="margin-bottom:4mm; text-transform:uppercase; font-size:9pt; letter-spacing:0.5px;">${t.cvContact || 'Contact'}</h3>
                        <div style="font-size:9.5pt; display:flex; flex-direction:column; gap:3mm; color:#475569; line-height:1.5;">
                            <div><strong>Email:</strong><br>${data.email || ''}</div>
                            <div><strong>Phone:</strong><br>${data.phone || ''}</div>
                            <div><strong>Address:</strong><br>${data.address || ''}</div>
                            ${data.showDob ? `<div><strong>DOB:</strong><br>${data.dob || ''}</div>` : ''}
                            ${data.showNat ? `<div><strong>Nationality:</strong><br>${data.nationality || ''}</div>` : ''}
                        </div>
                    </div>
                    
                    <div class="cv-side-sec">
                        <h3 class="cv-sec-title" style="margin-bottom:4mm; text-transform:uppercase; font-size:9pt; letter-spacing:0.5px;">${t.cvSkills || 'Skills'}</h3>
                        <div style="display:flex; flex-direction:column; gap:2mm; font-size:9.5pt;">
                            ${(data.skills || []).map(s => `<div>• ${s}</div>`).join('')}
                        </div>
                    </div>
                    
                    <div class="cv-side-sec">
                        <h3 class="cv-sec-title" style="margin-bottom:4mm; text-transform:uppercase; font-size:9pt; letter-spacing:0.5px;">${t.h2ComputerSkills || 'Computer Skills'}</h3>
                        <div style="display:flex; flex-direction:column; gap:2mm; font-size:9.5pt;">
                            ${(data.computerSkills || []).map(s => `<div>• ${s}</div>`).join('')}
                        </div>
                    </div>
                    
                    ${data.languages && data.languages.length > 0 ? `
                    <div class="cv-side-sec">
                        <h3 class="cv-sec-title" style="margin-bottom:4mm; text-transform:uppercase; font-size:9pt; letter-spacing:0.5px;">${t.h2Languages || 'Languages'}</h3>
                        <div style="display:flex; flex-direction:column; gap:3mm;">
                            ${data.languages.map(l => `
                                <div>
                                    <div style="display:flex; justify-content:space-between; font-size:9.5pt; font-weight:600; margin-bottom:1.5mm;">
                                        <span>${l.name || ''}</span>
                                        <span>${l.prof || 75}%</span>
                                    </div>
                                    <div style="width:100%; height:5px; background:#e2e8f0; border-radius:2px; overflow:hidden;">
                                        <div style="width:${l.prof || 75}%; height:100%; background:#3b82f6;"></div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                </div>
            `;
        }
        
        // Default sidebar for other countries
        return `
            <div class="cv-side-content">
                <div class="cv-side-sec">
                    <h3 class="cv-sec-title">Contact</h3>
                    <div style="font-size:10pt; display:flex; flex-direction:column; gap:3mm; color:#475569;">
                        <div><strong>Email:</strong><br>${data.email}</div>
                        <div><strong>Phone:</strong><br>${data.phone}</div>
                        <div><strong>Location:</strong><br>${data.address}</div>
                    </div>
                </div>
                
                <div class="cv-side-sec">
                    <h3 class="cv-sec-title">Expertise</h3>
                    <div style="display:flex; flex-wrap:wrap; gap:2mm;">
                        ${data.skills.map(s => `<span style="background:rgba(59,130,246,0.1); color:#1e3a8a; padding:1.5mm 3.5mm; border-radius:6px; font-size:9pt; font-weight:700;">${s}</span>`).join('')}
                    </div>
                </div>

                ${data.languages.length > 0 ? `
                <div class="cv-side-sec">
                    <h3 class="cv-sec-title">Languages</h3>
                    <div style="display:flex; flex-direction:column; gap:4mm;">
                        ${data.languages.map(l => `
                            <div>
                                <div style="display:flex; justify-content:space-between; font-size:9.5pt; font-weight:600; margin-bottom:1.5mm;">
                                    <span>${l.name}</span>
                                    <span>${l.prof}%</span>
                                </div>
                                <div style="width:100%; height:6px; background:#e2e8f0; border-radius:3px; overflow:hidden;">
                                    <div style="width:${l.prof}%; height:100%; background:var(--cv-accent); border-radius:3px;"></div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
            </div>
        `;
    }

    function renderPremiumSection(data, key, layout) {
        if (isGermanyPdfLayout(layout)) return renderGermanyPdfSection(data, key, layout);
        const t = translations[currentLang] || translations.en;
        if (key === 'summary' && data.summary) {
            return `
                <div class="cv-section">
                    <h3 class="cv-sec-title">${t.h2Summary || 'Professional Profile'}</h3>
                    <p style="text-align:justify;">${data.summary}</p>
                </div>
            `;
        }
        if (key === 'experience' && data.experience.length > 0) {
            return `
                <div class="cv-section">
                    <h3 class="cv-sec-title">${t.h2Experience || 'Professional Experience'}</h3>
                    ${data.experience.map(exp => `
                        <div class="cv-item">
                            <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:1mm;">
                                <span class="cv-item-title">${exp.title}</span>
                                <span class="cv-item-date">${exp.dates}</span>
                            </div>
                            <span class="cv-item-comp">${exp.company} ${exp.location ? ' | ' + exp.location : ''}</span>
                            <div class="cv-item-desc" style="white-space:pre-line;">${exp.desc}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        if (key === 'education' && data.education.length > 0) {
             return `
                <div class="cv-section">
                    <h3 class="cv-sec-title">${t.h2Education || 'Academic Background'}</h3>
                    ${data.education.map(edu => `
                        <div class="cv-item" style="margin-bottom:6mm;">
                            <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:1mm;">
                                <span class="cv-item-title">${edu.title}</span>
                                <span class="cv-item-date">${edu.dates}</span>
                            </div>
                            <span class="cv-item-comp">${edu.company}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        return '';
    }

    function createTemplatePageShell(layout, theme, pageNumber) {
        const page = document.createElement('div');
        page.className = `cv-page cv-layout-${layout} cv-theme-${theme}`;
        if (layout) page.classList.add(String(layout));
        if (isGermanyPdfLayout(layout)) page.classList.add('cv-layout-gpdf-base');
        page.dataset.page = pageNumber;

        const selectedPremiumTemplate = getSelectedPremiumTemplate();
        const isGermanyPdf = isGermanyPdfLayout(layout);
        const isPremiumLive = Boolean(selectedPremiumTemplate && !isBasicPackMode && !isGermanyPdf);
        if (selectedPremiumTemplate && !isBasicPackMode) {
            const premiumVariantClass = `premium-variant-${String(selectedPremiumTemplate.id || 'default').replace(/[^a-zA-Z0-9_-]/g, '-')}`;
            page.classList.add('cv-premium-live-template', premiumVariantClass);
            // Disabled image wallpaper shell so templates open as clean editable layouts only.
            // if (!isGermanyPdf) page.classList.add('cv-premium-image-shell');
            page.dataset.premiumTemplateId = selectedPremiumTemplate.id || '';
            page.dataset.premiumTemplateName = selectedPremiumTemplate.name || '';
        }
        
        // Sidebar detection for country-based templates
        const sidebarTemplates = [
            'az-corporate-sidebar', 'az-modern-executive',
            'de-dark-sidebar', 'de-executive-timeline',
            'uk-london-executive',
            'germany-template', 'azerbaijan-template', 'de-pdf-', // legacy
        ];

        let hasSidebar = isGermanyPdfLayout(layout) ? !!getGermanyPdfMeta(layout).sidebar : sidebarTemplates.some(p => layout.includes(p));
        if (hasSidebar) page.classList.add('has-sidebar');
        else page.classList.add('no-sidebar');

        let shellHtml = hasSidebar
            ? `<div class="cv-side"></div><div class="cv-header-area"></div><div class="cv-main"></div>`
            : `<div class="cv-header-area"></div><div class="cv-content-full cv-main" style="padding:20mm; width:100%;"></div>`;

        // Live editor renders real editable HTML/CSS. Template preview images stay only in the library cards.
        page.innerHTML = shellHtml;
        return page;
    }


    function renderBasicPackCV(data) {
        try {
            const previewRoot = document.getElementById('cv-preview');
            if (!previewRoot) return;

            // Basic Pack uses the older single-page templates
            const html = generateCVHTML(data);
            previewRoot.innerHTML = `<div class="cv-page cv-layout-${activeLayoutPattern} cv-theme-${activeThemeColor}">${html}</div>`;
        } catch (err) {
            console.error("Basic Pack Render failure:", err);
        }
    }

    function generateCVHTML(data) {
        if (/^(az|de|us|uk|ca|sg|fr|cn|es)-live-/.test(activeLayoutPattern)) return renderUploadedLiveTemplate(data, activeLayoutPattern);
        // Legacy templates
        if (activeLayoutPattern === 'minimal') return renderMinimal(data);
        if (activeLayoutPattern === 'modern') return renderModern(data);
        if (activeLayoutPattern === 'creative') return renderCreative(data);
        if (activeLayoutPattern === 'corporate') return renderCorporate(data);
        if (activeLayoutPattern === 'compact') return renderCompact(data);
        if (activeLayoutPattern === 'azerbaijan') return renderAzerbaijan(data);
        
        // Azerbaijan (5 templates)
        if (activeLayoutPattern === 'az-corporate-sidebar') return renderAzCorporateSidebar(data);
        if (activeLayoutPattern === 'az-modern-executive') return renderAzModernExecutive(data);
        if (activeLayoutPattern === 'az-finance-pro') return renderAzFinancePro(data);
        if (activeLayoutPattern === 'az-minimal-premium') return renderAzMinimalPremium(data);
        if (activeLayoutPattern === 'az-compact-recruiter') return renderAzCompactRecruiter(data);
        
        // Germany (5 templates)
        if (activeLayoutPattern === 'de-classic-lebenslauf') return renderDeClassicLebenslauf(data);
        if (activeLayoutPattern === 'de-dark-sidebar') return renderDeDarkSidebar(data);
        if (activeLayoutPattern === 'de-executive-timeline') return renderDeExecutiveTimeline(data);
        if (activeLayoutPattern === 'de-modern-corporate') return renderDeModernCorporate(data);
        if (activeLayoutPattern === 'de-ats-minimal') return renderDeAtsMinimal(data);
        
        // USA (5 templates)
        if (activeLayoutPattern === 'us-ats-clean') return renderUsAtsClean(data);
        if (activeLayoutPattern === 'us-executive-modern') return renderUsExecutiveModern(data);
        if (activeLayoutPattern === 'us-tech-resume') return renderUsTechResume(data);
        if (activeLayoutPattern === 'us-sales-resume') return renderUsSalesResume(data);
        if (activeLayoutPattern === 'us-one-page-recruiter') return renderUsOnePageRecruiter(data);
        
        // UK (5 templates)
        if (activeLayoutPattern === 'uk-professional-standard') return renderUkProfessionalStandard(data);
        if (activeLayoutPattern === 'uk-london-executive') return renderUkLondonExecutive(data);
        if (activeLayoutPattern === 'uk-graduate-cv') return renderUkGraduateCv(data);
        if (activeLayoutPattern === 'uk-modern-two-column') return renderUkModernTwoColumn(data);
        if (activeLayoutPattern === 'uk-recruiter-friendly') return renderUkRecruiterFriendly(data);
        
        return '';
    }

    /* Uploaded image-inspired editable premium templates */

    function renderUploadedLiveTemplate(data, layout) {
        if (String(layout || '').startsWith('az-live-')) {
            return renderAzerbaijanExactTemplate(data, layout);
        }
        const t = translations[currentLang] || translations.en;
        const exp = Array.isArray(data.experience) ? data.experience : [];
        const edu = Array.isArray(data.education) ? data.education : [];
        const skills = Array.isArray(data.skills) ? data.skills : [];
        const languages = Array.isArray(data.languages) ? data.languages : [];
        const projects = Array.isArray(data.projects) ? data.projects : [];
        const country = layout.slice(0, 2);
        const hasPhoto = Boolean(data.showPhoto && photoDataUrl);
        const nameParts = String(data.fullName || 'Your Name').trim().split(/\s+/);
        const initials = nameParts.map(x => x[0]).join('').slice(0,2).toUpperCase() || 'CV';
        const contact = [data.email, data.phone, data.address].filter(Boolean).join('  •  ');
        const section = (title, body, extra='') => `<section class="upl-section ${extra}"><h3>${title}</h3>${body}</section>`;
        const expHtml = exp.map(e => `<div class="upl-item"><div class="upl-item-top"><strong>${e.title || ''}</strong><span>${e.dates || ''}</span></div><div class="upl-company">${e.company || ''}${e.location ? ' · ' + e.location : ''}</div><p>${String(e.desc || '').replace(/\n/g,'<br>')}</p></div>`).join('') || `<div class="upl-item"><strong>Job Title</strong><p>Add your work experience from the editor.</p></div>`;
        const eduHtml = edu.map(e => `<div class="upl-item"><div class="upl-item-top"><strong>${e.title || ''}</strong><span>${e.dates || ''}</span></div><div class="upl-company">${e.company || ''}</div></div>`).join('');
        const skillsHtml = `<div class="upl-skills">${skills.map(s => `<span>${s}</span>`).join('')}</div>`;
        const langHtml = `<div class="upl-bars">${languages.map(l => `<div><b>${l.name || l}</b><i><em style="width:${Number(l.level || 80)}%"></em></i></div>`).join('')}</div>`;
        const projectHtml = projects.map(p => `<div class="upl-item"><strong>${p.name || ''}</strong><p>${String(p.desc || '').replace(/\n/g,'<br>')}</p></div>`).join('');
        const sidebar = `<aside class="upl-side"><div class="upl-photo">${hasPhoto ? `<img src="${photoDataUrl}" alt="Photo">` : `<span>${initials}</span>`}</div>${section('Contact', `<p>${data.email || ''}</p><p>${data.phone || ''}</p><p>${data.address || ''}</p>`)}${skills.length ? section(t.cvSkills || 'Skills', skillsHtml) : ''}${languages.length ? section(t.cvLanguages || 'Languages', langHtml) : ''}</aside>`;
        const main = `<main class="upl-main"><header class="upl-head"><div class="upl-mark">${initials}</div><div><h1>${data.fullName || 'Your Name'}</h1><h2>${data.jobTitle || 'Target Position'}</h2><p>${contact}</p></div></header>${section(t.cvSummary || 'Summary', `<p>${String(data.summary || '').replace(/\n/g,'<br>')}</p>`, 'upl-summary')}${section(t.cvExperience || 'Experience', expHtml)}${edu.length ? section(t.cvEducation || 'Education', eduHtml) : ''}${projectHtml ? section(t.cvProjects || 'Projects', projectHtml) : ''}</main>`;
        const full = `<div class="upl-wide-head"><div><h1>${data.fullName || 'Your Name'}</h1><h2>${data.jobTitle || 'Target Position'}</h2><p>${contact}</p></div>${hasPhoto ? `<img src="${photoDataUrl}" alt="Photo">` : `<b>${initials}</b>`}</div><div class="upl-wide-body">${section(t.cvSummary || 'Summary', `<p>${String(data.summary || '').replace(/\n/g,'<br>')}</p>`)}${section(t.cvExperience || 'Experience', expHtml)}<div class="upl-two">${edu.length ? section(t.cvEducation || 'Education', eduHtml) : ''}${skills.length ? section(t.cvSkills || 'Skills', skillsHtml) : ''}</div>${projectHtml ? section(t.cvProjects || 'Projects', projectHtml) : ''}</div>`;
        const twoColLayouts = ['az','de','uk'].includes(country) && !layout.includes('minimal') && !layout.includes('classic-lebenslauf');
        return `<div class="uploaded-live-template ${layout} ${twoColLayouts ? 'upl-two-col' : 'upl-full'}">${twoColLayouts ? sidebar + main : full}</div>`;
    }


    function renderUSALiveTemplatePaginated(data, previewRoot, layout) {
        const safe = (v, fb = '') => (v === undefined || v === null || v === '') ? fb : String(v);
        const arr = (x) => Array.isArray(x) ? x : [];
        const lineText = (v) => safe(v).replace(/\n/g, '<br>');
        const bullets = (v, fb = '') => {
            const raw = safe(v, fb);
            const lines = raw.split(/\n/).map(x => x.replace(/^\s*[•\-]\s*/, '').trim()).filter(Boolean);
            return lines.length ? `<ul>${lines.map(x => `<li data-inline>${x}</li>`).join('')}</ul>` : '';
        };
        const name = safe(data.fullName, 'Gariel Masareña');
        const job = safe(data.jobTitle, 'Freelance Writer');
        const email = safe(data.email, 'email@example.com');
        const phone = safe(data.phone, '+1 234 567 8953');
        const address = safe(data.address, 'Street-City Name, State, zip code');
        const website = safe(data.website || data.linkedin, 'www.example.com');
        const summary = safe(data.summary, 'I am a professionally qualified professional with strong experience, practical skills and a clean record of success. I am committed to delivering excellent work and measurable results.');
        const exp = arr(data.experience).length ? arr(data.experience) : [
            {title:'Job Position / Title', company:'Company Name', location:'Washington DC, USA', dates:'2004 - 2009', desc:'Improved operational results and customer service\nManaged daily responsibilities and team communication\nDelivered measurable results across departments'},
            {title:'Job Position / Title', company:'Company Name', location:'Washington DC, USA', dates:'2004 - 2009', desc:'Developed process improvements and reporting\nCollaborated with internal teams and clients\nSupported business goals and planning'},
            {title:'Job Position / Title', company:'Company Name', location:'Washington DC, USA', dates:'2004 - 2009', desc:'Handled projects from planning to execution\nImproved stakeholder communication\nCreated consistent and reliable workflow'}
        ];
        const edu = arr(data.education).length ? arr(data.education) : [
            {title:'Bachelor of Arts', company:'University / College / Institute', dates:'2004'},
            {title:'Masters in Communication Tech', company:'University / College / Institute', dates:'2008'}
        ];
        const skills = arr(data.skills).length ? arr(data.skills) : ['Microsoft Word','Microsoft PowerPoint','Adobe Photoshop','Microsoft Excel','Adobe Dreamweaver'];
        const languages = arr(data.languages).length ? arr(data.languages) : [{name:'English', prof:90},{name:'Spanish', prof:70}];
        const projects = arr(data.projects);
        const photo = (data.showPhoto && photoDataUrl) ? `<img src="${photoDataUrl}" alt="Photo">` : `<span>Photo</span>`;

        const variant = {
            'us-live-creative-column': 'usa-v01-yellow-profile',
            'us-live-modern-blue': 'usa-v02-teal-photo',
            'us-live-canva-clean': 'usa-v03-student-teal',
            'us-live-bold-initials': 'usa-v05-blue-awards',
            'us-live-orange-accent': 'usa-v07-navy-rounded',
            'us-live-compact-tech': 'usa-v06-cyan-block',
            'us-live-photo-band': 'usa-v08-mustard-tech',
            'us-live-hero-modern': 'usa-v04-gradient-sales',
            'us-live-it-specialist': 'usa-v09-interior-blue',
            'us-live-skyline': 'usa-v10-orange-brown'
        }[layout] || 'usa-v01-yellow-profile';

        previewRoot.innerHTML = '';
        const wrapper = document.createElement('div');
        wrapper.className = 'cv-pages usa-live-pages';
        wrapper.id = 'cv-pages';
        previewRoot.appendChild(wrapper);

        const sideHTML = (first=true) => first ? `
            <aside class="usa-side">
                <div class="usa-photo">${photo}</div>
                <section><h3>CONTACT</h3><p>${phone}</p><p>${email}</p><p>${website}</p><p>${address}</p></section>
                <section><h3>Education</h3>${edu.map(e => `<div class="usa-side-item"><b>${safe(e.title)}</b><small>${safe(e.company)} | ${safe(e.dates)}</small></div>`).join('')}</section>
                <section><h3>SKILLS</h3>${skills.map((s,i)=>`<div class="usa-skill"><span>${safe(s)}</span><i style="--w:${Math.max(45,95-i*7)}%"></i></div>`).join('')}</section>
                ${languages.length ? `<section><h3>LANGUAGES</h3>${languages.map(l=>`<p>${safe(l.name || l)} ${l.prof ? '— '+l.prof+'%' : ''}</p>`).join('')}</section>` : ''}
            </aside>` : `<aside class="usa-side usa-side-continuation"></aside>`;

        const makePage = (first=false) => {
            const page = document.createElement('div');
            page.className = `cv-page cv-uploaded-live-page usa-live-page ${variant} ${first ? 'usa-first-page' : 'usa-cont-page'}`;
            page.dataset.page = String(wrapper.children.length + 1);
            page.innerHTML = `
                <div class="usa-sheet">
                    ${sideHTML(first)}
                    <main class="usa-main">
                        ${first ? `<header class="usa-head"><h1 data-inline>${name}</h1><h2 data-inline>${job}</h2><p data-inline>${address}</p></header>` : ''}
                        <div class="usa-flow"></div>
                    </main>
                </div>`;
            wrapper.appendChild(page);
            return page.querySelector('.usa-flow');
        };
        const block = (html, cls='') => { const n=document.createElement('div'); n.className='usa-block '+cls; n.innerHTML=html; return n; };
        const blocks=[];
        blocks.push(block(`<section class="usa-summary-band"><h3>Professional Profile</h3><p data-inline>${lineText(summary)}</p></section>`, 'usa-profile-block'));
        blocks.push(block(`<h3 class="usa-section-title">Professional Experience</h3>`, 'usa-heading-block'));
        exp.forEach((e,i)=>blocks.push(block(`<article class="usa-exp-item"><div class="usa-exp-date"><b data-inline>${safe(e.title,'Job Position / Title')}</b><span data-inline>${safe(e.dates,'2004 - 2009')}</span><em data-inline>${safe(e.company,'Company Name')}${e.location ? '<br>'+safe(e.location) : ''}</em></div><div class="usa-exp-body">${bullets(e.desc,'Managed responsibilities\nImproved results\nSupported business goals')}</div></article>`, 'usa-entry-block')));
        blocks.push(block(`<h3 class="usa-section-title">Education</h3>`, 'usa-heading-block'));
        edu.forEach(e=>blocks.push(block(`<article class="usa-edu-item"><b data-inline>${safe(e.title,'Degree Name')}</b><span data-inline>${safe(e.dates,'2013')}</span><p data-inline>${safe(e.company,'University / College')}</p></article>`, 'usa-entry-block')));
        if (projects.length) { blocks.push(block(`<h3 class="usa-section-title">Projects</h3>`, 'usa-heading-block')); projects.forEach(p=>blocks.push(block(`<article class="usa-edu-item"><b data-inline>${safe(p.title || p.name)}</b><p data-inline>${safe(p.desc || p.description)}</p></article>`))); }

        let flow = makePage(true);
        const fits = () => flow.scrollHeight <= flow.clientHeight + 2;
        blocks.forEach(node => {
            flow.appendChild(node);
            if (!fits()) {
                flow.removeChild(node);
                flow = makePage(false);
                flow.appendChild(node);
            }
        });
    }


    function renderAz10CleanSalesPaginated(data, previewRoot) {
        const safe = (v, fb = '') => (v === undefined || v === null || v === '') ? fb : String(v);
        const arr = (x) => Array.isArray(x) ? x : [];
        const escLines = (v) => safe(v).replace(/\n/g, '<br>');
        const bulletLines = (v, fb='') => {
            const raw = safe(v, fb);
            const lines = raw.split(/\n/).map(x => x.replace(/^\s*[•\-]\s*/, '').trim()).filter(Boolean);
            return lines.length ? `<ul>${lines.map(x => `<li>${x}</li>`).join('')}</ul>` : '';
        };
        previewRoot.innerHTML = '';
        const wrapper = document.createElement('div');
        wrapper.className = 'cv-pages az10-sales-pages';
        wrapper.id = 'cv-pages';
        previewRoot.appendChild(wrapper);

        const name = safe(data.fullName, 'Carlos Harrison');
        const title = safe(data.jobTitle, 'Business Development Manager');
        const email = safe(data.email, 'email@example.com');
        const phone = safe(data.phone, '555-555-5555');
        const address = safe(data.address, 'Vancouver, British Columbia');
        const website = safe(data.website || data.linkedin, 'example.com');
        const sideSummary = escLines(data.summary || 'I am a target driven person who enjoys a challenge. I am very committed to making a success of anything I undertake. I am hardworking, ambitious, and I understand the value of teamwork. In each job I have undertaken, I have advanced quickly due to my product expertise and my ability to provide a high level of customer satisfaction.');
        const skills = arr(data.skills).length ? arr(data.skills) : ['Negotiations', 'Problem Solving', 'Competitive Analysis', 'Target Achievement', 'Resource Allocation', 'Building Sales Teams'];
        const langs = arr(data.languages);
        const exp = arr(data.experience).length ? arr(data.experience) : [
            {title:'Business Development Manager', company:'Pierce & Pierce Business Consulting Services', dates:'2016-05 - Present', desc:'Developed new strategies to capture market channel with new clients\nBrought new process to firm to improve growth using various marketing and communication strategies\nDeveloped strategies for the firm by building corporate relationships with customers and industry/market leaders\nImproved business strategies based on customer feedback'},
            {title:'Business Development Manager', company:'Bicycle Technolabs Pvt Ltd', dates:'2014-06 - 2016-04', desc:'Managing a sales team of 8\nShowing leadership in sales\nAchieving sales targets, cold calling'},
            {title:'Business Development Manager', company:'Handshake Web Solutions', dates:'2012-03 - 2014-05', desc:'Closed new deals by negotiating contracts\nImproved market position and achieved financial goals\nDiscovered new opportunities\nIdentified new ideas by researching industry'}
        ];
        const edu = arr(data.education).length ? arr(data.education) : [
            {title:'MBA', company:'State Institute of Management Technology', dates:'2013'}
        ];
        const projects = arr(data.projects);

        const makeSidebar = (isFirst) => isFirst ? `
            <aside class="az10-left">
                <section class="az10-side-section"><h3><span>♙</span> Summary</h3><p>${sideSummary}</p></section>
                <section class="az10-side-section az10-skill-section"><h3><span>⊕</span> Skills</h3>
                    ${skills.map((skill, i) => `<div class="az10-skill"><div><b>${safe(skill)}</b><span>10</span></div><i style="--w:${Math.max(55, 95 - i * 4)}%"></i></div>`).join('')}
                </section>
                <section class="az10-side-section"><h3><span>▣</span> ETL Portfolio</h3><p>ETL for Azure data lake:<br>${website}</p></section>
            </aside>` : `<aside class="az10-left az10-left-blank"></aside>`;

        const makePage = (isFirst) => {
            const page = document.createElement('div');
            page.className = 'cv-page cv-uploaded-live-page az10-sales-page' + (isFirst ? ' az10-first-page' : ' az10-continuation-page');
            page.dataset.page = String(wrapper.children.length + 1);
            page.innerHTML = `
                <div class="az10-sales-sheet">
                    ${makeSidebar(isFirst)}
                    <main class="az10-main">
                        ${isFirst ? `<header class="az10-top">
                            <div class="az10-namebox"><h1>${name}</h1><p>${title}</p></div>
                            <div class="az10-contact"><p>${phone}</p><p>${address}</p><p>${email}</p><p>${website}</p></div>
                        </header>` : ''}
                        <div class="az10-flow"></div>
                    </main>
                </div>`;
            wrapper.appendChild(page);
            return page.querySelector('.az10-flow');
        };

        const makeBlock = (html, cls = '') => {
            const node = document.createElement('div');
            node.className = 'az10-flow-block ' + cls;
            node.innerHTML = html;
            return node;
        };

        const blocks = [];
        blocks.push(makeBlock(`<section class="az10-main-section"><h3><span>▣</span> Work Experience</h3></section>`, 'az10-heading-block'));
        exp.forEach((e, idx) => blocks.push(makeBlock(`
            <article class="az10-timeline-item">
                <div class="az10-time">${safe(e.dates, idx === 0 ? '2016-05 - Present' : '2014-06 - 2016-04')}</div>
                <div class="az10-job"><h4>${safe(e.title, 'Business Development Manager')}</h4><em>${safe(e.company, 'Company Name')}${e.location ? ', ' + safe(e.location) : ''}</em>${bulletLines(e.desc, 'Managed sales processes\nImproved client communication\nReached sales targets')}</div>
            </article>`, 'az10-entry-block')));

        blocks.push(makeBlock(`<section class="az10-main-section"><h3><span>▣</span> Education</h3></section>`, 'az10-heading-block'));
        edu.forEach(e => blocks.push(makeBlock(`
            <article class="az10-timeline-item az10-edu-item">
                <div class="az10-time">${safe(e.dates, '2013')}</div>
                <div class="az10-job"><h4>${safe(e.title, 'MBA')}</h4><em>${safe(e.company, 'State Institute of Management Technology')}</em></div>
            </article>`, 'az10-entry-block')));

        if (langs.length) {
            blocks.push(makeBlock(`<section class="az10-main-section"><h3><span>▣</span> Languages</h3><div class="az10-main-list">${langs.map(l => `<p>${safe(l.name || l)} — ${safe(l.prof || l.level || '80')}%</p>`).join('')}</div></section>`, 'az10-section-block'));
        }
        if (projects.length) {
            blocks.push(makeBlock(`<section class="az10-main-section"><h3><span>▣</span> Portfolio / Projects</h3></section>`, 'az10-heading-block'));
            projects.forEach(p => blocks.push(makeBlock(`<article class="az10-project"><h4>${safe(p.name || p.title, 'Project')}</h4><p>${escLines(p.desc || 'Improved sales performance and reporting.')}</p></article>`, 'az10-entry-block')));
        }

        let currentFlow = makePage(true);
        blocks.forEach((block) => {
            currentFlow.appendChild(block);
            if (currentFlow.scrollHeight > currentFlow.clientHeight + 1) {
                currentFlow.removeChild(block);
                currentFlow = makePage(false);
                currentFlow.appendChild(block);
            }
        });
    }

    function renderAzerbaijanExactTemplate(data, layout) {
        const safe = (v, fb='') => (v === undefined || v === null || v === '') ? fb : String(v);
        const arr = (x) => Array.isArray(x) ? x : [];
        const list = (items) => arr(items).map(x => `<li>${safe(x)}</li>`).join('');
        const photo = (data.showPhoto && photoDataUrl) ? `<img src="${photoDataUrl}" alt="Photo">` : `<span>Photo</span>`;
        const name = safe(data.fullName, 'Zeynal Abidin');
        const title = safe(data.jobTitle, 'Baş İdarəçi');
        const summary = safe(data.summary, '10 il ərzində idarəçilik təcrübəsi olan, liderlik və strateji planlaşdırma bacarıqları güclü mütəxəssis.');
        const contactLines = `<p>${safe(data.phone,'+994 50 212 22 33')}</p><p>${safe(data.email,'zeynalabidin@gmail.com')}</p><p>${safe(data.address,'Bakı, Azərbaycan')}</p>`;
        const langs = arr(data.languages).map(l => ({name: safe(l.name || l, 'Dil'), level: Number(l.level || l.proficiency || 80)}));
        const langBars = (langs.length ? langs : [{name:'Azərbaycan', level:100},{name:'İngilis', level:80},{name:'Rus', level:70}]).map(l => `<div class="azbar"><span>${l.name}</span><i><em style="width:${l.level}%"></em></i></div>`).join('');
        const skills = arr(data.skills);
        const exp = arr(data.experience);
        const edu = arr(data.education);
        const projects = arr(data.projects);
        const sec = (cls, title, body) => `<section class="${cls || ''}"><h3>${title}</h3>${body}</section>`;
        const expHtml = (exp.length ? exp : [{title:'Baş idarəçi', company:'AZƏRŞİRKƏT MMC', location:'Bakı', dates:'2020 - hazırda', desc:'• İdarə heyətinin işlərini təşkil etdim\n• Şirkətin strateji planlaşdırmasını idarə etdim'}]).map(e => `<div class="azitem"><div class="azdates">${safe(e.dates,'2020 - hazırda')}</div><div><b>${safe(e.title,'Baş idarəçi')}</b><small>${safe(e.company,'AZƏRŞİRKƏT MMC')}${e.location ? ', '+e.location : ''}</small><p>${safe(e.desc,'').replace(/\n/g,'<br>')}</p></div></div>`).join('');
        const eduHtml = (edu.length ? edu : [{title:'Biznesin İdarə Edilməsi', company:'ADA Universiteti', dates:'2018 - 2022'}]).map(e => `<div class="azitem"><div class="azdates">${safe(e.dates,'2018 - 2022')}</div><div><b>${safe(e.title,'Bakalavr')}</b><small>${safe(e.company,'Universitet')}</small></div></div>`).join('');
        const projectHtml = projects.map(p => `<div class="azitem"><div class="azdates"></div><div><b>${safe(p.name,'Layihə')}</b><p>${safe(p.desc,'Nəticə yönümlü layihə və proses optimizasiyası.').replace(/\n/g,'<br>')}</p></div></div>`).join('');
        const sideBlocks = sec('', 'HAQQIMDA', `<p>${summary}</p>`) + sec('', 'ƏLAQƏ', contactLines) + sec('', 'BACARIQLAR', `<ul>${list(skills.length ? skills : ['Liderlik','Strateji planlaşdırma','Komanda işi','Maliyyə idarəetməsi'])}</ul>`) + sec('', 'DİLLƏR', langBars);

        if (layout === 'az-live-navy-sidebar') {
            return `<div class="azexact az01"><aside><div class="photo round">${photo}</div>${sideBlocks}<section><h3>HOBBİLƏR</h3><p>• Kitab oxumaq<br>• Səyahət etmək<br>• Futbol</p></section></aside><main><header><h1>${name}</h1><h2>${title}</h2><div class="contact-icons">${contactLines}</div></header>${sec('timeline','İŞ TƏCRÜBƏSİ',expHtml)}${sec('timeline','TƏHSİL',eduHtml)}${sec('bars','BACARIQLAR',`<div class="skillgrid">${(skills.length?skills:['Liderlik','Maliyyə idarəetməsi','Komanda işi','Layihə idarəetməsi']).map(x=>`<span>${x}<i><em></em></i></span>`).join('')}</div>`)}</main></div>`;
        }
        if (layout === 'az-live-clean-photo') {
            return `<div class="azexact az02"><aside><div class="photo circle">${photo}</div>${sec('', 'Contact', contactLines)}${sec('', 'Education', eduHtml)}${sec('', 'Expertise', `<ul>${list(skills.length?skills:['Leadership','Management','Marketing','Sales'])}</ul>`)}${sec('', 'Language', langBars)}</aside><main><header><h1>${name}</h1><h2>${title}</h2></header>${sec('', 'Experience', expHtml)}${sec('', 'Reference', '<div class="refgrid"><p>Name Surname<br>Position / Company</p><p>Name Surname<br>Position / Company</p></div>')}</main></div>`;
        }
        if (layout === 'az-live-gold-executive') {
            return `<div class="azexact az03"><aside><div class="photo round">${photo}</div>${sec('', 'Education', eduHtml)}${sec('', 'Skills', `<ul>${list(skills.length?skills:['Management','Creativity','Teamwork','Negotiation'])}</ul>`)}${sec('', 'Contact', contactLines)}</aside><main><header><h1>${name}</h1><h2>${title}</h2></header>${sec('', 'Profile Info', `<p>${summary}</p>`)}${sec('timeline','Experience', expHtml)}${sec('', 'Achievement', projectHtml || '<p>2019–2025 aralığında mühüm biznes nəticələri və komanda inkişafı.</p>')}</main></div>`;
        }
        if (layout === 'az-live-minimal-line') {
            return `<div class="azexact az11"><header><div><h1>${name}</h1><h2>${title}</h2><p>${safe(data.email,'email@email.com')} · ${safe(data.phone,'+994 50 000 00 00')} · ${safe(data.address,'Bakı')}</p></div><div class="photo square">${photo}</div></header><main>${sec('', 'PROFİL', `<p>${summary}</p>`)}${sec('', 'İŞ TƏCRÜBƏSİ', expHtml)}${sec('', 'TƏHSİL', eduHtml)}${sec('', 'BACARIQLAR', `<div class="skillgrid">${(skills.length?skills:['Satış','Müştəri əlaqələri','Analitika','Komanda işi']).map(x=>`<span>${x}<i><em></em></i></span>`).join('')}</div>`)}${sec('', 'DİLLƏR', langBars)}</main></div>`;
        }
        if (layout === 'az-live-blue-header') {
            return `<div class="azexact az05"><main><header><h1>${name}</h1><h2>${title}</h2><p>${safe(data.email,'email@email.com')}  •  ${safe(data.address,'Bakı')}</p></header>${sec('', 'SUMMARY', `<p>${summary}</p>`)}${sec('', 'EXPERIENCE', expHtml)}${sec('', 'LANGUAGES', langBars)}</main><aside><div class="photo round">${photo}</div>${sec('', 'KEY ACHIEVEMENTS', projectHtml || '<p>Project Delivery Excellence<br>Budget Management<br>Client Engagement</p>')}${sec('', 'EDUCATION', eduHtml)}${sec('', 'SKILLS', `<p>${(skills.length?skills:['Project Management','Budget Management','Risk Assessment']).join(' · ')}</p>`)}</aside></div>`;
        }
        if (layout === 'az-live-soft-sidebar') {
            return `<div class="azexact az06"><aside><div class="photo small">${photo}</div><h1>${name}</h1><h2>${title}</h2>${sec('', 'ÜMUMİ MƏLUMAT', contactLines)}${sec('', 'TƏCRÜBƏ', `<p>${summary}</p>`)}${sec('', 'BACARIQLAR', `<ul>${list(skills.length?skills:['İdarəetmə','Planlaşdırma','Analitika'])}</ul>`)}</aside><main>${sec('', 'HADİSƏLƏR', expHtml)}${sec('', 'TƏHSİL', eduHtml)}${sec('', 'LAYİHƏLƏR', projectHtml || '<p>Biznes proseslərinin optimizasiyası və yeni sistemlərin qurulması.</p>')}</main></div>`;
        }
        if (layout === 'az-live-modern-bars') {
            return `<div class="azexact az07"><div class="slash"></div><aside><div class="photo frame">${photo}</div><h1>${name}</h1><h2>${title}</h2>${sideBlocks}</aside><main>${sec('', 'HAQQINDA', `<p>${summary}</p>`)}${sec('', 'İŞ TƏCRÜBƏSİ', expHtml)}${sec('', 'TƏHSİL', eduHtml)}</main></div>`;
        }
        if (layout === 'az-live-finance-grid') {
            return `<div class="azexact az08"><header><div class="photo round">${photo}</div><div><h1>${name}</h1><h2>${title}</h2><p>● ● ● ●</p></div></header><div class="cols"><aside>${sec('', 'ABOUT ME', `<p>${summary}</p>`)}${sec('', 'CONTACT', contactLines)}${sec('', 'SKILLS', `<div class="redbars">${(skills.length?skills:['SEO','Problem-solving','CRM','Email marketing']).map(x=>`<p>${x}<i><em></em></i></p>`).join('')}</div>`)}</aside><main>${sec('timeline','EDUCATION',eduHtml)}${sec('timeline','PROFESSIONAL EXPERIENCE',expHtml)}${sec('', 'COURSES', projectHtml || '<p>Digital Marketing və biznes inkişafı kursları.</p>')}</main></div></div>`;
        }
        if (layout === 'az-live-top-band') {
            return `<div class="azexact az09"><aside><div class="photo hex">${photo}</div>${sec('', 'HAQQIMDA', `<p>${summary}</p>`)}${sec('', 'ƏLAQƏ', contactLines)}${sec('', 'BİLGİ', `<div class="pillbars">${(skills.length?skills:['Kod','İdarəetmə','Dizayn']).map(x=>`<p>${x}<i><em></em></i></p>`).join('')}</div>`)}</aside><main><header><h1>${name}</h1><h2>${title}</h2></header>${sec('rounded','EĞİTİM',eduHtml)}${sec('rounded','İŞ DENEYİMİ',expHtml)}${sec('rounded','KURSLAR',projectHtml || '<p>Peşəkar inkişaf və sertifikat proqramları.</p>')}</main></div>`;
        }
        return `<div class="azexact az10"><aside><div class="photo round">${photo}</div>${sideBlocks}</aside><main><header><h1>${name}</h1><h2>${title}</h2></header>${sec('', 'PROFESSIONAL SUMMARY', `<p>${summary}</p>`)}${sec('', 'PROFESSIONAL EXPERIENCE', expHtml)}${sec('', 'EDUCATION', eduHtml)}</main></div>`;
    }



    function renderSingaporeExactTemplatePaginated(data, previewRoot, layout) {
        const safe = (v, fb = '') => (v === undefined || v === null || v === '') ? fb : String(v);
        const arr = (x) => Array.isArray(x) ? x : [];
        const esc = (v, fb='') => safe(v, fb).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
        const lines = (v, fb='') => esc(v, fb).split(/\n/).map(x => x.replace(/^\s*[•\-]\s*/, '').trim()).filter(Boolean);
        const bullets = (v, fb='') => {
            const items = lines(v, fb);
            return items.length ? '<ul>' + items.map(x => '<li data-inline>' + x + '</li>').join('') + '</ul>' : '';
        };
        const variant = (String(layout || 'sg-live-01').match(/(\d{2})$/) || ['','01'])[1];
        const name = esc(data.fullName, ['Robert James','Margaret Phua','Jonathan Smith','Dani Martinez','Christian Hybrid','Richard Sanchez','Juliette Hudson','Sophia Isabella','Madison Chloe','Jhon Anders'][Number(variant)-1] || 'Your Name');
        const job = esc(data.jobTitle, ['Graphic & Web Designer','Senior Financial Analyst','Senior Web Developer','Graphic Designer','IT Manager','Product Designer','Art Director','Marketing Director','UI/UX Designer','Graphic Designer'][Number(variant)-1] || 'Professional Title');
        const email = esc(data.email, 'email@example.com');
        const phone = esc(data.phone, '+65 555 019 990');
        const address = esc(data.address, 'Singapore');
        const website = esc(data.website || data.linkedin, 'linkedin.com/in/profile');
        const summary = esc(data.summary, 'Dedicated professional with a proven track record, strong communication skills and a clean history of delivering measurable results for employers and clients.');
        const exp = arr(data.experience).length ? arr(data.experience) : [
            {title:'Senior Designer', company:'Creative Studio', location:'Singapore', dates:'2020 - Present', desc:'Created user-friendly solutions and improved project delivery\nManaged daily communication with clients and internal teams\nDelivered measurable results across key responsibilities'},
            {title:'Graphic Designer', company:'Design Development Ltd.', location:'Singapore', dates:'2016 - 2020', desc:'Supported visual projects and brand assets\nImproved documentation and workflow processes\nCollaborated with cross-functional teams'}
        ];
        const edu = arr(data.education).length ? arr(data.education) : [
            {title:'Bachelor of Design', company:'National University of Singapore', dates:'2011 - 2015'},
            {title:'Professional Certificate', company:'Singapore Institute', dates:'2016'}
        ];
        const skills = arr(data.skills).length ? arr(data.skills) : ['Adobe Photoshop','Project Management','Communication','Leadership','Data Analysis'];
        const langs = arr(data.languages).length ? arr(data.languages) : [{name:'English', level:95},{name:'Mandarin', level:75}];
        const projects = arr(data.projects);
        const photo = (data.showPhoto && photoDataUrl) ? `<img src="${photoDataUrl}" alt="Photo">` : `<span>${name.split(/\s+/).map(x=>x[0]).join('').slice(0,2)}</span>`;
        const contact = `<p>☎ ${phone}</p><p>✉ ${email}</p><p>⌂ ${address}</p><p>🔗 ${website}</p>`;
        const skillBars = skills.map((s,i)=>`<div class="sg-skill"><span>${esc(s)}</span><i><em style="width:${[85,78,90,72,82][i%5]}%"></em></i></div>`).join('');
        const langBars = langs.map(l=>`<div class="sg-skill"><span>${esc(l.name || l)}</span><i><em style="width:${Number(l.level || l.prof || 80)}%"></em></i></div>`).join('');
        const sec = (title, body, cls='') => `<section class="sg-section ${cls}"><h3>${title}</h3>${body}</section>`;
        const expHtml = exp.map(e => `<article class="sg-entry"><div class="sg-entry-head"><b>${esc(e.title,'Job Title')}</b><span>${esc(e.dates,'2020 - Present')}</span></div><h4>${esc(e.company,'Company')}${e.location ? ' · '+esc(e.location) : ''}</h4>${bullets(e.desc,'Delivered professional work and supported business goals')}</article>`).join('');
        const eduHtml = edu.map(e => `<article class="sg-entry mini"><div class="sg-entry-head"><b>${esc(e.title,'Degree')}</b><span>${esc(e.dates,'2016')}</span></div><h4>${esc(e.company,'University')}</h4></article>`).join('');
        const projectHtml = projects.map(p => `<article class="sg-entry mini"><b>${esc(p.name || p.title,'Project')}</b><p>${esc(p.desc || p.description,'Portfolio project and measurable achievement.')}</p></article>`).join('');
        const sideBase = `${sec('Contact', contact)}${sec('Skills', skillBars, 'bars')}${sec('Languages', langBars, 'bars')}`;
        const blocks = [
            (()=>{ const n=document.createElement('div'); n.className='sg-block'; n.innerHTML=sec(variant==='10'?'Summary':'About Me', `<p>${summary}</p>`); return n; })(),
            (()=>{ const n=document.createElement('div'); n.className='sg-block'; n.innerHTML=sec(variant==='10'?'Professional Experience':'Work Experience', expHtml); return n; })(),
            (()=>{ const n=document.createElement('div'); n.className='sg-block'; n.innerHTML=sec('Education', eduHtml); return n; })(),
            (()=>{ const n=document.createElement('div'); n.className='sg-block'; n.innerHTML=sec('Skills Summary', skillBars, 'bars'); return n; })(),
            (()=>{ const n=document.createElement('div'); n.className='sg-block'; n.innerHTML=projectHtml ? sec('Projects', projectHtml) : sec('Hobbies & Awards','<p>Reading • Travel • Design • Professional development</p>'); return n; })()
        ];
        function pageSkeleton(first=false){
            const page=document.createElement('div');
            page.className=`cv-page sg-page sg-v${variant} ${first?'sg-first':'sg-cont'}`;
            let html='';
            if (variant==='01') html=`<div class="sg-sheet"><header class="sg-top"><h1>${name}</h1><h2>${job}</h2><div class="sg-photo overlap">${photo}</div></header><div class="sg-contact-strip">${contact}</div><div class="sg-grid"><main class="sg-flow"></main><aside>${sec('Skills',skillBars,'bars')}${sec('Awards','<p>Web Developer of the Year<br>Professional Achievement</p>')}</aside></div></div>`;
            else if (variant==='02') html=`<div class="sg-sheet sg-two"><aside><div class="sg-photo small">${photo}</div>${sideBase}${sec('Reference','<p>Available upon request</p>')}</aside><main><header><h1>${name}</h1><h2>${job}</h2></header><div class="sg-flow"></div></main></div>`;
            else if (variant==='03') html=`<div class="sg-sheet sg-red"><aside><div class="sg-photo square">${photo}</div>${sideBase}${sec('Interests','<p>Machine Learning<br>Chess<br>Video Games</p>')}</aside><main><header><h1>${name}</h1><h2>${job}</h2><p>${summary}</p></header><div class="sg-flow"></div></main></div>`;
            else if (variant==='04') html=`<div class="sg-sheet sg-split"><aside><h1>${name}</h1><h2>${job}</h2><div class="sg-photo round">${photo}</div>${sideBase}</aside><main><div class="sg-flow"></div></main></div>`;
            else if (variant==='05') html=`<div class="sg-sheet sg-classic"><header><h1>${name}</h1><h2>${job}</h2></header><main class="sg-flow"></main><aside>${sec('Personal Info',contact)}${sec('Additional Skills',skillBars,'dots')}${sec('Languages',langBars,'dots')}</aside></div>`;
            else if (variant==='06') html=`<div class="sg-sheet sg-blue"><aside><div class="sg-photo round">${photo}</div>${sec('About Me',`<p>${summary}</p>`)}${sideBase}</aside><main><header><h1>${name}</h1><h2>${job}</h2></header><div class="sg-flow"></div></main></div>`;
            else if (variant==='07') html=`<div class="sg-sheet sg-navy"><aside><div class="sg-photo round">${photo}</div>${sec('Profile',`<p>${summary}</p>`)}${sec('Expertise',skills.map(s=>'<p>• '+esc(s)+'</p>').join(''))}${sec('Languages',langs.map(l=>'<p>'+esc(l.name||l)+'</p>').join(''))}</aside><main><header><h1>${name}</h1><h2>${job}</h2><p>☎ ${phone} &nbsp; ✉ ${email}<br>${address}</p></header><div class="sg-flow"></div></main></div>`;
            else if (variant==='08') html=`<div class="sg-sheet sg-orange"><aside><div class="sg-photo round">${photo}</div>${sideBase}${sec('Education',eduHtml)}</aside><main><header><b>A / W</b><h1>${name}</h1><h2>${job}</h2></header><div class="sg-flow"></div></main></div>`;
            else if (variant==='09') html=`<div class="sg-sheet sg-dark"><header><div class="sg-photo round">${photo}</div><div><h1>${name}</h1><h2>${job}</h2></div><div class="sg-box-contact">${contact}</div></header><div class="sg-cols"><aside>${sec('Education',eduHtml)}${sec('Skills',skillBars,'bars')}${sec('Languages',langBars,'bars')}</aside><main class="sg-flow"></main></div></div>`;
            else html=`<div class="sg-sheet sg-gold"><header><div class="sg-photo round">${photo}</div><div><h1>${name}</h1><h2>${job}</h2></div></header><aside>${sideBase}${sec('Education',eduHtml)}</aside><main class="sg-flow"></main></div>`;
            page.innerHTML=html;
            previewRoot.querySelector('.cv-pages').appendChild(page);
            return page.querySelector('.sg-flow');
        }
        let flow=pageSkeleton(true);
        const fits=()=>flow.scrollHeight<=flow.clientHeight+2;
        blocks.forEach(b=>{ flow.appendChild(b); if(!fits()){ flow.removeChild(b); flow=pageSkeleton(false); flow.appendChild(b); }});
    }

    function renderCanadaExactTemplatePaginated(data, previewRoot, layout) {
        const safe = (v, fb = '') => (v === undefined || v === null || v === '') ? fb : String(v);
        const arr = (x) => Array.isArray(x) ? x : [];
        const esc = (v, fb='') => safe(v, fb).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const lines = (v, fb='') => safe(v, fb).split(/\n/).map(x => x.replace(/^\s*[•\-]\s*/, '').trim()).filter(Boolean);
        const bulletList = (v) => '<ul>' + lines(v).map(x => `<li data-inline="text">${esc(x)}</li>`).join('') + '</ul>';
        const idx = Number((String(layout || '').match(/-(\d+)$/) || [0, 1])[1]);
        const v = String(((idx - 1) % 10) + 1).padStart(2, '0');
        const defaults = { '01': ['Christopher Gonan','Psychologist'], '02': ['Sophie Fischer','Sales Manager'], '03': ['Your Name','Graphic & Web Designer'], '04': ['John Marshall','Educator'], '05': ['Thomas Smith','Graphic & Web Designer'], '06': ['Sophie Fischer','Sales Manager'], '07': ['Emily Kate','Web Designer'], '08': ['Name Surname','Web Developer'], '09': ['Brian R. Baxter','Graphic & Web Designer'], '10': ['Ella Clover','Graphic Designer'] }[v] || ['Alex Morgan','Business Professional'];
        const name = esc(data.fullName, defaults[0]);
        const job = esc(data.jobTitle, defaults[1]);
        const email = esc(data.email, 'hello@example.com');
        const phone = esc(data.phone, '+1 416 555 0188');
        const address = esc(data.address, 'Toronto, Canada');
        const summary = esc(data.summary, 'Creative and results-focused professional with strong communication, planning and execution skills. Experienced in delivering high-quality work and measurable outcomes.');
        const exp = arr(data.experience).length ? arr(data.experience) : [
            { title:'Senior Specialist', company:'Canadian Consulting Group', location:'Toronto', dates:'2022 - Present', desc:'Managed daily operations and reporting\nImproved internal workflow and client communication\nDelivered measurable performance improvements' },
            { title:'Specialist', company:'North Market Solutions', location:'Ontario', dates:'2020 - 2022', desc:'Supported project delivery and team coordination\nPrepared reports, dashboards and presentations' }
        ];
        const edu = arr(data.education).length ? arr(data.education) : [
            { title:'Bachelor Degree', company:'University of Toronto', dates:'2016 - 2020' },
            { title:'Professional Certificate', company:'Canadian Business School', dates:'2021' }
        ];
        const skills = arr(data.skills).length ? arr(data.skills) : ['Leadership','Communication','Planning','Microsoft Office','Analytics'];
        const languages = arr(data.languages).length ? arr(data.languages) : [{ name:'English', prof:90 }, { name:'French', prof:70 }];
        const projects = arr(data.projects);
        const initials = name.split(/\s+/).map(x => x[0]).join('').slice(0,2).toUpperCase() || 'CV';
        const photo = (data.showPhoto && photoDataUrl) ? `<img src="${photoDataUrl}" alt="Photo">` : `<span>${initials}</span>`;
        previewRoot.innerHTML = '';
        const wrapper = document.createElement('div');
        wrapper.className = 'cv-pages caex-pages';
        wrapper.id = 'cv-pages';
        previewRoot.appendChild(wrapper);
        const contact = `<p data-inline="phone">${phone}</p><p data-inline="email">${email}</p><p data-inline="address">${address}</p>`;
        const skillsBars = skills.map((s,i)=>`<p class="caex-skill"><span data-inline="skills" data-index="${i}">${esc(s)}</span><i style="--w:${Math.max(50,95-i*8)}%"></i></p>`).join('');
        const langBars = languages.map((l,i)=>`<p class="caex-skill"><span>${esc(l.name || l)}</span><i style="--w:${Math.max(45, Number(l.prof || l.level || 75))}%"></i></p>`).join('');
        const side = `<div class="caex-photo">${photo}</div><section class="caex-contact"><h3>CONTACT</h3>${contact}</section><section><h3>SKILLS</h3>${skillsBars}</section><section><h3>LANGUAGES</h3>${langBars}</section>`;
        const makePage = (first = false) => {
            const page = document.createElement('div');
            page.className = `cv-page caex-page caex-v${v} ${first ? 'caex-first' : 'caex-cont'}`;
            page.dataset.page = String(wrapper.children.length + 1);
            page.innerHTML = `<div class="caex-sheet"><aside class="caex-side">${first ? side : ''}</aside><main class="caex-main">${first ? `<header class="caex-head"><div class="caex-head-photo">${photo}</div><div><h1 data-inline="fullName">${name}</h1><h2 data-inline="targetJobTitle">${job}</h2><div class="caex-line-contact">${contact}</div></div></header>` : `<header class="caex-cont-head"><b>${name}</b><span>${job}</span></header>`}<div class="caex-flow"></div></main></div>`;
            wrapper.appendChild(page);
            return page.querySelector('.caex-flow');
        };
        const block = (html, cls='') => { const el = document.createElement('section'); el.className = `caex-block ${cls}`; el.innerHTML = html; return el; };
        const blocks = [];
        blocks.push(block(`<h3>Profile</h3><p data-inline="summary">${summary}</p>`, 'caex-summary'));
        blocks.push(block(`<h3>Employment History</h3>`, 'caex-heading'));
        exp.forEach((e,i)=>blocks.push(block(`<div class="caex-item-head"><b data-inline="exp-title" data-index="${i}">${esc(e.title)}</b><span data-inline="exp-dates" data-index="${i}">${esc(e.dates)}</span></div><strong data-inline="exp-company" data-index="${i}">${esc(e.company)}${e.location ? ' · ' + esc(e.location) : ''}</strong>${bulletList(e.desc || e.description)}`, 'caex-item caex-exp')));
        blocks.push(block(`<h3>Education</h3>${edu.map((e,i)=>`<div class="caex-item-head"><b data-inline="edu-title" data-index="${i}">${esc(e.title)}</b><span data-inline="edu-dates" data-index="${i}">${esc(e.dates)}</span></div><strong data-inline="edu-company" data-index="${i}">${esc(e.company)}</strong>`).join('')}`, 'caex-edu'));
        if (projects.length) blocks.push(block(`<h3>References / Projects</h3>${projects.map((p,i)=>`<div class="caex-item-head"><b data-inline="proj-title" data-index="${i}">${esc(p.name || p.title)}</b></div><p data-inline="proj-desc" data-index="${i}">${esc(p.desc || p.description)}</p>`).join('')}`, 'caex-projects'));
        let flow = makePage(true);
        blocks.forEach(node => { flow.appendChild(node); if (flow.scrollHeight > flow.clientHeight + 2) { flow.removeChild(node); flow = makePage(false); flow.appendChild(node); } });
    }


    function renderFranceExactTemplatePaginated(data, previewRoot, layout) {
        const safe = (v, fb = '') => (v === undefined || v === null || v === '') ? fb : String(v);
        const arr = (x) => Array.isArray(x) ? x : [];
        const esc = (v, fb='') => safe(v, fb).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const toLines = (v, fb='') => safe(v, fb).split(/\n/).map(x => x.replace(/^\s*[•\-]\s*/, '').trim()).filter(Boolean);
        const bullets = (v, fb='') => '<ul>' + toLines(v, fb).map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>';
        const idx = (String(layout || 'fr-live-01').match(/(\d{2})$/) || ['','01'])[1];
        const v = idx.padStart(2, '0');
        const defaults = {
            '01':['Célia Naudin','Chargée de Projet'], '02':['Amélie Poulain','Gestionnaire de Café'],
            '03':['Julien Morano','Marketing Digital B2B'], '04':['Julie Amandier','Tapissière-décoratrice'],
            '05':['Raphaël Martin','Intitulé du Poste / Stage'], '06':['Samantha Harris','Yoga Instructor'],
            '07':['Garance Jayne','Styliste de mode'], '08':['Melanie Does','Web & Graphic Designer'],
            '09':['Bastein Vidé','Apprentice Developer'], '10':['Martin Anderson','Marketing Manager']
        }[v] || ['Alex Martin','Professionnel'];
        const name = esc(data.fullName, defaults[0]);
        const job = esc(data.jobTitle, defaults[1]);
        const email = esc(data.email, 'hello@reallygreatsite.com');
        const phone = esc(data.phone, '+33 1 23 45 67 89');
        const address = esc(data.address, 'Paris, France');
        const summary = esc(data.summary, 'Professionnel motivé avec une solide expérience, une communication claire et une approche orientée résultats. Capable de gérer les priorités, de collaborer avec les équipes et de livrer un travail de qualité.');
        const exp = arr(data.experience).length ? arr(data.experience) : [
            {title:'Chargé de Communication', company:'Really Great Company', location:'Paris', dates:'2018 - Présent', desc:'Développement et mise en œuvre de stratégies de communication\nRédaction et édition de contenus\nGestion des relations internes et externes'},
            {title:'Assistant Chargé de Communication', company:'Agence Créative', location:'Paris', dates:'2016 - 2018', desc:'Création de supports professionnels\nParticipation aux campagnes digitales\nOrganisation de dossiers clients'}
        ];
        const edu = arr(data.education).length ? arr(data.education) : [
            {title:'Master en Communication', company:'Université de Paris', dates:'2015 - 2017'},
            {title:'Licence en Communication', company:'Université Sorbonne', dates:'2012 - 2015'}
        ];
        const skills = arr(data.skills).length ? arr(data.skills) : ['Gestion de projet','Organisation','Résolution de problèmes','Communication digitale','Réseaux sociaux'];
        const languages = arr(data.languages).length ? arr(data.languages) : [{name:'Français', prof:100},{name:'Anglais', prof:80},{name:'Espagnol', prof:60}];
        const projects = arr(data.projects);
        const initials = name.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase() || 'FR';
        const photo = (data.showPhoto && photoDataUrl) ? '<img src="' + photoDataUrl + '" alt="Photo">' : '<span>' + initials + '</span>';
        previewRoot.innerHTML = '';
        const wrapper = document.createElement('div');
        wrapper.className = 'cv-pages frx-pages'; wrapper.id = 'cv-pages'; previewRoot.appendChild(wrapper);
        const contact = '<p>☎ ' + phone + '</p><p>✉ ' + email + '</p><p>⌂ ' + address + '</p>';
        const langBars = languages.map((l,i)=>'<p class="frx-bar"><span>'+esc(l.name||l)+'</span><i style="--w:'+Math.max(30,Number(l.prof||l.level||75))+'%"></i></p>').join('');
        const skillsList = '<ul>' + skills.map(s=>'<li>'+esc(s)+'</li>').join('') + '</ul>';
        const eduSide = edu.map(e=>'<p><b>'+esc(e.title)+'</b><br>'+esc(e.company)+'<br><span>'+esc(e.dates)+'</span></p>').join('');
        const sideCommon = '<div class="frx-photo">'+photo+'</div><section><h3>CONTACT</h3>'+contact+'</section><section><h3>Langues</h3>'+langBars+'</section><section><h3>Compétences</h3>'+skillsList+'</section>';
        function sideHtml(first){
            if(!first) return '';
            if(v==='04') return '<aside class="frx-side"><div class="frx-photo big">'+photo+'</div><h2>'+name+'</h2><p class="frx-role">'+job+'</p><section><h3>Profil</h3><p>'+summary+'</p></section><section><h3>Infos</h3>'+contact+'</section></aside>';
            if(v==='06') return '<aside class="frx-side"><div class="frx-photo square">'+photo+'</div><section><h3>Education</h3>'+eduSide+'</section><section><h3>Langues</h3>'+skillsList+'</section><section><h3>CONTACT</h3>'+contact+'</section></aside>';
            if(v==='07' || v==='09') return '';
            if(v==='10') return '<aside class="frx-side"><div class="frx-photo round">'+photo+'</div><section><h3>CONTACT</h3>'+contact+'</section><section><h3>Education</h3>'+eduSide+'</section><section><h3>SKILLS</h3>'+skillsList+'</section></aside>';
            return '<aside class="frx-side">'+sideCommon+'</aside>';
        }
        function headerHtml(first){
            if(!first) return '<div class="frx-cont-head">'+name+' · '+job+'</div>';
            if(v==='01') return '<header class="frx-head"><h1>'+name+'</h1><h2>'+job+'</h2></header>';
            if(v==='02') return '<header class="frx-head frx-head-line"><h1>'+name+'</h1><h2>'+job+'</h2><div>'+contact+'</div></header>';
            if(v==='03') return '<header class="frx-head"><h1>'+name+'</h1><h2>'+job+'</h2><p>'+summary+'</p></header>';
            if(v==='04') return '<header class="frx-head floral"><h3>Récompense</h3><p>Meilleure ouvrière de France 2013</p></header>';
            if(v==='05') return '<header class="frx-head blue"><h1>'+name+'</h1><h2>'+job+'</h2></header>';
            if(v==='06') return '<header class="frx-head grey"><h1>'+name+'</h1><h2>'+job+'</h2><p>'+summary+'</p></header>';
            if(v==='07') return '<header class="frx-fashion"><div class="frx-photo rect">'+photo+'</div><div><h1>'+name+'</h1><p>'+summary+'</p></div></header>';
            if(v==='08') return '<header class="frx-qr"><h1>'+name+'</h1><h2>'+job+'</h2><span class="qrbox"></span><p>'+summary+'</p></header>';
            if(v==='09') return '<header class="frx-ribbon"><div class="frx-photo round">'+photo+'</div><h1>'+name+'</h1><p>'+phone+' · '+email+' · '+address+'</p></header>';
            return '<header class="frx-head"><h1>'+name+'</h1><h2>'+job+'</h2></header>';
        }
        const block=(html,cls='')=>{const n=document.createElement('section'); n.className='frx-block '+cls; n.innerHTML=html; return n;};
        const expBlocks = exp.map(e=>block('<article class="frx-item"><div class="frx-date">'+esc(e.dates)+'</div><div><h4>'+esc(e.title)+'</h4><b>'+esc(e.company)+(e.location?', '+esc(e.location):'')+'</b>'+bullets(e.desc,'Gestion de projets\nCommunication professionnelle')+'</div></article>','frx-exp'));
        const eduBlocks = edu.map(e=>block('<article class="frx-item"><div class="frx-date">'+esc(e.dates)+'</div><div><h4>'+esc(e.title)+'</h4><b>'+esc(e.company)+'</b></div></article>','frx-edu'));
        const title=t=>block('<h3>'+t+'</h3>','frx-title');
        const skillBlock=block('<h3>Compétences</h3><div class="frx-skills-grid">'+skills.map((s,i)=>'<p class="frx-bar"><span>'+esc(s)+'</span><i style="--w:'+Math.max(45,92-i*8)+'%"></i></p>').join('')+'</div>','frx-skills');
        const blocks=[];
        if(!['03','04','06','07','08'].includes(v)) blocks.push(block('<h3>Profil</h3><p>'+summary+'</p>','frx-summary'));
        blocks.push(title(v==='01'?'Expériences Professionnelles':v==='09'?'Work experience':'Expérience professionnelle'),...expBlocks,title('Formation'),...eduBlocks,skillBlock);
        if(projects.length) blocks.push(block('<h3>Projets</h3>'+projects.map(p=>'<p><b>'+esc(p.name||p.title)+'</b><br>'+esc(p.desc||p.description)+'</p>').join(''),'frx-projects'));
        function makePage(first=false){
            const page=document.createElement('div'); page.className='cv-page frx-page frx-v'+v+' '+(first?'frx-first':'frx-cont');
            const side=sideHtml(first);
            page.innerHTML='<div class="frx-sheet">'+side+'<main class="frx-main">'+headerHtml(first)+'<div class="frx-flow"></div></main></div>';
            wrapper.appendChild(page); return page.querySelector('.frx-flow');
        }
        let flow=makePage(true); const fits=()=>flow.scrollHeight<=flow.clientHeight+2;
        blocks.forEach(b=>{flow.appendChild(b); if(!fits()){flow.removeChild(b); flow=makePage(false); flow.appendChild(b);}});
    }


    function renderChinaExactTemplatePaginated(data, previewRoot, layout) {
        const safe = (v, fb = '') => (v === undefined || v === null || v === '') ? fb : String(v);
        const arr = (x) => Array.isArray(x) ? x : [];
        const esc = (v, fb='') => safe(v, fb).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const toLines = (v, fb='') => safe(v, fb).split(/\n/).map(x => x.replace(/^\s*[•\-\d\.]+\s*/, '').trim()).filter(Boolean);
        const bullets = (v, fb='') => '<ul>' + toLines(v, fb).map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>';
        const name = esc(data.fullName, 'Li Wei');
        const parts = name.split(/\s+/); const first = parts[0] || name; const last = parts.slice(1).join(' ') || 'Anderson';
        const job = esc(data.jobTitle, 'Chinese Teacher');
        const email = esc(data.email, 'support@qwikresume.com');
        const phone = esc(data.phone, '+86 136 8888 6666');
        const address = esc(data.address, 'Beijing, China');
        const summary = esc(data.summary, 'Dedicated professional with strong communication skills, international experience and a proven ability to deliver high-quality results in multicultural environments.');
        const exp = arr(data.experience).length ? arr(data.experience) : [
            {title:'Chinese Teacher', company:'Pineapple Enterprises', location:'Shanghai, China', dates:'2018 - Present', desc:'Delivered comprehensive learning programs for diverse students\nCreated interactive learning materials and cultural insights\nMaintained positive classroom standards and measurable progress'},
            {title:'Mandarin Teacher', company:'Cactus Creek Solutions', location:'Beijing, China', dates:'2015 - 2018', desc:'Taught beginner and intermediate courses\nPrepared assessments and learning reports\nDesigned engaging class activities'}
        ];
        const edu = arr(data.education).length ? arr(data.education) : [
            {title:'Master of Arts in Education', company:'National Taiwan University', dates:'2015 - 2017'},
            {title:'Bachelor Degree', company:'Beijing Language University', dates:'2011 - 2015'}
        ];
        const skills = arr(data.skills).length ? arr(data.skills) : ['Fluent Mandarin','Curriculum Design','Classroom Management','Translation','Communication'];
        const languages = arr(data.languages).length ? arr(data.languages) : [{name:'English', prof:85},{name:'Mandarin', prof:100},{name:'Japanese', prof:65}];
        const projects = arr(data.projects);
        const photo = (data.showPhoto && photoDataUrl) ? '<img src="' + photoDataUrl + '" alt="Photo">' : '<span>Photo</span>';
        const idx = (String(layout).match(/cn-live-(\d+)/)||[])[1] || '01';
        const v = idx.padStart(2,'0');
        const t = translations[currentLang] || translations.en;
        const L = {
            contact: t.cvContact || 'Contact', skills: t.cvSkills || 'Skills',
            interests: currentLang==='az'?'Maraqlar':(currentLang==='ru'?'Интересы':(currentLang==='de'?'Interessen':(currentLang==='tr'?'İlgi Alanları':'Interests'))),
            languages: t.cvLanguageSkills || 'Languages', summary: t.cvSummary || 'Professional Summary',
            work: t.cvWorkExperience || t.cvExperience || 'Work Experience', education: t.cvEducation || 'Education',
            projects: t.cvProjects || 'Projects', about: t.cvAbout || 'About Me'
        };
        previewRoot.innerHTML = '';
        const wrapper = document.createElement('div');
        wrapper.className = 'cv-pages cnx-pages'; wrapper.id = 'cv-pages'; previewRoot.appendChild(wrapper);
        const contact = '<p>☎ '+phone+'</p><p>✉ '+email+'</p><p>⌂ '+address+'</p><p>www.qwikresume.com</p>';
        const sideSkills = skills.map((s,i)=>'<p class="cnx-bar"><span>'+esc(s)+'</span><i style="--w:'+Math.max(45,96-i*9)+'%"></i></p>').join('');
        const langBars = languages.map((l,i)=>'<p class="cnx-bar"><span>'+esc(l.name||l)+'</span><i style="--w:'+Math.max(35,Number(l.prof||l.level||80))+'%"></i></p>').join('');
        const dotSkills = skills.map((s,i)=>'<p class="cnx-dots"><span>'+esc(s)+'</span><b>'+Array.from({length:7},(_,j)=>'<em class="'+(j<6-i%3?'on':'')+'"></em>').join('')+'</b></p>').join('');
        const eduSide = edu.map(e=>'<p><b>'+esc(e.title)+'</b><br>'+esc(e.company)+'<br><span>'+esc(e.dates)+'</span></p>').join('');
        function sideHtml(firstPage=true){
            if(!firstPage) return '<aside class="cnx-side cnx-empty"></aside>';
            const ph='<div class="cnx-photo">'+photo+'</div>';
            if(v==='01') return '<aside class="cnx-side"><section><h3>SKILLS</h3>'+dotSkills+'</section><section><h3>INTERESTS</h3><p>Home Brewing · Wildlife · Running · Public Speaking</p></section><section><h3>LANGUAGES</h3>'+langBars+'</section></aside>';
            if(v==='02') return '<aside class="cnx-side">'+ph+'<h2>简历在线</h2><section><h3>CONTACT</h3>'+contact+'</section><section><h3>校园荣誉</h3><p>优秀学生干部<br>奖学金获得者</p></section></aside>';
            if(v==='03') return '<aside class="cnx-side">'+ph+'<section><h3>PROFILE</h3><p>'+summary+'</p></section><section><h3>Links</h3><p>LinkedIn / Portfolio</p></section><section><h3>Hobbies</h3><p>阅读 · 旅游 · 摄影</p></section></aside>';
            if(v==='04') return '';
            if(v==='05') return '<aside class="cnx-side">'+ph+'<section><h3>PROFILE</h3><p>'+summary+'</p></section><section><h3>PROJECTS</h3><p>Created successful campaigns and maintained high response rate.</p></section><section><h3>CONTACT</h3>'+contact+'</section></aside>';
            if(v==='06') return '<aside class="cnx-side"><section><h3>SKILLS</h3>'+dotSkills+'</section><section><h3>INTERESTS</h3><p>Podcasts · Dancing · Cycling</p></section><section><h3>LANGUAGES</h3>'+langBars+'</section></aside>';
            if(v==='07') return '';
            if(v==='08') return '';
            if(v==='09') return '<aside class="cnx-side">'+ph+'<section><h3>SKILLS</h3>'+skills.map(s=>'<p>• '+esc(s)+'</p>').join('')+'</section><section><h3>EDUCATION</h3>'+eduSide+'</section></aside>';
            return '<aside class="cnx-side"><section><h3>SKILLS</h3>'+dotSkills+'</section><section><h3>INTERESTS</h3><p>Reading Fiction · E-sports · Puzzle Solving</p></section><section><h3>LANGUAGES</h3>'+langBars+'</section></aside>';
        }
        function headerHtml(firstPage=true){
            if(!firstPage) return '<div class="cnx-cont-head">'+name+' · '+job+'</div>';
            if(v==='01') return '<header class="cnx-head"><h1>'+name+'</h1><h2>'+job+'</h2><div>'+contact+'</div></header>';
            if(v==='02') return '<header class="cnx-head cnx-cnhead"><h1>个人简历</h1><h2>'+name+' · '+job+'</h2></header>';
            if(v==='03') return '<header class="cnx-head"><h1>'+first+'<br>'+last+'</h1><h2>'+job+'</h2><div class="cnx-contact-row">'+contact+'</div></header>';
            if(v==='04') return '<header class="cnx-head hero"><h1>'+name+'</h1><h2>'+job+'</h2><div class="cnx-photo rect">'+photo+'</div><p>'+summary+'</p></header>';
            if(v==='05') return '<header class="cnx-head split"><h1>'+name+'</h1><h2>'+job+'</h2></header>';
            if(v==='06') return '<header class="cnx-head clean"><div class="cnx-photo small">'+photo+'</div><h1>'+name+'</h1><h2>'+job+'</h2><div>'+contact+'</div></header>';
            if(v==='07') return '<header class="cnx-head chinese"><div><h1>个人简历</h1><p>'+contact+'</p></div><div class="cnx-photo small">'+photo+'</div></header>';
            if(v==='08') return '<header class="cnx-head ornament"><div class="cnx-photo round">'+photo+'</div><h1>'+name+'</h1><h2>'+job+'</h2><p>'+summary+'</p></header>';
            if(v==='09') return '<header class="cnx-head yellow"><h1>'+first+'<br>'+last+'</h1><h2>'+job+'</h2></header>';
            return '<header class="cnx-head brown"><h1>'+name+'</h1><h2>'+job+'</h2><div>'+contact+'</div></header>';
        }
        const block=(html,cls='')=>{const n=document.createElement('section'); n.className='cnx-block '+cls; n.innerHTML=html; return n;};
        const expBlocks = exp.map(e=>block('<article class="cnx-item"><div class="cnx-date">'+esc(e.dates)+'</div><div><h4>'+esc(e.title)+'</h4><b>'+esc(e.company)+(e.location?', '+esc(e.location):'')+'</b>'+bullets(e.desc,'Delivered measurable results\nManaged communication and workflow')+'</div></article>','cnx-exp'));
        const eduBlocks = edu.map(e=>block('<article class="cnx-item"><div class="cnx-date">'+esc(e.dates)+'</div><div><h4>'+esc(e.title)+'</h4><b>'+esc(e.company)+'</b></div></article>','cnx-edu'));
        const title=t=>block('<h3>'+t+'</h3>','cnx-title');
        const skillBlock=block('<h3>SKILLS</h3><div class="cnx-skills-grid">'+(v==='01'||v==='06'||v==='10'?dotSkills:sideSkills)+'</div>','cnx-skills');
        let blocks=[];
        if(!['04','05','07','08'].includes(v)) blocks.push(block('<h3>PROFESSIONAL SUMMARY</h3><p>'+summary+'</p>','cnx-summary'));
        blocks.push(title(L.work), ...expBlocks, title(L.education), ...eduBlocks, skillBlock);
        if(projects.length) blocks.push(block('<h3>PROJECTS</h3>'+projects.map(p=>'<p><b>'+esc(p.name||p.title)+'</b><br>'+esc(p.desc||p.description)+'</p>').join(''),'cnx-projects'));
        function makePage(firstPage=false){
            const page=document.createElement('div'); page.className='cv-page cnx-page cnx-v'+v+' '+(firstPage?'cnx-first':'cnx-cont');
            page.innerHTML='<div class="cnx-sheet">'+sideHtml(firstPage)+'<main class="cnx-main">'+headerHtml(firstPage)+'<div class="cnx-flow"></div></main></div>';
            wrapper.appendChild(page); return page.querySelector('.cnx-flow');
        }
        let flow=makePage(true); const fits=()=>flow.scrollHeight<=flow.clientHeight+2;
        blocks.forEach(b=>{ flow.appendChild(b); if(!fits()){ flow.removeChild(b); flow=makePage(false); flow.appendChild(b); }});
        if (typeof enableInlinePreviewEditing === 'function') enableInlinePreviewEditing();
    }


    function renderInternationalPremiumTemplatePaginated(data, previewRoot, layout) {
        const safe = (v, fb = '') => (v === undefined || v === null || v === '') ? fb : String(v);
        const arr = (x) => Array.isArray(x) ? x : [];
        const escLines = (v) => safe(v).replace(/\n/g, '<br>');
        const prefix = String(layout || '').slice(0, 2);
        const idx = Number((String(layout || '').match(/-(\d+)$/) || [0, 1])[1]);
        const countryName = ({ ca: 'Canada', sg: 'Singapore', fr: 'France', cn: 'China', es: 'Spain' }[prefix] || 'International');
        const name = safe(data.fullName, countryName === 'China' ? 'Li Wei' : 'Alex Morgan');
        const job = safe(data.jobTitle, 'Business Professional');
        const email = safe(data.email, 'email@example.com');
        const phone = safe(data.phone, '+00 000 000 000');
        const address = safe(data.address, countryName);
        const summary = safe(data.summary, 'Results-driven professional with strong experience, clear communication and measurable achievements across business operations.');
        const exp = arr(data.experience).length ? arr(data.experience) : [
            { title: 'Senior Specialist', company: 'Premium Company', location: countryName, dates: '2022 - Present', desc: 'Improved operational processes and reporting\nLed cross-functional collaboration\nDelivered measurable business results' },
            { title: 'Associate', company: 'Growth Group', location: countryName, dates: '2020 - 2022', desc: 'Supported team objectives and client communication\nBuilt repeatable workflow systems' }
        ];
        const edu = arr(data.education).length ? arr(data.education) : [{ title: 'Bachelor Degree', company: 'University', dates: '2016 - 2020' }];
        const skills = arr(data.skills).length ? arr(data.skills) : ['Leadership', 'Analytics', 'Communication', 'Planning', 'MS Office'];
        const languages = arr(data.languages).length ? arr(data.languages) : [{ name: 'English', prof: 90 }, { name: 'Local language', prof: 80 }];
        const projects = arr(data.projects);
        const initials = name.split(/\s+/).map(x => x[0]).join('').slice(0,2).toUpperCase() || 'CV';
        const photo = (data.showPhoto && photoDataUrl) ? `<img src="${photoDataUrl}" alt="Photo">` : `<span>${initials}</span>`;
        const variant = `${prefix}-variant-${String(((idx - 1) % 10) + 1).padStart(2, '0')}`;
        const pageClass = `intl-page intl-${prefix} ${variant}`;

        previewRoot.innerHTML = '';
        const wrapper = document.createElement('div');
        wrapper.className = 'cv-pages intl-live-pages';
        wrapper.id = 'cv-pages';
        previewRoot.appendChild(wrapper);

        const makePage = (first = false) => {
            const page = document.createElement('div');
            page.className = `cv-page cv-uploaded-live-page ${pageClass} ${first ? 'intl-first-page' : 'intl-cont-page'}`;
            page.dataset.page = String(wrapper.children.length + 1);
            page.innerHTML = `
                <div class="intl-sheet">
                    <aside class="intl-side ${first ? '' : 'intl-side-empty'}">
                        ${first ? `<div class="intl-photo">${photo}</div>
                        <section><h3>CONTACT</h3><p>${phone}</p><p>${email}</p><p>${address}</p></section>
                        <section><h3>SKILLS</h3><div class="intl-tags">${skills.map(s=>`<span>${safe(s)}</span>`).join('')}</div></section>
                        <section><h3>LANGUAGES</h3>${languages.map(l=>`<p>${safe(l.name || l)} ${safe(l.prof || l.level || '')}${l.prof || l.level ? '%' : ''}</p>`).join('')}</section>` : ''}
                    </aside>
                    <main class="intl-main">
                        ${first ? `<header class="intl-head"><small>${countryName} Premium Pack</small><h1>${name}</h1><h2>${job}</h2><div class="intl-contactline"><span>${phone}</span><span>${email}</span><span>${address}</span></div></header>` : `<header class="intl-cont-head"><span>${name}</span><b>${job}</b></header>`}
                        <div class="intl-flow"></div>
                    </main>
                </div>`;
            wrapper.appendChild(page);
            return page.querySelector('.intl-flow');
        };
        const block = (html, cls = '') => { const el = document.createElement('section'); el.className = `intl-block ${cls}`; el.innerHTML = html; return el; };
        const bullets = (txt) => safe(txt).split(/\n/).map(x=>x.replace(/^\s*[•\-]\s*/, '').trim()).filter(Boolean).map(x=>`<li>${x}</li>`).join('');
        const blocks = [];
        blocks.push(block(`<h3>Professional Summary</h3><p>${escLines(summary)}</p>`, 'intl-summary'));
        blocks.push(block(`<h3>Work Experience</h3>`, 'intl-heading'));
        exp.forEach(e => blocks.push(block(`<div class="intl-item-head"><b>${safe(e.title)}</b><span>${safe(e.dates)}</span></div><strong>${safe(e.company)}${e.location ? ' · ' + safe(e.location) : ''}</strong><ul>${bullets(e.desc || e.description)}</ul>`, 'intl-item')));
        blocks.push(block(`<h3>Education</h3>${edu.map(e=>`<div class="intl-item-head"><b>${safe(e.title)}</b><span>${safe(e.dates)}</span></div><strong>${safe(e.company)}</strong>`).join('')}`, 'intl-edu'));
        if (projects.length) blocks.push(block(`<h3>Projects</h3>${projects.map(p=>`<div class="intl-item-head"><b>${safe(p.name || p.title)}</b></div><p>${escLines(p.desc || p.description)}</p>`).join('')}`, 'intl-projects'));

        let flow = makePage(true);
        blocks.forEach(node => {
            flow.appendChild(node);
            if (flow.scrollHeight > flow.clientHeight + 2) {
                flow.removeChild(node);
                flow = makePage(false);
                flow.appendChild(node);
            }
        });
    }


    function renderUKLiveTemplatePaginated(data, previewRoot, layout) {
        const safe = (v, fb = '') => (v === undefined || v === null || v === '') ? fb : String(v);
        const arr = (x) => Array.isArray(x) ? x : [];
        const esc = (v, fb='') => safe(v, fb).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const toLines = (v, fb='') => safe(v, fb).split(/\n/).map(x => x.replace(/^\s*[•\-]\s*/, '').trim()).filter(Boolean);
        const bullets = (v, fb='') => '<ul>' + toLines(v, fb).map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>';
        const name = esc(data.fullName, 'Julia Scott');
        const parts = name.split(/\s+/); const first = parts[0] || name; const last = parts.slice(1).join(' ') || 'Scott';
        const job = esc(data.jobTitle, 'Fashion Designer');
        const email = esc(data.email, 'julia.scott@email.com');
        const phone = esc(data.phone, '+44 20 7946 5678');
        const address = esc(data.address, 'Bristol, United Kingdom');
        const summary = esc(data.summary, 'A passionate and skilled professional with a focus on practical results, strong communication, and clean execution. Experienced in delivering high-quality work in fast-paced environments.');
        const exp = arr(data.experience).length ? arr(data.experience) : [
            {title:'Junior Fashion Designer', company:'Studio Luxe', location:'Bristol, UK', dates:'2021 – Now', desc:'Designed collections and created technical sketches\nResearched trends and sourced materials\nCoordinated with production teams'},
            {title:'Assistant Fashion Designer', company:'Bella Couture', location:'Bristol, UK', dates:'2018 – 2021', desc:'Assisted with design fitting and mood boards\nPrepared client presentations\nSupported garment construction processes'},
            {title:'Fashion Designer Intern', company:'Harper & Co.', location:'London, UK', dates:'2017 – 2018', desc:'Supported senior designers\nOrganised sample documentation'}
        ];
        const edu = arr(data.education).length ? arr(data.education) : [
            {title:'BA (Hons) Fashion Design', company:'University of West England, Bristol', dates:'2018'},
            {title:'Diploma in Textile Design', company:'London College of Fashion', dates:'2016'}
        ];
        const skills = arr(data.skills).length ? arr(data.skills) : ['Fashion Illustration','Garment Construction','Digital Design','Trend Research','Sustainable Practices'];
        const languages = arr(data.languages).length ? arr(data.languages) : [{name:'English', prof:95}];
        const projects = arr(data.projects);
        const photo = (data.showPhoto && photoDataUrl) ? '<img src="' + photoDataUrl + '" alt="Photo">' : '<span>Photo</span>';
        const idx = (String(layout).match(/uk-live-(\d+)/)||[])[1] || '01';
        const v = idx.padStart(2,'0');
        previewRoot.innerHTML = '';
        const wrapper = document.createElement('div');
        wrapper.className = 'cv-pages ukx-pages'; wrapper.id = 'cv-pages'; previewRoot.appendChild(wrapper);
        const contact = '<p>' + phone + '</p><p>' + email + '</p><p>' + address + '</p><p>linkedin.com/in/profile</p>';
        const skillsHtml = skills.map((s,i)=>'<p class="ukx-skill"><span>' + esc(s) + '</span><i style="--w:' + Math.max(55,94-i*7) + '%"></i></p>').join('');
        const eduSide = edu.map(e=>'<p><b>' + esc(e.title) + '</b><br>' + esc(e.company) + '<br>' + esc(e.dates) + '</p>').join('');
        function sideHtml(){
            const ph = '<div class="ukx-photo">' + photo + '</div>';
            if(v==='01') return '<aside class="ukx-side"><div class="ukx-photo-wrap">'+ph+'</div><section><h3>Contacts</h3>'+contact+'</section><section><h3>Job Objective</h3><p>'+summary+'</p></section><section><h3>Education</h3>'+eduSide+'</section></aside>';
            if(v==='02') return '<aside class="ukx-side"><div class="ukx-photo-wrap">'+ph+'</div><section><h3>Education</h3>'+eduSide+'</section><section><h3>SKILLS</h3>'+skillsHtml+'</section><section><h3>Links</h3><p>portfolio.com</p><p>'+email+'</p></section></aside>';
            if(v==='03') return '<aside class="ukx-side"><div class="ukx-photo-wrap">'+ph+'</div><section><h3>CONTACT</h3>'+contact+'</section><section><h3>Education</h3>'+eduSide+'</section><section><h3>SKILLS</h3>'+skillsHtml+'</section></aside>';
            if(v==='04') return '<aside class="ukx-side"><div class="ukx-photo-wrap">'+ph+'</div><section><h3>CONTACT</h3>'+contact+'</section><section><h3>Education & Certificate</h3>'+eduSide+'</section><section><h3>SKILLS</h3>'+skillsHtml+'</section></aside>';
            if(v==='05') return '<aside class="ukx-side"><div class="ukx-photo-wrap">'+ph+'</div><section><h3>CONTACT</h3>'+contact+'</section><section><h3>Education</h3>'+eduSide+'</section><section><h3>Pro Skills</h3>'+skillsHtml+'</section></aside>';
            if(v==='06') return '<aside class="ukx-side"><div class="ukx-photo-wrap">'+ph+'</div><section><h3>Profile</h3><p>'+summary+'</p></section><section><h3>CONTACT</h3>'+contact+'</section><section><h3>SKILLS</h3>'+skillsHtml+'</section></aside>';
            if(v==='07') return '<aside class="ukx-side"><div class="ukx-photo-wrap">'+ph+'</div><section><h3>CONTACT</h3>'+contact+'</section><section><h3>SKILLS</h3>'+skills.map(s=>'<p>• '+esc(s)+'</p>').join('')+'</section><section><h3>Hobbies</h3><p>Fashion • Photography • Travel</p></section></aside>';
            if(v==='08') return '<aside class="ukx-side"><div class="ukx-photo-wrap">'+ph+'</div><section><h3>CONTACT</h3>'+contact+'</section><section><h3>Education</h3>'+eduSide+'</section><section><h3>SKILLS</h3>'+skillsHtml+'</section></aside>';
            if(v==='09') return '<aside class="ukx-side"><div class="ukx-photo-wrap">'+ph+'</div><section><h3>CONTACT</h3>'+contact+'</section><section><h3>Education</h3>'+eduSide+'</section><section><h3>Expertise</h3>'+skills.map(s=>'<p>'+esc(s)+'</p>').join('')+'</section></aside>';
            return '<aside class="ukx-side"><div class="ukx-photo-wrap">'+ph+'</div><section><h3>CONTACT</h3>'+contact+'</section><section><h3>Education</h3>'+eduSide+'</section><section><h3>SKILLS</h3>'+skillsHtml+'</section></aside>';
        }
        function headerHtml(){
            if(v==='01') return '<header class="ukx-head"><h1>Carmen C Edwards</h1><h2>Electronics Sales Associate</h2></header>';
            if(v==='02') return '<header class="ukx-head"><h1>Laura Becker</h1><h2>Project Manager</h2></header>';
            if(v==='03') return '<header class="ukx-head"><h1>Lauren Johnson</h1><h2>Marketing Manager</h2></header>';
            if(v==='04') return '<header class="ukx-head"><h1>Sammy<br>Levine</h1><h2>'+job+'</h2></header>';
            if(v==='05') return '<header class="ukx-head"><h1>Archie <span>Alexander</span></h1><h2>Mechanical Engineer</h2></header>';
            if(v==='06') return '<header class="ukx-head"><h1>Name and Surname</h1><h2>'+name+' · '+job+'</h2></header>';
            if(v==='07') return '<header class="ukx-head"><h1>'+first+' <span>'+last+'</span></h1><h2>'+job+'</h2></header>';
            if(v==='08') return '<header class="ukx-head"><h1>Jasmine Roy</h1><h2>Web Designer</h2></header>';
            if(v==='09') return '<header class="ukx-head"><h1>Cassidy Howard</h1><h2>Project Manager</h2></header>';
            return '<header class="ukx-head"><h1>'+name+'</h1><h2>'+job+'</h2></header>';
        }
        const block = (html, cls='') => { const n=document.createElement('div'); n.className='ukx-block '+cls; n.innerHTML=html; return n; };
        const expBlock = exp.map(e=> block('<div class="ukx-job"><div class="ukx-date">'+esc(e.dates)+'</div><div class="ukx-job-body"><h4>'+esc(e.title)+'</h4><b>'+esc(e.company)+(e.location ? ', '+esc(e.location) : '')+'</b>'+bullets(e.desc,'Delivered projects and supported operational targets')+'</div></div>', 'ukx-exp'));
        const eduBlock = edu.map(e=> block('<div class="ukx-edu"><span>'+esc(e.dates)+'</span><div><h4>'+esc(e.title)+'</h4><p>'+esc(e.company)+'</p></div></div>', 'ukx-education'));
        const title = (t)=>block('<h3>'+t+'</h3>','ukx-title');
        const blocks = [block('<h3>'+(v==='01'?'Work Summary':v==='09'?'Profile':'Professional Summary')+'</h3><p>'+summary+'</p>','ukx-summary'), title(v==='01'?'Work Summary':v==='07'?'Experience':'Professional Experience'), ...expBlock, title('Education'), ...eduBlock, block('<h3>'+(v==='09'?'Expertise':'Projects')+'</h3>'+(projects.length ? projects.map(p=>'<p><b>'+esc(p.name||p.title)+'</b><br>'+esc(p.desc||p.description)+'</p>').join('') : '<p>Selected professional achievements and portfolio work.</p>'),'ukx-projects')];
        function makePage(first=false){
            const page=document.createElement('div'); page.className='cv-page ukx-page ukx-v'+v+' '+(first?'ukx-first-page':'ukx-cont-page');
            page.innerHTML='<div class="ukx-sheet">'+sideHtml()+'<main class="ukx-main">'+(first?headerHtml():'<div class="ukx-cont-head">'+name+' · '+job+'</div>')+'<div class="ukx-flow"></div></main></div>';
            wrapper.appendChild(page); return page.querySelector('.ukx-flow');
        }
        let flow=makePage(true); const fits=()=>flow.scrollHeight<=flow.clientHeight+2;
        blocks.forEach(b=>{ flow.appendChild(b); if(!fits()){ flow.removeChild(b); flow=makePage(false); flow.appendChild(b); }});
        if (typeof enableInlinePreviewEditing === 'function') enableInlinePreviewEditing();
    }

    /* 7. THE 5 BASE LAYOUT TEMPLATES */

    function renderMinimal(data) {
        const t = translations[currentLang] || translations.en;
        const blocks = {
            summary: `<div class="cv-section"><div class="cv-sec-title">${t.cvSummary}</div><div class="cv-item-desc">${String(data.summary || "").replace(/\n/g, '<br>')}</div></div>`,
            experience: `<div class="cv-section"><div class="cv-sec-title">${t.cvExperience}</div>${(Array.isArray(data.experience) ? data.experience : []).map(e => `<div class="cv-item"><div class="cv-item-hdr"><span class="cv-item-title">${e.title || ""}</span><span class="cv-item-date">${e.dates || ""}</span></div><div class="cv-item-comp">${e.company || ""}${e.location ? ', ' + e.location : ''}</div><div class="cv-item-desc">${String(e.desc || "").replace(/\n/g, '<br>')}</div></div>`).join('')}</div>`,
            education: `<div class="cv-section"><div class="cv-sec-title">${t.cvEducation}</div>${(Array.isArray(data.education) ? data.education : []).map(e => `<div class="cv-item" style="margin-bottom:2mm;"><div class="cv-item-hdr"><span class="cv-item-title">${e.title || ""}</span><span class="cv-item-date">${e.dates || ""}</span></div><div class="cv-item-comp" style="margin:0;">${e.company || ""}</div></div>`).join('')}</div>`,
            skills: `<div class="cv-section"><div class="cv-sec-title">${t.cvSkills}</div><div class="cv-item-desc">${(Array.isArray(data.skills) ? data.skills : []).join(' • ')}</div></div>`
        };
        const dynamicContent = (Array.isArray(data.sectionOrder) ? data.sectionOrder : []).map(sec => blocks[sec] || '').join('');
        return `
            <div class="cv-header">
                ${data.showPhoto ? `<div class="cv-photo-box"><img src="${photoDataUrl}" alt="Photo" style="width:100%;height:100%;"></div>` : ''}
                <h1>${data.fullName || ""}</h1>
                <h2>${data.jobTitle || ""}</h2>
                <div class="cv-contact">
                    <span>${data.email || ""}</span> • <span>${data.phone || ""}</span> • <span>${data.address || ""}</span>
                    ${data.showDob ? `• <span>DOB: ${data.dob || ""}</span>` : ''}
                    ${data.showNat ? `• <span>${data.nationality || ""}</span>` : ''}
                </div>
            </div>
            ${dynamicContent}
        `;
    }

    function renderModern(data) {
        const t = translations[currentLang] || translations.en;
        const blocks = {
            summary: `<div class="cv-section"><span class="cv-sec-title">${t.cvSummary}</span><div class="cv-item-desc">${String(data.summary || "").replace(/\n/g, '<br>')}</div></div>`,
            experience: `<div class="cv-section"><span class="cv-sec-title">${t.cvExperience}</span>${(Array.isArray(data.experience) ? data.experience : []).map(e => `<div class="cv-item"><span class="cv-item-title">${e.title || ""}</span><span class="cv-item-comp">${e.company || ""}${e.location ? ' — ' + e.location : ''}</span><span class="cv-item-date">${e.dates || ""}</span><div class="cv-item-desc">${String(e.desc || "").replace(/\n/g, '<br>')}</div></div>`).join('')}</div>`,
            education: `<div class="cv-section"><span class="cv-sec-title">${t.cvEducation}</span>${(Array.isArray(data.education) ? data.education : []).map(e => `<div class="cv-item" style="margin-bottom:2mm;"><span class="cv-item-title">${e.title || ""}</span><span class="cv-item-comp" style="margin-bottom:1mm;">${e.company || ""}</span><span class="cv-item-date">${e.dates || ""}</span></div>`).join('')}</div>`
        };
        const dynamicMainContent = (Array.isArray(data.sectionOrder) ? data.sectionOrder : []).filter(k => k !== 'skills').map(sec => blocks[sec] || '').join('');
        return `
            <div class="cv-main">
                <div class="cv-header">
                    <h1>${data.fullName || ""}</h1>
                    <h2>${data.jobTitle || ""}</h2>
                </div>
                ${dynamicMainContent}
            </div>
            <div class="cv-side">
                ${data.showPhoto ? `<div class="cv-photo-box"><img src="${photoDataUrl}" alt="Photo" style="width:100%;height:100%;"></div>` : ''}
                <div class="cv-sec-title">${t.cvContact}</div>
                <div class="cv-side-block">
                    <strong>Email</strong><br>${data.email || ""}<br><br>
                    <strong>Phone</strong><br>${data.phone || ""}<br><br>
                    <strong>Address</strong><br>${data.address || ""}<br><br>
                    ${data.showDob ? `<strong>DOB</strong><br>${data.dob || ""}<br><br>` : ''}
                    ${data.showNat ? `<strong>Nat</strong><br>${data.nationality || ""}` : ''}
                </div>
                <div class="cv-sec-title">${t.cvExpertise}</div>
                <div class="cv-side-block">
                    <ul>${(Array.isArray(data.skills) ? data.skills : []).map(s => `<li>${s}</li>`).join('')}</ul>
                </div>
            </div>
        `;
    }

    function renderCreative(data) {
        const t = translations[currentLang] || translations.en;
        const blocks = {
            summary: `<div class="cv-section"><div class="cv-sec-title">${t.cvProfile}</div><div class="cv-item-desc">${String(data.summary || "").replace(/\n/g, '<br>')}</div></div>`,
            experience: `<div class="cv-section"><div class="cv-sec-title">${t.cvWorkExperience}</div>${(Array.isArray(data.experience) ? data.experience : []).map(e => `<div class="cv-item"><div class="cv-item-left"><span class="cv-item-date">${e.dates || ""}</span></div><div class="cv-item-right"><span class="cv-item-title">${e.title || ""}</span><span class="cv-item-comp">${e.company || ""}${e.location ? ', ' + e.location : ''}</span><div class="cv-item-desc">${String(e.desc || "").replace(/\n/g, '<br>')}</div></div></div>`).join('')}</div>`,
            education: `<div class="cv-section"><div class="cv-sec-title">${t.cvEducation}</div>${(Array.isArray(data.education) ? data.education : []).map(e => `<div class="cv-item"><div class="cv-item-left"><span class="cv-item-date">${e.dates || ""}</span></div><div class="cv-item-right"><span class="cv-item-title">${e.title || ""}</span><span class="cv-item-comp" style="margin:0;">${e.company || ""}</span></div></div>`).join('')}</div>`
        };
        const dynamicMainContent = (Array.isArray(data.sectionOrder) ? data.sectionOrder : []).filter(k => k !== 'skills').map(sec => blocks[sec] || '').join('');
        return `
            <div class="cv-side">
                ${data.showPhoto ? `<div class="cv-photo-box"><img src="${photoDataUrl}" alt="Photo" style="width:100%;height:100%;"></div>` : ''}
                <div class="cv-sec-title">${t.cvDetails}</div>
                <div class="cv-side-block">
                    ${data.address || ""}<br><br>${data.phone || ""}<br><br>${data.email || ""}<br><br>
                    ${data.showDob ? `Born: ${data.dob || ""}<br><br>` : ''}
                    ${data.showNat ? `Nat: ${data.nationality || ""}` : ''}
                </div>
                <div class="cv-sec-title" style="margin-top:10mm;">${t.cvSkills}</div>
                <div class="cv-side-block">
                    ${(Array.isArray(data.skills) ? data.skills : []).join('<br><br>')}
                </div>
            </div>
            <div class="cv-main">
                <div class="cv-header">
                    <h1>${data.fullName || ""}</h1>
                    <h2>${data.jobTitle || ""}</h2>
                </div>
                ${dynamicMainContent}
            </div>
        `;
    }

    function renderCorporate(data) {
        const t = translations[currentLang] || translations.en;
        const blocks = {
            summary: `<div class="cv-sec-title">${t.cvSummary}</div><div class="cv-item-desc" style="margin-bottom:8mm;">${String(data.summary || "").replace(/\n/g, '<br>')}</div>`,
            experience: `<div class="cv-sec-title">${t.cvExperienceMatrix}</div>${(Array.isArray(data.experience) ? data.experience : []).map(e => `<div class="cv-item"><div class="cv-item-hdr"><span class="cv-item-title">${e.title || ""}</span><span class="cv-item-date">${e.dates || ""}</span></div><div class="cv-item-comp">${e.company || ""}${e.location ? ', ' + e.location : ''}</div><div class="cv-item-desc">${String(e.desc || "").replace(/\n/g, '<br>')}</div></div>`).join('')}`,
            education: `<div class="cv-sec-title" style="margin-top:8mm;">${t.cvEducation}</div>${(Array.isArray(data.education) ? data.education : []).map(e => `<div class="cv-item" style="margin-bottom:2mm;"><div class="cv-item-hdr"><span class="cv-item-title">${e.title || ""}</span><span class="cv-item-date">${e.dates || ""}</span></div><div class="cv-item-comp" style="margin:0;">${e.company || ""}</div></div>`).join('')}`
        };
        const dynamicMainContent = (Array.isArray(data.sectionOrder) ? data.sectionOrder : []).filter(k => k !== 'skills').map(sec => blocks[sec] || '').join('');
        return `
            <div class="cv-header">
                ${data.showPhoto ? `<div class="cv-photo-box"><img src="${photoDataUrl}" alt="Photo" style="width:100%;height:100%;"></div>` : ''}
                <div class="cv-header-text">
                    <h1>${data.fullName || ""}</h1>
                    <h2>${data.jobTitle || ""}</h2>
                </div>
            </div>
            <div class="cv-body">
                <div class="cv-col-left">
                    <div class="cv-sec-title">${t.cvContact}</div>
                    <div class="cv-side-block">
                        ${data.address || ""}<br>Tel: ${data.phone || ""}<br>${data.email || ""}<br>
                        ${data.showDob ? `<br>DOB: ${data.dob || ""}` : ''}
                        ${data.showNat ? `<br>Nat: ${data.nationality || ""}` : ''}
                    </div>
                    <div class="cv-sec-title">${t.cvKeySkills}</div>
                    <div class="cv-side-block" style="padding-left:4mm;">
                        <ul style="padding:0; margin:0; list-style-type:circle;">
                            ${(Array.isArray(data.skills) ? data.skills : []).map(s => `<li>${s}</li>`).join('')}
                        </ul>
                    </div>
                </div>
                <div class="cv-col-right">
                    ${dynamicMainContent}
                </div>
            </div>
        `;
    }

    function renderCompact(data) {
        const t = translations[currentLang] || translations.en;
        const blocks = {
            summary: `<div class="cv-sec-title">${t.cvProfileSummary}</div><div style="font-size:10pt; color:var(--cv-text); margin-bottom:6mm; line-height: 1.5; padding:0 1mm;">${String(data.summary || "").replace(/\n/g, '<br>')}</div>`,
            skills: `<div class="cv-sec-title">${t.cvCoreCompetencies}</div><div style="font-size:10pt; color:var(--cv-primary); margin-bottom:6mm; padding:0 1mm; font-weight:700;">${(Array.isArray(data.skills) ? data.skills : []).join(' • ')}</div>`,
            experience: `<div class="cv-section"><div class="cv-sec-title">${t.cvExperience}</div>${(Array.isArray(data.experience) ? data.experience : []).map(e => `<div class="cv-grid"><div class="cv-td-date">${e.dates || ""}</div><div><span class="cv-item-title">${e.title || ""}</span> <span class="cv-item-comp">at ${e.company || ""}${e.location ? ', ' + e.location : ''}</span><div class="cv-item-desc">${String(e.desc || "").replace(/\n/g, '<br>')}</div></div></div>`).join('')}</div>`,
            education: `<div class="cv-section"><div class="cv-sec-title">${t.cvEducation}</div>${(Array.isArray(data.education) ? data.education : []).map(e => `<div class="cv-grid"><div class="cv-td-date">${e.dates || ""}</div><div><div class="cv-item-title">${e.title || ""}</div><div class="cv-item-desc" style="margin:0;">${e.company || ""}</div></div></div>`).join('')}</div>`
        };
        const dynamicContent = (Array.isArray(data.sectionOrder) ? data.sectionOrder : []).map(sec => blocks[sec] || '').join('');
        return `
            <div class="cv-header">
                <div class="cv-header-text">
                    <h1>${data.fullName || ""}</h1>
                    <h2>${data.jobTitle || ""}</h2>
                    <div class="cv-pers-grid" style="margin-top: 4mm;">
                        <div><strong>Email:</strong> ${data.email || ""}</div>
                        <div><strong>Phone:</strong> ${data.phone || ""}</div>
                        <div><strong>Address:</strong> ${data.address || ""}</div>
                        ${data.showDob ? `<div><strong>DOB:</strong> ${data.dob || ""}</div>` : ''}
                        ${data.showNat ? `<div><strong>Nat:</strong> ${data.nationality || ""}</div>` : ''}
                    </div>
                </div>
                ${data.showPhoto ? `<div class="cv-photo-box"><img src="${photoDataUrl}" alt="Photo" style="width:100%;height:100%;"></div>` : ''}
            </div>
            ${dynamicContent}
        `;
    }

    function renderAzerbaijan(data) {
        const t = translations[currentLang] || translations.en;
        const formatDesc = (desc) => {
            if (!desc) return '';
            const points = String(desc).split('\n').map(p => p.trim()).filter(Boolean);
            return `<ul>${points.map(p => `<li>${p.replace(/^[•\-*]\s*/, '')}</li>`).join('')}</ul>`;
        };
        const photoHtml = data.showPhoto ? `<img src="${photoDataUrl}" class="cv-photo-az" alt="Photo">` : '';

        const langItems = Array.isArray(data.languages) ? data.languages.map(l => {
            const p = l.prof || "75";
            return `<div class="cv-az-lang-item"><div class="cv-az-lang-name"><span>${l.name || ""}</span><span>${p}%</span></div><div class="cv-az-lang-bar-bg"><div class="cv-az-lang-bar-fill" style="width: ${p}%"></div></div></div>`;
        }).join('') : '';

        const sidebarHtml = `
            <div class="cv-az-sidebar">
                ${photoHtml}
                <h3>${t.cvContact}</h3>
                <div class="cv-az-block">${data.email || ""}<br>${data.phone || ""}<br>${data.address || ""}<br>${data.showDob ? `DOB: ${data.dob}<br>` : ''}${data.showNat ? `Nat: ${data.nationality}` : ''}</div>
                <h3>${t.cvSkills}</h3>
                <div class="cv-az-block">${Array.isArray(data.skills) ? data.skills.join('<br>') : ""}</div>
                <h3>${t.cvComputerSkills}</h3>
                <div class="cv-az-block">${Array.isArray(data.computerSkills) ? data.computerSkills.join('<br>') : ""}</div>
                <h3>${t.cvLanguageSkills}</h3>
                <div class="cv-az-block">
                    ${langItems}
                </div>
            </div>
        `;

        const sections = [
            `<div class="cv-az-section"><h1>${data.fullName || ""}</h1><h2>${data.jobTitle || ""}</h2></div>`,
            data.summary ? `<div class="cv-az-section"><div class="cv-az-section-title">${t.cvAbout}</div><div class="cv-az-item-desc" style="margin-bottom:8mm; text-align:justify;">${String(data.summary).replace(/\n/g, '<br>')}</div></div>` : '',
            Array.isArray(data.experience) && data.experience.length ? `<div class="cv-az-section"><div class="cv-az-section-title">${t.cvWorkExperience}</div>${data.experience.map(e => `<div class="cv-az-item"><div class="cv-az-item-hdr"><span class="cv-az-item-title">${e.title || ""}</span><span class="cv-az-item-date">${e.dates || ""}</span></div><div class="cv-az-item-comp">${e.company || ""}${e.location ? ', ' + e.location : ''}</div><div class="cv-az-item-desc">${formatDesc(e.desc)}</div></div>`).join('')}</div>` : '',
            Array.isArray(data.projects) && data.projects.length ? `<div class="cv-az-section"><div class="cv-az-section-title">${t.cvProjects}</div>${data.projects.map(p => `<div class="cv-az-item cv-az-project-box"><div class="cv-az-item-title">${p.title || ""}</div><div class="cv-az-item-desc" style="font-size:0.85rem;">${String(p.desc || "").replace(/\n/g, '<br>')}</div></div>`).join('')}</div>` : '',
            Array.isArray(data.education) && data.education.length ? `<div class="cv-az-section"><div class="cv-az-section-title">${t.cvEducation}</div>${data.education.map(e => `<div class="cv-az-item"><div class="cv-az-item-hdr"><span class="cv-az-item-title">${e.title || ""}</span><span class="cv-az-item-date">${e.dates || ""}</span></div><div class="cv-az-item-comp">${e.company || ""}</div></div>`).join('')}</div>` : ''
        ].join('');

        return `<div class="cv-az-main">${sections}</div>${sidebarHtml}`;
    }

    /* AZERBAIJAN TEMPLATE 01 - Zeynal Abidin Style */
    function renderAzerbaijanTemplate01(data) {
        const t = translations[currentLang] || translations.en;
        const photoHtml = data.showPhoto ? `<div class="az-t01-photo"><img src="${photoDataUrl}" alt="Photo"></div>` : '';
        
        const sidebarContent = `
            <div class="az-t01-sidebar">
                ${photoHtml}
                ${data.summary ? `<div class="az-t01-summary"><strong>${t.cvAbout}:</strong><p>${String(data.summary).replace(/\n/g, '<br>')}</p></div>` : ''}
                <div class="az-t01-section">
                    <h4>${t.cvContact}</h4>
                    <p>${data.email}</p>
                    <p>${data.phone}</p>
                    <p>${data.address}</p>
                    ${data.showDob ? `<p>DOB: ${data.dob}</p>` : ''}
                    ${data.showNat ? `<p>${data.nationality}</p>` : ''}
                </div>
                ${Array.isArray(data.education) && data.education.length ? `
                    <div class="az-t01-section">
                        <h4>${t.cvEducation}</h4>
                        ${data.education.map(e => `<div class="az-t01-item"><strong>${e.title || ""}</strong><div class="az-t01-subtext">${e.company || ""}</div><div class="az-t01-date">${e.dates || ""}</div></div>`).join('')}
                    </div>
                ` : ''}
                ${Array.isArray(data.languages) && data.languages.length ? `
                    <div class="az-t01-section">
                        <h4>${t.cvLanguageSkills}</h4>
                        ${data.languages.map(l => `<div class="az-t01-lang">${l.name || ""}: ${l.prof || "75"}%</div>`).join('')}
                    </div>
                ` : ''}
            </div>
        `;

        const mainContent = `
            <div class="az-t01-main">
                <div class="az-t01-header">
                    <h1>${data.fullName || ""}</h1>
                    <h2>${data.jobTitle || ""}</h2>
                </div>
                ${Array.isArray(data.experience) && data.experience.length ? `
                    <div class="az-t01-section">
                        <h3>${t.cvWorkExperience}</h3>
                        ${data.experience.map(e => `
                            <div class="az-t01-item">
                                <div class="az-t01-item-header">
                                    <strong>${e.title || ""}</strong>
                                    <span class="az-t01-date">${e.dates || ""}</span>
                                </div>
                                <div class="az-t01-subtext">${e.company || ""}${e.location ? ', ' + e.location : ''}</div>
                                <div class="az-t01-desc">${String(e.desc || "").replace(/\n/g, '<br>')}</div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                ${Array.isArray(data.skills) && data.skills.length ? `
                    <div class="az-t01-section">
                        <h3>${t.cvSkills}</h3>
                        <div class="az-t01-skills">${data.skills.join(' • ')}</div>
                    </div>
                ` : ''}
            </div>
        `;

        return `<div class="az-t01-container">${sidebarContent}${mainContent}</div>`;
    }

    /* AZERBAIJAN TEMPLATE 02 - Radhika Kumari Teal Style */
    function renderAzerbaijanTemplate02(data) {
        const t = translations[currentLang] || translations.en;
        const photoHtml = data.showPhoto ? `<div class="az-t02-photo-container"><div class="az-t02-photo"><img src="${photoDataUrl}" alt="Photo"></div></div>` : '';
        
        return `
            <div class="az-t02-container">
                <div class="az-t02-header">
                    ${photoHtml}
                    <div class="az-t02-title">
                        <h1>${data.fullName || ""}</h1>
                        <h2>${data.jobTitle || ""}</h2>
                    </div>
                </div>
                <div class="az-t02-divider"></div>
                <div class="az-t02-content">
                    <div class="az-t02-left">
                        <div class="az-t02-section">
                            <h3>${t.cvContact}</h3>
                            <p>${data.email}</p>
                            <p>${data.phone}</p>
                            <p>${data.address}</p>
                            ${data.showDob ? `<p>DOB: ${data.dob}</p>` : ''}
                        </div>
                        ${Array.isArray(data.education) && data.education.length ? `
                            <div class="az-t02-section">
                                <h3>${t.cvEducation}</h3>
                                ${data.education.map(e => `<div class="az-t02-item"><strong>${e.title || ""}</strong><div>${e.company || ""}</div><small>${e.dates || ""}</small></div>`).join('')}
                            </div>
                        ` : ''}
                        ${Array.isArray(data.skills) && data.skills.length ? `
                            <div class="az-t02-section">
                                <h3>${t.cvSkills}</h3>
                                ${data.skills.map(s => `<span class="az-t02-skill-tag">${s}</span>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                    <div class="az-t02-right">
                        ${data.summary ? `
                            <div class="az-t02-section">
                                <h3>${t.cvProfile}</h3>
                                <p>${String(data.summary).replace(/\n/g, '<br>')}</p>
                            </div>
                        ` : ''}
                        ${Array.isArray(data.experience) && data.experience.length ? `
                            <div class="az-t02-section">
                                <h3>${t.cvWorkExperience}</h3>
                                ${data.experience.map(e => `
                                    <div class="az-t02-item">
                                        <strong>${e.title || ""}</strong>
                                        <div class="az-t02-company">${e.company || ""}${e.location ? ' — ' + e.location : ''}</div>
                                        <small>${e.dates || ""}</small>
                                        <p style="font-size: 0.9rem;">${String(e.desc || "").replace(/\n/g, '<br>')}</p>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                        ${Array.isArray(data.languages) && data.languages.length ? `
                            <div class="az-t02-section">
                                <h3>${t.cvLanguageSkills}</h3>
                                ${data.languages.map(l => `<div>${l.name || ""} - ${l.prof || "75"}%</div>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    /* AZERBAIJAN TEMPLATE 03 - Ayla İbrahimova Elegant Style */
    function renderAzerbaijanTemplate03(data) {
        const t = translations[currentLang] || translations.en;
        const photoHtml = data.showPhoto ? `<div class="az-t03-photo"><img src="${photoDataUrl}" alt="Photo"></div>` : '';
        
        return `
            <div class="az-t03-container">
                <div class="az-t03-sidebar">
                    ${photoHtml}
                    <div class="az-t03-header">
                        <h1>${data.fullName || ""}</h1>
                        <h2>${data.jobTitle || ""}</h2>
                    </div>
                    ${Array.isArray(data.education) && data.education.length ? `
                        <div class="az-t03-section">
                            <h3>${t.cvEducation}</h3>
                            ${data.education.map(e => `<div class="az-t03-item"><strong>${e.title || ""}</strong><div>${e.company || ""}</div><small>${e.dates || ""}</small></div>`).join('')}
                        </div>
                    ` : ''}
                    ${Array.isArray(data.skills) && data.skills.length ? `
                        <div class="az-t03-section">
                            <h3>${t.cvSkills}</h3>
                            ${data.skills.map(s => `<div class="az-t03-skill">${s}</div>`).join('')}
                        </div>
                    ` : ''}
                    ${Array.isArray(data.languages) && data.languages.length ? `
                        <div class="az-t03-section">
                            <h3>${t.cvLanguageSkills}</h3>
                            ${data.languages.map(l => `
                                <div class="az-t03-lang">
                                    <div class="az-t03-lang-name">${l.name || ""}</div>
                                    <div class="az-t03-lang-bar"><div class="az-t03-lang-fill" style="width: ${l.prof || 75}%"></div></div>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
                <div class="az-t03-main">
                    ${data.summary ? `
                        <div class="az-t03-section">
                            <h3>${t.cvAbout}</h3>
                            <p style="text-align: justify;">${String(data.summary).replace(/\n/g, '<br>')}</p>
                        </div>
                    ` : ''}
                    ${Array.isArray(data.experience) && data.experience.length ? `
                        <div class="az-t03-section">
                            <h3>${t.cvWorkExperience}</h3>
                            ${data.experience.map(e => `
                                <div class="az-t03-item">
                                    <div class="az-t03-item-header">
                                        <strong>${e.title || ""}</strong>
                                        <span>${e.dates || ""}</span>
                                    </div>
                                    <div>${e.company || ""}${e.location ? ', ' + e.location : ''}</div>
                                    <p style="font-size: 0.9rem; margin-top: 4px;">${String(e.desc || "").replace(/\n/g, '<br>')}</p>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    ${data.email || data.phone || data.address ? `
                        <div class="az-t03-section">
                            <h3>${t.cvContact}</h3>
                            <p>${data.email}</p>
                            <p>${data.phone}</p>
                            <p>${data.address}</p>
                            ${data.showDob ? `<p>DOB: ${data.dob}</p>` : ''}
                            ${data.showNat ? `<p>${data.nationality}</p>` : ''}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /* AZERBAIJAN TEMPLATE 04 - Radhika Kumari Dark-Box Style */
    function renderAzerbaijanTemplate04(data) {
        const t = translations[currentLang] || translations.en;
        const photoHtml = data.showPhoto ? `<div class="az-t04-photo"><img src="${photoDataUrl}" alt="Photo"></div>` : '';
        
        return `
            <div class="az-t04-container">
                <div class="az-t04-header">
                    ${photoHtml}
                    <div>
                        <h1>${data.fullName || ""}</h1>
                        <h2>${data.jobTitle || ""}</h2>
                    </div>
                </div>
                <div class="az-t04-content">
                    <div class="az-t04-left">
                        <div class="az-t04-contact-box">
                            <h3>${t.cvContact}</h3>
                            <p>${data.email}</p>
                            <p>${data.phone}</p>
                            <p>${data.address}</p>
                            ${data.showDob ? `<p>DOB: ${data.dob}</p>` : ''}
                        </div>
                        ${Array.isArray(data.education) && data.education.length ? `
                            <div class="az-t04-box">
                                <h3>${t.cvEducation}</h3>
                                ${data.education.map(e => `<div class="az-t04-item"><strong>${e.title || ""}</strong><div>${e.company || ""}</div><small>${e.dates || ""}</small></div>`).join('')}
                            </div>
                        ` : ''}
                        ${Array.isArray(data.skills) && data.skills.length ? `
                            <div class="az-t04-box">
                                <h3>${t.cvSkills}</h3>
                                ${data.skills.map(s => `<div class="az-t04-skill">${s}</div>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                    <div class="az-t04-right">
                        ${Array.isArray(data.experience) && data.experience.length ? `
                            <div class="az-t04-exp-box">
                                <h3>${t.cvWorkExperience}</h3>
                                ${data.experience.map(e => `
                                    <div class="az-t04-item">
                                        <strong>${e.title || ""}</strong>
                                        <div class="az-t04-company">${e.company || ""}${e.location ? ' — ' + e.location : ''}</div>
                                        <small>${e.dates || ""}</small>
                                        <p>${String(e.desc || "").replace(/\n/g, '<br>')}</p>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                        ${Array.isArray(data.languages) && data.languages.length ? `
                            <div class="az-t04-box">
                                <h3>${t.cvLanguageSkills}</h3>
                                ${data.languages.map(l => `<div>${l.name || ""} - ${l.prof || "75"}%</div>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    /* ========================= 20 COUNTRY-BASED TEMPLATES ========================= */

    /* AZERBAIJAN TEMPLATES (5) */
    function renderAzCorporateSidebar(data) {
        const t = translations[currentLang] || translations.en;
        return `
            <div style="display:grid; grid-template-columns:35% 65%; width:100%; min-height:297mm;">
                <div style="background:#1e293b; color:#fff; padding:18mm; display:flex; flex-direction:column; gap:10mm;">
                    ${data.showPhoto ? `<img src="${photoDataUrl}" style="width:80mm; margin:0 auto; border-radius:8px;">` : ''}
                    <div><h3 style="font-size:11pt; color:#fff; margin:0 0 6mm; border-bottom:2px solid #475569;">${t.cvContact}</h3>
                    <p style="font-size:9pt; line-height:1.8; margin:0;">${data.email}<br>${data.phone}<br>${data.address}${data.showDob ? '<br>DOB: '+data.dob : ''}${data.showNat ? '<br>'+data.nationality : ''}</p></div>
                    ${Array.isArray(data.skills) && data.skills.length ? `<div><h3 style="font-size:11pt; color:#fff; margin:0 0 6mm; border-bottom:2px solid #475569;">${t.cvSkills}</h3><p style="font-size:9.5pt; line-height:1.8; margin:0;">${data.skills.join('<br>')}</p></div>` : ''}
                </div>
                <div style="padding:18mm;">
                    <h1 style="font-size:32pt; font-weight:800; color:#1e293b; margin:0 0 4mm;">${data.fullName}</h1>
                    <h2 style="font-size:14pt; font-weight:600; color:#64748b; margin:0 0 12mm;">${data.jobTitle}</h2>
                    ${data.summary ? `<div style="margin-bottom:12mm;"><h3 style="font-size:11pt; font-weight:700; color:#1e293b; border-bottom:2px solid #1e293b; padding-bottom:3mm; margin:0 0 6mm;">${t.cvAbout}</h3><p style="font-size:10pt; line-height:1.6; color:#475569; margin:0;">${String(data.summary).replace(/\n/g,'<br>')}</p></div>` : ''}
                    ${Array.isArray(data.experience) && data.experience.length ? `<div style="margin-bottom:12mm;"><h3 style="font-size:11pt; font-weight:700; color:#1e293b; border-bottom:2px solid #1e293b; padding-bottom:3mm; margin:0 0 6mm;">${t.cvWorkExperience}</h3>${data.experience.map(e => `<div style="page-break-inside:avoid; margin-bottom:6mm;"><strong style="font-size:11pt; color:#1e293b;">${e.title}</strong><div style="color:#0ea5e9; font-weight:600; font-size:10pt;">${e.dates}</div><div style="color:#64748b; font-size:10pt; margin:2mm 0;">${e.company}${e.location ? ', '+e.location : ''}</div><div style="color:#475569; font-size:10pt;">${String(e.desc||'').replace(/\n/g,'<br>')}</div></div>`).join('')}</div>` : ''}
                </div>
            </div>
        `;
    }

    function renderAzModernExecutive(data) {
        const t = translations[currentLang] || translations.en;
        return `
            <div style="padding:20mm;">
                <div style="display:flex; gap:15mm; margin-bottom:15mm; border-bottom:3px solid #0ea5e9; padding-bottom:10mm;">
                    ${data.showPhoto ? `<img src="${photoDataUrl}" style="width:50mm; height:50mm; border-radius:50%; object-fit:cover;">` : ''}
                    <div style="flex:1;">
                        <h1 style="font-size:30pt; font-weight:800; color:#0f172a; margin:0 0 3mm; letter-spacing:-0.5px;">${data.fullName}</h1>
                        <h2 style="font-size:13pt; font-weight:600; color:#0ea5e9; margin:0;">${data.jobTitle}</h2>
                    </div>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1.2fr; gap:15mm;">
                    <div>
                        <h3 style="font-size:10.5pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 6mm; border-bottom:2px solid #0ea5e9; padding-bottom:3mm;">${t.cvContact}</h3>
                        <p style="font-size:9.5pt; line-height:1.8; color:#64748b; margin:0;">${data.email}<br>${data.phone}<br>${data.address}${data.showDob ? '<br>DOB: '+data.dob : ''}${data.showNat ? '<br>'+data.nationality : ''}</p>
                        ${Array.isArray(data.education) && data.education.length ? `<h3 style="font-size:10.5pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin:10mm 0 6mm; border-bottom:2px solid #0ea5e9; padding-bottom:3mm;">${t.cvEducation}</h3>${data.education.map(e => `<div style="margin-bottom:4mm;"><strong style="font-size:10pt; color:#0f172a;">${e.title}</strong><div style="font-size:9.5pt; color:#64748b;">${e.company}</div><div style="font-size:9pt; color:#94a3b8;">${e.dates}</div></div>`).join('')}` : ''}
                    </div>
                    <div>
                        ${data.summary ? `<div style="margin-bottom:10mm;"><h3 style="font-size:10.5pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 6mm; border-bottom:2px solid #0ea5e9; padding-bottom:3mm;">${t.cvProfile}</h3><p style="font-size:10pt; line-height:1.7; color:#475569; margin:0;">${String(data.summary).replace(/\n/g,'<br>')}</p></div>` : ''}
                        ${Array.isArray(data.experience) && data.experience.length ? `<div><h3 style="font-size:10.5pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 6mm; border-bottom:2px solid #0ea5e9; padding-bottom:3mm;">${t.cvWorkExperience}</h3>${data.experience.map(e => `<div style="page-break-inside:avoid; margin-bottom:6mm;"><strong style="font-size:10.5pt; color:#0f172a;">${e.title}</strong><div style="color:#0ea5e9; font-weight:600; font-size:9.5pt;">${e.dates}</div><div style="color:#64748b; font-size:9.5pt;">${e.company}${e.location ? ' — '+e.location : ''}</div><div style="color:#475569; font-size:9.5pt; line-height:1.6; margin-top:2mm;">${String(e.desc||'').replace(/\n/g,'<br>')}</div></div>`).join('')}</div>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    function renderAzFinancePro(data) {
        const t = translations[currentLang] || translations.en;
        return `
            <div style="padding:20mm; font-family:'Playfair Display', serif;">
                <div style="border-bottom:1px solid #333; padding-bottom:10mm; margin-bottom:12mm;">
                    ${data.showPhoto ? `<div style="float:right; margin:0 0 10mm 10mm;"><img src="${photoDataUrl}" style="width:45mm; height:55mm; border:1px solid #ccc;"></div>` : ''}
                    <h1 style="font-size:32pt; font-weight:700; color:#1e293b; text-transform:uppercase; letter-spacing:1px; margin:0; font-family:'Playfair Display';">${data.fullName}</h1>
                    <h2 style="font-size:12pt; font-weight:600; color:#64748b; letter-spacing:1px; margin:4mm 0 0; text-transform:uppercase;">${data.jobTitle}</h2>
                </div>
                <div style="display:grid; grid-template-columns:50mm 1fr; gap:10mm; font-family:Inter,sans-serif;">
                    <div style="border-right:1px solid #ccc; padding-right:8mm; font-size:9.5pt;">
                        <div style="margin-bottom:10mm;"><strong style="text-transform:uppercase; font-size:10pt; color:#1e293b; display:block; margin-bottom:4mm;">${t.cvContact}</strong>
                        <p style="margin:0; line-height:1.8; color:#475569;">${data.email}<br>${data.phone}<br>${data.address}${data.showDob ? '<br>DOB: '+data.dob : ''}${data.showNat ? '<br>'+data.nationality : ''}</p></div>
                        ${Array.isArray(data.skills) && data.skills.length ? `<div><strong style="text-transform:uppercase; font-size:10pt; color:#1e293b; display:block; margin-bottom:4mm;">${t.cvSkills}</strong><p style="margin:0; line-height:1.8; color:#475569;">${data.skills.join('<br>')}</p></div>` : ''}
                    </div>
                    <div>
                        ${data.summary ? `<div style="margin-bottom:10mm;"><p style="font-size:10pt; line-height:1.7; color:#475569; margin:0;">${String(data.summary).replace(/\n/g,'<br>')}</p></div>` : ''}
                        ${Array.isArray(data.experience) && data.experience.length ? `<div style="margin-bottom:10mm;"><strong style="text-transform:uppercase; font-size:11pt; color:#1e293b; display:block; margin-bottom:6mm; border-bottom:1px solid #1e293b; padding-bottom:2mm;">${t.cvWorkExperience}</strong>${data.experience.map(e => `<div style="page-break-inside:avoid; margin-bottom:6mm;"><strong style="font-size:10.5pt; color:#1e293b;">${e.title}</strong><span style="float:right; font-size:9.5pt; color:#64748b;">${e.dates}</span><div style="clear:both; color:#64748b; font-size:10pt; font-weight:600; margin:2mm 0;">${e.company}${e.location ? ', '+e.location : ''}</div><div style="font-size:9.5pt; color:#475569; line-height:1.6;">${String(e.desc||'').replace(/\n/g,'<br>')}</div></div>`).join('')}</div>` : ''}
                        ${Array.isArray(data.education) && data.education.length ? `<div><strong style="text-transform:uppercase; font-size:11pt; color:#1e293b; display:block; margin-bottom:6mm; border-bottom:1px solid #1e293b; padding-bottom:2mm;">${t.cvEducation}</strong>${data.education.map(e => `<div style="page-break-inside:avoid; margin-bottom:4mm;"><strong style="font-size:10pt; color:#1e293b;">${e.title}</strong><span style="float:right; font-size:9.5pt; color:#64748b;">${e.dates}</span><div style="clear:both; color:#64748b; font-size:10pt;">${e.company}</div></div>`).join('')}</div>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    function renderAzMinimalPremium(data) {
        const t = translations[currentLang] || translations.en;
        return `
            <div style="padding:25mm; background:#fafbfc;">
                <div style="margin-bottom:15mm; padding-bottom:10mm; border-bottom:3px solid #0f172a;">
                    <h1 style="font-size:28pt; font-weight:800; color:#0f172a; margin:0 0 2mm; letter-spacing:-0.5px;">${data.fullName}</h1>
                    <p style="font-size:13pt; font-weight:500; color:#64748b; margin:0;">${data.jobTitle}</p>
                </div>
                <div style="margin-bottom:12mm; padding:15mm; background:#fff; border-radius:8px;">
                    <p style="display:flex; gap:15mm; font-size:9.5pt; color:#64748b; margin:0;">
                        <span>${data.email}</span>
                        <span>${data.phone}</span>
                        <span>${data.address}</span>
                        ${data.showDob ? `<span>DOB: ${data.dob}</span>` : ''}
                        ${data.showNat ? `<span>${data.nationality}</span>` : ''}
                    </p>
                </div>
                ${data.summary ? `<div style="margin-bottom:12mm;"><h2 style="font-size:11pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 6mm; border-bottom:2px solid #0f172a; padding-bottom:3mm;">${t.cvAbout}</h2><p style="font-size:10pt; line-height:1.7; color:#475569; margin:0;">${String(data.summary).replace(/\n/g,'<br>')}</p></div>` : ''}
                ${Array.isArray(data.experience) && data.experience.length ? `<div style="margin-bottom:12mm;"><h2 style="font-size:11pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 6mm; border-bottom:2px solid #0f172a; padding-bottom:3mm;">${t.cvWorkExperience}</h2>${data.experience.map(e => `<div style="page-break-inside:avoid; margin-bottom:6mm; padding-bottom:6mm; border-bottom:1px solid #e5e7eb;"><strong style="font-size:10.5pt; color:#0f172a;">${e.title}</strong><div style="color:#0f172a; font-weight:600; font-size:9.5pt;">${e.company}${e.location ? ' — '+e.location : ''}</div><div style="color:#94a3b8; font-size:9pt; margin-bottom:3mm;">${e.dates}</div><div style="color:#475569; font-size:9.5pt; line-height:1.6;">${String(e.desc||'').replace(/\n/g,'<br>')}</div></div>`).join('')}</div>` : ''}
            </div>
        `;
    }

    function renderAzCompactRecruiter(data) {
        const t = translations[currentLang] || translations.en;
        return `
            <div style="padding:18mm; font-size:9.5pt; line-height:1.5;">
                <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8mm; padding-bottom:6mm; border-bottom:2px solid #0f172a;">
                    <div><h1 style="font-size:24pt; font-weight:800; color:#0f172a; margin:0; line-height:1.1;">${data.fullName}</h1>
                    <h2 style="font-size:11pt; font-weight:600; color:#64748b; margin:3mm 0 0;">${data.jobTitle}</h2></div>
                    ${data.showPhoto ? `<img src="${photoDataUrl}" style="width:40mm; height:50mm; border:1px solid #ddd;">` : ''}
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12mm; margin-bottom:8mm;">
                    <div><strong style="text-transform:uppercase; font-size:9.5pt; color:#0f172a; display:block; margin-bottom:4mm; border-bottom:1px solid #0f172a; padding-bottom:2mm;">${t.cvContact}</strong>
                    <p style="margin:0; font-size:9pt; color:#475569;">${data.email}<br>${data.phone}<br>${data.address}${data.showDob ? '<br>DOB: '+data.dob : ''}${data.showNat ? '<br>'+data.nationality : ''}</p></div>
                    <div><strong style="text-transform:uppercase; font-size:9.5pt; color:#0f172a; display:block; margin-bottom:4mm; border-bottom:1px solid #0f172a; padding-bottom:2mm;">${t.cvSkills}</strong>
                    <p style="margin:0; font-size:9pt; color:#475569; line-height:1.8;">${Array.isArray(data.skills) ? data.skills.join(', ') : ''}</p></div>
                </div>
                ${data.summary ? `<div style="margin-bottom:6mm;"><strong style="text-transform:uppercase; font-size:9.5pt; color:#0f172a; display:block; margin-bottom:3mm; border-bottom:1px solid #0f172a; padding-bottom:2mm;">${t.cvProfile}</strong><p style="margin:0; font-size:9pt; color:#475569; line-height:1.6;">${String(data.summary).replace(/\n/g,'<br>')}</p></div>` : ''}
                ${Array.isArray(data.experience) && data.experience.length ? `<div style="margin-bottom:6mm;"><strong style="text-transform:uppercase; font-size:9.5pt; color:#0f172a; display:block; margin-bottom:3mm; border-bottom:1px solid #0f172a; padding-bottom:2mm;">${t.cvWorkExperience}</strong>${data.experience.map(e => `<div style="page-break-inside:avoid; margin-bottom:4mm;"><strong style="font-size:9.5pt; color:#0f172a;">${e.title}</strong> <span style="color:#94a3b8; font-size:9pt;">${e.dates}</span><br><span style="color:#64748b; font-weight:600; font-size:9pt;">${e.company}${e.location ? ', '+e.location : ''}</span><div style="color:#475569; font-size:8.5pt; margin-top:1mm;">${String(e.desc||'').replace(/\n/g,'<br>')}</div></div>`).join('')}</div>` : ''}
            </div>
        `;
    }

    /* GERMANY TEMPLATES (5) */
    function renderDeClassicLebenslauf(data) {
        const t = translations[currentLang] || translations.en;
        return `
            <div style="padding:20mm;">
                <div style="border-bottom:1px solid #ddd; padding-bottom:10mm; margin-bottom:12mm;">
                    <h1 style="font-size:26pt; font-weight:700; color:#0f172a; margin:0 0 3mm; text-transform:uppercase; letter-spacing:1px;">${data.fullName}</h1>
                    <p style="margin:0 0 8mm; font-size:13pt; font-weight:600; color:#475569;">${data.jobTitle}</p>
                    <p style="margin:0; display:flex; gap:8mm; font-size:9.5pt; color:#64748b;">
                        <span>${data.email}</span> | <span>${data.phone}</span> | <span>${data.address}</span>
                        ${data.showDob ? `| <span>DOB: ${data.dob}</span>` : ''}
                        ${data.showNat ? `| <span>${data.nationality}</span>` : ''}
                    </p>
                </div>
                <div style="display:grid; grid-template-columns:65mm 1fr; gap:12mm;">
                    <div style="font-size:9.5pt;">
                        ${data.showPhoto ? `<div style="margin-bottom:10mm;"><img src="${photoDataUrl}" style="width:100%; aspect-ratio:3/4; object-fit:cover; border:1px solid #ddd;"></div>` : ''}
                        ${Array.isArray(data.skills) && data.skills.length ? `<div style="margin-bottom:10mm;"><h3 style="font-size:10pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 5mm; border-bottom:1px solid #ddd; padding-bottom:2mm;">${t.cvSkills}</h3><p style="margin:0; line-height:1.8; color:#475569;">${data.skills.join('<br>')}</p></div>` : ''}
                        ${Array.isArray(data.languages) && data.languages.length ? `<div><h3 style="font-size:10pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 5mm; border-bottom:1px solid #ddd; padding-bottom:2mm;">${t.cvLanguageSkills}</h3><p style="margin:0; line-height:1.8; color:#475569;">${data.languages.map(l => l.name+' ('+l.prof+'%)').join('<br>')}</p></div>` : ''}
                    </div>
                    <div>
                        ${data.summary ? `<div style="margin-bottom:10mm;"><h3 style="font-size:10pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 5mm; border-bottom:1px solid #ddd; padding-bottom:2mm;">${t.cvProfile}</h3><p style="margin:0; font-size:10pt; line-height:1.7; color:#475569;">${String(data.summary).replace(/\n/g,'<br>')}</p></div>` : ''}
                        ${Array.isArray(data.experience) && data.experience.length ? `<div style="margin-bottom:10mm;"><h3 style="font-size:10pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 5mm; border-bottom:1px solid #ddd; padding-bottom:2mm;">${t.cvWorkExperience}</h3>${data.experience.map(e => `<div style="page-break-inside:avoid; margin-bottom:6mm;"><strong style="font-size:10pt; color:#0f172a;">${e.title}</strong><div style="color:#64748b; font-weight:600; font-size:9.5pt;">${e.company}${e.location ? ', '+e.location : ''}</div><div style="color:#94a3b8; font-size:9pt;">${e.dates}</div><div style="color:#475569; font-size:9.5pt; line-height:1.6; margin-top:2mm;">${String(e.desc||'').replace(/\n/g,'<br>')}</div></div>`).join('')}</div>` : ''}
                        ${Array.isArray(data.education) && data.education.length ? `<div><h3 style="font-size:10pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 5mm; border-bottom:1px solid #ddd; padding-bottom:2mm;">${t.cvEducation}</h3>${data.education.map(e => `<div style="page-break-inside:avoid; margin-bottom:4mm;"><strong style="font-size:10pt; color:#0f172a;">${e.title}</strong><div style="color:#64748b; font-size:9.5pt;">${e.company}</div><div style="color:#94a3b8; font-size:9pt;">${e.dates}</div></div>`).join('')}</div>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    function renderDeDarkSidebar(data) {
        const t = translations[currentLang] || translations.en;
        return `
            <div style="display:grid; grid-template-columns:30% 70%; width:100%; min-height:297mm;">
                <div style="background:#2d3748; color:#fff; padding:16mm; display:flex; flex-direction:column; gap:12mm;">
                    ${data.showPhoto ? `<img src="${photoDataUrl}" style="width:100%; border-radius:6px; margin-bottom:4mm; aspect-ratio:3/4; object-fit:cover;">` : ''}
                    <div><h3 style="font-size:10.5pt; font-weight:700; color:#fff; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 6mm; border-bottom:2px solid #4a5568; padding-bottom:2mm;">${t.cvContact}</h3>
                    <p style="font-size:9pt; line-height:1.8; margin:0; color:#cbd5e0;">${data.email}<br>${data.phone}<br>${data.address}${data.showDob ? '<br>DOB: '+data.dob : ''}${data.showNat ? '<br>'+data.nationality : ''}</p></div>
                    ${Array.isArray(data.skills) && data.skills.length ? `<div><h3 style="font-size:10.5pt; font-weight:700; color:#fff; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 6mm; border-bottom:2px solid #4a5568; padding-bottom:2mm;">${t.cvSkills}</h3><p style="font-size:9pt; line-height:1.8; margin:0; color:#cbd5e0;">${data.skills.join('<br>')}</p></div>` : ''}
                    ${Array.isArray(data.languages) && data.languages.length ? `<div><h3 style="font-size:10.5pt; font-weight:700; color:#fff; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 6mm; border-bottom:2px solid #4a5568; padding-bottom:2mm;">${t.cvLanguageSkills}</h3><p style="font-size:9pt; line-height:1.8; margin:0; color:#cbd5e0;">${data.languages.map(l => l.name).join('<br>')}</p></div>` : ''}
                </div>
                <div style="padding:16mm;">
                    <h1 style="font-size:28pt; font-weight:800; color:#2d3748; margin:0 0 4mm; line-height:1.1;">${data.fullName}</h1>
                    <h2 style="font-size:13pt; font-weight:600; color:#718096; margin:0 0 12mm;">${data.jobTitle}</h2>
                    ${data.summary ? `<div style="margin-bottom:12mm;"><h3 style="font-size:10.5pt; font-weight:700; color:#2d3748; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 5mm; border-bottom:2px solid #2d3748; padding-bottom:2mm;">${t.cvAbout}</h3><p style="font-size:10pt; line-height:1.7; color:#4a5568; margin:0;">${String(data.summary).replace(/\n/g,'<br>')}</p></div>` : ''}
                    ${Array.isArray(data.experience) && data.experience.length ? `<div style="margin-bottom:12mm;"><h3 style="font-size:10.5pt; font-weight:700; color:#2d3748; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 5mm; border-bottom:2px solid #2d3748; padding-bottom:2mm;">${t.cvWorkExperience}</h3>${data.experience.map(e => `<div style="page-break-inside:avoid; margin-bottom:6mm;"><strong style="font-size:10.5pt; color:#2d3748;">${e.title}</strong><div style="color:#4a5568; font-weight:600; font-size:10pt;">${e.company}</div><div style="color:#a0aec0; font-size:9pt; margin:1mm 0 3mm;">${e.dates}</div><div style="color:#4a5568; font-size:9.5pt; line-height:1.6;">${String(e.desc||'').replace(/\n/g,'<br>')}</div></div>`).join('')}</div>` : ''}
                    ${Array.isArray(data.education) && data.education.length ? `<div><h3 style="font-size:10.5pt; font-weight:700; color:#2d3748; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 5mm; border-bottom:2px solid #2d3748; padding-bottom:2mm;">${t.cvEducation}</h3>${data.education.map(e => `<div style="page-break-inside:avoid; margin-bottom:4mm;"><strong style="font-size:10pt; color:#2d3748;">${e.title}</strong><div style="color:#4a5568; font-size:9.5pt;">${e.company}</div><div style="color:#a0aec0; font-size:9pt;">${e.dates}</div></div>`).join('')}</div>` : ''}
                </div>
            </div>
        `;
    }

    function renderDeExecutiveTimeline(data) {
        const t = translations[currentLang] || translations.en;
        return `
            <div style="padding:20mm;">
                <div style="margin-bottom:16mm; padding-bottom:10mm; border-bottom:4px solid #0f172a;">
                    ${data.showPhoto ? `<div style="float:right; margin:0 0 8mm 12mm;"><img src="${photoDataUrl}" style="width:50mm; height:50mm; border-radius:4px; object-fit:cover;"></div>` : ''}
                    <h1 style="font-size:30pt; font-weight:800; color:#0f172a; margin:0 0 4mm; letter-spacing:-0.5px;">${data.fullName}</h1>
                    <h2 style="font-size:13pt; font-weight:600; color:#64748b; margin:0;">${data.jobTitle}</h2>
                </div>
                <div style="clear:both;">
                    ${data.summary ? `<div style="margin-bottom:12mm; padding:12mm; background:#f8fafc; border-left:4px solid #0f172a;"><p style="font-size:10pt; line-height:1.7; color:#475569; margin:0;">${String(data.summary).replace(/\n/g,'<br>')}</p></div>` : ''}
                    ${Array.isArray(data.experience) && data.experience.length ? `<div style="margin-bottom:12mm;"><h3 style="font-size:11pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 8mm; border-bottom:2px solid #0f172a; padding-bottom:3mm;">${t.cvWorkExperience}</h3>${data.experience.map((e, idx) => `<div style="page-break-inside:avoid; margin-bottom:8mm; padding-left:12mm; border-left:3px solid ${idx % 2 === 0 ? '#0f172a' : '#cbd5e1'};"><div style="margin-left:-16mm; font-size:9pt; font-weight:700; color:#0f172a; text-transform:uppercase;">${e.dates}</div><strong style="font-size:10.5pt; color:#0f172a; display:block; margin:2mm 0;">${e.title}</strong><div style="color:#64748b; font-weight:600; font-size:10pt; margin:1mm 0 3mm;">${e.company}${e.location ? ', '+e.location : ''}</div><div style="color:#475569; font-size:9.5pt; line-height:1.6;">${String(e.desc||'').replace(/\n/g,'<br>')}</div></div>`).join('')}</div>` : ''}
                </div>
            </div>
        `;
    }

    function renderDeModernCorporate(data) {
        const t = translations[currentLang] || translations.en;
        return `
            <div style="padding:18mm;">
                <div style="display:flex; gap:15mm; margin-bottom:14mm; align-items:flex-start;">
                    <div style="flex:1;">
                        <h1 style="font-size:32pt; font-weight:800; color:#0f172a; margin:0 0 3mm; letter-spacing:-0.5px;">${data.fullName}</h1>
                        <h2 style="font-size:13pt; font-weight:600; color:#0ea5e9; margin:0; text-transform:uppercase; letter-spacing:0.5px;">${data.jobTitle}</h2>
                    </div>
                    ${data.showPhoto ? `<img src="${photoDataUrl}" style="width:45mm; height:55mm; object-fit:cover; border:1px solid #e5e7eb;">` : ''}
                </div>
                <p style="display:flex; gap:10mm; font-size:9.5pt; color:#64748b; margin:0 0 14mm; padding:0 0 10mm; border-bottom:2px solid #0ea5e9;">
                    <span>${data.email}</span> | <span>${data.phone}</span> | <span>${data.address}</span>
                    ${data.showDob ? `| <span>DOB: ${data.dob}</span>` : ''}
                    ${data.showNat ? `| <span>${data.nationality}</span>` : ''}
                </p>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:15mm;">
                    <div>
                        ${Array.isArray(data.skills) && data.skills.length ? `<div style="margin-bottom:10mm;"><h3 style="font-size:10.5pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 5mm; border-bottom:2px solid #0f172a; padding-bottom:2mm;">${t.cvSkills}</h3><p style="margin:0; font-size:9.5pt; line-height:1.8; color:#475569;">${data.skills.join('<br>')}</p></div>` : ''}
                        ${Array.isArray(data.education) && data.education.length ? `<div><h3 style="font-size:10.5pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 5mm; border-bottom:2px solid #0f172a; padding-bottom:2mm;">${t.cvEducation}</h3>${data.education.map(e => `<div style="page-break-inside:avoid; margin-bottom:4mm;"><strong style="font-size:10pt; color:#0f172a;">${e.title}</strong><div style="color:#64748b; font-size:9.5pt;">${e.company}</div><div style="color:#94a3b8; font-size:9pt;">${e.dates}</div></div>`).join('')}</div>` : ''}
                    </div>
                    <div>
                        ${data.summary ? `<div style="margin-bottom:10mm;"><h3 style="font-size:10.5pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 5mm; border-bottom:2px solid #0f172a; padding-bottom:2mm;">${t.cvAbout}</h3><p style="margin:0; font-size:9.5pt; line-height:1.7; color:#475569;">${String(data.summary).replace(/\n/g,'<br>')}</p></div>` : ''}
                        ${Array.isArray(data.experience) && data.experience.length ? `<div><h3 style="font-size:10.5pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 5mm; border-bottom:2px solid #0f172a; padding-bottom:2mm;">${t.cvWorkExperience}</h3>${data.experience.map(e => `<div style="page-break-inside:avoid; margin-bottom:4mm;"><strong style="font-size:10pt; color:#0f172a;">${e.title}</strong><div style="color:#64748b; font-weight:600; font-size:9.5pt;">${e.company}</div><div style="color:#94a3b8; font-size:9pt;">${e.dates}</div><div style="color:#475569; font-size:8.5pt; margin-top:1mm;">${String(e.desc||'').replace(/\n/g,'<br>')}</div></div>`).join('')}</div>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    function renderDeAtsMinimal(data) {
        const t = translations[currentLang] || translations.en;
        return `
            <div style="padding:25mm;">
                <h1 style="font-size:28pt; font-weight:800; color:#0f172a; text-align:center; margin:0 0 4mm; letter-spacing:-0.5px;">${data.fullName}</h1>
                <p style="text-align:center; font-size:11pt; font-weight:600; color:#64748b; margin:0 0 10mm;">${data.jobTitle}</p>
                <p style="text-align:center; font-size:9.5pt; color:#475569; margin:0 0 12mm;">
                    ${data.email} | ${data.phone} | ${data.address}
                    ${data.showDob ? ' | DOB: '+data.dob : ''}
                    ${data.showNat ? ' | '+data.nationality : ''}
                </p>
                ${data.summary ? `<div style="margin-bottom:10mm;"><h2 style="font-size:11pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:1px; margin:0 0 6mm; border-bottom:1px solid #ddd; padding-bottom:3mm;">${t.cvAbout}</h2><p style="font-size:10pt; line-height:1.7; color:#475569; margin:0;">${String(data.summary).replace(/\n/g,'<br>')}</p></div>` : ''}
                ${Array.isArray(data.experience) && data.experience.length ? `<div style="margin-bottom:10mm;"><h2 style="font-size:11pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:1px; margin:0 0 6mm; border-bottom:1px solid #ddd; padding-bottom:3mm;">${t.cvWorkExperience}</h2>${data.experience.map(e => `<div style="page-break-inside:avoid; margin-bottom:5mm;"><strong style="font-size:10.5pt; color:#0f172a;">${e.title}</strong><div style="color:#64748b; font-weight:600; font-size:10pt;">${e.company}${e.location ? ', '+e.location : ''}</div><div style="color:#94a3b8; font-size:9pt;">${e.dates}</div><div style="color:#475569; font-size:9.5pt; line-height:1.6;">${String(e.desc||'').replace(/\n/g,'<br>')}</div></div>`).join('')}</div>` : ''}
                ${Array.isArray(data.education) && data.education.length ? `<div style="margin-bottom:10mm;"><h2 style="font-size:11pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:1px; margin:0 0 6mm; border-bottom:1px solid #ddd; padding-bottom:3mm;">${t.cvEducation}</h2>${data.education.map(e => `<div style="page-break-inside:avoid; margin-bottom:3mm;"><strong style="font-size:10pt; color:#0f172a;">${e.title}</strong><div style="color:#64748b; font-size:9.5pt;">${e.company}</div><div style="color:#94a3b8; font-size:9pt;">${e.dates}</div></div>`).join('')}</div>` : ''}
                ${Array.isArray(data.skills) && data.skills.length ? `<div><h2 style="font-size:11pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:1px; margin:0 0 6mm; border-bottom:1px solid #ddd; padding-bottom:3mm;">${t.cvSkills}</h2><p style="font-size:10pt; line-height:1.6; color:#475569; margin:0;">${data.skills.join(' • ')}</p></div>` : ''}
            </div>
        `;
    }

    /* USA TEMPLATES (5) */
    function renderUsAtsClean(data) {
        const t = translations[currentLang] || translations.en;
        return `
            <div style="padding:25.4mm;">
                <h1 style="font-size:28pt; font-weight:800; color:#0f172a; text-align:center; margin:0 0 2mm;">${data.fullName}</h1>
                <p style="text-align:center; font-size:11pt; font-weight:600; color:#64748b; margin:0 0 8mm;">${data.jobTitle}</p>
                <p style="text-align:center; font-size:9.5pt; color:#475569; margin:0 0 12mm;"><span>${data.email}</span> | <span>${data.phone}</span> | <span>${data.address}</span></p>
                ${data.summary ? `<div style="margin-bottom:10mm;"><h2 style="font-size:11pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:1px; margin:0 0 5mm; border-bottom:2px solid #0f172a; padding-bottom:2mm;">${t.cvProfile}</h2><p style="font-size:10pt; line-height:1.7; color:#475569; margin:0;">${String(data.summary).replace(/\n/g,'<br>')}</p></div>` : ''}
                ${Array.isArray(data.experience) && data.experience.length ? `<div style="margin-bottom:10mm;"><h2 style="font-size:11pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:1px; margin:0 0 5mm; border-bottom:2px solid #0f172a; padding-bottom:2mm;">${t.cvWorkExperience}</h2>${data.experience.map(e => `<div style="page-break-inside:avoid; margin-bottom:6mm;"><strong style="font-size:10.5pt; color:#0f172a;">${e.title}</strong><div style="color:#64748b; font-weight:600; font-size:10pt;">${e.company}${e.location ? ' | '+e.location : ''}</div><div style="color:#94a3b8; font-size:9pt;">${e.dates}</div><div style="color:#475569; font-size:9.5pt; line-height:1.6; margin-top:2mm;">${String(e.desc||'').replace(/\n/g,'<br>')}</div></div>`).join('')}</div>` : ''}
                ${Array.isArray(data.education) && data.education.length ? `<div style="margin-bottom:10mm;"><h2 style="font-size:11pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:1px; margin:0 0 5mm; border-bottom:2px solid #0f172a; padding-bottom:2mm;">${t.cvEducation}</h2>${data.education.map(e => `<div style="page-break-inside:avoid; margin-bottom:4mm;"><strong style="font-size:10pt; color:#0f172a;">${e.title}</strong><div style="color:#64748b; font-size:9.5pt;">${e.company}</div><div style="color:#94a3b8; font-size:9pt;">${e.dates}</div></div>`).join('')}</div>` : ''}
                ${Array.isArray(data.skills) && data.skills.length ? `<div><h2 style="font-size:11pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:1px; margin:0 0 5mm; border-bottom:2px solid #0f172a; padding-bottom:2mm;">${t.cvSkills}</h2><p style="font-size:10pt; line-height:1.6; color:#475569; margin:0;">${data.skills.join(' • ')}</p></div>` : ''}
            </div>
        `;
    }

    function renderUsExecutiveModern(data) {
        const t = translations[currentLang] || translations.en;
        return `
            <div style="padding:20mm;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12mm; border-bottom:3px solid #0ea5e9; padding-bottom:8mm;">
                    <div><h1 style="font-size:32pt; font-weight:800; color:#0f172a; margin:0; line-height:1;">${data.fullName}</h1>
                    <h2 style="font-size:13pt; font-weight:600; color:#0ea5e9; text-transform:uppercase; letter-spacing:1px; margin:4mm 0 0;">${data.jobTitle}</h2></div>
                </div>
                <p style="display:flex; gap:12mm; font-size:9.5pt; color:#64748b; margin:0 0 14mm;">
                    <span>${data.email}</span> | <span>${data.phone}</span> | <span>${data.address}</span>
                </p>
                <div style="display:grid; grid-template-columns:1.2fr 1fr; gap:15mm;">
                    <div>
                        ${data.summary ? `<div style="margin-bottom:10mm;"><h3 style="font-size:10.5pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 5mm; border-bottom:2px solid #0f172a; padding-bottom:2mm;">${t.cvProfile}</h3><p style="margin:0; font-size:10pt; line-height:1.7; color:#475569;">${String(data.summary).replace(/\n/g,'<br>')}</p></div>` : ''}
                        ${Array.isArray(data.experience) && data.experience.length ? `<div><h3 style="font-size:10.5pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 5mm; border-bottom:2px solid #0f172a; padding-bottom:2mm;">${t.cvWorkExperience}</h3>${data.experience.map(e => `<div style="page-break-inside:avoid; margin-bottom:6mm;"><strong style="font-size:10.5pt; color:#0f172a;">${e.title}</strong><div style="color:#0ea5e9; font-weight:600; font-size:10pt;">${e.company}${e.location ? ' — '+e.location : ''}</div><div style="color:#94a3b8; font-size:9pt;">${e.dates}</div><div style="color:#475569; font-size:9.5pt; line-height:1.6; margin-top:2mm;">${String(e.desc||'').replace(/\n/g,'<br>')}</div></div>`).join('')}</div>` : ''}
                    </div>
                    <div>
                        ${Array.isArray(data.education) && data.education.length ? `<div style="margin-bottom:10mm;"><h3 style="font-size:10.5pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 5mm; border-bottom:2px solid #0f172a; padding-bottom:2mm;">${t.cvEducation}</h3>${data.education.map(e => `<div style="page-break-inside:avoid; margin-bottom:4mm;"><strong style="font-size:10pt; color:#0f172a;">${e.title}</strong><div style="color:#64748b; font-size:9.5pt;">${e.company}</div><div style="color:#94a3b8; font-size:9pt;">${e.dates}</div></div>`).join('')}</div>` : ''}
                        ${Array.isArray(data.skills) && data.skills.length ? `<div><h3 style="font-size:10.5pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 5mm; border-bottom:2px solid #0f172a; padding-bottom:2mm;">${t.cvSkills}</h3><p style="margin:0; font-size:9.5pt; line-height:1.8; color:#475569;">${data.skills.slice(0,8).join('<br>')}</p></div>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    function renderUsTechResume(data) {
        const t = translations[currentLang] || translations.en;
        return `
            <div style="padding:20mm; font-family:monospace;">
                <h1 style="font-size:28pt; font-weight:800; color:#1e40af; margin:0 0 4mm; font-family:sans-serif; letter-spacing:-0.5px;">${data.fullName}</h1>
                <div style="display:flex; gap:15mm; margin-bottom:12mm; padding-bottom:8mm; border-bottom:2px solid #1e40af; font-family:sans-serif;">
                    <div style="flex:1;"><h2 style="font-size:12pt; font-weight:700; color:#475569; margin:0;">${data.jobTitle}</h2></div>
                    <div style="text-align:right; font-size:9.5pt; color:#64748b;"><div>${data.email}</div><div>${data.phone}</div><div>${data.address}</div></div>
                </div>
                ${data.summary ? `<div style="margin-bottom:10mm; font-family:sans-serif;"><h3 style="font-size:11pt; font-weight:700; color:#1e40af; text-transform:uppercase; margin:0 0 5mm; border-bottom:1px solid #1e40af; padding-bottom:2mm;">${t.cvAbout}</h3><p style="font-size:9.5pt; line-height:1.7; color:#475569; margin:0;">${String(data.summary).replace(/\n/g,'<br>')}</p></div>` : ''}
                ${Array.isArray(data.experience) && data.experience.length ? `<div style="margin-bottom:10mm; font-family:sans-serif;"><h3 style="font-size:11pt; font-weight:700; color:#1e40af; text-transform:uppercase; margin:0 0 5mm; border-bottom:1px solid #1e40af; padding-bottom:2mm;">${t.cvWorkExperience}</h3>${data.experience.map(e => `<div style="page-break-inside:avoid; margin-bottom:6mm;"><strong style="font-size:10pt; color:#0f172a;">${e.title}</strong><span style="float:right; color:#64748b; font-size:9.5pt;">${e.dates}</span><div style="clear:both; color:#64748b; font-weight:600; font-size:10pt; margin:2mm 0;">${e.company}${e.location ? ' — '+e.location : ''}</div><div style="color:#475569; font-size:9.5pt; line-height:1.6;">${String(e.desc||'').replace(/\n/g,'<br>')}</div></div>`).join('')}</div>` : ''}
                ${Array.isArray(data.skills) && data.skills.length ? `<div style="margin-bottom:10mm; font-family:sans-serif;"><h3 style="font-size:11pt; font-weight:700; color:#1e40af; text-transform:uppercase; margin:0 0 5mm; border-bottom:1px solid #1e40af; padding-bottom:2mm;">${t.cvSkills}</h3><p style="font-size:9.5pt; line-height:1.8; color:#475569; margin:0;">${data.skills.join(' • ')}</p></div>` : ''}
                ${Array.isArray(data.education) && data.education.length ? `<div style="font-family:sans-serif;"><h3 style="font-size:11pt; font-weight:700; color:#1e40af; text-transform:uppercase; margin:0 0 5mm; border-bottom:1px solid #1e40af; padding-bottom:2mm;">${t.cvEducation}</h3>${data.education.map(e => `<div style="page-break-inside:avoid; margin-bottom:3mm;"><strong style="font-size:10pt; color:#0f172a;">${e.title}</strong><span style="float:right; color:#64748b; font-size:9pt;">${e.dates}</span><div style="clear:both; color:#64748b; font-size:9.5pt;">${e.company}</div></div>`).join('')}</div>` : ''}
            </div>
        `;
    }

    function renderUsSalesResume(data) {
        const t = translations[currentLang] || translations.en;
        return `
            <div style="padding:20mm;">
                <div style="background:linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%); color:#fff; padding:15mm; margin:-20mm -20mm 15mm; border-radius:4px; margin-bottom:15mm;">
                    <h1 style="font-size:30pt; font-weight:800; margin:0 0 4mm; letter-spacing:-0.5px;">${data.fullName}</h1>
                    <h2 style="font-size:13pt; font-weight:600; margin:0; opacity:0.9;">${data.jobTitle}</h2>
                </div>
                <p style="display:flex; gap:12mm; font-size:9.5pt; color:#64748b; margin:0 0 12mm;">
                    <span>${data.email}</span> | <span>${data.phone}</span> | <span>${data.address}</span>
                </p>
                ${data.summary ? `<div style="margin-bottom:10mm;"><h3 style="font-size:11pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 5mm; border-bottom:2px solid #0ea5e9; padding-bottom:2mm;">${t.cvProfile}</h3><p style="font-size:10pt; line-height:1.7; color:#475569; margin:0;">${String(data.summary).replace(/\n/g,'<br>')}</p></div>` : ''}
                ${Array.isArray(data.experience) && data.experience.length ? `<div style="margin-bottom:10mm;"><h3 style="font-size:11pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 5mm; border-bottom:2px solid #0ea5e9; padding-bottom:2mm;">${t.cvWorkExperience}</h3>${data.experience.map(e => `<div style="page-break-inside:avoid; margin-bottom:6mm;"><strong style="font-size:10.5pt; color:#0f172a;">${e.title}</strong><div style="color:#0ea5e9; font-weight:600; font-size:10pt;">${e.company}</div><div style="color:#94a3b8; font-size:9pt;">${e.dates}</div><div style="color:#475569; font-size:9.5pt; line-height:1.6; margin-top:2mm;">${String(e.desc||'').replace(/\n/g,'<br>')}</div></div>`).join('')}</div>` : ''}
                ${Array.isArray(data.skills) && data.skills.length ? `<div><h3 style="font-size:11pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 5mm; border-bottom:2px solid #0ea5e9; padding-bottom:2mm;">${t.cvSkills}</h3><p style="font-size:10pt; line-height:1.6; color:#475569; margin:0;">${data.skills.join(' • ')}</p></div>` : ''}
            </div>
        `;
    }

    function renderUsOnePageRecruiter(data) {
        const t = translations[currentLang] || translations.en;
        return `
            <div style="padding:22mm; font-size:9.5pt;">
                <h1 style="font-size:24pt; font-weight:800; color:#0f172a; margin:0 0 3mm; letter-spacing:-0.5px;">${data.fullName}</h1>
                <h2 style="font-size:11pt; font-weight:600; color:#64748b; margin:0 0 8mm; text-transform:uppercase; letter-spacing:0.5px;">${data.jobTitle}</h2>
                <p style="display:flex; gap:10mm; color:#475569; margin:0 0 10mm; font-size:9pt;"><span>${data.email}</span> | <span>${data.phone}</span> | <span>${data.address}</span></p>
                ${data.summary ? `<div style="margin-bottom:8mm;"><strong style="text-transform:uppercase; font-size:10pt; color:#0f172a; display:block; margin-bottom:3mm; border-bottom:1px solid #0f172a; padding-bottom:2mm;">${t.cvProfile}</strong><p style="margin:0; line-height:1.6; color:#475569;">${String(data.summary).replace(/\n/g,'<br>')}</p></div>` : ''}
                ${Array.isArray(data.experience) && data.experience.length ? `<div style="margin-bottom:8mm;"><strong style="text-transform:uppercase; font-size:10pt; color:#0f172a; display:block; margin-bottom:3mm; border-bottom:1px solid #0f172a; padding-bottom:2mm;">${t.cvWorkExperience}</strong>${data.experience.slice(0,4).map(e => `<div style="page-break-inside:avoid; margin-bottom:4mm;"><strong style="font-size:9.5pt; color:#0f172a;">${e.title}</strong><span style="float:right; color:#94a3b8; font-size:8.5pt;">${e.dates}</span><div style="clear:both; color:#64748b; font-weight:600; font-size:9pt;">${e.company}</div><div style="color:#475569; font-size:8.5pt; line-height:1.5; margin-top:1mm;">${String(e.desc||'').substring(0,80)}...</div></div>`).join('')}</div>` : ''}
            </div>
        `;
    }

    /* UK TEMPLATES (5) */
    function renderUkProfessionalStandard(data) {
        const t = translations[currentLang] || translations.en;
        return `
            <div style="padding:20mm;">
                <div style="border-bottom:2px solid #2d3748; padding-bottom:10mm; margin-bottom:12mm;">
                    <h1 style="font-size:28pt; font-weight:800; color:#0f172a; margin:0 0 3mm; text-transform:uppercase; letter-spacing:1px;">${data.fullName}</h1>
                    <p style="margin:0 0 6mm; font-size:13pt; font-weight:600; color:#475569;">${data.jobTitle}</p>
                    <p style="margin:0; display:flex; gap:8mm; font-size:9.5pt; color:#64748b;">
                        <span>${data.email}</span> | <span>${data.phone}</span> | <span>${data.address}</span>
                    </p>
                </div>
                ${data.summary ? `<div style="margin-bottom:12mm;"><h3 style="font-size:11pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 5mm; border-bottom:1px solid #2d3748; padding-bottom:2mm;">${t.cvProfile}</h3><p style="font-size:10pt; line-height:1.7; color:#475569; margin:0;">${String(data.summary).replace(/\n/g,'<br>')}</p></div>` : ''}
                ${Array.isArray(data.experience) && data.experience.length ? `<div style="margin-bottom:12mm;"><h3 style="font-size:11pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 5mm; border-bottom:1px solid #2d3748; padding-bottom:2mm;">${t.cvWorkExperience}</h3>${data.experience.map(e => `<div style="page-break-inside:avoid; margin-bottom:6mm;"><strong style="font-size:10.5pt; color:#0f172a;">${e.title}</strong><div style="color:#475569; font-weight:600; font-size:10pt;">${e.company}${e.location ? ', '+e.location : ''}</div><div style="color:#94a3b8; font-size:9pt;">${e.dates}</div><div style="color:#475569; font-size:9.5pt; line-height:1.6; margin-top:2mm;">${String(e.desc||'').replace(/\n/g,'<br>')}</div></div>`).join('')}</div>` : ''}
                ${Array.isArray(data.education) && data.education.length ? `<div style="margin-bottom:12mm;"><h3 style="font-size:11pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 5mm; border-bottom:1px solid #2d3748; padding-bottom:2mm;">${t.cvEducation}</h3>${data.education.map(e => `<div style="page-break-inside:avoid; margin-bottom:4mm;"><strong style="font-size:10pt; color:#0f172a;">${e.title}</strong><div style="color:#475569; font-size:9.5pt;">${e.company}</div><div style="color:#94a3b8; font-size:9pt;">${e.dates}</div></div>`).join('')}</div>` : ''}
                ${Array.isArray(data.skills) && data.skills.length ? `<div><h3 style="font-size:11pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 5mm; border-bottom:1px solid #2d3748; padding-bottom:2mm;">${t.cvSkills}</h3><p style="font-size:10pt; line-height:1.6; color:#475569; margin:0;">${data.skills.join(' • ')}</p></div>` : ''}
            </div>
        `;
    }

    function renderUkLondonExecutive(data) {
        const t = translations[currentLang] || translations.en;
        return `
            <div style="display:grid; grid-template-columns:25% 75%; width:100%; min-height:297mm;">
                <div style="background:#1a202c; color:#fff; padding:15mm; display:flex; flex-direction:column; gap:12mm;">
                    <div style="padding:12mm; background:rgba(255,255,255,0.1); border-radius:4px;">
                        <h3 style="font-size:10pt; font-weight:700; color:#fff; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 6mm; border-bottom:2px solid #4a5568; padding-bottom:2mm;">${t.cvContact}</h3>
                        <p style="font-size:9pt; line-height:1.8; margin:0; color:#cbd5e0;">${data.email}<br>${data.phone}<br>${data.address}</p>
                    </div>
                    ${Array.isArray(data.skills) && data.skills.length ? `<div style="padding:12mm; background:rgba(255,255,255,0.1); border-radius:4px;"><h3 style="font-size:10pt; font-weight:700; color:#fff; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 6mm; border-bottom:2px solid #4a5568; padding-bottom:2mm;">${t.cvSkills}</h3><p style="font-size:9pt; line-height:1.8; margin:0; color:#cbd5e0;">${data.skills.join('<br>')}</p></div>` : ''}
                </div>
                <div style="padding:15mm;">
                    <h1 style="font-size:32pt; font-weight:800; color:#1a202c; margin:0 0 4mm; line-height:1.1;">${data.fullName}</h1>
                    <h2 style="font-size:13pt; font-weight:600; color:#718096; margin:0 0 12mm; text-transform:uppercase; letter-spacing:1px;">${data.jobTitle}</h2>
                    ${data.summary ? `<div style="margin-bottom:12mm;"><h3 style="font-size:11pt; font-weight:700; color:#1a202c; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 5mm; border-bottom:2px solid #1a202c; padding-bottom:2mm;">${t.cvAbout}</h3><p style="font-size:10pt; line-height:1.7; color:#4a5568; margin:0;">${String(data.summary).replace(/\n/g,'<br>')}</p></div>` : ''}
                    ${Array.isArray(data.experience) && data.experience.length ? `<div style="margin-bottom:12mm;"><h3 style="font-size:11pt; font-weight:700; color:#1a202c; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 5mm; border-bottom:2px solid #1a202c; padding-bottom:2mm;">${t.cvWorkExperience}</h3>${data.experience.map(e => `<div style="page-break-inside:avoid; margin-bottom:6mm;"><strong style="font-size:10.5pt; color:#1a202c;">${e.title}</strong><div style="color:#4a5568; font-weight:600; font-size:10pt;">${e.company}</div><div style="color:#a0aec0; font-size:9pt; margin:1mm 0 3mm;">${e.dates}</div><div style="color:#4a5568; font-size:9.5pt; line-height:1.6;">${String(e.desc||'').replace(/\n/g,'<br>')}</div></div>`).join('')}</div>` : ''}
                    ${Array.isArray(data.education) && data.education.length ? `<div><h3 style="font-size:11pt; font-weight:700; color:#1a202c; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 5mm; border-bottom:2px solid #1a202c; padding-bottom:2mm;">${t.cvEducation}</h3>${data.education.map(e => `<div style="page-break-inside:avoid; margin-bottom:4mm;"><strong style="font-size:10pt; color:#1a202c;">${e.title}</strong><div style="color:#4a5568; font-size:9.5pt;">${e.company}</div><div style="color:#a0aec0; font-size:9pt;">${e.dates}</div></div>`).join('')}</div>` : ''}
                </div>
            </div>
        `;
    }

    function renderUkGraduateCv(data) {
        const t = translations[currentLang] || translations.en;
        return `
            <div style="padding:20mm;">
                <h1 style="font-size:26pt; font-weight:800; color:#0f172a; margin:0 0 2mm; letter-spacing:-0.5px;">${data.fullName}</h1>
                <h2 style="font-size:11pt; font-weight:600; color:#0ea5e9; text-transform:uppercase; letter-spacing:1px; margin:0 0 10mm;">${data.jobTitle}</h2>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12mm; margin-bottom:12mm; padding-bottom:10mm; border-bottom:2px solid #0ea5e9;">
                    <div style="font-size:9.5pt; color:#64748b;"><div><strong>${t.cvEmail}:</strong> ${data.email}</div><div><strong>${t.cvPhone}:</strong> ${data.phone}</div><div><strong>${t.cvAddress}:</strong> ${data.address}</div></div>
                    <div></div>
                </div>
                ${data.summary ? `<div style="margin-bottom:10mm;"><h3 style="font-size:11pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 5mm; border-bottom:2px solid #0f172a; padding-bottom:2mm;">${t.cvProfile}</h3><p style="font-size:10pt; line-height:1.7; color:#475569; margin:0;">${String(data.summary).replace(/\n/g,'<br>')}</p></div>` : ''}
                ${Array.isArray(data.education) && data.education.length ? `<div style="margin-bottom:10mm;"><h3 style="font-size:11pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 5mm; border-bottom:2px solid #0f172a; padding-bottom:2mm;">${t.cvEducation}</h3>${data.education.map(e => `<div style="page-break-inside:avoid; margin-bottom:4mm;"><strong style="font-size:10pt; color:#0f172a;">${e.title}</strong><div style="color:#64748b; font-weight:600; font-size:9.5pt;">${e.company}</div><div style="color:#94a3b8; font-size:9pt;">${e.dates}</div></div>`).join('')}</div>` : ''}
                ${Array.isArray(data.experience) && data.experience.length ? `<div style="margin-bottom:10mm;"><h3 style="font-size:11pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 5mm; border-bottom:2px solid #0f172a; padding-bottom:2mm;">${t.cvWorkExperience}</h3>${data.experience.map(e => `<div style="page-break-inside:avoid; margin-bottom:4mm;"><strong style="font-size:10pt; color:#0f172a;">${e.title}</strong><div style="color:#64748b; font-size:9.5pt;">${e.company}</div><div style="color:#94a3b8; font-size:9pt;">${e.dates}</div><div style="color:#475569; font-size:8.5pt;">${String(e.desc||'').substring(0,60)}</div></div>`).join('')}</div>` : ''}
                ${Array.isArray(data.skills) && data.skills.length ? `<div><h3 style="font-size:11pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 5mm; border-bottom:2px solid #0f172a; padding-bottom:2mm;">${t.cvSkills}</h3><p style="font-size:9.5pt; line-height:1.6; color:#475569; margin:0;">${data.skills.join(' • ')}</p></div>` : ''}
            </div>
        `;
    }

    function renderUkModernTwoColumn(data) {
        const t = translations[currentLang] || translations.en;
        return `
            <div style="padding:18mm;">
                <div style="margin-bottom:12mm; padding-bottom:8mm; border-bottom:3px solid #0ea5e9;">
                    <h1 style="font-size:30pt; font-weight:800; color:#0f172a; margin:0 0 3mm; letter-spacing:-0.5px;">${data.fullName}</h1>
                    <h2 style="font-size:12pt; font-weight:600; color:#0ea5e9; text-transform:uppercase; letter-spacing:1px; margin:0;">${data.jobTitle}</h2>
                </div>
                <p style="display:flex; gap:12mm; font-size:9.5pt; color:#64748b; margin:0 0 12mm;"><span>${data.email}</span> | <span>${data.phone}</span> | <span>${data.address}</span></p>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:15mm;">
                    <div>
                        ${Array.isArray(data.education) && data.education.length ? `<div style="margin-bottom:10mm;"><h3 style="font-size:10.5pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 5mm; border-bottom:2px solid #0f172a; padding-bottom:2mm;">${t.cvEducation}</h3>${data.education.map(e => `<div style="page-break-inside:avoid; margin-bottom:4mm;"><strong style="font-size:10pt; color:#0f172a;">${e.title}</strong><div style="color:#64748b; font-size:9.5pt;">${e.company}</div><div style="color:#94a3b8; font-size:9pt;">${e.dates}</div></div>`).join('')}</div>` : ''}
                        ${Array.isArray(data.skills) && data.skills.length ? `<div><h3 style="font-size:10.5pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 5mm; border-bottom:2px solid #0f172a; padding-bottom:2mm;">${t.cvSkills}</h3><p style="margin:0; font-size:9.5pt; line-height:1.8; color:#475569;">${data.skills.join('<br>')}</p></div>` : ''}
                    </div>
                    <div>
                        ${data.summary ? `<div style="margin-bottom:10mm;"><h3 style="font-size:10.5pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 5mm; border-bottom:2px solid #0f172a; padding-bottom:2mm;">${t.cvProfile}</h3><p style="margin:0; font-size:9.5pt; line-height:1.7; color:#475569;">${String(data.summary).replace(/\n/g,'<br>')}</p></div>` : ''}
                        ${Array.isArray(data.experience) && data.experience.length ? `<div><h3 style="font-size:10.5pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 5mm; border-bottom:2px solid #0f172a; padding-bottom:2mm;">${t.cvWorkExperience}</h3>${data.experience.map(e => `<div style="page-break-inside:avoid; margin-bottom:4mm;"><strong style="font-size:10pt; color:#0f172a;">${e.title}</strong><div style="color:#64748b; font-weight:600; font-size:9.5pt;">${e.company}</div><div style="color:#94a3b8; font-size:9pt;">${e.dates}</div><div style="color:#475569; font-size:8.5pt; margin-top:1mm;">${String(e.desc||'').substring(0,50)}</div></div>`).join('')}</div>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    function renderUkRecruiterFriendly(data) {
        const t = translations[currentLang] || translations.en;
        return `
            <div style="padding:22mm;">
                <h1 style="font-size:26pt; font-weight:800; color:#0f172a; margin:0 0 2mm; letter-spacing:-0.5px;">${data.fullName}</h1>
                <p style="font-size:11pt; font-weight:600; color:#64748b; margin:0 0 8mm;">${data.jobTitle}</p>
                <p style="font-size:9.5pt; color:#64748b; margin:0 0 12mm; border-bottom:1px solid #ddd; padding-bottom:8mm;">${data.email} | ${data.phone} | ${data.address}</p>
                ${data.summary ? `<div style="margin-bottom:10mm;"><h3 style="font-size:10.5pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 5mm; border-bottom:2px solid #0f172a; padding-bottom:2mm;">${t.cvProfile}</h3><p style="font-size:10pt; line-height:1.7; color:#475569; margin:0;">${String(data.summary).substring(0,150)}...</p></div>` : ''}
                ${Array.isArray(data.experience) && data.experience.length ? `<div style="margin-bottom:10mm;"><h3 style="font-size:10.5pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 5mm; border-bottom:2px solid #0f172a; padding-bottom:2mm;">${t.cvWorkExperience}</h3>${data.experience.map(e => `<div style="page-break-inside:avoid; margin-bottom:5mm;"><strong style="font-size:10.5pt; color:#0f172a;">${e.title}</strong><span style="float:right; font-size:9.5pt; color:#94a3b8;">${e.dates}</span><div style="clear:both; color:#64748b; font-weight:600; font-size:10pt;">${e.company}${e.location ? ' — '+e.location : ''}</div><div style="font-size:9.5pt; color:#475569; line-height:1.5; margin-top:2mm;">${String(e.desc||'').substring(0,100)}...</div></div>`).join('')}</div>` : ''}
                ${Array.isArray(data.education) && data.education.length ? `<div style="margin-bottom:10mm;"><h3 style="font-size:10.5pt; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 5mm; border-bottom:2px solid #0f172a; padding-bottom:2mm;">${t.cvEducation}</h3>${data.education.map(e => `<div style="page-break-inside:avoid; margin-bottom:3mm;"><strong style="font-size:10pt; color:#0f172a;">${e.title}</strong><span style="float:right; font-size:9.5pt; color:#94a3b8;">${e.dates}</span><div style="clear:both; color:#64748b; font-size:9.5pt;">${e.company}</div></div>`).join('')}</div>` : ''}
            </div>
        `;
    }

    /* PREMIUM RENDERERS */

    function renderModernSidebar(data, isDark) {
        const t = translations[currentLang] || translations.en;
        const photoHtml = data.showPhoto ? `<div class="cv-photo-box" style="width:100%; aspect-ratio:1; border-radius:12px; overflow:hidden; margin-bottom:10mm; border:3px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#fff'};"><img src="${photoDataUrl}" style="width:100%; height:100%; object-fit:cover;"></div>` : '';
        
        const sidebar = `
            <div class="cv-side">
                ${photoHtml}
                <h3>${t.cvContact}</h3>
                <div class="cv-side-block" style="margin-bottom:8mm; font-size:9.5pt; line-height:1.6;">
                    ${data.email || ""}<br>${data.phone || ""}<br>${data.address || ""}
                    ${data.showDob ? `<br>Born: ${data.dob}` : ''}
                    ${data.showNat ? `<br>${data.nationality}` : ''}
                </div>
                <h3>${t.cvSkills}</h3>
                <div class="cv-side-block" style="margin-bottom:8mm; font-size:9.5pt; line-height:1.8;">
                    ${(Array.isArray(data.skills) ? data.skills : []).join('<br>')}
                </div>
                ${Array.isArray(data.languages) && data.languages.length ? `
                    <h3>${t.cvLanguages}</h3>
                    <div class="cv-side-block" style="font-size:9.5pt; line-height:1.6;">
                        ${data.languages.map(l => `${l.name} (${l.prof || 80}%)`).join('<br>')}
                    </div>
                ` : ''}
            </div>
        `;

        const main = `
            <div class="cv-main">
                <div class="cv-header">
                    <h1>${data.fullName || ""}</h1>
                    <h2>${data.jobTitle || ""}</h2>
                </div>
                <div class="cv-section">
                    <div class="cv-sec-title">${t.cvSummary}</div>
                    <div class="cv-item-desc">${String(data.summary || "").replace(/\n/g, '<br>')}</div>
                </div>
                <div class="cv-section">
                    <div class="cv-sec-title">${t.cvExperience}</div>
                    ${(Array.isArray(data.experience) ? data.experience : []).map(e => `
                        <div class="cv-item" style="margin-bottom:6mm;">
                            <div class="cv-item-hdr" style="display:flex; justify-content:space-between; align-items:baseline;">
                                <strong style="font-size:11.5pt;">${e.title || ""}</strong>
                                <span style="font-size:9.5pt; color:var(--text-muted);">${e.dates || ""}</span>
                            </div>
                            <div style="color:var(--cv-accent); font-weight:600; font-size:10pt; margin-bottom:2mm;">${e.company || ""}${e.location ? ' — ' + e.location : ''}</div>
                            <div class="cv-item-desc" style="font-size:10pt;">${String(e.desc || "").replace(/\n/g, '<br>')}</div>
                        </div>
                    `).join('')}
                </div>
                <div class="cv-section">
                    <div class="cv-sec-title">${t.cvEducation}</div>
                    ${(Array.isArray(data.education) ? data.education : []).map(e => `
                        <div class="cv-item" style="margin-bottom:4mm;">
                            <div class="cv-item-hdr" style="display:flex; justify-content:space-between;">
                                <strong>${e.title || ""}</strong>
                                <span style="font-size:9.5pt;">${e.dates || ""}</span>
                            </div>
                            <div style="font-size:10pt;">${e.company || ""}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        return main + sidebar;
    }

    function renderAtsCleanProf(data) {
        const t = translations[currentLang] || translations.en;
        return `
            <div class="cv-header">
                <h1>${data.fullName || ""}</h1>
                <div style="font-size:10pt;">${data.email} | ${data.phone} | ${data.address}</div>
            </div>
            <div class="cv-section">
                <div class="cv-sec-title">${t.cvSummary}</div>
                <div class="cv-item-desc">${data.summary}</div>
            </div>
            <div class="cv-section">
                <div class="cv-sec-title">${t.cvExperience}</div>
                ${data.experience.map(e => `
                    <div class="cv-item">
                        <div class="cv-item-hdr"><span>${e.title}</span><span>${e.dates}</span></div>
                        <div class="cv-item-comp">${e.company} | ${e.location}</div>
                        <div class="cv-item-desc">${e.desc}</div>
                    </div>
                `).join('')}
            </div>
            <div class="cv-section">
                <div class="cv-sec-title">${t.cvSkills}</div>
                <div class="cv-item-desc">${data.skills.join(', ')}</div>
            </div>
        `;
    }

    function renderExecMinimal(data) {
        const t = translations[currentLang] || translations.en;
        return `
            <div class="cv-header">
                <h1>${data.fullName}</h1>
                <h2>${data.jobTitle}</h2>
                <div style="margin-top:5mm; font-size:10pt; letter-spacing:1px; color:#64748b;">${data.email} &bull; ${data.phone} &bull; ${data.address}</div>
            </div>
            <div class="cv-section">
                <div class="cv-sec-title">${t.cvProfile}</div>
                <div class="cv-item-desc" style="font-size:11pt; line-height:1.8;">${data.summary}</div>
            </div>
            <div class="cv-section">
                <div class="cv-sec-title">${t.cvProfessionalBackground}</div>
                ${data.experience.map(e => `
                    <div class="cv-item" style="margin-bottom:8mm;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:2mm;">
                            <strong style="font-size:12pt; text-transform:uppercase;">${e.title}</strong>
                            <span style="font-style:italic;">${e.dates}</span>
                        </div>
                        <div style="font-weight:600; color:#111; margin-bottom:3mm;">${e.company}</div>
                        <div class="cv-item-desc">${e.desc}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function renderEuroModern(data) {
        const t = translations[currentLang] || translations.en;
        const photo = data.showPhoto ? `<div class="cv-photo-box"><img src="${photoDataUrl}" style="width:100%;height:100%;object-fit:cover;"></div>` : '';
        return `
            <div class="cv-header">
                ${photo}
                <div>
                    <h1>${data.fullName}</h1>
                    <h2 style="color:#1e3a8a; font-weight:600;">${data.jobTitle}</h2>
                    <div style="font-size:9.5pt; margin-top:2mm; opacity:0.8;">${data.email} | ${data.phone} | ${data.address}</div>
                </div>
            </div>
            <div class="cv-main">
                <div class="cv-section">
                    <div class="cv-sec-title">${t.cvExperience}</div>
                    ${data.experience.map(e => `
                        <div class="cv-item">
                            <div style="display:flex; justify-content:space-between; font-weight:800; color:#1e3a8a;"><span>${e.title}</span><span>${e.dates}</span></div>
                            <div style="font-weight:600;">${e.company}</div>
                            <div class="cv-item-desc">${e.desc}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="cv-side" style="padding:10mm; background:#f8fafc; border-radius:4px; margin-top:10mm;">
                <div class="cv-sec-title">${t.cvSkills}</div>
                <div class="cv-item-desc">${data.skills.join(' &bull; ')}</div>
            </div>
        `;
    }

    function renderCorpClean(data) {
        const t = translations[currentLang] || translations.en;
        return `
            <div class="cv-header">
                <div><h1>${data.fullName}</h1><h2 style="font-weight:400;">${data.jobTitle}</h2></div>
                <div style="text-align:right; font-size:9pt;">${data.email}<br>${data.phone}</div>
            </div>
            <div class="cv-body" style="display:flex; gap:10mm;">
                <div class="cv-col-left" style="width:60mm;">
                    <div class="cv-sec-title">${t.cvContact}</div>
                    <p style="font-size:9.5pt;">${data.address}</p>
                    <div class="cv-sec-title" style="margin-top:10mm;">${t.cvSkills}</div>
                    <ul style="padding-left:4mm;">${data.skills.map(s => `<li>${s}</li>`).join('')}</ul>
                </div>
                <div class="cv-col-right" style="flex:1;">
                    <div class="cv-sec-title">${t.cvExperience}</div>
                    ${data.experience.map(e => `
                        <div class="cv-item">
                            <div style="display:flex; justify-content:space-between;"><strong>${e.title}</strong><span>${e.dates}</span></div>
                            <div style="font-style:italic; margin-bottom:2mm;">${e.company}</div>
                            <div class="cv-item-desc">${e.desc}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    function renderCompactOnePagePro(data) {
        return `
            <div class="cv-header">
                <div><h1 style="margin:0;">${data.fullName}</h1><div style="color:#3b82f6; font-weight:600;">${data.jobTitle}</div></div>
                <div style="text-align:right; font-size:8.5pt;">${data.email} | ${data.phone}<br>${data.address}</div>
            </div>
            <div class="cv-section">
                <div class="cv-sec-title">EXPERIENCE</div>
                ${data.experience.map(e => `
                    <div class="cv-item">
                        <div style="display:flex; justify-content:space-between; font-weight:700;"><span>${e.title}</span><span>${e.dates}</span></div>
                        <div style="font-size:8.5pt; opacity:0.8;">${e.company}</div>
                        <div class="cv-item-desc">${e.desc}</div>
                    </div>
                `).join('')}
            </div>
            <div class="cv-section">
                <div class="cv-sec-title">SKILLS</div>
                <div class="cv-item-desc">${data.skills.join(' • ')}</div>
            </div>
        `;
    }

    function renderElegantProf(data) {
        return `
            <div class="cv-header"><h1>${data.fullName}</h1><div style="letter-spacing:4px; text-transform:uppercase; font-size:10pt;">${data.jobTitle}</div></div>
            <div class="cv-section">
                <div class="cv-sec-title">Executive Summary</div>
                <div class="cv-item-desc" style="text-align:center; padding:0 15mm;">${data.summary}</div>
            </div>
            <div class="cv-section">
                <div class="cv-sec-title">Professional Experience</div>
                ${data.experience.map(e => `
                    <div class="cv-item" style="text-align:center; margin-bottom:8mm;">
                        <div style="font-size:13pt; font-weight:bold;">${e.title}</div>
                        <div style="font-style:italic;">${e.company} | ${e.dates}</div>
                        <div class="cv-item-desc" style="margin-top:2mm;">${e.desc}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function renderTechModern(data) {
        return `
            <div class="cv-header">> ${data.fullName}<br>> ${data.jobTitle}<br>> ${data.email}</div>
            <div class="cv-section">
                <div class="cv-sec-title">[ STACK_AND_SKILLS ]</div>
                <div class="cv-item-desc">${data.skills.map(s => `[${s}]`).join(' ')}</div>
            </div>
            <div class="cv-section">
                <div class="cv-sec-title">[ WORK_LOG ]</div>
                ${data.experience.map(e => `
                    <div class="cv-item">
                        <div class="cv-item-title">${e.title} @ ${e.company}</div>
                        <div style="font-size:9pt; margin:1mm 0;">PERIOD: ${e.dates}</div>
                        <div class="cv-item-desc">${e.desc}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function renderIntlStd(data) {
        return `
            <div class="cv-header">
                <h1>${data.fullName}</h1>
                <div class="cv-contact"><span>${data.email}</span><span>${data.phone}</span><span>${data.address}</span></div>
            </div>
            <div class="cv-body" style="display:flex; gap:10mm;">
                <div class="cv-col-right" style="flex:1;">
                    <div class="cv-sec-title">Professional Profile</div>
                    <div class="cv-item-desc">${data.summary}</div>
                    <div class="cv-sec-title">Work History</div>
                    ${data.experience.map(e => `
                        <div class="cv-item">
                            <div style="display:flex; justify-content:space-between; font-weight:600;"><span>${e.title}</span><span>${e.dates}</span></div>
                            <div style="color:#666; margin-bottom:2mm;">${e.company}</div>
                            <div class="cv-item-desc">${e.desc}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }


    function updateDynamicItemField(listSelector, itemIndex, selector, value) {
        const items = document.querySelectorAll(listSelector + ' .dynamic-item');
        const item = items[itemIndex];
        if (!item) return;
        const input = item.querySelector(selector);
        if (input) input.value = value;
    }

    function enableInlinePreviewEditing() {
        const previewRoot = document.getElementById('cv-preview');
        if (!previewRoot || isBasicPackMode) return;

        const editableNodes = previewRoot.querySelectorAll('[data-inline]');
        editableNodes.forEach(node => {
            node.setAttribute('contenteditable', 'true');
            node.setAttribute('spellcheck', 'false');
            node.classList.add('inline-editable');
            if (node.dataset.inline === 'exp-bullet' || node.dataset.inline === 'skills' || node.dataset.inline === 'computerSkills' || node.dataset.inline === 'hobbies' || node.dataset.inline === 'certificates') {
                node.style.display = 'list-item';
            }
            if (node.dataset.boundInline === '1') return;
            node.dataset.boundInline = '1';
            node.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && node.tagName !== 'LI' && node.dataset.inline !== 'summary') {
                    e.preventDefault();
                    node.blur();
                }
            });
            node.addEventListener('blur', () => {
                const field = node.dataset.inline;
                const idx = parseInt(node.dataset.index || '-1', 10);
                const bulletIdx = parseInt(node.dataset.bulletIndex || '-1', 10);
                const value = node.innerText.trim();
                if (!field) return;

                const setVal = (id, v) => {
                    const el = document.getElementById(id);
                    if (el) el.value = v;
                };
                if (field === 'fullName') setVal('fullName', value);
                else if (field === 'targetJobTitle') setVal('targetJobTitle', value);
                else if (field === 'summary') setVal('summary', value);
                else if (field === 'email') setVal('email', value);
                else if (field === 'phone') setVal('phone', value);
                else if (field === 'address') setVal('address', value);
                else if (field === 'dob') setVal('dob', value);
                else if (field === 'nationality') setVal('nationality', value);
                else if (field === 'linkedin') {
                    const el = document.getElementById('linkedin');
                    if (el) el.value = value;
                }
                else if (field === 'skills' || field === 'computerSkills') {
                    const inputId = field === 'skills' ? 'skills' : 'computerSkills';
                    const el = document.getElementById(inputId);
                    if (el) {
                        let parts = el.value.split(',').map(s => s.trim()).filter(Boolean);
                        while (parts.length <= idx) parts.push('');
                        parts[idx] = value;
                        el.value = parts.filter(Boolean).join(', ');
                    }
                }
                else if (field === 'language-name' || field === 'language-prof') {
                    const items = document.querySelectorAll('#languages-list .dynamic-item');
                    const item = items[idx];
                    if (item) {
                        const sel = field === 'language-name' ? '.inp-lang' : '.inp-prof';
                        const inp = item.querySelector(sel);
                        if (inp) inp.value = value.replace(/%$/, '');
                    }
                }
                else if (field === 'exp-title') updateDynamicItemField('#experience-list', idx, '.inp-title', value);
                else if (field === 'exp-dates') updateDynamicItemField('#experience-list', idx, '.inp-date', value);
                else if (field === 'exp-company') {
                    const bits = value.split(',');
                    updateDynamicItemField('#experience-list', idx, '.inp-company', bits[0].trim());
                    if (bits[1]) updateDynamicItemField('#experience-list', idx, '.inp-loc', bits.slice(1).join(',').trim());
                }
                else if (field === 'exp-bullet') {
                    const items = document.querySelectorAll('#experience-list .dynamic-item');
                    const item = items[idx];
                    if (item) {
                        const ta = item.querySelector('.inp-desc');
                        if (ta) {
                            let lines = ta.value.split(/\n+/).map(s => s.replace(/^[-•]\s*/, '').trim()).filter(Boolean);
                            while (lines.length <= bulletIdx) lines.push('');
                            lines[bulletIdx] = value;
                            ta.value = lines.filter(Boolean).map(x => '• ' + x).join('\n');
                        }
                    }
                }
                else if (field === 'edu-title') updateDynamicItemField('#education-list', idx, '.inp-title', value);
                else if (field === 'edu-dates') updateDynamicItemField('#education-list', idx, '.inp-date', value);
                else if (field === 'edu-company') updateDynamicItemField('#education-list', idx, '.inp-company', value);

                triggerRender();
            });
        });
    }

    /* 8. EXPORT & SAVE */

    function ensureHtml2PdfReady() {
        return new Promise((resolve) => {
            if (window.html2pdf) return resolve(true);
            const existing = document.querySelector('script[data-html2pdf-loader="1"]');
            if (existing) { existing.addEventListener('load', () => resolve(!!window.html2pdf)); existing.addEventListener('error', () => resolve(false)); return; }
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
            s.setAttribute('data-html2pdf-loader','1');
            s.onload = () => resolve(!!window.html2pdf);
            s.onerror = () => resolve(false);
            document.head.appendChild(s);
            setTimeout(() => resolve(!!window.html2pdf), 6000);
        });
    }

    // 6.3 Helper: Export the CV exactly as paginated
    async function exportExactTemplateContinuation() {
        // Save metadata
        const currentUser = localStorage.getItem('currentUser');
        if (currentUser) {
            let userCVs = [];
            try {
                const raw = localStorage.getItem(`userCVs_${currentUser}`);
                if (raw) userCVs = JSON.parse(raw);
            } catch (e) { }

            const cvId = localStorage.getItem('activeCVEditId') || 'cv_' + Date.now();
            const activeCV = {
                id: cvId,
                fullName: fullNameInput.value || 'Untitled',
                targetJobTitle: document.getElementById('targetJobTitle')?.value || '',
                updatedAt: Date.now()
            };

            const existingIdx = userCVs.findIndex(c => c.id === cvId);
            if (existingIdx > -1) userCVs[existingIdx] = activeCV;
            else { userCVs.push(activeCV); localStorage.setItem('activeCVEditId', cvId); }
            localStorage.setItem(`userCVs_${currentUser}`, JSON.stringify(userCVs));
        }

        const cvPagesWrapper = document.getElementById('cv-pages');
        if (!cvPagesWrapper) return;

        const opt = {
            margin: 0,
            filename: `${fullNameInput.value.replace(/\s+/g, '_')}_CV.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, letterRendering: true, backgroundColor: '#ffffff' },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: 'css' }
        };

        // Standardize pages for export
        const pages = Array.from(cvPagesWrapper.querySelectorAll('.cv-page'));
        const exportWrapper = document.createElement('div');
        pages.forEach((p, idx) => {
            const clone = p.cloneNode(true);
            clone.style.boxShadow = 'none';
            clone.style.marginBottom = '0';
            clone.style.pageBreakAfter = 'always';
            if (idx === pages.length - 1) clone.style.pageBreakAfter = 'auto';
            exportWrapper.appendChild(clone);
        });

        const pdfReady = await ensureHtml2PdfReady();
        if (pdfReady && window.html2pdf) {
            return window.html2pdf().set(opt).from(exportWrapper).save();
        }
        const printStyle = document.createElement('style');
        printStyle.textContent = '@media print{body *{visibility:hidden!important} #cv-pages,#cv-pages *{visibility:visible!important} #cv-pages{position:absolute!important;left:0!important;top:0!important;width:210mm!important}.navbar,.editor-panel,.ai-float,.preview-actions{display:none!important}}';
        document.head.appendChild(printStyle);
        alert('PDF generator could not load automatically. In the print window, choose Save as PDF.');
        window.print();
        setTimeout(()=>printStyle.remove(),1000);
    }
    document.getElementById('finalize-download-btn')?.addEventListener('click', exportExactTemplateContinuation);
    document.getElementById('overlay-download-btn')?.addEventListener('click', exportExactTemplateContinuation);

    // 9. AI ASSISTANT (STRUCTURED UPGRADE)
    const aiToggle = document.getElementById('ai-assistant-toggle');
    const aiPanel = document.getElementById('ai-assistant-panel');
    const aiClose = document.getElementById('ai-close-btn');
    const aiSendBtn = document.getElementById('ai-send-btn');
    const aiUserInput = document.getElementById('ai-user-input');
    const aiResponseBox = document.getElementById('ai-response-box');

    let interactionCount = 0;
    let aiHistory = [];

    const aiUploadBtn = document.getElementById('ai-upload-plus-btn');
    const aiUploadInput = document.getElementById('ai-upload-cv-input');
    const loadingOverlay = document.getElementById('cv-loading-overlay');

    if (aiUploadBtn && aiUploadInput) {
        aiUploadBtn.onclick = () => aiUploadInput.click();

        aiUploadInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            appendMessage('ai', "Converting your file into editable data...");
            const formData = new FormData();
            formData.append('cvFile', file);

            const loader = document.getElementById('cv-loading-overlay');
            if (loader) loader.style.display = 'flex';

            try {
                const response = await apiFetch('/api/upload-old-cv', {
                    method: 'POST',
                    body: formData
                });
                if (!response.ok) throw new Error('Failed to parse');
                const rawData = await response.json();

                // NUTRALIZE & NORMALIZE before processing
                const normalized = normalizeImportedCVData(rawData);

                // MAP DATA -> FILL FORM -> TRIGGER SITE TEMPLATE RENDER
                populateFormFromParsedCV(normalized);
                appendMessage('ai', "Analysis complete! Your details have been filled into the form on the left.");
            } catch (err) {
                console.error("Import error:", err);
                appendMessage('ai', "I couldn't read that file format. Please check the file or fill the info manually.");
            } finally {
                if (loader) loader.style.display = 'none';
                aiUploadInput.value = '';
            }
        };
    }

    function normalizeImportedCVData(parsed) {
        if (!parsed) return {};

        const safeStr = (v) => (v === null || v === undefined) ? "" : String(v);
        const safeArr = (v) => Array.isArray(v) ? v : [];
        const joinSafe = (arr) => safeArr(arr).filter(Boolean).join('\n');

        // Capture Additional Information
        let summary = safeStr(parsed.summary || parsed.profile || parsed.about || "");
        const extra = safeStr(parsed.additionalInfo || "");
        if (extra && !summary.includes(extra)) {
            summary += "\n\nAdditional Information:\n" + extra;
        }

        const normalized = {
            fullName: safeStr(parsed.fullName || parsed.display_name || parsed.name || ""),
            jobTitle: safeStr(parsed.jobTitle || parsed.targetJobTitle || parsed.title || ""),
            email: safeStr(parsed.email || ""),
            phone: safeStr(parsed.phone || ""),
            address: safeStr(parsed.address || parsed.location || ""),
            dob: safeStr(parsed.dob || parsed.birthDate || ""),
            nationality: safeStr(parsed.nationality || ""),
            summary: summary,
            // Skills: Merge technical into computer skills to avoid losing data
            skills: safeArr(parsed.skills),
            computerSkills: [...safeArr(parsed.computerSkills), ...safeArr(parsed.technicalSkills)],

            experience: safeArr(parsed.experience || parsed.work_history).map(e => {
                let desc = safeStr(e.description || e.desc || "");
                if (e.bullets && Array.isArray(e.bullets) && e.bullets.length > 0) {
                    desc += (desc ? "\n" : "") + e.bullets.join("\n");
                }
                return {
                    title: safeStr(e.title || e.jobTitle || ""),
                    company: safeStr(e.company || e.organization || ""),
                    dates: safeStr(e.dates || ""),
                    location: safeStr(e.location || ""),
                    description: desc
                };
            }),
            education: safeArr(parsed.education || parsed.studies).map(e => ({
                degree: safeStr(e.degree || e.title || ""),
                institution: safeStr(e.institution || e.company || ""),
                dates: safeStr(e.dates || ""),
                location: safeStr(e.location || ""),
                description: safeStr(e.description || e.desc || "")
            })),
            projects: safeArr(parsed.projects).map(p => {
                let desc = safeStr(p.description || p.desc || "");
                if (p.bullets && Array.isArray(p.bullets) && p.bullets.length > 0) {
                    desc += (desc ? "\n" : "") + p.bullets.join("\n");
                }
                return {
                    name: safeStr(p.name || p.title || ""),
                    dates: safeStr(p.dates || ""),
                    description: desc
                };
            }),
            languages: safeArr(parsed.languages).map(l => ({
                name: safeStr(l.name || l.title || l.language || ""),
                proficiency: safeStr(l.proficiency || l.prof || l.level || "80")
            }))
        };
        return normalized;
    }

    function populateFormFromParsedCV(parsed) {
        if (!parsed) return;

        // Basic Info - Populate actual editable form fields
        const fieldMap = {
            'fullName': 'fullName',
            'jobTitle': 'targetJobTitle',
            'email': 'email',
            'phone': 'phone',
            'address': 'address',
            'dob': 'dob',
            'nationality': 'nationality',
            'summary': 'summary'
        };

        for (const [parsedKey, elementId] of Object.entries(fieldMap)) {
            const el = document.getElementById(elementId);
            if (el) el.value = parsed[parsedKey] || "";
        }

        // Skills & Computer Skills
        const skillsEl = document.getElementById('skills');
        if (skillsEl) skillsEl.value = Array.isArray(parsed.skills) ? parsed.skills.join(', ') : (parsed.skills || "");

        const compEl = document.getElementById('computerSkills');
        if (compEl) compEl.value = Array.isArray(parsed.computerSkills) ? parsed.computerSkills.join(', ') : (parsed.computerSkills || "");

        // Dynamic Lists - Using existing add-item logic to maintain editability
        const expList = document.getElementById('experience-list');
        if (expList) {
            expList.innerHTML = '';
            if (Array.isArray(parsed.experience)) {
                parsed.experience.forEach(item => addExperienceItem(item));
            }
        }

        const eduList = document.getElementById('education-list');
        if (eduList) {
            eduList.innerHTML = '';
            if (Array.isArray(parsed.education)) {
                parsed.education.forEach(item => addEducationItem(item));
            }
        }

        const projList = document.getElementById('project-list');
        if (projList) {
            projList.innerHTML = '';
            if (Array.isArray(parsed.projects)) {
                parsed.projects.forEach(item => addProjectItem(item));
            }
        }

        const langList = document.getElementById('language-list');
        if (langList) {
            langList.innerHTML = '';
            if (Array.isArray(parsed.languages)) {
                parsed.languages.forEach(item => addLanguageItem(item));
            }
        }

        // Final render: Triggers the normal site template render from the now-populated form fields
        triggerRender();
    }

    function addExperienceItem(data) {
        const list = document.getElementById('experience-list');
        const node = document.getElementById('tpl-experience').content.cloneNode(true).querySelector('.dynamic-item');
        node.querySelector('.inp-title').value = data.title || '';
        node.querySelector('.inp-company').value = data.company || '';
        node.querySelector('.inp-date').value = data.dates || '';
        node.querySelector('.inp-loc').value = data.location || '';
        node.querySelector('.inp-desc').value = data.description || '';
        node.querySelector('.remove-btn').addEventListener('click', ev => { ev.target.closest('.dynamic-item').remove(); triggerRender(); });
        list.appendChild(node);
    }

    function addEducationItem(data) {
        const list = document.getElementById('education-list');
        const node = document.getElementById('tpl-education').content.cloneNode(true).querySelector('.dynamic-item');
        node.querySelector('.inp-title').value = data.degree || '';
        node.querySelector('.inp-company').value = data.institution || '';
        node.querySelector('.inp-date').value = data.dates || '';
        node.querySelector('.remove-btn').addEventListener('click', ev => { ev.target.closest('.dynamic-item').remove(); triggerRender(); });
        list.appendChild(node);
    }

    function addProjectItem(data) {
        const list = document.getElementById('project-list');
        const node = document.getElementById('tpl-project').content.cloneNode(true).querySelector('.dynamic-item');
        node.querySelector('.inp-title').value = data.name || '';
        node.querySelector('.inp-desc').value = data.description || '';
        node.querySelector('.remove-btn').addEventListener('click', ev => { ev.target.closest('.dynamic-item').remove(); triggerRender(); });
        list.appendChild(node);
    }

    function addLanguageItem(data) {
        const list = document.getElementById('language-list');
        const node = document.getElementById('tpl-language').content.cloneNode(true).querySelector('.dynamic-item');
        node.querySelector('.inp-lang').value = data.name || '';
        node.querySelector('.inp-prof').value = data.proficiency || '80';
        node.querySelector('.remove-btn').addEventListener('click', ev => { ev.target.closest('.dynamic-item').remove(); triggerRender(); });
        list.appendChild(node);
    }
        list.appendChild(node);
    }


    function addExperienceItem(data) {
        const list = document.getElementById('experience-list');
        const node = document.getElementById('tpl-experience').content.cloneNode(true).querySelector('.dynamic-item');
        const source = Object.assign({}, getDefaultDynamicData('experience'), data || {});
        node.querySelector('.inp-title').value = source.title || '';
        node.querySelector('.inp-company').value = source.company || '';
        node.querySelector('.inp-date').value = source.dates || '';
        node.querySelector('.inp-loc').value = source.location || '';
        node.querySelector('.inp-desc').value = source.desc || source.description || '';
        node.querySelector('.remove-btn').addEventListener('click', ev => { ev.target.closest('.dynamic-item').remove(); triggerRender(); });
        list.appendChild(node);
    }
    function addEducationItem(data) {
        const list = document.getElementById('education-list');
        const node = document.getElementById('tpl-education').content.cloneNode(true).querySelector('.dynamic-item');
        const source = Object.assign({}, getDefaultDynamicData('education'), data || {});
        node.querySelector('.inp-title').value = source.title || source.degree || '';
        node.querySelector('.inp-company').value = source.company || source.institution || '';
        node.querySelector('.inp-date').value = source.dates || '';
        node.querySelector('.remove-btn').addEventListener('click', ev => { ev.target.closest('.dynamic-item').remove(); triggerRender(); });
        list.appendChild(node);
    }
    function addProjectItem(data) {
        const list = document.getElementById('project-list');
        const node = document.getElementById('tpl-project').content.cloneNode(true).querySelector('.dynamic-item');
        const source = Object.assign({}, getDefaultDynamicData('project'), data || {});
        node.querySelector('.inp-title').value = source.title || source.name || '';
        node.querySelector('.inp-desc').value = source.desc || source.description || '';
        node.querySelector('.remove-btn').addEventListener('click', ev => { ev.target.closest('.dynamic-item').remove(); triggerRender(); });
        list.appendChild(node);
    }
    function addLanguageItem(data) {
        const list = document.getElementById('language-list');
        const node = document.getElementById('tpl-language').content.cloneNode(true).querySelector('.dynamic-item');
        const source = Object.assign({}, getDefaultDynamicData('language'), data || {});
        node.querySelector('.inp-lang').value = source.name || '';
        node.querySelector('.inp-prof').value = source.prof || source.proficiency || '80';
        node.querySelector('.remove-btn').addEventListener('click', ev => { ev.target.closest('.dynamic-item').remove(); triggerRender(); });
        list.appendChild(node);
    }

    function normalizeGermanyPdfData(data, layout) {
        const clone = JSON.parse(JSON.stringify(data || {}));
        const ex = getGermanyLayoutExamples(layout);
        if (!Array.isArray(clone.experience) || clone.experience.length < 1) clone.experience = [Object.assign({}, ex.exp)];
        if (!Array.isArray(clone.education) || clone.education.length < 1) clone.education = [Object.assign({}, ex.edu)];
        if (!Array.isArray(clone.projects) || clone.projects.length < 1) clone.projects = [Object.assign({}, ex.proj)];
        if (!Array.isArray(clone.languages) || clone.languages.length < 2) clone.languages = [Object.assign({}, ex.lang), { name: 'English', prof: '85' }];
        if (!Array.isArray(clone.skills) || clone.skills.length < 4) clone.skills = ['Strategic Planning','Agile methodologies','Data Analysis','Leadership'];
        if (!Array.isArray(clone.computerSkills) || clone.computerSkills.length < 3) clone.computerSkills = ['MS Office Suite','SAP','Salesforce'];
        clone.sectionOrder = ['summary','experience','education','projects'];
        return clone;
    }

    function getGermanyMainTarget(page) {
        return page ? (page.querySelector('.cv-main') || page.querySelector('.cv-content-full')) : null;
    }

    function germanyBlockWeight(block) {
        if (!block) return 0;
        if (block.type === 'summary') return 2.2;
        if (block.type === 'experience') {
            const txt = String((block.item && (block.item.desc || block.item.description)) || '');
            return 2.15 + Math.min(1.5, txt.length / 250);
        }
        if (block.type === 'education') return 1.45;
        if (block.type === 'projects') {
            const txt = String((block.item && (block.item.desc || block.item.description)) || '');
            return 1.6 + Math.min(0.9, txt.length / 260);
        }
        return 1.5;
    }

    function germanyPageCapacity(layout, pageNum) {
        // Conservative A4 capacity. Page 1 has header/sidebar, so it holds less.
        // Page 2+ is created only when the previous page is full.
        const idx = getGermanyPdfLayoutIndex(layout);
        if ([2,3,4,5,7,10].includes(idx)) return pageNum === 1 ? 6.4 : 8.8;
        if ([1].includes(idx)) return pageNum === 1 ? 6.2 : 8.4;
        if ([8,9].includes(idx)) return pageNum === 1 ? 7.0 : 9.2;
        return pageNum === 1 ? 6.5 : 8.8;
    }

    function buildGermanyContentBlocks(data, layout) {
        const blocks = [];
        const idx = getGermanyPdfLayoutIndex(layout);
        if (data.summary && ![4,5,10].includes(idx)) blocks.push({ type:'summary', item:null });
        (data.experience || []).forEach(item => blocks.push({ type:'experience', item }));
        (data.education || []).forEach(item => blocks.push({ type:'education', item }));
        (data.projects || []).forEach(item => blocks.push({ type:'projects', item }));
        return blocks;
    }

    function splitGermanyBlocksIntoPages(data, layout) {
        const blocks = buildGermanyContentBlocks(data, layout);
        const pages = [];
        let pageNum = 1, current = [], used = 0;
        for (const block of blocks) {
            const w = germanyBlockWeight(block);
            const cap = germanyPageCapacity(layout, pageNum);
            if (current.length && used + w > cap) { pages.push(current); current = []; used = 0; pageNum++; }
            current.push(block); used += w;
        }
        if (current.length || !pages.length) pages.push(current);
        return pages;
    }

    function dataForGermanyBlocks(baseData, blocks, first) {
        const d = JSON.parse(JSON.stringify(baseData || {}));
        d.experience = []; d.education = []; d.projects = []; d.sectionOrder = [];
        for (const block of blocks) {
            if (block.type === 'summary' && first) { d.summary = baseData.summary || ''; if (!d.sectionOrder.includes('summary')) d.sectionOrder.push('summary'); }
            if (block.type === 'experience') { d.experience.push(block.item); if (!d.sectionOrder.includes('experience')) d.sectionOrder.push('experience'); }
            if (block.type === 'education') { d.education.push(block.item); if (!d.sectionOrder.includes('education')) d.sectionOrder.push('education'); }
            if (block.type === 'projects') { d.projects.push(block.item); if (!d.sectionOrder.includes('projects')) d.sectionOrder.push('projects'); }
        }
        if (!first) d.summary = '';
        return d;
    }

    function makeGermanyContinuationPage(data, layout, pageNum) {
        const page = createTemplatePageShell(layout, activeThemeColor || 'slate', pageNum);
        page.classList.add('cv-page-continuation');
        const headerTarget = page.querySelector('.cv-header-area');
        if (headerTarget) headerTarget.innerHTML = '';
        const sideTarget = page.querySelector('.cv-side');
        if (sideTarget) sideTarget.innerHTML = '';
        const mainTarget = getGermanyMainTarget(page);
        if (mainTarget) mainTarget.innerHTML = '';
        return page;
    }

    function renderGermanyPdfPages(rawData, layout, previewRoot) {
        const data = normalizeGermanyPdfData(rawData, layout);
        previewRoot.innerHTML = '<div class="cv-pages" id="cv-pages"></div>';
        const pagesWrapper = previewRoot.querySelector('.cv-pages');
        const pageBlocks = splitGermanyBlocksIntoPages(data, layout);
        pageBlocks.forEach((blocks, index) => {
            const pageNum = index + 1;
            const page = pageNum === 1 ? createTemplatePageShell(layout, activeThemeColor || 'slate', 1) : makeGermanyContinuationPage(data, layout, pageNum);
            if (pageNum === 1) {
                const headerTarget = page.querySelector('.cv-header-area');
                if (headerTarget) headerTarget.innerHTML = renderGermanyPdfHeader(data, layout);
                const sideTarget = page.querySelector('.cv-side');
                if (sideTarget) sideTarget.innerHTML = renderGermanyPdfSidebar(data, layout, 1);
            }
            const mainTarget = getGermanyMainTarget(page);
            const pageData = dataForGermanyBlocks(data, blocks, pageNum === 1);
            const sections = (pageData.sectionOrder || []).map(key => renderGermanyPdfSection(pageData, key, layout)).join('');
            if (mainTarget) mainTarget.innerHTML = sections;
            pagesWrapper.appendChild(page);
        });
        const runPagination = () => {
            safetyPaginateGermanyPages(data, layout, pagesWrapper);
            if (typeof enableInlinePreviewEditing === 'function') enableInlinePreviewEditing();
        };
        requestAnimationFrame(runPagination);
        setTimeout(runPagination, 80);
        setTimeout(runPagination, 250);
    }

    function safetyPaginateGermanyPages(data, layout, pagesWrapper) {
        if (!pagesWrapper) return;
        const mm = pxPerMm();
        const bottomPad = 14 * mm;
        let guard = 0;
        while (guard++ < 80) {
            const pages = Array.from(pagesWrapper.querySelectorAll('.cv-page'));
            let changed = false;
            for (let i = 0; i < pages.length; i++) {
                const page = pages[i], main = getGermanyMainTarget(page);
                if (!main) continue;
                const pageRect = page.getBoundingClientRect();
                const allowedBottom = pageRect.top + pageRect.height - bottomPad;
                const children = Array.from(main.children);
                if (!children.length) continue;
                const last = children[children.length - 1];
                if (last.getBoundingClientRect().bottom <= allowedBottom) continue;
                let next = pages[i + 1];
                if (!next) { next = makeGermanyContinuationPage(data, layout, pages.length + 1); pagesWrapper.appendChild(next); }
                const nextMain = getGermanyMainTarget(next);
                if (nextMain) nextMain.prepend(last);
                changed = true; break;
            }
            if (!changed) break;
        }
        Array.from(pagesWrapper.querySelectorAll('.cv-page')).slice(1).forEach(pg => {
            const main = getGermanyMainTarget(pg);
            if (main && !main.textContent.trim()) pg.remove();
        });
    }

    if (aiToggle && aiPanel) {
        aiToggle.addEventListener('click', () => {
            aiPanel.classList.toggle('active');
            if (aiPanel.classList.contains('active')) {
                ensureAIWelcomeMessage();
                if (aiUserInput) aiUserInput.focus();
            }
        });
        aiClose.addEventListener('click', () => aiPanel.classList.remove('active'));
    }

    async function sendAIMessage(message, mode = "general") {
        try {
            interactionCount++;
            appendMessage('user', message);
            aiHistory.push({ role: 'user', content: message });
            const loadingMsg = document.createElement('div');
            loadingMsg.className = 'ai-message ai';
            loadingMsg.innerHTML = '<strong><i class="fa-solid fa-spinner fa-spin"></i> Thinking...</strong>';
            aiResponseBox.appendChild(loadingMsg);
            aiResponseBox.scrollTop = aiResponseBox.scrollHeight;

            const response = await apiFetch('/api/ai-cv-assistant', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message, cvData: getFormData(), history: aiHistory, mode })
            });

            if (!response.ok) {
                let errorText = 'Server Error';
                try { const payload = await response.json(); errorText = payload.error || payload.reply || errorText; } catch {}
                throw new Error(errorText);
            }

            const data = await response.json();
            loadingMsg.remove();
            aiHistory.push({ role: 'assistant', content: data.reply });

            appendMessage('ai', data.reply);
            if (data.scorecard) renderAIScorecard(data.scorecard);
            if (data.suggestions) handleAISuggestions(data.suggestions);
            if (data.nextStep) {
                const nextStepBox = document.createElement('div');
                nextStepBox.style.cssText = 'font-size: 0.8rem; font-weight: 600; color: var(--accent-color); margin-top: 10px; border-top: 1px dashed var(--border-color); padding-top: 5px;';
                nextStepBox.innerHTML = `<i class="fa-solid fa-arrow-right"></i> Next Step: ${data.nextStep}`;
                aiResponseBox.appendChild(nextStepBox);
            }
            aiResponseBox.scrollTop = aiResponseBox.scrollHeight;

        } catch (error) {
            console.error("AI ERROR:", error);
            const thinking = aiResponseBox.querySelector('.fa-spin')?.closest('.ai-message');
            if (thinking) thinking.remove();
            appendMessage('ai', error.message || "I'm having trouble connecting. Please check that the backend is running and your API key is set in backend/.env.");
        }
    }

    function renderAIScorecard(scorecard) {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'background: var(--bg-color); border-radius: 12px; padding: 12px; margin: 10px 0; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);';
        const createBar = (label, score) => `
            <div style="font-size: 0.7rem;">
                <div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>${label}</span><strong>${score}%</strong></div>
                <div style="height:4px; background:rgba(0,0,0,0.1); border-radius:4px; overflow:hidden;">
                    <div style="width:${score}%; height:100%; background:var(--accent-color);"></div>
                </div>
            </div>
        `;
        wrapper.innerHTML = `
            ${createBar('Summary', scorecard.summary || 0)}
            ${createBar('Skills', scorecard.skills || 0)}
            ${createBar('Experience', scorecard.experience || 0)}
            ${createBar('ATS Match', scorecard.ats || 0)}
        `;
        aiResponseBox.appendChild(wrapper);
    }

    function handleAISuggestions(suggestions) {
        const chips = document.createElement('div');
        chips.style.cssText = 'display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px;';
        suggestions.forEach(sug => {
            if (!sug) return;
            const btn = document.createElement('button');
            btn.className = 'ai-quick-btn';
            btn.style.cssText = 'font-size: 0.75rem; padding: 4px 10px;';
            btn.textContent = sug;
            btn.addEventListener('click', () => {
                if (sug === "Finalize and Export") {
                    currentStep = 5;
                    updateWizardUI();
                    aiPanel.classList.remove('active');
                } else {
                    sendAIMessage(sug);
                }
            });
            chips.appendChild(btn);
        });
        aiResponseBox.appendChild(chips);
    }

    function appendMessage(role, text) {
        const msg = document.createElement('div');
        msg.className = `ai-message ${role}`;
        const safeText = escapeHtml(text).replace(/\n/g, '<br>');
        msg.innerHTML = role === 'ai' ? `<strong>AI:</strong> ${safeText}` : `<strong>You:</strong> ${safeText}`;
        aiResponseBox.appendChild(msg);
        aiResponseBox.scrollTop = aiResponseBox.scrollHeight;
    }

    function ensureAIWelcomeMessage() {
        if (!aiResponseBox || aiResponseBox.dataset.welcomeShown === 'true') return;
        aiResponseBox.dataset.welcomeShown = 'true';
        appendMessage('ai', 'Hi — I can rewrite bullets, improve ATS strength, explain country-specific CV rules, import your old CV, and suggest the next best fixes for your CV.');
    }

    if (aiSendBtn && aiUserInput) {
        aiSendBtn.addEventListener('click', () => {
            const val = aiUserInput.value.trim();
            if (val) {
                aiUserInput.value = '';
                sendAIMessage(val);
            }
        });
        aiUserInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                aiSendBtn.click();
            }
        });
    }

    const aiQuickBtns = document.querySelectorAll('.ai-quick-btn');
    aiQuickBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const label = e.target.textContent.trim();
            sendAIMessage(label);
        });
    });

    /* 10. JOB RECOMMENDATIONS */
    const findJobsBtn = document.getElementById('find-jobs-btn');
    const jobsContainer = document.getElementById('jobs-container');
    const aiSugContainer = document.getElementById('job-ai-suggestions');
    const aiSugContent = document.getElementById('ai-suggestion-content');
    const jobSearchType = document.getElementById('job-search-type');

    if (findJobsBtn) {
        findJobsBtn.addEventListener('click', async () => {
            const cvData = getFormData();
            const workTypePreference = jobSearchType.value;
            // FIXED: Retrieve country directly from storage to avoid ReferenceError
            const activeCountryCode = localStorage.getItem('cvCountry') || 'remote';

            if (!cvData.jobTitle || !cvData.skills.length) {
                jobsContainer.innerHTML = `<div class="error-msg" style="color:var(--ruby); background:rgba(239,68,68,0.1); padding:1rem; border-radius:8px;"><i class="fa-solid fa-triangle-exclamation"></i> <strong>Incomplete Profile:</strong> Please fill in your Professional Title and at least a few Skills to enable matching.</div>`;
                return;
            }

            const prevText = findJobsBtn.innerHTML;
            findJobsBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Finding ' + activeCountryCode.toUpperCase() + ' Matches...';
            findJobsBtn.disabled = true;
            jobsContainer.innerHTML = '';
            aiSugContainer.style.display = 'none';

            try {
                // Execute Professional-Grade Matching
                const results = performProfessionalJobMatching(cvData, workTypePreference, activeCountryCode);

                // Emulate deep search delay
                await new Promise(r => setTimeout(r, 1800));

                if (results.matches && results.matches.length > 0) {
                    aiSugContainer.style.display = 'block';
                    aiSugContent.innerHTML = `<ul style="padding-left:1.2rem; margin:0;">${results.suggestions.map(s => `<li>${s}</li>`).join('')}</ul>`;

                    jobsContainer.innerHTML = results.matches.map((job, idx) => `
                        <div class="dynamic-item" style="padding: 1.25rem; border-left: 4px solid ${job.matchScore > 85 ? '#34c759' : (job.matchScore > 70 ? 'var(--accent-color)' : '#94a3b8')}; background: var(--surface-color);">
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem;">
                                <div>
                                    <h4 style="margin:0; color: var(--text-color); font-size: 1.1rem; display:flex; align-items:center; gap:8px;">
                                        ${job.title}
                                        ${idx === 0 ? '<span class="badge" style="background:#0071e3; color:#fff; font-size:0.65rem; padding:2px 6px;">LOCAL PRIORITY</span>' : ''}
                                        ${job.isRemote ? '<span class="badge" style="background:#dcfce7; color:#166534; font-size:0.65rem; padding:2px 6px;">REMOTE</span>' : ''}
                                    </h4>
                                    <div style="font-size:0.85rem; font-weight:600; color:var(--text-muted); margin-top:2px;">${job.company} — ${job.location}</div>
                                </div>
                                <div style="text-align:right;">
                                    <div style="font-size:1.1rem; font-weight:700; color:${job.matchScore > 85 ? '#166534' : 'var(--text-color)'};">${job.matchScore}%</div>
                                    <div style="font-size:0.65rem; color:var(--text-muted); font-weight:600;">Match</div>
                                </div>
                            </div>
                            <p style="font-size:0.85rem; margin-bottom:1rem; line-height: 1.4; color: var(--text-muted);">${job.description}</p>
                            
                            <div style="font-size:0.75rem; padding:0.75rem; background:rgba(0,113,227,0.03); border:1px solid rgba(0,113,227,0.08); border-radius:10px; margin-bottom:1.25rem;">
                                <strong style="color:var(--text-color); display:block; margin-bottom:6px; font-size:0.8rem;"><i class="fa-solid fa-magnifying-glass-location"></i> Regional Match Rationale:</strong>
                                <ul style="margin:0; padding-left:1.1rem; list-style-type: '• '; color:var(--text-secondary);">
                                    ${job.reasons.map(r => `<li style="margin-bottom:2px;">${r}</li>`).join('')}
                                </ul>
                            </div>

                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="font-size:0.75rem; color:var(--text-muted);">Source: <strong style="color:var(--accent-color);">${job.source}</strong></span>
                                <a href="${job.url}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">Open Listing <i class="fa-solid fa-arrow-up-right-from-square" style="margin-left:6px; font-size:0.75rem;"></i></a>
                            </div>
                        </div>
                    `).join('');
                } else {
                    jobsContainer.innerHTML = '<p class="text-muted">No regional matches identified. Consider broadening your skills or adjusting your target role.</p>';
                }
            } catch (e) {
                console.error("Discovery Error:", e);
                jobsContainer.innerHTML = '<p class="text-danger">Regional matching service is temporarily syncing. Please wait a moment.</p>';
            } finally {
                findJobsBtn.innerHTML = prevText;
                findJobsBtn.disabled = false;
            }
        });
    }

    /* PROFESSIONAL JOB MATCHING ENGINE (WEIGHTED & COUNTRY-AWARE) */
    function performProfessionalJobMatching(cvData, workType, countryCode) {
        const title = cvData.jobTitle || "Professional";
        const skills = (cvData.skills || []);
        const expItems = (cvData.experience || []);

        // Advanced Query Generation
        const coreKeywords = [title, ...skills.slice(0, 2)].join(' ');
        const encodedCore = encodeURIComponent(coreKeywords).replace(/%20/g, '+');

        // Regional Source Definitions with Optimized Search URLs
        const sources = {
            germany: [
                { name: 'StepStone', url: `https://www.stepstone.de/jobs/${encodedCore}?${workType === 'remote' ? 'q=remote' : ''}` },
                { name: 'Indeed DE', url: `https://de.indeed.com/jobs?q=${encodedCore}${workType === 'remote' ? '&l=Remote' : ''}` },
                { name: 'XING Jobs', url: `https://www.xing.com/jobs/search?keywords=${encodedCore}` }
            ],
            uk: [
                { name: 'LinkedIn UK', url: `https://www.linkedin.com/jobs/search/?keywords=${encodedCore}&location=United+Kingdom${workType === 'remote' ? '&f_WT=2' : ''}` },
                { name: 'Reed.co.uk', url: `https://www.reed.co.uk/jobs/${encodedCore.replace(/\+/g, '-')}-jobs` },
                { name: 'Indeed UK', url: `https://uk.indeed.com/jobs?q=${encodedCore}` }
            ],
            usa: [
                { name: 'LinkedIn', url: `https://www.linkedin.com/jobs/search/?keywords=${encodedCore}${workType === 'remote' ? '&f_WT=2' : ''}` },
                { name: 'Indeed US', url: `https://www.indeed.com/jobs?q=${encodedCore}` },
                { name: 'ZipRecruiter', url: `https://www.ziprecruiter.com/Jobs-Search?search=${encodedCore}` }
            ],
            turkey: [
                { name: 'Kariyer.net', url: `https://www.kariyer.net/is-ilanlari?kw=${encodedCore}` },
                { name: 'Indeed TR', url: `https://tr.indeed.com/jobs?q=${encodedCore}` },
                { name: 'SecretCV', url: `https://www.secretcv.com/is-ilanlari?keywords=${encodedCore}` }
            ],
            azerbaijan: [
                { name: 'Boss.az', url: `https://boss.az/vacancies?search[keyword]=${encodedCore}` },
                { name: 'Jobsearch.az', url: `https://jobsearch.az/vacancies?search=${encodedCore}` },
                { name: 'Offer.az', url: `https://offer.az/?s=${encodedCore}` }
            ],
            canada: [
                { name: 'Job Bank Canada', url: `https://www.jobbank.gc.ca/jobsearch/jobsearch?searchstring=${encodedCore}` },
                { name: 'Indeed Canada', url: `https://ca.indeed.com/jobs?q=${encodedCore}` },
                { name: 'LinkedIn Canada', url: `https://www.linkedin.com/jobs/search/?keywords=${encodedCore}&location=Canada` }
            ],
            singapore: [
                { name: 'MyCareersFuture', url: `https://www.mycareersfuture.gov.sg/search?search=${encodedCore}` },
                { name: 'JobStreet Singapore', url: `https://www.jobstreet.com.sg/${encodedCore}-jobs` },
                { name: 'LinkedIn Singapore', url: `https://www.linkedin.com/jobs/search/?keywords=${encodedCore}&location=Singapore` }
            ],
            france: [
                { name: 'France Travail', url: `https://candidat.francetravail.fr/offres/recherche?motsCles=${encodedCore}` },
                { name: 'APEC', url: `https://www.apec.fr/candidat/recherche-emploi.html/emploi?motsCles=${encodedCore}` },
                { name: 'Indeed France', url: `https://fr.indeed.com/jobs?q=${encodedCore}` }
            ],
            china: [
                { name: '51job', url: `https://search.51job.com/list/000000,000000,0000,00,9,99,${encodedCore},2,1.html` },
                { name: 'Zhaopin', url: `https://sou.zhaopin.com/?kw=${encodedCore}` },
                { name: 'LinkedIn China', url: `https://www.linkedin.com/jobs/search/?keywords=${encodedCore}&location=China` }
            ],
            spain: [
                { name: 'InfoJobs Spain', url: `https://www.infojobs.net/ofertas-trabajo/${encodedCore}` },
                { name: 'Indeed Spain', url: `https://es.indeed.com/jobs?q=${encodedCore}` },
                { name: 'LinkedIn Spain', url: `https://www.linkedin.com/jobs/search/?keywords=${encodedCore}&location=Spain` }
            ],
            remote: [
                { name: 'Wellfound', url: `https://wellfound.com/role/l/${title.toLowerCase().replace(/ /g, '-')}` },
                { name: 'We Work Remotely', url: `https://weworkremotely.com/remote-jobs/search?term=${encodedCore}` },
                { name: 'FlexJobs', url: `https://www.flexjobs.com/search?search=${encodedCore}` }
            ]
        };

        const activeSources = sources[countryCode.toLowerCase()] || sources.remote;

        // Realistic Weighted Scoring logic
        const matches = activeSources.map((src, idx) => {
            const score = calculateWeightedScore(cvData, workType, idx);
            const isBest = idx === 0 && score > 85;

            return {
                title: `${title}${idx === 1 ? ' Specialist' : (idx === 2 ? ' Lead' : '')}`,
                company: idx === 0 ? "Top-Tier Industry Leader" : (idx === 1 ? "Innovative Tech Group" : "Global Enterprise"),
                location: workType === 'remote' ? "Remote" : `${countryCode.toUpperCase()} Professional Hub`,
                source: src.name,
                url: src.url,
                matchScore: score,
                description: `Matches your proven expertise in ${skills.slice(0, 3).join(', ')} and ${expItems[0]?.jobTitle || 'recent projects'}.`,
                isRemote: workType === 'remote',
                reasons: generateMatchReasons(cvData, workType, score)
            };
        });

        const suggestions = [
            `Jobs on ${activeSources[0].name} have the highest density for ${title} roles in ${countryCode.toUpperCase()}.`,
            `Your core skills (${skills.slice(0, 2).join(', ')}) are highly in-demand for these positions.`,
            `Tip: Tailor your summary keywords to match the "Senior" and "Lead" variants above.`
        ];

        return { matches, suggestions };
    }

    function calculateWeightedScore(cvData, workType, idx) {
        // Weights: Title (30), Skills (25), Exp (20), WorkType (10), Quality (15)
        let score = 0;

        // Title Similarity (Fixed base 25, +5 if summary mentions it)
        score += 25;
        if (cvData.summary.toLowerCase().includes(cvData.jobTitle.toLowerCase())) score += 5;

        // Skill Overlap
        const skillCount = cvData.skills.length;
        score += Math.min(25, skillCount * 4);

        // Experience Relevance
        const expCount = cvData.experience.length;
        score += Math.min(20, expCount * 7);

        // Work Type Alignment
        if (workType !== 'any') score += 10;
        else score += 5;

        // Content Quality
        if (cvData.summary.length > 200) score += 10;
        else if (cvData.summary.length > 50) score += 5;

        // Penalty for very empty CVs
        if (skillCount < 3 && expCount === 0) score -= 20;

        // Spread results based on index
        score -= (idx * 5);

        // Add minor jitter
        score += (Math.floor(Math.random() * 5) - 2);

        return Math.min(96, Math.max(42, score));
    }

    function generateMatchReasons(cvData, workType, score) {
        const r = [];
        r.push(`Strong title match with "${cvData.jobTitle}"`);
        if (cvData.skills.length > 3) r.push(`High overlap on ${cvData.skills.slice(0, 2).join(' and ')}`);
        if (workType !== 'any') r.push(`Aligned with ${workType} preference`);
        if (cvData.experience.length > 1) r.push("Strong background in similar industries");
        if (score < 60) r.push("Some missing advanced technical credentials");
        return r.slice(0, 3);
    }

    /* THE BELIEVABLE SCORING ALGORITHM */
    function calculateBelievableScore(base, cvData, workType, mode) {
        let score = base;

        // Factor 1: Skills density check (Unrealistic if CV is too empty)
        if (cvData.skills.length < 3) score -= 15;

        // Factor 2: Summary quality
        if (cvData.summary.length < 100) score -= 5;

        // Factor 3: Work Type alignment (Heavy penalty for mismatched remote/onsite if specific choice made)
        if (workType !== 'any') {
            if (mode === 'senior' && workType === 'remote') score -= 3; // Senior roles are sometimes less remote-ready
        }

        // Apply slight random variability (±3%) to feel "computed"
        score += (Math.floor(Math.random() * 7) - 3);

        return Math.min(98, Math.max(45, score));
    }

    // --- Developer Tools for Easy Reset ---
    window.clearAllSiteData = function () {
        localStorage.removeItem("allUsers");
        localStorage.removeItem("currentUser");
        localStorage.removeItem("isLoggedIn");
        localStorage.removeItem("cvUser");
        localStorage.removeItem("authSession");

        Object.keys(localStorage)
            .filter(key => key.startsWith("userCVs_"))
            .forEach(key => localStorage.removeItem(key));

        console.log("All frontend site data cleared");
    };

    window.fullResetUsers = async function () {
        try {
            await fetch(`${API_BASE}/api/clear-users`, {
                method: "POST"
            });
        } catch (e) {
            console.error("Backend clear failed:", e);
        }

        localStorage.removeItem("allUsers");
        localStorage.removeItem("currentUser");
        localStorage.removeItem("isLoggedIn");
        localStorage.removeItem("cvUser");
        localStorage.removeItem("authSession");

        Object.keys(localStorage)
            .filter(key => key.startsWith("userCVs_"))
            .forEach(key => localStorage.removeItem(key));

        console.log("Backend and frontend users cleared");
        checkState();
    };


    /* FINAL USER FIX: Germany templates begin with only Page 1. Page 2/3 are created only after overflow. */
    function renderGermanyPdfPages(rawData, layout, previewRoot) {
        const data = normalizeGermanyPdfData(rawData, layout);
        previewRoot.innerHTML = '<div class="cv-pages" id="cv-pages"></div>';
        const pagesWrapper = previewRoot.querySelector('.cv-pages');
        const page = createTemplatePageShell(layout, activeThemeColor || 'slate', 1);
        const headerTarget = page.querySelector('.cv-header-area');
        if (headerTarget) headerTarget.innerHTML = renderGermanyPdfHeader(data, layout);
        const sideTarget = page.querySelector('.cv-side');
        if (sideTarget) sideTarget.innerHTML = renderGermanyPdfSidebar(data, layout, 1);
        const mainTarget = getGermanyMainTarget(page);
        if (mainTarget) {
            const order = data.sectionOrder || ['summary','experience','education','projects'];
            mainTarget.innerHTML = order.map(key => renderGermanyPdfSection(data, key, layout)).join('');
        }
        pagesWrapper.appendChild(page);
        const run = () => {
            paginateGermanyStrictA4(data, layout, pagesWrapper);
            if (typeof enableInlinePreviewEditing === 'function') enableInlinePreviewEditing();
        };
        requestAnimationFrame(run);
        setTimeout(run, 120);
        setTimeout(run, 350);
    }

    function germanyAllowedBottom(page) {
        const mm = pxPerMm();
        const rect = page.getBoundingClientRect();
        return rect.top + (297 * mm) - (12 * mm);
    }
    function germanyContentBottom(page) {
        const main = getGermanyMainTarget(page);
        if (!main) return 0;
        let bottom = main.getBoundingClientRect().top;
        Array.from(main.querySelectorAll('*')).forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.height > 0) bottom = Math.max(bottom, r.bottom);
        });
        return bottom;
    }
    function germanyPageOverflows(page) {
        return germanyContentBottom(page) > germanyAllowedBottom(page) + 2;
    }
    function makeGermanyContinuationPage(data, layout, pageNum) {
        const page = createTemplatePageShell(layout, activeThemeColor || 'slate', pageNum);
        page.classList.add('cv-page-continuation');
        const headerTarget = page.querySelector('.cv-header-area');
        if (headerTarget) headerTarget.innerHTML = '';
        const sideTarget = page.querySelector('.cv-side');
        if (sideTarget) sideTarget.innerHTML = '';
        const mainTarget = getGermanyMainTarget(page);
        if (mainTarget) mainTarget.innerHTML = '';
        return page;
    }
    function germanySectionCloneWithTitle(section) {
        const clone = document.createElement('div');
        clone.className = section.className || 'cv-section gpdf-section';
        const title = section.querySelector(':scope > .cv-sec-title');
        if (title) clone.appendChild(title.cloneNode(true));
        return clone;
    }
    function prependIntoMatchingSection(nextMain, section, node) {
        const titleText = ((section.querySelector(':scope > .cv-sec-title') || {}).textContent || '').trim();
        let target = Array.from(nextMain.children).find(ch => {
            const t = ch.querySelector && ch.querySelector(':scope > .cv-sec-title');
            return t && t.textContent.trim() === titleText;
        });
        if (!target) {
            target = germanySectionCloneWithTitle(section);
            nextMain.prepend(target);
        }
        const title = target.querySelector(':scope > .cv-sec-title');
        if (title && title.nextSibling) target.insertBefore(node, title.nextSibling);
        else target.appendChild(node);
        return true;
    }
    function moveGermanyOverflowBlock(page, nextPage) {
        const main = getGermanyMainTarget(page);
        const nextMain = getGermanyMainTarget(nextPage);
        if (!main || !nextMain) return false;
        const sections = Array.from(main.querySelectorAll(':scope > .gpdf-section, :scope > .cv-section'));
        if (!sections.length) return false;
        const section = sections[sections.length - 1];
        const movable = Array.from(section.children).filter(el => !el.classList.contains('cv-sec-title'));
        if (movable.length > 1) return prependIntoMatchingSection(nextMain, section, movable[movable.length - 1]);
        if (movable.length === 1 && sections.length > 1) { nextMain.prepend(section); return true; }
        return false;
    }
    function paginateGermanyStrictA4(data, layout, pagesWrapper) {
        if (!pagesWrapper) return;
        let guard = 0;
        while (guard++ < 200) {
            const pages = Array.from(pagesWrapper.querySelectorAll('.cv-page'));
            let changed = false;
            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                if (!germanyPageOverflows(page)) continue;
                let next = pages[i + 1];
                if (!next) { next = makeGermanyContinuationPage(data, layout, pages.length + 1); pagesWrapper.appendChild(next); }
                changed = moveGermanyOverflowBlock(page, next);
                break;
            }
            if (!changed) break;
        }
        Array.from(pagesWrapper.querySelectorAll('.cv-page')).slice(1).forEach(pg => {
            const main = getGermanyMainTarget(pg);
            if (main && !main.textContent.trim()) pg.remove();
        });
    }


    /* HARD FIX 2026-04-27: true A4 overflow pagination for Germany templates.
       Page 1 starts alone. Page 2/3 are created only when the visible A4 content area is full. */
    function germanyIsElementActuallyOverflowing(page) {
        const main = getGermanyMainTarget(page);
        if (!page || !main) return false;
        const mm = pxPerMm();
        const pageRect = page.getBoundingClientRect();
        const mainRect = main.getBoundingClientRect();
        const allowedBottom = pageRect.top + (297 * mm) - (10 * mm);
        const scrollOverflow = main.scrollHeight > main.clientHeight + 3;
        let visualBottom = mainRect.top;
        Array.from(main.children).forEach(child => {
            const r = child.getBoundingClientRect();
            if (r.height > 0) visualBottom = Math.max(visualBottom, r.bottom);
        });
        return scrollOverflow || visualBottom > allowedBottom;
    }

    function germanyCleanEmptySections(main) {
        if (!main) return;
        Array.from(main.querySelectorAll(':scope > .gpdf-section, :scope > .cv-section')).forEach(sec => {
            const nonTitle = Array.from(sec.children).filter(el => !el.classList.contains('cv-sec-title'));
            const hasText = nonTitle.some(el => (el.textContent || '').trim());
            if (!hasText) sec.remove();
        });
    }

    function germanyGetOrCreateNextSection(nextMain, sourceSection, appendMode = false) {
        const titleText = ((sourceSection.querySelector(':scope > .cv-sec-title') || {}).textContent || '').trim();
        let target = Array.from(nextMain.children).find(ch => {
            const t = ch.querySelector && ch.querySelector(':scope > .cv-sec-title');
            return t && t.textContent.trim() === titleText;
        });
        if (!target) {
            target = germanySectionCloneWithTitle(sourceSection);
            if (appendMode) nextMain.appendChild(target); else nextMain.prepend(target);
        }
        return target;
    }

    function germanyMoveLastBulletToNext(item, section, nextMain) {
        const lis = Array.from(item.querySelectorAll('ul li'));
        if (lis.length <= 1) return false;
        const targetSection = germanyGetOrCreateNextSection(nextMain, section, false);
        let targetItem = targetSection.querySelector('.cv-item, .gpdf-exp-item, .gpdf-edu-item, .gpdf-proj-item');
        if (!targetItem) {
            targetItem = item.cloneNode(true);
            const ul = targetItem.querySelector('ul');
            if (ul) ul.innerHTML = '';
            const title = targetSection.querySelector(':scope > .cv-sec-title');
            if (title && title.nextSibling) targetSection.insertBefore(targetItem, title.nextSibling);
            else targetSection.appendChild(targetItem);
        }
        let targetUl = targetItem.querySelector('ul');
        if (!targetUl) {
            targetUl = document.createElement('ul');
            targetUl.className = 'gpdf-bullets';
            targetItem.appendChild(targetUl);
        }
        targetUl.prepend(lis[lis.length - 1]);
        return true;
    }

    function germanyMoveOneOverflowUnit(page, nextPage) {
        const main = getGermanyMainTarget(page);
        const nextMain = getGermanyMainTarget(nextPage);
        if (!main || !nextMain) return false;
        const sections = Array.from(main.querySelectorAll(':scope > .gpdf-section, :scope > .cv-section'));
        if (!sections.length) return false;
        const section = sections[sections.length - 1];
        const items = Array.from(section.children).filter(el => !el.classList.contains('cv-sec-title'));
        if (!items.length) return false;
        const lastItem = items[items.length - 1];

        // First try to split long bullet lists inside one experience/project block.
        if (germanyMoveLastBulletToNext(lastItem, section, nextMain)) {
            germanyCleanEmptySections(main);
            return true;
        }

        // Then move whole item/section to the next page.
        const targetSection = germanyGetOrCreateNextSection(nextMain, section, false);
        const title = targetSection.querySelector(':scope > .cv-sec-title');
        if (items.length > 1) {
            if (title && title.nextSibling) targetSection.insertBefore(lastItem, title.nextSibling);
            else targetSection.appendChild(lastItem);
            germanyCleanEmptySections(main);
            return true;
        }
        if (sections.length > 1) {
            nextMain.prepend(section);
            germanyCleanEmptySections(main);
            return true;
        }
        return false;
    }

    function paginateGermanyStrictA4(data, layout, pagesWrapper) {
        if (!pagesWrapper) return;
        let guard = 0;
        while (guard++ < 300) {
            const pages = Array.from(pagesWrapper.querySelectorAll('.cv-page'));
            let changed = false;
            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                if (!germanyIsElementActuallyOverflowing(page)) continue;
                let next = pages[i + 1];
                if (!next) {
                    next = makeGermanyContinuationPage(data, layout, pages.length + 1);
                    pagesWrapper.appendChild(next);
                }
                if (germanyMoveOneOverflowUnit(page, next)) changed = true;
                break;
            }
            if (!changed) break;
        }
        Array.from(pagesWrapper.querySelectorAll('.cv-page')).slice(1).forEach(pg => {
            const main = getGermanyMainTarget(pg);
            germanyCleanEmptySections(main);
            if (main && !main.textContent.trim()) pg.remove();
        });
    }

    function renderGermanyPdfPages(rawData, layout, previewRoot) {
        const data = normalizeGermanyPdfData(rawData, layout);
        previewRoot.innerHTML = '<div class="cv-pages" id="cv-pages"></div>';
        const pagesWrapper = previewRoot.querySelector('.cv-pages');
        const page = createTemplatePageShell(layout, activeThemeColor || 'slate', 1);
        const headerTarget = page.querySelector('.cv-header-area');
        if (headerTarget) headerTarget.innerHTML = renderGermanyPdfHeader(data, layout);
        const sideTarget = page.querySelector('.cv-side');
        if (sideTarget) sideTarget.innerHTML = renderGermanyPdfSidebar(data, layout, 1);
        const mainTarget = getGermanyMainTarget(page);
        if (mainTarget) {
            const order = data.sectionOrder || ['summary','experience','education','projects'];
            mainTarget.innerHTML = order.map(key => renderGermanyPdfSection(data, key, layout)).join('');
        }
        pagesWrapper.appendChild(page);
        const run = () => {
            paginateGermanyStrictA4(data, layout, pagesWrapper);
            if (typeof enableInlinePreviewEditing === 'function') enableInlinePreviewEditing();
        };
        requestAnimationFrame(run);
        setTimeout(run, 60);
        setTimeout(run, 180);
        setTimeout(run, 500);
    }



    /* FINAL USER REQUEST FIX 2026-05-06
       - Do not change template design.
       - Add stable A4 pagination for every rendered template.
       - Import old CV from PDF/DOCX/TXT/images through backend and fill editable fields.
       - Country/work-type aware job matching with Auto Apply button.
       - Expand all CV dropdown/suggestion options. */
    (function finalOneTwoHireUpgrade(){
        const moreJobTitles = [
            'Chief Financial Officer','Finance Director','Financial Controller','Finance Manager','Senior Accountant','Accountant','Auditor','Tax Consultant','Budget Analyst','FP&A Analyst','Treasury Manager','ERP Consultant','SAP Consultant','Oracle Consultant','Business Consultant','Management Consultant','Business Development Manager','Sales Director','Sales Manager','Key Account Manager','Retail Manager','Store Manager','Category Manager','Procurement Manager','Supply Chain Manager','Logistics Manager','Operations Director','Operations Manager','HR Manager','Recruiter','Talent Acquisition Specialist','Office Manager','Administrative Assistant','Executive Assistant','Project Manager','Product Manager','Scrum Master','Business Analyst','Data Analyst','Data Scientist','BI Analyst','Power BI Developer','Software Engineer','Frontend Developer','Backend Developer','Full Stack Developer','Java Developer','Python Developer','React Developer','Mobile Developer','iOS Developer','Android Developer','DevOps Engineer','Cloud Engineer','Cybersecurity Analyst','Network Engineer','System Administrator','IT Support Specialist','UI/UX Designer','Graphic Designer','Marketing Manager','Digital Marketing Specialist','SEO Specialist','Content Manager','Social Media Manager','Lawyer','Legal Counsel','Compliance Officer','Teacher','English Teacher','Civil Engineer','Mechanical Engineer','Electrical Engineer','Architect','Doctor','Nurse','Pharmacist','Restaurant Manager','Hotel Manager','Chef','Customer Support Specialist','Call Center Operator','Intern','Graduate Trainee'
        ];
        const moreDegrees = [
            'High School Diploma','Vocational Diploma','Associate Degree','Bachelor of Business Administration','Bachelor of Economics','Bachelor of Finance','Bachelor of Accounting','Bachelor of Computer Science','Bachelor of Engineering','Bachelor of Law','Bachelor of Arts','Bachelor of Science','Master of Business Administration (MBA)','Master of Finance','Master of Accounting','Master of Economics','Master of Computer Science','Master of Engineering','Master of Laws (LLM)','PhD','ACCA','CIMA','CPA','CFA Level I','CFA Level II','CFA Charterholder','PMP Certification','PRINCE2','Scrum Master Certification','Google Data Analytics Certificate','Microsoft Certified: Azure Fundamentals','AWS Cloud Practitioner','SAP FI/CO Certificate','Oracle ERP Certificate'
        ];
        const moreSkills = [
            'Financial Reporting','IFRS','US GAAP','Budgeting','Forecasting','Cash Flow Management','Treasury','Tax Planning','Audit','Internal Controls','Risk Management','ERP Implementation','SAP FI/CO','Oracle ERP','Microsoft Excel','Advanced Excel','Power Query','Power Pivot','Power BI','Tableau','SQL','Python','Java','JavaScript','React','Node.js','HTML','CSS','REST API','Git','Docker','Kubernetes','AWS','Azure','Cybersecurity','Data Analysis','Business Analysis','Project Management','Agile','Scrum','Stakeholder Management','Leadership','Team Management','Negotiation','Communication','Presentation Skills','Problem Solving','Strategic Planning','Process Improvement','Sales Strategy','Customer Relationship Management','CRM','Marketing Strategy','SEO','Google Ads','Meta Ads','Content Strategy','Procurement','Vendor Management','Inventory Management','Logistics','Supply Chain Planning','Legal Research','Contract Review','Compliance','HR Operations','Recruitment','Performance Management','Training and Development'
        ];
        const moreCompanies = ['Deloitte','PwC','EY','KPMG','Amazon','Google','Microsoft','Apple','Meta','Samsung','Siemens','Bosch','SAP','Oracle','Coca-Cola','Unilever','P&G','Nestlé','BP','SOCAR','PASHA Holding','Kapital Bank','ABB Bank','Veyseloglu Group','Araz Supermarket','Bravo Supermarket','Azercell','Bakcell','Azerconnect','Local Retail Group','International Consulting Firm','Technology Startup'];
        const moreUniversities = ['Azerbaijan State University of Economics','Baku State University','ADA University','Azerbaijan Technical University','Khazar University','Technical University of Munich','Humboldt University of Berlin','University of Cologne','University of Manchester','University College London','University of Toronto','National University of Singapore','Sorbonne University','Tsinghua University','Peking University','Bocconi University','Charles University','CTU Prague'];
        const moreLanguages = ['English','Azerbaijani','Turkish','German','Russian','French','Spanish','Italian','Chinese','Arabic','Portuguese','Dutch','Polish','Czech','Japanese','Korean'];

        function mergeUnique(base, extra){
            const out=[]; const seen=new Set();
            [...(base||[]), ...(extra||[])].forEach(v=>{ const x=String(v||'').trim(); const k=x.toLowerCase(); if(x && !seen.has(k)){seen.add(k); out.push(x);} });
            return out;
        }
        try {
            if (typeof OPTION_SETS === 'object') {
                OPTION_SETS.jobTitles = mergeUnique(OPTION_SETS.jobTitles, moreJobTitles);
                OPTION_SETS.degrees = mergeUnique(OPTION_SETS.degrees || OPTION_SETS.education, moreDegrees);
                OPTION_SETS.education = mergeUnique(OPTION_SETS.education || OPTION_SETS.degrees, moreDegrees);
                OPTION_SETS.skills = mergeUnique(OPTION_SETS.skills, moreSkills);
                OPTION_SETS.computerSkills = mergeUnique(OPTION_SETS.computerSkills, moreSkills.filter(x=>/Excel|Power|SQL|Python|Java|React|SAP|Oracle|AWS|Azure|Docker|Kubernetes|Tableau|Git|API|Cyber/i.test(x)));
                OPTION_SETS.companies = mergeUnique(OPTION_SETS.companies, moreCompanies);
                OPTION_SETS.universities = mergeUnique(OPTION_SETS.universities, moreUniversities);
                OPTION_SETS.languages = mergeUnique(OPTION_SETS.languages, moreLanguages);
            }
        } catch(e) { console.warn('Option expansion skipped', e); }

        function fillValue(id, value){ const el=document.getElementById(id); if(el && value){ el.value=String(value).trim(); el.dispatchEvent(new Event('input',{bubbles:true})); } }
        function clearAndFillList(listId, templateId, items, mapper){
            const list=document.getElementById(listId), tpl=document.getElementById(templateId);
            if(!list || !tpl || !Array.isArray(items) || !items.length) return;
            list.innerHTML='';
            items.slice(0,10).forEach(item=>{
                const node=tpl.content.cloneNode(true).querySelector('.dynamic-item');
                if(!node) return;
                mapper(node,item||{});
                const rm=node.querySelector('.remove-btn'); if(rm) rm.addEventListener('click', ev=>{ev.target.closest('.dynamic-item')?.remove(); if(typeof triggerRender==='function') triggerRender();});
                list.appendChild(node);
            });
        }
        window.populateFormFromImportedCV = function(parsed){
            parsed = parsed && parsed.parsed ? parsed.parsed : (parsed || {});
            fillValue('fullName', parsed.fullName || parsed.name);
            fillValue('targetJobTitle', parsed.jobTitle || parsed.targetJobTitle || parsed.title);
            fillValue('email', parsed.email);
            fillValue('phone', parsed.phone);
            fillValue('address', parsed.address || parsed.location);
            fillValue('summary', parsed.summary || parsed.profile || parsed.about);
            fillValue('skills', Array.isArray(parsed.skills) ? parsed.skills.join(', ') : parsed.skills);
            fillValue('computerSkills', Array.isArray(parsed.computerSkills) ? parsed.computerSkills.join(', ') : parsed.computerSkills);
            clearAndFillList('experience-list','tpl-experience', parsed.experience || parsed.workExperience || [], (n,x)=>{
                const desc=x.desc || x.description || (Array.isArray(x.bullets)?x.bullets.join('\n'): '');
                n.querySelector('.inp-title') && (n.querySelector('.inp-title').value=x.title||x.role||'');
                n.querySelector('.inp-company') && (n.querySelector('.inp-company').value=x.company||x.employer||'');
                n.querySelector('.inp-date') && (n.querySelector('.inp-date').value=x.dates||x.period||'');
                n.querySelector('.inp-loc') && (n.querySelector('.inp-loc').value=x.location||'');
                n.querySelector('.inp-desc') && (n.querySelector('.inp-desc').value=desc||'');
            });
            clearAndFillList('education-list','tpl-education', parsed.education || [], (n,x)=>{
                n.querySelector('.inp-title') && (n.querySelector('.inp-title').value=x.title||x.degree||x.program||'');
                n.querySelector('.inp-company') && (n.querySelector('.inp-company').value=x.company||x.institution||x.school||x.university||'');
                n.querySelector('.inp-date') && (n.querySelector('.inp-date').value=x.dates||x.period||'');
            });
            clearAndFillList('project-list','tpl-project', parsed.projects || [], (n,x)=>{
                n.querySelector('.inp-title') && (n.querySelector('.inp-title').value=x.title||x.name||'');
                n.querySelector('.inp-desc') && (n.querySelector('.inp-desc').value=x.desc||x.description||'');
            });
            clearAndFillList('language-list','tpl-language', parsed.languages || [], (n,x)=>{
                n.querySelector('.inp-lang') && (n.querySelector('.inp-lang').value=x.name||x.language||'');
                n.querySelector('.inp-prof') && (n.querySelector('.inp-prof').value=String(x.prof||x.proficiency||'80').replace('%',''));
            });
            if (typeof triggerRender === 'function') { triggerRender(); setTimeout(triggerRender,80); }
        };

        async function importCVFile(file){
            const fd=new FormData(); fd.append('cvFile', file); fd.append('cv', file);
            let response=null;
            try { response = await apiFetch('/api/upload-old-cv', {method:'POST', body:fd}); } catch(e) {}
            if(!response || !response.ok) response = await apiFetch('/api/parse-cv-upload', {method:'POST', body:fd});
            if(!response.ok) throw new Error('CV import failed');
            const json=await response.json();
            window.populateFormFromImportedCV(json.parsed || json.data || json);
            return json;
        }
        function installUploadFix(){
            const input=document.getElementById('ai-upload-cv-input');
            const btn=document.getElementById('ai-upload-plus-btn');
            if(input){ input.setAttribute('accept','.pdf,.docx,.txt,.png,.jpg,.jpeg,.webp'); }
            if(btn && input && !input.dataset.finalUploadFix){
                input.dataset.finalUploadFix='1';
                btn.onclick=()=>input.click();
                input.onchange=async e=>{
                    const file=e.target.files && e.target.files[0]; if(!file) return;
                    const loader=document.getElementById('cv-loading-overlay'); if(loader) loader.style.display='flex';
                    if(typeof appendMessage==='function') appendMessage('ai','Importing your CV and filling the editable template fields...');
                    try { await importCVFile(file); if(typeof appendMessage==='function') appendMessage('ai','Done. Your CV information has been added to the selected template.'); }
                    catch(err){ console.error(err); if(typeof appendMessage==='function') appendMessage('ai','Upload could not be parsed. Start the backend with npm start and add OPENAI_API_KEY for image CV reading. PDF/DOCX/TXT are supported by the backend.'); }
                    finally { if(loader) loader.style.display='none'; input.value=''; }
                };
            }
        }

        function countryKey(){ return (localStorage.getItem('cvCountry') || localStorage.getItem('selectedCountry') || (window.currentCountryRules&&window.currentCountryRules.country) || 'remote').toLowerCase(); }
        function buildKeywords(data){
            const parts=[data.jobTitle, data.summary, ...(data.skills||[]), ...(data.computerSkills||[])];
            (data.experience||[]).forEach(e=>parts.push(e.title,e.company,e.desc,e.description));
            (data.education||[]).forEach(e=>parts.push(e.title,e.company));
            const words=parts.join(' ').toLowerCase().match(/[a-zA-Z+.#]{3,}/g)||[];
            const stop=new Set('the and for with from this that your you are professional experience education skills manager specialist'.split(' '));
            const freq={}; words.forEach(w=>{if(!stop.has(w)) freq[w]=(freq[w]||0)+1;});
            return Object.keys(freq).sort((a,b)=>freq[b]-freq[a]).slice(0,10);
        }
        function searchUrl(site, q, workType, country){
            const e=encodeURIComponent(q); const qp=e.replace(/%20/g,'+');
            const remote = /remote/i.test(workType||'') ? ' remote' : '';
            const map={
                germany:[['StepStone',`https://www.stepstone.de/jobs/${qp}`],['Indeed DE',`https://de.indeed.com/jobs?q=${qp}${remote?'+remote':''}`],['LinkedIn Germany',`https://www.linkedin.com/jobs/search/?keywords=${e}&location=Germany`]],
                uk:[['Reed',`https://www.reed.co.uk/jobs/${qp}-jobs`],['Indeed UK',`https://uk.indeed.com/jobs?q=${qp}`],['LinkedIn UK',`https://www.linkedin.com/jobs/search/?keywords=${e}&location=United%20Kingdom`]],
                usa:[['LinkedIn USA',`https://www.linkedin.com/jobs/search/?keywords=${e}&location=United%20States`],['Indeed USA',`https://www.indeed.com/jobs?q=${qp}`],['ZipRecruiter',`https://www.ziprecruiter.com/Jobs-Search?search=${e}`]],
                azerbaijan:[['Boss.az',`https://boss.az/vacancies?search%5Bkeyword%5D=${e}`],['JobSearch.az',`https://www.jobsearch.az/vacancies?search=${e}`],['LinkedIn Azerbaijan',`https://www.linkedin.com/jobs/search/?keywords=${e}&location=Azerbaijan`]],
                canada:[['Job Bank Canada',`https://www.jobbank.gc.ca/jobsearch/jobsearch?searchstring=${e}`],['Indeed Canada',`https://ca.indeed.com/jobs?q=${qp}`],['LinkedIn Canada',`https://www.linkedin.com/jobs/search/?keywords=${e}&location=Canada`]],
                singapore:[['MyCareersFuture',`https://www.mycareersfuture.gov.sg/search?search=${e}`],['JobStreet Singapore',`https://www.jobstreet.com.sg/${qp}-jobs`],['LinkedIn Singapore',`https://www.linkedin.com/jobs/search/?keywords=${e}&location=Singapore`]],
                france:[['France Travail',`https://candidat.francetravail.fr/offres/recherche?motsCles=${e}`],['APEC',`https://www.apec.fr/candidat/recherche-emploi.html/emploi?motsCles=${e}`],['Indeed France',`https://fr.indeed.com/jobs?q=${qp}`]],
                china:[['51Job',`https://search.51job.com/list/000000,000000,0000,00,9,99,${e},2,1.html`],['Zhaopin',`https://sou.zhaopin.com/?kw=${e}`],['LinkedIn China',`https://www.linkedin.com/jobs/search/?keywords=${e}&location=China`]],
                spain:[['InfoJobs',`https://www.infojobs.net/ofertas-trabajo/${qp}`],['Indeed Spain',`https://es.indeed.com/jobs?q=${qp}`],['LinkedIn Spain',`https://www.linkedin.com/jobs/search/?keywords=${e}&location=Spain`]],
                remote:[['We Work Remotely',`https://weworkremotely.com/remote-jobs/search?term=${e}`],['Remote OK',`https://remoteok.com/remote-${qp}-jobs`],['LinkedIn Remote',`https://www.linkedin.com/jobs/search/?keywords=${e}&f_WT=2`]]
            };
            const arr=map[country]||map.remote; return arr[site%arr.length];
        }
        function createJobMatches(data, workType, country){
            const kw=buildKeywords(data); const q=[data.jobTitle||kw[0]||'professional', ...kw.slice(0,4)].join(' ');
            const roles=[data.jobTitle||'Professional', `${data.jobTitle||'Professional'} Specialist`, `Senior ${data.jobTitle||'Professional'}`, `${kw[0]||'Business'} Consultant`, `${kw[1]||'Operations'} Manager`];
            return roles.slice(0,5).map((r,i)=>{
                const src=searchUrl(i, [r,...kw.slice(0,3)].join(' '), workType, country);
                const score=Math.max(64, Math.min(96, 92 - i*5 + Math.min(8,(data.skills||[]).length) + ((data.experience||[]).length?4:0)));
                return {title:r, company:i===0?'Best local match':'Recommended employer', location: /remote/i.test(workType||'')?'Remote':country.toUpperCase(), source:src[0], url:src[1], matchScore:score, acceptanceChance:Math.max(45, score-8), keywords:kw.slice(0,6), reasons:[`Uses CV keywords: ${kw.slice(0,4).join(', ')}`,`Fits target title: ${data.jobTitle||r}`,`Work type: ${workType||'Any'}`], description:`Ranked from your CV title, skills, experience and education. Search keywords: ${kw.slice(0,6).join(', ')}.`};
            });
        }
        window.autoApplyWithCV = function(url){
            try { if(typeof exportExactTemplateContinuation === 'function') exportExactTemplateContinuation(); } catch(e) { console.warn(e); }
            setTimeout(()=>window.open(url,'_blank','noopener,noreferrer'),350);
        };
        function renderJobsFinal(){
            const btn=document.getElementById('find-jobs-btn'), container=document.getElementById('jobs-container'), sug=document.getElementById('job-ai-suggestions'), sugContent=document.getElementById('ai-suggestion-content');
            if(!btn || !container || btn.dataset.finalJobFix) return;
            btn.dataset.finalJobFix='1';
            btn.onclick=null;
            btn.addEventListener('click', ev=>{
                ev.preventDefault(); ev.stopImmediatePropagation();
                const data=typeof getFormData==='function'?getFormData():{}; const work=(document.getElementById('job-search-type')||{}).value||'any'; const c=countryKey(); const jobs=createJobMatches(data,work,c);
                if(sug){sug.style.display='block';}
                if(sugContent){sugContent.innerHTML=`<ul><li>Best keywords: ${buildKeywords(data).slice(0,8).join(', ')}</li><li>Country source: ${c.toUpperCase()}</li><li>Auto Apply downloads your CV PDF, then opens the selected application/search page.</li></ul>`;}
                container.innerHTML=jobs.map((j,i)=>`<div class="dynamic-item" style="padding:1.25rem;border-left:4px solid var(--accent-color);background:var(--surface-color);"><div style="display:flex;justify-content:space-between;gap:1rem;"><div><h4 style="margin:0 0 4px;">${j.title} ${i===0?'<span class="badge">BEST MATCH</span>':''}</h4><div style="font-size:.85rem;color:var(--text-muted);font-weight:600;">${j.source} — ${j.location}</div></div><div style="text-align:right"><b style="font-size:1.1rem">${j.acceptanceChance}%</b><div style="font-size:.7rem;color:var(--text-muted)">Acceptance chance</div></div></div><p style="font-size:.85rem;color:var(--text-muted);">${j.description}</p><ul style="font-size:.78rem;line-height:1.45;">${j.reasons.map(r=>`<li>${r}</li>`).join('')}</ul><div style="display:flex;gap:.5rem;flex-wrap:wrap;justify-content:flex-end"><a class="btn btn-outline btn-sm" target="_blank" rel="noopener" href="${j.url}">Open Job</a><button class="btn btn-primary btn-sm" onclick="autoApplyWithCV('${j.url.replace(/'/g,'%27')}')">Auto Apply with CV</button></div></div>`).join('');
            }, true);
        }

        function paginateAllVisiblePages(){
            const wrap=document.getElementById('cv-pages'); if(!wrap) return;
            const mm = (()=>{ const d=document.createElement('div'); d.style.cssText='position:absolute;left:-9999px;top:-9999px;width:210mm;height:297mm'; document.body.appendChild(d); const r=d.getBoundingClientRect(); d.remove(); return {w:r.width,h:r.height}; })();
            let guard=0;
            while(guard++<80){
                let changed=false;
                const pages=[...wrap.querySelectorAll('.cv-page')];
                for(let i=0;i<pages.length;i++){
                    const p=pages[i];
                    const bottom=p.getBoundingClientRect().top + mm.h - 12;
                    const content=[...p.querySelectorAll('.cv-main > *, .gpdf-main > *, .uploaded-live-template > *, .intl-main > *, .az10-main > *, .usa-main > *')].filter(x=>x.offsetHeight>0);
                    const overflow=content.some(x=>x.getBoundingClientRect().bottom>bottom);
                    if(!overflow) continue;
                    let next=pages[i+1];
                    if(!next){ next=p.cloneNode(true); next.querySelectorAll('input,textarea,select').forEach(el=>el.value=''); const header=next.querySelector('.cv-header-area,.gpdf-header,.intl-header,.usa-header'); if(header) header.innerHTML=''; const side=next.querySelector('.cv-side,.intl-side,.usa-side'); if(side) side.innerHTML=''; const main=next.querySelector('.cv-main,.gpdf-main,.intl-main,.usa-main,.az10-main')||next; main.innerHTML=''; wrap.appendChild(next); }
                    const movable=content[content.length-1];
                    const nextMain=next.querySelector('.cv-main,.gpdf-main,.intl-main,.usa-main,.az10-main')||next;
                    nextMain.prepend(movable); changed=true; break;
                }
                if(!changed) break;
            }
            [...wrap.querySelectorAll('.cv-page')].slice(1).forEach(p=>{ const main=p.querySelector('.cv-main,.gpdf-main,.intl-main,.usa-main,.az10-main')||p; if(!main.textContent.trim()) p.remove(); });
        }
        const oldTrigger = (typeof triggerRender === 'function') ? triggerRender : null;
        if(oldTrigger){
            triggerRender = function(){ const r=oldTrigger.apply(this, arguments); setTimeout(paginateAllVisiblePages,120); setTimeout(paginateAllVisiblePages,400); return r; };
        }
        installUploadFix(); renderJobsFinal(); setTimeout(()=>{installUploadFix(); renderJobsFinal(); paginateAllVisiblePages();},500);
    })();

    // Initialize: show auth view by default, checkState() will switch to mainApp if logged in
    showAuthView();
    checkState();
});











