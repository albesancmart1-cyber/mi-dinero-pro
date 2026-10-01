# Mi Dinero Pro

Plataforma personal para llevar **finanzas del día a día** e **inversiones en tiempo real**.
Web app (React + Vite) desplegada en Vercel, usable desde el móvil (se puede "añadir a pantalla de inicio").

## Qué hace

| Sección | Funcionalidad |
|---|---|
| **Resumen** | Ingresos, gastos y ahorro del mes, patrimonio (cuentas + cartera), próximos cargos, alertas de suscripciones y presupuestos superados. |
| **Alta rápida** (botón **+** o tecla **N**) | Gasto/ingreso en 2 toques: importe, categoría (ordenadas por uso), Hoy/Ayer, concepto. Botones "Repetir" con tus movimientos habituales y "Guardar y otro". |
| **Movimientos** | Listado por mes y día, filtros, búsqueda, edición y exportación CSV. |
| **Presupuestos** | **Seguimiento** del mes (presupuestado vs real, por categoría, con aviso claro de si vas por debajo o por encima) y **hoja anual estilo Excel** ("Editar presupuesto"): tres bloques (ingresos, gastos, inversión) con 12 meses; añades solo las categorías que quieras controlar; lo que escribes en un mes se aplica a los siguientes hasta el próximo mes personalizado; copiar un mes a otros; pegar bloques desde Excel; vistas Presupuesto / Real / Diferencia. |
| **Fijos** | **Nómina** configurable (empresa con su logo, neto, día de cobro, 12 o 14 pagas con pagas extra automáticas), aportaciones periódicas a inversión y gastos fijos que se registran solos en su fecha (mensual, anual, trimestral…). **Suscripciones** con fecha de alta y "recordarme cancelar antes de" → aviso en el Resumen. Coste mensual/anual de suscripciones. |
| **Inversiones** | Réplica del Excel `CARTERA.xlsx` con cotizaciones en tiempo real (ver abajo). |
| **Ajustes** | Divisa principal, cuentas bancarias, categorías, sincronización en la nube, copia de seguridad JSON. |

### Logos de comercios y categorías

- `src/lib/merchants.js` tiene un catálogo de ~410 comercios y marcas habituales en España (supermercados, textil, restauración, gasolineras, telefonía, energía, suscripciones, bancos, seguros…) con su web y su categoría. Al escribir un concepto se sugieren con su logo y se asigna la categoría automáticamente; también se reconocen textos de extracto bancario ("COMPRA TARJ. MERCADONA S.A.").
- Los logos se sirven desde `/api/logo?d=dominio` (icono de la propia web o favicon grande), cacheados 30 días en Vercel. Si una marca no tiene logo, se muestra el icono de su categoría.
- Cada categoría tiene un icono de línea con su color; en Ajustes se puede cambiar. Las empresas de la cartera muestran también su logo.

### Inversiones (réplica del Excel)

- **Posiciones** (hojas *Broker1…5*): brokers con su divisa; por posición nº de acciones, precio medio (en divisa de cotización), tipo (Pilares, Large Caps, Micro/Small/Mid Caps, ETFs, Fondos, Bonos, Efectivo, Otros), % deseado, precio objetivo a 5 años y beta. Sin ticker = activo manual (total invertido + valor actual). Botón **Operar** para registrar compras/ventas y recalcular el precio medio.
- **Cartera** (hoja *Cartera*): agrupa por activo entre brokers, convierte a la divisa principal, % rentabilidad, % actual, % deseado editable, *Importe a comprar o (vender)* e *Importe a comprar o (vender) OBJETIVO*. Gráficos circulares de la **composición actual** y la **deseada** (mismo color por activo), distribución por tipo y evolución diaria.
- **Análisis** (hojas *Análisis*/*Calc*): nº de empresas (10–15), peso máximo, peso en pilares, Micro/Small/Mid Caps, efectivo, beta ponderada, S&P 500 frente a su máximo de 52 semanas, posiciones en pérdidas y reglas del inversor agresivo. Referencias ajustables.
- **Seguimiento**: retorno anual esperado `(objetivo / precio)^(1/5) − 1` y posición en el rango de 52 semanas.
- **Importar Excel**: lee tu `CARTERA.xlsx` (Broker, Cartera, Seguimiento, Activos) y asigna tickers automáticamente. También hay un botón "Cargar mi cartera del Excel" con tus posiciones ya mapeadas.

Los cálculos están en `src/lib/portfolio.js` y los tests comprueban que reproducen al céntimo los valores de la hoja *Cartera* del Excel.

### Cotizaciones (gratis)

`/api/quotes` usa **Yahoo Finance** (sin API key): acciones de cualquier bolsa (`MSFT`, `SAN.MC`, `CSU.TO`, `2330.TW`, `ASML.AS`…), ETFs, fondos, cripto (`BTC-EUR`) y divisas (`USDEUR=X`). Se refrescan cada minuto con la app abierta. Respaldo opcional con **Finnhub** (`FINNHUB_KEY`) para acciones de EE. UU. y con open.er-api.com para divisas. Las cotizaciones de Londres se convierten de peniques a libras automáticamente.

## Despliegue en Vercel

Variables de entorno (Project → Settings → Environment Variables):

| Variable | Obligatoria | Uso |
|---|---|---|
| `FB_PROJECT_ID`, `FB_CLIENT_EMAIL`, `FB_PRIVATE_KEY` | Para sincronizar | Credenciales de servicio de Firebase (las mismas que ya usabas). |
| `APP_PIN` | Para sincronizar | PIN que protege tus datos. Se introduce en *Ajustes → Sincronización*. |
| `FINNHUB_KEY` | No | Respaldo de cotizaciones. |

Sin sincronización la app funciona igual y guarda los datos en el navegador (usa *Copia de seguridad* para exportarlos).

Con sincronización, el estado se guarda en Firestore en `usuarios/mi-dinero-pro` (campo `appState`), y `api/cron-snapshot.js` (llamado por `.github/workflows/snapshot.yml`) guarda una foto diaria de la cartera en `usuarios/mi-dinero-pro/history/{fecha}` para el gráfico de evolución.

## Desarrollo

```bash
npm install
npm run dev            # frontend (para /api usa `vercel dev`, o VITE_API_PROXY=https://tu-app.vercel.app npm run dev)
npm test               # tests de cálculos, recurrentes, presupuestos y parser de Yahoo
CARTERA_XLSX=/ruta/CARTERA.xlsx npm test   # incluye el test de importación del Excel
npm run build
```
