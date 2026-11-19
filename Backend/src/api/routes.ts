/** Rutas HTTP públicas de la aplicación, agrupadas bajo el prefijo `/api`. */
import { Router } from "express";
import type { WhatsAppConnection } from "../integrations/whatsapp-connection.ts";
import type { DatabasePersonaManager } from "../persona/database-manager.ts";
import type { Persona } from "../persona/index.ts";
import type {
  PersonaGenerationConfig,
  ThinkingLevel,
} from "../persona/index.ts";
import { listAvailableModels } from "../integrations/gemini-client.ts";

export function createApiRouter(
  connection: WhatsAppConnection,
  personas: DatabasePersonaManager,
  onPersonaChanged: (persona: Persona) => void | Promise<void>,
): Router {
  const router = Router();

  /**
   * Starts the connection asynchronously. A 202 response is intentional:
   * pairing may require a QR scan and finishes through the SSE stream.
   */
  router.post("/whatsapp/connect", async (_request, response, next) => {
    try {
      await connection.start();
      const status = connection.snapshot();
      response.status(status.connected ? 200 : 202).json(status);
    } catch (error) {
      next(error);
    }
  });

  router.get("/whatsapp/auth", (_request, response) => {
    const status = connection.snapshot();

    if (
      !status.connected &&
      !status.qr &&
      ["idle", "connecting"].includes(status.state)
    ) {
      response.status(202).json(status);
      return;
    }

    response.json(status);
  });

  router.get("/whatsapp/events", (request, response) => {
    response.status(200);
    response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.setHeader("X-Accel-Buffering", "no");
    response.flushHeaders();

    // SSE keeps the initial snapshot and later WhatsApp events on one channel.
    const writeEvent = (event: string, data: unknown) => {
      response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    const unsubscribe = connection.subscribe(writeEvent);
    // A comment frame prevents proxies from considering an idle stream dead.
    const heartbeat = setInterval(
      () => response.write(": keep-alive\n\n"),
      15_000,
    );

    request.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  router.post("/whatsapp/disconnect", async (_request, response, next) => {
    try {
      await connection.disconnect();
      response.json(connection.snapshot());
    } catch (error) {
      next(error);
    }
  });

  router.delete("/whatsapp/session", async (_request, response, next) => {
    try {
      await connection.logout();
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.get("/personas", (_request, response) => {
    response.json({ personas: personas.list() });
  });

  router.get("/models", async (_request, response, next) => {
    try {
      response.json({ models: await listAvailableModels() });
    } catch (error) {
      next(error);
    }
  });

  router.get("/personas/active", (_request, response) => {
    const active = personas.getActive();
    response.json({ id: active.id, name: active.name });
  });

  router.post("/personas/active", async (request, response, next) => {
    const id =
      typeof request.body?.id === "string" ? request.body.id.trim() : "";
    if (!id) {
      response.status(400).json({ error: "El campo 'id' es obligatorio" });
      return;
    }
    try {
      const active = personas.activate(id);
      await onPersonaChanged(personas.getActive());
      response.json(active);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("No existe")) {
        response.status(404).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  router.get("/personas/:id", (request, response) => {
    const persona = personas.get(request.params.id);
    if (!persona) {
      response
        .status(404)
        .json({ error: `No existe la personalidad "${request.params.id}"` });
      return;
    }
    response.json(persona);
  });

  router.post("/personas", (request, response, next) => {
    const input = personaInput(request.body);
    if (!input) {
      response
        .status(400)
        .json({ error: "name y systemInstruction son obligatorios" });
      return;
    }
    try {
      const id =
        typeof request.body?.id === "string" && request.body.id.trim()
          ? request.body.id.trim()
          : slugify(input.name);
      response.status(201).json(personas.create({ id, ...input }));
    } catch (error) {
      next(error);
    }
  });

  router.put("/personas/:id", (request, response, next) => {
    const input = personaInput(request.body);
    if (!input) {
      response
        .status(400)
        .json({ error: "name y systemInstruction son obligatorios" });
      return;
    }
    try {
      response.json(personas.update(request.params.id, input));
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("No existe")) {
        response.status(404).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  router.delete("/personas/:id", (request, response, next) => {
    try {
      personas.delete(request.params.id);
      response.status(204).send();
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.startsWith("No existe") ||
          error.message.includes("activa"))
      ) {
        response
          .status(error.message.includes("activa") ? 409 : 404)
          .json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  router.post("/personas/:id/activate", async (request, response, next) => {
    try {
      const active = personas.activate(request.params.id);
      await onPersonaChanged(personas.getActive());
      response.json(active);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("No existe")) {
        response.status(404).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  return router;
}

function personaInput(
  body: unknown,
): {
  name: string;
  basePrompt: string;
  description: string;
  model: string;
  systemInstruction: string;
  generationConfig: PersonaGenerationConfig;
} | null {
  const value = body as Record<string, unknown>;
  const name = typeof value?.name === "string" ? value.name.trim() : "";
  const basePrompt =
    typeof value?.basePrompt === "string" ? value.basePrompt.trim() : "";
  const description =
    typeof value?.description === "string" ? value.description.trim() : "";
  const systemInstruction =
    typeof value?.systemInstruction === "string"
      ? value.systemInstruction.trim()
      : `${basePrompt}\n\n${description}`.trim();
  const model =
    typeof value?.model === "string" && value.model.trim()
      ? value.model.trim()
      : "gemini-2.0-flash";
  const raw = value?.generationConfig as Record<string, unknown> | undefined;
  const generationConfig: PersonaGenerationConfig = {};
  if (
    typeof raw?.temperature === "number" &&
    raw.temperature >= 0 &&
    raw.temperature <= 2
  )
    generationConfig.temperature = raw.temperature;
  if (typeof raw?.topP === "number" && raw.topP >= 0 && raw.topP <= 1)
    generationConfig.topP = raw.topP;
  if (typeof raw?.topK === "number" && raw.topK >= 0)
    generationConfig.topK = raw.topK;
  if (typeof raw?.maxOutputTokens === "number" && raw.maxOutputTokens > 0)
    generationConfig.maxOutputTokens = Math.round(raw.maxOutputTokens);
  if (Array.isArray(raw?.stopSequences))
    generationConfig.stopSequences = raw.stopSequences
      .filter(
        (item): item is string => typeof item === "string" && item.length > 0,
      )
      .slice(0, 5);
  if (
    typeof raw?.responseMimeType === "string" &&
    ["text/plain", "application/json"].includes(raw.responseMimeType)
  )
    generationConfig.responseMimeType = raw.responseMimeType;
  if (typeof raw?.candidateCount === "number" && raw.candidateCount >= 1)
    generationConfig.candidateCount = Math.round(raw.candidateCount);
  if (typeof raw?.seed === "number")
    generationConfig.seed = Math.round(raw.seed);
  if (
    typeof raw?.presencePenalty === "number" &&
    raw.presencePenalty >= -2 &&
    raw.presencePenalty <= 2
  )
    generationConfig.presencePenalty = raw.presencePenalty;
  if (
    typeof raw?.frequencyPenalty === "number" &&
    raw.frequencyPenalty >= -2 &&
    raw.frequencyPenalty <= 2
  )
    generationConfig.frequencyPenalty = raw.frequencyPenalty;
  if (["minimal", "low", "medium", "high"].includes(String(raw?.thinkingLevel)))
    generationConfig.thinkingLevel = raw?.thinkingLevel as ThinkingLevel;
  return name && systemInstruction
    ? {
        name,
        basePrompt,
        description,
        model,
        systemInstruction,
        generationConfig,
      }
    : null;
}

function slugify(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || `persona-${Date.now()}`
  );
}
