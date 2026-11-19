/** Punto de entrada: compone HTTP, WhatsApp y el caso de uso del chatbot. */
import express from "express";
import { createClient, type WhatsmeowClient } from "@whatsmeow-node/whatsmeow-node";
import qrcode from "qrcode-terminal";
import { createApiRouter } from "../api/routes.ts";
import { Chatbot } from "../chat/chatbot.ts";
import { config } from "../config/index.ts";
import { WhatsAppConnection } from "../integrations/whatsapp-connection.ts";
import { loadDatabasePersonaManager } from "../persona/database-manager.ts";

// The process is intentionally assembled here so integrations remain testable
// and the HTTP layer does not own WhatsApp-specific lifecycle details.
const app = express();
const PORT = Number(process.env.PORT ?? 3000);

app.use(express.json());

// Permite que el frontend Vite consuma la API durante el desarrollo.
app.use((request, response, next) => {
  if (request.headers.origin === config.corsOrigin) {
    response.header("Access-Control-Allow-Origin", config.corsOrigin);
    response.header("Vary", "Origin");
    response.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    response.header("Access-Control-Allow-Headers", "Content-Type");
  }

  if (request.method === "OPTIONS") {
    response.sendStatus(204);
    return;
  }

  next();
});

const personaManager = loadDatabasePersonaManager();
let chatbot: Chatbot | undefined;

/** Registra los eventos de cada cliente, incluido el que se cree al reconectar. */
function createWhatsAppClient(): WhatsmeowClient {
  const client = createClient({ store: config.sessionDatabase });

  client.on("qr", ({ code }) => {
    console.log("Escanea este código QR desde WhatsApp > Dispositivos vinculados:");
    qrcode.generate(code, { small: true });
  });

  client.on("connected", ({ jid }) => {
    console.log(`WhatsApp conectado como ${jid}`);
  });

  client.on("disconnected", () => {
    console.log("WhatsApp desconectado; esperando una nueva conexión bajo demanda...");
  });

  client.on("logged_out", ({ reason }) => {
    console.error(`La sesión fue cerrada: ${reason}`);
  });

  client.on("message", ({ info, message }) => {
    console.log(
      `[${info.chat}] ${info.pushName}: ${message.conversation ?? "(mensaje no textual)"}`,
    );
    chatbot?.handleMessage(info, message);
  });

  // El chatbot conserva su historial, pero usa la nueva instancia de WhatsApp.
  chatbot?.setClient(client);
  return client;
}

const whatsappConnection = new WhatsAppConnection(createWhatsAppClient);
chatbot = new Chatbot(
  whatsappConnection.getClient(),
  personaManager.getActive(),
  () => personaManager.getActive(),
);

app.get("/", (_request, response) => {
  response.json({ name: "FusionChatbot", status: "running" });
});

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.use("/api", createApiRouter(whatsappConnection, personaManager, (persona) => {
  chatbot?.setPersona(persona);
  return chatbot?.clearConversations();
}));

const server = app.listen(PORT, () => {
  console.log(`API HTTP escuchando en http://localhost:${PORT}`);
});
// Mantiene el proceso vivo mientras la API esté escuchando.
server.ref();
const processKeepAlive = setInterval(() => undefined, 60_000);

async function shutdown() {
  try {
    await whatsappConnection.disconnect();
  } finally {
    clearInterval(processKeepAlive);
    chatbot?.close();
    personaManager.close();
    server.close();
  }
}

process.once("SIGINT", async () => {
  await shutdown();
  process.exit(0);
});

process.once("SIGTERM", async () => {
  await shutdown();
  process.exit(0);
});
