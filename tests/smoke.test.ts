import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const raiz = path.resolve(__dirname, "..");

describe("andamiaje F0", () => {
  it("carga la política demo-v1", () => {
    const politica = JSON.parse(readFileSync(path.join(raiz, "data/policy_demo.json"), "utf8"));
    expect(politica.version).toContain("demo-v1");
    expect(politica.umbral_audiencia_revision).toBe(5000);
  });

  it("el banco ciego tiene 400 acciones", () => {
    const csv = readFileSync(path.join(raiz, "data/banco_acciones_v1_ciego.csv"), "utf8");
    // Las celdas de texto pueden traer saltos de línea; contamos ids de fila (A01..A60, B001..B340).
    const ids = csv.match(/^(A\d{2}|B\d{3}),/gm) ?? [];
    expect(ids.length).toBe(400);
  });
});
