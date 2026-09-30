import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { parseWorkbook, finalize } from '../src/lib/excelImport.js';

// Requiere la ruta al Excel real en CARTERA_XLSX (no se versiona: son datos personales).
const file = process.env.CARTERA_XLSX;

test('importa el Excel CARTERA.xlsx', { skip: !file || !existsSync(file) }, async () => {
  const buf = readFileSync(file);
  const searched = [];
  const d = await parseWorkbook(XLSX, buf, async (q) => { searched.push(q); return []; });
  assert.equal(d.brokers.length, 2);
  assert.equal(d.targetAmount, 8000);
  const by = Object.fromEntries(d.positions.map((p) => [p.name, p]));
  assert.equal(by['MICROSOFT CORPORATION'].symbol, 'MSFT');
  assert.equal(by['MICROSOFT CORPORATION'].qty, 2.7753);
  assert.equal(by['MICROSOFT CORPORATION'].avgPrice, 449.67);
  assert.equal(by['MICROSOFT CORPORATION'].targetWeight, 0.1375);
  assert.equal(by['MICROSOFT CORPORATION'].target5y, 924);
  assert.equal(by['MICROSOFT CORPORATION'].type, 'Pilares');
  assert.equal(by['Constellation Software Inc.'].symbol, 'CSU.TO');
  assert.equal(by.Bitcoin.symbol, 'BTC-EUR');
  const cash = finalize(by.Efectivo);
  assert.equal(cash.symbol, '');
  assert.equal(cash.avgPrice, 1100);
  assert.equal(cash.type, 'Efectivo');
  assert.deepEqual(searched, []);
});
