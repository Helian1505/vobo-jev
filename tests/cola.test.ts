import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLAVE_COLA, MAX_ITEMS, encolar, leerCola, parsearCola, resolver, suscribir, vaciar } from "@/lib/vobo/cola-local";

class AlmacenFalso {
  datos = new Map<string, string>();
  getItem = (k: string) => this.datos.get(k) ?? null;
  setItem = (k: string, v: string) => void this.datos.set(k, v);
}

const item = (id: string, extra: Partial<Parameters<typeof encolar>[0]> = {}) => ({
  id,
  origen: "demo" as const,
  tipo_accion: "correo_masivo",
  id_accion: null,
  texto: "Hola",
  titular: "PEDIR VOBO: algo",
  razones: ["algo"],
  reglas: ["audiencia_grande"],
  ...extra,
});

let almacen: AlmacenFalso;
type Oyente = (e: Event) => void;
let oyentes: Map<string, Set<Oyente>>;

beforeEach(() => {
  almacen = new AlmacenFalso();
  oyentes = new Map();
  vi.stubGlobal("localStorage", almacen);
  vi.stubGlobal("window", {
    dispatchEvent: (e: Event) => void oyentes.get(e.type)?.forEach((f) => f(e)),
    addEventListener: (t: string, f: Oyente) => oyentes.set(t, (oyentes.get(t) ?? new Set()).add(f)),
    removeEventListener: (t: string, f: Oyente) => oyentes.get(t)?.delete(f),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("cola local de la demo", () => {
  it("encola arriba, en estado pendiente y con fecha", () => {
    expect(encolar(item("a"))).toBe(true);
    expect(encolar(item("b"))).toBe(true);
    const c = leerCola();
    expect(c.map((x) => x.id)).toEqual(["b", "a"]);
    expect(c[0]).toMatchObject({ estado: "pendiente" });
    expect(Date.parse(c[0]?.fecha ?? "")).not.toBeNaN();
  });

  it("no repite la misma acción (mismo request_id)", () => {
    expect(encolar(item("a"))).toBe(true);
    expect(encolar(item("a"))).toBe(false);
    expect(leerCola()).toHaveLength(1);
  });

  it("aprobar o rechazar cambia solo ese item y guarda cuándo", () => {
    encolar(item("a"));
    encolar(item("b"));
    resolver("a", "aprobada");
    resolver("b", "rechazada");
    const [b, a] = leerCola();
    expect(a).toMatchObject({ id: "a", estado: "aprobada" });
    expect(b).toMatchObject({ id: "b", estado: "rechazada" });
    expect(Date.parse(a?.resuelta ?? "")).not.toBeNaN();
  });

  it("recorta textos largos y limita el tamaño de la cola", () => {
    encolar(item("largo", { texto: "x".repeat(5000) }));
    expect(leerCola()[0]?.texto).toHaveLength(400);
    for (let i = 0; i < MAX_ITEMS + 20; i++) encolar(item(`i${i}`));
    expect(leerCola()).toHaveLength(MAX_ITEMS);
  });

  it("vaciar deja la cola en cero", () => {
    encolar(item("a"));
    vaciar();
    expect(leerCola()).toEqual([]);
  });

  it("avisa a quien escucha cuando la cola cambia, y deja de avisar al desuscribirse", () => {
    const avisar = vi.fn();
    const baja = suscribir(avisar);
    encolar(item("a"));
    resolver("a", "aprobada");
    expect(avisar).toHaveBeenCalledTimes(2);
    baja();
    encolar(item("b"));
    expect(avisar).toHaveBeenCalledTimes(2);
  });
});

describe("resistencia a datos malos y a localStorage roto", () => {
  it("descarta el JSON roto y los items que no cuadran, sin lanzar", () => {
    expect(parsearCola("{no es json")).toEqual([]);
    expect(parsearCola('{"a":1}')).toEqual([]);
    expect(parsearCola(JSON.stringify([{ id: "ok", titular: "t", estado: "pendiente", razones: [] }, { id: 5 }, null, { id: "x", titular: "t", estado: "rara", razones: [] }]))).toHaveLength(1);
    almacen.datos.set(CLAVE_COLA, "basura");
    expect(leerCola()).toEqual([]);
    expect(encolar(item("a"))).toBe(true); // se recupera y sobrescribe
    expect(leerCola()).toHaveLength(1);
  });

  it("si localStorage lanza al leer o al escribir, no se cae", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    });
    expect(leerCola()).toEqual([]);
    expect(() => encolar(item("a"))).not.toThrow();
    expect(() => resolver("a", "aprobada")).not.toThrow();
    expect(() => vaciar()).not.toThrow();
  });

  it("sin localStorage (servidor) tampoco se cae", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(leerCola()).toEqual([]);
    expect(() => encolar(item("a"))).not.toThrow();
  });
});
