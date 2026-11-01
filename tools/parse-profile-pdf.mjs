import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

async function extractPdfText(buffer) {
  const mod = require('pdf-parse');

  // Check if v2 class or named export exists
  const ParserClass = mod.PDFParse || (typeof mod === 'function' && /^class\s/.test(Function.prototype.toString.call(mod)) ? mod : null);

  if (ParserClass) {
    try {
      // In pdf-parse v2, instantiate, pass buffer via options or load, and get text
      const parser = new ParserClass({ data: buffer });
      if (typeof parser.load === 'function') {
        await parser.load();
      }
      if (typeof parser.getText === 'function') {
        const text = await parser.getText();
        return { text: typeof text === 'string' ? text : (text?.text || '') };
      }
    } catch {
      // Fallback invocation for v2 constructor taking buffer directly
      const parser = new ParserClass(buffer);
      if (typeof parser.load === 'function') {
        await parser.load();
      }
      if (typeof parser.getText === 'function') {
        const text = await parser.getText();
        return { text: typeof text === 'string' ? text : (text?.text || '') };
      }
    }
  }

  // Fallback for v1 functional interface
  const parseFunc = typeof mod === 'function' ? mod : mod.default;
  return await parseFunc(buffer);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const pdfPath = path.join(__dirname, 'Profile.pdf');
const targetDir = path.join(rootDir, 'src', 'data');

if (!fs.existsSync(pdfPath)) {
  console.error(`❌ File not found: ${pdfPath}`);
  console.error('Please place your downloaded LinkedIn PDF inside "tools/Profile.pdf".');
  process.exit(1);
}

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const normalizeKey = (str = '') => str.toLowerCase().replace(/[^a-z0-9]/g, '');

async function parseLinkedInPdf() {
  const dataBuffer = fs.readFileSync(pdfPath);
  const pdfData = await extractPdfText(dataBuffer);

  const lines = (pdfData.text || '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  const sections = {
    Summary: [],
    Experience: [],
    Education: [],
    Certifications: []
  };

  let activeSection = null;
  const knownHeaders = ['Summary', 'Experience', 'Education', 'Certifications', 'Licenses & Certifications'];

  for (const line of lines) {
    if (knownHeaders.includes(line)) {
      activeSection = line.includes('Certifications') ? 'Certifications' : line;
      continue;
    }
    if (['Top Skills', 'Languages', 'Honors-Awards'].includes(line)) {
      activeSection = null;
      continue;
    }
    if (activeSection && sections[activeSection]) {
      sections[activeSection].push(line);
    }
  }

  // --- 1. PROFILE.JSON PRESERVATION & UPDATE ---
  const profilePath = path.join(targetDir, 'profile.json');
  let existingProfile = {};
  if (fs.existsSync(profilePath)) {
    try {
      existingProfile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
    } catch {
      existingProfile = {};
    }
  }

  let parsedEducation = existingProfile.education || {};
  if (sections.Education.length >= 2) {
    parsedEducation = {
      institution: sections.Education[0] || parsedEducation.institution || "",
      degree: sections.Education[1] || parsedEducation.degree || "",
      duration: sections.Education[2] || parsedEducation.duration || ""
    };
  }

  const parsedCerts = sections.Certifications.length > 0 
    ? [...new Set([...(existingProfile.certifications || []), ...sections.Certifications])]
    : (existingProfile.certifications || []);

  const extractedName = lines[0]?.toLowerCase() === 'contact' ? '' : lines[0];
  const updatedProfile = {
    name: existingProfile.name || extractedName || "Gopal Kholade",
    resumeName: existingProfile.resumeName || existingProfile.name || "Gopal Kholade",
    headline: lines[1] || existingProfile.headline || "",
    bio: sections.Summary.join(' ') || existingProfile.bio || "",
    location: lines[2] || existingProfile.location || "Pune, Maharashtra, India",
    email: existingProfile.email || "kholadegopal12@gmail.com",
    linkedinUrl: existingProfile.linkedinUrl || "https://www.linkedin.com/in/gopalkholade",
    githubUrl: existingProfile.githubUrl || "https://github.com/GopalKholade",
    resumeFile: existingProfile.resumeFile || "/resume.pdf",
    skills: existingProfile.skills || {
      languages: [],
      dataAnalytics: [],
      aiAndML: [],
      toolsAndCloud: []
    },
    certifications: parsedCerts,
    education: parsedEducation
  };

  fs.writeFileSync(profilePath, JSON.stringify(updatedProfile, null, 2), 'utf8');
  console.log(`✅ Updated: ${profilePath}`);

  // --- 2. EXPERIENCE.JSON NON-DESTRUCTIVE MERGE & APPEND ---
  const expPath = path.join(targetDir, 'experience.json');
  let existingExperiences = [];
  if (fs.existsSync(expPath)) {
    try {
      existingExperiences = JSON.parse(fs.readFileSync(expPath, 'utf8'));
    } catch {
      existingExperiences = [];
    }
  }

  const expLines = sections.Experience;
  const parsedFromPdf = [];
  let currentEntry = null;

  for (let i = 0; i < expLines.length; i++) {
    const line = expLines[i];
    const isDateLine = line.includes(' - ') && (line.includes('Present') || /\b\d{4}\b/.test(line));

    if (isDateLine) {
      if (currentEntry) parsedFromPdf.push(currentEntry);

      const dateParts = line.split(' - ').map(s => s.trim());
      const startDate = dateParts[0] || "";
      const rawEnd = dateParts[1] || "";
      const isCurrent = rawEnd.toLowerCase().includes('present');
      const endDate = isCurrent ? 'Present' : rawEnd.split('(')[0].trim();

      const role = expLines[i - 2] || expLines[i - 1] || "Data Research Analyst";
      const company = expLines[i - 1] || "Company";

      currentEntry = {
        role,
        company,
        location: updatedProfile.location,
        startDate,
        endDate,
        isCurrent,
        summary: "",
        achievements: [],
        skills: []
      };
    } else if (currentEntry && line.length > 20) {
      currentEntry.achievements.push(line);
    }
  }
  if (currentEntry) parsedFromPdf.push(currentEntry);

  const mergedMap = new Map();

  existingExperiences.forEach(exp => {
    const key = `${normalizeKey(exp.company)}_${normalizeKey(exp.role)}`;
    mergedMap.set(key, exp);
  });

  parsedFromPdf.forEach(pdfExp => {
    const key = `${normalizeKey(pdfExp.company)}_${normalizeKey(pdfExp.role)}`;
    if (mergedMap.has(key)) {
      const existing = mergedMap.get(key);
      existing.startDate = pdfExp.startDate || existing.startDate;
      existing.endDate = pdfExp.endDate || existing.endDate;
      existing.isCurrent = pdfExp.isCurrent;
      mergedMap.set(key, existing);
    } else {
      mergedMap.set(key, {
        ...pdfExp,
        summary: pdfExp.achievements[0] || "Data extraction, transformation, pipeline automation, and analysis.",
        skills: ["Python", "SQL", "Data Pipelines"]
      });
    }
  });

  const finalExperiences = Array.from(mergedMap.values()).map((exp, index) => ({
    ...exp,
    order: index + 1
  }));

  fs.writeFileSync(expPath, JSON.stringify(finalExperiences, null, 2), 'utf8');
  console.log(`✅ Updated: ${expPath} (${finalExperiences.length} total experiences synchronized)`);
}

parseLinkedInPdf().catch(err => {
  console.error('Fatal error parsing PDF:', err);
  process.exit(1);
});