/**
 * Persistencia sencilla de conversaciones.
 * Cada chat tiene un archivo JSON independiente para evitar introducir una
 * base de datos adicional mientras el volumen de la aplicación siga siendo
 * pequeño.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config/index.ts";

export type ConversationMessage = { role: "user" | "model"; text: string };
const safeName = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, "_");

/** @deprecated Kept only as a reference for the JSON migration format. */
export class ConversationStore {
  async load(id: string): Promise<ConversationMessage[]> {
    try {
      const value: unknown = JSON.parse(await fs.readFile(this.file(id), "utf8"));
      if (!Array.isArray(value) || !value.every(this.isMessage)) return [];
      // maxHistory counts exchanges; each exchange contains user + model.
      return (value as ConversationMessage[]).slice(-config.maxHistory * 2);
    } catch {
      // Un chat nuevo o un archivo corrupto no debe impedir que el bot responda.
      return [];
    }
  }
  async addExchange(id: string, user: string, model: string) {
    const history = await this.load(id);
    history.push({ role: "user", text: user }, { role: "model", text: model });
    await fs.mkdir(config.conversationsDir, { recursive: true });
    await fs.writeFile(this.file(id), JSON.stringify(history, null, 2));
  }
  async clear(id: string) {
    try {
      await fs.unlink(this.file(id));
    } catch (error: any) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  private file(id: string) { return path.join(config.conversationsDir, `${safeName(id)}.json`); }
  private isMessage(value: unknown): value is ConversationMessage {
    const item = value as Record<string, unknown>;
    return !!item && (item.role === "user" || item.role === "model") && typeof item.text === "string";
  }
}
