import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'node:fs';
import path from 'node:path';

function initFirebase() {
  if (getApps().length > 0) return getFirestore();

  // Support inline GitHub Actions secret (JSON string) or local file
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    initializeApp({ credential: cert(serviceAccount) });
    return getFirestore();
  }

  const keyPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
  if (fs.existsSync(keyPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    initializeApp({ credential: cert(serviceAccount) });
    return getFirestore();
  }

  throw new Error('Firebase credentials not found. Provide FIREBASE_SERVICE_ACCOUNT or serviceAccountKey.json.');
}

// Taxonomy mapping for repository topics
const categoryTaxonomy = {
  languages: {
    title: "Programming & Query Languages",
    match: ['python', 'c++', 'cpp', 'javascript', 'typescript', 'sql', 'bash', 'shell', 'html', 'css', 'rust', 'go']
  },
  dataAnalytics: {
    title: "Data Analytics & Engineering",
    match: ['pandas', 'numpy', 'pyspark', 'spark', 'power-query', 'power query', 'tableau', 'excel', 'data-cleaning', 'data cleaning', 'etl', 'pivot', 'analytics', 'data-analysis', 'postgresql', 'mysql', 'database', 'eda', 'data wrangling']
  },
  aiAndML: {
    title: "Machine Learning & Generative AI",
    match: ['peft', 'lora', 'qlora', 'pytorch', 'scikit-learn', 'machine-learning', 'machine learning', 'deep-learning', 'deep learning', 'nlp', 'transformers', 'llm', 'rag', 'gen-ai', 'generative ai', 'quantization', 'fine-tuning']
  },
  toolsAndCloud: {
    title: "Developer Tools & Cloud Infrastructure",
    match: ['git', 'github', 'github-actions', 'github actions', 'firebase', 'firestore', 'astro', 'linux', 'wsl', 'wsl2', 'termux', 'docker', 'vscode', 'ci-cd', 'ci/cd']
  }
};

