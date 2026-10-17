import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { evaluarReglas } from "@/lib/vobo/rules";
import type { AccionAgente } from "@/lib/vobo/types";

interface Ejemplo {
  id: string;
  titulo: string;
  accion: Omit<AccionAgente, "texto"> & { texto?: string };
  piso_reglas_esperado: "ALLOW" | "REVIEW" | "BLOCK";
  reglas_esperadas: string[];
}

const { ejemplos } = JSON.parse(
  readFileSync(path.resolve(__dirname, "../data/ejemplos_demo.json"), "utf8"),
) as { ejemplos: Ejemplo[] };

describe("ejemplos de la demo (data/ejemplos_demo.json)", () => {
  it("hay 16 ejemplos", () => {
    expect(ejemplos).toHaveLength(16);
  });

  it.each(ejemplos.map((e) => [e.id, e.titulo, e] as const))("%s · %s", (_id, _titulo, e) => {
    const { piso, reglas } = evaluarReglas({ ...e.accion, texto: e.accion.texto ?? "" });
    expect(piso).toBe(e.piso_reglas_esperado);
    expect(reglas.map((r) => r.regla).sort()).toEqual([...e.reglas_esperadas].sort());
  });
});
