import type { FilaBanco } from "./banco";

/** Cuántas acciones del banco tiene la simulación (cada 5.ª fila del dev: 250 / 5). */
export const PASO_MUESTRA = 5;

/**
 * Muestra determinista del banco para /simulacion: una de cada 5 filas del split dev, en el orden del CSV.
 * Solo dev: la simulación nunca usa el test. Y solo las columnas de la acción: el banco no trae etiquetas.
 */
export function muestraSimulacion(banco: FilaBanco[]): FilaBanco[] {
  return banco.filter((f) => f.split === "dev").filter((_, i) => i % PASO_MUESTRA === 0);
}
