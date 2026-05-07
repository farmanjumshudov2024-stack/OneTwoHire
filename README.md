# OneTwoHire Full Project

## What is added in this build
- Job Seeker now analyzes the full CV: title, skills, experience, education, country and work preference.
- AI Assistant has old CV upload: PDF, DOCX, TXT.
- Uploaded CV information is parsed and automatically fills the selected OneTwoHire template.
- Backend includes `/api/parse-cv-upload`, `/api/job-suggestions`, `/api/ai-cv-assistant`.

## Backend
```bash
cd backend
npm install
npm start
```

Backend runs on:
http://127.0.0.1:4000

Create `backend/.env` from `.env.example` and add your NEW OpenAI API key.

## Frontend
Open:
frontend/index.html

or run with a local server.
