import { validarRespuesta } from "./schema";
import { JevError, type JevClient, type JevResultado, type JevState, type Preguntas } from "./types";

const URL_JEV = "https://api.typesafe.ai/v1/systemone";
const TIEMPO_LIMITE_MS = 3000;
const ESPERAS_MS = [300, 900]; // hasta 2 reintentos, con variación aleatoria
const REINTENTABLES = new Set([429, 529]);

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
const conVariacion = (ms: number) => Math.round(ms * (0.75 + Math.random() * 0.5));

export interface OpcionesClienteReal {
  apiKey: string;
  modelo: string;
  fetchImpl?: typeof fetch;
  tiempoLimiteMs?: number;
  esperasMs?: number[];
}

/**
 * Cliente real de JEV por REST (CLAUDE.md §6.1 y §6.6). Tiempo límite de 3 s por llamada y hasta 2
 * reintentos en 429, 529 o error de red. Cualquier otro fallo lanza JevError; el llamador lo
 * convierte en REVIEW. La llave solo sale en el encabezado Authorization y nunca en un mensaje.
 */
export class JevReal implements JevClient {
  readonly nombre = "live" as const;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly op: OpcionesClienteReal) {
    this.fetchImpl = op.fetchImpl ?? fetch;
  }

  async consultar(state: JevState, preguntas: Preguntas): Promise<JevResultado> {
    const esperas = this.op.esperasMs ?? ESPERAS_MS;
    const inicio = Date.now();
    let intentos = 0;
    let ultimo: JevError | undefined;

    for (let i = 0; i <= esperas.length; i++) {
      intentos++;
      try {
        const cruda = await this.llamar(state, preguntas);
        const respuesta = validarRespuesta(cruda, preguntas);
        return { ...respuesta, latencia_ms: Date.now() - inicio, llamadas: intentos };
      } catch (e) {
        ultimo = e instanceof JevError ? e : new JevError("red", "No se pudo conectar con JEV.", true);
        if (!ultimo.reintentable || i === esperas.length) break;
        await dormir(conVariacion(esperas[i] as number));
      }
    }
    throw ultimo ?? new JevError("desconocido", "Falló la consulta a JEV.");
  }

  private async llamar(state: JevState, preguntas: Preguntas): Promise<unknown> {
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), this.op.tiempoLimiteMs ?? TIEMPO_LIMITE_MS);
    let res: Response;
    try {
      res = await this.fetchImpl(URL_JEV, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.op.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.op.modelo, state, questions: preguntas }),
        signal: control.signal,
      });
    } catch (e) {
      const agotado = e instanceof Error && e.name === "AbortError";
      throw new JevError(agotado ? "tiempo_agotado" : "red", agotado ? "JEV no respondió a tiempo." : "No se pudo conectar con JEV.", true);
    } finally {
      clearTimeout(reloj);
    }

    if (!res.ok) {
      throw new JevError(`http_${res.status}`, `JEV respondió con el estado ${res.status}.`, REINTENTABLES.has(res.status));
    }
    try {
      return await res.json();
    } catch {
      throw new JevError("json_invalido", "JEV devolvió una respuesta que no es JSON.");
    }
  }
}
