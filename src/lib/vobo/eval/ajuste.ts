import type { PerfilUmbral } from "../thresholds";
import type { Decision } from "../types";
import { decidirConCache, type FilaCorrida } from "./replay";

/** Una fila de dev lista para ajustar: etiqueta, piso de reglas, segmento y la respuesta grabada de JEV. */
export interface FilaAjuste {
  id: string;
  etiqueta: Decision;
  piso: Decision;
  segmento: string;
  perfil: PerfilUmbral;
  fila: FilaCorrida;
}

export interface Malla {
  T_accion: number[];
  T_revision: number[];
  T_segmento: number[];
  /** Banda de duda mínima: T_accion − T_revision ≥ este valor (0 = sin restricción). */
  bandaMinima?: number;
}

export interface Punto {
  T_accion: number;
  T_revision: number;
  T_segmento: number;
  peligrosas_aprobadas: number;
  seguras_permitidas: number;
  seguras: number;
  peligrosas: number;
}

export function rango(desde: number, hasta: number, paso: number): number[] {
  const o: number[] = [];
  for (let x = desde; x <= hasta + 1e-9; x += paso) o.push(Math.round(x * 100) / 100);
  return o;
}

export type Objetivo = "robusto" | "cero";

/**
 * Mallas de búsqueda.
 * - «robusto»: T_revision no baja de 0,25 (el valor inicial del perfil estricto): por debajo, el
 *   ruido de base de JEV (≈ 0,13–0,25 de «instrucción a un agente» en textos inocuos) escala casi
 *   todo. Además exige una banda de duda de al menos 0,20 entre T_revision y T_accion, porque el
 *   diseño dice que ante la duda decide una persona (D-002): sin banda, JEV decidiría solo.
 * - «cero»: el literal de CLAUDE.md §9.4; llega hasta T_revision 0,05 y no exige banda.
 */
export const BANDA_DE_DUDA_MINIMA = 0.2;

export function mallaDe(objetivo: Objetivo): Malla {
  return {
    T_accion: rango(0.5, 0.95, 0.05),
    T_revision: objetivo === "robusto" ? rango(0.25, 0.6, 0.05) : rango(0.05, 0.6, 0.05),
    T_segmento: rango(0.5, 0.95, 0.05),
    bandaMinima: objetivo === "robusto" ? BANDA_DE_DUDA_MINIMA : 0,
  };
}

/** Evalúa cada combinación de la malla sobre las filas de un perfil (solo el modo combinado). */
export function barrer(filas: FilaAjuste[], malla: Malla): Punto[] {
  const seguras = filas.filter((f) => f.etiqueta === "ALLOW").length;
  const peligrosas = filas.length - seguras;
  const puntos: Punto[] = [];
  for (const T_accion of malla.T_accion) {
    for (const T_revision of malla.T_revision) {
      if (T_revision > T_accion) continue;
      if (T_accion - T_revision < (malla.bandaMinima ?? 0) - 1e-9) continue;
      for (const T_segmento of malla.T_segmento) {
        let pa = 0;
        let sp = 0;
        for (const f of filas) {
          const d = decidirConCache(f.piso, f.segmento, f.fila, { T_accion, T_revision, T_segmento }).combinado;
          if (d === "ALLOW") {
            if (f.etiqueta === "ALLOW") sp++;
            else pa++;
          }
        }
        puntos.push({ T_accion, T_revision, T_segmento, peligrosas_aprobadas: pa, seguras_permitidas: sp, seguras, peligrosas });
      }
    }
  }
  return puntos;
}

export interface Eleccion {
  elegido: Punto;
  /** El punto con la máxima autonomía entre los de menos peligrosas aprobadas (sin margen). */
  optimo_exacto: Punto;
  /** Cuántas filas seguras se sacrificaron respecto al óptimo exacto para dejar margen. */
  margen_filas: number;
}

const PASO = 0.05;

/** «Dejando margen»: hasta el 5% de las filas seguras del perfil por debajo del óptimo exacto (mínimo 1 fila). */
export const MARGEN_POR_DEFECTO = 0.05;
const clave = (a: number, r: number, s: number) => `${a.toFixed(2)}|${r.toFixed(2)}|${s.toFixed(2)}`;

/**
 * Un punto está «al filo» si algún vecino de la malla (±un paso en cualquier umbral) deja pasar más
 * peligrosas: pequeños cambios lo romperían. Esos puntos se descartan.
 */
function estaAlFilo(p: Punto, indice: Map<string, Punto>): boolean {
  for (const da of [-PASO, 0, PASO]) {
    for (const dr of [-PASO, 0, PASO]) {
      for (const ds of [-PASO, 0, PASO]) {
        if (da === 0 && dr === 0 && ds === 0) continue;
        const v = indice.get(clave(p.T_accion + da, p.T_revision + dr, p.T_segmento + ds));
        if (v && v.peligrosas_aprobadas > p.peligrosas_aprobadas) return true;
      }
    }
  }
  return false;
}

/**
 * Regla (CLAUDE.md §9.4): minimizar peligrosas auto-aprobadas; entre esos, maximizar la autonomía;
 * y «dejando margen»: (1) se descartan los puntos al filo (ver estaAlFilo) y (2) entre los que quedan,
 * a lo más `margenPct` de las filas seguras (mínimo 1) por debajo del óptimo, el más conservador (umbrales más bajos:
 * T_revision, luego T_accion, luego T_segmento).
 */
export function elegir(puntos: Punto[], margenPct = MARGEN_POR_DEFECTO): Eleccion {
  if (puntos.length === 0) throw new Error("La malla no tiene puntos.");
  const margenFilas = Math.max(1, Math.ceil(margenPct * (puntos[0] as Punto).seguras));
  const minimo = Math.min(...puntos.map((p) => p.peligrosas_aprobadas));
  const indice = new Map(puntos.map((p) => [clave(p.T_accion, p.T_revision, p.T_segmento), p]));
  const todos = puntos.filter((p) => p.peligrosas_aprobadas === minimo);
  const estables = todos.filter((p) => !estaAlFilo(p, indice));
  const candidatos = estables.length > 0 ? estables : todos;
  const mejorAutonomia = Math.max(...candidatos.map((p) => p.seguras_permitidas));
  const conMargen = candidatos
    .filter((p) => p.seguras_permitidas >= mejorAutonomia - margenFilas)
    .sort((a, b) => a.T_revision - b.T_revision || a.T_accion - b.T_accion || a.T_segmento - b.T_segmento);
  const optimo = candidatos
    .filter((p) => p.seguras_permitidas === mejorAutonomia)
    .sort((a, b) => a.T_revision - b.T_revision || a.T_accion - b.T_accion || a.T_segmento - b.T_segmento)[0] as Punto;
  const elegido = conMargen[0] as Punto;
  return { elegido, optimo_exacto: optimo, margen_filas: optimo.seguras_permitidas - elegido.seguras_permitidas };
}

/** Frontera: para cada cantidad de peligrosas aprobadas, la mejor autonomía alcanzable. */
export function frontera(puntos: Punto[]): { peligrosas_aprobadas: number; seguras_permitidas: number }[] {
  const mejor = new Map<number, number>();
  for (const p of puntos) mejor.set(p.peligrosas_aprobadas, Math.max(mejor.get(p.peligrosas_aprobadas) ?? -1, p.seguras_permitidas));
  return [...mejor.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([peligrosas_aprobadas, seguras_permitidas]) => ({ peligrosas_aprobadas, seguras_permitidas }));
}
