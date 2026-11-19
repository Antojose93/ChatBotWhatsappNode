/** SQLite repository for personality definitions and the active selection. */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "../config/index.ts";
import type { Persona, PersonaGenerationConfig, ThinkingLevel } from "./index.ts";

export type PersonaRecord = {
  id: string;
  name: string;
  basePrompt: string;
  description: string;
  active: boolean;
  model: string;
  systemInstruction: string;
  generationConfig: PersonaGenerationConfig;
};

type PersonaFile = { name?: unknown; base_prompt?: unknown; description?: unknown };
export type PersonaInput = { name: string; basePrompt: string; description: string; model: string; systemInstruction: string; generationConfig: PersonaGenerationConfig };

function parseGenerationConfig(value: unknown): PersonaGenerationConfig {
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const config: PersonaGenerationConfig = {};
    if (typeof parsed.temperature === "number") config.temperature = parsed.temperature;
    if (typeof parsed.topP === "number") config.topP = parsed.topP;
    if (typeof parsed.topK === "number") config.topK = parsed.topK;
    if (typeof parsed.maxOutputTokens === "number") config.maxOutputTokens = parsed.maxOutputTokens;
    if (Array.isArray(parsed.stopSequences)) config.stopSequences = parsed.stopSequences.filter((item): item is string => typeof item === "string");
    if (typeof parsed.responseMimeType === "string") config.responseMimeType = parsed.responseMimeType;
    if (typeof parsed.candidateCount === "number") config.candidateCount = parsed.candidateCount;
    if (typeof parsed.seed === "number") config.seed = parsed.seed;
    if (typeof parsed.presencePenalty === "number") config.presencePenalty = parsed.presencePenalty;
    if (typeof parsed.frequencyPenalty === "number") config.frequencyPenalty = parsed.frequencyPenalty;
    if (["minimal", "low", "medium", "high"].includes(String(parsed.thinkingLevel))) config.thinkingLevel = parsed.thinkingLevel as ThinkingLevel;
    return config;
  } catch { return {}; }
}

export class PersonaDatabase {
  private readonly database: DatabaseSync;

