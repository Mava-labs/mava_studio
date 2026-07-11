<!--
    PageSettingsPanel.vue — shown in StylePanel.vue when nothing is selected
    (replaces the old empty "Device" stub). Per the user's reference screenshot,
    this is meant to cover: page size, background, default text, and a
    project-wide color replace tool.

    What's real right now: Width/Height/Background, backed by Page.stage via
    pages.updateStage() (new — see stores/pages.ts). "Reset page view" is wired
    to the existing stage zoom reset.

    What's shown but disabled: device presets, Fit to content, Hide content
    outside page, Default Text Settings, Replace Colors — none of these have a
    backing data model yet (no device-profile list, no overflow-hide flag on
    the stage renderer, no project-level default text style, no find/replace
    across element colors). Faking these would just be dead controls; they're
    listed so the intent isn't lost, disabled so nobody mistakes them for done.
-->
<template>
    <div class="panel-root px-3">
        <h3 class="section-title mb-3">Page Settings</h3>

        <div class="flex flex-col gap-3">
            <select class="sel" disabled title="Page size presets — coming soon">
                <option>Custom</option>
            </select>

            <div class="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                <div class="field">
                    <span class="clab">W</span>
                    <div class="num">
                        <input type="number" min="1" :value="width"
                            @change="setWidth(+($event.target as HTMLInputElement).value)" aria-label="Page width" />
                    </div>
                </div>
                <div class="field">
                    <span class="clab">H</span>
                    <div class="num">
                        <input type="number" min="1" :value="height"
                            @change="setHeight(+($event.target as HTMLInputElement).value)" aria-label="Page height" />
                    </div>
                </div>
                <button type="button" class="aspect-lock" :class="{ active: aspectLocked }"
                    title="Lock aspect ratio" @click="toggleAspectLock">
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4">
                        <path d="M5 8a3 3 0 0 1 3-3h1M11 8a3 3 0 0 1-3 3H7" stroke-linecap="round" />
                    </svg>
                </button>
            </div>

            <div class="field">
                <span class="clab">Background</span>
                <button type="button" class="color-chip" :style="{ background: background }"
                    @click="pickColor(background, setBackground)" aria-label="Page background color" />
            </div>

            <button type="button" class="link-btn" disabled title="Coming soon">Fit page to content…</button>
            <button type="button" class="link-btn" @click="resetPageView">Reset page view</button>
            <label class="checkbox-row disabled" title="Coming soon">
                <input type="checkbox" disabled />
                <span>Hide content outside page</span>
            </label>
        </div>

        <div class="section-head mt-4">
            <h3 class="section-title">Spacing</h3>
        </div>
        <div class="grid grid-cols-2 gap-2 mt-2">
            <div class="field">
                <span class="clab">Padding</span>
                <div class="num">
                    <input type="number" min="0" :value="padding"
                        @change="setPadding(+($event.target as HTMLInputElement).value)" aria-label="Page padding" />
                </div>
            </div>
            <div class="field">
                <span class="clab">Margin</span>
                <div class="num">
                    <input type="number" min="0" :value="margin"
                        @change="setMargin(+($event.target as HTMLInputElement).value)" aria-label="Page margin" />
                </div>
            </div>
        </div>

        <div class="field mt-2">
            <span class="clab">Overflow</span>
            <select class="sel" :value="overflow" @change="setOverflow(($event.target as HTMLSelectElement).value)">
                <option value="auto">Auto (scroll if content overflows)</option>
                <option value="visible">Visible</option>
                <option value="hidden">Hidden</option>
            </select>
        </div>

        <div class="section-head mt-4">
            <h3 class="section-title">Layout</h3>
        </div>
        <div class="flex flex-col gap-2 mt-2">
            <div class="seg3" role="group" aria-label="Root layout mode">
                <button type="button" class="seg3-btn" :class="{ selected: layoutMode === 'block' }" @click="setLayoutMode('block')">Block</button>
                <button type="button" class="seg3-btn" :class="{ selected: layoutMode === 'flex' }" @click="setLayoutMode('flex')">Flex</button>
                <button type="button" class="seg3-btn" :class="{ selected: layoutMode === 'grid' }" @click="setLayoutMode('grid')">Grid</button>
            </div>

            <template v-if="layoutMode === 'flex'">
                <div class="seg2" role="group" aria-label="Direction">
                    <button type="button" class="seg2-btn" :class="{ selected: direction === 'row' }" @click="setDirection('row')">Row</button>
                    <button type="button" class="seg2-btn" :class="{ selected: direction === 'column' }" @click="setDirection('column')">Column</button>
                </div>
                <div class="field">
                    <span class="clab">Justify</span>
                    <select class="sel" :value="justify" @change="setJustify(($event.target as HTMLSelectElement).value)">
                        <option value="flex-start">Start</option>
                        <option value="center">Center</option>
                        <option value="flex-end">End</option>
                        <option value="space-between">Space between</option>
                        <option value="space-around">Space around</option>
                    </select>
                </div>
                <div class="field">
                    <span class="clab">Align</span>
                    <select class="sel" :value="align" @change="setAlign(($event.target as HTMLSelectElement).value)">
                        <option value="stretch">Stretch</option>
                        <option value="flex-start">Start</option>
                        <option value="center">Center</option>
                        <option value="flex-end">End</option>
                    </select>
                </div>
                <div class="field">
                    <span class="clab">Gap</span>
                    <div class="num"><input type="number" min="0" :value="gap" @change="setGap(+($event.target as HTMLInputElement).value)" aria-label="Gap" /></div>
                </div>
            </template>

            <template v-else-if="layoutMode === 'grid'">
                <div class="field">
                    <span class="clab">Columns</span>
                    <div class="num"><input type="text" :value="columns" placeholder="1fr 1fr 1fr" @change="setColumns(($event.target as HTMLInputElement).value)" aria-label="Grid columns" /></div>
                </div>
                <div class="field">
                    <span class="clab">Rows</span>
                    <div class="num"><input type="text" :value="rows" placeholder="auto 1fr (optional)" @change="setRows(($event.target as HTMLInputElement).value)" aria-label="Grid rows" /></div>
                </div>
                <div class="field">
                    <span class="clab">Gap</span>
                    <div class="num"><input type="number" min="0" :value="gap" @change="setGap(+($event.target as HTMLInputElement).value)" aria-label="Gap" /></div>
                </div>
            </template>
        </div>

        <div class="section-head mt-4">
            <h3 class="section-title">Default Text Settings</h3>
        </div>
        <div class="flex flex-col gap-2 mt-2 disabled-block" title="Coming soon — no project-level text defaults yet">
            <select class="sel" disabled><option>Font family</option></select>
            <div class="field">
                <div class="num"><input type="text" disabled placeholder="?" /></div>
                <span class="unit-label">PX</span>
            </div>
            <button type="button" class="link-btn" disabled>Reset defaults</button>
        </div>

        <div class="section-head mt-4">
            <h3 class="section-title">Replace Colors</h3>
        </div>
        <div class="flex flex-col gap-2 mt-2 disabled-block" title="Coming soon — no project-wide color replace tool yet">
            <div class="seg2" role="group" aria-label="Replace scope">
                <button type="button" class="seg2-btn" disabled>Current Page</button>
                <button type="button" class="seg2-btn" disabled>Entire Project</button>
            </div>
            <div class="checkbox-inline">
                <label class="checkbox-row"><input type="checkbox" disabled checked /> Fills</label>
                <label class="checkbox-row"><input type="checkbox" disabled checked /> Strokes</label>
                <label class="checkbox-row"><input type="checkbox" disabled checked /> Text Color</label>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts" vapor>
    import { computed, ref } from 'vue';
    import { usePagesStore } from '../../../stores/pages';
    import { useStageStore } from '../../../stores/stage';
    import { useNativeColorPicker } from '../../../composables/useNativeColorPicker';

    const pages = usePagesStore();
    const { pickColor } = useNativeColorPicker();
    const stage = useStageStore();

    const page = computed(() => pages.getActivePageData());

    const width = computed(() => page.value?.stage.width ?? 1280);
    const height = computed(() => page.value?.stage.height ?? 720);
    const background = computed(() => page.value?.stage.background ?? '#1e1e1e');

    const aspectLocked = ref(false);
    const lockedRatio = ref(1);
    function toggleAspectLock() {
        if (!aspectLocked.value && width.value > 0 && height.value > 0) {
            lockedRatio.value = width.value / height.value;
        }
        aspectLocked.value = !aspectLocked.value;
    }

    function setWidth(val: number) {
        const w = Math.max(1, val || 1);
        if (aspectLocked.value && lockedRatio.value > 0) {
            pages.updateStage({ width: w, height: Math.max(1, Math.round(w / lockedRatio.value)) });
        } else {
            pages.updateStage({ width: w });
        }
    }

    function setHeight(val: number) {
        const h = Math.max(1, val || 1);
        if (aspectLocked.value && lockedRatio.value > 0) {
            pages.updateStage({ height: h, width: Math.max(1, Math.round(h * lockedRatio.value)) });
        } else {
            pages.updateStage({ height: h });
        }
    }

    function setBackground(val: string) {
        pages.updateStage({ background: val || '#1e1e1e' });
    }

    function resetPageView() {
        stage.resetZoom();
    }

    // ─── Spacing / layout ───────────────────────────────────────────────────
    // updateStage() shallow-merges its patch (fine for width/height/background),
    // so a `display` patch has to carry the *whole* display object each time —
    // otherwise setting padding alone would wipe out margin/layout.

    const display = computed(() => page.value?.stage.display ?? {});
    const padding = computed(() => display.value.padding ?? 0);
    const margin = computed(() => display.value.margin ?? 0);
    const overflow = computed(() => display.value.overflow ?? 'auto');
    const layout = computed(() => display.value.layout ?? { mode: 'block' as const });
    const layoutMode = computed(() => layout.value.mode);
    const direction = computed(() => layout.value.direction ?? 'row');
    const justify = computed(() => layout.value.justify ?? 'flex-start');
    const align = computed(() => layout.value.align ?? 'stretch');
    const gap = computed(() => layout.value.gap ?? 0);
    const columns = computed(() => layout.value.columns ?? '1fr');
    const rows = computed(() => layout.value.rows ?? '');

    function patchDisplay(next: Partial<NonNullable<typeof display.value>>) {
        pages.updateStage({ display: { ...display.value, ...next } });
    }

    function patchLayout(next: Partial<typeof layout.value>) {
        patchDisplay({ layout: { ...layout.value, ...next } });
    }

    function setPadding(val: number) {
        patchDisplay({ padding: Math.max(0, val || 0) });
    }

    function setMargin(val: number) {
        patchDisplay({ margin: Math.max(0, val || 0) });
    }

    function setOverflow(val: string) {
        patchDisplay({ overflow: (val || 'auto') as 'visible' | 'hidden' | 'auto' });
    }

    function setLayoutMode(mode: 'block' | 'flex' | 'grid') {
        patchLayout({ mode });
    }

    function setDirection(val: 'row' | 'column') {
        patchLayout({ direction: val });
    }

    function setJustify(val: string) {
        patchLayout({ justify: val });
    }

    function setAlign(val: string) {
        patchLayout({ align: val });
    }

    function setGap(val: number) {
        patchLayout({ gap: Math.max(0, val || 0) });
    }

    function setColumns(val: string) {
        patchLayout({ columns: val || '1fr' });
    }

    function setRows(val: string) {
        patchLayout({ rows: val || undefined });
    }
