import type { Evaluacion } from "./evaluate";
import type { AccionAgente, Decision, ReglaActivada } from "./types";

/** Tiempo límite del aviso. Pasado este tiempo se abandona: el aviso nunca debe afectar a la respuesta. */
export const TIEMPO_LIMITE_WEBHOOK_MS = 2000;

/** Lo que recibe el webhook (POST JSON) cuando una acción queda en PEDIR VOBO o BLOQUEAR. */
export interface CargaWebhook {
  request_id: string;
  decision: Decision;
  tipo_accion: AccionAgente["tipo_accion"];
  /** El id que mandó el agente en la acción, si lo mandó. */
  id: string | null;
  explicacion: Evaluacion["explicacion"];
  reglas: ReglaActivada[];
}

export interface ResultadoWebhook {
  enviado: boolean;
  estado?: number;
  error?: "timeout" | "red" | "http";
}

/** Solo se avisa cuando una persona tiene algo que mirar: PEDIR VOBO o BLOQUEAR. */
export function debeNotificar(decision: Decision): boolean {
  return decision === "REVIEW" || decision === "BLOCK";
}

/** VOBO_REVIEW_WEBHOOK_URL válida (http o https); cualquier otra cosa, o sin definir, apaga el webhook. */
export function urlWebhook(env: Record<string, string | undefined> = process.env): string | null {
  const crudo = env.VOBO_REVIEW_WEBHOOK_URL?.trim();
  if (!crudo) return null;
  try {
    const u = new URL(crudo);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function construirCarga(request_id: string, accion: AccionAgente, ev: Evaluacion): CargaWebhook {
  return {
    request_id,
    decision: ev.decision,
    tipo_accion: accion.tipo_accion,
    id: accion.id ?? null,
    explicacion: ev.explicacion,
    reglas: ev.reglas,
  };
}

/**
 * Envía el aviso. NUNCA lanza una excepción ni se reintenta: si falla, devuelve el motivo y listo.
 * No registra la URL (puede llevar un secreto en la ruta).
 */
export async function enviarWebhook(args: {
  url: string;
  carga: CargaWebhook;
  fetchImpl?: typeof fetch;
  tiempoLimiteMs?: number;
}): Promise<ResultadoWebhook> {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), args.tiempoLimiteMs ?? TIEMPO_LIMITE_WEBHOOK_MS);
  try {
    const res = await (args.fetchImpl ?? fetch)(args.url, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "vobo-webhook/1", "x-vobo-request-id": args.carga.request_id },
      body: JSON.stringify(args.carga),
      signal: control.signal,
    });
    return res.ok ? { enviado: true, estado: res.status } : { enviado: false, estado: res.status, error: "http" };
  } catch (e) {
    return { enviado: false, error: e instanceof Error && e.name === "AbortError" ? "timeout" : "red" };
  } finally {
    clearTimeout(reloj);
  }
}
