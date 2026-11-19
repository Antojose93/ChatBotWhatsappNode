import type { Session, SessionStatus } from '@/types/session'

export interface WhatsappAuthResponse {
  connected: boolean
  state: string
  jid?: string
}

export interface WhatsappConnectionEvent {
  connected?: boolean
  state?: string
  jid?: string
  qr?: { code: string; generatedAt?: string }
}

export type WhatsappEventName = 'status' | 'qr' | 'connected' | 'disconnected' | 'logged_out'
export interface PersonaSummary {
  id: string
  name: string
  basePrompt: string
  description: string
  active: boolean
  model: string
  systemInstruction: string
  generationConfig: PersonaGenerationConfig
}
export interface PersonaGenerationConfig {
  temperature?: number
  topP?: number
  topK?: number
  maxOutputTokens?: number
  stopSequences?: string[]
  responseMimeType?: string
  candidateCount?: number
  seed?: number
  presencePenalty?: number
  frequencyPenalty?: number
  thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high'
}
export interface PersonaInput {
  id?: string
  name: string
  basePrompt: string
  description: string
  model: string
  systemInstruction: string
  generationConfig: PersonaGenerationConfig
}
export interface AvailableModel {
  id: string
  displayName: string
  inputTokenLimit?: number
  outputTokenLimit?: number
}

// Keep the backend origin in one place so REST and SSE use the same environment.
const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '')

/** Common JSON request wrapper with a consistent error for all API calls. */
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
  })
  if (!response.ok) throw new Error(`API request failed: ${response.status} ${response.statusText}`)
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

function toSession(auth: WhatsappAuthResponse): Session {
  // The backend currently exposes one WhatsApp account; the UI models it as a session card.
  const jid = auth.jid ?? 'whatsapp-primary'
  const phone = jid.split(':')[0].split('@')[0]
  const status: SessionStatus = auth.connected || auth.state === 'connected' ? 'Connected' : auth.state === 'connecting' ? 'Pending' : 'Logged Out'
  return { id: jid, name: 'WhatsApp Business Bot', phone: phone ? `+${phone}` : 'WhatsApp session', status }
}

export async function getWhatsappAuth(): Promise<WhatsappAuthResponse> { return request<WhatsappAuthResponse>('/api/whatsapp/auth') }
export async function getSessions(): Promise<Session[]> { return [toSession(await getWhatsappAuth())] }
export async function getPersonas(): Promise<PersonaSummary[]> { return (await request<{ personas: PersonaSummary[] }>('/api/personas')).personas }
export async function getAvailableModels(): Promise<AvailableModel[]> { try { return (await request<{ models: AvailableModel[] }>('/api/models')).models } catch { return [] } }
export async function getPersona(id: string): Promise<PersonaSummary> { return request<PersonaSummary>(`/api/personas/${encodeURIComponent(id)}`) }
export async function createPersona(input: PersonaInput): Promise<PersonaSummary> { return request<PersonaSummary>('/api/personas', { method: 'POST', body: JSON.stringify(input) }) }
export async function updatePersona(id: string, input: PersonaInput): Promise<PersonaSummary> { return request<PersonaSummary>(`/api/personas/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) }) }
export async function deletePersona(id: string): Promise<void> { await request<unknown>(`/api/personas/${encodeURIComponent(id)}`, { method: 'DELETE' }) }
export async function setActivePersona(id: string): Promise<PersonaSummary> { return request<PersonaSummary>(`/api/personas/${encodeURIComponent(id)}/activate`, { method: 'POST' }) }
export async function startWhatsappConnection(): Promise<WhatsappConnectionEvent> { return request<WhatsappConnectionEvent>('/api/whatsapp/connect', { method: 'POST' }) }
export function subscribeToWhatsappEvents(handlers: Partial<Record<WhatsappEventName, (event: WhatsappConnectionEvent) => void>>, onError: () => void): EventSource {
  // EventSource reconnects automatically; callers close it when the modal/view ends.
  const events = new EventSource(`${API_URL}/api/whatsapp/events`)
  for (const [eventName, handler] of Object.entries(handlers)) {
    if (handler) events.addEventListener(eventName, (event) => {
      try { handler(JSON.parse((event as MessageEvent).data) as WhatsappConnectionEvent) } catch { handler({}) }
    })
  }
  events.onerror = onError
  return events
}
export async function updateSession(session: Session): Promise<Session> { return session }
export async function disconnectSession(): Promise<WhatsappAuthResponse> { return request<WhatsappAuthResponse>('/api/whatsapp/disconnect', { method: 'POST' }) }
export async function deleteSession(_id: string): Promise<void> { await request<unknown>('/api/whatsapp/session', { method: 'DELETE' }) }
export async function connectSession(_session: Session): Promise<Session> { return toSession(await getWhatsappAuth()) }
