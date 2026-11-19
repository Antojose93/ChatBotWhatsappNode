# FusionChatbot

> **Documentación vigente:** este proyecto utiliza SQLite para las
> conversaciones y admite múltiples personalidades. Las referencias antiguas a
> guardar conversaciones exclusivamente en JSON describen únicamente el formato
> de migración heredado; consulta las secciones 17 a 19 al final de este documento.

## 1. ¿Qué es este proyecto?

FusionChatbot es un ayudante que vive dentro de WhatsApp.

Imagina que tienes una pequeña tienda de comidas. Una persona escribe por WhatsApp y el bot puede:

- leer el mensaje;
- recordar mensajes anteriores;
- responder en español;
- usar Gemini para preparar la respuesta;
- enviar la respuesta dividida en varios mensajes pequeños.

Además, el proyecto tiene una pequeña API HTTP. Una aplicación frontend puede usar esa API para:

- saber si WhatsApp está conectado;
- pedir que se inicie la conexión;
- mostrar el código QR;
- saber cuándo el usuario escaneó el QR;
- desconectar WhatsApp.

## 2. La idea más importante

Hay dos partes principales:

```text
Frontend  ────────>  API Express  ────────>  WhatsApp
                         │
                         └───────────────>  Gemini
```

El frontend es la pantalla que ve la persona.

El backend es el servidor que trabaja detrás de la pantalla.

WhatsApp es el servicio donde llegan y salen los mensajes.

Gemini es el servicio que ayuda a escribir respuestas.

## 3. Tecnologías utilizadas

- Node.js: ejecuta el backend.
- TypeScript: ayuda a escribir código más seguro.
- Express: crea la API HTTP.
- `@whatsmeow-node/whatsmeow-node`: conecta el backend con WhatsApp.
- Gemini: genera respuestas del chatbot.
- SQLite: guarda las bases de datos en `data/`: `session.db`, `conversations.db` y `personalidades.db`.
- SQLite: guarda las conversaciones del chatbot; los archivos JSON solo se usan para migración y respaldo.
- Server-Sent Events (SSE): envía cambios de conexión al frontend en tiempo real.

## 4. Estructura de carpetas

```text
FusionChatbot/
├── src/
│   ├── api/
│   │   └── routes.ts
│   ├── bootstrap/
│   │   └── main.ts
│   ├── chat/
│   │   ├── chatbot.ts
│   │   ├── conversation-store.ts
│   │   └── message-splitter.ts
│   ├── config/
│   │   └── index.ts
│   ├── integrations/
│   │   ├── gemini-client.ts
│   │   └── whatsapp-connection.ts
│   └── persona/
│       └── index.ts
├── conversations/
├── persona.json
├── session.db
├── .env
├── package.json
├── tsconfig.json
└── README.md
```

### `src/bootstrap/main.ts`

Es la puerta principal del programa.

Hace estas cosas:

1. enciende Express;
2. configura CORS para el frontend;
3. crea la conexión de WhatsApp;
4. crea el chatbot;
5. registra los eventos de WhatsApp;
6. registra las rutas HTTP;
7. prepara el apagado ordenado del servidor.

WhatsApp no se conecta automáticamente al arrancar. El frontend debe pedirlo usando `POST /api/whatsapp/connect`.

### `src/api/routes.ts`

Contiene las rutas que puede llamar el frontend.

### `src/integrations/whatsapp-connection.ts`

Es el encargado de observar WhatsApp.

Guarda información como:

- si está conectado;
- cuál es el estado actual;
- cuál es el QR actual;
- cuál es el `jid` de la cuenta conectada;
- si ocurrió un error.

También permite crear un cliente nuevo después de desconectar. Por eso ya no es necesario reiniciar todo el backend para volver a conectar.

### `src/chat/chatbot.ts`

Es el cerebro del bot.

Cuando llega un mensaje:

