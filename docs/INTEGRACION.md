# Cómo integrar VoBo

VoBo es un servicio HTTP: recibe la acción que alguien quiere hacer y responde **PERMITIR**, **PEDIR VOBO humano** o **BLOQUEAR**, con el porqué. Este documento dice cómo lo conectamos a la forma de trabajar que 30X nos describió, qué quedó construido y probado, qué es solo diseño y cuáles son los límites.

> **Alcance.** Lo marcado **[dicho 30X]** es lo que 30X nos contó en sus respuestas del 17 de octubre; no lo hemos verificado y **no conocemos su instancia de n8n, su Slack ni su CRM**. Todo lo demás describe VoBo y ejemplos genéricos. Los números de latencia y costo salen del banco de pruebas sintético.

## 1. Lo que 30X nos contó

- **[dicho 30X]** Sus agentes corren en **Python, con n8n**.
- **[dicho 30X]** Las acciones salen hacia afuera por **API** (Google Workspace, Slack, CRM), por **tool calling / MCP** y por **webhooks**.
- **[dicho 30X]** Lo que quieren de una compuerta:
  1. **Un paso dentro de los flujos** por el que pase todo lo que sale hacia afuera.
  2. **La consulta del agente solo como complemento**, no como el mecanismo principal.
  3. **Aprobación por Slack** (WhatsApp para lo urgente, correo de respaldo) y **el CRM solo como registro**.

Así lo tradujimos:

| Lo que pidieron | Qué hay | Estado |
|---|---|---|
| Un paso dentro de los flujos | Flujo de n8n con VoBo como compuerta de salida (`integraciones/n8n/`) | **Construido y probado** (enrutamiento) |
| Consulta del agente como complemento | Envoltorio de Python (`integraciones/python/`) y un agente de ejemplo en TypeScript | **Construido y probado** |
| Aprobación en Slack | Nodo «Send and Wait» de n8n con el `resumen_aprobacion` | **Configurado, no probado contra Slack** |
| WhatsApp para urgentes, correo de respaldo | El `resumen_aprobacion` ya viene en un formato que sirve para WhatsApp | **Solo diseño** |
| CRM solo como registro | El campo `registro` (objeto plano) y un nodo que lo arma | **Solo diseño**: no se escribe en ningún CRM |

## 2. Qué construimos

### 2.1 El contrato de VoBo

`POST /api/evaluate` · `Content-Type: application/json` · demo pública: `https://vobo-jev.vercel.app/api/evaluate`

**Dos rutas, el mismo contrato.**

| Ruta | Para qué | Acceso | Límite |
|---|---|---|---|
| `/api/evaluate` | La demo y las pruebas | **Abierta**, sin clave | 20 por minuto por IP |
| `/api/v1/evaluate` | Integraciones | **Con clave**: `Authorization: Bearer <VOBO_API_KEY>` | 300 por minuto por IP; más de 10 intentos fallidos por minuto desde una IP reciben 429 |

La ruta `v1` responde **401** (con `WWW-Authenticate: Bearer`) si falta la clave o no coincide, y **503** si la instancia no tiene `VOBO_API_KEY` configurada (o tiene menos de 16 caracteres): nunca queda abierta por olvido. Hay **una sola clave compartida**: no hay rotación, cuotas ni identidad por cliente, y viaja en un encabezado, así que hay que usar HTTPS. La demo pública de este repositorio no tiene la clave configurada, por lo que allí `v1` responde 503. El resto de este documento describe el contrato, igual en las dos rutas.

