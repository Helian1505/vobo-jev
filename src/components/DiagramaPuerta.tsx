/**
 * Diagrama de la puerta de salida: el agente de 30X propone una acción, VoBo decide y solo lo permitido llega a
 * HubSpot, WhatsApp o redes. Lo dudoso va a una persona (aviso por Slack) y cada decisión queda registrada.
 * Todo con líneas finas; VoBo es el único nodo con borde lima.
 */

function Nodo({
  x,
  y,
  ancho,
  alto,
  titulo,
  detalle,
  destacado = false,
}: {
  x: number;
  y: number;
  ancho: number;
  alto: number;
  titulo: string;
  detalle: string;
  destacado?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={ancho}
        height={alto}
        rx={12}
        className={destacado ? "fill-surface stroke-accent" : "fill-surface stroke-line-strong"}
        strokeWidth={destacado ? 1.5 : 1}
      />
      <text x={x + 18} y={y + alto / 2 - 4} className="fill-fg" fontSize={destacado ? 22 : 16} fontWeight={600}>
        {titulo}
      </text>
      <text x={x + 18} y={y + alto / 2 + 18} className="fill-fg-muted" fontSize={12.5}>
        {detalle}
      </text>
    </g>
  );
}

function Flecha({ d, punteada = false, acento = false }: { d: string; punteada?: boolean; acento?: boolean }) {
  return (
    <path
      d={d}
      fill="none"
      className={acento ? "stroke-accent" : "stroke-fg-faint"}
      strokeWidth={1.25}
      strokeDasharray={punteada ? "4 5" : undefined}
      markerEnd={acento ? "url(#punta-acento)" : "url(#punta)"}
    />
  );
}

function Etiqueta({ x, y, texto }: { x: number; y: number; texto: string }) {
  return (
    <text x={x} y={y} className="fill-fg-faint" fontSize={11.5} fontWeight={500} letterSpacing="0.06em">
      {texto}
    </text>
  );
}

export function DiagramaPuerta() {
  return (
    <svg
      viewBox="0 0 960 430"
      className="h-auto w-full"
      role="img"
      aria-labelledby="diagrama-titulo diagrama-desc"
    >
      <title id="diagrama-titulo">La puerta de salida de VoBo dentro del flujo de 30X</title>
      <desc id="diagrama-desc">
        El agente de 30X propone una acción. La herramienta con la que la ejecuta llama primero a VoBo, que aplica reglas en
        código y consulta a JEV. Lo permitido sale hacia HubSpot, WhatsApp o redes. Lo dudoso se avisa por Slack para que
        decida una persona. Cada decisión queda registrada con el ID de HubSpot y un request_id.
      </desc>
      <defs>
        <marker id="punta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" className="fill-fg-faint" />
        </marker>
        <marker id="punta-acento" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" className="fill-accent" />
        </marker>
      </defs>

      <Nodo x={20} y={140} ancho={200} alto={84} titulo="Agente de 30X" detalle="Python · tool calling o MCP" />
      <Flecha d="M222 182 L 318 182" />
      <Etiqueta x={232} y={170} texto="PROPONE" />

      <Nodo x={322} y={112} ancho={270} alto={140} titulo="VoBo" detalle="Reglas en código + JEV · ≈ 0,4 s" destacado />
      <text x={340} y={230} className="fill-fg-faint" fontSize={11.5}>
        Falla cerrada: sin respuesta, no sale
      </text>

      <Flecha d="M594 160 C 640 160, 640 66, 690 66" acento />
      <Flecha d="M594 182 L 690 182" acento />
      <Flecha d="M594 204 C 640 204, 640 298, 690 298" acento />
      <Etiqueta x={604} y={124} texto="PERMITIDO" />

      <Nodo x={694} y={30} ancho={246} alto={72} titulo="HubSpot" detalle="Cambios en contactos y deals" />
      <Nodo x={694} y={146} ancho={246} alto={72} titulo="WhatsApp" detalle="Mensajes desde el número oficial" />
      <Nodo x={694} y={262} ancho={246} alto={72} titulo="Correo y redes" detalle="Envíos masivos y publicaciones" />

      <Flecha d="M457 254 L 457 330" />
      <Etiqueta x={468} y={300} texto="LO DUDOSO" />
      <Nodo x={342} y={334} ancho={230} alto={72} titulo="Slack" detalle="Una persona decide, con el porqué" />

      <Flecha d="M322 236 C 250 300, 190 330, 170 334" punteada />
      <Nodo x={20} y={334} ancho={260} alto={72} titulo="Registro" detalle="ID de HubSpot + request_id" />
    </svg>
  );
}
