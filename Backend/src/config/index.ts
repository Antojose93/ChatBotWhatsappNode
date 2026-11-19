/**
 * Configuración central de la aplicación.
 *
 * Lee `.env` sin añadir una dependencia adicional y expone valores ya
 * normalizados para que el resto del código no tenga que conocer process.env.
 */
import fs from "node:fs";
import path from "node:path";

function loadDotEnv(file = ".env") {
  const envPath = path.resolve(file);
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    const rawValue = match[2].trim();
    const quoted = rawValue.match(/^(['"])(.*?)\1(?:\s+#.*)?$/);
    process.env[match[1]] = quoted ? quoted[2] : rawValue.replace(/\s+#.*$/, "").trim();
  }
}
loadDotEnv();

const databaseDirectory = path.resolve(process.env.DATABASE_DIR ?? "data");
fs.mkdirSync(databaseDirectory, { recursive: true });

/** Moves the previous root-level SQLite files into the organized data folder once. */
function migrateLegacyDatabase(newPath: string, legacyName: string) {
  if (process.env.DATABASE_DIR || fs.existsSync(newPath)) return;
  const legacyPath = path.resolve(legacyName);
  if (!fs.existsSync(legacyPath)) return;
  for (const suffix of ["", "-wal", "-shm"]) {
    const source = `${legacyPath}${suffix}`;
    const target = `${newPath}${suffix}`;
    if (fs.existsSync(source) && !fs.existsSync(target)) fs.renameSync(source, target);
  }
}

const conversationsDatabase = path.resolve(process.env.CONVERSATIONS_DB_PATH ?? path.join(databaseDirectory, "conversations.db"));
const personasDatabase = path.resolve(process.env.PERSONAS_DB_PATH ?? path.join(databaseDirectory, "personalidades.db"));
const sessionDatabase = path.resolve(process.env.SESSION_DB_PATH ?? path.join(databaseDirectory, "session.db"));
migrateLegacyDatabase(conversationsDatabase, "conversations.db");
migrateLegacyDatabase(personasDatabase, "personas.db");
migrateLegacyDatabase(sessionDatabase, "session.db");

/** Obtiene un número válido del entorno o conserva el valor predeterminado. */
const number = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
};
const secondsAsMilliseconds = (name: string, fallback: number) =>
  number(name, fallback / 1_000) * 1_000;

export const config = {
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  conversationsDir: path.resolve(process.env.CONVERSATIONS_DIR ?? "conversations"),
  databaseDirectory,
  conversationsDatabase,
  sessionDatabase,
  personaFile: path.resolve(process.env.PERSONA_FILE_PATH ?? "persona.json"),
  personasDir: path.resolve(process.env.PERSONAS_DIR ?? "personas"),
  activePersonaFile: path.resolve(process.env.ACTIVE_PERSONA_FILE ?? "active-persona.json"),
  activePersonaId: process.env.ACTIVE_PERSONA_ID,
  personasDatabase,
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
  messageChunkMaxLines: number("MESSAGE_CHUNK_MAX_LINES", 3),
  messageChunkMaxChars: number("MESSAGE_CHUNK_MAX_CHARS", 100),
  messageDelayMin: secondsAsMilliseconds("MESSAGE_DELAY_MIN", 2_000),
  messageDelayMax: secondsAsMilliseconds("MESSAGE_DELAY_MAX", 5_000),
  maxHistory: number("MAX_HISTORY", 20),
};

/** Pausa reutilizable para espaciar mensajes enviados a WhatsApp. */
export const sleep = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
