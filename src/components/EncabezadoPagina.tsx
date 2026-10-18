import type { ReactNode } from "react";

/**
 * Encabezado común de todas las páginas internas (Demo, Simulación, Cola, Resultados, Integración):
 * misma etiqueta, mismo titular y mismo espacio arriba, para que todas arranquen igual.
 */
export function EncabezadoPagina({ etiqueta, titulo, children }: { etiqueta: string; titulo: string; children?: ReactNode }) {
  return (
    <header className="max-w-3xl">
      <p className="text-xs font-medium uppercase tracking-wider text-fg-faint">{etiqueta}</p>
      <h1 className="font-display mt-3 text-4xl leading-[1.05] text-fg sm:text-5xl">{titulo}</h1>
      {children}
    </header>
  );
}
