<script setup lang="ts">
import type { SessionStatus } from '@/types/session'
defineProps<{ status: SessionStatus }>()
</script>
<template><span class="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium" :class="status === 'Connected' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : status === 'Pending' ? 'border-amber-100 bg-amber-50 text-amber-700' : 'border-neutral-200/60 bg-neutral-100 text-neutral-600'"><span class="h-1.5 w-1.5 rounded-full" :class="status === 'Connected' ? 'bg-emerald-500' : status === 'Pending' ? 'bg-amber-500' : 'bg-neutral-400'" />{{ status }}</span></template>
