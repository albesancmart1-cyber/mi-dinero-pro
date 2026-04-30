// api/cron-snapshot.js
// Vercel Cron Job - se ejecuta cada 5 min
// Lee la cartera de Firestore, pide precios reales, calcula y guarda snapshot

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const FINNHUB_KEY = process.env.FINNHUB_KEY;
const FB_PROJECT_ID = process.env.FB_PROJECT_ID;
const FB_CLIENT_EMAIL = process.env.FB_CLIENT_EMAIL;
const FB_PRIVATE_KEY = process.env.FB_PRIVATE_KEY?.replace(/\\n/g, '\n');

const CRYPTO_IDS = {
  BTC:'bitcoin',ETH:'ethereum',SOL:'solana',ADA:'cardano',BNB:'binancecoin',
  XRP:'ripple',DOT:'polkadot',AVAX:'avalanche-2',MATIC:'matic-network',
  LINK:'chainlink',UNI:'uniswap',ATOM:'cosmos',DOGE:'dogecoin',LTC:'litecoin',ALGO:'algorand'
};

function isCrypto(s) { return !!CRYPTO_IDS[s.toUpperCase()]; }

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: FB_PROJECT_ID,
      clientEmail: FB_CLIENT_EMAIL,
      privateKey: FB_PRIVATE_KEY,
    }),
  });
}
const db = getFirestore();

async function fetchEurUsd() {
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD');
    const d = await r.json();
    if (d.rates?.EUR) return 1 / d.rates.EUR;
  } catch (e) {}
  return 1.08;
}

async function fetchStockPrice(sym, eurUsd) {
  try {
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${FINNHUB_KEY}`);
    const d = await r.json();
    if (d?.c > 0) return d.c / eurUsd;
  } catch (e) {}
  return null;
}

async function fetchCryptoPrice(sym) {
  const id = CRYPTO_IDS[sym.toUpperCase()];
  if (!id) return null;
  try {
    const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=eur`);
    const d = await r.json();
    if (d[id]) return d[id].eur;
  } catch (e) {}
  return null;
}

function getCostBasis(asset, method = 'fifo') {
  if (!asset.lots || !asset.lots.length) return (asset.qty || 0) * (asset.avgCost || 0);
  const buys = asset.lots.filter(l => l.type === 'buy');
  if (method === 'avg') {
    const totalQty = buys.reduce((s, l) => s + l.qty, 0);
    const totalCost = buys.reduce((s, l) => s + l.qty * l.price, 0);
    if (totalQty <= 0) return 0;
    return asset.qty * (totalCost / totalQty);
  }
  // FIFO
  const queue = buys.map(l => ({ qty: l.qty, price: l.price }));
  const sales = asset.lots.filter(l => l.type === 'sale').reduce((s, l) => s + l.qty, 0);
  let remaining = sales;
  while (remaining > 0 && queue.length) {
    const head = queue[0];
    if (head.qty <= remaining) { remaining -= head.qty; queue.shift(); }
    else { head.qty -= remaining; remaining = 0; }
  }
  return queue.reduce((s, l) => s + l.qty * l.price, 0);
}

export default async function handler(req, res) {
  try {
    // Leer documento principal
    const docRef = db.collection('usuarios').doc('mi-dinero-pro');
    const snap = await docRef.get();
    if (!snap.exists) return res.status(200).json({ skip: 'no doc' });
    const data = snap.data();
    const assets = data.assets || [];
    const patExtra = data.patExtra || [];
    const method = data.method || 'fifo';

    if (!assets.length) return res.status(200).json({ skip: 'no assets' });

    const eurUsd = await fetchEurUsd();
    let cartValue = 0, cartCost = 0;

    for (const a of assets) {
      const price = isCrypto(a.sym)
        ? await fetchCryptoPrice(a.sym)
        : await fetchStockPrice(a.sym, eurUsd);
      if (price != null) cartValue += (a.qty || 0) * price;
      cartCost += getCostBasis(a, method);
    }

    let patValue = cartValue;
    patExtra.forEach(a => patValue += (a.val || 0));
    const cartRoiPct = cartCost > 0 ? ((cartValue - cartCost) / cartCost * 100) : 0;

    // Guardar snapshot
    await db.collection('usuarios').doc('mi-dinero-pro').collection('snapshots').add({
      ts: Timestamp.now(),
      cartValue,
      cartCost,
      cartRoiPct,
      patValue,
      method,
      source: 'cron',
    });

    res.status(200).json({ ok: true, cartValue, patValue, cartRoiPct });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
