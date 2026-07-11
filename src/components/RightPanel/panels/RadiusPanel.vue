<template>
	<div class="panel-root px-3">
		<div v-if="!radius" class="text-xs text-slate-500 px-3 py-2">Nothing selected.</div>

		<div v-else class="flex flex-col gap-3 px-3 pb-3">
			<div class="section-head">
				<h3 class="section-title">Rounded corners</h3>
			</div>

			<div class="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
				<div class="grid grid-cols-1 gap-2">
					<div class="corner">
						<span class="corner-icon" aria-hidden="true">
							<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 10V6a4 4 0 0 1 4-4h4" stroke-linecap="round" /></svg>
						</span>
						<div class="num">
							<input type="number" v-model.number="topLeft" aria-label="Top left radius" />
							<span class="unit">PX</span>
						</div>
					</div>
					<div class="corner">
						<span class="corner-icon" aria-hidden="true">
							<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 6v4a4 4 0 0 0 4 4h4" stroke-linecap="round" /></svg>
						</span>
						<div class="num">
							<input type="number" v-model.number="bottomLeft" aria-label="Bottom left radius" />
							<span class="unit">PX</span>
						</div>
					</div>
				</div>

				<button type="button" class="lock-btn" :class="{ active: linked }" @click="toggleLinked" aria-label="Toggle corner link" title="Link all corners">
					<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4">
						<path d="M5 8a3 3 0 0 1 3-3h1M11 8a3 3 0 0 1-3 3H7" stroke-linecap="round" />
					</svg>
				</button>

				<div class="grid grid-cols-1 gap-2">
					<div class="corner">
						<span class="corner-icon" aria-hidden="true">
							<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M14 10V6a4 4 0 0 0-4-4H6" stroke-linecap="round" /></svg>
						</span>
						<div class="num">
							<input type="number" v-model.number="topRight" aria-label="Top right radius" />
							<span class="unit">PX</span>
						</div>
					</div>
					<div class="corner">
						<span class="corner-icon" aria-hidden="true">
							<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M14 6v4a4 4 0 0 1-4 4H6" stroke-linecap="round" /></svg>
						</span>
						<div class="num">
							<input type="number" v-model.number="bottomRight" aria-label="Bottom right radius" />
							<span class="unit">PX</span>
						</div>
					</div>
				</div>
			</div>

			<label class="checkbox-row" title="Scales corner radius with the element on resize — needs the drag-resize system (not built yet) to actually consume this, so it's disabled rather than a control that would silently do nothing.">
				<input type="checkbox" disabled />
				<span>Scale radius</span>
			</label>
		</div>
	</div>
</template>

<script setup lang="ts" vapor>
import { computed, ref, watch } from 'vue';
import { useActiveElement } from '../../../composables/useActiveElement';
import { hasRadiusCapability } from '../../../utils/elementCapabilities';

const { element, update } = useActiveElement();

const radius = computed(() => {
	const el = element.value;
	/** Type-based eligibility, not key-presence — see elementCapabilities.ts for why. */
	if (!hasRadiusCapability(el)) return null;
	const style = el!.style as any;
	const r = (style.radius ?? 0) as number | { tl: number; tr: number; br: number; bl: number };
	if (typeof r === 'number') {
		return { tl: r, tr: r, br: r, bl: r };
	}
	return r;
});

const linked = ref(true);

watch(radius, (r) => {
	if (!r) return;
	if (r.tl === r.tr && r.tr === r.br && r.br === r.bl) {
		linked.value = true;
	}
});

const topLeft = computed({
	get: () => radius.value?.tl ?? 0,
	set: (val: number) => updateRadius('tl', val),
});
const topRight = computed({
	get: () => radius.value?.tr ?? 0,
	set: (val: number) => updateRadius('tr', val),
});
const bottomRight = computed({
	get: () => radius.value?.br ?? 0,
	set: (val: number) => updateRadius('br', val),
});
const bottomLeft = computed({
	get: () => radius.value?.bl ?? 0,
	set: (val: number) => updateRadius('bl', val),
});

function toggleLinked() {
	linked.value = !linked.value;
	if (linked.value && radius.value) {
		const v = radius.value.tl;
		applyRadius({ tl: v, tr: v, br: v, bl: v });
	}
}

function updateRadius(key: 'tl' | 'tr' | 'br' | 'bl', value: number) {
	if (!radius.value) return;
	const nextVal = Math.max(0, value || 0);
	if (linked.value) {
		applyRadius({ tl: nextVal, tr: nextVal, br: nextVal, bl: nextVal });
	} else {
		applyRadius({ ...radius.value, [key]: nextVal });
	}
}

function applyRadius(next: { tl: number; tr: number; br: number; bl: number }) {
	if (!element.value) return;
	update({ style: { radius: next } });
}
</script>

<style scoped>
.panel-root { font-family: system-ui, sans-serif; font-size: 12px; color: #e2e8f0; }
.section-head { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1e293b; padding-bottom: 6px; }
.section-title { font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #cbd5e1; }

.corner { display: flex; align-items: center; gap: 6px; }
.corner-icon { flex-shrink: 0; width: 14px; color: #64748b; display: flex; align-items: center; justify-content: center; }

.num { position: relative; flex: 1 1 auto; display: flex; align-items: center; }
.num input[type=number] { width: 100%; background: #0f172a; border: 1px solid #334155; color: #e2e8f0; font-size: 11px; padding: 6px 26px 6px 8px; border-radius: 6px; outline: none; }
.unit { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); font-size: 9px; color: #64748b; pointer-events: none; }

.lock-btn { width: 32px; height: 56px; display: grid; place-items: center; border-radius: 8px; border: 1px solid #334155; background: #1f2937; color: #cbd5e1; cursor: pointer; transition: background 0.15s, border-color 0.15s, color 0.15s; }
.lock-btn.active { background: #1d4ed8; border-color: #3b82f6; color: #ffffff; }

.checkbox-row { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #64748b; cursor: not-allowed; }

input[type=number]::-webkit-outer-spin-button,
input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
input[type=number] { -moz-appearance: textfield; }
</style>
