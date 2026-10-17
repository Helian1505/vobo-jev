import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as postAbierta } from "@/app/api/evaluate/route";
import { POST as postV1 } from "@/app/api/v1/evaluate/route";
import { claveCoincide, exigirClave, tokenBearer } from "@/lib/vobo/clave-api";

const CLAVE = "clave-de-prueba-0123456789abcdef";

const valida = {
  tipo_accion: "correo_masivo",
  canal: "correo_oficial",
  destinatarios: 800,
  segmento_declarado: "comunidad_general",
  hora_envio: "10:00",
  texto: "Te invitamos a la clase abierta del jueves.",
};

let n = 0;
const peticion = (cuerpo: unknown, cabeceras: Record<string, string> = {}, ip = `10.5.0.${++n}`) =>
  new Request("http://localhost/api/v1/evaluate", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip, ...cabeceras },
    body: JSON.stringify(cuerpo),
  });
const conClave = (clave = CLAVE) => ({ authorization: `Bearer ${clave}` });

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/v1/evaluate (con clave)", () => {
  it("sin VOBO_API_KEY configurada responde 503 y nunca queda abierta", async () => {
    vi.stubEnv("VOBO_JEV_MODE", "mock");
    vi.stubEnv("VOBO_API_KEY", "");
    for (const cabeceras of [{}, conClave(), conClave("")]) {
      const res = await postV1(peticion(valida, cabeceras));
      expect(res.status).toBe(503);
      expect((await res.json()).error).toContain("VOBO_API_KEY");
    }
  });

  it("una clave demasiado corta tampoco abre la ruta", async () => {
    vi.stubEnv("VOBO_JEV_MODE", "mock");
    vi.stubEnv("VOBO_API_KEY", "corta");
    expect((await postV1(peticion(valida, conClave("corta")))).status).toBe(503);
  });

  it("sin cabecera, con otro esquema o con clave incorrecta responde 401 con WWW-Authenticate", async () => {
    vi.stubEnv("VOBO_JEV_MODE", "mock");
    vi.stubEnv("VOBO_API_KEY", CLAVE);
    const malas: Record<string, string>[] = [
      {},
      { authorization: "Basic " + btoa("a:b") },
      { authorization: "Bearer" },
      { authorization: "Bearer clave-incorrecta-0123456789abcdef" },
      { authorization: CLAVE }, // sin la palabra Bearer
      { authorization: `Bearer ${CLAVE}x` }, // casi igual
    ];
    for (const cabeceras of malas) {
      const res = await postV1(peticion(valida, cabeceras));
      expect(res.status, JSON.stringify(cabeceras)).toBe(401);
      expect(res.headers.get("www-authenticate")).toContain("Bearer");
      expect(JSON.stringify(await res.json())).not.toContain(CLAVE);
    }
  });

  it("con la clave correcta responde 200 con el mismo contrato de /api/evaluate", async () => {
    vi.stubEnv("VOBO_JEV_MODE", "mock");
    vi.stubEnv("VOBO_API_KEY", CLAVE);
    const res = await postV1(peticion(valida, conClave()));
    expect(res.status).toBe(200);
    const e = await res.json();
    expect(e.schema_version).toBe("1");
    expect(res.headers.get("x-request-id")).toBe(e.request_id);
    for (const campo of ["decision", "piso_reglas", "reglas", "senales_jev", "explicacion", "traza", "resumen_aprobacion", "registro"]) {
      expect(e, campo).toHaveProperty(campo);
    }
    // y es la misma evaluación que la ruta abierta
    const abierta = await (await postAbierta(peticion(valida))).json();
    expect(e.decision).toBe(abierta.decision);
    expect(e.registro.reglas).toBe(abierta.registro.reglas);
  });

  it("valida la acción igual que la ruta abierta (400) solo después de autenticar", async () => {
    vi.stubEnv("VOBO_JEV_MODE", "mock");
    vi.stubEnv("VOBO_API_KEY", CLAVE);
    expect((await postV1(peticion({ ...valida, tipo_accion: "otra" }, conClave()))).status).toBe(400);
    // sin clave ni siquiera se llega a validar: no se filtra nada sobre el formato
    expect((await postV1(peticion({ ...valida, tipo_accion: "otra" }))).status).toBe(401);
  });

  it("frena los intentos con claves inválidas (429) sin bloquear a quien tiene la clave", async () => {
    vi.stubEnv("VOBO_JEV_MODE", "mock");
    vi.stubEnv("VOBO_API_KEY", CLAVE);
    const ip = "10.77.0.1";
    const estados: number[] = [];
    for (let i = 0; i < 12; i++) estados.push((await postV1(peticion(valida, conClave("mala-" + i), ip))).status);
    expect(estados.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(estados.slice(10)).toEqual([429, 429]);
    // la clave correcta desde la misma IP sigue pasando
    expect((await postV1(peticion(valida, conClave(), ip))).status).toBe(200);
  });

  it("la ruta abierta de la demo sigue sin pedir clave, aunque exista VOBO_API_KEY", async () => {
    vi.stubEnv("VOBO_JEV_MODE", "mock");
    vi.stubEnv("VOBO_API_KEY", CLAVE);
    expect((await postAbierta(peticion(valida))).status).toBe(200);
  });
});

describe("clave-api", () => {
  it("claveCoincide compara en tiempo constante y rechaza lo distinto, incluso de otro largo", () => {
    expect(claveCoincide(CLAVE, CLAVE)).toBe(true);
    expect(claveCoincide(CLAVE, CLAVE + "x")).toBe(false);
    expect(claveCoincide("", CLAVE)).toBe(false);
    expect(claveCoincide("a".repeat(5000), CLAVE)).toBe(false);
  });

  it("tokenBearer extrae el token y tolera mayúsculas y espacios", () => {
    const r = (h?: string) => new Request("http://x", { headers: h ? { authorization: h } : {} });
    expect(tokenBearer(r(`Bearer ${CLAVE}`))).toBe(CLAVE);
    expect(tokenBearer(r(`bearer   ${CLAVE}  `))).toBe(CLAVE);
    expect(tokenBearer(r("Bearer"))).toBeNull();
    expect(tokenBearer(r("Bearer a b"))).toBeNull();
    expect(tokenBearer(r())).toBeNull();
  });

  it("exigirClave devuelve null con una clave válida y respuestas sin la clave en los errores", async () => {
    const env = { VOBO_API_KEY: CLAVE };
    expect(exigirClave(peticion({}, conClave()), env)).toBeNull();
    const r401 = exigirClave(peticion({}, conClave("otra-clave-0123456789abcdef")), env);
    expect(r401?.status).toBe(401);
    expect(JSON.stringify(await r401?.json())).not.toContain(CLAVE);
    expect(exigirClave(peticion({}), {})?.status).toBe(503);
  });
});
