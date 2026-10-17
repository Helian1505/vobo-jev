import { combinar, type Modo } from "./combine";
import { crearCliente, MODELO_POR_DEFECTO } from "./config";
import { explicar, type Explicacion } from "./explain";
import { interpretar, riesgoJev, type Senal } from "./jev/interpret";
import { PREGUNTAS } from "./jev/questions";
import { armarState } from "./jev/state";
import type { JevClient } from "./jev/types";
import { evaluarReglas, reversibilidadDe } from "./rules";
import { perfilDe, UMBRALES, type PerfilUmbral, type Umbrales } from "./thresholds";
import type { AccionAgente, Decision, ReglaActivada } from "./types";

/** USD por millón de tokens de entrada de JEV; la salida es gratis (CLAUDE.md §1.3). */
export const USD_POR_MILLON_TOKENS = 0.042;

export interface Evaluacion {
  decision: Decision; // max(piso, riesgo_jev) en modo combinado
  modo: Modo;
  piso_reglas: Decision;
  reglas: ReglaActivada[];
  riesgo_jev: Decision;
  senales_jev: Senal[];
  /** ok: JEV respondió; fallo: no se pudo consultar (riesgo REVIEW); omitido: no se llamó. */
  jev_estado: "ok" | "fallo" | "omitido";
  jev_error?: string;
  jev_simulado: boolean;
  perfil: PerfilUmbral;
  reversibilidad: string;
  explicacion: Explicacion;
  traza: {
    modelo: string;
    latencia_ms: number;
    input_tokens: number;
    costo_usd: number;
    llamadas: number;
    respuestas_crudas: unknown;
  };
}

export interface OpcionesEvaluacion {
  modo?: Modo;
  cliente?: JevClient;
  umbrales?: Umbrales;
  /** Si el piso ya es BLOCK, no llama a JEV. En el banco siempre se llama (para medir solo_jev). */
  omitirSiBloqueo?: boolean;
}

/**
 * Orquesta las tres capas. Un fallo de JEV nunca resulta en ALLOW: el riesgo según JEV pasa a
 * REVIEW y la explicación lo dice.
 */
export async function evaluateAction(accion: AccionAgente, opciones: OpcionesEvaluacion = {}): Promise<Evaluacion> {
  const modo = opciones.modo ?? "combinado";
  const umbrales = opciones.umbrales ?? UMBRALES;

  const { piso, reglas } = evaluarReglas(accion);
  const reversibilidad = reversibilidadDe(accion.tipo_accion);
  const perfil = perfilDe(reversibilidad);

  const omitir = modo === "solo_reglas" || (opciones.omitirSiBloqueo === true && modo === "combinado" && piso === "BLOCK");

  let jev_estado: Evaluacion["jev_estado"] = "omitido";
  let jev_error: string | undefined;
  let senales: Senal[] = [];
  let riesgo: Decision = "ALLOW";
  let simulado = false;
  let traza: Evaluacion["traza"] = {
    modelo: omitir ? "—" : MODELO_POR_DEFECTO,
    latencia_ms: 0,
    input_tokens: 0,
    costo_usd: 0,
    llamadas: 0,
    respuestas_crudas: null,
  };

  if (!omitir) {
    const inicio = Date.now();
    try {
      const cliente = opciones.cliente ?? crearCliente();
      simulado = cliente.nombre === "mock";
      const res = await cliente.consultar(armarState(accion), PREGUNTAS);
      senales = interpretar(res, accion.segmento_declarado, umbrales.perfiles[perfil]);
      riesgo = riesgoJev(senales);
      jev_estado = "ok";
      traza = {
        modelo: res.model,
        latencia_ms: res.latencia_ms,
        input_tokens: res.usage.input_tokens,
        costo_usd: (res.usage.input_tokens * USD_POR_MILLON_TOKENS) / 1_000_000,
        llamadas: res.llamadas,
        respuestas_crudas: res.answers,
      };
    } catch (e) {
      jev_estado = "fallo";
      riesgo = "REVIEW"; // nunca ALLOW ante un fallo
      jev_error = e instanceof Error && "codigo" in e ? String((e as { codigo: unknown }).codigo) : "desconocido";
      traza = { ...traza, latencia_ms: Date.now() - inicio, llamadas: 1 };
    }
  }

  const decision = combinar(piso, riesgo, modo);
  const explicacion = explicar({
    decision,
    reglas: modo === "solo_jev" ? [] : reglas,
    senales,
    jevFallo: jev_estado === "fallo",
  });

  return {
    decision,
    modo,
    piso_reglas: piso,
    reglas,
    riesgo_jev: riesgo,
    senales_jev: senales,
    jev_estado,
    ...(jev_error ? { jev_error } : {}),
    jev_simulado: simulado,
    perfil,
    reversibilidad,
    explicacion,
    traza,
  };
}
