import { createVaporApp } from "vue";
import App from "./App.vue";
import PreviewApp from "./PreviewApp.vue";
import "./assets/main.css";
import persistedstate from "pinia-plugin-persistedstate";
import { createPinia } from "pinia";
import { prepareTauriStorage } from "./utils/tauriStorage";

async function bootstrap() {
	await prepareTauriStorage();

	const pinia = createPinia();
	pinia.use(persistedstate);

	// Preview opens as a separate OS window pointed at index.html#preview?... —
	// same bundle, different root component, no router involved (see
	// composables/usePreview.ts and PreviewApp.vue).
	const isPreviewWindow = location.hash.startsWith("#preview");
	const root = (isPreviewWindow ? PreviewApp : App) as Parameters<typeof createVaporApp>[0];
	createVaporApp(root).use(pinia).mount("#app");
}

void bootstrap();