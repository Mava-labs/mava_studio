<!--
    FillStroke.vue
    Handles two shapes of the same concept:
      - SVG elements:      style.fill (string) + style.stroke {color,width,style}
      - Container/Input-y  style.background (string) + style.border {color,width,style}
        elements (container, button, textinput, ...)
    Folds in what used to be separate SvgFillControl / SvgStrokeControl
    generic controls — one implementation instead of two.
-->
<template>
    <div class="panel-root px-3" v-if="showPanel">
        <div class="section-head mb-3">
            <h3 class="section-title">Fills &amp; Strokes</h3>
            <span class="badge">Style</span>
        </div>

        <div v-if="mode" class="flex flex-col gap-3">
            <div class="prop-row">
                <span class="icon-slot" aria-hidden="true">
                    <svg viewBox="0 0 16 16" width="14" height="14"><rect x="1" y="1" width="14" height="14" rx="3" fill="currentColor" /></svg>
                </span>
                <span class="clab">Fill</span>
                <button type="button" class="color-chip" :style="{ background: fillColor }"
                    @click="pickColor(fillColor, setFill)" aria-label="Fill color" />
            </div>

            <div class="prop-row">
                <span class="icon-slot" aria-hidden="true">
                    <svg viewBox="0 0 16 16" width="14" height="14"><rect x="1.5" y="1.5" width="13" height="13" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" /></svg>
                </span>
                <span class="clab">Stroke</span>
                <button type="button" class="color-chip" :style="{ background: strokeColor }"
                    @click="pickColor(strokeColor, setStrokeColor)" aria-label="Stroke color" />
            </div>

            <label v-if="mode === 'box'" class="checkbox-row">
                <input type="checkbox" :checked="isPerSideBorder" @change="togglePerSide(($event.target as HTMLInputElement).checked)" />
                <span>Per side</span>
            </label>

            <div v-if="!isPerSideBorder" class="prop-row">
                <span class="icon-slot" aria-hidden="true"></span>
                <span class="clab">Width</span>
                <div class="num">
                    <input type="number" min="0" step="0.5" :value="strokeWidth"
                        @change="setStrokeWidth(+($event.target as HTMLInputElement).value)"
                        aria-label="Stroke width" />
                    <span class="unit">px</span>
                    <div class="steppers">
                        <button class="step" type="button" @click="setStrokeWidth(Math.max(0, strokeWidth + 0.5))">▴</button>
                        <button class="step" type="button" @click="setStrokeWidth(Math.max(0, strokeWidth - 0.5))">▾</button>
                    </div>
                </div>
            </div>

            <div v-else class="grid grid-cols-2 gap-2">
                <div class="field">
                    <span class="clab">Top</span>
                    <div class="num"><input type="number" min="0" step="0.5" :value="borderTop" @change="setBorderSide('top', +($event.target as HTMLInputElement).value)" aria-label="Top border width" /></div>
                </div>
                <div class="field">
                    <span class="clab">Right</span>
                    <div class="num"><input type="number" min="0" step="0.5" :value="borderRight" @change="setBorderSide('right', +($event.target as HTMLInputElement).value)" aria-label="Right border width" /></div>
                </div>
                <div class="field">
                    <span class="clab">Bottom</span>
                    <div class="num"><input type="number" min="0" step="0.5" :value="borderBottom" @change="setBorderSide('bottom', +($event.target as HTMLInputElement).value)" aria-label="Bottom border width" /></div>
                </div>
                <div class="field">
                    <span class="clab">Left</span>
                    <div class="num"><input type="number" min="0" step="0.5" :value="borderLeft" @change="setBorderSide('left', +($event.target as HTMLInputElement).value)" aria-label="Left border width" /></div>
                </div>
            </div>

            <div class="prop-row">
                <span class="icon-slot" aria-hidden="true"></span>
                <span class="clab">Style</span>
                <select class="sel" :value="strokeStyle"
                    @change="setStrokeStyle(($event.target as HTMLSelectElement).value as any)"
                    aria-label="Stroke style">
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                </select>
            </div>
        </div>

        <!--
            Composite (component/group) fills: edit each child's own fill directly
            from the parent's panel, instead of requiring you to select each child
            individually on canvas (there's no "enter group" canvas interaction yet).
        -->
        <div v-if="childFills.length" class="flex flex-col gap-2" :class="{ 'mt-4 pt-3 children-sep': mode }">
            <span class="clab-block">Children</span>
            <div v-for="child in childFills" :key="child.id" class="prop-row">
                <span class="icon-slot" aria-hidden="true">
                    <svg viewBox="0 0 16 16" width="14" height="14"><rect x="1" y="1" width="14" height="14" rx="3" fill="currentColor" /></svg>
                </span>
                <span class="clab child-name" :title="child.name">{{ child.name }}</span>
                <button type="button" class="color-chip" :style="{ background: child.color }"
                    @click="pickColor(child.color, (v) => setChildFill(child, v))"
                    :aria-label="`${child.name} fill color`" />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts" vapor>
    import { computed } from 'vue';
    import { useActiveElement } from '../../../composables/useActiveElement';
    import { usePagesStore } from '../../../stores/pages';
    import { useElementStore } from '../../../stores/element';
    import { styleCapabilityMode } from '../../../utils/elementCapabilities';
    import { useNativeColorPicker } from '../../../composables/useNativeColorPicker';
    import type { SvgStyle, BoxEdges } from '../../../types/element';

    const { element, update } = useActiveElement();
    const pages = usePagesStore();
    const elementStore = useElementStore();
    const { pickColor } = useNativeColorPicker();

    type Mode = 'svg' | 'box' | null;

    /** Type-based eligibility, not key-presence — see elementCapabilities.ts for why. */
    const mode = computed<Mode>(() => styleCapabilityMode(element.value));

    interface ChildFill {
        id: string;
        name: string;
        color: string;
        kind: 'svg' | 'box';
    }

    /**
     * Composite/group elements (kind 'component' or a container with children)
     * often have no fill of their own worth editing — what you actually want is
     * each child's fill, without navigating into the group on canvas (that
     * interaction doesn't exist yet). Only lists children whose style shape
     * actually has a fill (svg) or background (box) — same gating logic as `mode`.
     */
    const childFills = computed<ChildFill[]>(() => {
        const el = element.value as any;
        const childIds: string[] | undefined = el?.children;
        if (!childIds || !childIds.length) return [];

        const result: ChildFill[] = [];
        for (const id of childIds) {
            const child = pages.getElementById(id);
            if (!child) continue;
            if (child.kind === 'svg') {
                result.push({ id, name: child.name, color: (child.style as SvgStyle).fill ?? '#000000', kind: 'svg' });
            } else {
                const style = child.style as any;
                if (style && 'background' in style) {
                    result.push({ id, name: child.name, color: style.background ?? '#000000', kind: 'box' });
                }
            }
        }
        return result;
    });

    const showPanel = computed(() => !!mode.value || childFills.value.length > 0);

    function setChildFill(child: ChildFill, value: string) {
        const color = value || '#000000';
        if (child.kind === 'svg') elementStore.updateElement(child.id, { style: { fill: color } });
        else elementStore.updateElement(child.id, { style: { background: color } });
    }

    const fillColor = computed(() => {
        const el = element.value;
        if (!el) return '#000000';
        if (mode.value === 'svg') return (el.style as SvgStyle).fill ?? '#000000';
        if (mode.value === 'box') return (el.style as any).background ?? '#000000';
        return '#000000';
    });

    const strokeColor = computed(() => {
        const el = element.value;
        if (!el) return '#000000';
        if (mode.value === 'svg') return (el.style as SvgStyle).stroke?.color ?? '#000000';
        if (mode.value === 'box') return (el.style as any).border?.color ?? '#000000';
        return '#000000';
    });

    /**
     * Only 'box' mode (container/button/input — real CSS box-model
     * elements) can have a per-side border width; SVG's stroke draws
     * uniformly around the shape's path and doesn't have "sides" the same
     * way, so SvgStyle.stroke.width was deliberately left as a plain number
     * (not touched by this) while BorderStyle.width became `number | BoxEdges`.
     */
    const borderWidthRaw = computed<number | BoxEdges>(() => {
        if (mode.value !== 'box') return 1;
        return (element.value?.style as any)?.border?.width ?? 1;
    });
    const isPerSideBorder = computed(() => mode.value === 'box' && typeof borderWidthRaw.value === 'object');

    const borderTop = computed(() => typeof borderWidthRaw.value === 'object' ? borderWidthRaw.value.top : borderWidthRaw.value);
    const borderRight = computed(() => typeof borderWidthRaw.value === 'object' ? borderWidthRaw.value.right : borderWidthRaw.value);
    const borderBottom = computed(() => typeof borderWidthRaw.value === 'object' ? borderWidthRaw.value.bottom : borderWidthRaw.value);
    const borderLeft = computed(() => typeof borderWidthRaw.value === 'object' ? borderWidthRaw.value.left : borderWidthRaw.value);

    const strokeWidth = computed(() => {
        const el = element.value;
        if (!el) return 1;
        if (mode.value === 'svg') return (el.style as SvgStyle).stroke?.width ?? 1;
        if (mode.value === 'box') return typeof borderWidthRaw.value === 'object' ? borderWidthRaw.value.top : borderWidthRaw.value;
        return 1;
    });

    const strokeStyle = computed(() => {
        const el = element.value;
        if (!el) return 'solid' as const;
        if (mode.value === 'svg') return (el.style as SvgStyle).stroke?.style ?? 'solid';
        if (mode.value === 'box') return (el.style as any).border?.style ?? 'solid';
        return 'solid' as const;
    });

    /**
     * Width here is the *raw* current value (number, or BoxEdges when
     * per-side is on) — not strokeWidth.value, which is always a flattened
     * number. Using strokeWidth here would silently collapse a per-side
     * border back to uniform every time only the color or style changed.
     */
    function currentStrokeShape() {
        const width = mode.value === 'box' ? borderWidthRaw.value : strokeWidth.value;
        return { color: strokeColor.value, width, style: strokeStyle.value };
    }

    function setBorderSide(side: 'top' | 'right' | 'bottom' | 'left', v: number) {
        const current = borderWidthRaw.value;
        const base: BoxEdges = typeof current === 'object'
            ? current
            : { top: current, right: current, bottom: current, left: current, locked: false };
        const width: BoxEdges = { ...base, [side]: Math.max(0, v) };
        update({ style: { border: { ...currentStrokeShape(), width } } });
    }

    /** Switching per-side on/off relabels the current value rather than
     *  losing it — on: all four sides start at today's uniform width; off:
     *  collapses back to a single number using the top side's value. */
    function togglePerSide(v: boolean) {
        const current = borderWidthRaw.value;
        const width: number | BoxEdges = v
            ? (typeof current === 'object' ? current : { top: current, right: current, bottom: current, left: current, locked: false })
            : (typeof current === 'object' ? current.top : current);
        update({ style: { border: { ...currentStrokeShape(), width } } });
    }

    function setFill(v: string) {
        const value = v || '#000000';
        if (mode.value === 'svg') update({ style: { fill: value } });
        else if (mode.value === 'box') update({ style: { background: value } });
    }

    function setStrokeColor(v: string) {
        const color = v || '#000000';
        const shape = { ...currentStrokeShape(), color };
        if (mode.value === 'svg') update({ style: { stroke: shape } });
        else if (mode.value === 'box') update({ style: { border: shape } });
    }

    function setStrokeWidth(v: number) {
        const shape = { ...currentStrokeShape(), width: Math.max(0, v) };
        if (mode.value === 'svg') update({ style: { stroke: shape } });
        else if (mode.value === 'box') update({ style: { border: shape } });
    }

    function setStrokeStyle(v: 'solid' | 'dashed' | 'dotted') {
        const shape = { ...currentStrokeShape(), style: v };
        if (mode.value === 'svg') update({ style: { stroke: shape } });
        else if (mode.value === 'box') update({ style: { border: shape } });
    }
</script>

<style scoped>
    .panel-root { font-family: system-ui, sans-serif; font-size: 12px; color: #e2e8f0; }
    .section-head { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1e293b; padding-bottom: 6px; }
    .section-title { font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #cbd5e1; }
    .badge { font-size: 10px; padding: 2px 8px; border-radius: 8px; background: #0f172a; color: #94a3b8; text-transform: uppercase; }

    .prop-row { display: flex; align-items: center; gap: 8px; }
    .icon-slot { width: 14px; flex-shrink: 0; color: #64748b; display: flex; align-items: center; justify-content: center; }
    .clab { font-size: 10px; color: #94a3b8; text-transform: uppercase; min-width: 36px; }
    .clab-block { font-size: 10px; color: #94a3b8; text-transform: uppercase; }
    .child-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-transform: none; }
    .children-sep { border-top: 1px solid #1e293b; }

    .color-chip { flex: 1 1 auto; height: 28px; padding: 2px 4px; background: #0f172a; border: 1px solid #334155; border-radius: 6px; cursor: pointer; }

    .checkbox-row { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #cbd5e1; }
    .field { display: flex; align-items: center; gap: 6px; }

    /* Number input with steppers */
    .num { position: relative; flex: 1 1 auto; }
    .num input[type=number] { width: 100%; background: #0f172a; border: 1px solid #334155; color: #e2e8f0; font-size: 11px; padding: 5px 38px 5px 8px; border-radius: 6px; outline: none; }
    /* Per-side border fields have no steppers/unit label, so they don't need the reserved right padding */
    .field .num input[type=number] { padding: 5px 8px; }
    .unit { position: absolute; right: 22px; top: 50%; transform: translateY(-50%); font-size: 10px; color: #94a3b8; pointer-events: none; }
    .steppers { position: absolute; right: 2px; top: 2px; bottom: 2px; display: flex; flex-direction: column; gap: 1px; }
    .step { width: 16px; flex: 1 1 0; background: #1f2937; border: 1px solid #334155; color: #e2e8f0; font-size: 9px; line-height: 1; padding: 0; border-radius: 2px; cursor: pointer; }
    .step:hover { background: #374151; }

    .sel { flex: 1 1 auto; background: #0f172a; border: 1px solid #334155; color: #e2e8f0; font-size: 11px; padding: 5px 8px; border-radius: 6px; outline: none; }

    input[type=number]::-webkit-outer-spin-button,
    input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
</style>