1. ignora mensajes enviados por el propio bot;
2. busca el texto del mensaje;
3. marca el mensaje como leído;
4. carga el historial de la conversación;
5. pregunta a Gemini;
6. divide la respuesta en partes pequeñas;
7. envía las partes con una pausa entre ellas;
8. guarda la conversación.

En un grupo, cada persona tiene su propio historial. En un chat privado, el historial pertenece al chat.

### `src/chat/sqlite-conversation-store.ts`

Guarda conversaciones en `conversations.db` mediante SQLite nativo de Node.js.
Los archivos JSON de `conversations/` solo se leen durante la migración inicial.

La tabla principal tiene esta forma conceptual:

```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

El historial se limita usando `MAX_HISTORY`.

### `src/chat/message-splitter.ts`

Divide respuestas largas en mensajes más cortos.

Esto permite que el bot envíe algo como:

```text
Hola, tenemos hamburguesas y pizzas.
¿Quieres ver el menú?
```

en mensajes separados, si la configuración lo indica.

### `src/integrations/gemini-client.ts`

Es el adaptador que llama a la API de Gemini.

Si no existe `GEMINI_API_KEY`, el bot devuelve un mensaje de aviso en lugar de intentar conectarse.

### `src/persona/index.ts` y `persona.json`

La personalidad le dice al bot cómo hablar.

Por ejemplo:

- qué negocio representa;
- en qué idioma responde;
- qué productos conoce;
- qué precios puede mencionar;
- qué cosas no debe inventar.

## 5. Instalar el proyecto

Necesitas tener instalado Node.js.

Desde la carpeta del proyecto ejecuta:

```bash
npm install
```

Este comando descarga las librerías necesarias.

## 6. Configurar el archivo `.env`

Crea un archivo llamado `.env` en la raíz del proyecto.

Ejemplo:

```env
PORT=5001
CORS_ORIGIN=http://localhost:5173
GEMINI_API_KEY=tu_clave_de_gemini
GEMINI_MODEL=gemini-2.0-flash
CONVERSATIONS_DIR=conversations
PERSONA_FILE_PATH=persona.json
MESSAGE_CHUNK_MAX_LINES=3
MESSAGE_CHUNK_MAX_CHARS=100
MESSAGE_DELAY_MIN=2
MESSAGE_DELAY_MAX=5
MAX_HISTORY=20
```

### Significado de cada variable

| Variable | Para qué sirve | Valor predeterminado |
|---|---|---|
| `PORT` | Puerto HTTP del backend | `3000` |
| `CORS_ORIGIN` | Dirección permitida del frontend | `http://localhost:5173` |
| `GEMINI_API_KEY` | Llave para usar Gemini | Sin valor |
| `GEMINI_MODEL` | Modelo de Gemini | `gemini-2.0-flash` |
| `CONVERSATIONS_DIR` | Carpeta de conversaciones | `conversations` |
| `PERSONA_FILE_PATH` | Archivo de personalidad | `persona.json` |
| `MESSAGE_CHUNK_MAX_LINES` | Líneas máximas por mensaje | `3` |
| `MESSAGE_CHUNK_MAX_CHARS` | Caracteres máximos por línea | `100` |
| `MESSAGE_DELAY_MIN` | Pausa mínima entre mensajes, en segundos | `2` |
| `MESSAGE_DELAY_MAX` | Pausa máxima entre mensajes, en segundos | `5` |
| `MAX_HISTORY` | Cantidad de intercambios recordados | `20` |

No compartas `.env`. Allí puede vivir una clave secreta.

## 7. Ejecutar el backend

Para arrancarlo:

```bash
npm run start
```

Si usas el ejemplo anterior, aparecerá algo parecido a:

```text
API HTTP escuchando en http://localhost:5001
```

Para revisar los tipos de TypeScript:

```bash
npm run typecheck
```

## 8. Estados de WhatsApp

El backend usa estos estados:

