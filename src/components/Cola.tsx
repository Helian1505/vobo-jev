"use client";

import Link from "next/link";
import { useState } from "react";
import { Insignia } from "@/components/ResultadoPanel";
import { resolver, vaciar, type EstadoCola, type ItemCola } from "@/lib/vobo/cola-local";
import { useCola } from "@/lib/vobo/use-cola";
import { ETIQUETA_REGLA, TIPOS_ACCION } from "@/lib/vobo/ui-datos";
import type { NombreRegla } from "@/lib/vobo/types";
import { EncabezadoPagina } from "@/components/EncabezadoPagina";

type Filtro = "pendientes" | "resueltas" | "todas";

const NOMBRE_TIPO = Object.fromEntries(TIPOS_ACCION.map((t) => [t.valor, t.etiqueta])) as Record<string, string>;
const ORIGEN = { demo: "Demo", simulacion: "Simulación" } as const;

const hora = (iso: string) => new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bogota" });

function Tarjeta({ it }: { it: ItemCola }) {
  const referencia = it.id_accion ?? it.id.slice(0, 8);
  return (
    <li className="rounded-card border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
        <span className="font-mono text-fg">{referencia}</span>
        <span>{NOMBRE_TIPO[it.tipo_accion] ?? it.tipo_accion}</span>
        <span className="rounded-full border border-line px-2 py-0.5">{ORIGEN[it.origen]}</span>
        <time dateTime={it.fecha}>{hora(it.fecha)}</time>
      </div>

      <h2 className="display-sans mt-3 text-lg font-semibold leading-snug text-fg">{it.titular}</h2>
      {it.razones.length > 1 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-fg-soft marker:text-fg-muted">
          {it.razones.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}

      {it.texto && (
        <blockquote className="mt-3 border-l border-line-strong pl-3 text-sm leading-relaxed text-fg-muted">
          <span className="line-clamp-3">{it.texto}</span>
        </blockquote>
      )}

      {it.reglas.length > 0 && (
        <p className="mt-3 flex flex-wrap gap-1.5 text-xs">
          {it.reglas.map((r) => (
            <span key={r} className="rounded-full border border-line px-2 py-0.5 text-fg-muted">
              {ETIQUETA_REGLA[r as NombreRegla] ?? r}
            </span>
          ))}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        {it.estado === "pendiente" ? (
          <>
            <button
              type="button"
              onClick={() => resolver(it.id, "aprobada")}
              aria-label={`Aprobar la acción ${referencia}`}
              className="rounded-field border border-allow/50 bg-allow/10 px-4 py-2 text-sm font-semibold text-allow hover:bg-allow/20"
            >
              Aprobar
            </button>
            <button
              type="button"
              onClick={() => resolver(it.id, "rechazada")}
              aria-label={`Rechazar la acción ${referencia}`}
              className="rounded-field border border-block/50 bg-block/10 px-4 py-2 text-sm font-semibold text-block hover:bg-block/20"
            >
              Rechazar
            </button>
            <span className="text-xs text-fg-muted">Una persona decide; en esta demo no se ejecuta nada.</span>
          </>
        ) : (
          <p className="text-sm text-fg-soft">
            <span className={`font-semibold ${it.estado === "aprobada" ? "text-allow" : "text-block"}`}>
              {it.estado === "aprobada" ? "Aprobada" : "Rechazada"}
            </span>
            {it.resuelta && <> · {hora(it.resuelta)}</>}
          </p>
        )}
      </div>
    </li>
  );
}

export function Cola() {
  const items = useCola();
  const [filtro, setFiltro] = useState<Filtro>("pendientes");
  const [confirmar, setConfirmar] = useState(false);

  const cuenta = (e: EstadoCola) => items.filter((i) => i.estado === e).length;
  const visibles = items.filter((i) => (filtro === "todas" ? true : filtro === "pendientes" ? i.estado === "pendiente" : i.estado !== "pendiente"));

  return (
    <div className="space-y-8">
      <EncabezadoPagina etiqueta="Cola" titulo="Cola de VoBo humano">
        <p className="mt-5 text-base leading-relaxed text-fg-soft sm:text-lg">
          Las acciones que quedaron en <Insignia decision="REVIEW" /> en la demo y en la simulación esperan aquí a que una persona las apruebe o las rechace.
        </p>
        <p role="note" className="mt-4 rounded-field border border-line bg-surface px-4 py-3 text-sm leading-relaxed text-fg-muted">
          <strong className="font-semibold text-fg">Es una demostración.</strong> El estado vive solo en este navegador: se guarda aquí y no sale de tu
          equipo, y aprobar no ejecuta nada de verdad. En una integración real, esta cola sería un sistema de tareas o aprobaciones (
          <a className="text-fg underline underline-offset-4 hover:text-accent" href="https://github.com/Helian1505/vobo-jev/blob/main/docs/INTEGRACION.md">ver cómo integrarlo</a>
          ).
        </p>
      </EncabezadoPagina>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Filtrar la cola" className="flex gap-1">
          {(
            [
              ["pendientes", `Pendientes (${cuenta("pendiente")})`],
              ["resueltas", `Resueltas (${cuenta("aprobada") + cuenta("rechazada")})`],
              ["todas", `Todas (${items.length})`],
            ] as const
          ).map(([valor, texto]) => (
            <button
              key={valor}
              type="button"
              aria-pressed={filtro === valor}
              onClick={() => setFiltro(valor)}
              className={`rounded-full px-3.5 py-1.5 text-sm ${filtro === valor ? "bg-raised font-medium text-fg" : "text-fg-muted hover:text-fg"}`}
            >
              {texto}
            </button>
          ))}
        </div>
        {items.length > 0 &&
          (confirmar ? (
            <span className="flex items-center gap-2 text-sm">
              <span className="text-fg-muted">¿Vaciar toda la cola?</span>
              <button
                type="button"
                onClick={() => {
                  vaciar();
                  setConfirmar(false);
                }}
                className="rounded-field border border-block/50 px-3 py-1.5 font-semibold text-block hover:bg-block/10"
              >
                Sí, vaciar
              </button>
              <button type="button" onClick={() => setConfirmar(false)} className="rounded-field border border-line px-3 py-1.5 text-fg-soft hover:text-fg">
                Cancelar
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmar(true)} className="rounded-field border border-line px-3 py-1.5 text-sm text-fg-muted hover:text-fg">
              Vaciar la cola
            </button>
          ))}
      </div>

      {visibles.length === 0 ? (
        <div className="rounded-card border border-line bg-surface p-6 text-sm leading-relaxed text-fg-soft">
          {items.length === 0 ? (
            <>
              <p className="font-medium text-fg">No hay acciones esperando.</p>
              <p className="mt-2 text-fg-muted">
                Llegan solas cuando una evaluación da PEDIR VOBO: prueba el ejemplo E02 en la{" "}
                <Link className="text-fg underline underline-offset-4 hover:text-accent" href="/demo">demo</Link> o corre la{" "}
                <Link className="text-fg underline underline-offset-4 hover:text-accent" href="/simulacion">simulación</Link>.
              </p>
            </>
          ) : (
            <p>No hay acciones en este filtro.</p>
          )}
        </div>
      ) : (
        <ul className="space-y-4" aria-live="polite">
          {visibles.map((it) => (
            <Tarjeta key={it.id} it={it} />
          ))}
        </ul>
      )}
    </div>
  );
}
