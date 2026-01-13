<template>
	<div class="panel-root flex-1 min-h-0 overflow-hidden">
		<div v-if="!shapeStyle" class="text-xs text-slate-500 px-3 py-2">Nothing selected.</div>

		<div v-else class="flex flex-col gap-3 px-3 pb-4">
			<div class="flex items-center justify-between border-b border-slate-800 pb-2">
				<h3 class="text-[11px] font-semibold tracking-[0.14em] text-slate-300 uppercase">Fills &amp; Strokes</h3>
				<span class="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 uppercase">Style</span>
			</div>

			<div class="input-block">
				<label class="input-label">Fill</label>
				<input
					type="color"
					class="color-input"
					v-model="fillColor"
					aria-label="Fill color"
				/>
			</div>

			<div class="input-block">
				<label class="input-label">Stroke</label>
				<div class="grid grid-cols-[auto_1fr] gap-2 items-center w-full">
					<input
						type="color"
						class="color-input"
						v-model="strokeColor"
						aria-label="Stroke color"
					/>
					<div class="grid grid-cols-[1fr_1fr] gap-2">
						<input
							type="number"
							min="0"
							step="0.5"
							class="input-field"
							v-model.number="strokeWidth"
							aria-label="Stroke width"
						/>
						<select class="input-field" v-model="strokeStyle" aria-label="Stroke style">
							<option value="solid">Solid</option>
							<option value="dashed">Dashed</option>
							<option value="dotted">Dotted</option>
						</select>
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

type StrokeStyle = 'solid' | 'dashed' | 'dotted';
type ShapeStyleLite = {
	fill?: string;
	stroke?: {
		color: string;
		width: number;
		style?: StrokeStyle;
		sides?: { top: boolean; right: boolean; bottom: boolean; left: boolean };
	};
};

const pages = usePagesStore();
const elements = useElementStore();

const element = computed<Element | null>(() => pages.getElementById(elements.activeElementId ?? ''));

const shapeStyle = computed<ShapeStyleLite | null>(() => {
	const el = element.value;
	if (!el) return null;
	const style = el.style as any;
	if ('stroke' in style || 'fill' in style || 'sides' in style) return style as ShapeStyleLite;
	return null;
});

const fillColor = computed({
	get: () => shapeStyle.value?.fill ?? '#000000',
	set: (val: string) => updateStyle({ fill: val || '#000000' }),
});

const strokeColor = computed({
	get: () => shapeStyle.value?.stroke?.color ?? '#000000',
	set: (val: string) => updateStroke({ color: val || '#000000' }),
});

const strokeWidth = computed({
	get: () => shapeStyle.value?.stroke?.width ?? 1,
	set: (val: number) => updateStroke({ width: Math.max(0, val || 0) }),
});

const strokeStyle = computed({
	get: () => shapeStyle.value?.stroke?.style ?? 'solid',
	set: (val: StrokeStyle) => updateStroke({ style: val }),
});

function updateStyle(patch: Partial<ShapeStyleLite>) {
	const el = element.value;
	if (!el || !shapeStyle.value) return;
	const nextStroke = patch.stroke ? { ...(shapeStyle.value.stroke ?? { color: '#000000', width: 1 }), ...patch.stroke } : shapeStyle.value.stroke;
	el.style = { ...shapeStyle.value, ...patch, stroke: nextStroke } as any;
}

function updateStroke(patch: Partial<NonNullable<ShapeStyleLite['stroke']>>) {
	const base = { color: shapeStyle.value?.stroke?.color ?? '#000000', width: shapeStyle.value?.stroke?.width ?? 1 };
	updateStyle({ stroke: { ...base, ...patch } });
}
</script>

<style scoped>
.panel-root { font-family: system-ui, sans-serif; font-size: 12px; color: #e2e8f0; }
.input-block { display: flex; flex-direction: column; gap: 6px; background: #0f172a; padding: 10px 10px; border-radius: 6px; border: 1px solid #1e293b; }
.input-label { font-weight: 600; font-size: 11px; letter-spacing: 0.08em; color: #cbd5e1; text-transform: uppercase; }
.input-field { width: 100%; background: #0b1221; color: #f1f5f9; padding: 8px 10px; font-size: 12px; border: 1px solid #27354a; border-radius: 6px; outline: none; }
.color-input { width: 100%; height: 36px; padding: 4px 6px; background: #0b1221; border: 1px solid #27354a; border-radius: 6px; }
</style>