  constructor() {
    this.database = new DatabaseSync(config.personasDatabase);
    this.database.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS personas (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        base_prompt TEXT NOT NULL,
        description TEXT NOT NULL,
        model TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
        system_instruction TEXT NOT NULL DEFAULT '',
        generation_config TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS persona_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    this.ensureColumn("model", "TEXT NOT NULL DEFAULT 'gemini-2.0-flash'");
    this.ensureColumn("system_instruction", "TEXT NOT NULL DEFAULT ''");
    this.ensureColumn("generation_config", "TEXT NOT NULL DEFAULT '{}'");
    this.migrateLegacyFiles();
    this.ensureActivePersona();
  }

  list(): PersonaRecord[] {
    const activeId = this.activeId();
    return (this.database.prepare("SELECT id, name, base_prompt, description, model, system_instruction, generation_config FROM personas ORDER BY name COLLATE NOCASE").all() as unknown as Array<Record<string, unknown>>)
      .map((row) => this.toRecord(row, row.id === activeId));
  }

  get(id: string): PersonaRecord | undefined {
    const row = this.database.prepare("SELECT id, name, base_prompt, description, model, system_instruction, generation_config FROM personas WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return row ? this.toRecord(row, row.id === this.activeId()) : undefined;
  }

  active(): PersonaRecord {
    const activeId = this.activeId();
    const active = this.get(activeId);
    if (!active) throw new Error("No hay una personalidad disponible");
    return active;
  }

  create(input: PersonaInput & { id: string }): PersonaRecord {
    this.database.prepare("INSERT INTO personas (id, name, base_prompt, description, model, system_instruction, generation_config) VALUES (?, ?, ?, ?, ?, ?, ?)").run(input.id, input.name, input.basePrompt, input.description, input.model, input.systemInstruction, JSON.stringify(input.generationConfig));
    if (!this.activeId()) this.setActive(input.id);
    return this.get(input.id)!;
  }

  update(id: string, input: PersonaInput): PersonaRecord {
    const result = this.database.prepare("UPDATE personas SET name = ?, base_prompt = ?, description = ?, model = ?, system_instruction = ?, generation_config = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(input.name, input.basePrompt, input.description, input.model, input.systemInstruction, JSON.stringify(input.generationConfig), id);
    if (Number(result.changes) === 0) throw new Error(`No existe la personalidad "${id}"`);
    return this.get(id)!;
  }

  delete(id: string): void {
    if (id === this.activeId()) throw new Error("No puedes eliminar la personalidad activa");
    const result = this.database.prepare("DELETE FROM personas WHERE id = ?").run(id);
    if (Number(result.changes) === 0) throw new Error(`No existe la personalidad "${id}"`);
  }

  setActive(id: string): PersonaRecord {
    if (!this.get(id)) throw new Error(`No existe la personalidad "${id}"`);
    this.database.prepare("INSERT OR REPLACE INTO persona_settings (key, value) VALUES ('active_id', ?)").run(id);
    return this.get(id)!;
  }

  close(): void {
    this.database.close();
  }

  toPersona(record: PersonaRecord): Persona & { id: string } {
    return { id: record.id, name: record.name, instruction: record.systemInstruction || `${record.basePrompt}\n\n${record.description}`, model: record.model, generationConfig: record.generationConfig };
  }

  private activeId(): string {
    const row = this.database.prepare("SELECT value FROM persona_settings WHERE key = 'active_id'").get() as { value?: unknown } | undefined;
    return typeof row?.value === "string" ? row.value : "";
  }

  private toRecord(row: Record<string, unknown>, active: boolean): PersonaRecord {
    return {
      id: String(row.id),
      name: String(row.name),
      basePrompt: String(row.base_prompt),
      description: String(row.description),
      active,
      model: typeof row.model === "string" && row.model ? row.model : "gemini-2.0-flash",
      systemInstruction: typeof row.system_instruction === "string" && row.system_instruction ? row.system_instruction : `${String(row.base_prompt)}\n\n${String(row.description)}`,
      generationConfig: parseGenerationConfig(row.generation_config),
    };
  }

  private ensureColumn(name: string, definition: string): void {
    const columns = this.database.prepare("PRAGMA table_info(personas)").all() as unknown as Array<{ name?: string }>;
    if (!columns.some((column) => column.name === name)) this.database.exec(`ALTER TABLE personas ADD COLUMN ${name} ${definition}`);
  }

  /** Keeps a new or partially migrated database usable at startup. */
  private ensureActivePersona(): void {
    let first = this.database.prepare("SELECT id FROM personas ORDER BY name COLLATE NOCASE LIMIT 1").get() as { id?: string } | undefined;

    if (!first?.id) {
      const id = "asistente-predeterminado";
      this.database.prepare("INSERT INTO personas (id, name, base_prompt, description) VALUES (?, ?, ?, ?)").run(
        id,
        "Asistente predeterminado",
        "Eres un asistente de WhatsApp. Responde siempre en español, de forma cordial, clara y breve.",
        "Ayuda al cliente de forma útil y no inventes información.",
      );
      first = { id };
    }

    const firstId = first?.id;
    if (firstId && !this.get(this.activeId())) this.setActive(firstId);
  }

  private migrateLegacyFiles(): void {
    if (this.database.prepare("SELECT 1 FROM persona_settings WHERE key = 'migration_complete'").get()) return;
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const files: string[] = [];
      if (fs.existsSync(config.personasDir)) {
        for (const entry of fs.readdirSync(config.personasDir, { withFileTypes: true })) {
          if (entry.isFile() && entry.name.endsWith(".json")) files.push(path.join(config.personasDir, entry.name));
        }
      }
      if (files.length === 0 && fs.existsSync(config.personaFile)) files.push(config.personaFile);
      const insert = this.database.prepare("INSERT OR IGNORE INTO personas (id, name, base_prompt, description) VALUES (?, ?, ?, ?)");
      for (const file of files) {
        try {
          const data = JSON.parse(fs.readFileSync(file, "utf8")) as PersonaFile;
          const id = path.basename(file, ".json");
          insert.run(id, typeof data.name === "string" ? data.name : id, typeof data.base_prompt === "string" ? data.base_prompt : "Eres un asistente de WhatsApp. Responde de forma cordial, clara y breve.", typeof data.description === "string" ? data.description : "Eres un asistente útil.");
        } catch {
          // One invalid legacy file must not block valid personalities.
        }
      }
      const legacyActive = fs.existsSync(config.activePersonaFile)
        ? JSON.parse(fs.readFileSync(config.activePersonaFile, "utf8")) as { id?: unknown }
        : undefined;
      const first = this.database.prepare("SELECT id FROM personas ORDER BY name COLLATE NOCASE LIMIT 1").get() as { id?: string } | undefined;
      const activeId = typeof config.activePersonaId === "string" ? config.activePersonaId : typeof legacyActive?.id === "string" ? legacyActive.id : first?.id;
      if (activeId && this.get(activeId)) this.setActive(activeId);
      this.database.prepare("INSERT INTO persona_settings (key, value) VALUES ('migration_complete', 'true')").run();
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}
