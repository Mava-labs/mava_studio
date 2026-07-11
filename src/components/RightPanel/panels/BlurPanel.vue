<template>
    <div class="panel-root px-3">
        <div class="section-head">
            <h3 class="section-title">Blur</h3>
            <label class="switch">
                <input type="checkbox" :checked="enabled" @change="toggleEnabled(($event.target as HTMLInputElement).checked)" aria-label="Enable blur" />
                <span class="track"><span class="thumb" /></span>
            </label>
        </div>

        <div class="flex flex-col gap-3 mt-3" :class="{ disabled: !enabled }">
            <div class="control-row">
                <span class="clab">Size</span>
                <div class="sliderRow">
                    <input type="range" min="0" max="40" step="1" class="range" :disabled="!enabled" v-model.number="blurPx" aria-label="Blur size" />
                    <div class="num">
                        <input type="number" min="0" max="40" step="1" :disabled="!enabled" v-model.number="blurPx" />
                        <span class="unit">px</span>
                        <div class="steppers">
                            <button class="step" type="button" :disabled="!enabled" @click="blurPx = Math.min(40, blurPx + 1)">▴</button>
                            <button class="step" type="button" :disabled="!enabled" @click="blurPx = Math.max(0, blurPx - 1)">▾</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts" vapor>
    import { computed, ref } from 'vue';
    import { useActiveElement } from '../../../composables/useActiveElement';

    const { element, update } = useActiveElement();

    /** Remembers the last non-zero size so re-enabling restores it instead of snapping to 0. */
    const lastSize = ref(4);

    const enabled = computed(() => (element.value?.effects.blur ?? 0) > 0);

    const blurPx = computed({
        get: () => Math.round(element.value?.effects.blur ?? 0),
        set: (val: number) => {
            const v = Math.min(40, Math.max(0, Number.isFinite(val) ? val : 0));
            if (v > 0) lastSize.value = v;
            update({ effects: { blur: v } });
        },
    });

    function toggleEnabled(on: boolean) {
        update({ effects: { blur: on ? (lastSize.value || 4) : 0 } });
    }
</script>

<style scoped>
    .panel-root { font-family: system-ui, sans-serif; font-size: 12px; color: #e2e8f0; }
    .section-head { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1e293b; padding-bottom: 6px; }
    .section-title { font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #cbd5e1; }

    .control-row { display: flex; flex-direction: column; gap: 4px; }
    .clab { font-size: 10px; color: #94a3b8; text-transform: uppercase; }
    .disabled { opacity: 0.45; }

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

    /* Toggle switch */
    .switch { position: relative; display: inline-block; width: 30px; height: 16px; }
    .switch input { opacity: 0; width: 0; height: 0; }
    .track { position: absolute; inset: 0; background: #334155; border-radius: 999px; cursor: pointer; transition: background 0.15s; }
    .thumb { position: absolute; left: 2px; top: 2px; width: 12px; height: 12px; background: #e2e8f0; border-radius: 999px; transition: transform 0.15s; }
    .switch input:checked + .track { background: #3b82f6; }
    .switch input:checked + .track .thumb { transform: translateX(14px); }
</style>
