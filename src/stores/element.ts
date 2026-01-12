import { defineStore } from "pinia";
import { ref } from "vue";
import { usePagesStore } from "./pages";

export const useElementStore = defineStore('element', () => {
    const activeElementId = ref<string | null>(null);

    function setActiveElement(elementId: string | null) {
        activeElementId.value = elementId;
    }
    
    return {
        activeElementId,
        setActiveElement,
    };
});