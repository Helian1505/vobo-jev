import { PREGUNTAS } from "./questions";
import type { JevClient, JevResultado, JevState, Preguntas, Respuesta } from "./types";

/**
 * JEV simulado (CLAUDE.md §6.7): determinista, mismas formas que la API, heurísticas de palabras
 * clave. NUNCA produce métricas: la UI debe mostrar el distintivo JEV SIMULADO.
 */

const normalizar = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const tieneAlguna = (t: string, claves: string[]) => claves.some((c) => t.includes(c));

function elegirPromesa(t: string): string {
  if (tieneAlguna(t, ["no prometemos", "no garantizamos", "no prometo", "no garantizo"])) return "niega_o_aclara";
  if (tieneAlguna(t, ["garantiz", "asegur", "duplicar", "devolvemos tu dinero"])) return "explicita";
  if (tieneAlguna(t, ["suelen ver", "cambiara"])) return "implicita";
  return "ninguna";
}

function elegirDatos(texto: string): string {
  const correo = /[\w.+-]+@[\w-]+\.[\w.-]+/.test(texto);
  const digitos = /\d{7,}/.test(texto.replace(/[\s.-]/g, ""));
  return correo || digitos ? "sensibles_o_contacto" : "ninguno";
}

function elegirAfirmacion(t: string): string {
  if (tieneAlguna(t, ["numero 1", "ninguna otra"])) return "sin_respaldo";
  if (t.includes("%")) return t.includes("encuesta") ? "con_respaldo" : "sin_respaldo";
  return "ninguna";
}

function elegirSegmento(t: string): string {
  const familias: [string, string[]][] = [
    ["founders", ["founder", "fundador"]],
    ["ejecutivos", ["ejecutiv", "c-level", "gerente"]],
    ["equipos_tecnicos", ["desarrollador", "developer", "ingenier", "tecnic"]],
    ["estudiantes", ["estudiante", "universitari"]],
  ];
  const halladas = familias.filter(([, claves]) => tieneAlguna(t, claves)).map(([s]) => s);
  return halladas.length === 1 ? (halladas[0] as string) : "comunidad_general";
}

function elegirTono(original: string, t: string): "adecuado" | "sensacionalista" | "ofensivo" {
  if (tieneAlguna(t, ["perdedores", "inservible", "ignorante"])) return "ofensivo";
  const letras = original.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, "");
  const mayusculas = letras.replace(/[^A-ZÁÉÍÓÚÑ]/g, "");
  if (original.includes("!!") || (letras.length >= 20 && mayusculas.length / letras.length > 0.4)) return "sensacionalista";
  return "adecuado";
}

function respuestaChoice(opciones: string[], elegida: string): Respuesta {
  const resto = opciones.length - 1;
  const probabilities = Object.fromEntries(opciones.map((o) => [o, o === elegida ? 0.9 : resto > 0 ? 0.1 / resto : 0]));
  return { type: "choice", choice: elegida, probabilities, confidence: 0.9 };
}

function respuestaNoul(si: boolean): Respuesta {
  return { type: "noul", noul: si ? 0.9 : 0.1 };
}

const PERFIL_TONO = {
  adecuado: [0.8, 0.1, 0.05, 0.05],
  sensacionalista: [0.1, 0.05, 0.8, 0.05],
  ofensivo: [0.05, 0.05, 0.1, 0.8],
} as Record<string, readonly number[]>;

function contenidoDe(state: JevState): string {
  const c = state.contenido_no_confiable as { texto?: unknown } | undefined;
  return typeof c?.texto === "string" ? c.texto : "";
}

export class JevMock implements JevClient {
  readonly nombre = "mock" as const;

  async consultar(state: JevState, preguntas: Preguntas = PREGUNTAS): Promise<JevResultado> {
    const texto = contenidoDe(state);
    const t = normalizar(texto);
    const answers: Record<string, Respuesta> = {};

    for (const [id, p] of Object.entries(preguntas)) {
      if (p.type === "choice") {
        const opciones = Object.keys(p.criteria);
        const elegida =
          id === "promesa" ? elegirPromesa(t)
          : id === "datos_personales" ? elegirDatos(texto)
          : id === "afirmacion" ? elegirAfirmacion(t)
          : id === "segmento" ? elegirSegmento(t)
          : "otro";
        answers[id] = respuestaChoice(opciones, opciones.includes(elegida) ? elegida : (opciones.at(-1) as string));
      } else if (p.type === "noul") {
        const si =
          id === "certificacion" ? tieneAlguna(t, ["certificacion oficial", "titulacion", "avalada"])
          : id === "instruccion_agente" ? tieneAlguna(t, ["assistant", "agente", "asistente", "nota del sistema"])
          : false;
        answers[id] = respuestaNoul(si);
      } else {
        const nivel = elegirTono(texto, t);
        const probs = PERFIL_TONO[nivel] as readonly number[];
        answers[id] = {
          type: "score",
          score: probs.indexOf(Math.max(...probs)),
          legend: Object.fromEntries(p.criteria.map((c, i) => [String(i), c])),
          probabilities: Object.fromEntries(probs.map((v, i) => [String(i), v])),
          confidence: Math.max(...probs),
        };
      }
    }

    // Tokens de entrada estimados (aprox. 4 caracteres por token); solo para mostrar un costo de ejemplo.
    const input_tokens = Math.ceil(JSON.stringify({ state, questions: preguntas }).length / 4);
    return { model: "mock", answers, usage: { input_tokens, output_tokens: 0 }, latencia_ms: 0, llamadas: 1 };
  }
}
