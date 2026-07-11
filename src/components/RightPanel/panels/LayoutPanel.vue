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

        <div class="field mt-2">
            <span class="clab">Overflow</span>
            <select class="sel" :value="overflow" @change="setOverflow(($event.target as HTMLSelectElement).value)">
                <option value="">Auto (default when sized)</option>
                <option value="visible">Visible</option>
                <option value="hidden">Hidden</option>
                <option value="auto">Auto</option>
            </select>
        </div>

        <!-- One shared unit for W/H — not a per-field dropdown (too cramped
             next to the number inputs). Picking a unit here relabels
             whichever of W/H are currently Fixed, and governs the unit any
             new W/H value typed from here on is stored in. Auto-syncs to
             match the selected element's own current width unit. -->
        <div class="unit-row mt-3" role="radiogroup" aria-label="Size unit">
            <button v-for="u in SIZE_UNITS" :key="u" type="button" class="unit-radio"
                :class="{ selected: sizeUnit === u }" :aria-pressed="sizeUnit === u" @click="setSizeUnit(u)">{{ u }}</button>
        </div>

        <div class="grid grid-cols-[1fr_1fr_auto] gap-2 mt-2 items-center">
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
                <div class="num" :class="{ disabled: widthMode !== 'fixed' }">
                    <input type="number" :value="width" :disabled="widthMode !== 'fixed'"
                        @change="setWidth(+($event.target as HTMLInputElement).value)" aria-label="Width" />
                    <div class="steppers">
                        <button class="step" type="button" :disabled="widthMode !== 'fixed'" @click="setWidth(Math.max(0, width + 1))">▴</button>
                        <button class="step" type="button" :disabled="widthMode !== 'fixed'" @click="setWidth(Math.max(0, width - 1))">▾</button>
                    </div>
                </div>
            </div>

            <!-- Constrain proportions — spans both rows, sits between the W/H column and nothing else -->
            <button type="button" class="aspect-lock" :class="{ active: aspectLocked }"
                :disabled="widthMode !== 'fixed' || heightMode !== 'fixed'"
                :title="aspectLocked ? 'Unlock aspect ratio' : 'Lock aspect ratio (only available when both W and H are Fixed)'"
                @click="toggleAspectLock" style="grid-row: span 2;">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4">
                    <path d="M5 8a3 3 0 0 1 3-3h1M11 8a3 3 0 0 1-3 3H7" stroke-linecap="round" />
                </svg>
            </button>

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
                <div class="num" :class="{ disabled: heightMode !== 'fixed' }">
                    <input type="number" :value="height" :disabled="heightMode !== 'fixed'"
                        @change="setHeight(+($event.target as HTMLInputElement).value)" aria-label="Height" />
                    <div class="steppers">
                        <button class="step" type="button" :disabled="heightMode !== 'fixed'" @click="setHeight(Math.max(0, height + 1))">▴</button>
                        <button class="step" type="button" :disabled="heightMode !== 'fixed'" @click="setHeight(Math.max(0, height - 1))">▾</button>
                    </div>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-2 gap-2 mt-3">
            <div class="sizing-group">
                <span class="clab-block">Width sizing</span>
                <div class="seg2" role="group" aria-label="Width sizing mode">
                    <button type="button" class="seg2-btn" :class="{ selected: widthMode === 'auto' }" @click="setWidthMode('auto')">Auto</button>
                    <button type="button" class="seg2-btn" :class="{ selected: widthMode === 'fixed' }" @click="setWidthMode('fixed')">Fixed</button>
                </div>
            </div>
            <div class="sizing-group">
                <span class="clab-block">Height sizing</span>
                <div class="seg2" role="group" aria-label="Height sizing mode">
                    <button type="button" class="seg2-btn" :class="{ selected: heightMode === 'auto' }" @click="setHeightMode('auto')">Auto</button>
                    <button type="button" class="seg2-btn" :class="{ selected: heightMode === 'fixed' }" @click="setHeightMode('fixed')">Fixed</button>
                </div>
            </div>
        </div>

        <p v-if="percentHeightWarning" class="hint mt-2">
            % height won't reliably fill its box here — the parent isn't Flex/Grid, so it has no definite
            height for a percentage to resolve against, and the element falls back to its natural size.
            Switch the parent's Auto Layout to Flex (children stretch to fill by default), or use a fixed
            px height instead.
        </p>

        <!-- Item: only meaningful when the parent (an element container, or
             the page root — see PageSettingsPanel.vue) is actually flex/grid.
             On a flow parent, order/span would be dead controls. -->
        <template v-if="showItemSection">
            <div class="section-head mt-4">
                <h3 class="section-title">Item</h3>
                <span class="badge">{{ parentMode.toUpperCase() }}</span>
            </div>
            <div class="grid gap-2 mt-2" :class="isGridChild ? 'grid-cols-3' : 'grid-cols-1'">
                <div class="field">
                    <span class="clab">Order</span>
                    <div class="num"><input type="number" :value="order" @change="setOrder(+($event.target as HTMLInputElement).value)" aria-label="Order" /></div>
                </div>
                <template v-if="isGridChild">
                    <div class="field">
                        <span class="clab">Col span</span>
                        <div class="num"><input type="number" min="1" :value="columnSpan" @change="setColumnSpan(+($event.target as HTMLInputElement).value)" aria-label="Column span" /></div>
                    </div>
                    <div class="field">
                        <span class="clab">Row span</span>
                        <div class="num"><input type="number" min="1" :value="rowSpan" @change="setRowSpan(+($event.target as HTMLInputElement).value)" aria-label="Row span" /></div>
                    </div>
                </template>
            </div>
        </template>
    </div>
