"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Hace aparecer su contenido (desde abajo, con un leve difuminado) la primera vez que entra en pantalla.
 * `retraso` escalona varios bloques seguidos. Sin IntersectionObserver o con «reducir movimiento», se muestra de una vez.
 */
export function Revelar({ children, retraso = 0, className = "" }: { children: ReactNode; retraso?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setVisible(true);
          observador.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  return (
    <div ref={ref} data-visible={visible} className={`revelar ${className}`} style={{ "--retraso": `${retraso}ms` } as CSSProperties}>
      {children}
    </div>
  );
}
