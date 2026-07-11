<!--
    AutoLayoutPanel.vue — display mode (block/flex/grid) + the flex/grid config
    that goes with it. This is the "Auto Layout" concept: how a container arranges
    its children. Targets Layout.mode/direction/justify/align/wrap/gap/columns —
    these are already rendered correctly by resolveDisplay() in resolver.ts, they
    just had no panel exposing them until now.

    Note: there is a second, disconnected display model on the type
    (ContainerElement.display + FlexDisplay/GridDisplay from types/project.ts)
    that resolver.ts's resolveContainerStyle() reads for css.display but never
    applies the richer config (grow/spacing/alignItems/justifyContent) from.
    This panel deliberately targets Layout instead, since that's the model
    that's actually wired end-to-end today. See CLEANUP_TODO.md for the
    consolidation call this implies.
-->
<template>
    <div class="panel-root px-3">
        <div class="section-head">
            <h3 class="section-title">Auto Layout</h3>
            <span class="badge">{{ mode.toUpperCase() }}</span>
        </div>

        <div class="seg3 mt-3" role="group" aria-label="Display mode">
            <button type="button" class="seg3-btn" :class="{ selected: mode === 'flow' }" @click="setMode('flow')">Block</button>
            <button type="button" class="seg3-btn" :class="{ selected: mode === 'flex' }" @click="setMode('flex')">Flex</button>
            <button type="button" class="seg3-btn" :class="{ selected: mode === 'grid' }" @click="setMode('grid')">Grid</button>
        </div>

        <template v-if="mode === 'flex'">
            <div class="field mt-3">
                <span class="clab">Direction</span>
                <div class="seg2" role="group" aria-label="Direction">
                    <button type="button" class="seg2-btn" :class="{ selected: direction === 'row' }" @click="setDirection('row')">Row</button>
                    <button type="button" class="seg2-btn" :class="{ selected: direction === 'column' }" @click="setDirection('column')">Column</button>
                </div>
            </div>

            <div class="field mt-2">
                <span class="clab">Justify</span>
                <select class="sel" :value="justify" @change="setJustify(($event.target as HTMLSelectElement).value)">
                    <option value="flex-start">Start</option>
                    <option value="center">Center</option>
                    <option value="flex-end">End</option>
                    <option value="space-between">Space between</option>
                    <option value="space-around">Space around</option>
                    <option value="space-evenly">Space evenly</option>
                </select>
            </div>

            <div class="field mt-2">
                <span class="clab">Align</span>
                <select class="sel" :value="align" @change="setAlign(($event.target as HTMLSelectElement).value)">
                    <option value="stretch">Stretch</option>
                    <option value="flex-start">Start</option>
                    <option value="center">Center</option>
                    <option value="flex-end">End</option>
                </select>
            </div>

            <div class="grid grid-cols-2 gap-2 mt-2">
                <div class="field">
                    <span class="clab">Gap</span>
                    <div class="num">
                        <input type="number" min="0" :value="gap" @change="setGap(+($event.target as HTMLInputElement).value)" aria-label="Gap" />
                        <span class="unit">px</span>
                    </div>
                </div>
                <label class="checkbox-row">
                    <input type="checkbox" :checked="wrap" @change="setWrap(($event.target as HTMLInputElement).checked)" />
                    <span>Wrap</span>
                </label>
            </div>
        </template>

        <template v-else-if="mode === 'grid'">
            <label class="checkbox-row mt-3">
                <input type="checkbox" :checked="advancedGrid" @change="advancedGrid = ($event.target as HTMLInputElement).checked" />
                <span>Advanced (raw track sizes)</span>
            </label>

            <template v-if="!advancedGrid">
                <div class="grid grid-cols-2 gap-2 mt-2">
                    <div class="field">
                        <span class="clab">Columns</span>
                        <div class="num">
                            <input type="number" min="1" :value="columnCount" @change="setColumnCount(+($event.target as HTMLInputElement).value)" aria-label="Column count" />
                        </div>
                    </div>
                    <div class="field">
                        <span class="clab">Gap</span>
                        <div class="num">
                            <input type="number" min="0" :value="gap" @change="setGap(+($event.target as HTMLInputElement).value)" aria-label="Gap" />
                            <span class="unit">px</span>
                        </div>
                    </div>
                </div>
            </template>

            <template v-else>
                <div class="field mt-2">
                    <span class="clab">Columns</span>
                    <input type="text" class="sel" :value="columns" placeholder="1fr 1fr 1fr"
                        @change="setColumns(($event.target as HTMLInputElement).value)" aria-label="Grid template columns" />
                </div>
                <div class="field mt-2">
                    <span class="clab">Rows</span>
                    <input type="text" class="sel" :value="rows" placeholder="auto 1fr (optional)"
                        @change="setRows(($event.target as HTMLInputElement).value)" aria-label="Grid template rows" />
                </div>
                <div class="field mt-2">
                    <span class="clab">Gap</span>
                    <div class="num">
                        <input type="number" min="0" :value="gap" @change="setGap(+($event.target as HTMLInputElement).value)" aria-label="Gap" />
                        <span class="unit">px</span>
                    </div>
                </div>
            </template>
        </template>
    </div>