| Estado | Qué significa |
|---|---|
| `idle` | Todavía no se ha pedido iniciar la conexión |
| `connecting` | El backend está preparando WhatsApp |
| `awaiting_qr` | Hay un QR esperando ser escaneado |
| `connected` | WhatsApp está conectado |
| `disconnected` | WhatsApp está desconectado |
| `logged_out` | La sesión fue cerrada y hay que autenticar otra vez |

## 9. API para el frontend

La dirección base del ejemplo es:

```text
http://localhost:5001/api
```

Si cambias `PORT`, debes cambiar también esa dirección.

### 9.1 Iniciar la conexión

```http
POST /api/whatsapp/connect
```

Ejemplo:

```bash
curl.exe -X POST http://localhost:5001/api/whatsapp/connect
```

Respuesta mientras se prepara:

```json
{
  "connected": false,
  "state": "connecting"
}
```

Si ya existe una sesión guardada, puede conectarse sin mostrar QR.

### 9.2 Escuchar cambios con SSE

```http
GET /api/whatsapp/events
```

SSE es como una llamada telefónica en la que el backend puede avisar al frontend cuando algo cambia.

En JavaScript:

```ts
const events = new EventSource(
  "http://localhost:5001/api/whatsapp/events",
);

events.addEventListener("status", (event) => {
  const data = JSON.parse(event.data);
  console.log("Estado:", data.state);
});

events.addEventListener("qr", (event) => {
  const data = JSON.parse(event.data);
  console.log("Código QR:", data.qr.code);
});

events.addEventListener("connected", (event) => {
  const data = JSON.parse(event.data);
  console.log("Conectado como:", data.jid);
  events.close();
});

events.addEventListener("disconnected", () => {
  console.log("WhatsApp se desconectó");
});

events.addEventListener("logged_out", () => {
  console.log("La sesión fue cerrada");
});
```

El backend envía estos eventos:

#### Evento `status`

Indica el estado actual.

```text
event: status
data: {"connected":false,"state":"connecting"}
```

#### Evento `qr`

Contiene el código que el frontend debe convertir en una imagen QR.

```text
event: qr
data: {"connected":false,"state":"awaiting_qr","qr":{"code":"2@...","generatedAt":"2026-09-07T18:30:00.000Z"}}
```

El frontend puede usar una librería QR para mostrar `data.qr.code`.

#### Evento `connected`

Significa que el usuario ya escaneó el QR correctamente.

```text
event: connected
data: {"connected":true,"state":"connected","jid":"573011321468:5@s.whatsapp.net"}
```

En este momento el frontend puede cerrar el diálogo de conexión.

#### Eventos `disconnected` y `logged_out`

Informan que la conexión terminó o que la sesión fue cerrada.

El frontend debe cerrar el `EventSource` cuando ya no necesite escuchar eventos.

### 9.3 Consultar el estado actual

```http
GET /api/whatsapp/auth
```

Ejemplo:

```bash
curl.exe http://localhost:5001/api/whatsapp/auth
```

Respuesta conectada:

```json
{
  "connected": true,
  "state": "connected",
  "jid": "573011321468:5@s.whatsapp.net"
}
```

Este endpoint sirve como consulta inicial o como respaldo si se pierde la conexión SSE.

### 9.4 Desconectar

```http
POST /api/whatsapp/disconnect
```

Ejemplo:

```bash
curl.exe -X POST http://localhost:5001/api/whatsapp/disconnect
```

La sesión guardada no se elimina.

Después se puede volver a conectar usando:

```bash
curl.exe -X POST http://localhost:5001/api/whatsapp/connect
```

No es necesario reiniciar el backend.

## 10. Flujo completo de conexión

```text
Frontend abre el diálogo
        │
        ▼
POST /api/whatsapp/connect
        │
        ▼
GET /api/whatsapp/events
        │
        ├── status: connecting
        │
        ├── qr: mostrar QR
        │
        ├── connected: cerrar diálogo
        │
        └── logged_out: pedir autenticación nueva
```

