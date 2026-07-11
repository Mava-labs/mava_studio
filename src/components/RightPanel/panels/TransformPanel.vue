<template>
    <div class="panel-root px-3">
        <div class="section-head">
            <h3 class="section-title">Transform</h3>
            <span class="badge">Local</span>
        </div>

        <div class="grid grid-cols-2 gap-2 mt-3">
            <div class="field">
                <span class="clab">ScaleX</span>
                <div class="num">
                    <input type="number" step="0.01" :value="scaleX"
                        @change="setScaleX(+($event.target as HTMLInputElement).value)" aria-label="Scale X" />
                    <div class="steppers">
                        <button class="step" type="button" @click="setScaleX(+(scaleX + 0.01).toFixed(3))">▴</button>
                        <button class="step" type="button" @click="setScaleX(+(scaleX - 0.01).toFixed(3))">▾</button>
                    </div>
                </div>
            </div>

            <div class="field">
                <span class="clab">Rotate</span>
                <div class="num">
                    <input type="number" step="1" :value="rotation"
                        @change="setRotation(+($event.target as HTMLInputElement).value)" aria-label="Rotation" />
                    <span class="unit">°</span>
                    <div class="steppers">
                        <button class="step" type="button" @click="setRotation((rotation + 1) % 360)">▴</button>
                        <button class="step" type="button" @click="setRotation(((rotation - 1) + 360) % 360)">▾</button>
                    </div>
                </div>
            </div>

            <div class="field">
                <span class="clab">ScaleY</span>
                <div class="num">
                    <input type="number" step="0.01" :value="scaleY"
                        @change="setScaleY(+($event.target as HTMLInputElement).value)" aria-label="Scale Y" />
                    <div class="steppers">
                        <button class="step" type="button" @click="setScaleY(+(scaleY + 0.01).toFixed(3))">▴</button>
                        <button class="step" type="button" @click="setScaleY(+(scaleY - 0.01).toFixed(3))">▾</button>
                    </div>
                </div>
            </div>
        </div>

        <div class="flex gap-2 mt-2">
            <button type="button" class="flip-btn" :class="{ active: scaleX < 0 }" title="Flip horizontal"
                aria-label="Flip horizontal" aria-pressed="false" @click="flipHorizontal">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4">
                    <path d="M8 1.5v13" stroke-dasharray="2 2" />
                    <path d="M3 4.5 5.5 8 3 11.5" stroke-linecap="round" stroke-linejoin="round" />
                    <path d="M13 4.5 10.5 8 13 11.5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <span>Flip H</span>
            </button>
            <button type="button" class="flip-btn" :class="{ active: scaleY < 0 }" title="Flip vertical"
                aria-label="Flip vertical" aria-pressed="false" @click="flipVertical">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4">
                    <path d="M1.5 8h13" stroke-dasharray="2 2" />
                    <path d="M4.5 3 8 5.5 11.5 3" stroke-linecap="round" stroke-linejoin="round" />
                    <path d="M4.5 13 8 10.5 11.5 13" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <span>Flip V</span>
            </button>
        </div>
    </div>
</template>

<script setup lang="ts" vapor>
    import { computed } from 'vue';
    import { useActiveElement } from '../../../composables/useActiveElement';

    const { element, update } = useActiveElement();

    const scaleX = computed(() => element.value?.layout.transform?.scaleX ?? 1);
    const scaleY = computed(() => element.value?.layout.transform?.scaleY ?? 1);
    const rotation = computed(() => element.value?.layout.transform?.rotation ?? 0);

    function setScaleX(val: number) { update({ layout: { transform: { scaleX: val } } }); }
    function setScaleY(val: number) { update({ layout: { transform: { scaleY: val } } }); }
    function setRotation(val: number) { update({ layout: { transform: { rotation: val } } }); }

    /** Flip = mirror across the element's own axis, i.e. flip the sign of the magnitude, preserving it. */
    function flipHorizontal() { update({ layout: { transform: { scaleX: -(scaleX.value || 1) } } }); }
    function flipVertical() { update({ layout: { transform: { scaleY: -(scaleY.value || 1) } } }); }
</script>

<style scoped>
    .panel-root { font-family: system-ui, sans-serif; font-size: 12px; color: #e2e8f0; }
    .section-head { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1e293b; padding-bottom: 6px; }
    .section-title { font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #cbd5e1; }
    .badge { font-size: 10px; padding: 2px 8px; border-radius: 8px; background: #0f172a; color: #94a3b8; text-transform: uppercase; }

    .field { display: flex; align-items: center; gap: 6px; }
    .clab { font-size: 10px; color: #94a3b8; text-transform: uppercase; min-width: 40px; }

    /* Number input with steppers */
    .num { position: relative; flex: 1 1 auto; }
    .num input[type=number] { width: 100%; background: #0f172a; border: 1px solid #334155; color: #e2e8f0; font-size: 11px; padding: 6px 22px 6px 8px; border-radius: 6px; outline: none; }
    .unit { position: absolute; right: 22px; top: 50%; transform: translateY(-50%); font-size: 10px; color: #94a3b8; pointer-events: none; }
    .steppers { position: absolute; right: 2px; top: 2px; bottom: 2px; display: flex; flex-direction: column; gap: 1px; }
    .step { width: 16px; flex: 1 1 0; background: #1f2937; border: 1px solid #334155; color: #e2e8f0; font-size: 9px; line-height: 1; padding: 0; border-radius: 2px; cursor: pointer; }
    .step:hover { background: #374151; }

    input[type=number]::-webkit-outer-spin-button,
    input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    /* input[type=number] { -moz-appearance: textfield; } */

    .flip-btn { flex: 1 1 0; display: flex; align-items: center; justify-content: center; gap: 5px; background: #0f172a; border: 1px solid #334155; color: #94a3b8; font-size: 11px; padding: 6px 0; border-radius: 6px; cursor: pointer; }
    .flip-btn:hover { background: #1f2937; color: #e2e8f0; }
    .flip-btn.active { background: #334155; border-color: #64748b; color: #f8fafc; }
</style>