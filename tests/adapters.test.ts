import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CAMPOS, horaBogota, mapearDealUpdated } from "../adapters/crm-webhook";
import { accionSchema } from "@/lib/vobo/accion-schema";
import { evaluarReglas } from "@/lib/vobo/rules";

const fixture = (nombre: string): Record<string, unknown> =>
  JSON.parse(readFileSync(path.resolve(__dirname, "../adapters/fixtures", nombre), "utf8"));

describe("adaptador de ejemplo: webhook genérico de CRM → AccionAgente", () => {
  it("mapea la fixture de etapa «Ganado» a la acción esperada", () => {
    expect(mapearDealUpdated(fixture("deal-updated-etapa-ganado.json"))).toEqual({
      id: "evt_ejemplo_0001",
      tipo_accion: "crm_update",
      canal: "crm",
      destinatarios: 1,
      segmento_declarado: "comunidad_general",
      hora_envio: "10:30", // 15:30 UTC = 10:30 en Bogotá
      campo_crm: "etapa_crm",
      texto: "Ganado Pagado Completo",
    });
  });

  it("la acción mapeada activa la regla de etapa «Ganado» (PEDIR VOBO si es un deal, BLOQUEAR si son varios)", () => {
    const uno = evaluarReglas(mapearDealUpdated(fixture("deal-updated-etapa-ganado.json")));
    expect(uno.piso).toBe("REVIEW");
    expect(uno.reglas.map((r) => r.regla)).toEqual(["etapa_ganado_individual"]);

    const lote = evaluarReglas(mapearDealUpdated({ ...fixture("deal-updated-etapa-ganado.json"), records_affected: 40 }));
    expect(lote.piso).toBe("BLOCK");
    expect(lote.reglas.map((r) => r.regla)).toEqual(["etapa_ganado_masivo"]);
  });

  it("un cambio de notas no activa ninguna regla", () => {
    const a = mapearDealUpdated(fixture("deal-updated-notas.json"));
    expect(a.campo_crm).toBe("notas");
    expect(a.texto).toContain("grabación");
    expect(evaluarReglas(a).piso).toBe("ALLOW");
  });

  it("los campos protegidos del CRM de ejemplo se traducen a los nombres que VoBo protege", () => {
    for (const [campoCrm, campoVobo] of [["payment_status", "estado_pago"], ["marketing_consent", "consentimiento_marketing"], ["access_level", "nivel_acceso"], ["approved_discount", "descuento_aprobado"]] as const) {
      expect(CAMPOS[campoCrm]).toBe(campoVobo);
      const a = mapearDealUpdated({ ...fixture("deal-updated-notas.json"), change: { field: campoCrm, to: "x" } });
      expect(evaluarReglas(a).reglas.map((r) => r.regla)).toEqual(["campo_protegido_individual"]);
    }
  });

  it("un campo desconocido pasa tal cual", () => {
    expect(mapearDealUpdated({ ...fixture("deal-updated-notas.json"), change: { field: "campo_raro", to: "v" } }).campo_crm).toBe("campo_raro");
  });

  it("la salida pasa la misma validación que usa POST /api/evaluate", () => {
    for (const f of ["deal-updated-etapa-ganado.json", "deal-updated-notas.json"]) {
      expect(accionSchema.safeParse(mapearDealUpdated(fixture(f))).success, f).toBe(true);
    }
  });

  it("convierte UTC a hora de Bogotá, también cruzando la medianoche", () => {
    expect(horaBogota("2026-10-17T15:30:00Z")).toBe("10:30");
    expect(horaBogota("2026-10-18T03:05:00Z")).toBe("22:05");
    expect(horaBogota("2026-10-17T05:00:00Z")).toBe("00:00");
  });

  it("rechaza payloads que no son deal.updated o están incompletos", () => {
    expect(() => mapearDealUpdated({ ...fixture("deal-updated-notas.json"), event: "deal.created" })).toThrow();
    expect(() => mapearDealUpdated({ ...fixture("deal-updated-notas.json"), change: { field: "notes" } })).toThrow();
    expect(() => mapearDealUpdated({ ...fixture("deal-updated-notas.json"), occurred_at: "ayer" })).toThrow();
    expect(() => mapearDealUpdated({ ...fixture("deal-updated-notas.json"), records_affected: 0 })).toThrow();
    expect(() => mapearDealUpdated(null)).toThrow();
  });
});