**Petición**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `tipo_accion` | `correo_masivo` · `whatsapp_masivo` · `publicacion_redes` · `crm_update` | sí | |
| `canal` | texto | sí | Los oficiales son `correo_oficial`, `whatsapp_oficial`, `instagram_oficial`, `linkedin_oficial` y `crm`. |
| `destinatarios` | entero ≥ 0 | sí | `0` en publicaciones de redes. En `crm_update`, cuántos contactos toca el cambio. |
| `segmento_declarado` | `founders` · `ejecutivos` · `equipos_tecnicos` · `estudiantes` · `comunidad_general` | sí | |
| `hora_envio` | `HH:MM` (24 h, hora de Bogotá) | sí | |
| `texto` | texto, máximo 2.000 caracteres | sí | El contenido. En `crm_update`, el valor que se escribe. |
| `id` | texto | no | Tu identificador de la acción; vuelve en el resumen, en el registro y en el webhook. |
| `campo_crm` | texto | no | Solo en `crm_update`. |
| `fecha_evento_real` / `fecha_en_texto` | `AAAA-MM-DD` / texto | no | Si vienen las dos, el código las compara. |
| `precio_en_texto_usd` | número | no | Si viene, el código lo compara con el catálogo. |
| `en_lista_de_bajas` | entero | no | Cuántos destinatarios pidieron no recibir más mensajes. |
| `programa_ofrecido`, `audiencia_id`, `perfil_id` | texto | no | Ver `docs/BASE_CONOCIMIENTO_30X.md`. La afinidad de la audiencia la calcula el servidor desde `audiencia_id`: si la mandas, se ignora. |

Las cosas que se pueden resolver con código (contar, comparar fechas y precios, la lista de bajas) las decide el código y **no** se le pasan a JEV; a JEV solo le llega el `texto`.

**Respuesta (200)**

| Campo | Qué es |
|---|---|
| `schema_version` | Versión del contrato. Hoy `"1"`. Solo cambia si se **rompe o se quita** un campo; agregar campos no la cambia. |
| `request_id` | UUID de esta solicitud (también en el encabezado `x-request-id`). Correlaciona la decisión con tu registro y con el webhook. |
| `decision` | `ALLOW` (PERMITIR), `REVIEW` (PEDIR VOBO) o `BLOCK` (BLOQUEAR). Es el más severo entre `piso_reglas` y `riesgo_jev`. |
| `resumen_aprobacion` | **Texto corto en español para mandar a una persona** (Slack, WhatsApp): la acción, la decisión y 2–3 razones. Usa `*negritas*`, que ambos entienden. |
| `registro` | **Objeto plano** (solo textos y números) para guardar la decisión donde haga falta: `request_id`, `timestamp` (ISO, UTC), `decision`, `piso_reglas`, `riesgo_jev`, `reglas` (nombres separados por coma), `modelo`, `jev_estado`, `tipo_accion`, `id_accion`. |
| `piso_reglas`, `reglas` | Lo que decidió el código y cada regla que se activó, con su detalle. |
| `riesgo_jev`, `senales_jev`, `jev_estado` | Lo que opinó JEV: una señal por pregunta, con su probabilidad. `jev_estado` es `ok`, `fallo` (JEV no respondió: el riesgo pasa a `REVIEW`) u `omitido`. |
| `explicacion` | `titular` y `razones`, en español, de mayor a menor severidad. Texto fijo, no generado por un modelo. |
| `perfil`, `reversibilidad` | Con qué umbrales se evaluó: `estricto` (irreversible), `normal` (parcial) o `laxo` (reversible). |
| `jev_simulado` | `true` si respondió el JEV simulado (solo pruebas). Ninguna métrica sale de ahí. |
| `traza` | Modelo, `latencia_ms`, `input_tokens`, `costo_usd`, llamadas y las respuestas crudas de JEV. |

Los clientes deben **ignorar los campos que no conocen** y tratar un `schema_version` desconocido como una falla (ver §2.4).

**Errores**

| HTTP | Cuándo | Cuerpo |
|---|---|---|
| 400 | JSON roto o acción inválida | `{ "error", "detalles": [...] }` |
| 401 | Solo en `/api/v1/evaluate`: falta la clave o no es válida | `{ "error" }` |
| 429 | Se pasó el límite por minuto de la ruta (20 en la demo, 300 en `v1`) | `{ "error" }` |
| 503 | El modo es `live` y falta la llave de JEV en el servidor; o, en `v1`, falta `VOBO_API_KEY` | `{ "error" }` |

