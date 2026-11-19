<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import QRCode from "qrcode";
import { Menu } from "lucide-vue-next";
import Button from "@/components/ui/Button.vue";
import Modal from "@/components/ui/Modal.vue";
import SessionList from "@/components/sessions/SessionList.vue";
import {
  deleteSession,
  disconnectSession,
  getSessions,
  startWhatsappConnection,
  subscribeToWhatsappEvents,
  updateSession,
} from "@/services/api";
import type { Session, SessionStatusFilter } from "@/types/session";
import type { WhatsappConnectionEvent } from "@/services/api";

defineEmits<{ menu: [] }>();
type ConnectionState =
  | "starting"
  | "awaiting_qr"
  | "connected"
  | "disconnected"
  | "logged_out"
  | "error";

const sessions = ref<Session[]>([]);
const search = ref("");
const status = ref<SessionStatusFilter>("All Statuses");
const notice = ref("");
const modal = ref<"edit" | "delete" | null>(null);
const selected = ref<Session | null>(null);
const editName = ref("");
const loading = ref(true);
const connectionModal = ref(false);
const connectionState = ref<ConnectionState>("starting");
const connectionMessage = ref("Preparando conexión…");
const connectionError = ref("");
const qrImage = ref("");
let eventSource: EventSource | null = null;

// Search and status are kept local to the view because they only affect presentation.
const filteredSessions = computed(() =>
  sessions.value.filter(
    (session) =>
      `${session.name} ${session.phone} ${session.id}`
        .toLowerCase()
        .includes(search.value.toLowerCase()) &&
      (status.value === "All Statuses" || session.status === status.value),
  ),
);
const showNotice = (message: string) => {
  notice.value = message;
  window.setTimeout(() => {
    notice.value = "";
  }, 2800);
};
const closeEventStream = () => {
  // A single active stream avoids duplicate QR/connected handlers after retries.
  eventSource?.close();
  eventSource = null;
};
const firstSession: Session = {
  id: "whatsapp-primary",
  name: "WhatsApp Business Bot",
  phone: "WhatsApp session",
  status: "Pending",
};
const loadSessions = async () => {
  loading.value = true;
  try {
    sessions.value = await getSessions();
  } catch (error) {
    showNotice(
      error instanceof Error
        ? error.message
        : "Unable to reach WhatsApp backend",
    );
  } finally {
    loading.value = false;
  }
};
onMounted(() => { void loadSessions(); });
onBeforeUnmount(closeEventStream);
const refresh = async () => {
  await loadSessions();
    showNotice("Sesiones actualizadas");
};
const openEdit = (session: Session) => {
  selected.value = session;
  editName.value = session.name;
  modal.value = "edit";
};
const openDelete = (session: Session) => {
  selected.value = session;
  modal.value = "delete";
};
const confirmModal = async () => {
  if (!selected.value) return;
  if (modal.value === "delete") {
    await deleteSession(selected.value.id);
    sessions.value = sessions.value.filter(
      (item) => item.id !== selected.value?.id,
    );
    showNotice("Session deleted");
  } else if (editName.value.trim()) {
    const updated = await updateSession({
      ...selected.value,
      name: editName.value.trim(),
    });
    sessions.value = sessions.value.map((item) =>
      item.id === updated.id ? updated : item,
    );
  }
  modal.value = null;
  selected.value = null;
};
const disconnect = async (session: Session) => {
  try {
    await disconnectSession();
    sessions.value = sessions.value.map((item) =>
      item.id === session.id ? { ...item, status: "Logged Out" } : item,
    );
    showNotice(`${session.name} disconnected`);
  } catch (error) {
    showNotice(
      error instanceof Error ? error.message : "Unable to disconnect WhatsApp",
    );
  }
};

const handleConnected = async (event: WhatsappConnectionEvent) => {
  closeEventStream();
  connectionState.value = "connected";
  connectionMessage.value = "WhatsApp conectado correctamente";
  if (event.jid)
    sessions.value = [
      {
        id: event.jid,
        name: "WhatsApp Business Bot",
        phone: `+${event.jid.split(":")[0]}`,
        status: "Connected",
      },
    ];
  window.setTimeout(async () => {
    connectionModal.value = false;
    await loadSessions();
  }, 1200);
};
const handleConnectionEvent = async (
  name: string,
  event: WhatsappConnectionEvent,
) => {
  if (name === "status") {
    connectionState.value = "starting";
    connectionMessage.value = "Preparando conexión…";
  }
  if (name === "qr" && event.qr?.code) {
    connectionState.value = "awaiting_qr";
    connectionMessage.value =
      "Escanea el código desde WhatsApp › Dispositivos vinculados";
    // QR generation happens in the browser; the backend only sends the pairing token.
    qrImage.value = await QRCode.toDataURL(event.qr.code, {
      width: 280,
      margin: 2,
    });
  }
  if (name === "connected") await handleConnected(event);
  if (name === "disconnected") {
    connectionState.value = "disconnected";
    connectionMessage.value = "Conexión perdida";
  }
  if (name === "logged_out") {
    closeEventStream();
    connectionState.value = "logged_out";
    connectionMessage.value =
      "La sesión fue cerrada. Debes autenticar nuevamente";
  }
};
const openConnection = async (session: Session) => {
  closeEventStream();
  selected.value = session;
  connectionModal.value = true;
  connectionState.value = "starting";
  connectionMessage.value = "Preparando conexión…";
  connectionError.value = "";
  qrImage.value = "";
  try {
    // Start first so an already-authenticated session can resolve immediately;
    // the SSE subscription then receives subsequent lifecycle events.
    const initial = await startWhatsappConnection();
    eventSource = subscribeToWhatsappEvents(
      {
        status: (event) => void handleConnectionEvent("status", event),
        qr: (event) => void handleConnectionEvent("qr", event),
        connected: (event) => void handleConnectionEvent("connected", event),
        disconnected: (event) =>
          void handleConnectionEvent("disconnected", event),
        logged_out: (event) => void handleConnectionEvent("logged_out", event),
      },
      () => {
        closeEventStream();
        connectionState.value = "error";
        connectionError.value =
          "No se pudo mantener la conexión con el backend. Puedes intentarlo nuevamente.";
      },
    );
    if (initial.connected || initial.state === "connected")
      await handleConnected(initial);
    else if (initial.state === "awaiting_qr")
      connectionMessage.value = "Esperando código QR…";
  } catch (error) {
    connectionState.value = "error";
    connectionError.value =
      error instanceof Error
        ? error.message
        : "No se pudo iniciar la conexión con WhatsApp.";
    closeEventStream();
  }
};
const createFirstSession = () => openConnection(firstSession);
const retryConnection = () => {
  if (selected.value) void openConnection(selected.value);
};
const closeConnection = () => {
  closeEventStream();
  connectionModal.value = false;
  qrImage.value = "";
  connectionError.value = "";
};
</script>

