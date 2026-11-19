<script setup lang="ts">
import {
  BookOpen,
  CircleHelp,
  CreditCard,
  LayoutDashboard,
  Mail,
  Phone,
  Sparkles,
} from "lucide-vue-next";
import NavItem from "./NavItem.vue";
import { useRoute } from "vue-router";
defineProps<{ open?: boolean }>();
defineEmits<{ navigate: [label: string] }>();
const route = useRoute();
</script>
<template>
  <aside
    class="fixed inset-y-0 left-0 z-40 flex w-60 flex-col justify-between border-r border-neutral-200 bg-white transition-transform md:static md:translate-x-0"
    :class="open ? 'translate-x-0' : '-translate-x-full'"
  >
    <div class="space-y-6 p-4 pt-6">
      <div class="px-3 text-xs font-medium uppercase tracking-wider text-neutral-500">Plataforma</div>
      <nav class="space-y-1">
        <NavItem
          :icon="LayoutDashboard"
          label="Panel"
          :active="route.path === '/dashboard'"
          @click="$emit('navigate', 'Panel')"
        /><NavItem
          :icon="Phone"
          label="Sesiones"
          :active="route.path === '/sessions'"
          @click="$emit('navigate', 'Sesiones')"
        /><NavItem
          :icon="Sparkles"
          label="Personalidades"
          :active="route.path === '/personalidades'"
          @click="$emit('navigate', 'Personalidades')"
        />
      </nav>
    </div>
    <div class="space-y-1 border-t border-neutral-100 p-4">
      <NavItem
        :icon="BookOpen"
        label="Documentación"
        @click="$emit('navigate', 'Documentación')"
      /><NavItem
        :icon="CircleHelp"
        label="Ayuda"
        @click="$emit('navigate', 'Ayuda')"
      /><NavItem
        :icon="Mail"
        label="Contacto"
        @click="$emit('navigate', 'Contacto')"
      />
    </div>
  </aside>
</template>
