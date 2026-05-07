import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import multer from "multer";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import nodemailer from "nodemailer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load API key from both backend/.env and project-root/.env.
// This fixes the common case where OPENAI_API_KEY is added to the main project folder instead of backend/.env.
dotenv.config({ path: path.join(__dirname, "..", ".env") });
dotenv.config({ path: path.join(__dirname, ".env"), override: true });

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.json({ limit: "25mb" }));

const originsFromEnv = (process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);

const allowedOrigins = originsFromEnv.length
  ? originsFromEnv
  : [
      "http://localhost:5173",
      "http://localhost:5500",
      "http://127.0.0.1:5500",
      "http://localhost:3000",
      "null"
    ];

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || origin === "null") return callback(null, true);
    return callback(null, true);
  },
  credentials: true
}));

const PORT = process.env.PORT || 4000;
const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || "").trim().replace(/^['"]|['"]$/g, "");

let client = null;
if (OPENAI_API_KEY && !/^YOUR_|^sk-REPLACE_ME/i.test(OPENAI_API_KEY)) {
  client = new OpenAI({ apiKey: OPENAI_API_KEY });
}

const COUNTRY_JOB_SITES = {
  canada: [
    { name: "LinkedIn Canada", url: "https://www.linkedin.com/jobs/search/?location=Canada" },
    { name: "Indeed Canada", url: "https://ca.indeed.com/jobs" },
    { name: "Job Bank Canada", url: "https://www.jobbank.gc.ca/jobsearch/jobsearch" },
    { name: "Glassdoor Canada", url: "https://www.glassdoor.ca/Job/canada-jobs-SRCH_IL.0,6_IN3.htm" }
  ],
  singapore: [
    { name: "LinkedIn Singapore", url: "https://www.linkedin.com/jobs/search/?location=Singapore" },
    { name: "MyCareersFuture", url: "https://www.mycareersfuture.gov.sg/search" },
    { name: "JobStreet Singapore", url: "https://www.jobstreet.com.sg/jobs" },
    { name: "Indeed Singapore", url: "https://sg.indeed.com/jobs" }
  ],
  france: [
    { name: "LinkedIn France", url: "https://www.linkedin.com/jobs/search/?location=France" },
    { name: "France Travail", url: "https://candidat.francetravail.fr/offres/recherche" },
    { name: "Indeed France", url: "https://fr.indeed.com/jobs" },
    { name: "Welcome to the Jungle", url: "https://www.welcometothejungle.com/fr/jobs" }
  ],
  china: [
    { name: "LinkedIn China", url: "https://www.linkedin.com/jobs/search/?location=China" },
    { name: "Zhaopin", url: "https://sou.zhaopin.com/" },
    { name: "51Job", url: "https://we.51job.com/pc/search" },
    { name: "Boss Zhipin", url: "https://www.zhipin.com/" }
  ],
  spain: [
    { name: "LinkedIn Spain", url: "https://www.linkedin.com/jobs/search/?location=Spain" },
    { name: "InfoJobs", url: "https://www.infojobs.net/jobsearch/search-results/list.xhtml" },
    { name: "Indeed Spain", url: "https://es.indeed.com/jobs" },
    { name: "Tecnoempleo", url: "https://www.tecnoempleo.com/" }
  ],
  usa: [
    { name: "LinkedIn USA", url: "https://www.linkedin.com/jobs/search/?location=United%20States" },
    { name: "Indeed USA", url: "https://www.indeed.com/jobs" },
    { name: "Glassdoor USA", url: "https://www.glassdoor.com/Job/us-jobs-SRCH_IL.0,2_IN1.htm" }
  ],
  uk: [
    { name: "LinkedIn UK", url: "https://www.linkedin.com/jobs/search/?location=United%20Kingdom" },
    { name: "Indeed UK", url: "https://uk.indeed.com/jobs" },
    { name: "Reed", url: "https://www.reed.co.uk/jobs" }
  ],
  germany: [
    { name: "LinkedIn Germany", url: "https://www.linkedin.com/jobs/search/?location=Germany" },
    { name: "StepStone Germany", url: "https://www.stepstone.de/jobs" },
    { name: "Indeed Germany", url: "https://de.indeed.com/jobs" }
  ],
  azerbaijan: [
    { name: "LinkedIn Azerbaijan", url: "https://www.linkedin.com/jobs/search/?location=Azerbaijan" },
    { name: "Boss.az", url: "https://boss.az/vacancies" },
    { name: "JobSearch.az", url: "https://www.jobsearch.az/vacancies" }
  ]
};

function cleanText(text = "") {
  return String(text).replace(/\r/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function pickLines(text) {
  return cleanText(text).split("\n").map(x => x.trim()).filter(Boolean);
}

function guessEmail(text) {
  return (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [""])[0];
}

function guessPhone(text) {
  return (text.match(/(\+?\d[\d\s().-]{7,}\d)/) || [""])[0];
}

function guessName(lines) {
  const bad = /resume|curriculum|vitae|cv|profile|summary|experience|education|skills|contact/i;
  return lines.find(l => l.length >= 3 && l.length <= 45 && !bad.test(l) && /^[A-Za-zÀ-žĀ-ſÇĞİÖŞÜçğıöşü'’.\-\s]+$/.test(l)) || "";
}

function extractSection(text, keys, stopKeys) {
  const lower = text.toLowerCase();
  let start = -1, startKey = "";
  for (const k of keys) {
    const idx = lower.search(new RegExp(`(^|\\n)\\s*${k}\\s*:?`, "i"));
    if (idx >= 0 && (start < 0 || idx < start)) { start = idx; startKey = k; }
  }
  if (start < 0) return "";
  let slice = text.slice(start).replace(new RegExp(`^\\s*${startKey}\\s*:?`, "i"), "");
  let end = slice.length;
  for (const k of stopKeys) {
    const m = slice.toLowerCase().search(new RegExp(`\\n\\s*${k}\\s*:?`, "i"));
    if (m > 20 && m < end) end = m;
  }
  return cleanText(slice.slice(0, end));
}

function heuristicParseCV(text) {
  const lines = pickLines(text);
  const email = guessEmail(text);
  const phone = guessPhone(text);
  const fullName = guessName(lines);
  const titleLine = lines.find(l => l !== fullName && l.length < 60 && /(developer|engineer|manager|analyst|designer|accountant|finance|sales|marketing|teacher|specialist|consultant|director|assistant|architect|nurse|doctor|lawyer|officer|coordinator)/i.test(l)) || "";

  const summary = extractSection(text, ["summary", "profile", "about me", "professional summary"], ["experience", "work experience", "employment", "education", "skills", "projects", "languages"]);
  const skillsText = extractSection(text, ["skills", "technical skills", "core skills"], ["experience", "work experience", "employment", "education", "projects", "languages", "certifications"]);
  const eduText = extractSection(text, ["education", "academic background"], ["experience", "work experience", "employment", "skills", "projects", "languages", "certifications"]);
  const expText = extractSection(text, ["experience", "work experience", "employment history", "professional experience"], ["education", "skills", "projects", "languages", "certifications"]);

  const skills = skillsText
    ? skillsText.split(/[,•|;\n]/).map(s => s.trim()).filter(s => s.length > 1 && s.length < 40).slice(0, 18)
    : [];

  const experience = [];
  if (expText) {
    const chunks = expText.split(/\n\s*\n|(?=\n.*\b(20\d{2}|19\d{2}|present|current)\b)/i).map(cleanText).filter(Boolean).slice(0, 4);
    for (const c of chunks) {
      const cLines = pickLines(c);
      if (!cLines.length) continue;
      experience.push({
        title: cLines[0] || "",
        company: cLines[1] || "",
        dates: (c.match(/((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*)?(19|20)\d{2}\s*[-–—]\s*((present|current)|((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*)?(19|20)\d{2})/i) || [""])[0],
        location: "",
        desc: cLines.slice(2).join("\n").slice(0, 700)
      });
    }
  }

  const education = [];
  if (eduText) {
    const eLines = pickLines(eduText).slice(0, 8);
    if (eLines.length) {
      education.push({
        title: eLines[0] || "",
        company: eLines[1] || "",
        dates: (eduText.match(/(19|20)\d{2}\s*[-–—]\s*((19|20)\d{2}|present|current)/i) || [""])[0]
      });
    }
  }

  return {
    fullName,
    jobTitle: titleLine,
    email,
    phone,
    address: "",
    summary: summary || lines.slice(1, 4).join(" ").slice(0, 500),
    skills,
    computerSkills: skills.filter(s => /excel|word|powerpoint|office|python|java|javascript|react|sql|sap|oracle|photoshop|autocad|figma|tableau|power bi/i.test(s)),
    experience,
    education,
    projects: [],
    languages: []
  };
}

async function aiStructureCV(rawText, parsed) {
  if (!client) return parsed;

  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Extract CV data into valid JSON only. Use this schema:
{
 "fullName": "",
 "jobTitle": "",
 "email": "",
 "phone": "",
 "address": "",
 "summary": "",
 "skills": [],
 "computerSkills": [],
 "experience": [{"title":"","company":"","dates":"","location":"","desc":""}],
 "education": [{"title":"","company":"","dates":""}],
 "projects": [{"title":"","desc":""}],
 "certifications": [],
 "awards": [],
 "interests": [],
 "linkedin": "",
 "website": "",
 "languages": [{"name":"","prof":"80"}]
}
Extract every readable fact from the uploaded CV and place it in the correct category. Put certificates/licenses in certifications, awards/honors in awards, hobbies/interests in interests, and URLs in linkedin/website. Keep data truthful. Do not invent employers or degrees.`
      },
      { role: "user", content: rawText.slice(0, 14000) }
    ]
  });

  try {
    const obj = JSON.parse(completion.choices?.[0]?.message?.content || "{}");
    return {
      ...parsed,
      ...obj,
      skills: Array.isArray(obj.skills) ? obj.skills : parsed.skills,
      computerSkills: Array.isArray(obj.computerSkills) ? obj.computerSkills : parsed.computerSkills,
      experience: Array.isArray(obj.experience) ? obj.experience : parsed.experience,
      education: Array.isArray(obj.education) ? obj.education : parsed.education,
      projects: Array.isArray(obj.projects) ? obj.projects : parsed.projects,
      languages: Array.isArray(obj.languages) ? obj.languages : parsed.languages
    };
  } catch {
    return parsed;
  }
}


async function parseImageCVWithOpenAI(file) {
  if (!client) throw new Error('OPENAI_API_KEY is required for image CV reading');
  const base64 = file.buffer.toString('base64');
  const mime = file.mimetype || 'image/png';
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: `Read this CV image and extract editable CV data as JSON only. Schema: {"fullName":"","jobTitle":"","email":"","phone":"","address":"","linkedin":"","website":"","summary":"","skills":[],"computerSkills":[],"experience":[{"title":"","company":"","dates":"","location":"","desc":""}],"education":[{"title":"","company":"","dates":""}],"projects":[{"title":"","desc":""}],"certifications":[],"awards":[],"interests":[],"languages":[{"name":"","prof":"80"}]}. Do not invent missing facts.` },
      { role: 'user', content: [
        { type: 'text', text: 'Extract all readable CV information from this image into the schema. Keep categories correct and do not drop certificates, awards, links, projects, languages or tools.' },
        { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } }
      ] }
    ]
  });
  return JSON.parse(completion.choices?.[0]?.message?.content || '{}');
}

async function parseUploadedCVFile(file) {
  const filename = file.originalname || '';
  const mimetype = file.mimetype || '';
  if (mimetype.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(filename)) {
    const parsed = await parseImageCVWithOpenAI(file);
    return { rawText: '', parsed };
  }
  let rawText = '';
  if (mimetype.includes('pdf') || filename.toLowerCase().endsWith('.pdf')) {
    const pdf = await pdfParse(file.buffer);
    rawText = pdf.text || '';
  } else if (mimetype.includes('wordprocessingml') || filename.toLowerCase().endsWith('.docx')) {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    rawText = result.value || '';
  } else {
    rawText = file.buffer.toString('utf8');
  }
  rawText = cleanText(rawText);
  if (!rawText) throw new Error('Could not read text from this CV file');
  const heuristic = heuristicParseCV(rawText);
  const parsed = await aiStructureCV(rawText, heuristic);
  return { rawText, parsed };
}

function buildSystemPrompt() {
  return `You are OneTwoHire AI, a professional CV and job matching assistant.
Use the CV details deeply: target title, skills, experience, education, projects, languages, country, seniority and work preference.
Give practical suggestions, job titles, search keywords, and improvement advice.`;
}

function buildFallbackJobs(cvData = {}, country = "", workType = "any") {
  const selectedCountry = (country || cvData.country || "canada").toLowerCase();
  const title = cvData.jobTitle || cvData.targetJobTitle || "Professional";
  const skills = Array.isArray(cvData.skills) ? cvData.skills : String(cvData.skills || "").split(",").map(s => s.trim()).filter(Boolean);
  const expTitles = Array.isArray(cvData.experience) ? cvData.experience.map(e => e.title).filter(Boolean) : [];
  const senior = /senior|lead|head|director|manager/i.test([title, ...expTitles].join(" ")) ? "Senior" : "";
  const coreSkills = skills.slice(0, 5).join(", ");

  const roleIdeas = [
    `${senior} ${title}`.trim(),
    `${title} Specialist`,
    `${title} Consultant`,
    skills[0] ? `${skills[0]} ${title}` : `${title} Associate`,
    expTitles[0] && expTitles[0] !== title ? expTitles[0] : `${title} Coordinator`
  ].filter(Boolean);

  const sites = COUNTRY_JOB_SITES[selectedCountry] || COUNTRY_JOB_SITES.canada;

  return roleIdeas.slice(0, 5).map((role, idx) => ({
    title: role,
    company: sites[idx % sites.length].name,
    location: selectedCountry.charAt(0).toUpperCase() + selectedCountry.slice(1),
    url: sites[idx % sites.length].url,
    matchScore: Math.max(72, 94 - idx * 5),
    reason: `Matches your CV title "${title}"${coreSkills ? ` and skills: ${coreSkills}` : ""}. Work preference: ${workType}.`,
    keywords: [role, title, ...skills.slice(0, 4)].filter(Boolean)
  }));
}

async function askOpenAI({ message, prompt, cvData = {}, history = [], mode = "general" }) {
  const userText = prompt || message || "";
  if (!client) {
    if (mode === "jobs") {
      const jobs = buildFallbackJobs(cvData, cvData.country, cvData.workType);
      return `Best job directions for this CV:\n\n${jobs.map((j, i) => `${i + 1}. ${j.title} — ${j.company} (${j.matchScore}% match)\n   Reason: ${j.reason}`).join("\n\n")}`;
    }
    return `OneTwoHire AI is ready. I can improve your CV summary, rewrite bullet points, create cover letters, import an old CV, and match jobs based on your CV data.`;
  }

  const cvContext = JSON.stringify(cvData || {}, null, 2);
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    temperature: 0.55,
    messages: [
      { role: "system", content: buildSystemPrompt() },
      ...((history || []).slice(-8).map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content || "")
      }))),
      {
        role: "user",
        content: `Mode: ${mode}\nCV Data:\n${cvContext}\n\nUser request:\n${userText}`
      }
    ]
  });

  return completion.choices?.[0]?.message?.content || "";
}

app.get("/", (req, res) => res.send("OneTwoHire AI Backend Running"));

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "OneTwoHire AI Backend", port: PORT, openaiConfigured: Boolean(client), keySourceHint: client ? "OPENAI_API_KEY loaded" : "Put OPENAI_API_KEY in backend/.env or project .env, then restart backend" });
});

app.post("/api/parse-cv-upload", upload.fields([{ name: "cv", maxCount: 1 }, { name: "cvFile", maxCount: 1 }]), async (req, res) => {
  try {
    const file = req.files?.cv?.[0] || req.files?.cvFile?.[0];
    if (!file) return res.status(400).json({ success: false, error: "CV file is required" });
    const { rawText, parsed } = await parseUploadedCVFile(file);
    res.json({ success: true, rawText: (rawText || "").slice(0, 4000), parsed, message: "CV imported. Fields were filled in the selected OneTwoHire template." });
  } catch (err) {
    console.error("CV upload parse error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/upload-old-cv", upload.fields([{ name: "cv", maxCount: 1 }, { name: "cvFile", maxCount: 1 }]), async (req, res) => {
  try {
    const file = req.files?.cv?.[0] || req.files?.cvFile?.[0];
    if (!file) return res.status(400).json({ success: false, error: "CV file is required" });
    const { rawText, parsed } = await parseUploadedCVFile(file);
    res.json({ success: true, rawText: (rawText || "").slice(0, 4000), parsed, message: "CV imported. Fields were filled in the selected OneTwoHire template." });
  } catch (err) {
    console.error("Old CV upload parse error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/ai-cv-assistant", async (req, res) => {
  try {
    const { message, cvData, history, mode } = req.body || {};
    const reply = await askOpenAI({ message, cvData, history, mode });
    res.json({ success: true, reply, suggestions: [], nextStep: "Review and apply the suggestion to your CV." });
  } catch (err) {
    console.error("AI assistant error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/ai/generate", async (req, res) => {
  try {
    const { prompt, cvData } = req.body || {};
    const result = await askOpenAI({ prompt, cvData, mode: "generate" });
    res.json({ success: true, result, content: result, reply: result });
  } catch (err) {
    console.error("AI generate error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/job-suggestions", async (req, res) => {
  try {
    const { cvData = {}, country = "", workType = "any" } = req.body || {};
    const selectedCountry = (country || cvData.country || "canada").toLowerCase();
    const title = cvData.jobTitle || cvData.targetJobTitle || "Professional";
    const skills = Array.isArray(cvData.skills) ? cvData.skills.join(", ") : (cvData.skills || "");
    const exp = Array.isArray(cvData.experience) ? cvData.experience.map(e => `${e.title || ""} ${e.company || ""} ${e.desc || ""}`).join("\n") : "";
    const sites = COUNTRY_JOB_SITES[selectedCountry] || COUNTRY_JOB_SITES.canada;
    const jobs = buildFallbackJobs({ ...cvData, country: selectedCountry, workType }, selectedCountry, workType);

    const prompt = `Analyze this CV and suggest jobs in ${selectedCountry}.
Target title: ${title}
Skills: ${skills}
Experience: ${exp}
Work preference: ${workType}

Return practical matching job titles, why they match, keywords to search, and the best local job sites.`;

    const reply = await askOpenAI({ prompt, cvData: { ...cvData, country: selectedCountry, workType }, mode: "jobs" });

    res.json({
      success: true,
      reply,
      jobs,
      sites,
      searchKeywords: [title, ...String(skills).split(",").map(s => s.trim()).filter(Boolean).slice(0, 6)]
    });
  } catch (err) {
    console.error("Job suggestions error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});


/* Persistent local auth store for OneTwoHire.
   Passwords are never saved as plain text: they are stored as salted PBKDF2 hashes.
   Auto Apply can then use the registered/login email safely as the applicant CC/reply-to email.
*/
const AUTH_DATA_DIR = path.join(__dirname, "data");
const AUTH_USERS_FILE = path.join(AUTH_DATA_DIR, "users.json");

function ensureAuthStore() {
  if (!fs.existsSync(AUTH_DATA_DIR)) fs.mkdirSync(AUTH_DATA_DIR, { recursive: true });
  if (!fs.existsSync(AUTH_USERS_FILE)) fs.writeFileSync(AUTH_USERS_FILE, "[]", "utf8");
}
function readUsers() {
  ensureAuthStore();
  try {
    const parsed = JSON.parse(fs.readFileSync(AUTH_USERS_FILE, "utf8") || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) { return []; }
}
function writeUsers(users) {
  ensureAuthStore();
  fs.writeFileSync(AUTH_USERS_FILE, JSON.stringify(users, null, 2), "utf8");
}
function normEmail(email) { return String(email || "").trim().toLowerCase(); }
function isValidAuthEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim()); }
function isValidAuthPassword(password) { return String(password || "").length >= 6; }
function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(":")) return false;
  const [salt, hash] = storedHash.split(":");
  const candidate = crypto.pbkdf2Sync(String(password), salt, 120000, 64, "sha512").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(hash, "hex"));
}
function safeUser(user) {
  return {
    id: user.id,
    name: user.name || "",
    email: user.email,
    age: user.age ?? null,
    gender: user.gender ?? null,
    plan: user.plan || "freemium",
    createdAt: user.createdAt
  };
}
function findRegisteredUser(email) {
  const e = normEmail(email);
  return readUsers().find(u => normEmail(u.email) === e) || null;
}

/* Simple local demo auth endpoints so frontend does not crash in local testing. */

function getMailer() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port,
    secure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true" || port === 465,
    auth: { user, pass }
  });
}

function safeFilename(name = "CV.pdf") {
  return String(name).replace(/[^a-z0-9._-]+/gi, "_").slice(0, 80) || "CV.pdf";
}

app.post("/api/auto-apply", async (req, res) => {
  try {
    const { userEmail, job = {}, cv = {}, pdfBase64 } = req.body || {};
    const applicantEmail = String(userEmail || cv.email || "").trim();
    const recipient = String(job.applyEmail || job.email || "").trim();
    const jobTitle = String(job.title || "Selected Job").trim();
    const company = String(job.company || job.source || "Company").trim();
    const applicantName = String(cv.fullName || "Applicant").trim();
    const sourceUrl = String(job.url || "").trim();

    if (!applicantEmail) return res.status(400).json({ success: false, error: "Registered user email is missing." });
    const registeredApplicant = findRegisteredUser(applicantEmail);
    if (!registeredApplicant) {
      return res.status(401).json({ success: false, error: "Auto Apply requires a registered/login email. Please register or log in first." });
    }
    if (!recipient) {
      return res.json({
        success: false,
        needsRecipient: true,
        message: "This job board does not expose an application email/API. Enter the employer application email or open the official listing."
      });
    }
    if (!pdfBase64) return res.status(400).json({ success: false, error: "CV PDF attachment is missing." });

    const mailer = getMailer();
    if (!mailer) {
      return res.json({
        success: false,
        needsSmtp: true,
        mailto: `mailto:${encodeURIComponent(recipient)}?cc=${encodeURIComponent(applicantEmail)}&subject=${encodeURIComponent(`Application for ${jobTitle} - ${applicantName}`)}&body=${encodeURIComponent(`Dear Hiring Team,\n\nPlease find my CV attached for the ${jobTitle} position at ${company}.\n\nJob link: ${sourceUrl}\n\nBest regards,\n${applicantName}`)}`,
        message: "SMTP is not configured. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM to backend/.env to send directly with attachment."
      });
    }

    const buffer = Buffer.from(String(pdfBase64).replace(/^data:application\/pdf;base64,/, ""), "base64");
    const subject = `Application for ${jobTitle} - ${applicantName}`;
    const text = `Dear Hiring Team,\n\nI am applying for the ${jobTitle} position at ${company}. Please find my CV attached.\n\nJob link: ${sourceUrl}\n\nBest regards,\n${applicantName}\n${applicantEmail}`;

    await mailer.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: recipient,
      cc: applicantEmail,
      replyTo: applicantEmail,
      subject,
      text,
      attachments: [{ filename: safeFilename(`${applicantName}_CV.pdf`), content: buffer, contentType: "application/pdf" }]
    });

    res.json({ success: true, message: `Application sent to ${recipient}. A copy was sent to ${applicantEmail}.` });
  } catch (err) {
    console.error("Auto apply error:", err);
    res.status(500).json({ success: false, error: err.message || "Auto apply failed." });
  }
});

app.post("/api/register", (req, res) => {
  try {
    const { name = "", email = "", password = "", age = null, gender = null } = req.body || {};
    const normalizedEmail = normEmail(email);
    if (!String(name).trim()) return res.status(400).json({ success: false, error: "Full name is required." });
    if (!isValidAuthEmail(normalizedEmail)) return res.status(400).json({ success: false, error: "Valid email is required." });
    if (!isValidAuthPassword(password)) return res.status(400).json({ success: false, error: "Password must be at least 6 characters." });

    const users = readUsers();
    if (users.some(u => normEmail(u.email) === normalizedEmail)) {
      return res.status(409).json({ success: false, error: "This email is already registered. Please log in." });
    }

    const user = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash: hashPassword(password),
      age: age === null || age === "" ? null : Number(age),
      gender: gender || null,
      plan: "freemium",
      createdAt: new Date().toISOString()
    };
    users.push(user);
    writeUsers(users);
    res.json({ success: true, user: safeUser(user), token: Buffer.from(`${user.id}:${Date.now()}`).toString("base64"), message: "Account created successfully." });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ success: false, error: "Registration failed." });
  }
});

app.post("/api/login", (req, res) => {
  try {
    const { email = "", password = "" } = req.body || {};
    const user = findRegisteredUser(email);
    if (!user) return res.status(401).json({ success: false, error: "Account not found. Please register first." });
    if (!verifyPassword(password, user.passwordHash)) return res.status(401).json({ success: false, error: "Incorrect password." });
    res.json({ success: true, user: safeUser(user), token: Buffer.from(`${user.id}:${Date.now()}`).toString("base64"), message: "Login successful." });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, error: "Login failed." });
  }
});

app.post("/api/clear-users", (req, res) => {
  writeUsers([]);
  res.json({ success: true, message: "Registered users cleared." });
});


app.post("/api/translate-texts", async (req, res) => {
  try {
    const { targetLang = "en", texts = [] } = req.body || {};
    const lang = String(targetLang || "en").toLowerCase();
    const arr = Array.isArray(texts) ? texts.map(x => String(x || "")) : [];
    if (!arr.length || lang === "en") return res.json({ success: true, translations: arr });
    if (!client) {
      return res.json({ success: false, error: "OPENAI_API_KEY is not loaded for full CV translation", translations: arr });
    }
    const names = { de: "German", az: "Azerbaijani", ru: "Russian", tr: "Turkish", en: "English" };
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `Translate CV preview text to ${names[lang] || lang}. Return JSON only: {"translations":[...]} with the same array length and order. Translate CV section headings, summaries, job descriptions, skills, education, projects and other CV content. Keep names, company names, emails, phone numbers, URLs, dates and addresses unchanged unless they are ordinary descriptive words. Do not add or remove facts.` },
        { role: "user", content: JSON.stringify({ texts: arr.slice(0, 250) }) }
      ]
    });
    let out = [];
    try { out = JSON.parse(completion.choices?.[0]?.message?.content || "{}").translations || []; } catch (_) {}
    if (!Array.isArray(out) || out.length !== arr.length) out = arr;
    res.json({ success: true, translations: out });
  } catch (err) {
    console.error("translate texts error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => console.log(`AI Backend running on port ${PORT}`));