**Un ejemplo real.** Petición (un correo a 7.500 personas que promete resultados):

```json
{
  "id": "campana-nov-001",
  "tipo_accion": "correo_masivo",
  "canal": "correo_oficial",
  "destinatarios": 7500,
  "segmento_declarado": "comunidad_general",
  "hora_envio": "10:00",
  "programa_ofrecido": "AI Sales",
  "texto": "Inscríbete hoy en AI Sales: duplicarás tus ventas, resultado garantizado."
}
```

Respuesta, capturada con JEV real (`jev-1.14.0`). Se recortaron `traza.respuestas_crudas` y el `detalle` de cada señal para que quepa; todo lo demás es tal cual salió:

```json
{
  "schema_version": "1",
  "request_id": "e5296560-df3b-46df-b5fc-72cd74fe2f37",
  "decision": "BLOCK",
  "modo": "combinado",
  "piso_reglas": "REVIEW",
  "reglas": [
    { "regla": "audiencia_grande", "decision": "REVIEW", "detalle": { "n": 7500, "umbral": 5000 } }
  ],
  "riesgo_jev": "BLOCK",
  "senales_jev": [
    { "id": "promesa", "decision": "BLOCK", "estado": "alerta", "prob": 0.99, "opcion": "explicita", "confianza": 0.99, "detalle": "{ … }" },
    { "id": "certificacion", "decision": "ALLOW", "estado": "ok", "prob": 0.03, "detalle": {} },
    { "id": "datos_personales", "decision": "ALLOW", "estado": "ok", "prob": 0, "opcion": "ninguno", "confianza": 1, "detalle": "{ … }" },
    { "id": "instruccion_agente", "decision": "ALLOW", "estado": "ok", "prob": 0.1, "detalle": {} },
    { "id": "afirmacion", "decision": "REVIEW", "estado": "alerta", "prob": 1, "opcion": "sin_respaldo", "confianza": 1, "detalle": "{ … }" },
    { "id": "tono", "decision": "REVIEW", "estado": "duda", "prob": 0.97, "opcion": "sensacionalista", "confianza": 0.96, "detalle": "{ … }" }
  ],
  "jev_estado": "ok",
  "jev_simulado": false,
  "perfil": "estricto",
  "reversibilidad": "irreversible",
  "explicacion": {
    "titular": "BLOQUEAR: JEV estima un 99% de probabilidad de que el texto garantice un resultado.",
    "razones": [
      "JEV estima un 99% de probabilidad de que el texto garantice un resultado.",
      "Va a 7.500 destinatarios; por encima de 5.000 se pide VoBo humano.",
      "JEV estima un 100% de probabilidad de que el texto haga afirmaciones de impacto sin respaldo.",
      "JEV no está seguro (97%) de que el texto sea sensacionalista o alarmista; lo revisa una persona."
    ]
  },
  "traza": {
    "modelo": "jev-1.14.0",
    "latencia_ms": 582,
    "input_tokens": 1526,
    "costo_usd": 0.000064092,
    "llamadas": 1,
    "respuestas_crudas": "{ …omitido en este documento… }"
  },
  "resumen_aprobacion": "*VoBo: BLOQUEAR*\nAcción: correo masivo a 7.500 destinatarios por «correo_oficial» (id campana-nov-001)\nTexto: «Inscríbete hoy en AI Sales: duplicarás tus ventas, resultado garantizado.»\nPor qué:\n• JEV estima un 99% de probabilidad de que el texto garantice un resultado.\n• Va a 7.500 destinatarios; por encima de 5.000 se pide VoBo humano.\n• JEV estima un 100% de probabilidad de que el texto haga afirmaciones de impacto sin respaldo.\n(y 1 más en el detalle)\nSolicitud: e5296560",
  "registro": {
    "request_id": "e5296560-df3b-46df-b5fc-72cd74fe2f37",
    "timestamp": "2026-10-17T22:52:16.092Z",
    "decision": "BLOCK",
    "piso_reglas": "REVIEW",
    "riesgo_jev": "BLOCK",
    "reglas": "audiencia_grande",
    "modelo": "jev-1.14.0",
    "jev_estado": "ok",
    "tipo_accion": "correo_masivo",
    "id_accion": "campana-nov-001"
  }
}
```

