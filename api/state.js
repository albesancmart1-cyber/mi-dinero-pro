// Sincronización del estado de la app con Firestore, protegida por PIN.
//   GET  /api/state            → { state, updatedAt, snapshots }
//   PUT  /api/state  {state}   → { ok, updatedAt }
// Cabecera obligatoria: x-app-pin: <APP_PIN>
import { firebaseConfigured, mainDoc, checkPin } from './_lib/firebase.js';

const MAX_BYTES = 900_000; // Límite de documento Firestore: 1 MiB

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!firebaseConfigured() || !process.env.APP_PIN) {
    return res.status(503).json({ error: 'Sincronización no configurada (faltan FB_* o APP_PIN en Vercel)' });
  }
  if (!checkPin(req)) return res.status(401).json({ error: 'PIN incorrecto' });

  try {
    const ref = mainDoc();
    if (req.method === 'GET') {
      const snap = await ref.get();
      const data = snap.exists ? snap.data() : {};
      const snaps = await ref.collection('history').orderBy('date', 'desc').limit(730).get();
      const snapshots = snaps.docs.map((d) => d.data()).reverse();
      return res.status(200).json({
        state: data.appState ? JSON.parse(data.appState) : null,
        updatedAt: data.appUpdatedAt || 0,
        snapshots,
      });
    }
    if (req.method === 'PUT' || req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body?.state || typeof body.state !== 'object') return res.status(400).json({ error: 'Falta state' });
      const json = JSON.stringify(body.state);
      if (json.length > MAX_BYTES) return res.status(413).json({ error: 'Estado demasiado grande' });
      const updatedAt = Number(body.state.updatedAt) || Date.now();
      await ref.set({ appState: json, appUpdatedAt: updatedAt }, { merge: true });
      return res.status(200).json({ ok: true, updatedAt });
    }
    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'Método no permitido' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