function formatSkillName(raw) {
  const map = {
    'cpp': 'C++',
    'c++': 'C++',
    'sql': 'SQL',
    'postgresql': 'PostgreSQL',
    'mysql': 'MySQL',
    'pyspark': 'PySpark',
    'power-query': 'Power Query',
    'peft': 'PEFT',
    'lora': 'LoRA',
    'qlora': 'QLoRA',
    'pytorch': 'PyTorch',
    'scikit-learn': 'Scikit-Learn',
    'llm': 'LLM',
    'rag': 'RAG',
    'github-actions': 'GitHub Actions',
    'ci-cd': 'CI/CD',
    'wsl': 'WSL2',
    'wsl2': 'WSL2',
    'eda': 'EDA'
  };
  const lower = raw.toLowerCase().trim();
  if (map[lower]) return map[lower];
  return raw.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function categorizeHarvestedSkills(allTopics) {
  const categorized = {
    languages: [],
    dataAnalytics: [],
    aiAndML: [],
    toolsAndCloud: [],
    domainCompetencies: []
  };

  const ignored = new Set(['portfolio', 'show', 'featured']);

  allTopics.forEach(topic => {
    const raw = topic.trim();
    const lower = raw.toLowerCase();
    if (ignored.has(lower)) return;

    const formatted = formatSkillName(raw);
    let matched = false;

    for (const [key, config] of Object.entries(categoryTaxonomy)) {
      if (config.match.some(keyword => lower === keyword || lower.includes(keyword))) {
        if (!categorized[key].includes(formatted)) {
          categorized[key].push(formatted);
        }
        matched = true;
        break;
      }
    }

    if (!matched && !categorized.domainCompetencies.includes(formatted)) {
      categorized.domainCompetencies.push(formatted);
    }
  });

  if (categorized.domainCompetencies.length === 0) {
    delete categorized.domainCompetencies;
  }

  return categorized;
}

function generateMarkdownResume(profile, experiences, categorizedSkills, projects) {
  let md = `# ${profile.name || 'Gopal Kholade'}\n`;
  md += `**${profile.headline || 'Data & Machine Learning Analyst'}**\n`;
  md += `${profile.location || 'Pune, Maharashtra, India'} | ${profile.email || ''} | [GitHub](${profile.githubUrl || ''}) | [LinkedIn](${profile.linkedinUrl || ''})\n\n---\n\n`;

  if (profile.bio) {
    md += `### Summary\n${profile.bio}\n\n---\n\n`;
  }

  md += `### Technical Skills & Competencies (from GitHub Projects)\n\n`;
  for (const [key, list] of Object.entries(categorizedSkills)) {
    if (Array.isArray(list) && list.length > 0) {
      const title = categoryTaxonomy[key]?.title || "Domain Competencies";
      md += `- **${title}:** ${list.join(', ')}\n`;
    }
  }

  md += `\n---\n\n### Professional Experience\n\n`;
  experiences
    .sort((a, b) => (a.order || 99) - (b.order || 99))
    .forEach(exp => {
      md += `#### **${exp.role}** — *${exp.company}* (${exp.location})\n`;
      md += `*${exp.startDate} – ${exp.endDate}*\n\n`;
      if (exp.summary) {
        md += `*${exp.summary}*\n\n`;
      }
      if (Array.isArray(exp.achievements) && exp.achievements.length > 0) {
        exp.achievements.forEach(ach => {
          md += `- ${ach}\n`;
        });
        md += `\n`;
      }
    });

  if (projects.length > 0) {
    md += `---\n\n### Featured Projects\n\n`;
    projects.forEach(p => {
      md += `#### **${p.title}**\n`;
      if (p.techStack && p.techStack.length > 0) {
        md += `*Tech Stack: ${p.techStack.join(', ')}*\n`;
      }
      md += `${p.description}\n`;
      if (p.repoUrl) md += `[Repository](${p.repoUrl})\n\n`;
    });
  }

  if (profile.education && profile.education.institution) {
    md += `---\n\n### Education\n\n`;
    md += `**${profile.education.degree}** — *${profile.education.institution}* (${profile.education.duration})\n\n`;
  }

  if (Array.isArray(profile.certifications) && profile.certifications.length > 0) {
    md += `---\n\n### Certifications\n\n`;
    profile.certifications.forEach(cert => {
      md += `- ${cert}\n`;
    });
  }

  return md;
}

async function buildResume() {
  const rootDir = process.cwd();
  const dataDir = path.join(rootDir, 'src', 'data');
  const publicDir = path.join(rootDir, 'public');

  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // 1. Read static data
  const profilePath = path.join(dataDir, 'profile.json');
  const expPath = path.join(dataDir, 'experience.json');

  if (!fs.existsSync(profilePath) || !fs.existsSync(expPath)) {
    throw new Error(`Missing source JSON files in ${dataDir}. Run parse-profile-pdf.mjs first.`);
  }

  const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
  const experiences = JSON.parse(fs.readFileSync(expPath, 'utf8'));

  // 2. Query projects from Firestore
  const db = initFirebase();
  const snapshot = await db.collection('projects').where('show', '==', 1).get();

  const projects = [];
  const rawTopics = new Set();

  snapshot.forEach(doc => {
    const data = doc.data();
    projects.push(data);
    if (Array.isArray(data.topics)) {
      data.topics.forEach(t => rawTopics.add(t));
    }
  });

  console.log(`Harvested ${rawTopics.size} raw topic tags from ${projects.length} featured GitHub projects.`);

  // 3. Classify topics
  const categorizedSkills = categorizeHarvestedSkills(Array.from(rawTopics));

  // 4. Construct unified payload
  const resumePayload = {
    ...profile,
    skills: categorizedSkills,
    experience: experiences,
    projects: projects
  };

  // 5. Output public assets
  const jsonOut = path.join(publicDir, 'resume.json');
  const mdOut = path.join(publicDir, 'resume.md');

  fs.writeFileSync(jsonOut, JSON.stringify(resumePayload, null, 2), 'utf8');
  fs.writeFileSync(mdOut, generateMarkdownResume(profile, experiences, categorizedSkills, projects), 'utf8');

  console.log(`✅ Generated: ${jsonOut}`);
  console.log(`✅ Generated: ${mdOut}`);
}

buildResume().catch(err => {
  console.error('Fatal resume generation error:', err);
  process.exit(1);
});