// Inicialización perezosa de Firebase Admin (solo la usan state y cron).
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { timingSafeEqual } from 'node:crypto';

export const DOC_PATH = ['usuarios', 'mi-dinero-pro'];

export function firebaseConfigured() {
  return !!(process.env.FB_PROJECT_ID && process.env.FB_CLIENT_EMAIL && process.env.FB_PRIVATE_KEY);
}

export function db() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FB_PROJECT_ID,
        clientEmail: process.env.FB_CLIENT_EMAIL,
        privateKey: process.env.FB_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
  return getFirestore();
}

export function mainDoc() {
  return db().collection(DOC_PATH[0]).doc(DOC_PATH[1]);
}

/** Comprueba el PIN de la app (variable de entorno APP_PIN). */
export function checkPin(req) {
  const expected = process.env.APP_PIN;
  if (!expected) return false;
  const got = String(req.headers['x-app-pin'] || '');
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
