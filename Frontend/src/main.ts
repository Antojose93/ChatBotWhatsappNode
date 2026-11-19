import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './style.css'
// Router installation happens before mount so the first render resolves the URL.
createApp(App).use(router).mount('#app')
