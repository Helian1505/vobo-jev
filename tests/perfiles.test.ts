import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AUDIENCIAS, resolverAudiencia } from "@/lib/vobo/audiencias";
import { parseCsvConEncabezado } from "@/lib/vobo/csv";
import { perfilesDesdeFilas } from "@/lib/vobo/perfiles-datos";
import { PERFILES, factoresEscala, perfilPorId } from "@/lib/vobo/perfiles";

const raiz = path.resolve(__dirname, "..");

interface AudienciaJson {
  perfiles_en_muestra: number;
  destinatarios_estimados_base_real: number;
  pct_afinidad_baja: number;
}
const { audiencias, factores_escala } = JSON.parse(readFileSync(path.join(raiz, "data/audiencias_demo.json"), "utf8")) as {
  audiencias: Record<string, AudienciaJson>;
  factores_escala: Record<string, number>;
};

describe("perfiles generados", () => {
  it("src/generated/perfiles.json está al día con data/perfiles_30x.csv (corre npm run build-data si falla)", () => {
    const csv = perfilesDesdeFilas(parseCsvConEncabezado(readFileSync(path.join(raiz, "data/perfiles_30x.csv"), "utf8")));
    expect(PERFILES).toEqual(csv);
    expect(PERFILES).toHaveLength(697);
  });

  it("los factores de escala coinciden con los del JSON redondeados", () => {
    const f = factoresEscala();
    expect(f["Deal en el CRM"]).toBeCloseTo(factores_escala["Deal en el CRM"] as number, 2);
    expect(f["Lead (sin deal)"]).toBeCloseTo(factores_escala["Lead (sin deal)"] as number, 1);
  });

  it("encuentra un perfil por id", () => {
    expect(perfilPorId("P-298")).toMatchObject({ etapa_crm: "Cierre perdido", programa_sugerido: "Inmersión Ejecutiva", afinidad: 10 });
    expect(perfilPorId("P-000")).toBeUndefined();
  });
});

describe("audiencias de la demo reproducen audiencias_demo.json exacto", () => {
  it.each(AUDIENCIAS.map((a) => [a.id, a.nombre] as const))("%s · %s", (id) => {
    const esperado = audiencias[id] as AudienciaJson;
    const r = resolverAudiencia(id);
    expect(r?.perfiles_en_muestra).toBe(esperado.perfiles_en_muestra);
    expect(r?.destinatarios_estimados).toBe(esperado.destinatarios_estimados_base_real);
    expect(r?.pct_afinidad_baja).toBeCloseTo(esperado.pct_afinidad_baja, 3);
    expect(r?.ids).toHaveLength(esperado.perfiles_en_muestra);
  });

  it("hay las mismas 6 audiencias", () => {
    expect(AUDIENCIAS.map((a) => a.id)).toEqual(Object.keys(audiencias));
  });
});
