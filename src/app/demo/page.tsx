import type { Metadata } from "next";
import { Demo, type AudienciaResumen, type EjemploDemo } from "@/components/Demo";
import { EncabezadoPagina } from "@/components/EncabezadoPagina";
import ejemplosJson from "../../../data/ejemplos_demo.json";
import { AUDIENCIAS, resolverAudiencia } from "@/lib/vobo/audiencias";
import { DEAL, PERFILES } from "@/lib/vobo/perfiles";
import { POLICY } from "@/lib/vobo/policy";

export const metadata: Metadata = {
  title: "Demo — VoBo",
  description: "Elige una acción de un agente de 30X y mira qué decide VoBo: PERMITIR, PEDIR VOBO o BLOQUEAR, con el porqué.",
};

export default function PaginaDemo() {
  const ejemplos = ejemplosJson.ejemplos as EjemploDemo[];

  // Las cifras de cada audiencia las calcula el servidor desde los perfiles; el navegador no recibe los 697 perfiles.
  const audiencias: AudienciaResumen[] = AUDIENCIAS.flatMap((a) => {
    const r = resolverAudiencia(a.id);
    return r
      ? [
          {
            id: r.id,
            nombre: r.nombre,
            perfiles_en_muestra: r.perfiles_en_muestra,
            destinatarios_estimados: r.destinatarios_estimados,
            pct_afinidad_baja: r.pct_afinidad_baja,
          },
        ]
      : [];
  });

  const idsDeals = PERFILES.filter((p) => p.relacion === DEAL).map((p) => p.id);
  const programas = [...POLICY.programas_pagos, "Free Sales Training"];

  return (
    <div className="space-y-8">
      <EncabezadoPagina etiqueta="Demo" titulo="Elige una acción y mira qué decide VoBo.">
        <p className="mt-5 text-base leading-relaxed text-fg-soft sm:text-lg">
          Cada evaluación llama a JEV real. Los 16 ejemplos usan programas, etapas y audiencias de 30X; también puedes escribir tu
          propia acción.
        </p>
      </EncabezadoPagina>
      <Demo ejemplos={ejemplos} audiencias={audiencias} idsDeals={idsDeals} programas={programas} />
    </div>
  );
}
