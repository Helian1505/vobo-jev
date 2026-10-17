import { describe, expect, it } from "vitest";
import { parseFechaEs } from "@/lib/vobo/fechas";
import { evaluarReglas } from "@/lib/vobo/rules";
import type { AccionAgente } from "@/lib/vobo/types";

const correo = (o: Partial<AccionAgente> = {}): AccionAgente => ({
  tipo_accion: "correo_masivo",
  canal: "correo_oficial",
  destinatarios: 800,
  segmento_declarado: "founders",
  hora_envio: "10:00",
  texto: "Texto de prueba.",
  ...o,
});

const crm = (o: Partial<AccionAgente> = {}): AccionAgente => ({
  tipo_accion: "crm_update",
  canal: "crm",
  destinatarios: 1,
  segmento_declarado: "founders",
  hora_envio: "12:00",
  texto: "valor",
  ...o,
});

const nombres = (a: AccionAgente) => evaluarReglas(a).reglas.map((r) => r.regla);

describe("horario de envíos masivos (07:00 ≤ hora < 20:00)", () => {
  it.each([
    ["07:00", false],
    ["19:59", false],
    ["20:00", true],
    ["06:59", true],
    ["00:15", true],
  ])("%s → fuera de horario = %s", (hora, fuera) => {
    expect(nombres(correo({ hora_envio: hora })).includes("fuera_de_horario")).toBe(fuera);
  });

  it("aplica a WhatsApp masivo pero no a redes ni al CRM", () => {
    expect(nombres(correo({ tipo_accion: "whatsapp_masivo", canal: "whatsapp_oficial", hora_envio: "21:30" }))).toContain("fuera_de_horario");
    expect(nombres(correo({ tipo_accion: "publicacion_redes", canal: "linkedin_oficial", destinatarios: 0, hora_envio: "23:00" }))).toEqual([]);
    expect(nombres(crm({ hora_envio: "23:00" }))).toEqual([]);
  });
});

describe("audiencia grande (más de 5.000)", () => {
  it.each([
    [4999, false],
    [5000, false],
    [5001, true],
  ])("%i destinatarios → audiencia_grande = %s", (n, activa) => {
    expect(nombres(correo({ destinatarios: n })).includes("audiencia_grande")).toBe(activa);
  });
});

describe("campo protegido del CRM", () => {
  it("1 contacto es REVIEW; 2 contactos es BLOCK", () => {
    const uno = evaluarReglas(crm({ campo_crm: "estado_pago", destinatarios: 1 }));
    expect(uno.piso).toBe("REVIEW");
    expect(uno.reglas.map((r) => r.regla)).toEqual(["campo_protegido_individual"]);
    const dos = evaluarReglas(crm({ campo_crm: "estado_pago", destinatarios: 2 }));
    expect(dos.piso).toBe("BLOCK");
    expect(dos.reglas.map((r) => r.regla)).toEqual(["campo_protegido_masivo"]);
  });

  it("un campo no protegido no activa nada", () => {
    expect(evaluarReglas(crm({ campo_crm: "notas", destinatarios: 50 })).piso).toBe("ALLOW");
  });
});

describe("etapa ganado (v2)", () => {
  it("ganado individual es REVIEW; masivo es BLOCK; otras etapas no activan nada", () => {
    expect(evaluarReglas(crm({ campo_crm: "etapa_crm", texto: "Ganado Pagado Completo" })).piso).toBe("REVIEW");
    expect(evaluarReglas(crm({ campo_crm: "etapa_crm", texto: "Ganado Pago Parcial", destinatarios: 40 })).piso).toBe("BLOCK");
    expect(evaluarReglas(crm({ campo_crm: "etapa_crm", texto: "Seguimiento", destinatarios: 40 })).piso).toBe("ALLOW");
  });
});