Una recomendación práctica es abrir SSE antes de llamar a `connect`, para no perder un evento QR muy rápido.

## 11. Cómo probar el QR

Si `session.db` ya tiene una sesión autenticada, WhatsApp se conectará sin pedir QR.

Para probar un QR nuevo:

1. detén el backend;
2. respalda `session.db`, `session.db-wal` y `session.db-shm`;
3. inicia nuevamente el backend;
4. abre SSE;
5. ejecuta `POST /api/whatsapp/connect`;
6. escanea el QR desde WhatsApp.

En PowerShell:

```powershell
$backup = "E:\FusionChatbot\backups\session-before-qr"
New-Item -ItemType Directory -Force -Path $backup

Move-Item -LiteralPath "E:\FusionChatbot\session.db" -Destination $backup -ErrorAction SilentlyContinue
Move-Item -LiteralPath "E:\FusionChatbot\session.db-wal" -Destination $backup -ErrorAction SilentlyContinue
Move-Item -LiteralPath "E:\FusionChatbot\session.db-shm" -Destination $backup -ErrorAction SilentlyContinue
```

Después inicia el backend y ejecuta:

```bash
curl.exe -N http://localhost:5001/api/whatsapp/events
```

En otra terminal:

```bash
curl.exe -X POST http://localhost:5001/api/whatsapp/connect
```

## 12. Archivos de datos importantes

### `session.db`

Guarda la sesión de WhatsApp.

Si existe, normalmente no hace falta escanear un nuevo QR.

### `session.db-wal` y `session.db-shm`

Son archivos auxiliares de SQLite. Cuando se respalde o mueva la sesión, deben tratarse junto con `session.db`.

### `conversations.db` y migración JSON

Guarda el historial de los chats del bot. La carpeta JSON solo se conserva para
la migración y como respaldo temporal.

### `persona.json` y `personas/`

Define cómo habla el asistente y qué información conoce.

## 13. Cómo cambiar la personalidad

Para una instalación nueva, agrega archivos JSON en `personas/`; consulta
[`personas/README.md`](personas/README.md). El archivo `persona.json` continúa
funcionando como formato compatible cuando `personas/` no existe.

Ejemplo pequeño:

```json
{
  "name": "Sabor Express",
  "base_prompt": "Responde en español, de forma amable y breve.",
  "description": "Ayudas a los clientes a consultar el menú y preparar pedidos."
}
```

Si el archivo no se puede leer, el bot usa una personalidad predeterminada.

## 14. Problemas comunes

### `Cannot POST /api/whatsapp/connect`

El backend probablemente está ejecutando una versión vieja.

Detén el proceso y vuelve a iniciarlo:

```bash
npm run start
```

### Error de CORS

Comprueba que el frontend funciona en el origen configurado:

```env
CORS_ORIGIN=http://localhost:5173
```

Después reinicia el backend.

### El QR no aparece

Puede existir una sesión guardada en `session.db`. Respalda temporalmente los archivos de sesión y vuelve a iniciar.

### El endpoint devuelve `connected: true` sin mostrar QR

Eso significa que WhatsApp encontró una sesión autenticada y se conectó automáticamente.

### El endpoint devuelve `202`

`202` significa: “estoy trabajando, todavía no terminé”.

Usa SSE o vuelve a consultar `GET /api/whatsapp/auth`.

### El frontend no recibe eventos

Revisa:

1. que el backend esté encendido;
2. que la URL use el puerto correcto;
3. que `CORS_ORIGIN` coincida con el frontend;
4. que `EventSource` use `/api/whatsapp/events`;
5. que no haya un proceso viejo ocupando el puerto.

### Gemini no responde

Comprueba que exista una clave válida:

```env
GEMINI_API_KEY=tu_clave_de_gemini
```

## 15. Reglas de seguridad

