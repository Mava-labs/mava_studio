import { createVaporApp } from "vue";
import App from "./App.vue";
import "./assets/main.css";
import persistedstate from "pinia-plugin-persistedstate";
import { createPinia } from "pinia";

const pinia = createPinia();
pinia.use(persistedstate);
createVaporApp(App).use(pinia).mount("#app");