Las reglas por sí solas habrían dicho PEDIR VOBO (audiencia grande); fue JEV quien lo subió a BLOQUEAR por la promesa. **JEV solo puede subir el riesgo, nunca bajarlo.**

### 2.2 El paso dentro del flujo de n8n (el principal)

`integraciones/n8n/vobo-compuerta.workflow.json` es un flujo importable que pone a VoBo como el paso por el que pasa lo que sale hacia afuera:

**Webhook** (simula la salida de un agente) → **Armar la acción** → **Evaluar con VoBo** (HTTP Request, tiempo límite 5 s) → **Decidir** (Switch por `decision`):

- **PERMITIR** → ejecuta la acción.
- **PEDIR VOBO** → Slack «Send and Wait for Response» con el `resumen_aprobacion`; si aprueban, ejecuta; si rechazan, detiene.
- **BLOQUEAR** → avisa en Slack y detiene.
- **Error de la llamada a VoBo** (la salida de error del HTTP Request) o una decisión desconocida → la rama de PEDIR VOBO. **Nunca a PERMITIR.**
- Todas las ramas terminan en **Registrar decisión**, un nodo placeholder que arma el `registro`.

**Qué se probó.** El 17 de octubre, en un n8n 2.43.7 local (instalado con npm en una carpeta temporal): el archivo importa; el flujo enruta las cuatro decisiones y las cuatro fallas (VoBo caído, VoBo colgado —corta a los 5 s—, VoBo con 500 y VoBo con una decisión desconocida) a PEDIR VOBO sin ejecutar, y solo ejecuta con una aprobación humana explícita. **Qué no:** los nodos de Slack reales no se ejecutaron contra Slack (sin credencial); el enrutamiento se probó con simuladores del mismo nombre, y con un canal en formato válido n8n aceptó los nodos reales y fallaron solo por la credencial ausente. El detalle, la lista de pruebas y cómo configurarlo están en [`integraciones/n8n/LEEME.md`](../integraciones/n8n/LEEME.md). Es un ejemplo: reemplaza los placeholders por tus acciones reales.

### 2.3 El envoltorio de Python (complemento)

`integraciones/python/vobo_gate.py` (solo biblioteca estándar) envuelve las funciones-herramienta de un agente en Python:

```python
from vobo_gate import vobo_gate

@vobo_gate(
    a_accion=lambda destinatarios, texto: {
        "tipo_accion": "correo_masivo", "canal": "correo_oficial", "destinatarios": destinatarios,
        "segmento_declarado": "comunidad_general", "hora_envio": "10:00", "texto": texto,
    },
    solicitar_aprobacion=lambda veredicto, accion: pedir_en_slack(veredicto.resumen_aprobacion),  # True para aprobar
)
def enviar_correo_masivo(destinatarios, texto): ...
```

- **PERMITIR** → ejecuta. **PEDIR VOBO** → ejecuta *solo* si `solicitar_aprobacion` devuelve exactamente `True`; si devuelve otra cosa, lanza una excepción o no hay callback, se lanza `VoboNoAprobado`. **BLOQUEAR** → `VoboBloqueado`.
- Falla cerrada (ver §2.4). Funciona con funciones síncronas y `async`. Tiene modo sombra y un observador (`al_decidir`) para registrar cada decisión.
- Configuración: `VOBO_URL`, `VOBO_EVALUATE_PATH`, `VOBO_API_KEY`, `VOBO_TIMEOUT`.

```bash
npm run test:python                       # 19 pruebas contra un servidor falso (unittest)
VOBO_URL=https://vobo-jev.vercel.app python integraciones/python/demo_vobo_gate.py
```

