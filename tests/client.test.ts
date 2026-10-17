import { describe, expect, it } from "vitest";
import { JevReal } from "@/lib/vobo/jev/client";
import { JevMock } from "@/lib/vobo/jev/mock";
import { PREGUNTAS } from "@/lib/vobo/jev/questions";
import { validarRespuesta } from "@/lib/vobo/jev/schema";
import { armarState } from "@/lib/vobo/jev/state";
import { JevError } from "@/lib/vobo/jev/types";
import type { AccionAgente } from "@/lib/vobo/types";

const LLAVE = "llave-de-prueba-123456";

const accion: AccionAgente = {
  tipo_accion: "correo_masivo",
  canal: "correo_oficial",
  destinatarios: 10,
  segmento_declarado: "founders",
  hora_envio: "10:00",
  texto: "Hola.",
};

const state = armarState(accion);

async function respuestaValida() {
  const { latencia_ms, llamadas, ...cruda } = await new JevMock().consultar(state, PREGUNTAS);
  void latencia_ms;
  void llamadas;
  return { ...cruda, model: "jev-1.14.0" };
}

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status });

function cliente(fetchImpl: typeof fetch, extra: Partial<ConstructorParameters<typeof JevReal>[0]> = {}) {
  return new JevReal({ apiKey: LLAVE, modelo: "jev-1.14.0", fetchImpl, esperasMs: [1, 1], ...extra });
}

describe("armarState", () => {
  it("marca el texto como no confiable y no incluye metadatos del código", () => {
    const s = JSON.stringify(armarState({ ...accion, destinatarios: 4321, hora_envio: "23:17", precio_en_texto_usd: 777 }));
    expect(s).toContain("contenido_no_confiable");
    for (const dato of ["4321", "23:17", "777", "founders"]) expect(s).not.toContain(dato);
  });
});

describe("JevReal", () => {
  it("manda el modelo, el state y las preguntas con la llave solo en Authorization", async () => {
    let visto: { url: string; init: RequestInit } | undefined;
    const c = cliente((async (url: string, init: RequestInit) => {
      visto = { url, init };
      return json(await respuestaValida());
    }) as unknown as typeof fetch);

    const r = await c.consultar(state, PREGUNTAS);
    expect(r.model).toBe("jev-1.14.0");
    expect(r.llamadas).toBe(1);
    expect(visto?.url).toBe("https://api.typesafe.ai/v1/systemone");
    expect((visto?.init.headers as Record<string, string>).Authorization).toBe(`Bearer ${LLAVE}`);
    const cuerpo = JSON.parse(String(visto?.init.body));
    expect(cuerpo.model).toBe("jev-1.14.0");
    expect(Object.keys(cuerpo.questions)).toEqual(Object.keys(PREGUNTAS));
    expect(String(visto?.init.body)).not.toContain(LLAVE);
  });

  it("reintenta en 429 y 529 y al final responde", async () => {
    const estados = [429, 529];
    let llamadas = 0;
    const c = cliente((async () => {
      const e = estados[llamadas++];
      return e ? json({}, e) : json(await respuestaValida());
    }) as unknown as typeof fetch);
    const r = await c.consultar(state, PREGUNTAS);
    expect(llamadas).toBe(3);
    expect(r.llamadas).toBe(3);
  });

  it("se rinde tras 2 reintentos", async () => {
    let llamadas = 0;
    const c = cliente((async () => {
      llamadas++;
      return json({}, 429);
    }) as unknown as typeof fetch);
    await expect(c.consultar(state, PREGUNTAS)).rejects.toMatchObject({ codigo: "http_429" });
    expect(llamadas).toBe(3);
  });

  it.each([400, 401, 413, 422, 500])("no reintenta el estado %i", async (estado) => {
    let llamadas = 0;
    const c = cliente((async () => {
      llamadas++;
      return json({}, estado);
    }) as unknown as typeof fetch);
    await expect(c.consultar(state, PREGUNTAS)).rejects.toMatchObject({ codigo: `http_${estado}` });
    expect(llamadas).toBe(1);
  });

  it("reintenta un error de red", async () => {
    let llamadas = 0;
    const c = cliente((async () => {
      if (llamadas++ === 0) throw new TypeError("fetch failed");
      return json(await respuestaValida());
    }) as unknown as typeof fetch);
    await c.consultar(state, PREGUNTAS);
    expect(llamadas).toBe(2);
  });

  it("corta por tiempo límite", async () => {
    const c = cliente(
      ((_u: string, init: RequestInit) =>
        new Promise((_res, rej) => {
          init.signal?.addEventListener("abort", () => rej(Object.assign(new Error("abort"), { name: "AbortError" })));
        })) as unknown as typeof fetch,
      { tiempoLimiteMs: 20, esperasMs: [] },
    );
    await expect(c.consultar(state, PREGUNTAS)).rejects.toMatchObject({ codigo: "tiempo_agotado" });
  });

  it("una respuesta que no es JSON o con otra forma es un fallo", async () => {
    const noJson = cliente((async () => new Response("<html>", { status: 200 })) as unknown as typeof fetch);
    await expect(noJson.consultar(state, PREGUNTAS)).rejects.toMatchObject({ codigo: "json_invalido" });
    const otraForma = cliente((async () => json({ model: "x", answers: {} })) as unknown as typeof fetch);
    await expect(otraForma.consultar(state, PREGUNTAS)).rejects.toBeInstanceOf(JevError);
  });

  it("los mensajes de error no contienen la llave", async () => {
    const c = cliente((async () => json({}, 401)) as unknown as typeof fetch);
    const e = await c.consultar(state, PREGUNTAS).catch((x: Error) => x);
    expect(String((e as Error).message)).not.toContain(LLAVE);
  });
});

describe("validarRespuesta", () => {
  it("acepta la salida del mock", async () => {
    const r = await respuestaValida();
    expect(() => validarRespuesta(r, PREGUNTAS)).not.toThrow();
  });

  it("falla si falta una pregunta", async () => {
    const r = await respuestaValida();
    delete (r.answers as Record<string, unknown>).tono;
    expect(() => validarRespuesta(r, PREGUNTAS)).toThrowError(/tono/);
  });

  it("falla con una opción desconocida o un tipo distinto", async () => {
    const r = await respuestaValida();
    (r.answers.promesa as { choice: string }).choice = "inventada";
    expect(() => validarRespuesta(r, PREGUNTAS)).toThrow();
    const r2 = await respuestaValida();
    r2.answers.certificacion = { type: "choice", choice: "x", probabilities: {}, confidence: 1 };
    expect(() => validarRespuesta(r2, PREGUNTAS)).toThrow();
  });
});
