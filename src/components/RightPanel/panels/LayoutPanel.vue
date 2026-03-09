<template>
    <div class="panel-root px-3">
        <div class="section-head">
            <h3 class="section-title">Size &amp; Position</h3>
            <span class="badge">{{ isFlow ? 'Flow' : 'Absolute' }}</span>
        </div>

        <div class="grid grid-cols-2 gap-2 mt-3">
            <div class="input-block">
                <label class="input-label">X</label>
                <div class="input-shell">
                    <input type="number" class="input-field" :value="posX" :disabled="isFlow"
                        @change="setX(+($event.target as HTMLInputElement).value)" aria-label="X position" />
                </div>
            </div>

            <div class="input-block">
                <label class="input-label">W</label>
                <div class="input-shell">
                    <input type="number" class="input-field" :value="width"
                        @change="setWidth(+($event.target as HTMLInputElement).value)" aria-label="Width" />
                </div>
            </div>

            <div class="input-block">
                <label class="input-label">Y</label>
                <div class="input-shell">
                    <input type="number" class="input-field" :value="posY" :disabled="isFlow"
                        @change="setY(+($event.target as HTMLInputElement).value)" aria-label="Y position" />
                </div>
            </div>

            <div class="input-block">
                <label class="input-label">H</label>
                <div class="input-shell">
                    <input type="number" class="input-field" :value="height"
                        @change="setHeight(+($event.target as HTMLInputElement).value)" aria-label="Height" />
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

    .input-block {
        display: flex;
        align-items: center;
        gap: 6px;
        background: #0f172a;
        padding: 8px 10px;
        border-radius: 6px;
        border: 1px solid #1e293b;
    }

    .input-label {
        width: 16px;
        font-weight: 600;
        font-size: 11px;
        color: #cbd5e1;
    }

    .input-shell {
        flex: 1;
        display: flex;
        background: #0b1221;
        border: 1px solid #27354a;
        border-radius: 6px;
        overflow: hidden;
    }

    .input-field {
        width: 100%;
        background: transparent;
        color: #f1f5f9;
        padding: 6px 10px;
        font-size: 12px;
        border: none;
        outline: none;
    }

    .input-field:disabled {
        color: #64748b;
        cursor: not-allowed;
    }
</style>