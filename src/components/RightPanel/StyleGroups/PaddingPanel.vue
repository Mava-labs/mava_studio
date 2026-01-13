<template>
	<div class="panel-root flex-1 min-h-0 overflow-hidden">
		<div v-if="!padding" class="text-xs text-slate-500 px-3 py-2">Nothing selected.</div>

		<div v-else class="flex flex-col gap-3 px-3 pb-3">
			<h3 class="text-[11px] font-semibold tracking-[0.14em] text-slate-300 uppercase">Padding</h3>

			<div class="padding-shell">
				<input
					type="number"
					class="pad-input top"
					v-model.number="top"
					aria-label="Top padding"
				/>

				<div class="middle-row">
					<input
						type="number"
						class="pad-input left"
						v-model.number="left"
						aria-label="Left padding"
					/>

					<button type="button" class="lock-btn" :class="{ active: linked }" @click="toggleLinked" aria-label="Toggle padding link">
						<span class="icon">🔒</span>
					</button>

					<input
						type="number"
						class="pad-input right"
						v-model.number="right"
						aria-label="Right padding"
					/>
				</div>

				<input
					type="number"
					class="pad-input bottom"
					v-model.number="bottom"
					aria-label="Bottom padding"
				/>
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

const padding = computed(() => {
	const el = element.value;
	if (!el) return null;
	const style = el.style as any;
	if (!('padding' in style)) return null;
	const p = style.padding as number | { top: number; right: number; bottom: number; left: number };
	if (typeof p === 'number') {
		return { top: p, right: p, bottom: p, left: p };
	}
	return p;
});

const linked = ref(true);

watch(padding, (p) => {
	if (!p) return;
	if (p.top === p.right && p.right === p.bottom && p.bottom === p.left) {
		linked.value = true;
	}
});

const top = computed({ get: () => padding.value?.top ?? 0, set: (val: number) => updatePad('top', val) });
const right = computed({ get: () => padding.value?.right ?? 0, set: (val: number) => updatePad('right', val) });
const bottom = computed({ get: () => padding.value?.bottom ?? 0, set: (val: number) => updatePad('bottom', val) });
const left = computed({ get: () => padding.value?.left ?? 0, set: (val: number) => updatePad('left', val) });

function toggleLinked() {
	linked.value = !linked.value;
	if (linked.value && padding.value) {
		const v = padding.value.top;
		applyPadding({ top: v, right: v, bottom: v, left: v });
	}
}

function updatePad(key: 'top' | 'right' | 'bottom' | 'left', value: number) {
	if (!padding.value) return;
	const nextVal = Math.max(0, value || 0);
	if (linked.value) {
		applyPadding({ top: nextVal, right: nextVal, bottom: nextVal, left: nextVal });
	} else {
		applyPadding({ ...padding.value, [key]: nextVal });
	}
}

function applyPadding(next: { top: number; right: number; bottom: number; left: number }) {
	const el = element.value;
	if (!el) return;
	el.style = { ...(el.style as any), padding: next } as any;
}
</script>

<style scoped>
.panel-root { font-family: system-ui, sans-serif; font-size: 12px; color: #e2e8f0; }
.padding-shell { display: grid; grid-template-rows: auto auto auto; grid-template-columns: 1fr; gap: 8px; align-items: center; justify-items: center; padding: 12px; border-radius: 10px; background: #0f172a; border: 1px solid #1e293b; }
.middle-row { display: grid; grid-template-columns: auto auto auto; align-items: center; gap: 10px; width: 100%; justify-items: center; }
.pad-input { width: 70px; background: #0b1221; color: #f1f5f9; padding: 8px 10px; font-size: 12px; border: 1px solid #27354a; border-radius: 6px; text-align: center; outline: none; }
.lock-btn { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 10px; border: 1px solid #1e293b; background: #0f172a; color: #cbd5e1; cursor: pointer; transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease; }
.lock-btn.active { background: #2563eb; color: #f8fafc; border-color: #2563eb; }
.icon { font-size: 16px; }
</style>
