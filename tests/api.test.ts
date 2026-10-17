import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/evaluate/route";
import { estadoJev, crearCliente, tiempoLimiteMs } from "@/lib/vobo/config";
import { LimitadorVentana } from "@/lib/vobo/rate-limit";

const valida = {
  tipo_accion: "correo_masivo",
  canal: "correo_oficial",
  destinatarios: 800,
  segmento_declarado: "founders",
  hora_envio: "10:00",
  texto: "Te invitamos a conocer el programa.",
};

let n = 0;
const pedir = (cuerpo: unknown, ip = `10.0.0.${++n}`) =>
  POST(
    new Request("http://localhost/api/evaluate", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
    }),
  );

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/evaluate", () => {
  it("evalúa una acción válida (modo mock por defecto)", async () => {
    vi.stubEnv("VOBO_JEV_MODE", "mock");
    const res = await pedir(valida);
    expect(res.status).toBe(200);
    const e = await res.json();
    expect(e.decision).toBe("ALLOW");
    expect(e.jev_simulado).toBe(true);
    expect(e.explicacion.titular).toContain("PERMITIR");
  });

  it("incluye schema_version y request_id (uuid) sin quitar ningún campo existente", async () => {
    vi.stubEnv("VOBO_JEV_MODE", "mock");
    const res = await pedir(valida);
    const e = await res.json();
    expect(e.schema_version).toBe("1");
    expect(e.request_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(res.headers.get("x-request-id")).toBe(e.request_id);
    // los campos de siempre siguen ahí
    for (const campo of ["decision", "modo", "piso_reglas", "reglas", "riesgo_jev", "senales_jev", "jev_estado", "jev_simulado", "perfil", "reversibilidad", "explicacion", "traza"]) {
      expect(e, campo).toHaveProperty(campo);
    }
    expect(e.explicacion).toHaveProperty("titular");
    expect(e.traza).toHaveProperty("costo_usd");
  });

  it("agrega resumen_aprobacion y registro, y el registro es plano y coherente con la decisión", async () => {
    vi.stubEnv("VOBO_JEV_MODE", "mock");
    const e = await (await pedir({ ...valida, id: "ACC-9", destinatarios: 9000 })).json();
    expect(typeof e.resumen_aprobacion).toBe("string");
    expect(e.resumen_aprobacion).toContain("correo masivo a 9.000 destinatarios");
    expect(e.resumen_aprobacion).toContain("id ACC-9");
    expect(e.registro).toMatchObject({
      request_id: e.request_id,
      decision: e.decision,
      piso_reglas: e.piso_reglas,
      riesgo_jev: e.riesgo_jev,
      modelo: e.traza.modelo,
      jev_estado: e.jev_estado,
      id_accion: "ACC-9",
    });
    expect(e.registro.reglas).toBe(e.reglas.map((r: { regla: string }) => r.regla).join(","));
    expect(Date.parse(e.registro.timestamp)).not.toBeNaN();
    for (const v of Object.values(e.registro)) expect(typeof v === "object" && v !== null).toBe(false);
  });

  it("sigue siendo schema_version 1: solo se agregaron campos, no se quitó ninguno", async () => {
    vi.stubEnv("VOBO_JEV_MODE", "mock");
    const e = await (await pedir(valida)).json();
    expect(e.schema_version).toBe("1");
    expect(Object.keys(e)).toEqual(expect.arrayContaining(["schema_version", "request_id", "decision", "modo", "piso_reglas", "reglas", "riesgo_jev", "senales_jev", "jev_estado", "jev_simulado", "perfil", "reversibilidad", "explicacion", "traza"]));
  });

  it("cada solicitud tiene un request_id distinto", async () => {
    vi.stubEnv("VOBO_JEV_MODE", "mock");
    const a = await (await pedir(valida)).json();
    const b = await (await pedir(valida)).json();
    expect(a.request_id).not.toBe(b.request_id);
  });

  it("los errores no llevan schema_version (solo las respuestas 200)", async () => {
    const e = await (await pedir({ ...valida, tipo_accion: "otra" })).json();
    expect(e).not.toHaveProperty("schema_version");
  });

  it("acepta celdas vacías como ausentes", async () => {
    const res = await pedir({ ...valida, campo_crm: "", fecha_en_texto: "", precio_en_texto_usd: null });
    expect(res.status).toBe(200);
  });

  it("rechaza JSON roto, campos inválidos y textos de más de 2.000 caracteres", async () => {
    expect((await pedir("{no es json")).status).toBe(400);
    expect((await pedir({ ...valida, tipo_accion: "otra" })).status).toBe(400);
    expect((await pedir({ ...valida, hora_envio: "25:00" })).status).toBe(400);
    const largo = await pedir({ ...valida, texto: "a".repeat(2001) });
    expect(largo.status).toBe(400);
    expect((await largo.json()).detalles.join(" ")).toContain("2000");
    expect((await pedir({ ...valida, texto: "a".repeat(2000) })).status).toBe(200);
  });

  it("ignora la afinidad del cliente y la calcula desde la audiencia", async () => {
    vi.stubEnv("VOBO_JEV_MODE", "mock");
    const oferta = { ...valida, programa_ofrecido: "AI Sales", destinatarios: 1711, audiencia_id: "A3", segmento_declarado: "comunidad_general" };
    // A3 (leads sin programa sugerido) tiene 100% de afinidad baja: aunque el cliente diga 0, se activa la regla.
    const mentira = await (await pedir({ ...oferta, audiencia_pct_afinidad_baja: 0 })).json();
    expect(mentira.reglas.map((r: { regla: string }) => r.regla)).toContain("oferta_sin_afinidad");
    // Sin audiencia_id no hay afinidad que calcular, aunque el cliente la mande.
    const sin = { ...oferta, audiencia_id: undefined, audiencia_pct_afinidad_baja: 1 };
    const r = await (await pedir(sin)).json();
    expect(r.reglas.map((x: { regla: string }) => x.regla)).not.toContain("oferta_sin_afinidad");
  });

  it("limita a 20 solicitudes por minuto por IP", async () => {
    const ip = "192.168.9.9";
    for (let i = 0; i < 20; i++) expect((await pedir(valida, ip)).status).toBe(200);
    expect((await pedir(valida, ip)).status).toBe(429);
    expect((await pedir(valida, "192.168.9.10")).status).toBe(200);
  });

  it("en modo live sin llave responde 503 claro y no evalúa", async () => {
    vi.stubEnv("VOBO_JEV_MODE", "live");
    vi.stubEnv("TYPESAFE_API_KEY", "");
    const res = await pedir(valida);
    expect(res.status).toBe(503);
    expect((await res.json()).error).toContain("JEV real no configurado");
  });
});

