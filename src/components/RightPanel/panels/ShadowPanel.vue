<template>
    <div class="panel-root px-3">
        <div class="section-head">
            <h3 class="section-title">Drop Shadow</h3>
            <label class="switch">
                <input type="checkbox" :checked="enabled" @change="toggleEnabled(($event.target as HTMLInputElement).checked)" aria-label="Enable drop shadow" />
                <span class="track"><span class="thumb" /></span>
            </label>
        </div>

        <div class="flex flex-col gap-3 mt-3" :class="{ disabled: !enabled }">
            <div class="control-row-inline">
                <span class="clab">Color</span>
                <button type="button" class="color-chip" :style="{ background: colorHex }" :disabled="!enabled"
                    @click="pickColor(colorHex, setColorHex)" aria-label="Shadow color" />
                <div class="num">
                    <input type="number" min="0" max="100" step="1" :disabled="!enabled" v-model.number="opacityPercent" />
                    <span class="unit">%</span>
                    <div class="steppers">
                        <button class="step" type="button" :disabled="!enabled" @click="opacityPercent = Math.min(100, opacityPercent + 1)">▴</button>
                        <button class="step" type="button" :disabled="!enabled" @click="opacityPercent = Math.max(0, opacityPercent - 1)">▾</button>
                    </div>
                </div>
            </div>

            <div class="control-row">
                <span class="clab">Angle</span>
                <div class="sliderRow">
                    <input type="range" min="0" max="360" step="1" class="range" :disabled="!enabled" v-model.number="angle" aria-label="Shadow angle" />
                    <div class="num">
                        <input type="number" min="0" max="360" step="1" :disabled="!enabled" v-model.number="angle" />
                        <span class="unit">°</span>
                    </div>
                </div>
            </div>

            <div class="control-row">
                <span class="clab">Distance</span>
                <div class="sliderRow">
                    <input type="range" min="0" max="100" step="1" class="range" :disabled="!enabled" v-model.number="distance" aria-label="Shadow distance" />
                    <div class="num">
                        <input type="number" min="0" max="100" step="1" :disabled="!enabled" v-model.number="distance" />
                        <span class="unit">px</span>
                    </div>
                </div>
            </div>

            <div class="control-row">
                <span class="clab">Size</span>
                <div class="sliderRow">
                    <input type="range" min="0" max="100" step="1" class="range" :disabled="!enabled" v-model.number="size" aria-label="Shadow size" />
                    <div class="num">
                        <input type="number" min="0" max="100" step="1" :disabled="!enabled" v-model.number="size" />
                        <span class="unit">px</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts" vapor>
    import { computed } from 'vue';
    import { useActiveElement } from '../../../composables/useActiveElement';
    import { useNativeColorPicker } from '../../../composables/useNativeColorPicker';

    const { element, update } = useActiveElement();
    const { pickColor } = useNativeColorPicker();

    /**
     * `Effects.shadow` only stores { color, offsetX, offsetY, blur } — there's no
     * separate angle/distance/opacity field on the type. Angle+Distance are a pure
     * UI convenience layered on top of offsetX/offsetY (polar <-> cartesian), and
     * opacity is encoded into the color string's alpha channel (rgba). This avoids
     * widening the shared Effects type just for this panel's convenience.
     */
    const shadow = computed(() => element.value?.effects.shadow);
    const enabled = computed(() => !!shadow.value);

    function parseColor(input: string | undefined): { r: number; g: number; b: number; a: number } {
        if (!input) return { r: 0, g: 0, b: 0, a: 0.25 };
        const rgbaMatch = input.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/i);
        if (rgbaMatch) {
            return {
                r: Math.round(+rgbaMatch[1]),
                g: Math.round(+rgbaMatch[2]),
                b: Math.round(+rgbaMatch[3]),
                a: rgbaMatch[4] !== undefined ? +rgbaMatch[4] : 1,
            };
        }
        const hex = input.replace('#', '');
        if (hex.length === 6 || hex.length === 8) {
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
            return { r, g, b, a };
        }
        return { r: 0, g: 0, b: 0, a: 0.25 };
    }

    function toHex2(n: number) { return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0'); }
    function toHex(r: number, g: number, b: number) { return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`; }
    function toRgba(r: number, g: number, b: number, a: number) {
        return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${+a.toFixed(3)})`;
    }

    const colorHex = computed(() => {
        const { r, g, b } = parseColor(shadow.value?.color);
        return toHex(r, g, b);
    });

    const opacityPercent = computed({
        get: () => Math.round(parseColor(shadow.value?.color).a * 100),
        set: (val: number) => {
            if (!enabled.value) return;
            const { r, g, b } = parseColor(shadow.value?.color);
            const v = Math.min(100, Math.max(0, Number.isFinite(val) ? val : 0));
            patchShadow({ color: toRgba(r, g, b, v / 100) });
        },
    });

    function setColorHex(hex: string) {
        const { a } = parseColor(shadow.value?.color);
        const { r, g, b } = parseColor(hex);
        patchShadow({ color: toRgba(r, g, b, a) });
    }

    /** Angle measured clockwise from the positive X axis, in screen coordinates (Y grows downward). */
    const angle = computed({
        get: () => {
            const s = shadow.value;
            if (!s || (!s.offsetX && !s.offsetY)) return 90;
            const deg = (Math.atan2(s.offsetY, s.offsetX) * 180) / Math.PI;
            return Math.round((deg + 360) % 360);
        },
        set: (val: number) => {
            if (!enabled.value) return;
            applyPolar(val, distance.value);
        },
    });

    const distance = computed({
        get: () => Math.round(Math.hypot(shadow.value?.offsetX ?? 0, shadow.value?.offsetY ?? 0)),
        set: (val: number) => {
            if (!enabled.value) return;
            applyPolar(angle.value, Math.max(0, val));
        },
    });

    const size = computed({
        get: () => Math.round(shadow.value?.blur ?? 0),
        set: (val: number) => {
            if (!enabled.value) return;
            patchShadow({ blur: Math.max(0, val) });
        },
    });

    function applyPolar(deg: number, dist: number) {
        const rad = (deg * Math.PI) / 180;
        patchShadow({
            offsetX: Math.round(dist * Math.cos(rad)),
            offsetY: Math.round(dist * Math.sin(rad)),
        });
    }

    /** Merges into the existing shadow (or creates a full one first via toggleEnabled). */
    function patchShadow(partial: Partial<NonNullable<typeof shadow.value>>) {
        update({ effects: { shadow: { ...(shadow.value as any), ...partial } } });
    }

    function toggleEnabled(on: boolean) {
        if (on) {
            update({ effects: { shadow: { color: 'rgba(0, 0, 0, 0.25)', offsetX: 0, offsetY: 4, blur: 8 } } });
        } else {
            update({ effects: { shadow: undefined } });
        }
    }
</script>

<style scoped>
    .panel-root { font-family: system-ui, sans-serif; font-size: 12px; color: #e2e8f0; }
    .section-head { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1e293b; padding-bottom: 6px; }
    .section-title { font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #cbd5e1; }

    .control-row { display: flex; flex-direction: column; gap: 4px; }
    .control-row-inline { display: flex; align-items: center; gap: 8px; }
    .clab { font-size: 10px; color: #94a3b8; text-transform: uppercase; min-width: 44px; }
    .disabled { opacity: 0.45; }

    .color-chip { width: 28px; height: 28px; padding: 0 1px; background: #0f172a; border: 1px solid #334155; border-radius: 6px; cursor: pointer; flex-shrink: 0; }

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
