import { createVaporApp } from "vue";
import App from "./App.vue";
import "./assets/main.css";
import persistedstate from "pinia-plugin-persistedstate";
import { createPinia } from "pinia";
import { prepareTauriStorage } from "./utils/tauriStorage";

async function bootstrap() {
	await prepareTauriStorage();

	const pinia = createPinia();
	pinia.use(persistedstate);

	const vaporRoot = App as Parameters<typeof createVaporApp>[0];
	createVaporApp(vaporRoot).use(pinia).mount("#app");
}

void bootstrap();