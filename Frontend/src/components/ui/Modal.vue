<script setup lang="ts">
// The modal is teleported to body so page stacking contexts cannot hide it.
withDefaults(defineProps<{ open: boolean; title: string; showActions?: boolean }>(), { showActions: true })
defineEmits<{ close: []; confirm: [] }>()
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-5" role="presentation" @click.self="!showActions && $emit('close')">
      <section class="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-xl" role="dialog" aria-modal="true" :aria-label="title">
        <div class="flex items-start justify-between gap-4"><h2 class="text-lg font-medium">{{ title }}</h2><button class="rounded-lg p-1 text-neutral-500 hover:bg-neutral-100 hover:text-black" aria-label="Cerrar" @click="$emit('close')">×</button></div>
        <div class="mt-4"><slot /></div>
        <div v-if="showActions" class="mt-6 flex justify-end gap-3"><button class="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium hover:bg-neutral-50" @click="$emit('close')">Cancelar</button><button class="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800" @click="$emit('confirm')">Confirmar</button></div>
      </section>
    </div>
  </Teleport>
</template>
