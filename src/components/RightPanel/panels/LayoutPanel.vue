<template>
    <div class="panel-root px-3">
        <div class="section-head">
            <h3 class="section-title">Size &amp; Position</h3>
            <span class="badge">{{ positionLabel }}</span>
        </div>

        <div class="field mt-3">
            <span class="clab">Pos</span>
            <select class="sel" :value="positionMode" @change="setPosition(($event.target as HTMLSelectElement).value)">
                <option value="static">Static</option>
                <option value="relative">Relative</option>
                <option value="absolute">Absolute</option>
                <option value="fixed">Fixed</option>
                <option value="sticky">Sticky</option>
            </select>
        </div>

        <div class="grid grid-cols-2 gap-2 mt-3">
            <div class="field">
                <span class="clab">X</span>
                <div class="num" :class="{ disabled: !isPositioned }">
                    <input type="number" :value="posX" :disabled="!isPositioned"
                        @change="setX(+($event.target as HTMLInputElement).value)" aria-label="X position" />
                    <div class="steppers">
                        <button class="step" type="button" :disabled="!isPositioned" @click="setX(posX + 1)">▴</button>
                        <button class="step" type="button" :disabled="!isPositioned" @click="setX(posX - 1)">▾</button>
                    </div>
                </div>
            </div>

            <div class="field">
                <span class="clab">W</span>
                <div class="num">
                    <input type="number" :value="width"
                        @change="setWidth(+($event.target as HTMLInputElement).value)" aria-label="Width" />
                    <div class="steppers">
                        <button class="step" type="button" @click="setWidth(Math.max(0, width + 1))">▴</button>
                        <button class="step" type="button" @click="setWidth(Math.max(0, width - 1))">▾</button>
                    </div>
                </div>
            </div>

            <div class="field">
                <span class="clab">Y</span>
                <div class="num" :class="{ disabled: !isPositioned }">
                    <input type="number" :value="posY" :disabled="!isPositioned"
                        @change="setY(+($event.target as HTMLInputElement).value)" aria-label="Y position" />
                    <div class="steppers">
                        <button class="step" type="button" :disabled="!isPositioned" @click="setY(posY + 1)">▴</button>
                        <button class="step" type="button" :disabled="!isPositioned" @click="setY(posY - 1)">▾</button>
                    </div>
                </div>
            </div>

            <div class="field">
                <span class="clab">H</span>
                <div class="num">
                    <input type="number" :value="height"
                        @change="setHeight(+($event.target as HTMLInputElement).value)" aria-label="Height" />
                    <div class="steppers">
                        <button class="step" type="button" @click="setHeight(Math.max(0, height + 1))">▴</button>
                        <button class="step" type="button" @click="setHeight(Math.max(0, height - 1))">▾</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts" vapor>
    import { computed } from 'vue';
    import type { Layout } from '../../../types/element';
    import { useActiveElement } from '../../../composables/useActiveElement';

    const { element, update } = useActiveElement();

    const positionMode = computed(() => element.value?.layout.position ?? 'static');
    const positionLabel = computed(() => positionMode.value.toUpperCase());
    const isPositioned = computed(() => ['absolute', 'fixed', 'sticky', 'relative'].includes(positionMode.value));

    const posX = computed(() => {
        const x = element.value?.layout.x;
        if (!x) return 0;
        const parsed = Number.parseFloat(String(x));
        return Number.isFinite(parsed) ? Math.round(parsed) : 0;
    });

    const posY = computed(() => {
        const y = element.value?.layout.y;
        if (!y) return 0;
        const parsed = Number.parseFloat(String(y));
        return Number.isFinite(parsed) ? Math.round(parsed) : 0;
    });

    const width = computed(() => {
        const w = element.value?.layout.width;
        if (!w) return 0;
        if (typeof w === 'string' && w.endsWith('px')) return Number.parseFloat(w) || 0;
        return 0;
    });

    const height = computed(() => {
        const h = element.value?.layout.height;
        if (!h) return 0;
        if (typeof h === 'string' && h.endsWith('px')) return Number.parseFloat(h) || 0;
        return 0;
    });

    function setX(val: number) {
        if (!isPositioned.value) return;
        update({ layout: { x: `${val}px` } });
    }

    function setY(val: number) {
        if (!isPositioned.value) return;
        update({ layout: { y: `${val}px` } });
    }

    function setWidth(val: number) { update({ layout: { width: `${Math.max(0, val)}px` } }); }
    function setHeight(val: number) { update({ layout: { height: `${Math.max(0, val)}px` } }); }

    function setPosition(value: string) {
        if (!['static', 'relative', 'absolute', 'fixed', 'sticky'].includes(value)) return;
        update({ layout: { position: value as Layout['position'] } });
    }
</script>

<style scoped>
    .panel-root { font-family: system-ui, sans-serif; font-size: 12px; color: #e2e8f0; }
    .section-head { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1e293b; padding-bottom: 6px; }
    .section-title { font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #cbd5e1; }
    .badge { font-size: 10px; padding: 2px 8px; border-radius: 8px; background: #0f172a; color: #94a3b8; text-transform: uppercase; }

    .field { display: flex; align-items: center; gap: 6px; }
    .clab { font-size: 10px; color: #94a3b8; text-transform: uppercase; min-width: 12px; }
    .sel { width: 100%; background: #0f172a; border: 1px solid #334155; color: #e2e8f0; font-size: 11px; padding: 6px 8px; border-radius: 6px; outline: none; }

    /* Number input with steppers */
    .num { position: relative; flex: 1 1 auto; }
    .num input[type=number] { width: 100%; background: #0f172a; border: 1px solid #334155; color: #e2e8f0; font-size: 11px; padding: 6px 22px 6px 8px; border-radius: 6px; outline: none; }
    .num.disabled input[type=number] { color: #64748b; cursor: not-allowed; }
    .steppers { position: absolute; right: 2px; top: 2px; bottom: 2px; display: flex; flex-direction: column; gap: 1px; }
    .step { width: 16px; flex: 1 1 0; background: #1f2937; border: 1px solid #334155; color: #e2e8f0; font-size: 9px; line-height: 1; padding: 0; border-radius: 2px; cursor: pointer; }
    .step:hover { background: #374151; }
    .step:disabled { opacity: 0.35; cursor: not-allowed; }

    input[type=number]::-webkit-outer-spin-button,
    input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    /* input[type=number] { -moz-appearance: textfield; } */
</style>