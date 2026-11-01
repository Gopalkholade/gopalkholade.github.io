import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'node:fs';
import path from 'node:path';

function initFirebase() {
  if (getApps().length > 0) return getFirestore();

  // 1. Support GitHub Actions Secret (JSON string)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    initializeApp({ credential: cert(serviceAccount) });
    return getFirestore();
  }

  // 2. Support local file fallback
  const keyPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
  if (!fs.existsSync(keyPath)) {
    throw new Error(`File not found: ${keyPath}`);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  initializeApp({ credential: cert(serviceAccount) });
  return getFirestore();
}

function determineCategory(topics = [], description = '', name = '') {
  const combined = [...topics, description, name].join(' ').toLowerCase();

  const aiMlKeywords = [
    'ai', 'ml', 'llm', 'rag', 'agent', 'pytorch', 'peft', 'lora', 'qlora',
    'transformer', 'machine-learning', 'deep-learning', 'nlp', 'quantization', 'neural'
  ];

  const hasAiMl = aiMlKeywords.some((kw) => combined.includes(kw));
  return hasAiMl ? 'ai-ml' : 'data-analytics';
}

async function syncRepos() {
  const db = initFirebase();
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const GITHUB_USERNAME = process.env.GITHUB_USERNAME || 'GopalKholade';

  console.log(`Polling public repositories for: ${GITHUB_USERNAME}...`);
  const headers = {
    Accept: 'application/vnd.github.v3+json',
    ...(GITHUB_TOKEN ? { Authorization: `token ${GITHUB_TOKEN}` } : {}),
  };

  const response = await fetch(
    `https://api.github.com/users/${GITHUB_USERNAME}/repos?type=owner&per_page=100&sort=updated`,
    { headers }
  );

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const repos = await response.json();
  console.log(`Found ${repos.length} total repositories.`);

  for (const repo of repos) {
    if (repo.fork) continue; // Skip forked repositories

    const topics = repo.topics || [];
    
    // Set show to 1 if tagged with 'portfolio' or 'show', otherwise 0
    const shouldShow = topics.includes('portfolio') || topics.includes('show') || repo.stargazers_count > 0 ? 1 : 0;

    let readmeText = '';
    try {
      const readmeRes = await fetch(
        `https://raw.githubusercontent.com/${repo.full_name}/${repo.default_branch}/README.md`
      );
      if (readmeRes.ok) {
        readmeText = await readmeRes.text();
      }
    } catch {
      // README optional
    }

    const category = determineCategory(topics, repo.description || '', repo.name);

    // Strip control tags ('portfolio', 'show') from user-facing tech stack
    const realSkills = topics.filter(t => !['portfolio', 'show'].includes(t.toLowerCase()));

    const projectPayload = {
      slug: repo.name,
      title: repo.name.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      category: category,
      description: repo.description || 'Production-grade engineering & data pipeline repository.',
      repoUrl: repo.html_url,
      demoUrl: repo.homepage || '',
      show: shouldShow,               // 1 = Display on website, 0 = Hidden
      published: true,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      topics: topics,
      techStack: realSkills.length > 0 ? realSkills : [repo.language || 'Python'],
      readmeMarkdown: readmeText,
      updatedAt: repo.updated_at,
    };

    await db.collection('projects').doc(repo.name).set(projectPayload, { merge: true });
    console.log(`Synced: ${repo.name} | Category: ${category} | show: ${shouldShow}`);
  }

  console.log('Sync completed successfully.');
}

syncRepos().catch((err) => {
  console.error('Fatal sync failure:', err);
  process.exit(1);
});