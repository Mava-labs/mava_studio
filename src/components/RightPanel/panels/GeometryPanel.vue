<!-- GeometryPanel.vue -->
<!--
    Curated replacement for the old generic SvgGeometryControl, which read
    from a generic `attributes` bag that shape geometry never actually lived
    in — SvgElement stores it on the first-class `geometry` field (see
    types/element.ts). This panel edits that field directly, per shape type.
-->
<template>
    <div class="panel-root px-3" v-if="geometry">
        <div class="section-head mb-3">
            <h3 class="section-title">Geometry</h3>
            <span class="badge">{{ geometry.type }}</span>
        </div>

        <div class="flex flex-col gap-3">
            <!-- rect / hotspot: width + height -->
            <div v-if="geometry.type === 'rect' || geometry.type === 'hotspot'" class="grid grid-cols-2 gap-2">
                <div class="field">
                    <span class="clab">W</span>
                    <div class="num">
                        <input type="number" :value="geometry.width"
                            @change="setGeom({ width: numVal($event) })" aria-label="Width" />
                        <div class="steppers">
                            <button class="step" type="button" @click="setGeom({ width: geometry.width + 1 })">▴</button>
                            <button class="step" type="button" @click="setGeom({ width: Math.max(0, geometry.width - 1) })">▾</button>
                        </div>
                    </div>
                </div>
                <div class="field">
                    <span class="clab">H</span>
                    <div class="num">
                        <input type="number" :value="geometry.height"
                            @change="setGeom({ height: numVal($event) })" aria-label="Height" />
                        <div class="steppers">
                            <button class="step" type="button" @click="setGeom({ height: geometry.height + 1 })">▴</button>
                            <button class="step" type="button" @click="setGeom({ height: Math.max(0, geometry.height - 1) })">▾</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- circle: radius -->
            <div v-else-if="geometry.type === 'circle'" class="field">
                <span class="clab">Radius</span>
                <div class="num">
                    <input type="number" :value="geometry.r" @change="setGeom({ r: numVal($event) })" aria-label="Radius" />
                    <div class="steppers">
                        <button class="step" type="button" @click="setGeom({ r: geometry.r + 1 })">▴</button>
                        <button class="step" type="button" @click="setGeom({ r: Math.max(0, geometry.r - 1) })">▾</button>
                    </div>
                </div>
            </div>

            <!-- ellipse: rx + ry -->
            <div v-else-if="geometry.type === 'ellipse'" class="grid grid-cols-2 gap-2">
                <div class="field">
                    <span class="clab">Rx</span>
                    <div class="num">
                        <input type="number" :value="geometry.rx" @change="setGeom({ rx: numVal($event) })" aria-label="Rx" />
                        <div class="steppers">
                            <button class="step" type="button" @click="setGeom({ rx: geometry.rx + 1 })">▴</button>
                            <button class="step" type="button" @click="setGeom({ rx: Math.max(0, geometry.rx - 1) })">▾</button>
                        </div>
                    </div>
                </div>
                <div class="field">
                    <span class="clab">Ry</span>
                    <div class="num">
                        <input type="number" :value="geometry.ry" @change="setGeom({ ry: numVal($event) })" aria-label="Ry" />
                        <div class="steppers">
                            <button class="step" type="button" @click="setGeom({ ry: geometry.ry + 1 })">▴</button>
                            <button class="step" type="button" @click="setGeom({ ry: Math.max(0, geometry.ry - 1) })">▾</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- line: x1/y1/x2/y2 -->
            <div v-else-if="geometry.type === 'line'" class="grid grid-cols-2 gap-2">
                <div class="field"><span class="clab">X1</span>
                    <div class="num"><input type="number" :value="geometry.x1" @change="setGeom({ x1: numVal($event) })" aria-label="X1" /></div>
                </div>
                <div class="field"><span class="clab">Y1</span>
                    <div class="num"><input type="number" :value="geometry.y1" @change="setGeom({ y1: numVal($event) })" aria-label="Y1" /></div>
                </div>
                <div class="field"><span class="clab">X2</span>
                    <div class="num"><input type="number" :value="geometry.x2" @change="setGeom({ x2: numVal($event) })" aria-label="X2" /></div>
                </div>
                <div class="field"><span class="clab">Y2</span>
                    <div class="num"><input type="number" :value="geometry.y2" @change="setGeom({ y2: numVal($event) })" aria-label="Y2" /></div>
                </div>
            </div>

            <!-- polygon: points list, edited as "x,y x,y x,y" text -->
            <div v-else-if="geometry.type === 'polygon'" class="field">
                <span class="clab">Points</span>
                <input class="sel" type="text" :value="pointsText"
                    @change="setPointsText(($event.target as HTMLInputElement).value)"
                    placeholder="x,y x,y x,y" aria-label="Polygon points" />
            </div>

            <!-- star: point count + inner/outer radius -->
            <div v-else-if="geometry.type === 'star'" class="flex flex-col gap-2">
                <div class="grid grid-cols-2 gap-2">
                    <div class="field"><span class="clab">Points</span>
                        <div class="num"><input type="number" min="3" :value="geometry.points"
                            @change="setGeom({ points: Math.max(3, Math.round(numVal($event))) })" aria-label="Point count" /></div>
                    </div>
                    <div class="field"><span class="clab">Inner R</span>
                        <div class="num"><input type="number" :value="geometry.innerRadius"
                            @change="setGeom({ innerRadius: numVal($event) })" aria-label="Inner radius" /></div>
                    </div>
                </div>
                <div class="field"><span class="clab">Outer R</span>
                    <div class="num"><input type="number" :value="geometry.outerRadius"
                        @change="setGeom({ outerRadius: numVal($event) })" aria-label="Outer radius" /></div>
                </div>
            </div>

            <!-- arrow: from/to points -->
            <div v-else-if="geometry.type === 'arrow'" class="grid grid-cols-2 gap-2">
                <div class="field"><span class="clab">From X</span>
                    <div class="num"><input type="number" :value="geometry.from.x"
                        @change="setGeom({ from: { ...geometry.from, x: numVal($event) } })" aria-label="From X" /></div>
                </div>
                <div class="field"><span class="clab">From Y</span>
                    <div class="num"><input type="number" :value="geometry.from.y"
                        @change="setGeom({ from: { ...geometry.from, y: numVal($event) } })" aria-label="From Y" /></div>
                </div>
                <div class="field"><span class="clab">To X</span>
                    <div class="num"><input type="number" :value="geometry.to.x"
                        @change="setGeom({ to: { ...geometry.to, x: numVal($event) } })" aria-label="To X" /></div>
                </div>
                <div class="field"><span class="clab">To Y</span>
                    <div class="num"><input type="number" :value="geometry.to.y"
                        @change="setGeom({ to: { ...geometry.to, y: numVal($event) } })" aria-label="To Y" /></div>
                </div>
            </div>

            <!-- path: not editable here -->
            <p v-else-if="geometry.type === 'path'" class="hint">
                Path geometry is edited on the canvas with the path tool.
            </p>
        </div>
    </div>
