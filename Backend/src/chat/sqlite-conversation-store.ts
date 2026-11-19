/**
 * SQLite-backed conversation history.
 *
 * The public methods stay asynchronous because the chatbot already models
 * persistence as async work. SQLite itself is synchronous here, which is a
 * good fit for the single Node process and low-concurrency deployment target.
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "../config/index.ts";
import type { ConversationMessage } from "./conversation-store.ts";

type StoredRow = { role: unknown; text: unknown };

export class SqliteConversationStore {
  private readonly database: DatabaseSync;

  constructor() {
    this.database = new DatabaseSync(config.conversationsDatabase);
    this.database.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'model')),
        text TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_messages_conversation
        ON messages (conversation_id, id);
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    this.migrateLegacyJson();
  }

  async load(id: string): Promise<ConversationMessage[]> {
    const rows = this.database
      .prepare(`
        SELECT role, text
        FROM messages
        WHERE conversation_id = ?
        ORDER BY id DESC
        LIMIT ?
      `)
      .all(id, Math.max(0, config.maxHistory * 2)) as unknown as StoredRow[];

    return rows.reverse().filter(this.isMessage).map(({ role, text }) => ({
      role,
      text,
    }));
  }

  async addExchange(id: string, user: string, model: string): Promise<void> {
    const insert = this.database.prepare(
      "INSERT INTO messages (conversation_id, role, text) VALUES (?, ?, ?)",
    );
    this.database.exec("BEGIN IMMEDIATE");
    try {
      insert.run(id, "user", user);
      insert.run(id, "model", model);
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  async clear(id: string): Promise<void> {
    this.database.prepare("DELETE FROM messages WHERE conversation_id = ?").run(id);
  }

  /** Clears every conversation because the active personality is global. */
  async clearAll(): Promise<void> {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.database.exec("DELETE FROM messages");
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  close(): void {
    this.database.close();
  }

  private migrateLegacyJson(): void {
    const marker = this.database
      .prepare("SELECT value FROM metadata WHERE key = ?")
      .get("json-migration") as { value?: unknown } | undefined;
    if (marker?.value === "complete") return;

    this.database.exec("BEGIN IMMEDIATE");
    try {
      if (fs.existsSync(config.conversationsDir)) {
        const insert = this.database.prepare(
          "INSERT INTO messages (conversation_id, role, text) VALUES (?, ?, ?)",
        );
        for (const file of fs.readdirSync(config.conversationsDir)) {
          if (!file.endsWith(".json")) continue;
          const conversationId = path.basename(file, ".json");
          try {
            const value: unknown = JSON.parse(
              fs.readFileSync(path.join(config.conversationsDir, file), "utf8"),
            );
            if (!Array.isArray(value)) continue;
            for (const message of value) {
              if (this.isMessage(message)) insert.run(conversationId, message.role, message.text);
            }
          } catch {
            // A bad legacy file must not prevent the remaining conversations from migrating.
          }
        }
      }
      this.database
        .prepare("INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)")
        .run("json-migration", "complete");
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  private isMessage(value: unknown): value is ConversationMessage {
    const item = value as Record<string, unknown>;
    return !!item && (item.role === "user" || item.role === "model") && typeof item.text === "string";
  }
}
