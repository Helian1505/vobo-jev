import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/evaluate/route";
import { debeNotificar, enviarWebhook, urlWebhook, type CargaWebhook } from "@/lib/vobo/webhook";

const URL_HOOK = "https://hooks.ejemplo.test/vobo";

const limpia = {
  tipo_accion: "correo_masivo",
  canal: "correo_oficial",
  destinatarios: 800,
  segmento_declarado: "comunidad_general",
  hora_envio: "10:00",
  texto: "Te invitamos a la clase abierta del jueves.",
};
const bloqueada = { ...limpia, id: "ACC-77", canal: "numero_personal_whatsapp" }; // canal no oficial → BLOQUEAR
const aRevisar = { ...limpia, destinatarios: 9000 }; // audiencia grande → PEDIR VOBO

let n = 0;
const pedir = (cuerpo: unknown) =>
  POST(
    new Request("http://localhost/api/evaluate", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `10.9.0.${++n}` },
      body: JSON.stringify(cuerpo),
    }),
  );

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("urlWebhook", () => {
  it("sin la variable, vacía o inválida, el webhook está apagado", () => {
    expect(urlWebhook({})).toBeNull();
    expect(urlWebhook({ VOBO_REVIEW_WEBHOOK_URL: "  " })).toBeNull();
    expect(urlWebhook({ VOBO_REVIEW_WEBHOOK_URL: "no es una url" })).toBeNull();
    expect(urlWebhook({ VOBO_REVIEW_WEBHOOK_URL: "file:///etc/passwd" })).toBeNull();
    expect(urlWebhook({ VOBO_REVIEW_WEBHOOK_URL: "javascript:alert(1)" })).toBeNull();
  });
  it("acepta http y https", () => {
    expect(urlWebhook({ VOBO_REVIEW_WEBHOOK_URL: URL_HOOK })).toBe(URL_HOOK);
    expect(urlWebhook({ VOBO_REVIEW_WEBHOOK_URL: "http://localhost:9000/h" })).toBe("http://localhost:9000/h");
  });
  it("solo avisa en PEDIR VOBO y BLOQUEAR", () => {
    expect(debeNotificar("ALLOW")).toBe(false);
    expect(debeNotificar("REVIEW")).toBe(true);
    expect(debeNotificar("BLOCK")).toBe(true);
  });
});

