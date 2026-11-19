<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Menu, Pencil, Plus, Trash2 } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import Modal from '@/components/ui/Modal.vue'
import { createPersona, deletePersona, getPersonas, setActivePersona, updatePersona } from '@/services/api'
import type { PersonaSummary } from '@/services/api'

defineEmits<{ menu: [] }>()
const router = useRouter()
const personas = ref<PersonaSummary[]>([])
const filterTerm = ref('')
const activePersonaId = ref('')
const personaModal = ref<'create' | 'edit' | 'delete' | null>(null)
const selectedPersona = ref<PersonaSummary | null>(null)
const personaName = ref('')
const personaBasePrompt = ref('')
const personaDescription = ref('')
const notice = ref('')
const loading = ref(true)

const filteredPersonas = computed(() => {
  const term = filterTerm.value.trim().toLowerCase()
  if (!term) return personas.value
  return personas.value.filter(p => p.name.toLowerCase().includes(term) || p.description.toLowerCase().includes(term) || p.id.toLowerCase().includes(term))
})

const showNotice = (message: string) => { notice.value = message; window.setTimeout(() => { notice.value = '' }, 2800) }
const loadPersonas = async () => {
  loading.value = true
  try {
    personas.value = await getPersonas()
    activePersonaId.value = personas.value.find((persona) => persona.active)?.id ?? ''
  } catch (error) { showNotice(error instanceof Error ? error.message : 'No se pudieron cargar las personalidades') }
  finally { loading.value = false }
}
onMounted(() => { void loadPersonas() })
const openCreate = () => { router.push('/personalidades/nueva') }
const openEdit = (persona: PersonaSummary) => { router.push({ path: `/personalidades/${encodeURIComponent(persona.id)}/editar` }) }
const openDelete = (persona: PersonaSummary) => { selectedPersona.value = persona; personaModal.value = 'delete' }
const applyPersona = async (id: string) => {
  try { await setActivePersona(id); await loadPersonas(); showNotice('Personalidad activa actualizada') }
  catch (error) { showNotice(error instanceof Error ? error.message : 'No se pudo activar la personalidad') }
}
const confirmModal = async () => {
  if (personaModal.value === 'delete' && selectedPersona.value) {
    try { await deletePersona(selectedPersona.value.id); await loadPersonas(); showNotice('Personalidad eliminada'); personaModal.value = null; selectedPersona.value = null }
    catch (error) { showNotice(error instanceof Error ? error.message : 'No se pudo eliminar la personalidad') }
    return
  }
  if (!personaName.value.trim() || !personaBasePrompt.value.trim() || !personaDescription.value.trim()) { showNotice('Completa todos los campos de la personalidad'); return }
  try {
    const input = { name: personaName.value.trim(), basePrompt: personaBasePrompt.value.trim(), description: personaDescription.value.trim(), model: 'gemini-2.0-flash', systemInstruction: `${personaBasePrompt.value.trim()}\n\n${personaDescription.value.trim()}`, generationConfig: {} }
    if (personaModal.value === 'create') await createPersona(input)
    else if (personaModal.value === 'edit' && selectedPersona.value) await updatePersona(selectedPersona.value.id, input)
    await loadPersonas(); showNotice(personaModal.value === 'create' ? 'Personalidad creada' : 'Personalidad actualizada'); personaModal.value = null; selectedPersona.value = null
  } catch (error) { showNotice(error instanceof Error ? error.message : 'No se pudo guardar la personalidad') }
}
</script>

<template>
  <div v-if="notice" class="fixed right-5 top-5 z-50 rounded-lg bg-black px-4 py-3 text-sm text-white shadow-lg" role="status">{{ notice }}</div>
  <main class="mx-auto w-full max-w-[1526px] flex-1 p-5 sm:p-8 lg:p-10">
    <header class="mb-8 flex items-start gap-3">
      <button aria-label="Abrir menú" class="mt-1 rounded-lg p-2 hover:bg-neutral-100 md:hidden" @click="$emit('menu')"><Menu :size="20" /></button>
      <div><h1 class="text-[30px] font-bold leading-tight tracking-[-.75px]">Personalidades</h1><p class="mt-1 text-base text-neutral-500">Configura el tono y las instrucciones que usará tu asistente.</p></div>
    </header>
    <section class="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 class="text-lg font-semibold">Personalidades configuradas</h2><p class="text-sm text-neutral-500">Solo la personalidad activa se utiliza para los mensajes nuevos.</p></div><Button variant="primary" class="gap-2" @click="openCreate"><Plus :size="16" />Nueva personalidad</Button></div>
      <div v-if="loading" class="rounded-lg border border-dashed border-neutral-300 px-6 py-12 text-center text-neutral-500">Cargando personalidades...</div>
      <template v-else>
        <div class="mb-4 flex items-center justify-between gap-3">
          <input v-model="filterTerm" placeholder="Buscar personalidades..." class="rounded-lg border border-neutral-200 px-3 py-2 text-sm w-full max-w-sm" />
        </div>
        <div v-if="personas.length" class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <article v-for="persona in filteredPersonas" :key="persona.id" class="rounded-lg border border-neutral-200 bg-white p-4 cursor-pointer" @click="openEdit(persona)">
            <div class="flex items-start justify-between gap-3">
              <div>
                <h3 class="font-medium">{{ persona.name }}</h3>
                <p class="mt-1 text-xs text-neutral-500">{{ persona.id }}</p>
              </div>
              <span v-if="persona.active" class="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">Activa</span>
            </div>
            <p class="mt-3 line-clamp-2 text-sm text-neutral-600">{{ persona.description }}</p>
            <p class="mt-3 text-xs text-neutral-500"><span class="rounded bg-neutral-100 px-2 py-1">Modelo</span> {{ persona.model || 'gemini-2.0-flash' }}</p>
            <div class="mt-4 flex gap-2">
              <Button v-if="!persona.active" class="flex-1" @click.stop="activePersonaId = persona.id; applyPersona(persona.id)">Activar</Button>
              <Button class="gap-1" aria-label="Editar personalidad" @click.stop="openEdit(persona)"><Pencil :size="14" />Editar</Button>
              <Button class="gap-1" aria-label="Eliminar personalidad" @click.stop="openDelete(persona)"><Trash2 :size="14" />Eliminar</Button>
            </div>
          </article>
        </div>
        <p v-else class="text-sm text-neutral-500">No hay personalidades configuradas.</p>
      </template>
    </section>
  </main>
  <Modal :open="personaModal === 'create' || personaModal === 'edit'" :title="personaModal === 'create' ? 'Nueva personalidad' : 'Editar personalidad'" @close="personaModal = null" @confirm="confirmModal"><div class="space-y-3"><input v-model="personaName" class="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" placeholder="Nombre" aria-label="Nombre de la personalidad" /><textarea v-model="personaBasePrompt" class="min-h-24 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" placeholder="Instrucciones base" aria-label="Instrucciones base" /><textarea v-model="personaDescription" class="min-h-24 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" placeholder="Descripción y reglas del negocio" aria-label="Descripción de la personalidad" /></div></Modal>
  <Modal :open="personaModal === 'delete'" title="Eliminar personalidad" @close="personaModal = null" @confirm="confirmModal"><p class="text-sm text-neutral-500">¿Deseas eliminar {{ selectedPersona?.name }}? La personalidad activa debe cambiarse antes de eliminarla.</p></Modal>
</template>
