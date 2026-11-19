<script setup lang="ts">
import type { Component } from 'vue'
defineProps<{ icon: Component; label: string; active?: boolean }>()
defineEmits<{ click: [] }>()
</script>
<template><button class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition" :class="active ? 'bg-neutral-100 text-black' : 'text-neutral-600 hover:bg-neutral-50 hover:text-black'" @click="$emit('click')"><component :is="icon" :size="18" :stroke-width="active ? 2.5 : 2" :class="active ? 'text-black' : 'text-neutral-500'" />{{ label }}</button></template>