Las pruebas cubren los tres veredictos, el callback (rechazo, sin callback, que falla, que devuelve algo «verdadero» pero que no es `True`), el modo sombra, las funciones `async` y cada falla: 500, 503, 429, 400, 401, 204, HTML, JSON que no es un objeto, `schema_version` desconocido, decisión inválida, servidor colgado (tiempo agotado), servidor caído y URLs inválidas.

### 2.4 Falla cerrada

Regla única: **si no hay una respuesta válida de VoBo, la acción no se ejecuta sola: se trata como PEDIR VOBO.** Un error nunca debe equivaler a PERMITIR.

| Qué pasa | Decisión efectiva |
|---|---|
| 200 con `schema_version: "1"` y `decision: "ALLOW"` | PERMITIR |
| 200 con `decision: "REVIEW"` | PEDIR VOBO |
| 200 con `decision: "BLOCK"` | BLOQUEAR |
| 200 con `jev_estado: "fallo"` (JEV no respondió; el servidor ya subió el riesgo a `REVIEW`) | PEDIR VOBO |
| Red caída, tiempo agotado, 5xx, 429, 503 | PEDIR VOBO |
| 401 (la clave de la integración falta o no es válida: es un error de configuración) | PEDIR VOBO, y se registra para corregirlo |
| 400 (la acción está mal armada: es un error del agente) | PEDIR VOBO, y se registra para corregirlo |
| Cuerpo que no es JSON, `decision` inesperada o `schema_version` que el cliente no conoce | PEDIR VOBO |

El flujo de n8n y el envoltorio de Python implementan esta tabla, y ambos se probaron contra servidores falsos que fallan de esas formas.

### 2.5 Latencia y costo (medidos)

Sobre las 145 acciones del conjunto principal del test, con JEV real (`jev-1.14.0`), desde un computador de desarrollo:

| | |
|---|---|
| Latencia de la evaluación (p50 / p95) | **399 ms / 650 ms** |
| Tokens de entrada por decisión | 1.534 (en promedio) |
| **Costo por 1.000 decisiones** | **≈ USD 0,064** |

Una sola llamada a JEV responde las 7 preguntas. La latencia depende de dónde corra VoBo: desde la instancia desplegada en Vercel, una corrida de la simulación (20 acciones, una sola muestra, JEV real) dio una latencia media de JEV de 97 ms. Dos matices honestos:

- La **primera** llamada real que hicimos tardó 6,1 s, probablemente un arranque en frío. Cada llamada a JEV tiene un tiempo límite de 3 s y hasta 2 reintentos, así que **en el peor caso el servidor tarda unos 10 s antes de rendirse** y devolver `jev_estado: "fallo"`. Por eso los clientes de ejemplo cortan antes (5 s) y fallan cerrado.
- El límite de 20 solicitudes por minuto por IP es de la **demo pública**. Para tráfico real hay que desplegar tu propia instancia y definir tus límites.

### 2.6 Modo sombra

Antes de dejar que VoBo frene algo, pon la integración en modo sombra: consulta a VoBo en cada acción, **registra** lo que habría decidido y ejecuta igual. El envoltorio de Python lo trae (`modo_sombra=True`) y el agente de ejemplo en TypeScript también (`VOBO_SOMBRA=1`). Así mides sin riesgo cuántas acciones habría escalado y cuántas bloqueado. El camino recomendado es el de la hoja de ruta del README: **sombra → etiquetar lo que escala → ajustar los umbrales con esos datos → aplicar → monitorear.** Guarda el `request_id` de cada decisión: es lo que permite etiquetar después. Los umbrales de VoBo se ajustaron a un banco sintético, no a tu tráfico.

### 2.7 Webhook de revisión (opcional)