- No publiques `.env`.
- No muestres el código QR en una página pública.
- El QR permite vincular una cuenta de WhatsApp.
- Antes de usar esto en producción, agrega autenticación para proteger la API.
- Restringe `CORS_ORIGIN` al dominio real del frontend.
- No compartas `session.db` ni sus archivos auxiliares.

## 17. Referencia vigente: persistencia SQLite

La fuente principal de conversaciones es `conversations.db`, gestionada por
`src/chat/sqlite-conversation-store.ts` usando `node:sqlite`. La base contiene
los mensajes con su conversación, rol, texto y orden de inserción.

- `WAL` está habilitado para mejorar recuperación y lecturas durante escrituras.
- Cada intercambio usuario/modelo se guarda en una transacción.
- `MAX_HISTORY` limita los mensajes enviados a Gemini.
- `CONVERSATIONS_DB_PATH` permite cambiar la ubicación de la base.
- Los archivos JSON de `CONVERSATIONS_DIR` se importan una vez al iniciar.
- Los JSON no se eliminan automáticamente y pueden conservarse como respaldo.

La migración normaliza las claves para conservar compatibilidad con los nombres
de archivo generados por la implementación anterior. No borres `conversations/`
hasta comprobar que `conversations.db` contiene los historiales esperados.

## 18. Referencia vigente: personalidades

Coloca un archivo por personalidad en `personas/`. El nombre sin `.json` es el
identificador. El formato recomendado está documentado en
[`personas/README.md`](personas/README.md).

Endpoints:

```http
GET    /api/personas
GET    /api/personas/:id
POST   /api/personas
PUT    /api/personas/:id
DELETE /api/personas/:id
POST   /api/personas/:id/activate
```

Para cambiar la personalidad activa:

```bash
curl.exe -X POST http://localhost:5001/api/personas/ventas/activate
```

El cambio se aplica a los mensajes nuevos sin reiniciar WhatsApp y limpia todos
los historiales de conversaciones, porque la personalidad es global. El backend
persiste la personalidad activa en `personas.db`.

## 19. Variables adicionales

```env
CONVERSATIONS_DB_PATH=data/conversations.db
PERSONAS_DB_PATH=data/personalidades.db
PERSONAS_DIR=personas
```

Si no existe `personas.db`, el backend importa los JSON de `PERSONAS_DIR` o el
`persona.json` original.

## 20. Estado histórico del proyecto

### Persistencia de conversaciones

Las conversaciones se almacenan ahora en `conversations.db` usando SQLite
nativo de Node.js (Node 22.5 o superior). La base utiliza WAL, un índice por conversación y una
transacción por intercambio usuario/modelo. En el primer arranque se importan
automáticamente los archivos JSON existentes de `conversations/`; no se
eliminan, por lo que pueden conservarse como respaldo.

Puedes cambiar la ubicación con:

```env
CONVERSATIONS_DB_PATH=conversations.db
```

### Personalidades configurables

Las personalidades se administran mediante `data/personalidades.db`. La API permite
crear, consultar, editar, eliminar y activar perfiles sin reiniciar el
backend. Los archivos JSON de `personas/` y `persona.json` solo se utilizan
como fuente de migración inicial.

El panel de `Frontend/` ya implementa el flujo de conexión: abre la conexión,
escucha SSE, convierte el código QR en una imagen y actualiza la tarjeta al
recibir `connected`. `DashboardView.vue` y `SubscriptionView.vue` siguen
reservadas para funcionalidades futuras.

El backend ya incluye:

- API Express;
- conexión de WhatsApp bajo demanda;
- QR disponible para el frontend;
- eventos SSE;
- conexión y desconexión sin reiniciar el backend;
- almacenamiento de conversaciones;
- integración con Gemini;
- personalidad configurable;
- CORS para desarrollo local;
- comprobación de tipos con TypeScript.

La documentación histórica de esa sección queda reemplazada por
`Frontend/README.md`, que describe el flujo actualmente implementado.
