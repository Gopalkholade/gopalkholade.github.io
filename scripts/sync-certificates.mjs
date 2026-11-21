import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

const rootDir = process.cwd();
const profilePath = path.resolve(rootDir, 'src', 'data', 'profile.json');

function extractGoogleDriveId(url) {
  if (!url) return null;
  const matchFile = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (matchFile) return matchFile[1];
  const matchId = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchId) return matchId[1];
  return null;
}

/**
 * Directly stream and parse JSON data from Google Drive URL into memory
 */
async function streamJsonFromDrive(driveUrl) {
  const fileId = extractGoogleDriveId(driveUrl);
  if (!fileId) {
    throw new Error(`Unable to extract Google Drive file ID from URL: ${driveUrl}`);
  }

  const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
  console.log(`📡 Streaming certificates directly from Google Drive (${fileId})...`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  const res = await fetch(downloadUrl, { signal: controller.signal, redirect: 'follow' });
  clearTimeout(timeout);

  if (!res.ok) {
    throw new Error(`Google Drive stream failed with HTTP status ${res.status}`);
  }

  const text = await res.text();
  const parsed = JSON.parse(text);

  if (!Array.isArray(parsed.certifications)) {
    throw new Error('Streamed JSON does not contain a "certifications" array.');
  }

  console.log(`✅ Successfully streamed ${parsed.certifications.length} certificates into memory.`);
  return parsed.certifications;
}

async function syncCertificates() {
  const driveUrl = process.env.CERTIFICATES_DRIVE_URL;
  if (!driveUrl) {
    console.error('❌ CERTIFICATES_DRIVE_URL is not set in environment or .env');
    process.exit(1);
  }

  try {
    const certsFromDb = await streamJsonFromDrive(driveUrl);

    const profile = fs.existsSync(profilePath)
      ? JSON.parse(fs.readFileSync(profilePath, 'utf8'))
      : {};

    const existingCerts = Array.isArray(profile.certifications) ? profile.certifications : [];

    // Format streamed certs as "Name (Issuer)"
    const formattedFromStream = certsFromDb.map(c => {
      const issuer = c.issuer ? ` (${c.issuer})` : '';
      return `${c.name}${issuer}`.trim();
    });

    // Merge unique preserving order
    const combined = Array.from(new Set([...formattedFromStream, ...existingCerts]));

    profile.certifications = combined;
    fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2) + '\n', 'utf8');

    console.log(`✅ Successfully merged ${formattedFromStream.length} streamed certifications into src/data/profile.json`);
    console.log(`📊 Total certifications in profile: ${combined.length}`);
  } catch (err) {
    console.error('❌ Certificate streaming error:', err.message);
    process.exit(1);
  }
}

syncCertificates();
