<template>
  <button
    class="color-chip"
    :style="{ width: `${chipWidth}%`, height: `${chipHeight}rem`, background: value || '#334155' }"
    :aria-label="label"
    @click="openPicker"
  ></button>
</template>

<script setup lang="ts">
import { usePaletteStore } from '../../stores/palette';

const palette = usePaletteStore();

const props = withDefaults(defineProps<{
  value?: string;
  label?: string;
  chipWidth: number;
  chipHeight: number;
}>(), {
  label: ''
});

const emit = defineEmits<{
  (e: 'preview', color: string): void;
  (e: 'commit', color: string): void;
}>();

function openPicker() {
//   palette.openPalette({
//     value: props.value,
//     label: props.label,
//     onPreview: (c: string) => emit('preview', c),
//     onCommit: (c: string) => emit('commit', c)
//   });
}
</script>

<style scoped>
.color-chip { border-radius:4px; border:1px solid #334155; cursor:pointer; position:relative; box-shadow:0 0 0 1px rgba(255,255,255,0.05) inset; width:100%; }
</style>
