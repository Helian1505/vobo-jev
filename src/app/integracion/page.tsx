import type { Metadata } from "next";
import { DiagramaPuerta } from "@/components/DiagramaPuerta";
import { EncabezadoPagina } from "@/components/EncabezadoPagina";
import { Revelar } from "@/components/Revelar";

const REPO = "https://github.com/Helian1505/vobo-jev";

export const metadata: Metadata = {
  title: "Integración — VoBo",
  description: "Cómo se pone VoBo en 30X: una puerta de salida dentro de las herramientas del agente, aviso en Slack y registro de cada decisión.",
};

const PUNTOS = [
  {
    titulo: "Una sola puerta, dentro de la herramienta del agente",
    texto: "Las herramientas de salida (correo, WhatsApp, redes, HubSpot) llaman a VoBo antes de ejecutar. La consulta no depende de que el agente decida preguntar.",
  },
  {
    titulo: "Las llaves viven solo en la puerta",
    texto: "Los agentes no tienen las credenciales de HubSpot ni de WhatsApp: todo lo que sale pasa por el mismo punto auditable.",
  },
  {
    titulo: "Falla cerrada",
    texto: "Si VoBo no responde, tarda o devuelve algo inválido, la acción no sale y espera a una persona. Probado contra servidores caídos y colgados.",
  },
  {
    titulo: "Un solo modelo, con lo mínimo",
    texto: "JEV es el único modelo y solo ve el texto que va a salir, el tipo y el canal. Sin otro LLM y sin datos de las personas.",
  },
];

const ESTADO = [
  { que: "Puerta de salida MCP en Python", estado: "Construida y probada contra la demo (PERMITIR, PEDIR VOBO y BLOQUEAR)." },
  { que: "Aviso a Slack de lo que pide VoBo", estado: "Probado contra un Slack de prueba." },
  { que: "Ejecución en HubSpot y WhatsApp", estado: "Ejemplo, no conectado a los sistemas de 30X." },
  { que: "Registro en HubSpot", estado: "Solo diseño: no se escribe en ningún CRM." },
];

export default function PaginaIntegracion() {
  return (
    <div className="space-y-8">
      <EncabezadoPagina etiqueta="Integración" titulo="Un paso antes de todo lo que sale hacia afuera.">
        <p className="mt-5 text-base leading-relaxed text-fg-soft sm:text-lg">
          Así se pondría VoBo en el flujo que 30X nos describió: agentes en Python, aprobación por Slack y HubSpot solo como
          registro.
        </p>
      </EncabezadoPagina>

      <Revelar>
        <div className="hairline rounded-card bg-surface p-4 sm:p-6">
          <DiagramaPuerta />
        </div>
      </Revelar>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PUNTOS.map((p, i) => (
          <Revelar key={p.titulo} retraso={i * 110} className="h-full">
            <div className="elevar hairline h-full rounded-card bg-surface p-5">
              <p className="font-display text-base text-fg">{p.titulo}</p>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{p.texto}</p>
            </div>
          </Revelar>
        ))}
      </div>

      <Revelar>
      <section aria-labelledby="titulo-estado" className="border-t border-line pt-8">
        <h2 id="titulo-estado" className="font-display text-xl text-fg">
          Qué está construido y qué no
        </h2>
        <dl className="mt-4 divide-y divide-line rounded-card border border-line">
          {ESTADO.map((e) => (
            <div key={e.que} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-6 sm:px-5">
              <dt className="text-sm font-medium text-fg">{e.que}</dt>
              <dd className="text-sm text-fg-muted">{e.estado}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm text-fg-muted">
          Código y detalle:{" "}
          <a className="text-fg-soft underline underline-offset-4 hover:text-fg" href={`${REPO}/tree/main/integraciones/mcp`}>
            puerta de salida MCP
          </a>
          {" · "}
          <a className="text-fg-soft underline underline-offset-4 hover:text-fg" href={`${REPO}/blob/main/docs/INTEGRACION.md`}>
            guía de integración
          </a>
          .
        </p>
      </section>
      </Revelar>
    </div>
  );
}
