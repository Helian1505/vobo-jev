export interface PreguntaNoul {
  type: "noul";
  instructions: string;
  criteria?: { true: string; false: string };
}
export interface PreguntaChoice {
  type: "choice";
  instructions: string;
  criteria: Record<string, string>;
}
export interface PreguntaScore {
  type: "score";
  instructions: string;
  criteria: string[];
}
export type Pregunta = PreguntaNoul | PreguntaChoice | PreguntaScore;
export type Preguntas = Record<string, Pregunta>;

export interface RespuestaNoul {
  type: "noul";
  noul: number;
}
export interface RespuestaChoice {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
}
export interface RespuestaScore {
  type: "score";
  score: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
  confidence: number;
}
export type Respuesta = RespuestaNoul | RespuestaChoice | RespuestaScore;

export interface JevRespuesta {
  model: string;
  answers: Record<string, Respuesta>;
  usage: { input_tokens: number; output_tokens: number };
}

export interface JevResultado extends JevRespuesta {
  latencia_ms: number;
  llamadas: number;
}

/** El state que se le manda a JEV (solo texto y contexto; nunca metadatos que resuelve el código). */
export type JevState = Record<string, unknown>;

export interface JevClient {
  readonly nombre: "live" | "mock";
  consultar(state: JevState, preguntas: Preguntas): Promise<JevResultado>;
}

export class JevError extends Error {
  constructor(
    public readonly codigo: string,
    mensaje: string,
    public readonly reintentable = false,
  ) {
    super(mensaje);
    this.name = "JevError";
  }
}
