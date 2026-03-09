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
            <div class="slider-row" v-for="item in sliders" :key="item.key">
                <div class="row-label">{{ item.label }}</div>
                <div class="row-controls">
                    <input type="range" :min="item.min" :max="item.max" :step="item.step" class="slider"
                        v-model.number="item.model.value" :aria-label="item.label" />
                    <div class="value-box">
                        <input type="number" :min="item.min" :max="item.max" :step="item.step" class="value-input"
                            v-model.number="item.model.value" />
                        <span class="value-suffix">{{ item.suffix }}</span>
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
        padding: 8px 12px;
        border-radius: 8px;
        border: 1px solid #1e293b;
        background: #0f172a;
        color: #e2e8f0;
        cursor: pointer;
        font-size: 12px;
    }

    .fit-pill.active {
        background: #2563eb;
        border-color: #2563eb;
        color: #f8fafc;
    }

    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
    }

    .slider-row {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .row-label {
        font-size: 11px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #94a3b8;
        font-weight: 600;
    }

    .row-controls {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: center;
        gap: 10px;
    }

    .slider {
        width: 100%;
        accent-color: #3b82f6;
    }

    .value-box {
        display: flex;
        align-items: center;
        gap: 6px;
        background: #0b1221;
        border: 1px solid #27354a;
        border-radius: 6px;
        padding: 4px 8px;
        min-width: 80px;
        justify-content: center;
    }

    .value-input {
        width: 48px;
        background: transparent;
        color: #f8fafc;
        border: none;
        outline: none;
        font-size: 12px;
        text-align: right;
    }

    .value-suffix {
        font-size: 11px;
        color: #cbd5e1;
    }
</style>