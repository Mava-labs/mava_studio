<template>
	<div class="panel-root flex-1 min-h-0 overflow-hidden">
		<div v-if="!radius" class="text-xs text-slate-500 px-3 py-2">Nothing selected.</div>

		<div v-else class="flex flex-col gap-3 px-3 pb-3">
			<h3 class="text-[11px] font-semibold tracking-[0.14em] text-slate-300 uppercase">Rounded corners</h3>

			<div class="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
				<div class="grid grid-cols-1 gap-2">
					<input
						type="number"
						class="corner-input"
						v-model.number="topLeft"
						aria-label="Top left radius"
					/>
					<input
						type="number"
						class="corner-input"
						v-model.number="bottomLeft"
						aria-label="Bottom left radius"
					/>
				</div>

				<button type="button" class="lock-btn" :class="{ active: linked }" @click="toggleLinked" aria-label="Toggle corner link">
					<span class="icon">🔒</span>
				</button>

				<div class="grid grid-cols-1 gap-2">
					<input
						type="number"
						class="corner-input"
						v-model.number="topRight"
						aria-label="Top right radius"
					/>
					<input
						type="number"
						class="corner-input"
						v-model.number="bottomRight"
						aria-label="Bottom right radius"
					/>
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
.corner-input { width: 100%; background: #0b1221; color: #f1f5f9; padding: 8px 10px; font-size: 12px; border: 1px solid #27354a; border-radius: 6px; outline: none; }
.lock-btn { width: 40px; height: 60px; display: grid; place-items: center; border-radius: 10px; border: 1px solid #1e293b; background: #0f172a; color: #cbd5e1; cursor: pointer; transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease; }
.lock-btn.active { background: #2563eb; color: #f8fafc; border-color: #2563eb; }
.icon { font-size: 16px; }
</style>
