<template>
    <div class="panel-root px-3">
        <div class="section-head">
            <h3 class="section-title">Opacity</h3>
            <span class="badge">Live</span>
        </div>

        <div class="flex flex-col gap-3 mt-3">
            <div class="control-row">
                <div class="sliderRow">
                    <input type="range" min="0" max="100" step="1" class="range" v-model.number="opacityPercent" aria-label="Opacity" />
                    <div class="num">
                        <input type="number" min="0" max="100" step="1" v-model.number="opacityPercent" />
                        <span class="unit">%</span>
                        <div class="steppers">
                            <button class="step" type="button" @click="opacityPercent = Math.min(100, opacityPercent + 1)">▴</button>
                            <button class="step" type="button" @click="opacityPercent = Math.max(0, opacityPercent - 1)">▾</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts" vapor>
    import { computed } from 'vue';
    import { useActiveElement } from '../../../composables/useActiveElement';

    const { element, update } = useActiveElement();

    const opacityPercent = computed({
        get: () => Math.round((element.value?.effects.opacity ?? 1) * 100),
        set: (val: number) => {
            const v = Math.min(100, Math.max(0, Number.isFinite(val) ? val : 0));
            update({ effects: { opacity: v / 100 } });
        },
    });
</script>

<style scoped>
    .panel-root { font-family: system-ui, sans-serif; font-size: 12px; color: #e2e8f0; }
    .section-head { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1e293b; padding-bottom: 6px; }
    .section-title { font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #cbd5e1; }
    .badge { font-size: 10px; padding: 2px 8px; border-radius: 8px; background: #0f172a; color: #94a3b8; text-transform: uppercase; }

    .control-row { display: flex; flex-direction: column; gap: 4px; }
    .clab { font-size: 10px; color: #94a3b8; text-transform: uppercase; }

    /* Slider row */
    .sliderRow { display: flex; align-items: center; gap: 8px; }
    .range { flex: 1 1 auto; accent-color: #3b82f6; }

    /* Number input with steppers */
    .num { position: relative; width: 68px; flex-shrink: 0; }
    .num input[type=number] { width: 100%; background: #0f172a; border: 1px solid #334155; color: #e2e8f0; font-size: 11px; padding: 5px 20px 5px 8px; border-radius: 6px; outline: none; }
    .unit { position: absolute; right: 22px; top: 50%; transform: translateY(-50%); font-size: 10px; color: #94a3b8; pointer-events: none; }
    .steppers { position: absolute; right: 2px; top: 2px; bottom: 2px; display: flex; flex-direction: column; gap: 1px; }
    .step { width: 16px; flex: 1 1 0; background: #1f2937; border: 1px solid #334155; color: #e2e8f0; font-size: 9px; line-height: 1; padding: 0; border-radius: 2px; cursor: pointer; }
    .step:hover { background: #374151; }

    input[type=number]::-webkit-outer-spin-button,
    input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    /* input[type=number] { -moz-appearance: textfield; } */
</style>
