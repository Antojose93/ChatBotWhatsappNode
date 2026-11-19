/**
 * Estado observable y ciclo de vida de la conexión de WhatsApp.
 * El cliente se puede recrear después de una desconexión sin perder data/session.db.
 */
import type {
  JID,
  WhatsmeowEvents,
  WhatsmeowClient,
} from "@whatsmeow-node/whatsmeow-node";

export type WhatsAppConnectionState =
  | "idle"
  | "connecting"
  | "awaiting_qr"
  | "connected"
  | "disconnected"
  | "logged_out";

type Snapshot = {
  connected: boolean;
  state: WhatsAppConnectionState;
  jid?: JID;
  qr?: { code: string; generatedAt: string };
  reason?: string;
};

/**
 * Owns the WhatsApp client lifecycle and exposes a UI-friendly state machine.
 * The client itself is replaceable because the library instance must be closed
 * before a new connection can be initialized after disconnect or logout.
 */
export class WhatsAppConnection {
  private state: WhatsAppConnectionState = "idle";
  private jid?: JID;
  private qr?: { code: string; generatedAt: string };
  private reason?: string;
  private client: WhatsmeowClient;
  private readonly createClient: () => WhatsmeowClient;
  private initialized = false;
  private startPromise?: Promise<void>;
  private readonly subscribers = new Set<(event: string, data: Snapshot) => void>();

  constructor(createClient: () => WhatsmeowClient) {
    this.createClient = createClient;
    this.client = createClient();
    this.registerEvents();
  }

  getClient(): WhatsmeowClient {
    return this.client;
  }

  /** Inicia la sesión existente o prepara el canal para emparejarla. */
  async start(): Promise<void> {
    if (this.startPromise) return this.startPromise;
    if (this.state === "connected" || this.state === "awaiting_qr") return;

    // Después de close() se crea un cliente nuevo; la sesión persistida se reutiliza.
    if (this.state === "disconnected" || this.state === "logged_out") {
      this.client.close();
      this.client = this.createClient();
      this.registerEvents();
      this.jid = undefined;
      this.qr = undefined;
      this.reason = undefined;
    }

    this.state = "connecting";
    this.publish("status");
    // Sharing this promise makes simultaneous connect requests idempotent.
    this.startPromise = this.initialize();
    return this.startPromise;
  }

  /** Suscribe un cliente SSE a los cambios de conexión. */
  subscribe(listener: (event: string, data: Snapshot) => void) {
    this.subscribers.add(listener);
    listener("status", this.snapshot());
    return () => this.subscribers.delete(listener);
  }

  /** Desconecta WhatsApp y detiene su proceso para evitar la reconexión automática. */
  async disconnect(): Promise<void> {
    if (this.state === "disconnected") return;
    if (this.initialized) await this.client.disconnect();
    this.client.close();
    this.initialized = false;
    this.state = "disconnected";
    this.publish("disconnected");
  }

  /** Cierra la sesión de WhatsApp y revoca el dispositivo; no solo corta la conexión. */
  async logout(): Promise<void> {
    if (this.initialized) await this.client.logout();
    this.client.close();
    this.initialized = false;
    this.startPromise = undefined;
    this.jid = undefined;
    this.qr = undefined;
    this.reason = undefined;
    this.state = "logged_out";
    this.publish("logged_out");
  }

  snapshot(): Snapshot {
    return {
      connected: this.state === "connected",
      state: this.state,
      ...(this.jid ? { jid: this.jid } : {}),
      ...(this.qr && this.state !== "connected" ? { qr: this.qr } : {}),
      ...(this.reason ? { reason: this.reason } : {}),
    };
  }

  private registerEvents() {
    this.client.on("qr", (event: WhatsmeowEvents["qr"]) => {
      this.state = "awaiting_qr";
      this.qr = { code: event.code, generatedAt: new Date().toISOString() };
      this.reason = undefined;
      this.publish("qr");
    });

    this.client.on("connected", ({ jid }) => {
      this.state = "connected";
      this.jid = jid;
      this.qr = undefined;
      this.reason = undefined;
      this.publish("connected");
    });

    this.client.on("disconnected", () => {
      this.state = "disconnected";
      this.publish("disconnected");
    });

    this.client.on("logged_out", ({ reason }) => {
      this.state = "logged_out";
      this.reason = reason;
      this.qr = undefined;
      this.publish("logged_out");
    });
  }

  private async initialize(): Promise<void> {
    try {
      const { jid } = await this.client.init();
      this.initialized = true;
      this.jid = jid;

      if (!jid) {
        this.state = "awaiting_qr";
        this.publish("status");
        await this.client.getQRChannel();
      }

      await this.client.connect();
    } catch (error) {
      this.state = "disconnected";
      this.reason =
        error instanceof Error ? error.message : "No se pudo iniciar WhatsApp";
      this.publish("disconnected");
      throw error;
    } finally {
      this.startPromise = undefined;
    }
  }

  private publish(event: string) {
    const data = this.snapshot();
    // Iterate over a snapshot so a subscriber can safely unsubscribe in its callback.
    for (const subscriber of this.subscribers) subscriber(event, data);
  }
}
