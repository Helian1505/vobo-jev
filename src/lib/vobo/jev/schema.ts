import { z } from "zod";
import { JevError, type JevRespuesta, type Preguntas } from "./types";

const prob = z.number().min(0).max(1);

const respuestaSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("noul"), noul: prob }),
  z.object({
    type: z.literal("choice"),
    choice: z.string(),
    probabilities: z.record(z.string(), prob),
    confidence: prob,
  }),
  z.object({
    type: z.literal("score"),
    score: z.number(),
    legend: z.record(z.string(), z.string()),
    probabilities: z.record(z.string(), prob),
    confidence: prob,
  }),
]);

const respuestaJevSchema = z.object({
  model: z.string().min(1),
  answers: z.record(z.string(), respuestaSchema),
  usage: z.object({ input_tokens: z.number().nonnegative(), output_tokens: z.number().nonnegative() }),
});

/**
 * Valida la forma de la respuesta (CLAUDE.md §6.6) y que cada pregunta tenga su respuesta del tipo
 * correcto. Cualquier desvío lanza JevError: el llamador lo convierte en REVIEW, nunca en ALLOW.
 */
export function validarRespuesta(cruda: unknown, preguntas: Preguntas): JevRespuesta {
  const r = respuestaJevSchema.safeParse(cruda);
  if (!r.success) throw new JevError("forma_invalida", "La respuesta de JEV no tiene la forma esperada.");

  for (const [id, pregunta] of Object.entries(preguntas)) {
    const respuesta = r.data.answers[id];
    if (!respuesta) throw new JevError("pregunta_sin_respuesta", `JEV no respondió la pregunta ${id}.`);
    if (respuesta.type !== pregunta.type) {
      throw new JevError("tipo_inesperado", `JEV respondió la pregunta ${id} con un tipo distinto.`);
    }
    if (pregunta.type === "choice" && respuesta.type === "choice") {
      const validas = new Set(Object.keys(pregunta.criteria));
      const desconocida = Object.keys(respuesta.probabilities).find((o) => !validas.has(o));
      if (desconocida || !validas.has(respuesta.choice)) {
        throw new JevError("opcion_desconocida", `JEV devolvió una opción desconocida en ${id}.`);
      }
    }
    if (pregunta.type === "score" && respuesta.type === "score") {
      if (Object.keys(respuesta.legend).length !== pregunta.criteria.length) {
        throw new JevError("niveles_inesperados", `JEV devolvió otro número de niveles en ${id}.`);
      }
    }
  }
  return r.data;
}
