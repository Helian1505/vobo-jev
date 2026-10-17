import { accionDesdeFila, type FilaBanco } from "../banco";
import { evaluateAction, type Evaluacion } from "../evaluate";
import type { Umbrales } from "../thresholds";
import type { Etiqueta } from "./etiquetas";
import type { CasoEvaluado } from "./metricas";
import { ClienteGrabado, type FilaCorrida } from "./replay";

export interface ResultadoCorrida {
  casos: CasoEvaluado[];
  evaluaciones: Map<string, Evaluacion>;
}

/**
 * Evalúa cada fila del banco con las respuestas grabadas de JEV y arma los casos para las métricas.
 * Se evalúa una vez en modo combinado y de ahí salen los tres modos:
 * solo_reglas = piso, solo_jev = riesgo según JEV, combinado = max de ambos.
 */
export async function evaluarCorrida(args: {
  banco: FilaBanco[];
  etiquetas: Map<string, Etiqueta>;
  filas: Map<string, FilaCorrida>;
  umbrales: Umbrales;
}): Promise<ResultadoCorrida> {
  const casos: CasoEvaluado[] = [];
  const evaluaciones = new Map<string, Evaluacion>();

  for (const f of args.banco) {
    const id = f.id as string;
    const etiqueta = args.etiquetas.get(id);
    const fila = args.filas.get(id);
    if (!etiqueta) throw new Error(`Sin etiqueta para ${id}`);
    if (!fila) throw new Error(`La corrida no tiene la fila ${id}`);

    const accion = accionDesdeFila(f);
    // siempre se llama a JEV (omitirSiBloqueo desactivado) para poder medir solo_jev
    const ev = await evaluateAction(accion, { cliente: new ClienteGrabado(fila), umbrales: args.umbrales });
    evaluaciones.set(id, ev);
    casos.push({
      id,
      etiqueta: etiqueta.decision_final,
      familia: etiqueta.familia,
      origen: etiqueta.origen_etiqueta,
      ambigua: etiqueta.ambigua,
      texto: accion.texto,
      decisiones: { combinado: ev.decision, solo_reglas: ev.piso_reglas, solo_jev: ev.riesgo_jev },
      jev_estado: ev.jev_estado,
      latencia_ms: ev.traza.latencia_ms,
      input_tokens: ev.traza.input_tokens,
      costo_usd: ev.traza.costo_usd,
    });
  }
  return { casos, evaluaciones };
}
