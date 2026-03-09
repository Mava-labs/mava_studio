<template>
    <div class="panel-root px-3">
        <div class="section-head">
            <h3 class="section-title">Transform</h3>
            <span class="badge">Local</span>
        </div>

        <div class="grid grid-cols-2 gap-2 mt-3 items-start">
            <div class="input-block">
                <label class="input-label">ScaleX</label>
                <div class="input-shell">
                    <input type="number" step="0.01" class="input-field" :value="scaleX"
                        @change="setScaleX(+($event.target as HTMLInputElement).value)" aria-label="Scale X" />
                </div>
            </div>

            <div class="input-block">
                <label class="input-label">Rotation</label>
                <div class="input-shell">
                    <input type="number" step="1" class="input-field" :value="rotation"
                        @change="setRotation(+($event.target as HTMLInputElement).value)" aria-label="Rotation" />
                </div>
            </div>

            <div class="input-block">
                <label class="input-label">ScaleY</label>
                <div class="input-shell">
                    <input type="number" step="0.01" class="input-field" :value="scaleY"
                        @change="setScaleY(+($event.target as HTMLInputElement).value)" aria-label="Scale Y" />
                </div>
            </div>
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
        width: 52px;
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
</style>