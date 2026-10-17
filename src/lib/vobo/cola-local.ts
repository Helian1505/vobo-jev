/**
 * Cola de VoBo humano de la DEMO: las acciones que quedaron en PEDIR VOBO, con botones de aprobar o rechazar.
 * El estado vive solo en este navegador (localStorage): es una demostración, no un sistema de aprobación real.
 * Todo acceso a localStorage va en try/catch: en una ventana privada o con los datos bloqueados puede lanzar.
 */
export type OrigenCola = "demo" | "simulacion";
export type EstadoCola = "pendiente" | "aprobada" | "rechazada";

export interface ItemCola {
  /** El request_id de la evaluación: sirve para no repetir la misma acción. */
  id: string;
  fecha: string;
  origen: OrigenCola;
  tipo_accion: string;
  /** El id de la acción en el banco o el que mandó el agente, si lo hay. */
  id_accion: string | null;
  texto: string;
  titular: string;
  razones: string[];
  reglas: string[];
  estado: EstadoCola;
  resuelta?: string;
}

export const CLAVE_COLA = "vobo.cola.v1";
export const MAX_ITEMS = 200;
const EVENTO = "vobo:cola";
const MAX_TEXTO = 400;

function almacen(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** El contenido crudo (texto JSON). Es el «snapshot» estable para useSyncExternalStore. */
export function leerCrudo(): string {
  try {
    return almacen()?.getItem(CLAVE_COLA) ?? "[]";
  } catch {
    return "[]";
  }
}

const ESTADOS = new Set<string>(["pendiente", "aprobada", "rechazada"]);

/** Convierte el texto guardado en items válidos; lo que no cuadre se descarta (nunca lanza). */
export function parsearCola(crudo: string): ItemCola[] {
  try {
    const v: unknown = JSON.parse(crudo);
    if (!Array.isArray(v)) return [];
    return v.filter(
      (x): x is ItemCola =>
        typeof x === "object" &&
        x !== null &&
        typeof (x as ItemCola).id === "string" &&
        typeof (x as ItemCola).titular === "string" &&
        ESTADOS.has((x as ItemCola).estado) &&
        Array.isArray((x as ItemCola).razones),
    );
  } catch {
    return [];
  }
}

export function leerCola(): ItemCola[] {
  return parsearCola(leerCrudo());
}

function guardar(items: ItemCola[]): void {
  try {
    almacen()?.setItem(CLAVE_COLA, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    // sin almacenamiento: la cola de esta ventana simplemente no persiste
  }
  try {
    window.dispatchEvent(new Event(EVENTO));
  } catch {
    // fuera del navegador
  }
}

/** Agrega una acción a la cola (arriba). Si ya estaba (mismo id), no la repite. Devuelve true si la agregó. */
export function encolar(item: Omit<ItemCola, "estado" | "fecha"> & { fecha?: string }): boolean {
  const actuales = leerCola();
  if (actuales.some((x) => x.id === item.id)) return false;
  guardar([{ ...item, texto: item.texto.slice(0, MAX_TEXTO), fecha: item.fecha ?? new Date().toISOString(), estado: "pendiente" }, ...actuales]);
  return true;
}

export function resolver(id: string, estado: Exclude<EstadoCola, "pendiente">): void {
  guardar(leerCola().map((x) => (x.id === id ? { ...x, estado, resuelta: new Date().toISOString() } : x)));
}

export function vaciar(): void {
  guardar([]);
}

/** Avisa cuando la cola cambia, en esta pestaña (evento propio) o en otra (evento storage). */
export function suscribir(avisar: () => void): () => void {
  const alCambiar = (e: Event) => {
    if (e.type === "storage" && (e as StorageEvent).key !== CLAVE_COLA && (e as StorageEvent).key !== null) return;
    avisar();
  };
  window.addEventListener(EVENTO, alCambiar);
  window.addEventListener("storage", alCambiar);
  return () => {
    window.removeEventListener(EVENTO, alCambiar);
    window.removeEventListener("storage", alCambiar);
  };
}
