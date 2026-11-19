<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from 'vue-router'
import {
  ArrowLeft,
  Check,
  Menu,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-vue-next";
import Button from "@/components/ui/Button.vue";
import {
  createPersona,
  deletePersona,
  getAvailableModels,
  getPersonas,
  setActivePersona,
  updatePersona,
} from "@/services/api";
import type {
  AvailableModel,
  PersonaGenerationConfig,
  PersonaInput,
  PersonaSummary,
} from "@/services/api";

defineEmits<{ menu: [] }>();
const route = useRoute()
const personas = ref<PersonaSummary[]>([]);
const models = ref<AvailableModel[]>([]);
// Initialize selectedId from the dedicated edit route.
const selectedId = ref<string | null>(route.params.id && route.params.id !== 'nueva' ? String(route.params.id) : null);
const loading = ref(true);
const saving = ref(false);
const notice = ref("");
const form = ref<PersonaInput>(emptyForm());
const selected = computed(
  () =>
    personas.value.find((persona) => persona.id === selectedId.value) ?? null,
);

watch(() => route.params.id, (newId) => {
  selectedId.value = newId && newId !== 'nueva' ? String(newId) : null
  // when route changes, load personas and select matching one
  void load()
})

function emptyForm(): PersonaInput {
  return {
    name: "",
    basePrompt: "",
    description: "",
    model: "gemini-2.0-flash",
    systemInstruction: "",
    generationConfig: {
      temperature: 1,
      thinkingLevel: "medium",
      responseMimeType: "text/plain",
    },
  };
}
function showNotice(message: string) {
  notice.value = message;
  window.setTimeout(() => {
    notice.value = "";
  }, 2800);
}
function editPersona(persona: PersonaSummary) {
  selectedId.value = persona.id;
  form.value = {
    id: persona.id,
    name: persona.name,
    basePrompt: persona.basePrompt,
    description: persona.description,
    model: persona.model || "gemini-2.0-flash",
    systemInstruction:
      persona.systemInstruction ||
      `${persona.basePrompt}\n\n${persona.description}`,
    generationConfig: { ...persona.generationConfig },
  };
}
async function load() {
  loading.value = true;
  try {
    const [loadedPersonas, loadedModels] = await Promise.all([
      getPersonas(),
      getAvailableModels(),
    ]);
    personas.value = loadedPersonas;
    models.value = loadedModels;
    if (selectedId.value) {
      const current = personas.value.find(
        (item) => item.id === selectedId.value,
      );
      if (current) editPersona(current);
    } else if (personas.value[0]) editPersona(personas.value[0]);
  } catch (error) {
    showNotice(
      error instanceof Error
        ? error.message
        : "No se pudieron cargar las personalidades",
    );
  } finally {
    loading.value = false;
  }
}
onMounted(() => {
  void load();
});
function newPersona() {
  selectedId.value = null;
  form.value = emptyForm();
}
function config(): PersonaGenerationConfig {
  const value = form.value.generationConfig;
  return { ...value, stopSequences: value.stopSequences?.filter(Boolean) };
}
async function save() {
  if (!form.value.name.trim() || !form.value.systemInstruction.trim()) {
    showNotice("Completa el nombre y las instrucciones del sistema");
    return;
  }
  saving.value = true;
  try {
    const input = {
      ...form.value,
      name: form.value.name.trim(),
      systemInstruction: form.value.systemInstruction.trim(),
      basePrompt: form.value.systemInstruction.trim(),
      description: form.value.description.trim(),
      generationConfig: config(),
    };
    const result = form.value.id
      ? await updatePersona(form.value.id, input)
      : await createPersona(input);
    selectedId.value = result.id;
    await load();
    showNotice("Configuración guardada");
  } catch (error) {
    showNotice(
      error instanceof Error
        ? error.message
        : "No se pudo guardar la configuración",
    );
  } finally {
    saving.value = false;
  }
}
async function activate() {
  if (!selectedId.value) return;
  try {
    await setActivePersona(selectedId.value);
    await load();
    showNotice("Personalidad activa actualizada");
  } catch (error) {
    showNotice(
      error instanceof Error
        ? error.message
        : "No se pudo activar la personalidad",
    );
  }
}
async function remove() {
  if (!selected.value || !window.confirm(`¿Eliminar ${selected.value.name}?`))
    return;
  try {
    await deletePersona(selected.value.id);
    selectedId.value = null;
    await load();
    newPersona();
    showNotice("Personalidad eliminada");
  } catch (error) {
    showNotice(
      error instanceof Error
        ? error.message
        : "No se pudo eliminar la personalidad",
    );
  }
}
</script>

<template>
  <div
    v-if="notice"
    class="fixed right-5 top-5 z-50 rounded-lg bg-black px-4 py-3 text-sm text-white shadow-lg"
  >
    {{ notice }}
  </div>
  <main
    class="mx-auto flex w-full max-w-[1526px] flex-1 flex-col p-5 sm:p-8 lg:p-10"
  >
    <header class="mb-6 flex items-start gap-3">
      <button
        aria-label="Abrir menú"
        class="mt-1 rounded-lg p-2 hover:bg-neutral-100 md:hidden"
        @click="$emit('menu')"
      >
        <Menu :size="20" />
      </button>
      <div>
        <div
          class="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-neutral-500"
        >
          <Sparkles :size="14" /> Estudio de personalidades
        </div>
        <h1 class="mt-2 text-[30px] font-bold leading-tight tracking-[-.75px]">
          Configura tu asistente
        </h1>
        <p class="mt-1 text-base text-neutral-500">
          Controla el modelo, el razonamiento y la generación de respuestas
          desde una sola vista.
        </p>
      </div>
    </header>
    <div
      v-if="loading"
      class="rounded-xl border border-dashed border-neutral-300 px-6 py-16 text-center text-neutral-500"
    >
      Cargando configuración...
    </div>
    <div
      v-else
      class="grid min-h-[650px] flex-1 gap-6 lg:grid-cols-[270px_minmax(0,1fr)]"
    >
      <aside class="rounded-xl border border-neutral-200 bg-white p-3">
        <div class="mb-3 flex items-center justify-between px-2">
          <span class="text-sm font-semibold">Personalidades</span
          ><button
            class="rounded-lg p-2 hover:bg-neutral-100"
            aria-label="Nueva personalidad"
            @click="newPersona"
          >
            <Plus :size="16" />
          </button>
        </div>
        <div class="space-y-1">
          <button
            v-for="persona in personas"
            :key="persona.id"
            class="w-full rounded-lg p-3 text-left transition"
            :class="
              selectedId === persona.id
                ? 'bg-neutral-100'
                : 'hover:bg-neutral-50'
            "
            @click="editPersona(persona)"
          >
            <span class="block truncate text-sm font-medium">{{
              persona.name
            }}</span
            ><span class="mt-1 flex items-center gap-1 text-xs text-neutral-500"
              ><span
                v-if="persona.active"
                class="h-1.5 w-1.5 rounded-full bg-emerald-500"
              />{{ persona.active ? "Activa" : "Inactiva" }}</span
            >
          </button>
        </div>
        <button
          v-if="!personas.length"
          class="w-full rounded-lg border border-dashed border-neutral-300 p-3 text-sm text-neutral-500"
          @click="newPersona"
        >
          Crear primera personalidad
        </button>
      </aside>
      <section class="rounded-xl border border-neutral-200 bg-white">
        <div
          class="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 p-5"
        >
          <div>
            <p
              class="text-xs font-medium uppercase tracking-wider text-neutral-500"
            >
              {{ selected ? "Editar personalidad" : "Nueva personalidad" }}
            </p>
            <h2 class="mt-1 text-xl font-semibold">
              {{ form.name || "Sin nombre" }}
            </h2>
          </div>
          <div class="flex gap-2">
            <Button v-if="selected && !selected.active" @click="activate"
              ><Check :size="15" />Activar</Button
            ><Button
              v-if="selected"
              aria-label="Eliminar personalidad"
              @click="remove"
              ><Trash2 :size="15" />Eliminar</Button
            ><Button variant="primary" :disabled="saving" @click="save">{{
              saving ? "Guardando..." : "Guardar cambios"
            }}</Button>
          </div>
        </div>
        <div class="grid gap-8 p-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div class="space-y-6">
            <div>
              <label class="mb-2 block text-sm font-medium">Nombre</label
              ><input
                v-model="form.name"
                class="w-full rounded-lg border border-neutral-200 px-3 py-2 outline-none focus:ring-2 focus:ring-black/5"
                placeholder="Ej. Asistente de ventas"
              />
            </div>
            <div>
              <label class="mb-2 block text-sm font-medium"
                >Instrucciones del sistema</label
              >
              <p class="mb-2 text-xs text-neutral-500">
                Define el comportamiento, tono, límites y reglas que debe seguir
                el modelo.
              </p>
              <textarea
                v-model="form.systemInstruction"
                class="min-h-64 w-full rounded-lg border border-neutral-200 px-3 py-3 font-mono text-sm outline-none focus:ring-2 focus:ring-black/5"
                placeholder="Eres un asistente..."
              />
            </div>
            <div>
              <label class="mb-2 block text-sm font-medium"
                >Notas del negocio
                <span class="font-normal text-neutral-400"
                  >(opcional)</span
                ></label
              ><textarea
                v-model="form.description"
                class="min-h-28 w-full rounded-lg border border-neutral-200 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-black/5"
                placeholder="Catálogo, horarios, políticas..."
              />
            </div>
          </div>
          <div class="space-y-5">
            <div>
              <label class="mb-2 flex justify-between text-sm font-medium"
                ><span>Nivel de pensamiento</span
                ><span class="text-neutral-500">{{
                  form.generationConfig.thinkingLevel
                }}</span></label
              ><select
                v-model="form.generationConfig.thinkingLevel"
                class="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
              >
                <option value="minimal">Mínimo</option>
                <option value="low">Bajo</option>
                <option value="medium">Medio</option>
                <option value="high">Alto</option>
              </select>
            </div>
            <div>
              <label class="mb-2 flex justify-between text-sm font-medium"
                ><span>Temperatura</span
                ><span class="text-neutral-500">{{
                  form.generationConfig.temperature
                }}</span></label
              ><input
                v-model.number="form.generationConfig.temperature"
                type="range"
                min="0"
                max="2"
                step="0.1"
                class="w-full accent-black"
              />
            </div>
            <div>
              <label class="mb-2 block text-sm font-medium"
                >Parámetros avanzados</label
              >
              <div class="space-y-3">
                <input
                  v-model.number="form.generationConfig.maxOutputTokens"
                  type="number"
                  min="1"
                  class="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  placeholder="Tokens máximos"
                /><input
                  v-model.number="form.generationConfig.topP"
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  class="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  placeholder="Top P"
                /><input
                  v-model.number="form.generationConfig.topK"
                  type="number"
                  min="0"
                  class="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  placeholder="Top K"
                /><select
                  v-model="form.generationConfig.responseMimeType"
                  class="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="text/plain">Texto</option>
                  <option value="application/json">JSON</option>
                </select>
              </div>
            </div>
            <div>
              <label class="mb-2 block text-sm font-medium"
                >Secuencias de parada</label
              ><input
                :value="form.generationConfig.stopSequences?.join(', ')"
                class="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                placeholder="Separadas por comas"
                @input="
                  form.generationConfig.stopSequences = (
                    $event.target as HTMLInputElement
                  ).value
                    .split(',')
                    .map((item) => item.trim())
                    .filter(Boolean)
                "
              />
            </div>
          </div>
          <div class="mt-5 border-t border-neutral-100 pt-5">
            <label class="mb-2 block text-sm font-medium">Modelo</label><select
              v-model="form.model"
              aria-label="Seleccionar modelo Gemini"
              class="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
            >
              <option v-if="!models.length" value="gemini-2.0-flash">gemini-2.0-flash</option>
              <option v-for="model in models" :key="model.id" :value="model.id">
                {{ model.displayName }} ({{ model.id }})
              </option>
            </select>
            <p class="mt-1 text-xs text-neutral-500">
              El modelo seleccionado se usará para esta personalidad.
            </p>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>
