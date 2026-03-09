<!-- ImagePanel.vue -->
<template>
    <div class="panel-root px-3">
        <div class="section-head mb-3">
            <h3 class="section-title">Image</h3>
            <span class="badge">Live</span>
        </div>

        <div class="section mb-4">
            <div class="section-sub">Fit</div>
            <div class="fit-row">
                <label v-for="opt in fitOptions" :key="opt.value" class="fit-pill"
                    :class="{ active: fit === opt.value }">
                    <input type="radio" class="sr-only" :value="opt.value" v-model="fit" />
                    {{ opt.label }}
                </label>
            </div>
        </div>

        <div class="section">
            <div class="section-sub">Adjustments</div>
            <div class="control-row" v-for="item in sliders" :key="item.key">
                <span class="clab">{{ item.label }}</span>
                <div class="sliderRow">
                    <input type="range" :min="item.min" :max="item.max" :step="item.step" class="range"
                        v-model.number="item.model.value" :aria-label="item.label" />
                    <div class="num">
                        <input type="number" :min="item.min" :max="item.max" :step="item.step"
                            v-model.number="item.model.value" />
                        <span class="unit">{{ item.suffix }}</span>
                        <div class="steppers">
                            <button class="step" type="button" @click="item.model.value = Math.min(item.max, item.model.value + item.step)">▴</button>
                            <button class="step" type="button" @click="item.model.value = Math.max(item.min, item.model.value - item.step)">▾</button>
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
    import type { ImageStyle } from '../../../types/element';

    const { element, update } = useActiveElement();

    const imageStyle = computed(() => {
        const el = element.value;
        if (!el || el.type !== 'image') return null;
        return el.style as ImageStyle;
    });

    function clamp(v: number, min: number, max: number) { return Math.min(max, Math.max(min, Number.isFinite(v) ? v : min)); }

    function setFilter(key: 'brightness' | 'contrast' | 'grayscale' | 'blur', value: number) {
        update({ style: { filters: { ...(imageStyle.value?.filters ?? {}), [key]: value } } });
    }

    const fit = computed({
        get: () => imageStyle.value?.fit ?? 'cover',
        set: (v: 'cover' | 'contain' | 'fill') => update({ style: { fit: v } }),
    });

    const brightness = computed({
        get: () => Math.round((imageStyle.value?.filters?.brightness ?? 1) * 100),
        set: (v: number) => setFilter('brightness', clamp(v, 0, 200) / 100),
    });
    const contrast = computed({
        get: () => Math.round((imageStyle.value?.filters?.contrast ?? 1) * 100),
        set: (v: number) => setFilter('contrast', clamp(v, 0, 200) / 100),
    });
    const grayscale = computed({
        get: () => Math.round((imageStyle.value?.filters?.grayscale ?? 0) * 100),
        set: (v: number) => setFilter('grayscale', clamp(v, 0, 100) / 100),
    });
    const blur = computed({
        get: () => Math.round(imageStyle.value?.filters?.blur ?? 0),
        set: (v: number) => setFilter('blur', clamp(v, 0, 40)),
    });

    const fitOptions = [
        { value: 'cover', label: 'Cover' },
        { value: 'contain', label: 'Contain' },
        { value: 'fill', label: 'Fill' },
    ] as const;

    const sliders = [
        { key: 'brightness', label: 'Brightness', min: 0, max: 200, step: 1, suffix: '%', model: brightness },
        { key: 'contrast', label: 'Contrast', min: 0, max: 200, step: 1, suffix: '%', model: contrast },
        { key: 'grayscale', label: 'Grayscale', min: 0, max: 100, step: 1, suffix: '%', model: grayscale },
        { key: 'blur', label: 'Blur', min: 0, max: 40, step: 1, suffix: 'px', model: blur },
    ];
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

    .section {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .section-sub {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #64748b;
    }

    .fit-row {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
    }

    .fit-pill {
        padding: 5px 10px;
        border-radius: 6px;
        border: 1px solid #334155;
        background: #1f2937;
        color: #e2e8f0;
        cursor: pointer;
        font-size: 11px;
    }

    .fit-pill.active {
        background: #334155;
        border-color: #3b82f6;
        color: #f8fafc;
    }

    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
    }

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