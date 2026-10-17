import { combinar, type Modo } from "../combine";
import { interpretar, riesgoJev, type Senal } from "../jev/interpret";
import { JevError, type JevClient, type JevRespuesta, type JevResultado } from "../jev/types";
import type { UmbralesPerfil } from "../thresholds";
import type { Decision } from "../types";

/** Una fila de una corrida: la respuesta cruda de JEV (o el error) más lo medido. */
export interface FilaCorrida {
  id: string;
  respuesta: JevRespuesta | null;
  error: string | null;
  latencia_ms: number;
  llamadas: number;
}

/**
 * Cliente que reproduce una respuesta ya grabada, sin llamar a JEV. Permite recalcular decisiones
 * con otros umbrales usando exactamente el mismo camino de código que evaluateAction.
 */
export class ClienteGrabado implements JevClient {
  readonly nombre = "live" as const;

  constructor(private readonly fila: FilaCorrida) {}

  async consultar(): Promise<JevResultado> {
    if (!this.fila.respuesta) {
      throw new JevError(this.fila.error ?? "sin_respuesta", "La corrida grabada no tiene respuesta para esta fila.");
    }
    return { ...this.fila.respuesta, latencia_ms: this.fila.latencia_ms, llamadas: this.fila.llamadas };
  }
}

export interface DecisionesFila {
  senales: Senal[];
  riesgo_jev: Decision;
  combinado: Decision;
  solo_reglas: Decision;
  solo_jev: Decision;
}

/**
 * Camino rápido para el ajuste de umbrales: mismas reglas de interpretación que evaluateAction
 * (tests/eval.test.ts comprueba que dan lo mismo), sin async ni explicaciones.
 * Un fallo de JEV es REVIEW, nunca ALLOW.
 */
export function decidirConCache(
  piso: Decision,
  segmentoDeclarado: string,
  fila: FilaCorrida,
  umbrales: UmbralesPerfil,
): DecisionesFila {
  let senales: Senal[] = [];
  let riesgo: Decision = "REVIEW";
  if (fila.respuesta) {
    senales = interpretar(fila.respuesta, segmentoDeclarado, umbrales);
    riesgo = riesgoJev(senales);
  }
  const m = (modo: Modo) => combinar(piso, riesgo, modo);
  return { senales, riesgo_jev: riesgo, combinado: m("combinado"), solo_reglas: m("solo_reglas"), solo_jev: m("solo_jev") };
}
