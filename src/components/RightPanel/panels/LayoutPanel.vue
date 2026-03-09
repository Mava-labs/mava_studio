<template>
    <div class="panel-root px-3">
        <div class="section-head">
            <h3 class="section-title">Size &amp; Position</h3>
            <span class="badge">{{ isFlow ? 'Flow' : 'Absolute' }}</span>
        </div>

        <div class="grid grid-cols-2 gap-2 mt-3">
            <div class="field">
                <span class="clab">X</span>
                <div class="num" :class="{ disabled: isFlow }">
                    <input type="number" :value="posX" :disabled="isFlow"
                        @change="setX(+($event.target as HTMLInputElement).value)" aria-label="X position" />
                    <div class="steppers">
                        <button class="step" type="button" :disabled="isFlow" @click="setX(posX + 1)">▴</button>
                        <button class="step" type="button" :disabled="isFlow" @click="setX(posX - 1)">▾</button>
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
                <div class="num" :class="{ disabled: isFlow }">
                    <input type="number" :value="posY" :disabled="isFlow"
                        @change="setY(+($event.target as HTMLInputElement).value)" aria-label="Y position" />
                    <div class="steppers">
                        <button class="step" type="button" :disabled="isFlow" @click="setY(posY + 1)">▴</button>
                        <button class="step" type="button" :disabled="isFlow" @click="setY(posY - 1)">▾</button>
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
    import { useActiveElement } from '../../../composables/useActiveElement';

    const { element, update } = useActiveElement();

    const isFlow = computed(() => element.value?.layout.positioning.mode === 'flow');

    const posX = computed(() => {
        const pos = element.value?.layout.positioning;
        return pos?.mode === 'absolute' ? Math.round(pos.x) : 0;
    });

    const posY = computed(() => {
        const pos = element.value?.layout.positioning;
        return pos?.mode === 'absolute' ? Math.round(pos.y) : 0;
    });

    const width = computed(() => {
        const w = element.value?.layout.size.width;
        return typeof w === 'number' ? w : 0;
    });

    const height = computed(() => {
        const h = element.value?.layout.size.height;
        return typeof h === 'number' ? h : 0;
    });

    function setX(val: number) {
        if (isFlow.value) return;
        const pos = element.value?.layout.positioning;
        update({ layout: { positioning: { mode: 'absolute', x: val, y: pos?.mode === 'absolute' ? pos.y : 0, zIndex: pos?.mode === 'absolute' ? pos.zIndex : 0, anchor: pos?.mode === 'absolute' ? pos.anchor : 'parent' } } });
    }

    function setY(val: number) {
        if (isFlow.value) return;
        const pos = element.value?.layout.positioning;
        update({ layout: { positioning: { mode: 'absolute', x: pos?.mode === 'absolute' ? pos.x : 0, y: val, zIndex: pos?.mode === 'absolute' ? pos.zIndex : 0, anchor: pos?.mode === 'absolute' ? pos.anchor : 'parent' } } });
    }

    function setWidth(val: number) { update({ layout: { size: { width: Math.max(0, val) } } }); }
    function setHeight(val: number) { update({ layout: { size: { height: Math.max(0, val) } } }); }
</script>

<style scoped>
    .panel-root { font-family: system-ui, sans-serif; font-size: 12px; color: #e2e8f0; }
    .section-head { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1e293b; padding-bottom: 6px; }
    .section-title { font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #cbd5e1; }
    .badge { font-size: 10px; padding: 2px 8px; border-radius: 8px; background: #0f172a; color: #94a3b8; text-transform: uppercase; }

    .field { display: flex; align-items: center; gap: 6px; }
    .clab { font-size: 10px; color: #94a3b8; text-transform: uppercase; min-width: 12px; }

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