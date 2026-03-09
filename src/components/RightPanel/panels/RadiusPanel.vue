<template>
	<div class="panel-root flex-1 min-h-0 overflow-hidden">
		<div v-if="!radius" class="text-xs text-slate-500 px-3 py-2">Nothing selected.</div>

		<div v-else class="flex flex-col gap-3 px-3 pb-3">
			<h3 class="section-title">Rounded corners</h3>

			<div class="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
				<div class="grid grid-cols-1 gap-2">
					<div class="corner">
						<span class="clab corner-icon tl">┘</span>
						<div class="num">
							<input type="number" v-model.number="topLeft" aria-label="Top left radius" />
							<div class="steppers">
								<button class="step" type="button" @click="topLeft = Math.max(0, topLeft + 1)">▴</button>
								<button class="step" type="button" @click="topLeft = Math.max(0, topLeft - 1)">▾</button>
							</div>
						</div>
					</div>
					<div class="corner">
						<span class="clab corner-icon bl">┐</span>
						<div class="num">
							<input type="number" v-model.number="bottomLeft" aria-label="Bottom left radius" />
							<div class="steppers">
								<button class="step" type="button" @click="bottomLeft = Math.max(0, bottomLeft + 1)">▴</button>
								<button class="step" type="button" @click="bottomLeft = Math.max(0, bottomLeft - 1)">▾</button>
							</div>
						</div>
					</div>
				</div>

				<button type="button" class="lock-btn" :class="{ active: linked }" @click="toggleLinked" aria-label="Toggle corner link">
					<span class="icon">🔒</span>
				</button>

				<div class="grid grid-cols-1 gap-2">
					<div class="corner">
						<div class="num">
							<input type="number" v-model.number="topRight" aria-label="Top right radius" />
							<div class="steppers">
								<button class="step" type="button" @click="topRight = Math.max(0, topRight + 1)">▴</button>
								<button class="step" type="button" @click="topRight = Math.max(0, topRight - 1)">▾</button>
							</div>
						</div>
						<span class="clab corner-icon tr">└</span>
					</div>
					<div class="corner">
						<div class="num">
							<input type="number" v-model.number="bottomRight" aria-label="Bottom right radius" />
							<div class="steppers">
								<button class="step" type="button" @click="bottomRight = Math.max(0, bottomRight + 1)">▴</button>
								<button class="step" type="button" @click="bottomRight = Math.max(0, bottomRight - 1)">▾</button>
							</div>
						</div>
						<span class="clab corner-icon br">┌</span>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts" vapor>
import { computed, ref, watch } from 'vue';
import type { Element } from '../../../types/element';
import { usePagesStore } from '../../../stores/pages';
import { useElementStore } from '../../../stores/element';

const pages = usePagesStore();
const elements = useElementStore();

const element = computed<Element | null>(() => pages.getElementById(elements.activeElementId ?? ''));

const radius = computed(() => {
	const el = element.value;
	if (!el) return null;
	const style = el.style as any;
	if (!('radius' in style)) return null;
	const r = style.radius as number | { tl: number; tr: number; br: number; bl: number };
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
	const el = element.value;
	if (!el) return;
	el.style = { ...(el.style as any), radius: next } as any;
}
</script>

<style scoped>
.panel-root { font-family: system-ui, sans-serif; font-size: 12px; color: #e2e8f0; }
.section-title { font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #cbd5e1; border-bottom: 1px solid #1e293b; padding-bottom: 6px; }

.clab { font-size: 10px; color: #94a3b8; text-transform: uppercase; }
.corner { display: flex; align-items: center; gap: 4px; }
.corner-icon { font-size: 14px; line-height: 1; color: #64748b; min-width: 14px; text-align: center; }

/* Number input with steppers */
.num { position: relative; flex: 1 1 auto; }
.num input[type=number] { width: 100%; background: #0f172a; border: 1px solid #334155; color: #e2e8f0; font-size: 11px; padding: 6px 20px 6px 8px; border-radius: 6px; outline: none; }
.steppers { position: absolute; right: 2px; top: 2px; bottom: 2px; display: flex; flex-direction: column; gap: 1px; }
.step { width: 16px; flex: 1 1 0; background: #1f2937; border: 1px solid #334155; color: #e2e8f0; font-size: 9px; line-height: 1; padding: 0; border-radius: 2px; cursor: pointer; }
.step:hover { background: #374151; }

.lock-btn { width: 36px; height: 56px; display: grid; place-items: center; border-radius: 8px; border: 1px solid #334155; background: #1f2937; color: #cbd5e1; cursor: pointer; transition: background 0.15s, border-color 0.15s; }
.lock-btn.active { background: #334155; border-color: #3b82f6; }
.icon { font-size: 14px; }

input[type=number]::-webkit-outer-spin-button,
input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
input[type=number] { -moz-appearance: textfield; }
</style>
