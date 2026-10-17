export const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

/**
 * Lee "12 de noviembre" (se ignora lo que venga después, incluido el año).
 * Devuelve [día, mes] o null si no se puede leer.
 */
export function parseFechaEs(texto: string): [number, number] | null {
  const m = /^\s*(\d{1,2}) de ([a-záéíóú]+)/.exec(texto.trim().toLowerCase());
  if (!m) return null;
  const mes = MESES.indexOf(m[2] as (typeof MESES)[number]);
  if (mes < 0) return null;
  return [Number(m[1]), mes + 1];
}

/** "2026-11-12" → [12, 11]. Ignora el año. */
export function diaMesDeIso(iso: string): [number, number] {
  const [, m, d] = iso.split("-").map(Number);
  return [d as number, m as number];
}

/** "2026-11-12" → "12 de noviembre". */
export function fechaLegible(iso: string): string {
  const [d, m] = diaMesDeIso(iso);
  return `${d} de ${MESES[m - 1]}`;
}
