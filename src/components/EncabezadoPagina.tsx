import type { ReactNode } from "react";

/**
 * Encabezado común de todas las páginas internas (Demo, Simulación, Cola, Resultados, Integración):
 * mismo titular y mismo espacio arriba, para que todas arranquen igual.
 */
export function EncabezadoPagina({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <header className="max-w-3xl">
      <h1 className="font-display text-4xl leading-[1.05] text-fg sm:text-5xl">{titulo}</h1>
      {children}
    </header>
  );
}

/** Encabezado de sección (mismo en todas las páginas): titular y una nota corta a la derecha. */
export function EncabezadoSeccion({ id, titulo, nota }: { id: string; titulo: string; nota?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-2">
      <div className="max-w-3xl">
<h2 id={id} className="font-display text-2xl leading-tight text-fg sm:text-3xl">
          {titulo}
        </h2>
      </div>
      {nota && <p className="max-w-xs text-sm leading-relaxed text-fg-muted lg:text-right">{nota}</p>}
    </div>
  );
}

/** Bloque plegable: título y resumen de una línea; el detalle queda adentro. */
export function Plegable({ titulo, resumen, children }: { titulo: string; resumen: string; children: ReactNode }) {
  return (
    <details className="group hairline rounded-card bg-surface">
      <summary className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-field">
        <span>
          <span className="font-display block text-lg text-fg">{titulo}</span>
          <span className="mt-0.5 block text-sm text-fg-muted">{resumen}</span>
        </span>
        <span className="gira shrink-0 text-xl leading-none text-accent" aria-hidden="true">+</span>
      </summary>
      <div className="border-t border-line px-5 py-5">{children}</div>
    </details>
  );
}
