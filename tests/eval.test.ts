import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { accionDesdeFila } from "@/lib/vobo/banco";
import { parseCsvConEncabezado } from "@/lib/vobo/csv";
import { evaluarCorrida } from "@/lib/vobo/eval/corrida";
import { parseEtiquetas } from "@/lib/vobo/eval/etiquetas";
import { hashVigente, verificarCongelacion } from "@/lib/vobo/eval/freeze";
import {
  conjuntosDe,
  costoLatencia,
  metricasModo,
  percentil,
  proporcion,
  valorAgregadoJev,
  type CasoEvaluado,
} from "@/lib/vobo/eval/metricas";
import { decidirConCache, type FilaCorrida } from "@/lib/vobo/eval/replay";
import { JevMock } from "@/lib/vobo/jev/mock";
import { PREGUNTAS } from "@/lib/vobo/jev/questions";
import { armarState } from "@/lib/vobo/jev/state";
import { evaluarReglas, reversibilidadDe } from "@/lib/vobo/rules";
import { UMBRALES, perfilDe } from "@/lib/vobo/thresholds";
import type { Decision } from "@/lib/vobo/types";

const raiz = path.resolve(__dirname, "..");

const caso = (o: Partial<CasoEvaluado> & { etiqueta: Decision; combinado: Decision; solo_reglas?: Decision; solo_jev?: Decision }): CasoEvaluado => ({
  id: o.id ?? "X",
  etiqueta: o.etiqueta,
  familia: o.familia ?? "F",
  origen: o.origen ?? "humano_acuerdo",
  ambigua: o.ambigua ?? false,
  texto: o.texto ?? "t",
  decisiones: { combinado: o.combinado, solo_reglas: o.solo_reglas ?? o.combinado, solo_jev: o.solo_jev ?? o.combinado },
  jev_estado: o.jev_estado ?? "ok",
  latencia_ms: o.latencia_ms ?? 300,
  input_tokens: o.input_tokens ?? 1500,
  costo_usd: o.costo_usd ?? 0.000063,
});

describe("congelación de etiquetas", () => {
  it("el hash vigente de FREEZE.md coincide con data/etiquetas_v1.csv", () => {
    const v = verificarCongelacion(raiz);
    expect(v.esperado).toMatch(/^[0-9a-f]{64}$/);
    expect(v.ok).toBe(true);
  });

  it("lee el hash vigente (v1.1) y no el de la v1.0 reemplazada", () => {
    const md = "- **SHA-256 vigente (v1.1):** `" + "a".repeat(64) + "`\n- v1.0 (reemplazada): `" + "b".repeat(64) + "`";
    expect(hashVigente(md)).toBe("a".repeat(64));
    expect(hashVigente("sin hash")).toBeNull();
  });

  it("las etiquetas tienen 400 filas: 250 dev y 150 test", () => {
    const e = parseEtiquetas(readFileSync(path.join(raiz, "data/etiquetas_v1.csv"), "utf8"));
    expect(e).toHaveLength(400);
    expect(e.filter((x) => x.split === "dev")).toHaveLength(250);
    expect(e.filter((x) => x.split === "test")).toHaveLength(150);
    expect(e.filter((x) => x.split === "test" && x.ambigua)).toHaveLength(5);
  });
});

