<script setup lang="ts">
defineProps<{ modelValue: string; placeholder?: string; ariaLabel?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>
<template><input :value="modelValue" :placeholder="placeholder" :aria-label="ariaLabel" type="text" class="w-full rounded-lg border border-neutral-200 py-2 pl-9 pr-3 text-base outline-none placeholder:text-neutral-400 focus:border-neutral-300 focus:ring-2 focus:ring-black/5" @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)" /></template>
