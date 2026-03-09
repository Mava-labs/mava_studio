<template>
    <div class="panel-root px-3">
        <div class="section-head mb-3">
            <h3 class="section-title">Fills &amp; Strokes</h3>
            <span class="badge">Style</span>
        </div>

        <div class="flex flex-col gap-3">
            <div class="prop-row">
                <span class="clab">Fill</span>
                <input type="color" class="color-chip" :value="fillColor"
                    @input="setFill(($event.target as HTMLInputElement).value)" aria-label="Fill color" />
            </div>

            <div class="prop-row">
                <span class="clab">Stroke</span>
                <input type="color" class="color-chip" :value="strokeColor"
                    @input="setStrokeColor(($event.target as HTMLInputElement).value)" aria-label="Stroke color" />
            </div>

            <div class="prop-row">
                <span class="clab">Width</span>
                <div class="num">
                    <input type="number" min="0" step="0.5" :value="strokeWidth"
                        @change="setStrokeWidth(+($event.target as HTMLInputElement).value)"
                        aria-label="Stroke width" />
                    <span class="unit">px</span>
                    <div class="steppers">
                        <button class="step" type="button" @click="setStrokeWidth(Math.max(0, strokeWidth + 0.5))">▴</button>
                        <button class="step" type="button" @click="setStrokeWidth(Math.max(0, strokeWidth - 0.5))">▾</button>
                    </div>
                </div>
            </div>

            <div class="prop-row">
                <span class="clab">Style</span>
                <select class="sel" :value="strokeStyle"
                    @change="setStrokeStyle(($event.target as HTMLSelectElement).value as any)"
                    aria-label="Stroke style">
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                </select>
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
    .panel-root { font-family: system-ui, sans-serif; font-size: 12px; color: #e2e8f0; }
    .section-head { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1e293b; padding-bottom: 6px; }
    .section-title { font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #cbd5e1; }
    .badge { font-size: 10px; padding: 2px 8px; border-radius: 8px; background: #0f172a; color: #94a3b8; text-transform: uppercase; }

    .prop-row { display: flex; align-items: center; gap: 8px; }
    .clab { font-size: 10px; color: #94a3b8; text-transform: uppercase; min-width: 36px; }

    .color-chip { flex: 1 1 auto; height: 28px; padding: 2px 4px; background: #0f172a; border: 1px solid #334155; border-radius: 6px; cursor: pointer; }

    /* Number input with steppers */
    .num { position: relative; flex: 1 1 auto; }
    .num input[type=number] { width: 100%; background: #0f172a; border: 1px solid #334155; color: #e2e8f0; font-size: 11px; padding: 5px 38px 5px 8px; border-radius: 6px; outline: none; }
    .unit { position: absolute; right: 22px; top: 50%; transform: translateY(-50%); font-size: 10px; color: #94a3b8; pointer-events: none; }
    .steppers { position: absolute; right: 2px; top: 2px; bottom: 2px; display: flex; flex-direction: column; gap: 1px; }
    .step { width: 16px; flex: 1 1 0; background: #1f2937; border: 1px solid #334155; color: #e2e8f0; font-size: 9px; line-height: 1; padding: 0; border-radius: 2px; cursor: pointer; }
    .step:hover { background: #374151; }

    .sel { flex: 1 1 auto; background: #0f172a; border: 1px solid #334155; color: #e2e8f0; font-size: 11px; padding: 5px 8px; border-radius: 6px; outline: none; }

    input[type=number]::-webkit-outer-spin-button,
    input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    /* input[type=number] { -moz-appearance: textfield; } */
</style>