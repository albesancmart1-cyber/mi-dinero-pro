import { useEffect, useState } from 'react';
import { StoreProvider, useStore } from './lib/store.jsx';
import { MarketProvider } from './lib/market.jsx';
import Dashboard from './views/Dashboard.jsx';
import Movimientos from './views/Movimientos.jsx';
import Presupuestos from './views/Presupuestos.jsx';
import Fijos from './views/Fijos.jsx';
import Inversiones from './views/inversiones/Inversiones.jsx';
import Ajustes from './views/Ajustes.jsx';
import QuickAdd from './views/QuickAdd.jsx';
import { Icon } from './components/icons.jsx';

// [clave, etiqueta, icono, etiqueta corta para la barra del móvil]
const NAV = [
  ['resumen', 'Resumen', <Icon name="resumen" />, 'Resumen'],
  ['movimientos', 'Movimientos', <Icon name="movimientos" />, 'Movim.'],
  ['presupuestos', 'Presupuestos', <Icon name="presupuestos" />, 'Presup.'],
  ['fijos', 'Fijos', <Icon name="fijos" />, 'Fijos'],
  ['inversiones', 'Inversiones', <Icon name="inversiones" />, 'Cartera'],
  ['ajustes', 'Ajustes', <Icon name="ajustes" />, 'Ajustes'],
];

function initialView() {
  const h = window.location.hash.slice(1);
  return NAV.some(([k]) => k === h) || h === 'nuevo' ? h : 'resumen';
}

function Shell() {
  const { sync, state } = useStore();
  const palette = state.settings.palette || 'grafito';

  useEffect(() => { document.documentElement.dataset.palette = palette; }, [palette]);
  const [view, setView] = useState(initialView);
  const [quick, setQuick] = useState(view === 'nuevo');

  useEffect(() => {
    if (view === 'nuevo') setView('resumen');
    else window.history.replaceState(null, '', `#${view}`);
    window.scrollTo(0, 0);
  }, [view]);

  // Atajo de teclado: "n" para nuevo movimiento
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        e.preventDefault();
        setQuick(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app">
      <div className="backdrop" aria-hidden="true"><i /><i /><i /><i /></div>
      <aside className="sidebar">
        <div className="brand">Mi Dinero <span>Pro</span></div>
        {NAV.map(([k, l, i]) => (
          <button key={k} className={`nav-btn${view === k ? ' active' : ''}`} onClick={() => setView(k)}>
            <span className="ico">{i}</span>{l}
          </button>
        ))}
        <div className="sync">
          {sync.status === 'ok' && 'Sincronizado'}
          {sync.status === 'syncing' && 'Sincronizando…'}
          {sync.status === 'error' && <span className="neg">{sync.message}</span>}
          {sync.status === 'off' && 'Guardado en este dispositivo'}
          <div style={{ marginTop: 4 }}>Pulsa <b>N</b> para añadir un movimiento</div>
        </div>
      </aside>
      <main>
        {view === 'resumen' && <Dashboard go={setView} onQuickAdd={() => setQuick(true)} />}
        {view === 'movimientos' && <Movimientos />}
        {view === 'presupuestos' && <Presupuestos />}
        {view === 'fijos' && <Fijos />}
        {view === 'inversiones' && <Inversiones />}
        {view === 'ajustes' && <Ajustes />}
      </main>
      <nav className="mobile-nav">
        {NAV.map(([k, l, i, short]) => (
          <button key={k} className={view === k ? 'active' : ''} onClick={() => setView(k)} aria-label={l}>
            <span className="ico">{i}</span><span className="lbl">{short}</span>
          </button>
        ))}
      </nav>
      <button className="fab" onClick={() => setQuick(true)} aria-label="Añadir gasto o ingreso"><Icon name="plus" strokeWidth={2.2} /></button>
      {quick && <QuickAdd onClose={() => setQuick(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <MarketProvider>
        <Shell />
      </MarketProvider>
    </StoreProvider>
  );
}