describe("estado de JEV", () => {
  it("GET informa el modo sin exponer la llave", async () => {
    vi.stubEnv("VOBO_JEV_MODE", "live");
    vi.stubEnv("TYPESAFE_API_KEY", "secreta-123");
    const cuerpo = await GET().json();
    expect(cuerpo).toEqual({ modo: "live", configurado: true, modelo: "jev-1.14.0" });
    expect(JSON.stringify(cuerpo)).not.toContain("secreta");
  });

  it("sin VOBO_JEV_MODE el modo es mock y no pide llave", () => {
    expect(estadoJev({})).toEqual({ modo: "mock", configurado: true, modelo: "jev-1.14.0" });
    expect(crearCliente({}).nombre).toBe("mock");
  });

  it("en live sin llave crearCliente falla con un error claro", () => {
    expect(() => crearCliente({ VOBO_JEV_MODE: "live" })).toThrowError(/falta TYPESAFE_API_KEY/);
    expect(crearCliente({ VOBO_JEV_MODE: "live", TYPESAFE_API_KEY: "k" }).nombre).toBe("live");
  });

  it("JEV_MODEL cambia el modelo", () => {
    expect(estadoJev({ JEV_MODEL: "jev-1.15.0" }).modelo).toBe("jev-1.15.0");
  });
});

describe("tiempo límite (JEV_TIMEOUT_MS)", () => {
  it("por defecto son 3 s", () => {
    expect(tiempoLimiteMs({})).toBe(3000);
  });
  it("acepta un entero entre 500 y 30000", () => {
    expect(tiempoLimiteMs({ JEV_TIMEOUT_MS: "8000" })).toBe(8000);
    expect(tiempoLimiteMs({ JEV_TIMEOUT_MS: "500" })).toBe(500);
    expect(tiempoLimiteMs({ JEV_TIMEOUT_MS: "30000" })).toBe(30000);
  });
  it("un valor inválido vuelve al valor por defecto", () => {
    for (const malo of ["", "abc", "0", "499", "30001", "-5", "2.5"]) {
      expect(tiempoLimiteMs({ JEV_TIMEOUT_MS: malo })).toBe(3000);
    }
  });
});

describe("LimitadorVentana", () => {
  it("la ventana se desliza", () => {
    const l = new LimitadorVentana(2, 1000);
    expect(l.permitir("a", 0)).toBe(true);
    expect(l.permitir("a", 100)).toBe(true);
    expect(l.permitir("a", 200)).toBe(false);
    expect(l.permitir("a", 1101)).toBe(true);
  });
});
