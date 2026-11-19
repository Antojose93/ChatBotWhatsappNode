/** Catalogs personalities and keeps exactly one active for new Gemini calls. */
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config/index.ts";
import { loadPersona, type Persona } from "./index.ts";

export type ManagedPersona = Persona & { id: string };
export type PersonaSummary = { id: string; name: string; active: boolean };

type PersonaFile = { name?: unknown; base_prompt?: unknown; description?: unknown };

async function readPersonaFile(file: string, id: string): Promise<ManagedPersona> {
  const data = JSON.parse(await fs.readFile(file, "utf8")) as PersonaFile;
  const base = typeof data.base_prompt === "string" ? data.base_prompt : "Eres un asistente de WhatsApp. Responde de forma cordial, clara y breve.";
  const description = typeof data.description === "string" ? data.description : "Eres un asistente útil.";
  return {
    id,
    name: typeof data.name === "string" ? data.name : id,
    instruction: `${base}\n\n${description}`,
  };
}

export async function loadPersonas(): Promise<ManagedPersona[]> {
  try {
    const entries = await fs.readdir(config.personasDir, { withFileTypes: true });
    const personas = await Promise.all(entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => readPersonaFile(path.join(config.personasDir, entry.name), path.basename(entry.name, ".json"))));
    if (personas.length > 0) return personas;
  } catch {
    // The directory is optional for backward compatibility.
  }

  const legacy = await loadPersona();
  return [{ ...legacy, id: path.basename(config.personaFile, path.extname(config.personaFile)) }];
}

export class PersonaManager {
  private readonly personas: ManagedPersona[];
  private active: ManagedPersona;

  constructor(personas: ManagedPersona[], active: ManagedPersona) {
    this.personas = personas;
    this.active = active;
  }

  list(): PersonaSummary[] {
    return this.personas.map(({ id, name }) => ({ id, name, active: id === this.active.id }));
  }

  getActive(): ManagedPersona {
    return this.active;
  }

  async setActive(id: string): Promise<ManagedPersona> {
    const persona = this.personas.find((item) => item.id === id);
    if (!persona) throw new Error(`No existe la personalidad "${id}"`);
    await fs.writeFile(config.activePersonaFile, JSON.stringify({ id }, null, 2));
    this.active = persona;
    return persona;
  }
}

export async function loadPersonaManager(): Promise<PersonaManager> {
  const personas = await loadPersonas();
  let activeId = config.activePersonaId;
  if (!activeId) {
    try {
      const saved = JSON.parse(await fs.readFile(config.activePersonaFile, "utf8")) as { id?: unknown };
      if (typeof saved.id === "string") activeId = saved.id;
    } catch {
      // First run: use the first available personality.
    }
  }
  return new PersonaManager(personas, personas.find((item) => item.id === activeId) ?? personas[0]);
}
