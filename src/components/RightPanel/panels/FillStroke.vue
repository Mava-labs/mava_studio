<template>
    <div class="panel-root px-3">
        <div class="section-head mb-3">
            <h3 class="section-title">Fills &amp; Strokes</h3>
            <span class="badge">Style</span>
        </div>

        <div class="flex flex-col gap-3">
            <div class="input-block">
                <label class="input-label">Fill</label>
                <input type="color" class="color-input" :value="fillColor"
                    @input="setFill(($event.target as HTMLInputElement).value)" aria-label="Fill color" />
            </div>

            <div class="input-block">
                <label class="input-label">Stroke</label>
                <div class="grid grid-cols-[auto_1fr] gap-2 items-center w-full">
                    <input type="color" class="color-input" :value="strokeColor"
                        @input="setStrokeColor(($event.target as HTMLInputElement).value)" aria-label="Stroke color" />
                    <div class="grid grid-cols-[1fr_1fr] gap-2">
                        <input type="number" min="0" step="0.5" class="input-field" :value="strokeWidth"
                            @change="setStrokeWidth(+($event.target as HTMLInputElement).value)"
                            aria-label="Stroke width" />
                        <select class="input-field" :value="strokeStyle"
                            @change="setStrokeStyle(($event.target as HTMLSelectElement).value as any)"
                            aria-label="Stroke style">
                            <option value="solid">Solid</option>
                            <option value="dashed">Dashed</option>
                            <option value="dotted">Dotted</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts" vapor>
    import { computed } from 'vue';
    import { useActiveElement } from '../../../composables/useActiveElement';
    import type { SvgStyle } from '../../../types/element';

    const { element, update } = useActiveElement();

    const svgStyle = computed(() => {
        const el = element.value;
        if (!el || el.kind !== 'svg') return null;
        return el.style as SvgStyle;
    });

    const fillColor = computed(() => svgStyle.value?.fill ?? '#000000');
    const strokeColor = computed(() => svgStyle.value?.stroke?.color ?? '#000000');
    const strokeWidth = computed(() => svgStyle.value?.stroke?.width ?? 1);
    const strokeStyle = computed(() => svgStyle.value?.stroke?.style ?? 'solid');

    function currentStroke() {
        return { color: strokeColor.value, width: strokeWidth.value, style: strokeStyle.value };
    }

    function setFill(v: string) { update({ style: { fill: v || '#000000' } }); }
    function setStrokeColor(v: string) { update({ style: { stroke: { ...currentStroke(), color: v || '#000000' } } }); }
    function setStrokeWidth(v: number) { update({ style: { stroke: { ...currentStroke(), width: Math.max(0, v) } } }); }
    function setStrokeStyle(v: 'solid' | 'dashed' | 'dotted') { update({ style: { stroke: { ...currentStroke(), style: v } } }); }
</script>

<style scoped>
    .panel-root {
        font-family: system-ui, sans-serif;
        font-size: 12px;
        color: #e2e8f0;
    }

    .section-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid #1e293b;
        padding-bottom: 6px;
    }

    .section-title {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #cbd5e1;
    }

    .badge {
        font-size: 10px;
        padding: 2px 8px;
        border-radius: 8px;
        background: #0f172a;
        color: #94a3b8;
        text-transform: uppercase;
    }

    .input-block {
        display: flex;
        flex-direction: column;
        gap: 6px;
        background: #0f172a;
        padding: 10px;
        border-radius: 6px;
        border: 1px solid #1e293b;
    }

    .input-label {
        font-weight: 600;
        font-size: 11px;
        letter-spacing: 0.08em;
        color: #cbd5e1;
        text-transform: uppercase;
    }

    .input-field {
        width: 100%;
        background: #0b1221;
        color: #f1f5f9;
        padding: 8px 10px;
        font-size: 12px;
        border: 1px solid #27354a;
        border-radius: 6px;
        outline: none;
    }

    .color-input {
        width: 100%;
        height: 36px;
        padding: 4px 6px;
        background: #0b1221;
        border: 1px solid #27354a;
        border-radius: 6px;
    }
</style>