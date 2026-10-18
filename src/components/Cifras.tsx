"use client";

import { useEffect, useRef, useState } from "react";

export interface Cifra {
  /** Valor final que se muestra. */
  valor: number;
  decimales?: number;
  antes?: string;
  despues?: string;
  etiqueta: string;
  nota: string;
}

const formato = (n: number, decimales: number) =>
  n.toLocaleString("es-CO", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });

/** Franja de cifras del test: cuentan hacia arriba una sola vez al entrar en pantalla (sin movimiento si el sistema lo pide). */
export function Cifras({ cifras }: { cifras: Cifra[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [avance, setAvance] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setAvance(0);
    let cuadro = 0;
    const observador = new IntersectionObserver(
      (entradas) => {
        if (!entradas.some((e) => e.isIntersecting)) return;
        observador.disconnect();
        const inicio = performance.now();
        const duracion = 1100;
        const paso = (ahora: number) => {
          const t = Math.min(1, (ahora - inicio) / duracion);
          setAvance(1 - Math.pow(1 - t, 3));
          if (t < 1) cuadro = requestAnimationFrame(paso);
        };
        cuadro = requestAnimationFrame(paso);
      },
      { threshold: 0.4 },
    );
    observador.observe(el);
    return () => {
      observador.disconnect();
      cancelAnimationFrame(cuadro);
    };
  }, []);

  return (
    <div ref={ref} className="grid gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
      {cifras.map((c) => {
        const decimales = c.decimales ?? 0;
        const mostrado = avance >= 1 ? c.valor : c.valor * avance;
        return (
          <div key={c.etiqueta} className="bg-surface p-5 sm:p-6">
            <p className="font-display tabular text-4xl text-fg sm:text-[44px] sm:leading-none">
              {c.antes}
              {formato(mostrado, decimales)}
              {c.despues}
            </p>
            <p className="mt-3 text-sm leading-snug text-fg-soft">{c.etiqueta}</p>
            <p className="mono mt-2 text-[11px] leading-relaxed text-fg-faint">{c.nota}</p>
          </div>
        );
      })}
    </div>
  );
}
