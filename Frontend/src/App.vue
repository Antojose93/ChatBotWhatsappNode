<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import Sidebar from "./components/layout/Sidebar.vue";
const router = useRouter();
const menuOpen = ref(false);
const navigate = (label: string) => {
  menuOpen.value = false;   
  if (label === "Sesiones") router.push("/sessions");
  if (label === "Personalidades") router.push("/personalidades");
  if (label === "Panel") router.push("/dashboard");
 
};
</script>
<template>
  <div
    class="flex min-h-screen bg-white text-black antialiased selection:bg-neutral-200 selection:text-black"
  >
    <Sidebar :open="menuOpen" @navigate="navigate" /><button
      v-if="menuOpen"
      aria-label="Close menu"
      class="fixed inset-0 z-30 bg-black/20 md:hidden"
      @click="menuOpen = false"
    /><RouterView @menu="menuOpen = true" />
  </div>
</template>
<style>
@import url("https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap");
body {
  margin: 0;
  min-width: 320px;
  font-family: "Instrument Sans", Arial, sans-serif;
}
* {
  box-sizing: border-box;
}
button,
input,
select {
  font: inherit;
}
button {
  cursor: pointer;
}
</style>
