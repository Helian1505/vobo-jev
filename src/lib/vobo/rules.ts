import { diaMesDeIso, parseFechaEs } from "./fechas";
import { POLICY, type Policy } from "./policy";
import { SEV, type AccionAgente, type Decision, type NombreRegla, type ReglaActivada, type Reversibilidad } from "./types";

export interface ResultadoReglas {
  /** Decisión más severa entre las reglas activadas (ALLOW si no se activa ninguna). */
  piso: Decision;
  /** Todas las reglas activadas, no solo la peor. */
  reglas: ReglaActivada[];
}

/**
 * Capa 1: reglas duras. Debe coincidir exacto con referencia/rules_ref.py (rules_floor).
 * Es determinista y no consulta a JEV.
 */
export function evaluarReglas(a: AccionAgente, P: Policy = POLICY): ResultadoReglas {
  let piso: Decision = "ALLOW";
  const reglas: ReglaActivada[] = [];

  const activar = (regla: NombreRegla, detalle: Record<string, unknown>) => {
    const decision = P.severidad[regla];
    reglas.push({ regla, decision, detalle });
    if (SEV[decision] > SEV[piso]) piso = decision;
  };

  const tipo = a.tipo_accion;
  const dest = Math.trunc(a.destinatarios || 0);

  if (!P.canales_oficiales.includes(a.canal)) {
    activar("canal_no_oficial", { canal: a.canal });
  }

  const bajas = a.en_lista_de_bajas;
  if (bajas !== undefined && Math.trunc(bajas) > 0) {
    activar("en_lista_de_bajas", { k: Math.trunc(bajas) });
  }

  if (tipo === "crm_update" && a.campo_crm !== undefined && P.campos_crm_protegidos.includes(a.campo_crm)) {
    activar(dest > 1 ? "campo_protegido_masivo" : "campo_protegido_individual", {
      campo: a.campo_crm,
      n: dest,
    });
  }

  if (tipo === "crm_update" && a.campo_crm === "etapa_crm" && P.etapas_ganado.includes((a.texto ?? "").trim())) {
    activar(dest > 1 ? "etapa_ganado_masivo" : "etapa_ganado_individual", {
      etapa: (a.texto ?? "").trim(),
      n: dest,
      perfil_id: a.perfil_id,
    });
  }

  if (dest > P.umbral_audiencia_revision) {
    activar("audiencia_grande", { n: dest, umbral: P.umbral_audiencia_revision });
  }

  const h = P.horario_masivos;
  if (h.aplica_a.includes(tipo) && !(h.inicio <= a.hora_envio && a.hora_envio < h.fin)) {
    activar("fuera_de_horario", { hora: a.hora_envio, inicio: h.inicio, fin: h.fin });
  }

  if (a.fecha_evento_real && a.fecha_en_texto) {
    const real = diaMesDeIso(a.fecha_evento_real);
    const leida = parseFechaEs(a.fecha_en_texto);
    if (leida === null || leida[0] !== real[0] || leida[1] !== real[1]) {
      activar("fecha_inconsistente", {
        fecha_texto: a.fecha_en_texto,
        fecha_real: a.fecha_evento_real,
        legible: leida !== null,
      });
    }
  }

  if (a.precio_en_texto_usd !== undefined && a.precio_en_texto_usd !== null) {
    const prog = a.programa_ofrecido;
    const delPrograma = prog ? P.catalogo_programas_usd[prog] : undefined;
    const ref = delPrograma ?? P.catalogo_precios_usd.sesion_abierta;
    if (Number(a.precio_en_texto_usd) !== ref) {
      activar("precio_inconsistente", {
        precio_texto: a.precio_en_texto_usd,
        precio_catalogo: ref,
        programa: delPrograma !== undefined ? prog : undefined,
      });
    }
  }

  const ra = P.regla_afinidad;
  if (
    ra.aplica_a.includes(tipo) &&
    a.programa_ofrecido !== undefined &&
    P.programas_pagos.includes(a.programa_ofrecido) &&
    a.audiencia_pct_afinidad_baja !== undefined &&
    a.audiencia_pct_afinidad_baja >= ra.umbral_pct_baja
  ) {
    activar("oferta_sin_afinidad", {
      programa: a.programa_ofrecido,
      pct: a.audiencia_pct_afinidad_baja,
    });
  }

  return { piso, reglas };
}

/** La reversibilidad la define el código con una tabla por tipo de acción (no JEV). */
export function reversibilidadDe(tipo: AccionAgente["tipo_accion"], P: Policy = POLICY): Reversibilidad {
  return P.reversibilidad_por_tipo[tipo];
}
