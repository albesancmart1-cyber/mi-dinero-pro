/** Buscador de valores vía /api/search (Yahoo Finance). */
export async function searchSymbols(q) {
  const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
  if (!r.ok) return [];
  const d = await r.json();
  return d.results || [];
}