</template>

<script setup lang="ts" vapor>
    import { computed, ref } from 'vue';
    import type { Layout } from '../../../types/element';
    import { useActiveElement } from '../../../composables/useActiveElement';
    import { usePagesStore } from '../../../stores/pages';

    const { element, update } = useActiveElement();
    const pages = usePagesStore();

    /**
     * What this element's *parent* lays it out as — an element container
     * (layout.mode), or, for a root-level element, the page itself
     * (Page['stage'].display.layout — see PageSettingsPanel.vue / resolver.ts's
     * resolveParentContext for the matching render-side logic). Drives
     * whether the Item section below even makes sense to show.
     */
    const parentMode = computed<'flow' | 'flex' | 'grid'>(() => {
        const el = element.value;
        if (!el) return 'flow';
        if (el.parentId) {
            const parent = pages.getElementById(el.parentId);
            const mode = parent?.layout.mode;
            return mode === 'flex' || mode === 'grid' ? mode : 'flow';
        }
        const pageMode = pages.getActivePageData()?.stage.display?.layout?.mode;
        return pageMode === 'flex' || pageMode === 'grid' ? pageMode : 'flow';
    });
    const isGridChild = computed(() => parentMode.value === 'grid');
    const showItemSection = computed(() => parentMode.value === 'flex' || parentMode.value === 'grid');

    /**
     * A % height only resolves against a parent with a *definite* height —
     * CSS spec behavior, not a resolver bug. A flow (block) parent's height
     * is normally content-driven ('auto'), so a % height child has nothing
     * to resolve against and falls back to its own natural size — exactly
     * the "image ignores its Fixed % height, overflows the box" report this
     * was added for. Flex/grid parents don't have this problem (a flex
     * parent's default align-items:stretch already gives children a real
     * height; a grid cell's size comes from the track, not a percentage).
     */
    const percentHeightWarning = computed(() => {
        return heightMode.value === 'fixed' && sizeUnit.value === '%' && parentMode.value === 'flow';
    });

    const order = computed(() => element.value?.layout.order ?? 0);
    const columnSpan = computed(() => element.value?.layout.columnSpan ?? 1);
    const rowSpan = computed(() => element.value?.layout.rowSpan ?? 1);
    function setOrder(v: number) { update({ layout: { order: Math.round(v || 0) } }); }
    function setColumnSpan(v: number) { update({ layout: { columnSpan: Math.max(1, Math.round(v || 1)) } }); }
    function setRowSpan(v: number) { update({ layout: { rowSpan: Math.max(1, Math.round(v || 1)) } }); }

    /** Ephemeral UI state only — proportions lock isn't a persisted element property. */
    const aspectLocked = ref(false);
    const lockedRatio = ref(1);
    function toggleAspectLock() {
        if (widthMode.value !== 'fixed' || heightMode.value !== 'fixed') return;
        if (!aspectLocked.value && width.value > 0 && height.value > 0) {
            lockedRatio.value = width.value / height.value;
        }
        aspectLocked.value = !aspectLocked.value;
    }

    const positionMode = computed(() => element.value?.layout.position ?? 'static');
    const positionLabel = computed(() => positionMode.value.toUpperCase());
    const isPositioned = computed(() => ['absolute', 'fixed', 'sticky', 'relative'].includes(positionMode.value));

    /**
     * '' means "unset" — resolver.ts's resolveOverflow() then applies its
     * own default (auto for a constrained/sized element, nothing otherwise)
     * rather than this panel hardcoding a value. Choosing '' explicitly
     * clears any prior override back to that default.
     */
    const overflow = computed(() => element.value?.layout.overflow ?? '');
    function setOverflow(v: string) {
        update({ layout: { overflow: (v || undefined) as Layout['overflow'] } });
    }

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

    /**
     * Width/height used to only ever recognize a trailing "px" as "Fixed" —
     * anything else (including a perfectly valid "50%" or "40vh" someone
     * might have set via the Bindings panel or a future import) silently
     * read as Auto. Generalized to any of SIZE_UNITS so Fixed-mode sizing
     * can be expressed in whichever unit actually makes sense for the
     * layout — % of a flex/grid parent, vh for viewport-relative sections, etc.
     */
    const SIZE_UNITS = ['px', '%', 'vh', 'rem'] as const;
    type SizeUnit = typeof SIZE_UNITS[number];
    const SIZE_PATTERN = /^(-?\d*\.?\d+)(px|%|vh|rem)$/;

    function parseSize(v: unknown): { value: number; unit: SizeUnit } | null {
        if (typeof v !== 'string') return null;
        const match = v.match(SIZE_PATTERN);
        if (!match) return null;
        return { value: Number.parseFloat(match[1]), unit: match[2] as SizeUnit };
    }

    const width = computed(() => parseSize(element.value?.layout.width)?.value ?? 0);
    const height = computed(() => parseSize(element.value?.layout.height)?.value ?? 0);

    /**
     * One shared unit for both W and H, not two independent per-field
     * choices — a single radio group above X/W (LayoutPanel.vue's template)
     * governs both, per your call: cramming a unit dropdown next to each
     * number field made the row too tight, and there's rarely a reason W and
     * H would want different units on the same element anyway. Derived
     * straight from the selected element's own current width (falling back
     * to height, then 'px') — switching elements naturally shows that
     * element's real unit, no separate sync logic needed since this is a
     * plain computed off `element`.
     */
    const sizeUnit = computed<SizeUnit>(() => {
        const w = parseSize(element.value?.layout.width);
        if (w) return w.unit;
        const h = parseSize(element.value?.layout.height);
        if (h) return h.unit;
        return 'px';
    });

    /** 'fixed' = an explicit sized value in any recognized unit; anything else ('auto', 'hug', 'fill', unset) reads as Auto. */
    const widthMode = computed<'auto' | 'fixed'>(() => parseSize(element.value?.layout.width) ? 'fixed' : 'auto');
    const heightMode = computed<'auto' | 'fixed'>(() => parseSize(element.value?.layout.height) ? 'fixed' : 'auto');

    function setWidthMode(mode: 'auto' | 'fixed') {
        if (mode === 'auto') update({ layout: { width: 'auto' } });
        else update({ layout: { width: `${width.value || 100}${sizeUnit.value}` } });
    }

    function setHeightMode(mode: 'auto' | 'fixed') {
        if (mode === 'auto') update({ layout: { height: 'auto' } });
        else update({ layout: { height: `${height.value || 100}${sizeUnit.value}` } });
    }

    /** Relabels whichever of W/H are currently Fixed under the new shared
     *  unit — not a conversion (50px -> 50% isn't meaningful without knowing
     *  the parent's own size), just switches which unit the existing
     *  number(s) are expressed in. */
    function setSizeUnit(unit: SizeUnit) {
        const patch: { width?: string; height?: string } = {};
        if (widthMode.value === 'fixed') patch.width = `${width.value || 100}${unit}`;
        if (heightMode.value === 'fixed') patch.height = `${height.value || 100}${unit}`;
        if (Object.keys(patch).length) update({ layout: patch });
    }

    function setX(val: number) {
        if (!isPositioned.value) return;
        update({ layout: { x: `${val}px` } });
    }

    function setY(val: number) {
        if (!isPositioned.value) return;
        update({ layout: { y: `${val}px` } });
    }

    function setWidth(val: number) {
        const w = Math.max(0, val);
        if (aspectLocked.value && lockedRatio.value > 0) {
            update({ layout: { width: `${w}${sizeUnit.value}`, height: `${Math.max(0, Math.round(w / lockedRatio.value))}${sizeUnit.value}` } });
            return;
        }
        update({ layout: { width: `${w}${sizeUnit.value}` } });
    }

    function setHeight(val: number) {
        const h = Math.max(0, val);
        if (aspectLocked.value && lockedRatio.value > 0) {
            update({ layout: { height: `${h}${sizeUnit.value}`, width: `${Math.max(0, Math.round(h * lockedRatio.value))}${sizeUnit.value}` } });
            return;
        }
        update({ layout: { height: `${h}${sizeUnit.value}` } });
    }

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

    .sizing-group { display: flex; flex-direction: column; gap: 4px; }
    .clab-block { font-size: 10px; color: #94a3b8; text-transform: uppercase; }
    .seg2 { display: flex; border: 1px solid #334155; border-radius: 6px; overflow: hidden; }
    .seg2-btn { flex: 1 1 0; background: #0f172a; border: none; color: #94a3b8; font-size: 11px; padding: 5px 0; cursor: pointer; }
    .seg2-btn + .seg2-btn { border-left: 1px solid #334155; }
    .seg2-btn:hover { background: #1f2937; }
    .seg2-btn.selected { background: #334155; color: #f8fafc; }

    .hint { font-size: 10px; line-height: 1.5; color: #f59e0b; }

    .unit-row { display: flex; border: 1px solid #334155; border-radius: 6px; overflow: hidden; }
    .unit-radio { flex: 1 1 0; background: #0f172a; border: none; color: #94a3b8; font-size: 10px; padding: 5px 0; cursor: pointer; }
    .unit-radio:hover { background: #1f2937; }
    .unit-radio.selected { background: #334155; color: #f8fafc; }
    .unit-radio + .unit-radio { border-left: 1px solid #334155; }

    .aspect-lock { display: flex; align-items: center; justify-content: center; width: 24px; height: 100%; min-height: 30px; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: #94a3b8; cursor: pointer; }
    .aspect-lock:hover { background: #1f2937; color: #e2e8f0; }
    .aspect-lock.active { background: #334155; border-color: #64748b; color: #f8fafc; }
    .aspect-lock:disabled { opacity: 0.35; cursor: not-allowed; }
</style>