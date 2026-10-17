import { Demo, type AudienciaResumen, type EjemploDemo } from "@/components/Demo";
import ejemplosJson from "../../data/ejemplos_demo.json";
import { AUDIENCIAS, resolverAudiencia } from "@/lib/vobo/audiencias";
import { DEAL, PERFILES } from "@/lib/vobo/perfiles";
import { POLICY } from "@/lib/vobo/policy";

export default function Home() {
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
    <>
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">VoBo</h1>
        <p className="mt-1 text-lg text-slate-800">El visto bueno antes de que un agente actúe.</p>
        <p className="mt-2 max-w-3xl text-sm text-slate-700">
          VoBo revisa cada acción que propone un agente interno de 30X (correo masivo, WhatsApp masivo, publicación en
          redes o cambio en el CRM) y responde PERMITIR, PEDIR VOBO humano o BLOQUEAR, con el porqué. Las reglas las
          aplica el código; JEV, el modelo de TypeSafe, solo puede subir el riesgo; y ante la duda o un fallo decide una
          persona.
        </p>
      </header>
      <Demo ejemplos={ejemplos} audiencias={audiencias} idsDeals={idsDeals} programas={programas} />
    </>
  );
}
