import { conjuntosDe, porGrupo, resumenConjunto, type CasoEvaluado, type MetricasModo, type ResumenConjunto } from "./metricas";

export interface MetaResultado {
  split: "dev" | "test";
  modelos: string[];
  etiquetas_sha256: string;
  umbrales: { version: string; estado: string; fecha: string | null };
  corrida: string;
  forzado: string | null;
}

/** JSON que consume la página /resultados (eval/results/<split>.json). */
export function construirResultado(casos: CasoEvaluado[], meta: MetaResultado) {
  const conjuntos = conjuntosDe(meta.split, casos);
  return {
    split: meta.split,
    fecha: new Date().toISOString(),
    modo_jev: "live" as const,
    modelos: meta.modelos,
    etiquetas_sha256: meta.etiquetas_sha256,
    umbrales: meta.umbrales,
    corrida: meta.corrida,
    forzado: meta.forzado,
    advertencia:
      meta.split === "dev"
        ? "Dev: 174 de 250 etiquetas son la propuesta de diseño sin revisión humana (ruidosas a propósito). Sirve para ajustar umbrales, no para reportar."
        : "Con 150 casos, cada error mueve las métricas cerca de 0,7 puntos: es una demostración, no estadística sólida.",
    conjuntos: Object.fromEntries(Object.entries(conjuntos).map(([k, v]) => [k, resumenConjunto(v)])) as Record<string, ResumenConjunto>,
    por_familia: porGrupo(casos, "familia"),
    por_origen: porGrupo(casos, "origen"),
  };
}

export type ResultadoBanco = ReturnType<typeof construirResultado>;

const p = (x: { pct: number | null }) => (x.pct === null ? "—" : `${(x.pct * 100).toFixed(1)}%`);

/** Tabla de texto para la consola. */
export function textoResumen(conjuntos: Record<string, ResumenConjunto>): string {
  const l: string[] = [];
  for (const [nombre, r] of Object.entries(conjuntos)) {
    l.push(`── ${nombre} (${r.n} acciones) ──`);
    l.push("modo          peligrosas auto-aprobadas | autonomía | escalado | sobre-bloqueo | sev. subestimada");
    for (const modo of ["solo_reglas", "solo_jev", "combinado"] as const) {
      const m: MetricasModo = r[modo];
      l.push(
        `${modo.padEnd(13)} ${String(m.peligrosas_auto_aprobadas).padStart(3)} de ${String(m.peligrosas).padEnd(3)}                  | ${p(m.autonomia).padStart(8)}  | ${p(m.escalado).padStart(7)}  | ${p(m.sobre_bloqueo).padStart(12)}  | ${p(m.severidad_subestimada).padStart(8)}`,
      );
    }
    const v = r.valor_agregado_jev;
    const c = r.costo_latencia;
    l.push(`valor de JEV: de ${v.dejadas_pasar_por_reglas} peligrosas que las reglas dejan pasar, el combinado atrapa ${v.atrapadas_por_jev}`);
    l.push(`costo por 1.000 decisiones: USD ${c.costo_por_1000_decisiones_usd?.toFixed(4) ?? "—"} · latencia p50 ${c.latencia_p50_ms ?? "—"} ms, p95 ${c.latencia_p95_ms ?? "—"} ms\n`);
  }
  return l.join("\n");
}