describe("enviarWebhook (fetch simulado)", () => {
  const carga: CargaWebhook = {
    request_id: "11111111-1111-4111-8111-111111111111",
    decision: "BLOCK",
    tipo_accion: "correo_masivo",
    id: null,
    explicacion: { titular: "BLOQUEAR: x", razones: ["x"] },
    reglas: [],
  };

  it("hace un POST JSON con la carga y el request_id en un encabezado", async () => {
    const fetchSim = vi.fn(async () => new Response("ok", { status: 200 }));
    const r = await enviarWebhook({ url: URL_HOOK, carga, fetchImpl: fetchSim as unknown as typeof fetch });
    expect(r).toEqual({ enviado: true, estado: 200 });
    const [url, init] = fetchSim.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(URL_HOOK);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual(carga);
    expect((init.headers as Record<string, string>)["x-vobo-request-id"]).toBe(carga.request_id);
  });

  it("nunca lanza: un 500, un error de red y un tiempo agotado devuelven el motivo", async () => {
    const http = await enviarWebhook({ url: URL_HOOK, carga, fetchImpl: (async () => new Response("", { status: 500 })) as unknown as typeof fetch });
    expect(http).toEqual({ enviado: false, estado: 500, error: "http" });

    const red = await enviarWebhook({ url: URL_HOOK, carga, fetchImpl: (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch });
    expect(red).toEqual({ enviado: false, error: "red" });

    const lento = ((_u: string, init: RequestInit) =>
      new Promise((_res, rej) => init.signal?.addEventListener("abort", () => rej(Object.assign(new Error("abort"), { name: "AbortError" }))))) as unknown as typeof fetch;
    const inicio = Date.now();
    const timeout = await enviarWebhook({ url: URL_HOOK, carga, fetchImpl: lento, tiempoLimiteMs: 30 });
    expect(timeout).toEqual({ enviado: false, error: "timeout" });
    expect(Date.now() - inicio).toBeLessThan(1000);
  });
});

describe("POST /api/evaluate con el webhook", () => {
  it("sin VOBO_REVIEW_WEBHOOK_URL no llama a nadie", async () => {
    vi.stubEnv("VOBO_JEV_MODE", "mock");
    vi.stubEnv("VOBO_REVIEW_WEBHOOK_URL", "");
    const fetchSim = vi.fn();
    vi.stubGlobal("fetch", fetchSim);
    const res = await pedir(bloqueada);
    expect(res.status).toBe(200);
    expect((await res.json()).decision).toBe("BLOCK");
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchSim).not.toHaveBeenCalled();
  });

  it("una acción BLOQUEADA envía la carga con request_id, decision, tipo_accion, id, explicacion y reglas", async () => {
    vi.stubEnv("VOBO_JEV_MODE", "mock");
    vi.stubEnv("VOBO_REVIEW_WEBHOOK_URL", URL_HOOK);
    const fetchSim = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchSim);

    const res = await pedir(bloqueada);
    const cuerpo = await res.json();
    await vi.waitFor(() => expect(fetchSim).toHaveBeenCalledTimes(1));

    const [url, init] = fetchSim.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(URL_HOOK);
    const carga = JSON.parse(String(init.body));
    expect(Object.keys(carga).sort()).toEqual(["decision", "explicacion", "id", "reglas", "request_id", "tipo_accion"]);
    expect(carga).toMatchObject({ request_id: cuerpo.request_id, decision: "BLOCK", tipo_accion: "correo_masivo", id: "ACC-77" });
    expect(carga.reglas.map((r: { regla: string }) => r.regla)).toContain("canal_no_oficial");
    expect(carga.explicacion.titular).toContain("BLOQUEAR");
  });

  it("una acción en PEDIR VOBO también avisa; una PERMITIDA no", async () => {
    vi.stubEnv("VOBO_JEV_MODE", "mock");
    vi.stubEnv("VOBO_REVIEW_WEBHOOK_URL", URL_HOOK);
    const fetchSim = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchSim);

    expect((await (await pedir(aRevisar)).json()).decision).toBe("REVIEW");
    await vi.waitFor(() => expect(fetchSim).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String((fetchSim.mock.calls[0] as unknown as [string, RequestInit])[1].body)).decision).toBe("REVIEW");

    expect((await (await pedir(limpia)).json()).decision).toBe("ALLOW");
    await new Promise((r) => setTimeout(r, 30));
    expect(fetchSim).toHaveBeenCalledTimes(1);
  });

  it("si el webhook falla o se cuelga, la respuesta es la misma y no se demora", async () => {
    vi.stubEnv("VOBO_JEV_MODE", "mock");
    vi.stubEnv("VOBO_REVIEW_WEBHOOK_URL", URL_HOOK);
    vi.spyOn(console, "warn").mockImplementation(() => {});

    // referencia: sin webhook
    vi.stubEnv("VOBO_REVIEW_WEBHOOK_URL", "");
    const base = await (await pedir(bloqueada)).json();

    for (const falla of [
      async () => { throw new TypeError("fetch failed"); },
      async () => new Response("", { status: 503 }),
      () => new Promise(() => {}), // nunca responde
    ]) {
      vi.stubEnv("VOBO_REVIEW_WEBHOOK_URL", URL_HOOK);
      vi.stubGlobal("fetch", vi.fn(falla));
      const inicio = Date.now();
      const res = await pedir(bloqueada);
      const cuerpo = await res.json();
      expect(Date.now() - inicio).toBeLessThan(1000);
      expect(res.status).toBe(200);
      // lo que cambia en cada solicitud (id, hora, trazas y el texto que lleva el id) no cuenta
      const sinVolatiles = (r: Record<string, any>) => {
        const { request_id: _i, traza, resumen_aprobacion: _r, registro, ...resto } = r;
        const { request_id: _j, timestamp: _t, ...registroEstable } = registro;
        return { resto, registroEstable, modelo: traza.modelo };
      };
      expect(sinVolatiles(cuerpo)).toEqual(sinVolatiles(base));
    }
  });
});
