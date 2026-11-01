import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { Project } from '../types';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

let db: Firestore | null = null;

function getFirebaseApp(): App | null {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  // 1. Local file
  const localKeyPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
  if (fs.existsSync(localKeyPath)) {
    try {
      const serviceAccount = JSON.parse(fs.readFileSync(localKeyPath, 'utf8'));
      return initializeApp({ credential: cert(serviceAccount) });
    } catch (err) {
      console.warn('⚠️ Local serviceAccountKey.json found but unreadable:', err);
    }
  }

  // 2. Base64 decoded secret
  const b64Config = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64?.trim();
  if (b64Config) {
    try {
      const decodedJson = Buffer.from(b64Config, 'base64').toString('utf8');
      const serviceAccount = JSON.parse(decodedJson);
      return initializeApp({ credential: cert(serviceAccount) });
    } catch (err) {
      console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT_BASE64 decode failed:', err);
    }
  }

  // 3. Fallback: discrete env vars
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  let privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim();

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  try {
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');
    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  } catch (err) {
    console.warn('⚠️ Firebase Admin failed to initialize from env:', err);
    return null;
  }
}

const app = getFirebaseApp();
if (app) {
  db = getFirestore(app);
}

export async function getProjects(category?: string): Promise<Project[]> {
  if (!db) return [];
  try {
    let query = db.collection('projects').where('show', '==', 1);

    if (category) {
      query = query.where('category', '==', category);
    }

    const querySnap = await query.get();
    const projects = querySnap.docs.map(doc => doc.data() as Project);
    
    // Sort in memory so Firestore doesn't demand composite index creation
    return projects.sort((a, b) => (b.stars || 0) - (a.stars || 0));
  } catch (err) {
    console.warn('⚠️ Failed to fetch projects from Firestore. Returning empty list.', err);
    return [];
  }
}

export async function getProjectBySlug(slug: string): Promise<Project | null> {
  if (!db) return null;
  try {
    const docSnap = await db.collection('projects').doc(slug).get();
    if (!docSnap.exists) return null;
    return docSnap.data() as Project;
  } catch {
    return null;
  }
}