</script>

<style scoped>
    .panel-root { font-family: system-ui, sans-serif; font-size: 12px; color: #e2e8f0; }
    .section-head { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1e293b; padding-bottom: 6px; }
    .section-title { font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #cbd5e1; }

    .field { display: flex; align-items: center; gap: 6px; }
    .clab { font-size: 10px; color: #94a3b8; text-transform: uppercase; min-width: 12px; }

    .sel { width: 100%; background: #0f172a; border: 1px solid #334155; color: #e2e8f0; font-size: 11px; padding: 6px 8px; border-radius: 6px; outline: none; }
    .sel:disabled { opacity: 0.45; cursor: not-allowed; }

    .num { position: relative; flex: 1 1 auto; }
    .num input { width: 100%; background: #0f172a; border: 1px solid #334155; color: #e2e8f0; font-size: 11px; padding: 6px 8px; border-radius: 6px; outline: none; }
    .num input:disabled { color: #64748b; cursor: not-allowed; }
    .unit-label { font-size: 10px; color: #64748b; }

    .aspect-lock { display: flex; align-items: center; justify-content: center; width: 24px; height: 30px; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: #94a3b8; cursor: pointer; }
    .aspect-lock:hover { background: #1f2937; color: #e2e8f0; }
    .aspect-lock.active { background: #334155; border-color: #64748b; color: #f8fafc; }

    .color-chip { flex: 1 1 auto; height: 28px; padding: 0 1px; background: #0f172a; border: 1px solid #334155; border-radius: 6px; cursor: pointer; }

    .link-btn { background: none; border: none; color: #60a5fa; font-size: 11px; text-align: left; padding: 0; cursor: pointer; }
    .link-btn:hover { text-decoration: underline; }
    .link-btn:disabled { color: #64748b; cursor: not-allowed; text-decoration: none; }

    .checkbox-row { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #cbd5e1; }
    .checkbox-row.disabled { color: #64748b; cursor: not-allowed; }
    .checkbox-inline { display: flex; gap: 12px; flex-wrap: wrap; }

    .disabled-block { opacity: 0.55; }

    .seg2, .seg3 { display: flex; border: 1px solid #334155; border-radius: 6px; overflow: hidden; }
    .seg2-btn, .seg3-btn { flex: 1 1 0; background: #0f172a; border: none; color: #94a3b8; font-size: 11px; padding: 5px 0; cursor: pointer; }
    .seg2-btn:hover:not(:disabled), .seg3-btn:hover:not(:disabled) { background: #1f2937; }
    .seg2-btn.selected, .seg3-btn.selected { background: #334155; color: #f8fafc; }
    .seg2-btn:disabled, .seg3-btn:disabled { cursor: not-allowed; opacity: 0.6; }
    .seg2-btn + .seg2-btn, .seg3-btn + .seg3-btn { border-left: 1px solid #334155; }

    .hint { font-size: 10px; line-height: 1.5; color: #94a3b8; }
    .hint code { background: #0f172a; border: 1px solid #334155; border-radius: 3px; padding: 1px 4px; color: #cbd5e1; font-family: ui-monospace, monospace; }

    .preset-row { display: flex; flex-wrap: wrap; gap: 4px; }
    .preset-btn { background: #0f172a; border: 1px solid #334155; color: #cbd5e1; font-size: 10px; padding: 4px 8px; border-radius: 6px; cursor: pointer; }
    .preset-btn:hover { background: #1f2937; }
</style>
