/**
 * Límite en memoria por clave (IP). En Vercel cada instancia tiene su propio contador, así que es
 * de mejor esfuerzo (CLAUDE.md §8.1); el interruptor real es VOBO_JEV_MODE=mock.
 */
export class LimitadorVentana {
  private readonly golpes = new Map<string, number[]>();

  constructor(
    private readonly maximo = 20,
    private readonly ventanaMs = 60_000,
  ) {}

  /** true si la solicitud pasa; false si la clave superó el máximo en la ventana. */
  permitir(clave: string, ahora = Date.now()): boolean {
    const desde = ahora - this.ventanaMs;
    const recientes = (this.golpes.get(clave) ?? []).filter((t) => t > desde);
    if (recientes.length >= this.maximo) {
      this.golpes.set(clave, recientes);
      return false;
    }
    recientes.push(ahora);
    this.golpes.set(clave, recientes);
    if (this.golpes.size > 5000) this.limpiar(desde);
    return true;
  }

  private limpiar(desde: number) {
    for (const [k, v] of this.golpes) if (v.every((t) => t <= desde)) this.golpes.delete(k);
  }
}