Si defines `VOBO_REVIEW_WEBHOOK_URL`, cada vez que una acción queda en PEDIR VOBO o BLOQUEAR, VoBo envía un `POST` JSON a esa URL con `request_id`, `decision`, `tipo_accion`, `id`, `explicacion` y `reglas`. Va **después** de responder (con `after()` de Next.js), tiene un tiempo límite de 2 s, no se reintenta y nunca bloquea ni cambia la respuesta. Sin la variable no hace nada. Sirve para avisar; no sustituye a un sistema de aprobación.

### 2.8 Patrón complementario: el agente consulta antes de actuar

Dos ejemplos en TypeScript, que **no son el paso principal** (el principal es la compuerta dentro del flujo, §2.2):

- `examples/agente-demo.ts` (`npm run agente-demo`): un agente simulado con tres herramientas, una cola en memoria y la falla cerrada.
- `adapters/crm-webhook.ts`: traduce un webhook genérico `deal.updated` a una acción de VoBo. Está rotulado como ejemplo: el mapeo real depende del stack de cada empresa.

Suman una segunda barrera cuando el agente decide por su cuenta, pero **no cubren** las llamadas que el agente haga sin consultar.

## 3. Qué es solo diseño

Nada de esto está construido ni probado:

- **Slack con botones reales.** El flujo de n8n trae el nodo «Send and Wait for Response» configurado, pero **no se ejecutó contra Slack**. Los botones, el mensaje en el canal y la espera de la respuesta quedan sin verificar.
- **WhatsApp para lo urgente.** No hay nodo ni criterio de qué es «urgente». El `resumen_aprobacion` ya viene en un formato que sirve para WhatsApp (texto corto, `*negritas*`).
- **Correo de respaldo.** No hay nada construido: sería otro nodo de salida con el mismo resumen.
- **Escritura en el CRM como registro.** El `registro` es un objeto plano listo para guardar, y el nodo **Registrar decisión** lo arma, pero **no escribe en ningún sistema**.
- **Una cola de aprobación real.** La cola del agente de ejemplo vive en la memoria del proceso y la página `/cola` de la demo guarda su estado solo en el navegador. Con n8n, la «cola» es la espera de Slack: no hay un tablero propio, ni estado persistente fuera de n8n.

## 4. Límites

- **Solo se evalúa lo que pasa por la compuerta.** Una llamada directa que no pase por el flujo de n8n ni por el envoltorio (un script que llama a una API por su cuenta, una herramienta sin envolver) **no se evalúa**.
- **Cuatro tipos de acción.** VoBo modela correo masivo, WhatsApp masivo, publicación en redes y cambio en el CRM. El **«envío de información»** (compartir datos o documentos con terceros por API, por ejemplo) **no está modelado**: no hay reglas ni preguntas para eso.
- **Mensajes uno a uno.** Se evalúa una acción a la vez. No modelamos mensajes personalizados por destinatario ni lotes con contenido distinto por persona: cada mensaje distinto es otra llamada.
- **El endpoint de la demo es público** (`/api/evaluate`): sin clave y con un límite por IP en memoria (en Vercel cada instancia lleva su propia cuenta, así que es de mejor esfuerzo). Para integraciones existe `/api/v1/evaluate` con una clave Bearer, pero es **una sola clave compartida**, sin rotación, cuotas ni identidad por cliente.
- **El texto de los mensajes viaja a JEV, un tercero** (TypeSafe). Hay que decidir qué contenido se puede mandar; todo lo que probamos es sintético.
- **Garantías del webhook:** sin firma, sin reintentos y sin orden garantizado (a lo más una vez).
- **VoBo no guarda nada.** Quien integra debe guardar el `request_id` y el `registro` si necesita auditoría.
- **Tráfico real.** Solo probamos con el banco sintético y casos de demostración; no hicimos pruebas de carga.
- **La política es de demostración** (`data/policy_demo.json`, con supuestos por confirmar con 30X) y los umbrales se ajustaron con el banco sintético.
- **El stack real de 30X.** No conocemos su n8n, su Slack ni su CRM; el flujo y los adaptadores son ejemplos y el mapeo real hay que escribirlo contra los sistemas reales.
