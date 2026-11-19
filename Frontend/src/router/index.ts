import { createRouter, createWebHistory } from "vue-router";
import DashboardView from "@/views/DashboardView.vue";
import SessionsView from "@/views/SessionsView.vue";
import PersonalitiesView from "@/views/PersonalitiesView.vue";
import PersonalityStudioView from "@/views/PersonalityStudioView.vue";

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/sessions" },
    { path: "/dashboard", component: DashboardView },
    { path: "/sessions", component: SessionsView },
    { path: "/personalidades", component: PersonalitiesView },
    { path: "/personalidades/nueva", component: PersonalityStudioView },
    { path: "/personalidades/:id/editar", component: PersonalityStudioView }
  ],
});
