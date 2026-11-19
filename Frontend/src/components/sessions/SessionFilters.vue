<script setup lang="ts">
import { Search } from 'lucide-vue-next'
import Input from '@/components/ui/Input.vue'
import type { SessionStatusFilter } from '@/types/session'
defineProps<{ search: string; status: SessionStatusFilter }>()
defineEmits<{ 'update:search': [value: string]; 'update:status': [value: SessionStatusFilter] }>()
</script>
<template><section class="mb-6 flex flex-col gap-3 sm:flex-row"><div class="relative flex-1"><Search :size="16" class="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-neutral-400" /><Input :model-value="search" placeholder="Search sessions..." aria-label="Search sessions" @update:model-value="$emit('update:search', $event)" /></div><select :value="status" aria-label="Filter by status" class="min-w-40 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-base outline-none focus:ring-2 focus:ring-black/5" @change="$emit('update:status', ($event.target as HTMLSelectElement).value as SessionStatusFilter)"><option>All Statuses</option><option>Connected</option><option>Pending</option><option>Logged Out</option></select></section></template>
