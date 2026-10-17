import type { Metadata } from "next";
import { Simulacion } from "@/components/Simulacion";
import { SIMULACION } from "@/lib/vobo/simulacion";

export const metadata: Metadata = {
  title: "Simulación en vivo — VoBo",
  description: "Un agente propone acciones del banco una tras otra y VoBo decide cada una en tiempo real, con contadores y costo acumulado.",
};

export default function PaginaSimulacion() {
  return <Simulacion total={SIMULACION.length} />;
}
