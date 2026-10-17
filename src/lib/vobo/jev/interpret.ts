import { SEV, type Decision } from "../types";
import type { UmbralesPerfil } from "../thresholds";
import { NIVELES_TONO, OPCIONES_RIESGOSAS, SEVERIDAD_NOUL } from "./questions";
import type { JevRespuesta, RespuestaChoice, RespuestaNoul, RespuestaScore } from "./types";

/** "alerta": supera T_accion; "duda": JEV no está seguro (entre T_revision y T_accion); "ok": sin riesgo. */
export type EstadoSenal = "alerta" | "duda" | "ok";

export interface Senal {
  id: string;
  decision: Decision;
  estado: EstadoSenal;
  /** Probabilidad que explica la decisión (la de la opción disparadora o la masa riesgosa). */
  prob: number;
  /** Opción disparadora (choice) o la más probable. */
  opcion?: string;
  confianza?: number;
  detalle: Record<string, unknown>;
}

const masa = (p: Record<string, number>, claves: string[]) => claves.reduce((s, k) => s + (p[k] ?? 0), 0);

function interpretarNoul(id: string, r: RespuestaNoul, u: UmbralesPerfil): Senal {
  const sev = SEVERIDAD_NOUL[id] ?? "REVIEW";
  const p = r.noul;
  if (p >= u.T_accion) return { id, decision: sev, estado: "alerta", prob: p, detalle: {} };
  if (p >= u.T_revision) return { id, decision: "REVIEW", estado: "duda", prob: p, detalle: { motivo: "jev_duda" } };
  return { id, decision: "ALLOW", estado: "ok", prob: p, detalle: {} };
}

function interpretarChoice(id: string, r: RespuestaChoice, u: UmbralesPerfil): Senal {
  const riesgosas = OPCIONES_RIESGOSAS[id] ?? {};
  const p = r.probabilities;
  const base = { confianza: r.confidence, detalle: { probabilidades: p } as Record<string, unknown> };

  // 1. Alguna opción riesgosa llega a T_accion → su severidad (la más severa; a igualdad, la más probable).
  const disparadas = Object.entries(riesgosas)
    .filter(([o]) => (p[o] ?? 0) >= u.T_accion)
    .sort((a, b) => SEV[b[1]] - SEV[a[1]] || (p[b[0]] ?? 0) - (p[a[0]] ?? 0));
  const primera = disparadas[0];
  if (primera) {
    return { id, decision: primera[1], estado: "alerta", prob: p[primera[0]] ?? 0, opcion: primera[0], ...base };
  }

  // 2. Ninguna llega, pero la masa riesgosa (riesgosas + otro) llega a T_revision → REVIEW por duda.
  const claves = [...Object.keys(riesgosas), "otro"];
  const m = masa(p, claves);
  if (m >= u.T_revision) {
    const top = [...Object.keys(riesgosas)].sort((a, b) => (p[b] ?? 0) - (p[a] ?? 0))[0];
    return {
      id,
      decision: "REVIEW",
      estado: "duda",
      prob: m,
      opcion: top,
      confianza: r.confidence,
      detalle: { ...base.detalle, motivo: "jev_duda", masa_riesgosa: m },
    };
  }
  return { id, decision: "ALLOW", estado: "ok", prob: m, opcion: r.choice, ...base };
}

/** Lee los niveles desde legend (sin suponer que el índice empieza en 0 o en 1): se ordenan sus llaves. */
function nivelesDeScore(r: RespuestaScore): number[] {
  const llaves = Object.keys(r.legend).sort((a, b) => Number(a) - Number(b));
  return llaves.map((k) => r.probabilities[k] ?? 0);
}

function interpretarTono(r: RespuestaScore, u: UmbralesPerfil): Senal {
  const niveles = nivelesDeScore(r);
  const pOfensivo = niveles[NIVELES_TONO.ofensivo] ?? 0;
  const pSensacionalista = niveles[NIVELES_TONO.sensacionalista] ?? 0;
  const detalle = { niveles, p_ofensivo: pOfensivo, p_sensacionalista: pSensacionalista };
  if (pOfensivo >= u.T_accion) {
    return { id: "tono", decision: "BLOCK", estado: "alerta", prob: pOfensivo, opcion: "ofensivo", confianza: r.confidence, detalle };
  }
  const m = pOfensivo + pSensacionalista;
  if (m >= u.T_revision) {
    const opcion = pOfensivo > pSensacionalista ? "ofensivo" : "sensacionalista";
    return { id: "tono", decision: "REVIEW", estado: "duda", prob: m, opcion, confianza: r.confidence, detalle };
  }
  return { id: "tono", decision: "ALLOW", estado: "ok", prob: m, confianza: r.confidence, detalle };
}

function interpretarSegmento(r: RespuestaChoice, declarado: string, u: UmbralesPerfil): Senal | null {
  if (declarado === "comunidad_general") return null; // se omite (CLAUDE.md §6.4)
  const top = Object.entries(r.probabilities).sort((a, b) => b[1] - a[1])[0];
  const detalle = { declarado, probabilidades: r.probabilities };
  if (top && top[0] !== declarado && top[0] !== "comunidad_general" && top[0] !== "otro" && top[1] >= u.T_segmento) {
    return {
      id: "segmento",
      decision: "REVIEW",
      estado: "alerta",
      prob: top[1],
      opcion: top[0],
      confianza: r.confidence,
      detalle: { ...detalle, detectado: top[0] },
    };
  }
  return { id: "segmento", decision: "ALLOW", estado: "ok", prob: top?.[1] ?? 0, opcion: top?.[0], confianza: r.confidence, detalle };
}

/**
 * Respuestas de JEV → señales de riesgo (CLAUDE.md §6.4). Las respuestas ya pasaron por
 * validarRespuesta. El riesgo según JEV es la señal más severa.
 */
export function interpretar(respuesta: JevRespuesta, segmentoDeclarado: string, u: UmbralesPerfil): Senal[] {
  const senales: Senal[] = [];
  for (const [id, r] of Object.entries(respuesta.answers)) {
    if (r.type === "noul") senales.push(interpretarNoul(id, r, u));
    else if (r.type === "score") senales.push(interpretarTono(r, u));
    else if (id === "segmento") {
      const s = interpretarSegmento(r, segmentoDeclarado, u);
      if (s) senales.push(s);
    } else senales.push(interpretarChoice(id, r, u));
  }
  return senales;
}

export function riesgoJev(senales: Senal[]): Decision {
  return senales.reduce<Decision>((peor, s) => (SEV[s.decision] > SEV[peor] ? s.decision : peor), "ALLOW");
}
