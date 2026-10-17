"use client";

import { useMemo, useSyncExternalStore } from "react";
import { leerCrudo, parsearCola, suscribir, type ItemCola } from "./cola-local";

/** La cola del navegador, siempre al día (cambios desde esta pestaña o desde otra). En el servidor está vacía. */
export function useCola(): ItemCola[] {
  const crudo = useSyncExternalStore(suscribir, leerCrudo, () => "[]");
  return useMemo(() => parsearCola(crudo), [crudo]);
}