<template>
  <div
    v-if="notice"
    class="fixed right-5 top-5 z-50 rounded-lg bg-black px-4 py-3 text-sm text-white shadow-lg"
    role="status"
  >
    {{ notice }}
  </div>
  <main class="mx-auto w-full max-w-[1526px] flex-1 p-5 sm:p-8 lg:p-10">
    <header
      class="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-start"
    >
      <div class="flex items-start gap-3">
        <button
          aria-label="Open menu"
          class="mt-1 rounded-lg p-2 hover:bg-neutral-100 md:hidden"
          @click="$emit('menu')"
        >
          <Menu :size="20" />
        </button>
        <div>
          <h1 class="text-[30px] font-bold leading-tight tracking-[-.75px]">
            Sesiones de WhatsApp
          </h1>
          <p class="mt-1 text-base text-neutral-500">
            Administra tus sesiones y conexiones de WhatsApp
          </p>
        </div>
      </div>
      <!-- <div class="flex flex-wrap items-center gap-3">
        <Button class="gap-2" @click="showNotice('Help Center')"
          ><HelpCircle :size="16" class="text-neutral-500" />Help Center</Button
        ><Button class="gap-2" :disabled="loading" @click="refresh"
          ><RefreshCcw :size="16" class="text-neutral-500" />Refresh</Button
        ><Button
          variant="primary"
          @click="showNotice('Contact sales to upgrade your plan')"
          >Upgrade Plan</Button
        >
      </div> -->
    </header>

    <div class="mb-6 flex flex-col gap-3 sm:flex-row">
      <input
        v-model="search"
        class="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/5 sm:flex-1"
        aria-label="Search sessions"
        placeholder="Buscar sesiones"
      /><select
        v-model="status"
        class="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/5"
        aria-label="Filtrar sesiones"
      >
        <option value="All Statuses">Todos los estados</option>
        <option value="Connected">Conectada</option>
        <option value="Logged Out">Desconectada</option>
      </select>
    </div>
    <div
      v-if="loading"
      class="rounded-xl border border-dashed border-neutral-300 px-6 py-16 text-center text-neutral-500"
    >
      Loading sessions...
    </div>
    <SessionList
      v-else
      :sessions="filteredSessions"
      :can-create="sessions.length === 0"
      @edit="openEdit"
      @delete="openDelete"
      @connect="openConnection"
      @disconnect="disconnect"
      @create="createFirstSession"
    />
  </main>
  <Modal
    :open="modal === 'edit'"
    title="Edit session"
    @close="modal = null"
    @confirm="confirmModal"
    ><input
      v-model="editName"
      class="w-full rounded-lg border border-neutral-200 px-3 py-2 outline-none focus:ring-2 focus:ring-black/5"
      aria-label="Session name" /></Modal
  ><Modal
    :open="modal === 'delete'"
    title="Delete session"
    @close="modal = null"
    @confirm="confirmModal"
    ><p class="text-sm text-neutral-500">
      Are you sure you want to delete {{ selected?.name }}?
    </p></Modal
  >
  <Modal
    :open="connectionModal"
    title="Connect WhatsApp"
    :show-actions="false"
    @close="closeConnection"
    ><div class="flex flex-col items-center text-center">
      <div
        v-if="connectionState === 'starting'"
        class="flex flex-col items-center gap-3 py-8 text-neutral-500"
      >
        <span
          class="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-black"
        />{{ connectionMessage }}
      </div>
      <template v-else-if="qrImage"
        ><img
          :src="qrImage"
          alt="WhatsApp QR code"
          class="h-[280px] w-[280px] rounded-lg border border-neutral-200"
        />
        <p class="mt-4 text-sm text-neutral-600">
          {{ connectionMessage }}
        </p></template
      >
      <div
        v-else
        class="py-8 text-sm"
        :class="
          connectionState === 'connected'
            ? 'text-emerald-700'
            : connectionState === 'error'
              ? 'text-red-600'
              : 'text-neutral-600'
        "
      >
        <p>{{ connectionError || connectionMessage }}</p>
        <button
          v-if="connectionState === 'error'"
          class="mt-4 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          @click="retryConnection"
        >
          Retry
        </button>
      </div>
    </div></Modal
  >
</template>
