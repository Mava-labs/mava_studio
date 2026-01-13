<template>
	<div class="panel-root flex-1 min-h-0 overflow-hidden">
		<div v-if="!element" class="text-xs text-slate-500 px-3 py-2">Nothing selected.</div>

		<div v-else class="flex flex-col gap-3 px-3 pb-3">
			<div class="flex items-center justify-between border-b border-slate-800 pb-2">
				<h3 class="text-[11px] font-semibold tracking-[0.14em] text-slate-300 uppercase">Transform</h3>
				<span class="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 uppercase">Local</span>
			</div>

			<div class="grid grid-cols-2 gap-2 items-start">
				<div class="input-block">
					<label class="input-label">ScaleX</label>
					<div class="input-shell">
						<input
							type="number"
							step="0.01"
							class="input-field"
							:value="scales.x"
							aria-label="Scale X"
						/>
					</div>
				</div>

				<div class="input-block row-span-2 h-full">
					<label class="input-label">Rotation</label>
					<div class="input-shell">
						<input
							type="number"
							step="1"
							class="input-field"
							:value="rotation"
							aria-label="Rotation"
						/>
					</div>
				</div>

				<div class="input-block">
					<label class="input-label">ScaleY</label>
					<div class="input-shell">
						<input
							type="number"
							step="0.01"
							class="input-field"
							:value="scales.y"
							aria-label="Scale Y"
						/>
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

const scales = computed(() => {
	const t = element.value?.layout.transform;
	return {
		x: t?.scaleX ?? 1,
		y: t?.scaleY ?? 1,
	};
});

const rotation = computed(() => element.value?.layout.transform?.rotation ?? 0);
</script>

<style scoped>
.panel-root { font-family: system-ui, sans-serif; font-size: 12px; color: #e2e8f0; }
.input-block { display: flex; align-items: center; gap: 6px; background: #0f172a; padding: 8px 10px; border-radius: 6px; border: 1px solid #1e293b; height: 100%; }
.input-label { width: 52px; font-weight: 600; font-size: 11px; letter-spacing: 0.08em; color: #cbd5e1; }
.input-shell { flex: 1; display: flex; background: #0b1221; border: 1px solid #27354a; border-radius: 6px; overflow: hidden; }
.input-field { width: 100%; background: transparent; color: #f1f5f9; padding: 6px 10px; font-size: 12px; border: none; outline: none; }
.input-field:disabled { color: #64748b; cursor: not-allowed; }
</style>
