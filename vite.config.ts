import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import monacoEditorPluginImport from "vite-plugin-monaco-editor";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// Fix ESM/CJS interop
const monacoEditorPlugin =
    (monacoEditorPluginImport as any).default ?? monacoEditorPluginImport

// https://vite.dev/config/
export default defineConfig(async () => ({
    build: {
        sourcemap: true
    },
    plugins: [
        vue(),
        tailwindcss(),
        monacoEditorPlugin({
            languageWorkers: ["editorWorkerService", "typescript", "json"],
        })
    ],

    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    //
    // 1. prevent Vite from obscuring rust errors
    clearScreen: false,
    // 2. tauri expects a fixed port, fail if that port is not available
    server: {

        port: 1420,
        strictPort: true,
        host: host || false,
        hmr: host
            ? {
                protocol: "ws",
                host,
                port: 1421,
            }
            : undefined,
        watch: {
            // 3. tell Vite to ignore watching `src-tauri`
            ignored: ["**/src-tauri/**"],
        },
    },
}));