</template>

<script setup lang="ts" vapor>
    import { computed } from 'vue';
    import { useActiveElement } from '../../../composables/useActiveElement';
    import type { SvgElement } from '../../../types/element';

    const { element, update } = useActiveElement();

    const geometry = computed(() => {
        const el = element.value;
        if (!el || el.kind !== 'svg') return null;
        return (el as SvgElement).geometry;
    });

    const pointsText = computed(() => {
        const g = geometry.value;
        if (!g || g.type !== 'polygon') return '';
        return g.points.map(p => `${p.x},${p.y}`).join(' ');
    });

    function numVal(e: Event): number {
        return Number.parseFloat((e.target as HTMLInputElement).value) || 0;
    }

    function setGeom(patch: Record<string, unknown>) {
        update({ geometry: patch });
    }

    function setPointsText(text: string) {
        const points = text
            .split(/\s+/)
            .map(pair => pair.split(',').map(Number))
            .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
            .map(([x, y]) => ({ x, y }));
        setGeom({ points });
    }
</script>

<style scoped>
    .panel-root { font-family: system-ui, sans-serif; font-size: 12px; color: #e2e8f0; }
    .section-head { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1e293b; padding-bottom: 6px; }
    .section-title { font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #cbd5e1; }
    .badge { font-size: 10px; padding: 2px 8px; border-radius: 8px; background: #0f172a; color: #94a3b8; text-transform: uppercase; }

    .field { display: flex; align-items: center; gap: 6px; }
    .clab { font-size: 10px; color: #94a3b8; text-transform: uppercase; min-width: 40px; }
    .hint { font-size: 11px; color: #64748b; }

    .num { position: relative; flex: 1 1 auto; }
    .num input[type=number] { width: 100%; background: #0f172a; border: 1px solid #334155; color: #e2e8f0; font-size: 11px; padding: 6px 20px 6px 8px; border-radius: 6px; outline: none; }
    .steppers { position: absolute; right: 2px; top: 2px; bottom: 2px; display: flex; flex-direction: column; gap: 1px; }
    .step { width: 16px; flex: 1 1 0; background: #1f2937; border: 1px solid #334155; color: #e2e8f0; font-size: 9px; line-height: 1; padding: 0; border-radius: 2px; cursor: pointer; }
    .step:hover { background: #374151; }

    .sel { width: 100%; background: #0f172a; border: 1px solid #334155; color: #e2e8f0; font-size: 11px; padding: 6px 8px; border-radius: 6px; outline: none; }

    input[type=number]::-webkit-outer-spin-button,
    input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
</style>
