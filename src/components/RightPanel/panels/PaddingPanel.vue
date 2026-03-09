<!-- PaddingPanel.vue -->
<template>
    <div class="panel-root px-3">
        <h3 class="section-title mb-3">Padding</h3>

        <div class="padding-shell">
            <!-- Top -->
            <div class="num top-num">
                <input type="number" :value="top"
                    @change="setPad('top', +($event.target as HTMLInputElement).value)" aria-label="Top padding" />
                <span class="pad-hint">T</span>
                <div class="steppers">
                    <button class="step" type="button" @click="setPad('top', top + 1)">▴</button>
                    <button class="step" type="button" @click="setPad('top', Math.max(0, top - 1))">▾</button>
                </div>
            </div>

            <div class="middle-row">
                <!-- Left -->
                <div class="num">
                    <input type="number" :value="left"
                        @change="setPad('left', +($event.target as HTMLInputElement).value)" aria-label="Left padding" />
                    <span class="pad-hint">L</span>
                    <div class="steppers">
                        <button class="step" type="button" @click="setPad('left', left + 1)">▴</button>
                        <button class="step" type="button" @click="setPad('left', Math.max(0, left - 1))">▾</button>
                    </div>
                </div>

                <button type="button" class="lock-btn" :class="{ active: linked }" @click="toggleLinked"
                    aria-label="Link padding">
                    <span class="icon">🔒</span>
                </button>

                <!-- Right -->
                <div class="num">
                    <input type="number" :value="right"
                        @change="setPad('right', +($event.target as HTMLInputElement).value)" aria-label="Right padding" />
                    <span class="pad-hint">R</span>
                    <div class="steppers">
                        <button class="step" type="button" @click="setPad('right', right + 1)">▴</button>
                        <button class="step" type="button" @click="setPad('right', Math.max(0, right - 1))">▾</button>
                    </div>
                </div>
            </div>

            <!-- Bottom -->
            <div class="num top-num">
                <input type="number" :value="bottom"
                    @change="setPad('bottom', +($event.target as HTMLInputElement).value)" aria-label="Bottom padding" />
                <span class="pad-hint">B</span>
                <div class="steppers">
                    <button class="step" type="button" @click="setPad('bottom', bottom + 1)">▴</button>
                    <button class="step" type="button" @click="setPad('bottom', Math.max(0, bottom - 1))">▾</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts" vapor>
    import { computed, ref, watch } from 'vue';
    import { useActiveElement } from '../../../composables/useActiveElement';

    const { element, update } = useActiveElement();

    const padding = computed(() => {
        const el = element.value;
        if (!el) return null;
        const p = (el.style as any)?.padding;
        if (p === undefined) return null;
        if (typeof p === 'number') return { top: p, right: p, bottom: p, left: p };
        return p as { top: number; right: number; bottom: number; left: number };
    });

    const linked = ref(true);

    watch(padding, (p) => {
        if (p && p.top === p.right && p.right === p.bottom && p.bottom === p.left) linked.value = true;
    });

    const top = computed(() => padding.value?.top ?? 0);
    const right = computed(() => padding.value?.right ?? 0);
    const bottom = computed(() => padding.value?.bottom ?? 0);
    const left = computed(() => padding.value?.left ?? 0);

    function toggleLinked() {
        linked.value = !linked.value;
        if (linked.value && padding.value) applyPadding(padding.value.top, padding.value.top, padding.value.top, padding.value.top);
    }

    function setPad(key: 'top' | 'right' | 'bottom' | 'left', val: number) {
        const v = Math.max(0, val || 0);
        if (linked.value) {
            applyPadding(v, v, v, v);
        } else {
            const cur = padding.value ?? { top: 0, right: 0, bottom: 0, left: 0 };
            applyPadding(
                key === 'top' ? v : cur.top,
                key === 'right' ? v : cur.right,
                key === 'bottom' ? v : cur.bottom,
                key === 'left' ? v : cur.left,
            );
        }
    }

    function applyPadding(t: number, r: number, b: number, l: number) {
        update({ style: { padding: { top: t, right: r, bottom: b, left: l } } });
    }
</script>

<style scoped>
    .panel-root { font-family: system-ui, sans-serif; font-size: 12px; color: #e2e8f0; }
    .section-title { font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #cbd5e1; border-bottom: 1px solid #1e293b; padding-bottom: 6px; }

    .padding-shell {
        display: grid;
        grid-template-rows: auto auto auto;
        gap: 6px;
        align-items: center;
        justify-items: center;
        padding: 10px;
        border-radius: 8px;
        background: #0f172a;
        border: 1px solid #1e293b;
    }

    .middle-row {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        gap: 6px;
        width: 100%;
    }

    /* Number input with steppers */
    .num { position: relative; width: 100%; }
    .top-num { width: 80px; }
    .num input[type=number] { width: 100%; background: #0f172a; border: 1px solid #334155; color: #e2e8f0; font-size: 11px; padding: 5px 20px 5px 8px; border-radius: 6px; outline: none; text-align: center; }
    .pad-hint { position: absolute; left: 6px; top: 50%; transform: translateY(-50%); font-size: 9px; color: #64748b; pointer-events: none; text-transform: uppercase; }
    .steppers { position: absolute; right: 2px; top: 2px; bottom: 2px; display: flex; flex-direction: column; gap: 1px; }
    .step { width: 16px; flex: 1 1 0; background: #1f2937; border: 1px solid #334155; color: #e2e8f0; font-size: 9px; line-height: 1; padding: 0; border-radius: 2px; cursor: pointer; }
    .step:hover { background: #374151; }

    .lock-btn { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 8px; border: 1px solid #334155; background: #1f2937; color: #cbd5e1; cursor: pointer; transition: background 0.15s, border-color 0.15s; }
    .lock-btn.active { background: #334155; border-color: #3b82f6; }
    .icon { font-size: 14px; }

    input[type=number]::-webkit-outer-spin-button,
    input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    /* input[type=number] { -moz-appearance: textfield; } */
</style>