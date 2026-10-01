import { useState } from 'react';
import { monthOf, todayISO } from '../lib/finance.js';
import Tracking from './presupuestos/Tracking.jsx';
import BudgetGrid from './presupuestos/Grid.jsx';
import CopyDialog from './presupuestos/CopyDialog.jsx';

/**
 * Presupuestos: por defecto el seguimiento del mes (presupuestado vs real);
 * "Editar presupuesto" abre la hoja anual estilo Excel.
 */
export default function Presupuestos() {
  const [mode, setMode] = useState('track');
  const [month, setMonth] = useState(monthOf(todayISO()));
  const [copyFrom, setCopyFrom] = useState(null);
  return (
    <>
      {mode === 'grid'
        ? <BudgetGrid initialYear={month.slice(0, 4)} onClose={() => setMode('track')} onCopy={setCopyFrom} />
        : <Tracking month={month} setMonth={setMonth} onEdit={() => setMode('grid')} onCopy={setCopyFrom} />}
      {copyFrom && <CopyDialog from={copyFrom} onClose={() => setCopyFrom(null)} />}
    </>
  );
}
