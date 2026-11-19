<script setup lang="ts">
import type { Session } from '@/types/session'
import { Plus } from 'lucide-vue-next'
import SessionCard from './SessionCard.vue'
defineProps<{ sessions: Session[]; canCreate: boolean }>()
defineEmits<{ edit: [session: Session]; delete: [session: Session]; connect: [session: Session]; disconnect: [session: Session]; create: [] }>()
</script>
<template><section class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"><SessionCard v-for="session in sessions" :key="session.id" :session="session" @edit="$emit('edit', $event)" @delete="$emit('delete', $event)" @connect="$emit('connect', $event)" @disconnect="$emit('disconnect', $event)" /><div v-if="sessions.length === 0" class="col-span-full rounded-xl border border-dashed border-neutral-300 px-6 py-16 text-center text-neutral-500"><p>{{ canCreate ? 'Aún no tienes una sesión de WhatsApp.' : 'No se encontraron sesiones.' }}</p><button v-if="canCreate" class="mx-auto mt-5 inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800" @click="$emit('create')"><Plus :size="16" />Agregar primera sesión</button></div></section></template>
