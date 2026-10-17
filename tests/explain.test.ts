import { describe, expect, it } from "vitest";
import { explicar } from "@/lib/vobo/explain";
import type { Senal } from "@/lib/vobo/jev/interpret";
import { evaluarReglas } from "@/lib/vobo/rules";
import type { AccionAgente } from "@/lib/vobo/types";

const base: AccionAgente = {
  tipo_accion: "correo_masivo",
  canal: "correo_oficial",
  destinatarios: 800,
  segmento_declarado: "founders",
  hora_envio: "10:00",
  texto: "x",
};

const razones = (a: Partial<AccionAgente>) => {
  const { piso, reglas } = evaluarReglas({ ...base, ...a });
  return explicar({ decision: piso, reglas, senales: [], jevFallo: false }).razones;
};

describe("plantillas de las reglas", () => {
  it("canal, bajas y audiencia", () => {
    expect(razones({ canal: "gmail" })).toEqual(["El canal «gmail» no es un canal oficial de 30X."]);
    expect(razones({ en_lista_de_bajas: 3 })).toEqual(["3 destinatario(s) pidieron no recibir más mensajes."]);
    expect(razones({ destinatarios: 7500 })).toEqual(["Va a 7.500 destinatarios; por encima de 5.000 se pide VoBo humano."]);
  });

  it("horario muestra 19:59 como el último minuto permitido", () => {
    expect(razones({ hora_envio: "21:30" })).toEqual(["Se enviaría a las 21:30; los envíos masivos van de 07:00 a 19:59."]);
  });

  it("campo protegido, individual y masivo", () => {
    const crm = { tipo_accion: "crm_update", canal: "crm", campo_crm: "estado_pago" } as const;
    expect(razones({ ...crm, destinatarios: 1 })).toEqual(["Cambia «estado_pago», un campo protegido; requiere VoBo humano."]);
    expect(razones({ ...crm, destinatarios: 40 })).toEqual(["Cambia «estado_pago», un campo protegido, en 40 contactos a la vez."]);
  });

  it("etapa ganado", () => {
    const crm = { tipo_accion: "crm_update", canal: "crm", campo_crm: "etapa_crm", texto: "Ganado Pagado Completo" } as const;
    expect(razones({ ...crm, destinatarios: 1, perfil_id: "P-298" })).toEqual([
      "Marca el deal P-298 como «Ganado Pagado Completo»; eso equivale a registrar un pago y requiere VoBo humano.",
    ]);
    expect(razones({ ...crm, destinatarios: 40 })).toEqual([
      "Marca 40 deals como «Ganado Pagado Completo» a la vez; registrar pagos en masa no se permite.",
    ]);
  });

  it("fecha y precio", () => {
    expect(razones({ fecha_evento_real: "2026-11-12", fecha_en_texto: "15 de noviembre" })).toEqual([
      "El texto dice «15 de noviembre», pero el evento es el 12 de noviembre.",
    ]);
    expect(razones({ precio_en_texto_usd: 1200, programa_ofrecido: "AI for Executives" })).toEqual([
      "El texto dice USD 1.200; el catálogo dice USD 2.000 para AI for Executives.",
    ]);
    expect(razones({ precio_en_texto_usd: 149 })).toEqual(["El texto dice USD 149; el catálogo dice USD 99."]);
  });

  it("oferta sin afinidad lleva la nota de la muestra", () => {
    const [r] = razones({ programa_ofrecido: "AI Sales", audiencia_pct_afinidad_baja: 1 });
    expect(r).toContain("el 100% tiene afinidad baja (0–3)");
    expect(r).toContain("cerca de 5 veces más");
  });
});

describe("señales de JEV", () => {
  const senal = (o: Partial<Senal>): Senal => ({ id: "promesa", decision: "BLOCK", estado: "alerta", prob: 0.93, opcion: "explicita", detalle: {}, ...o });

  it("alerta y duda", () => {
    const e = explicar({ decision: "BLOCK", reglas: [], senales: [senal({})], jevFallo: false });
    expect(e.titular).toBe("BLOQUEAR: JEV estima un 93% de probabilidad de que el texto garantice un resultado.");
    const d = explicar({
      decision: "REVIEW",
      reglas: [],
      senales: [senal({ decision: "REVIEW", estado: "duda", prob: 0.35 })],
      jevFallo: false,
    });
    expect(d.razones).toEqual(["JEV no descarta que el texto garantice un resultado (35%); lo revisa una persona."]);
    expect(d.titular.startsWith("PEDIR VOBO: ")).toBe(true);
  });

  it("las señales sin riesgo no aparecen y el titular es PERMITIR", () => {
    const e = explicar({ decision: "ALLOW", reglas: [], senales: [senal({ decision: "ALLOW", estado: "ok", prob: 0.02 })], jevFallo: false });
    expect(e).toEqual({ titular: "PERMITIR: no se encontraron problemas.", razones: [] });
  });

  it("un fallo de JEV agrega el mensaje fijo", () => {
    const e = explicar({ decision: "REVIEW", reglas: [], senales: [], jevFallo: true });
    expect(e.titular).toBe("PEDIR VOBO: No se pudo consultar a JEV; por seguridad pasa a VoBo humano.");
  });
});
