import { JevReal } from "./jev/client";
import { JevMock } from "./jev/mock";
import { JevError, type JevClient } from "./jev/types";

export const MODELO_POR_DEFECTO = "jev-1.14.0";

export interface EstadoJev {
  /** mock o live, según VOBO_JEV_MODE (sin definir = mock). */
  modo: "mock" | "live";
  /** En live, si hay llave. Nunca se expone la llave. */
  configurado: boolean;
  modelo: string;
}

export function estadoJev(env: Record<string, string | undefined> = process.env): EstadoJev {
  const modo = env.VOBO_JEV_MODE === "live" ? "live" : "mock";
  return {
    modo,
    configurado: modo === "mock" || Boolean(env.TYPESAFE_API_KEY),
    modelo: env.JEV_MODEL || MODELO_POR_DEFECTO,
  };
}

/** Si el modo es live y falta la llave, falla con un error claro (en la UI: banner JEV real no configurado). */
export function crearCliente(env: Record<string, string | undefined> = process.env): JevClient {
  const estado = estadoJev(env);
  if (estado.modo === "mock") return new JevMock();
  if (!estado.configurado) {
    throw new JevError("no_configurado", "JEV real no configurado: falta TYPESAFE_API_KEY.");
  }
  return new JevReal({ apiKey: env.TYPESAFE_API_KEY as string, modelo: estado.modelo });
}
