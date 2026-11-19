/** Adaptador mínimo para la API de generación de contenido de Gemini. */
import { config } from "../config/index.ts";
import { GoogleGenAI, ThinkingLevel as GeminiThinkingLevel, type GenerateContentConfig } from "@google/genai";
import type { ConversationMessage } from "../chat/conversation-store.ts";
import type { PersonaGenerationConfig } from "../persona/index.ts";

export class GeminiClient {
  private instruction: string;
  private model: string;
  private generationConfig: PersonaGenerationConfig;
  private readonly ai: GoogleGenAI;
  constructor(instruction: string, model = config.geminiModel, generationConfig: PersonaGenerationConfig = {}) {
    this.instruction = instruction;
    this.model = model;
    this.generationConfig = generationConfig;
    this.ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
  }

  /** Updates the prompt used by subsequent requests without restarting WhatsApp. */
  setInstruction(instruction: string, model = this.model, generationConfig: PersonaGenerationConfig = this.generationConfig) {
    this.instruction = instruction;
    this.model = model;
    this.generationConfig = generationConfig;
  }
  async generate(
    text: string,
    history: ConversationMessage[],
  ): Promise<string> {
    // Missing credentials are treated as a user-facing fallback, not a startup error.
    if (!config.geminiApiKey)
      return "Ahora mismo no puedo conectarme con mi asistente. Intenta nuevamente más tarde.";
    try {
      // Gemini expects the current message after the persisted conversation history.
      const contents = [...history, { role: "user", text }].map((item) => ({
        role: item.role === "model" ? "model" : "user",
        parts: [{ text: item.text }],
      }));
      const generationConfig: GenerateContentConfig = {
        systemInstruction: this.instruction,
        ...(this.generationConfig.temperature !== undefined && { temperature: this.generationConfig.temperature }),
        ...(this.generationConfig.topP !== undefined && { topP: this.generationConfig.topP }),
        ...(this.generationConfig.topK !== undefined && { topK: this.generationConfig.topK }),
        ...(this.generationConfig.maxOutputTokens !== undefined && { maxOutputTokens: this.generationConfig.maxOutputTokens }),
        ...(this.generationConfig.stopSequences?.length ? { stopSequences: this.generationConfig.stopSequences } : {}),
        ...(this.generationConfig.responseMimeType ? { responseMimeType: this.generationConfig.responseMimeType } : {}),
        ...(this.generationConfig.candidateCount !== undefined && { candidateCount: this.generationConfig.candidateCount }),
        ...(this.generationConfig.seed !== undefined && { seed: this.generationConfig.seed }),
        ...(this.generationConfig.presencePenalty !== undefined && { presencePenalty: this.generationConfig.presencePenalty }),
        ...(this.generationConfig.frequencyPenalty !== undefined && { frequencyPenalty: this.generationConfig.frequencyPenalty }),
        ...(this.generationConfig.thinkingLevel ? { thinkingConfig: { thinkingLevel: { minimal: GeminiThinkingLevel.MINIMAL, low: GeminiThinkingLevel.LOW, medium: GeminiThinkingLevel.MEDIUM, high: GeminiThinkingLevel.HIGH }[this.generationConfig.thinkingLevel] } } : {}),
      };
      const sdkResponse = await this.ai.models.generateContent({ model: this.model || config.geminiModel, contents, config: generationConfig });
      const sdkResult = sdkResponse.text?.trim();
      if (!sdkResult) throw new Error("Gemini devolvió una respuesta vacía");
      return sdkResult;

      
      /* Legacy REST implementation kept here for reference after the SDK migration.
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.geminiModel)}:generateContent?key=${encodeURIComponent(config.geminiApiKey ?? "")}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: this.instruction }] },
            contents,
          }),
        },
      );
      if (!response.ok)
        throw new Error(`Gemini respondió HTTP ${response.status}`);
      const data: any = await response.json();
      const result = data.candidates?.[0]?.content?.parts
        ?.map((part: any) => part.text ?? "")
        .join("")
        .trim();
      if (!result) throw new Error("Gemini devolvió una respuesta vacía");
      return result; */
    } catch (error) {
      console.error("Error llamando a Gemini:", error);
      return "Estoy teniendo problemas para procesar tu solicitud. Intenta nuevamente más tarde.";
    }
  }
}

export async function listAvailableModels(): Promise<Array<{ id: string; displayName: string; inputTokenLimit?: number; outputTokenLimit?: number }>> {
  if (!config.geminiApiKey) return [];
  const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
  const models: Array<{ id: string; displayName: string; inputTokenLimit?: number; outputTokenLimit?: number }> = [];
  const pager = await ai.models.list({ config: { pageSize: 100, queryBase: true } });
  for await (const model of pager) {
    if (!model.name || (model.supportedActions?.length && !model.supportedActions.includes("generateContent"))) continue;
    models.push({ id: model.name.replace(/^models\//, ""), displayName: model.displayName ?? model.name, inputTokenLimit: model.inputTokenLimit, outputTokenLimit: model.outputTokenLimit });
  }
  return models.sort((left, right) => left.id.localeCompare(right.id));
}
