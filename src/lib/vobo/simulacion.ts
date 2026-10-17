import simulacionJson from "../../generated/simulacion.json";
import type { AccionAgente } from "./types";

/** Acciones que recorre /simulacion (ver scripts/build-data.ts). */
export const SIMULACION: AccionAgente[] = simulacionJson as AccionAgente[];
