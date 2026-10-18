"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Cada página nueva arranca desde su título. El scroll suave del sitio hacía que, al cambiar de sección,
 * la vista quedara a mitad de camino; aquí se vuelve arriba al instante (el menú es fijo, no se mueve).
 */
export function ScrollArriba() {
  const ruta = usePathname();
  useLayoutEffect(() => {
    if (window.location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [ruta]);
  return null;
}
