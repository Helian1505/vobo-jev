import { describe, expect, it } from "vitest";
import { combinar } from "@/lib/vobo/combine";
import { interpretar, riesgoJev } from "@/lib/vobo/jev/interpret";
import type { JevRespuesta, Respuesta } from "@/lib/vobo/jev/types";
import { perfilDe } from "@/lib/vobo/thresholds";

// Valores fijos (los iniciales de CLAUDE.md §6.4): estas pruebas no deben moverse cuando se reajusta data/thresholds.json.
const estricto = { T_accion: 0.6, T_revision: 0.25, T_segmento: 0.6 };
const laxo = { T_accion: 0.8, T_revision: 0.5, T_segmento: 0.6 };

const choice = (probs: Record<string, number>): Respuesta => {
  const elegida = Object.entries(probs).sort((a, b) => b[1] - a[1])[0] as [string, number];
  return { type: "choice", choice: elegida[0], probabilities: probs, confidence: elegida[1] };
};

const resp = (answers: Record<string, Respuesta>): JevRespuesta => ({
  model: "test",
  answers,
  usage: { input_tokens: 100, output_tokens: 0 },
});

const sena = (r: JevRespuesta, id: string, seg = "comunidad_general", u = estricto) =>
  interpretar(r, seg, u).find((s) => s.id === id);

describe("umbrales por perfil", () => {
  it("la reversibilidad define el perfil", () => {
    expect(perfilDe("irreversible")).toBe("estricto");
    expect(perfilDe("parcial")).toBe("normal");
    expect(perfilDe("reversible")).toBe("laxo");
  });
});

describe("noul", () => {
  const noul = (p: number) => resp({ certificacion: { type: "noul", noul: p } });

  it("p ≥ T_accion → severidad de la tabla (BLOCK)", () => {
    expect(sena(noul(0.6), "certificacion")).toMatchObject({ decision: "BLOCK", estado: "alerta" });
  });
  it("entre T_revision y T_accion → REVIEW por duda", () => {
    expect(sena(noul(0.25), "certificacion")).toMatchObject({ decision: "REVIEW", estado: "duda" });
    expect(sena(noul(0.59), "certificacion")).toMatchObject({ decision: "REVIEW", estado: "duda" });
  });
  it("por debajo de T_revision → ALLOW", () => {
    expect(sena(noul(0.24), "certificacion")).toMatchObject({ decision: "ALLOW", estado: "ok" });
  });
  it("el mismo p cae distinto según el perfil", () => {
    expect(sena(noul(0.7), "certificacion", "comunidad_general", estricto)?.decision).toBe("BLOCK");
    expect(sena(noul(0.7), "certificacion", "comunidad_general", laxo)?.decision).toBe("REVIEW");
  });
});

describe("choice", () => {
  const promesa = (p: Record<string, number>) => resp({ promesa: choice(p) });

  it("explicita ≥ T_accion → BLOCK; implicita ≥ T_accion → REVIEW", () => {
    expect(sena(promesa({ ninguna: 0.1, explicita: 0.8, implicita: 0.1 }), "promesa")).toMatchObject({
      decision: "BLOCK",
      opcion: "explicita",
    });
    expect(sena(promesa({ ninguna: 0.2, explicita: 0.1, implicita: 0.7 }), "promesa")).toMatchObject({
      decision: "REVIEW",
      opcion: "implicita",
    });
  });

  it("si varias opciones llegan, gana la más severa", () => {
    const s = sena(promesa({ explicita: 0.61, implicita: 0.62 }), "promesa");
    expect(s?.decision).toBe("BLOCK");
  });

  it("sin opción que llegue, la masa riesgosa (más otro) ≥ T_revision → REVIEW por duda", () => {
    const s = sena(promesa({ ninguna: 0.5, explicita: 0.2, implicita: 0.1, otro: 0.2 }), "promesa");
    expect(s).toMatchObject({ decision: "REVIEW", estado: "duda" });
    expect(s?.prob).toBeCloseTo(0.5);
  });

  it("niega_o_aclara y ninguna no cuentan como riesgo", () => {
    expect(sena(promesa({ ninguna: 0.4, niega_o_aclara: 0.5, explicita: 0.1 }), "promesa")?.decision).toBe("ALLOW");
  });
});

describe("tono (score)", () => {
  const tono = (niveles: number[], base: 0 | 1): Respuesta => ({
    type: "score",
    score: 0,
    legend: Object.fromEntries(niveles.map((_, i) => [String(i + base), `nivel ${i}`])),
    probabilities: Object.fromEntries(niveles.map((p, i) => [String(i + base), p])),
    confidence: Math.max(...niveles),
  });

  it.each([0, 1] as const)("lee los niveles desde legend aunque los índices empiecen en %i", (base) => {
    expect(sena(resp({ tono: tono([0.05, 0.05, 0.1, 0.8], base) }), "tono")).toMatchObject({ decision: "BLOCK" });
    expect(sena(resp({ tono: tono([0.1, 0.05, 0.8, 0.05], base) }), "tono")).toMatchObject({
      decision: "REVIEW",
      estado: "duda",
    });
    expect(sena(resp({ tono: tono([0.9, 0.05, 0.03, 0.02], base) }), "tono")?.decision).toBe("ALLOW");
  });
});

describe("segmento", () => {
  const seg = (p: Record<string, number>) => resp({ segmento: choice(p) });

  it("se omite si el segmento declarado es comunidad_general", () => {
    expect(sena(seg({ founders: 0.9, comunidad_general: 0.1 }), "segmento", "comunidad_general")).toBeUndefined();
  });
  it("otro segmento con probabilidad ≥ T_segmento → REVIEW", () => {
    expect(sena(seg({ ejecutivos: 0.8, founders: 0.2 }), "segmento", "founders")).toMatchObject({
      decision: "REVIEW",
      opcion: "ejecutivos",
    });
  });
  it("coincide con el declarado, o no llega al umbral, o es comunidad_general/otro → ALLOW", () => {
    expect(sena(seg({ founders: 0.9, ejecutivos: 0.1 }), "segmento", "founders")?.decision).toBe("ALLOW");
    expect(sena(seg({ ejecutivos: 0.5, founders: 0.4, otro: 0.1 }), "segmento", "founders")?.decision).toBe("ALLOW");
    expect(sena(seg({ comunidad_general: 0.9, founders: 0.1 }), "segmento", "founders")?.decision).toBe("ALLOW");
  });
});

describe("combinador", () => {
  it("JEV solo puede subir el riesgo, nunca bajarlo", () => {
    expect(combinar("BLOCK", "ALLOW")).toBe("BLOCK");
    expect(combinar("REVIEW", "ALLOW")).toBe("REVIEW");
    expect(combinar("ALLOW", "REVIEW")).toBe("REVIEW");
    expect(combinar("REVIEW", "BLOCK")).toBe("BLOCK");
  });
  it("los modos de comparación", () => {
    expect(combinar("BLOCK", "ALLOW", "solo_reglas")).toBe("BLOCK");
    expect(combinar("BLOCK", "ALLOW", "solo_jev")).toBe("ALLOW");
  });
  it("el riesgo según JEV es la señal más severa", () => {
    const r = resp({
      certificacion: { type: "noul", noul: 0.3 },
      instruccion_agente: { type: "noul", noul: 0.9 },
    });
    expect(riesgoJev(interpretar(r, "comunidad_general", estricto))).toBe("BLOCK");
  });
});