</template>

<script setup lang="ts" vapor>
    import { computed, ref } from 'vue';
    import { useActiveElement } from '../../../composables/useActiveElement';
    import type { Layout } from '../../../types/element';

    const { element, update } = useActiveElement();

    /** UI-only — not persisted. Advanced mode just changes which controls
     *  write to the same layout.columns/rows fields (a raw string either way). */
    const advancedGrid = ref(false);
    const columns = computed(() => element.value?.layout.columns ?? '');
    const rows = computed(() => element.value?.layout.rows ?? '');
    function setColumns(v: string) { update({ layout: { columns: v } }); }
    function setRows(v: string) { update({ layout: { rows: v } }); }

    const mode = computed<Layout['mode']>(() => element.value?.layout.mode ?? 'flow');
    const direction = computed(() => element.value?.layout.direction ?? 'row');
    const justify = computed(() => element.value?.layout.justify ?? 'flex-start');
    const align = computed(() => element.value?.layout.align ?? 'stretch');
    const wrap = computed(() => element.value?.layout.wrap ?? false);

    const gap = computed(() => {
        const g = element.value?.layout.gap;
        if (!g) return 0;
        const n = Number.parseFloat(g);
        return Number.isFinite(n) ? n : 0;
    });

    /** Stored as CSS `repeat(n, 1fr)` — a plain count is the common case; anything
     *  more exotic in `columns` just falls back to whatever count it can parse. */
    const columnCount = computed(() => {
        const c = element.value?.layout.columns;
        if (!c) return 2;
        const match = c.match(/repeat\((\d+)/);
        if (match) return +match[1];
        const n = c.split(' ').filter(Boolean).length;
        return n || 2;
    });

    function setMode(m: Layout['mode']) { update({ layout: { mode: m } }); }
    function setDirection(d: 'row' | 'column') { update({ layout: { direction: d } }); }
    function setJustify(v: string) { update({ layout: { justify: v } }); }
    function setAlign(v: string) { update({ layout: { align: v } }); }
    function setWrap(v: boolean) { update({ layout: { wrap: v } }); }
    function setGap(v: number) { update({ layout: { gap: `${Math.max(0, v || 0)}px` } }); }
    function setColumnCount(v: number) { update({ layout: { columns: `repeat(${Math.max(1, Math.round(v || 1))}, 1fr)` } }); }
</script>

<style scoped>
    .panel-root { font-family: system-ui, sans-serif; font-size: 12px; color: #e2e8f0; }
    .section-head { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1e293b; padding-bottom: 6px; }
    .section-title { font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #cbd5e1; }
    .badge { font-size: 10px; padding: 2px 8px; border-radius: 8px; background: #0f172a; color: #94a3b8; text-transform: uppercase; }

    .field { display: flex; align-items: center; gap: 6px; }
    .clab { font-size: 10px; color: #94a3b8; text-transform: uppercase; min-width: 44px; }

    .sel { flex: 1 1 auto; background: #0f172a; border: 1px solid #334155; color: #e2e8f0; font-size: 11px; padding: 5px 8px; border-radius: 6px; outline: none; }

    .num { position: relative; flex: 1 1 auto; display: flex; align-items: center; }
    .num input[type=number] { width: 100%; background: #0f172a; border: 1px solid #334155; color: #e2e8f0; font-size: 11px; padding: 5px 8px; border-radius: 6px; outline: none; }
    .unit { font-size: 10px; color: #94a3b8; margin-left: 4px; }

    .checkbox-row { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #cbd5e1; }

    .seg3 { display: flex; border: 1px solid #334155; border-radius: 6px; overflow: hidden; }
    .seg3-btn { flex: 1 1 0; background: #0f172a; border: none; color: #94a3b8; font-size: 11px; padding: 6px 0; cursor: pointer; }
    .seg3-btn + .seg3-btn { border-left: 1px solid #334155; }
    .seg3-btn:hover { background: #1f2937; }
    .seg3-btn.selected { background: #334155; color: #f8fafc; }

    .seg2 { display: flex; flex: 1 1 auto; border: 1px solid #334155; border-radius: 6px; overflow: hidden; }
    .seg2-btn { flex: 1 1 0; background: #0f172a; border: none; color: #94a3b8; font-size: 11px; padding: 5px 0; cursor: pointer; }
    .seg2-btn + .seg2-btn { border-left: 1px solid #334155; }
    .seg2-btn:hover { background: #1f2937; }
    .seg2-btn.selected { background: #334155; color: #f8fafc; }

    .hint { font-size: 10px; line-height: 1.5; color: #94a3b8; }
    .hint code { background: #0f172a; border: 1px solid #334155; border-radius: 3px; padding: 1px 4px; color: #cbd5e1; font-family: ui-monospace, monospace; }

    .preset-row { display: flex; flex-wrap: wrap; gap: 4px; }
    .preset-btn { background: #0f172a; border: 1px solid #334155; color: #cbd5e1; font-size: 10px; padding: 4px 8px; border-radius: 6px; cursor: pointer; }
    .preset-btn:hover { background: #1f2937; }

    input[type=number]::-webkit-outer-spin-button,
    input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
</style>