describe("fechas", () => {
  it("una fecha que no se puede leer activa fecha_inconsistente", () => {
    const r = evaluarReglas(correo({ fecha_evento_real: "2026-11-12", fecha_en_texto: "pronto" }));
    expect(r.reglas.map((x) => x.regla)).toEqual(["fecha_inconsistente"]);
    expect(r.reglas[0]?.detalle.legible).toBe(false);
  });

  it("un mes mal escrito no se puede leer", () => {
    expect(parseFechaEs("12 de noviembr")).toBeNull();
  });

  it("coincide aunque el texto traiga año o mayúsculas", () => {
    expect(nombres(correo({ fecha_evento_real: "2026-11-12", fecha_en_texto: "12 de Noviembre de 2026" }))).toEqual([]);
  });

  it("día o mes distinto activa la regla", () => {
    expect(nombres(correo({ fecha_evento_real: "2026-11-12", fecha_en_texto: "13 de noviembre" }))).toContain("fecha_inconsistente");
    expect(nombres(correo({ fecha_evento_real: "2026-11-12", fecha_en_texto: "12 de diciembre" }))).toContain("fecha_inconsistente");
  });

  it("sin una de las dos fechas no se evalúa", () => {
    expect(nombres(correo({ fecha_en_texto: "12 de noviembre" }))).toEqual([]);
    expect(nombres(correo({ fecha_evento_real: "2026-11-12" }))).toEqual([]);
  });

  it("parsea día y mes", () => {
    expect(parseFechaEs("  1 de diciembre")).toEqual([1, 12]);
    expect(parseFechaEs("12 de noviembre")).toEqual([12, 11]);
  });
});

describe("precio", () => {
  it("sin programa se compara con la sesión abierta (USD 99)", () => {
    expect(nombres(correo({ precio_en_texto_usd: 99 }))).toEqual([]);
    expect(nombres(correo({ precio_en_texto_usd: 149 }))).toEqual(["precio_inconsistente"]);
  });

  it("con programa en el catálogo se compara con su precio", () => {
    expect(nombres(correo({ programa_ofrecido: "AI for Executives", precio_en_texto_usd: 2000 }))).toEqual([]);
    expect(nombres(correo({ programa_ofrecido: "AI for Executives", precio_en_texto_usd: 1200 }))).toEqual(["precio_inconsistente"]);
  });

  it("un programa fuera del catálogo cae al precio de la sesión abierta", () => {
    expect(nombres(correo({ programa_ofrecido: "AI Sales", precio_en_texto_usd: 99 }))).toEqual([]);
  });

  it("un precio de 0 en un programa gratuito es válido; sin programa no", () => {
    expect(nombres(correo({ programa_ofrecido: "Free Sales Training", precio_en_texto_usd: 0 }))).toEqual([]);
    expect(nombres(correo({ precio_en_texto_usd: 0 }))).toEqual(["precio_inconsistente"]);
  });
});

describe("oferta sin afinidad (v2)", () => {
  it("se activa desde 0,5; no por debajo; no en programas gratuitos ni en redes", () => {
    const base = { programa_ofrecido: "AI Sales" };
    expect(nombres(correo({ ...base, audiencia_pct_afinidad_baja: 0.5 }))).toEqual(["oferta_sin_afinidad"]);
    expect(nombres(correo({ ...base, audiencia_pct_afinidad_baja: 0.499 }))).toEqual([]);
    expect(nombres(correo({ programa_ofrecido: "Free Sales Training", audiencia_pct_afinidad_baja: 1 }))).toEqual([]);
    expect(nombres(correo({ ...base, tipo_accion: "publicacion_redes", canal: "linkedin_oficial", destinatarios: 0, audiencia_pct_afinidad_baja: 1 }))).toEqual([]);
  });
});

describe("canal y lista de bajas", () => {
  it("canal no oficial es BLOCK", () => {
    expect(evaluarReglas(correo({ canal: "numero_personal_whatsapp" })).piso).toBe("BLOCK");
  });

  it("lista de bajas mayor que 0 es BLOCK; 0 no", () => {
    expect(evaluarReglas(correo({ en_lista_de_bajas: 3 })).piso).toBe("BLOCK");
    expect(evaluarReglas(correo({ en_lista_de_bajas: 0 })).piso).toBe("ALLOW");
  });
});

describe("combinación", () => {
  it("devuelve todas las reglas activadas y el piso es la más severa", () => {
    const r = evaluarReglas(correo({ canal: "gmail_personal", destinatarios: 9000, hora_envio: "22:00" }));
    expect(r.reglas.map((x) => x.regla).sort()).toEqual(["audiencia_grande", "canal_no_oficial", "fuera_de_horario"]);
    expect(r.piso).toBe("BLOCK");
  });
});
