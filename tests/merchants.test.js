import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MERCHANTS, matchMerchant, searchMerchants, domainForAsset, merchantOf } from '../src/lib/merchants.js';
import { DEFAULT_CATEGORIES, upgradeCategories } from '../src/lib/defaults.js';
import { cleanDomain, findLogo, imageWidth } from '../api/_lib/logo.js';

const name = (t) => matchMerchant(t)?.name ?? null;

test('reconoce comercios en conceptos y extractos', () => {
  assert.equal(name('COMPRA TARJ. MERCADONA S.A.'), 'Mercadona');
  assert.equal(name('zara home'), 'Zara Home');
  assert.equal(name('ZARA ESPAÑA'), 'Zara');
  assert.equal(name('H&M Gran Vía'), 'H&M');
  assert.equal(name('APPLE.COM/BILL'), 'Apple');
  assert.equal(name('netflix.com'), 'Netflix');
  assert.equal(name('Uber Eats pedido'), 'Uber Eats');
  assert.equal(name('gasolina repsol'), 'Repsol');
  assert.equal(name('Café Starbucks'), 'Starbucks');
  assert.equal(name('Pago en El Corte Inglés'), 'El Corte Inglés');
});

test('no confunde palabras comunes con marcas', () => {
  assert.equal(name('cena dia de la madre'), null);
  assert.equal(name('compra mango y piña'), null);
  assert.equal(name('once euros'), null);
  assert.equal(name('Dia'), 'Dia');
  assert.equal(name('Supermercados Dia'), 'Dia');
});

test('conceptos genéricos se agrupan por categoría', () => {
  assert.equal(matchMerchant('gasolina').category, 'c-combust');
  assert.equal(matchMerchant('farmacia').category, 'c-salud');
  assert.equal(matchMerchant('peluqueria').category, 'c-belleza');
  assert.equal(matchMerchant('gasolina').generic, true);
});

test('todas las categorías del catálogo existen y no hay duplicados', () => {
  const ids = new Set(DEFAULT_CATEGORIES.map((c) => c.id));
  for (const m of MERCHANTS) assert.ok(ids.has(m.category), `${m.name} → ${m.category}`);
  const seen = new Set();
  for (const m of MERCHANTS) { assert.ok(!seen.has(m.id), m.id); seen.add(m.id); }
  for (const m of MERCHANTS) if (m.domain) assert.ok(cleanDomain(m.domain), `dominio inválido: ${m.domain}`);
  assert.ok(MERCHANTS.length > 350);
});

test('autocompletado', () => {
  assert.equal(searchMerchants('merc')[0].name, 'Mercadona');
  assert.equal(searchMerchants('netf')[0].name, 'Netflix');
  assert.equal(searchMerchants('pull')[0].name, 'Pull&Bear');
  assert.deepEqual(searchMerchants('m'), []);
  assert.ok(searchMerchants('gasol').every((m) => !m.generic));
});

test('logos de la cartera y comercio elegido', () => {
  assert.equal(domainForAsset({ symbol: 'MSFT' }), 'microsoft.com');
  assert.equal(domainForAsset({ symbol: '2330.TW' }), 'tsmc.com');
  assert.equal(domainForAsset({ symbol: 'XXXX', name: 'Iberdrola' }), 'iberdrola.es');
  assert.equal(domainForAsset({ symbol: '', name: 'Efectivo' }), null);
  assert.equal(merchantOf({ merchant: 'netflix', note: 'lo que sea' }).name, 'Netflix');
  assert.equal(merchantOf({ name: 'Spotify Premium' }).name, 'Spotify');
});

test('migración de categorías: emojis → iconos y nuevas categorías', () => {
  const old = [
    { id: 'c-super', name: 'Súper', type: 'expense', icon: '🛒' },
    { id: 'c-otros-g', name: 'Otros gastos', type: 'expense', icon: '📦' },
    { id: 'c-mia', name: 'Mía', type: 'expense', icon: '🎸' },
    { id: 'c-nomina', name: 'Nómina', type: 'income', icon: '💼' },
  ];
  const up = upgradeCategories(old);
  const by = Object.fromEntries(up.map((c) => [c.id, c]));
  assert.equal(by['c-super'].icon, 'cart');
  assert.equal(by['c-super'].name, 'Súper');
  assert.equal(by['c-mia'].icon, '🎸');
  assert.ok(by['c-combust'] && by['c-telef'] && by['c-divid']);
  assert.equal(up.filter((c) => c.id === 'c-super').length, 1);
});

test('dominios: solo nombres públicos válidos', () => {
  assert.equal(cleanDomain('https://www.Zara.com/es'), 'zara.com');
  assert.equal(cleanDomain('localhost'), null);
  assert.equal(cleanDomain('127.0.0.1'), null);
  assert.equal(cleanDomain('a..b'), null);
});

function png(w) {
  const b = Buffer.alloc(200);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  b.writeUInt32BE(w, 16);
  return b;
}
const resp = (buf, type = 'image/png', ok = true) => ({
  ok, headers: { get: () => type }, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length),
});

test('logo: prefiere el apple-touch-icon y descarta HTML o iconos diminutos', async () => {
  assert.equal(imageWidth(png(180)), 180);
  // 1ª fuente responde HTML (SPA), 2ª 404, 3ª favicon 16px, 4ª 32px → se queda con el mayor
  const calls = [];
  const seq = [resp(Buffer.alloc(300), 'text/html'), resp(Buffer.alloc(0), 'image/png', false), resp(png(16)), resp(png(32))];
  const logo = await findLogo('ejemplo.es', async (u) => { calls.push(u); return seq[calls.length - 1]; });
  assert.equal(calls.length, 4);
  assert.equal(logo.width, 32);
  // Si la primera fuente ya es buena, no se sigue buscando
  let n = 0;
  const good = await findLogo('ejemplo.es', async () => { n++; return resp(png(180)); });
  assert.equal(good.width, 180);
  assert.equal(n, 1);
  assert.equal(await findLogo('ejemplo.es', async () => { throw new Error('red'); }), null);
});
