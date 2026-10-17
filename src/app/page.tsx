import { Insignia } from "@/components/ResultadoPanel";
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
      <header className="mb-10 max-w-3xl sm:mb-12">
        <h1 className="font-display text-4xl font-bold leading-[1.1] tracking-tight text-fg sm:text-5xl">
          El visto bueno antes de que un agente <span className="text-accent">actúe</span>.
        </h1>
        <p className="mt-5 text-base leading-relaxed text-fg-soft sm:text-lg">
          VoBo revisa cada acción que propone un agente interno de 30X (correo masivo, WhatsApp masivo, publicación en
          redes o cambio en el CRM) y responde con una de tres decisiones, siempre con el porqué.
        </p>
        <ul className="mt-5 flex flex-wrap gap-2" aria-label="Las tres decisiones posibles">
          <li><Insignia decision="ALLOW" /></li>
          <li><Insignia decision="REVIEW" /></li>
          <li><Insignia decision="BLOCK" /></li>
        </ul>
        <p className="mt-5 text-sm leading-relaxed text-fg-muted">
          Las reglas las aplica el código. JEV, el modelo de TypeSafe, solo puede subir el riesgo, nunca bajarlo. Ante la
          duda o un fallo, decide una persona.
        </p>
      </header>
      <Demo ejemplos={ejemplos} audiencias={audiencias} idsDeals={idsDeals} programas={programas} />
    </>
  );
}
