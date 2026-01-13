<template>
	<div class="panel-root flex-1 min-h-0 overflow-hidden">
		<div v-if="!element" class="text-xs text-slate-500 px-3 py-2">Nothing selected.</div>

		<div v-else class="flex flex-col gap-4 px-3 pb-3">
			<div class="flex items-center justify-between border-b border-slate-800 pb-2">
				<h3 class="text-[11px] font-semibold tracking-[0.14em] text-slate-300 uppercase">Effects</h3>
				<span class="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 uppercase">Live</span>
			</div>

			<div class="effect-row">
				<div class="row-label">Opacity</div>
				<div class="row-controls">
					<input
						type="range"
						min="0"
						max="100"
						step="1"
						class="slider"
						v-model.number="opacityPercent"
						aria-label="Opacity"
					/>
					<div class="value-box">
						<input
							type="number"
							min="0"
							max="100"
							step="1"
							class="value-input"
							v-model.number="opacityPercent"
							aria-label="Opacity percent"
						/>
						<span class="value-suffix">%</span>
					</div>
				</div>
			</div>

			<div class="effect-row">
				<div class="row-label">Blur</div>
				<div class="row-controls">
					<input
						type="range"
						min="0"
						max="40"
						step="1"
						class="slider"
						v-model.number="blurPx"
						aria-label="Blur"
					/>
					<div class="value-box">
						<input
							type="number"
							min="0"
							max="40"
							step="1"
							class="value-input"
							v-model.number="blurPx"
							aria-label="Blur in pixels"
						/>
						<span class="value-suffix">px</span>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts" vapor>
import { computed } from 'vue';
import type { Element } from '../../../types/element';
import { usePagesStore } from '../../../stores/pages';
import { useElementStore } from '../../../stores/element';

const pages = usePagesStore();
const elements = useElementStore();

const element = computed<Element | null>(() => pages.getElementById(elements.activeElementId ?? ''));

const opacityPercent = computed({
	get: () => Math.round(((element.value?.effects.opacity ?? 1) * 100)),
	set: (val: number) => {
		if (!element.value) return;
		const v = Number.isFinite(val) ? Math.min(100, Math.max(0, val)) : 0;
		element.value.effects = { ...element.value.effects, opacity: v / 100 };
	},
});

const blurPx = computed({
	get: () => Math.round(element.value?.effects.blur ?? 0),
	set: (val: number) => {
		if (!element.value) return;
		const v = Number.isFinite(val) ? Math.min(40, Math.max(0, val)) : 0;
		element.value.effects = { ...element.value.effects, blur: v };
	},
});
</script>

<style scoped>
.panel-root { font-family: system-ui, sans-serif; font-size: 12px; color: #e2e8f0; }
.effect-row { display: flex; flex-direction: column; gap: 6px; }
.row-label { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #94a3b8; font-weight: 600; }
.row-controls { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 10px; }
.slider { width: 100%; accent-color: #3b82f6; }
.value-box { display: flex; align-items: center; gap: 6px; background: #0b1221; border: 1px solid #27354a; border-radius: 6px; padding: 4px 8px; min-width: 72px; justify-content: center; }
.value-input { width: 48px; background: transparent; color: #f8fafc; border: none; outline: none; font-size: 12px; text-align: right; }
.value-suffix { font-size: 11px; color: #cbd5e1; }
</style>
