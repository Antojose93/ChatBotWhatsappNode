import type { JID, MessageInfo } from "@whatsmeow-node/whatsmeow-node";
/** Orquesta recepción, contexto, generación y envío de respuestas. */
import { config, sleep } from "../config/index.ts";
import { SqliteConversationStore } from "./sqlite-conversation-store.ts";
import { GeminiClient } from "../integrations/gemini-client.ts";
import { splitMessage } from "./message-splitter.ts";
import { conversationKey } from "./conversation-key.ts";
import type { Persona } from "../persona/index.ts";

type WhatsAppClient = {
  sendMessage(jid: JID, message: { conversation: string }): Promise<unknown>;
  markRead?: (ids: string[], chat: JID, sender?: JID) => Promise<unknown>;
};
export class Chatbot {
  private readonly store = new SqliteConversationStore();
  private readonly gemini: GeminiClient;
  private readonly queues = new Map<string, Promise<void>>();
  private client: WhatsAppClient;
  private readonly getActivePersona?: () => Persona;
  constructor(client: WhatsAppClient, persona: Persona, getActivePersona?: () => Persona) {
    this.client = client;
    this.gemini = new GeminiClient(persona.instruction, persona.model, persona.generationConfig);
    this.getActivePersona = getActivePersona;
  }

  /** Actualiza el cliente cuando la conexión de WhatsApp se recrea. */
  setClient(client: WhatsAppClient) {
    this.client = client;
  }

  /** Switches Gemini's personality while preserving conversation history. */
  setPersona(persona: Persona) {
    this.gemini.setInstruction(persona.instruction, persona.model, persona.generationConfig);
  }

  close() {
    this.store.close();
  }

  /** Resets all context before a global personality change takes effect. */
  async clearConversations(): Promise<void> {
    await this.store.clearAll();
  }
  handleMessage(info: MessageInfo, message: Record<string, unknown>) {
    const text = this.extractText(message);
    if (info.isFromMe || !text || !info.chat) return;
    // En grupos cada usuario mantiene contexto independiente; en chats
    // directos basta con identificar la conversación por su JID.
    const rawKey = info.isGroup ? `${info.chat}:${info.sender}` : info.chat;
    // Keep the key compatible with the filenames used by the old JSON store.
    const key = conversationKey(rawKey);
    // Messages for the same logical conversation are serialized so replies keep
    // their order and two Gemini calls cannot overwrite the same JSON history.
    const previous = this.queues.get(key) ?? Promise.resolve();
    const next = previous
      .then(() => this.process(key, info, text))
      .catch((error) => console.error(`Error procesando ${info.chat}:`, error));
    const settled = next.finally(() => {
      if (this.queues.get(key) === settled) this.queues.delete(key);
    });
    this.queues.set(key, settled);
  }
  private async process(key: string, info: MessageInfo, text: string) {
    // Re-read the active profile so queued messages use the latest selection.
    const activePersona = this.getActivePersona?.();
    if (activePersona) this.setPersona(activePersona);
    try {
      await this.client.markRead?.([info.id], info.chat, info.sender);
    } catch (error) {
      console.warn(`No se pudo marcar como leído ${info.id}:`, error);
    }
    const reply = await this.gemini.generate(text, await this.store.load(key));
    const chunks = splitMessage(
      reply,
      config.messageChunkMaxLines,
      config.messageChunkMaxChars,
    );
    for (let i = 0; i < chunks.length; i++) {
      await this.client.sendMessage(info.chat, { conversation: chunks[i] });
      if (i < chunks.length - 1)
        await sleep(
          randomBetween(config.messageDelayMin, config.messageDelayMax),
        );
    }
    // Save the complete answer once all chunks have been delivered.
    await this.store.addExchange(key, text, reply);
  }
  private extractText(message: Record<string, unknown>) {
    const extended = message.extendedTextMessage as
      | { text?: unknown }
      | undefined;
    return typeof message.conversation === "string"
      ? message.conversation
      : typeof extended?.text === "string"
        ? extended.text
        : null;
  }
}
function randomBetween(min: number, max: number) {
  return Math.max(0, Math.round(min + Math.random() * (max - min)));
}
