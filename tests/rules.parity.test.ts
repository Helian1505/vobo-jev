import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { accionDesdeFila } from "@/lib/vobo/banco";
import { parseCsvConEncabezado } from "@/lib/vobo/csv";
import { evaluarReglas } from "@/lib/vobo/rules";

const raiz = path.resolve(__dirname, "..");
const leer = (rel: string) => parseCsvConEncabezado(readFileSync(path.join(raiz, rel), "utf8"));

const banco = leer("data/banco_acciones_v1_ciego.csv");
const referencia = leer("data/piso_reglas_referencia.csv");
const refPorId = new Map(referencia.map((r) => [r.id as string, r]));

const conjunto = (s: string | undefined) => new Set((s ?? "").split(/[;|,\s]+/).filter(Boolean));

describe("paridad de reglas con referencia/rules_ref.py", () => {
  it("el banco y la referencia tienen las mismas 400 filas", () => {
    expect(banco).toHaveLength(400);
    expect(referencia).toHaveLength(400);
    expect(new Set(banco.map((f) => f.id))).toEqual(new Set(referencia.map((f) => f.id)));
  });

  it("coincide en las 400 filas (piso y conjunto de reglas)", () => {
    const fallos: string[] = [];
    const conteo = { ALLOW: 0, REVIEW: 0, BLOCK: 0 };

    for (const fila of banco) {
      const ref = refPorId.get(fila.id as string);
      const { piso, reglas } = evaluarReglas(accionDesdeFila(fila));
      conteo[piso]++;
      const obtenidas = new Set(reglas.map((r) => r.regla));
      const esperadas = conjunto(ref?.reglas_activadas);
      if (piso !== ref?.piso_reglas || obtenidas.size !== esperadas.size || [...obtenidas].some((r) => !esperadas.has(r))) {
        fallos.push(`${fila.id}: TS=${piso}[${[...obtenidas]}] ref=${ref?.piso_reglas}[${[...esperadas]}]`);
      }
    }

    expect(fallos).toEqual([]);
    expect(conteo).toEqual({ ALLOW: 293, REVIEW: 70, BLOCK: 37 });
  });

  it("las reglas v2 no se activan en el banco", () => {
    const v2 = new Set(["etapa_ganado_masivo", "etapa_ganado_individual", "oferta_sin_afinidad"]);
    const activadas = banco.flatMap((f) => evaluarReglas(accionDesdeFila(f)).reglas.map((r) => r.regla));
    expect(activadas.filter((r) => v2.has(r))).toEqual([]);
  });
});
