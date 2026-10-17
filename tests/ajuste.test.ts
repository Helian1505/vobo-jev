import { describe, expect, it } from "vitest";
import { BANDA_DE_DUDA_MINIMA, barrer, elegir, frontera, mallaDe, rango, type FilaAjuste, type Punto } from "@/lib/vobo/eval/ajuste";
import type { FilaCorrida } from "@/lib/vobo/eval/replay";
import { UMBRALES } from "@/lib/vobo/thresholds";
import type { Decision } from "@/lib/vobo/types";
import type { Respuesta } from "@/lib/vobo/jev/types";

const respuestaCon = (instruccion: number): FilaCorrida => {
  const choice = (opcion: string, opciones: string[]): Respuesta => ({
    type: "choice",
    choice: opcion,
    probabilities: Object.fromEntries(opciones.map((o) => [o, o === opcion ? 1 : 0])),
    confidence: 1,
  });
  return {
    id: "x",
    error: null,
    latencia_ms: 100,
    llamadas: 1,
    respuesta: {
      model: "t",
      usage: { input_tokens: 1000, output_tokens: 0 },
      answers: {
        promesa: choice("ninguna", ["ninguna", "niega_o_aclara", "implicita", "explicita", "otro"]),
        certificacion: { type: "noul", noul: 0.02 },
        datos_personales: choice("ninguno", ["ninguno", "sensibles_o_contacto", "persona_identificable", "otro"]),
        instruccion_agente: { type: "noul", noul: instruccion },
        afirmacion: choice("ninguna", ["ninguna", "con_respaldo", "sin_respaldo", "otro"]),
        segmento: choice("comunidad_general", ["founders", "ejecutivos", "equipos_tecnicos", "estudiantes", "comunidad_general", "otro"]),
        tono: { type: "score", score: 0, legend: { "0": "a", "1": "b", "2": "c", "3": "d" }, probabilities: { "0": 1, "1": 0, "2": 0, "3": 0 }, confidence: 1 },
      },
    },
  };
};

const fila = (id: string, etiqueta: Decision, instruccion: number): FilaAjuste => ({
  id,
  etiqueta,
  piso: "ALLOW",
  segmento: "comunidad_general",
  perfil: "estricto",
  fila: respuestaCon(instruccion),
});

describe("barrido de umbrales", () => {
  it("cuenta peligrosas aprobadas y seguras permitidas por combinación", () => {
    const filas = [fila("s1", "ALLOW", 0.05), fila("s2", "ALLOW", 0.4), fila("p1", "BLOCK", 0.9), fila("p2", "REVIEW", 0.35)];
    const malla = { T_accion: [0.6], T_revision: [0.25, 0.5], T_segmento: [0.6] };
    const [bajo, alto] = barrer(filas, malla) as [Punto, Punto];
    // T_revision 0,25: s2 (0,4) y p2 (0,35) quedan en duda → escalan; solo s1 se permite
    expect(bajo).toMatchObject({ peligrosas_aprobadas: 0, seguras_permitidas: 1, seguras: 2, peligrosas: 2 });
    // T_revision 0,5: s2 se permite (ganancia) pero p2 también (0,35 < 0,5): se cuela una peligrosa
    expect(alto).toMatchObject({ peligrosas_aprobadas: 1, seguras_permitidas: 2 });
  });

  it("la banda de duda mínima descarta combinaciones con T_accion − T_revision pequeño", () => {
    const filas = [fila("s", "ALLOW", 0.05)];
    const todos = barrer(filas, { T_accion: [0.5, 0.7], T_revision: [0.3, 0.5], T_segmento: [0.6], bandaMinima: 0.2 });
    expect(todos.map((p) => [p.T_accion, p.T_revision])).toEqual([
      [0.5, 0.3],
      [0.7, 0.3],
      [0.7, 0.5],
    ]);
  });

  it("la malla robusta respeta T_revision ≥ 0,25 y la banda; la del objetivo cero llega más abajo", () => {
    expect(Math.min(...mallaDe("robusto").T_revision)).toBe(0.25);
    expect(mallaDe("robusto").bandaMinima).toBe(BANDA_DE_DUDA_MINIMA);
    expect(Math.min(...mallaDe("cero").T_revision)).toBe(0.05);
    expect(rango(0.5, 0.7, 0.05)).toEqual([0.5, 0.55, 0.6, 0.65, 0.7]);
  });
});

describe("elección", () => {
  const p = (T_accion: number, T_revision: number, T_segmento: number, pa: number, sp: number): Punto => ({
    T_accion,
    T_revision,
    T_segmento,
    peligrosas_aprobadas: pa,
    seguras_permitidas: sp,
    seguras: 100,
    peligrosas: 50,
  });

  it("primero minimiza peligrosas aprobadas, luego maximiza autonomía", () => {
    const e = elegir([p(0.6, 0.25, 0.6, 2, 90), p(0.7, 0.3, 0.6, 1, 60), p(0.8, 0.3, 0.6, 1, 70)], 0);
    expect(e.elegido).toMatchObject({ peligrosas_aprobadas: 1, seguras_permitidas: 70 });
  });

  it("con margen, entre los casi óptimos elige el más conservador (umbrales más bajos)", () => {
    const e = elegir([p(0.6, 0.5, 0.6, 0, 80), p(0.6, 0.3, 0.6, 0, 77), p(0.6, 0.25, 0.6, 0, 70)], 0.05);
    expect(e.optimo_exacto.T_revision).toBe(0.5);
    expect(e.elegido.T_revision).toBe(0.3);
    expect(e.margen_filas).toBe(3);
  });

  it("descarta los puntos al filo: un vecino que deja pasar más peligrosas", () => {
    const e = elegir(
      [
        p(0.6, 0.3, 0.6, 0, 90), // al filo: su vecino (0,6; 0,35) deja pasar una
        p(0.6, 0.35, 0.6, 1, 95),
        p(0.7, 0.3, 0.6, 0, 80), // estable
      ],
      0,
    );
    expect(e.elegido).toMatchObject({ T_accion: 0.7, T_revision: 0.3 });
  });

  it("frontera: mejor autonomía para cada cantidad de peligrosas aprobadas", () => {
    expect(frontera([p(0.6, 0.3, 0.6, 2, 70), p(0.6, 0.4, 0.6, 2, 75), p(0.7, 0.3, 0.6, 0, 50)])).toEqual([
      { peligrosas_aprobadas: 0, seguras_permitidas: 50 },
      { peligrosas_aprobadas: 2, seguras_permitidas: 75 },
    ]);
  });
});

describe("data/thresholds.json", () => {
  it("está ajustado en dev y cumple las restricciones de diseño de cada perfil", () => {
    expect(UMBRALES.estado).toBe("ajustado_en_dev");
    for (const [perfil, u] of Object.entries(UMBRALES.perfiles)) {
      expect(u.T_revision, perfil).toBeGreaterThanOrEqual(0.25);
      expect(u.T_accion - u.T_revision, perfil).toBeGreaterThanOrEqual(BANDA_DE_DUDA_MINIMA - 1e-9);
      expect(u.T_accion, perfil).toBeLessThanOrEqual(1);
    }
    expect(UMBRALES.modelo).toBe("jev-1.14.0");
  });
});
