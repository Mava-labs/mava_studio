<template>
    <div class="panel-root px-3">
        <h3 class="section-title mb-3">Rounded corners</h3>

        <div class="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
            <div class="grid grid-cols-1 gap-2">
                <input type="number" class="corner-input" :value="tl"
                    @change="setCorner('tl', +($event.target as HTMLInputElement).value)"
                    aria-label="Top left radius" />
                <input type="number" class="corner-input" :value="bl"
                    @change="setCorner('bl', +($event.target as HTMLInputElement).value)"
                    aria-label="Bottom left radius" />
            </div>

            <button type="button" class="lock-btn" :class="{ active: linked }" @click="toggleLinked"
                aria-label="Link corners">
                <span class="icon">🔒</span>
            </button>

            <div class="grid grid-cols-1 gap-2">
                <input type="number" class="corner-input" :value="tr"
                    @change="setCorner('tr', +($event.target as HTMLInputElement).value)"
                    aria-label="Top right radius" />
                <input type="number" class="corner-input" :value="br"
                    @change="setCorner('br', +($event.target as HTMLInputElement).value)"
                    aria-label="Bottom right radius" />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts" vapor>
    import { computed, ref, watch } from 'vue';
    import { useActiveElement } from '../../../composables/useActiveElement';

    const { element, update } = useActiveElement();

    const radius = computed(() => {
        const el = element.value;
        if (!el) return null;
        const r = (el.style as any)?.radius;
        if (r === undefined) return null;
        if (typeof r === 'number') return { tl: r, tr: r, br: r, bl: r };
        return r as { tl: number; tr: number; br: number; bl: number };
    });

    const linked = ref(true);

    watch(radius, (r) => {
        if (r && r.tl === r.tr && r.tr === r.br && r.br === r.bl) linked.value = true;
    });

    const tl = computed(() => radius.value?.tl ?? 0);
    const tr = computed(() => radius.value?.tr ?? 0);
    const br = computed(() => radius.value?.br ?? 0);
    const bl = computed(() => radius.value?.bl ?? 0);

    function toggleLinked() {
        linked.value = !linked.value;
        if (linked.value && radius.value) applyRadius(radius.value.tl, radius.value.tl, radius.value.tl, radius.value.tl);
    }

    function setCorner(key: 'tl' | 'tr' | 'br' | 'bl', val: number) {
        const v = Math.max(0, val || 0);
        if (linked.value) {
            applyRadius(v, v, v, v);
        } else {
            const cur = radius.value ?? { tl: 0, tr: 0, br: 0, bl: 0 };
            applyRadius(
                key === 'tl' ? v : cur.tl,
                key === 'tr' ? v : cur.tr,
                key === 'br' ? v : cur.br,
                key === 'bl' ? v : cur.bl,
            );
        }
    }

    function applyRadius(tl: number, tr: number, br: number, bl: number) {
        update({ style: { radius: { tl, tr, br, bl } } });
    }
</script>

<style scoped>
    .panel-root {
        font-family: system-ui, sans-serif;
        font-size: 12px;
        color: #e2e8f0;
    }

    .section-title {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #cbd5e1;
        border-bottom: 1px solid #1e293b;
        padding-bottom: 6px;
    }

    .corner-input {
        width: 100%;
        background: #0b1221;
        color: #f1f5f9;
        padding: 8px 10px;
        font-size: 12px;
        border: 1px solid #27354a;
        border-radius: 6px;
        outline: none;
    }

    .lock-btn {
        width: 40px;
        height: 60px;
        display: grid;
        place-items: center;
        border-radius: 10px;
        border: 1px solid #1e293b;
        background: #0f172a;
        color: #cbd5e1;
        cursor: pointer;
    }

    .lock-btn.active {
        background: #2563eb;
        color: #f8fafc;
        border-color: #2563eb;
    }

    .icon {
        font-size: 16px;
    }
</style>