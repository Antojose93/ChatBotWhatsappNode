# FusionChatbot

FusionChatbot es una aplicación dividida en dos proyectos:

- `Backend/`: API Express, ciclo de vida de WhatsApp, chatbot, Gemini y persistencia local.
- `Frontend/`: panel Vue/Vite para consultar la sesión, iniciar el emparejamiento y desconectar WhatsApp.

## Flujo principal

```text
Vue -> REST /api/whatsapp/connect
Vue <- SSE /api/whatsapp/events <- WhatsAppConnection <- WhatsApp
WhatsApp -> Chatbot -> SQLite + Gemini -> WhatsApp
```

El backend mantiene una única instancia de cliente de WhatsApp. Puede recrearla después de una desconexión y reutiliza `Backend/data/session.db`. El frontend representa esa cuenta como una sesión dentro del panel.

## Puesta en marcha

Requiere Node.js 22.5 o superior porque el backend utiliza `node:sqlite`.

En dos terminales:

```powershell
cd Backend
npm install
npm run typecheck
npm run start
```

```powershell
cd Frontend
npm install
npm run build
npm run dev
```

El backend usa el puerto `3000` por defecto y el frontend Vite usa `5173`. Si el backend usa otro puerto, define `VITE_API_URL`; consulta [`Backend/README.md`](Backend/README.md) para la configuración completa.

## Documentación por proyecto

- [Backend: configuración, API, SSE y persistencia](Backend/README.md)
- [Frontend: arquitectura, estado y flujo de conexión](Frontend/README.md)

## Notas de seguridad

No publiques `.env`, `session.db`, sus archivos auxiliares ni el contenido del QR. Antes de exponer la API fuera de un entorno local, agrega autenticación y restringe `CORS_ORIGIN` al dominio real del panel.

La persistencia del chatbot usa `Backend/data/conversations.db`; inclúyela en los respaldos de la máquina virtual junto con las bases de `Backend/data/` y sus archivos WAL/SHM.
