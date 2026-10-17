import { describe, expect, it } from "vitest";
import { evaluateAction } from "@/lib/vobo/evaluate";
import { JevMock } from "@/lib/vobo/jev/mock";
import { armarRespuestaEvaluate, construirRegistro, construirResumenAprobacion } from "@/lib/vobo/respuesta";
import type { AccionAgente } from "@/lib/vobo/types";

const base: AccionAgente = {
  id: "campana-nov-001",
  tipo_accion: "correo_masivo",
  canal: "correo_oficial",
  destinatarios: 9000,
  segmento_declarado: "comunidad_general",
  hora_envio: "10:00",
  texto: "Inscríbete hoy: duplicarás tus ventas, resultado garantizado.",
};

const evaluar = (a: AccionAgente) => evaluateAction(a, { cliente: new JevMock() });
const RID = "13ab2ca9-4555-47b4-b6a0-f9e7e900fa3d";

describe("resumen_aprobacion", () => {
  it("dice qué acción es, la decisión y de 2 a 3 razones, en español", async () => {
    const ev = await evaluar(base); // audiencia grande + promesa explícita (mock)
    expect(ev.decision).toBe("BLOCK");
    const t = construirResumenAprobacion(base, ev, RID);
    expect(t).toContain("*VoBo: BLOQUEAR*");
    expect(t).toContain("correo masivo a 9.000 destinatarios por «correo_oficial» (id campana-nov-001)");
    expect(t).toContain("Texto: «Inscríbete hoy");
    expect(t).toContain("Por qué:");
    const razones = t.split("\n").filter((l) => l.startsWith("• "));
    expect(razones.length).toBeGreaterThanOrEqual(2);
    expect(razones.length).toBeLessThanOrEqual(3);
    expect(t).toContain("Solicitud: 13ab2ca9");
    expect(t).not.toMatch(/undefined|null|\[object/);
  });

  it("con más de 3 razones, avisa cuántas faltan", async () => {
    const ev = await evaluar({ ...base, canal: "gmail_personal", hora_envio: "22:30" }); // 3+ razones
    const t = construirResumenAprobacion(base, { ...ev, explicacion: { ...ev.explicacion, razones: ["a", "b", "c", "d", "e"] } }, RID);
    expect(t.split("\n").filter((l) => l.startsWith("• "))).toHaveLength(3);
    expect(t).toContain("(y 2 más en el detalle)");
  });

  it("una acción permitida lo dice sin inventar razones", async () => {
    const limpia = { ...base, destinatarios: 800, texto: "Te invitamos a la clase abierta del jueves." };
    const ev = await evaluar(limpia);
    expect(ev.decision).toBe("ALLOW");
    const t = construirResumenAprobacion(limpia, ev, RID);
    expect(t).toContain("*VoBo: PERMITIR*");
    expect(t).toContain("No se encontraron problemas.");
    expect(t).not.toContain("Por qué:");
  });

  it("describe cada tipo de acción y recorta los textos largos", async () => {
    const crm: AccionAgente = { ...base, tipo_accion: "crm_update", canal: "crm", destinatarios: 1, campo_crm: "etapa_crm", id: undefined, texto: "Ganado Pagado Completo" };
    expect(construirResumenAprobacion(crm, await evaluar(crm), RID)).toContain("cambio en el CRM: «etapa_crm» en 1 contacto(s)");
    const redes: AccionAgente = { ...base, tipo_accion: "publicacion_redes", canal: "linkedin_oficial", destinatarios: 0 };
    expect(construirResumenAprobacion(redes, await evaluar(redes), RID)).toContain("publicación en «linkedin_oficial»");
    const wa: AccionAgente = { ...base, tipo_accion: "whatsapp_masivo", canal: "whatsapp_oficial" };
    expect(construirResumenAprobacion(wa, await evaluar(wa), RID)).toContain("WhatsApp masivo a 9.000 destinatarios");

    const largo = { ...base, texto: "palabra ".repeat(200) };
    const t = construirResumenAprobacion(largo, await evaluar(largo), RID);
    expect(t.split("\n").find((l) => l.startsWith("Texto:"))!.length).toBeLessThan(140);
    expect(t.length).toBeLessThan(1200); // cabe en un mensaje de Slack o WhatsApp
  });
});

describe("registro", () => {
  it("es un objeto plano con los campos pedidos", async () => {
    const ev = await evaluar(base);
    const r = construirRegistro(base, ev, RID, new Date("2026-10-17T15:30:00.000Z"));
    expect(r).toEqual({
      request_id: RID,
      timestamp: "2026-10-17T15:30:00.000Z",
      decision: ev.decision,
      piso_reglas: ev.piso_reglas,
      riesgo_jev: ev.riesgo_jev,
      reglas: "audiencia_grande",
      modelo: "mock",
      jev_estado: "ok",
      tipo_accion: "correo_masivo",
      id_accion: "campana-nov-001",
    });
    // plano: ningún valor es un objeto o un arreglo
    for (const [k, v] of Object.entries(r)) expect(["string", "number", "boolean"].includes(typeof v) || v === null, k).toBe(true);
  });

  it("sin reglas, `reglas` es un texto vacío; con varias, van separadas por coma; sin id, id_accion es null", async () => {
    const limpia = { ...base, id: undefined, destinatarios: 800, texto: "Hola." };
    expect(construirRegistro(limpia, await evaluar(limpia), RID)).toMatchObject({ reglas: "", id_accion: null });
    const varias = { ...base, canal: "gmail_personal", hora_envio: "22:30" };
    const r = construirRegistro(varias, await evaluar(varias), RID);
    expect(r.reglas.split(",").sort()).toEqual(["audiencia_grande", "canal_no_oficial", "fuera_de_horario"]);
  });

  it("el timestamp es ISO 8601 en UTC", async () => {
    const r = construirRegistro(base, await evaluar(base), RID);
    expect(r.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});

describe("armarRespuestaEvaluate", () => {
  it("conserva todos los campos de la Evaluacion y agrega los de contrato", async () => {
    const ev = await evaluar(base);
    const r = armarRespuestaEvaluate(base, ev, RID);
    for (const k of Object.keys(ev)) expect(r, k).toHaveProperty(k);
    expect(r).toMatchObject({ schema_version: "1", request_id: RID, decision: ev.decision });
    expect(typeof r.resumen_aprobacion).toBe("string");
    expect(r.registro.request_id).toBe(RID);
  });
});
