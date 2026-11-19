/** Carga la personalidad editable del bot y proporciona un fallback seguro. */
import fs from "node:fs/promises";
import { config } from "../config/index.ts";

const defaultBasePrompt = "Eres un asistente de WhatsApp. Responde siempre en español, de forma cordial, clara y breve. No uses Markdown, tablas ni párrafos largos. Ayuda al cliente a consultar el menú, elegir productos y preparar un pedido. Haz una sola pregunta clara a la vez cuando falten datos. No inventes información. Si tu respuesta supera 3 líneas, divídela usando saltos de línea; cada salto representa un nuevo mensaje.";
export type ThinkingLevel = "minimal" | "low" | "medium" | "high";
export type PersonaGenerationConfig = {
  temperature?: number; topP?: number; topK?: number; maxOutputTokens?: number;
  stopSequences?: string[]; responseMimeType?: string; candidateCount?: number;
  seed?: number; presencePenalty?: number; frequencyPenalty?: number;
  thinkingLevel?: ThinkingLevel;
};
export type Persona = { name: string; instruction: string; model?: string; generationConfig?: PersonaGenerationConfig };

/** Loads optional business-specific instructions without making startup fragile. */
export async function loadPersona(): Promise<Persona> {
  const fallback = { name: "Assistant", instruction: `${defaultBasePrompt}\n\nEres un asistente útil.` };
  try {
    const data = JSON.parse(await fs.readFile(config.personaFile, "utf8"));
    return { name: typeof data.name === "string" ? data.name : fallback.name, instruction: `${typeof data.base_prompt === "string" ? data.base_prompt : defaultBasePrompt}\n\n${typeof data.description === "string" ? data.description : "Eres un asistente útil."}` };
  } catch (error) {
    // La aplicación sigue siendo utilizable aunque falte el archivo local.
    console.warn(`No se pudo cargar la persona (${config.personaFile}); se usará la predeterminada.`, error);
    return fallback;
  }
}