describe("métricas", () => {
  it("cuenta peligrosas auto-aprobadas, autonomía, escalado, sobre-bloqueo y severidad subestimada", () => {
    const casos = [
      caso({ etiqueta: "ALLOW", combinado: "ALLOW" }), // segura permitida
      caso({ etiqueta: "ALLOW", combinado: "ALLOW" }), // segura permitida
      caso({ etiqueta: "ALLOW", combinado: "REVIEW" }), // segura escalada
      caso({ etiqueta: "ALLOW", combinado: "BLOCK" }), // sobre-bloqueo
      caso({ etiqueta: "REVIEW", combinado: "ALLOW" }), // PELIGROSA auto-aprobada
      caso({ etiqueta: "REVIEW", combinado: "BLOCK" }),
      caso({ etiqueta: "BLOCK", combinado: "REVIEW" }), // severidad subestimada
      caso({ etiqueta: "BLOCK", combinado: "BLOCK" }),
    ];
    const m = metricasModo(casos, "combinado");
    expect(m.n).toBe(8);
    expect(m.peligrosas).toBe(4);
    expect(m.peligrosas_auto_aprobadas).toBe(1);
    expect(m.techo_regla_del_3).toBeNull();
    expect(m.autonomia).toMatchObject({ k: 2, n: 4 });
    expect(m.escalado).toMatchObject({ k: 2, n: 8 });
    expect(m.sobre_bloqueo).toMatchObject({ k: 1, n: 4 });
    expect(m.severidad_subestimada).toMatchObject({ k: 1, n: 2 });
    expect(m.confusion).toEqual([
      [2, 1, 1],
      [1, 0, 1],
      [0, 1, 1],
    ]);
    expect(m.errores.map((e) => e.tipo).sort()).toEqual(["otro", "otro", "peligrosa_aprobada", "severidad_subestimada", "sobre_bloqueo"]);
  });

  it("con 0 peligrosas auto-aprobadas el techo es 3/n (regla del 3)", () => {
    const casos = Array.from({ length: 30 }, () => caso({ etiqueta: "REVIEW", combinado: "REVIEW" }));
    const m = metricasModo(casos, "combinado");
    expect(m.peligrosas_auto_aprobadas).toBe(0);
    expect(m.techo_regla_del_3).toBeCloseTo(0.1);
  });

  it("valor agregado de JEV: peligrosas que las reglas dejan pasar y el combinado atrapa, por familia", () => {
    const casos = [
      caso({ etiqueta: "BLOCK", solo_reglas: "ALLOW", combinado: "BLOCK", familia: "J1" }),
      caso({ etiqueta: "REVIEW", solo_reglas: "ALLOW", combinado: "ALLOW", familia: "J1" }),
      caso({ etiqueta: "BLOCK", solo_reglas: "BLOCK", combinado: "BLOCK", familia: "R1" }),
      caso({ etiqueta: "ALLOW", solo_reglas: "ALLOW", combinado: "REVIEW", familia: "N" }),
    ];
    const v = valorAgregadoJev(casos);
    expect(v.dejadas_pasar_por_reglas).toBe(2);
    expect(v.atrapadas_por_jev).toBe(1);
    expect(v.por_familia).toEqual({ J1: { dejadas: 2, atrapadas: 1 } });
  });

  it("intervalo de Wilson y percentiles", () => {
    const p = proporcion(50, 100);
    expect(p.pct).toBe(0.5);
    expect(p.ic95?.[0]).toBeCloseTo(0.404, 2);
    expect(p.ic95?.[1]).toBeCloseTo(0.596, 2);
    expect(proporcion(0, 0).pct).toBeNull();
    expect(percentil([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.5)).toBe(5);
    expect(percentil([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.95)).toBe(10);
    expect(percentil([], 0.5)).toBeNull();
  });

  it("costo por 1.000 decisiones y latencia solo cuentan llamadas que respondieron", () => {
    const c = costoLatencia([
      caso({ etiqueta: "ALLOW", combinado: "ALLOW", latencia_ms: 200, costo_usd: 0.0001 }),
      caso({ etiqueta: "ALLOW", combinado: "ALLOW", latencia_ms: 400, costo_usd: 0.0001 }),
      caso({ etiqueta: "ALLOW", combinado: "REVIEW", jev_estado: "fallo", latencia_ms: 9000, costo_usd: 0 }),
    ]);
    expect(c.llamadas_ok).toBe(2);
    expect(c.llamadas_fallo).toBe(1);
    expect(c.costo_por_1000_decisiones_usd).toBeCloseTo(0.1);
    expect(c.latencia_p50_ms).toBe(200);
  });

  it("conjuntos: test principal sin ambiguas; dev con y sin propuesta de diseño", () => {
    const casos = [
      caso({ etiqueta: "ALLOW", combinado: "ALLOW", ambigua: true, origen: "humano_sin_mayoria" }),
      caso({ etiqueta: "ALLOW", combinado: "ALLOW", origen: "propuesta_no_revisada" }),
      caso({ etiqueta: "ALLOW", combinado: "ALLOW", origen: "humano_unico" }),
    ];
    expect(conjuntosDe("test", casos).principal).toHaveLength(2);
    expect(conjuntosDe("test", casos).secundario).toHaveLength(3);
    expect(conjuntosDe("dev", casos).solo_etiqueta_humana).toHaveLength(2);
  });
});

describe("corrida grabada", () => {
  const banco = parseCsvConEncabezado(readFileSync(path.join(raiz, "data/banco_acciones_v1_ciego.csv"), "utf8"))
    .filter((f) => f.split === "dev")
    .slice(0, 40);
  const etiquetas = new Map(parseEtiquetas(readFileSync(path.join(raiz, "data/etiquetas_v1.csv"), "utf8")).map((e) => [e.id, e]));

  async function grabarConMock(): Promise<Map<string, FilaCorrida>> {
    const filas = new Map<string, FilaCorrida>();
    const mock = new JevMock();
    for (const f of banco) {
      const r = await mock.consultar(armarState(accionDesdeFila(f)), PREGUNTAS);
      filas.set(f.id as string, { id: f.id as string, respuesta: { model: r.model, answers: r.answers, usage: r.usage }, error: null, latencia_ms: 100, llamadas: 1 });
    }
    return filas;
  }

  it("el camino rápido del ajuste da lo mismo que evaluateAction en cada fila", async () => {
    const filas = await grabarConMock();
    const { evaluaciones } = await evaluarCorrida({ banco, etiquetas, filas, umbrales: UMBRALES });
    for (const f of banco) {
      const a = accionDesdeFila(f);
      const ev = evaluaciones.get(f.id as string);
      const u = UMBRALES.perfiles[perfilDe(reversibilidadDe(a.tipo_accion))];
      const d = decidirConCache(evaluarReglas(a).piso, a.segmento_declarado, filas.get(f.id as string) as FilaCorrida, u);
      expect(d.combinado, f.id).toBe(ev?.decision);
      expect(d.solo_reglas, f.id).toBe(ev?.piso_reglas);
      expect(d.solo_jev, f.id).toBe(ev?.riesgo_jev);
    }
  });

  it("una fila sin respuesta (fallo de JEV) nunca queda en PERMITIR", async () => {
    const filas = await grabarConMock();
    for (const [id, f] of filas) filas.set(id, { ...f, respuesta: null, error: "http_500" });
    const { casos } = await evaluarCorrida({ banco, etiquetas, filas, umbrales: UMBRALES });
    expect(casos.every((c) => c.jev_estado === "fallo")).toBe(true);
    expect(casos.every((c) => c.decisiones.solo_jev === "REVIEW")).toBe(true);
    expect(casos.every((c) => c.decisiones.combinado !== "ALLOW")).toBe(true);
  });

  it("falla con un mensaje claro si falta la etiqueta o la fila de la corrida", async () => {
    const filas = await grabarConMock();
    await expect(evaluarCorrida({ banco, etiquetas: new Map(), filas, umbrales: UMBRALES })).rejects.toThrow(/Sin etiqueta/);
    await expect(evaluarCorrida({ banco, etiquetas, filas: new Map(), umbrales: UMBRALES })).rejects.toThrow(/no tiene la fila/);
  });
});
