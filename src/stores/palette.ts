import { defineStore } from "pinia";
import { ref } from "vue";

export const usePaletteStore = defineStore('palette', () => {
  const colors = ref<string[]>([
    '#FFFFFF',
    '#000000',
    '#FF0000',
    '#00FF00',
    '#0000FF',
  ]);

  function addColor(color: string) {
    if (!colors.value.includes(color)) {
      colors.value.push(color);
    }
  }

  function removeColor(color: string) {
    colors.value = colors.value.filter(c => c !== color);
  }

  return {
    colors,
    addColor,
    removeColor,
  };
});