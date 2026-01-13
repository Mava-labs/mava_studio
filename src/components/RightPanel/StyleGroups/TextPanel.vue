<template>
	<div class="panel-root flex-1 min-h-0 overflow-hidden">
		<div v-if="!textStyle" class="text-xs text-slate-500 px-3 py-2">Nothing selected.</div>

		<div v-else class="flex flex-col gap-3 px-3 pb-4">
			<h3 class="text-[11px] font-semibold tracking-[0.14em] text-slate-300 uppercase">Text</h3>

			<div class="grid grid-cols-2 gap-2">
				<div class="input-block">
					<label class="input-label">Font family</label>
					<input
						type="text"
						class="input-field"
						v-model="fontFamily"
						aria-label="Font family"
						placeholder="Font family"
					/>
				</div>

				<div class="input-block">
					<label class="input-label">Size</label>
					<input
						type="number"
						min="1"
						class="input-field"
						v-model.number="fontSize"
						aria-label="Font size"
					/>
				</div>

				<div class="input-block">
					<label class="input-label">Color</label>
					<input
						type="color"
						class="input-field color-input"
						v-model="fontColor"
						aria-label="Font color"
					/>
				</div>

				<div class="input-block">
					<label class="input-label">Weight</label>
					<select class="input-field" v-model="fontWeight" aria-label="Font weight">
						<option :value="'normal'">Regular</option>
						<option :value="500">Medium</option>
						<option :value="600">Semibold</option>
						<option :value="700">Bold</option>
					</select>
				</div>

				<div class="input-block">
					<label class="input-label">Transform</label>
					<select class="input-field" v-model="textTransform" aria-label="Text transform">
						<option :value="'Normal'">Normal</option>
						<option :value="'uppercase'">Uppercase</option>
						<option :value="'lowercase'">Lowercase</option>
						<option :value="'capitalize'">Capitalized</option>
					</select>
				</div>

				<div class="input-block">
					<label class="input-label">Line height</label>
					<input
						type="number"
						step="0.1"
						min="0"
						class="input-field"
						v-model.number="lineHeight"
						aria-label="Line height"
					/>
				</div>

				<div class="input-block">
					<label class="input-label">Letter spacing</label>
					<input
						type="number"
						step="0.1"
						class="input-field"
						v-model.number="letterSpacing"
						aria-label="Letter spacing"
					/>
				</div>
			</div>

			<div class="toolbar">
				<div class="btn-group">
					<button type="button" class="tool-btn" :class="{ active: textAlign === 'left' }" @click="() => setAlign('left')" aria-label="Align left">⇤</button>
					<button type="button" class="tool-btn" :class="{ active: textAlign === 'center' }" @click="() => setAlign('center')" aria-label="Align center">⇌</button>
					<button type="button" class="tool-btn" :class="{ active: textAlign === 'right' }" @click="() => setAlign('right')" aria-label="Align right">⇥</button>
				</div>
				<div class="btn-group">
					<button type="button" class="tool-btn" :class="{ active: fontStyle === 'italic' }" @click="toggleStyle" aria-label="Italic">𝘐</button>
					<button type="button" class="tool-btn" :class="{ active: decoration === 'underline' }" @click="() => setDecoration('underline')" aria-label="Underline">U</button>
					<button type="button" class="tool-btn" :class="{ active: decoration === 'line-through' }" @click="() => setDecoration('line-through')" aria-label="Strikethrough">S</button>
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

const textStyle = computed(() => {
	const el = element.value;
	if (!el || el.type !== 'text') return null;
	return el.style;
});

const fontFamily = computed({
	get: () => textStyle.value?.font.family ?? '',
	set: (val: string) => updateStyle({ font: { ...(textStyle.value?.font ?? { size: 16 }), family: val } }),
});

const fontSize = computed({
	get: () => textStyle.value?.font.size ?? 16,
	set: (val: number) => updateStyle({ font: { ...(textStyle.value?.font ?? { size: 16 }), size: Math.max(1, val || 1) } }),
});

const fontWeight = computed({
	get: () => textStyle.value?.font.weight ?? 'normal',
	set: (val: number | 'normal' | 'bold') => updateStyle({ font: { ...(textStyle.value?.font ?? { size: 16 }), weight: val } }),
});

const fontColor = computed({
	get: () => textStyle.value?.color ?? '#ffffff',
	set: (val: string) => updateStyle({ color: val || '#ffffff' }),
});

const textTransform = computed({
	get: () => textStyle.value?.transform ?? 'Normal',
	set: (val: any) => updateStyle({ transform: val }),
});

const lineHeight = computed({
	get: () => textStyle.value?.lineHeight ?? 1.4,
	set: (val: number) => updateStyle({ lineHeight: val || 1 }),
});

const letterSpacing = computed({
	get: () => textStyle.value?.letterSpacing ?? 0,
	set: (val: number) => updateStyle({ letterSpacing: val || 0 }),
});

const textAlign = computed(() => textStyle.value?.align ?? 'left');
const fontStyle = computed(() => textStyle.value?.font.style ?? 'normal');
const decoration = computed(() => textStyle.value?.decoration ?? undefined);

function setAlign(align: 'left' | 'center' | 'right') {
	updateStyle({ align });
}

function toggleStyle() {
	const next = fontStyle.value === 'italic' ? 'normal' : 'italic';
	updateStyle({ font: { ...(textStyle.value?.font ?? { size: 16 }), style: next } });
}

function setDecoration(val: 'underline' | 'line-through') {
	const current = decoration.value;
	const next = current === val ? undefined : val;
	updateStyle({ decoration: next });
}

type TextStyleShape = NonNullable<typeof textStyle.value>;

function updateStyle(patch: Partial<TextStyleShape> & { font?: Partial<TextStyleShape['font']> }) {
	const el = element.value;
	if (!el || el.type !== 'text' || !textStyle.value) return;
	const nextFont = patch.font ? { ...textStyle.value.font, ...patch.font } : textStyle.value.font;
	const next = { ...textStyle.value, ...patch, font: nextFont } as typeof textStyle.value;
	el.style = next;
}
</script>

<style scoped>
.panel-root { font-family: system-ui, sans-serif; font-size: 12px; color: #e2e8f0; }
.input-block { display: flex; flex-direction: column; gap: 4px; background: #0f172a; padding: 8px 10px; border-radius: 6px; border: 1px solid #1e293b; }
.input-label { font-weight: 600; font-size: 11px; letter-spacing: 0.08em; color: #cbd5e1; }
.input-field { width: 100%; background: #0b1221; color: #f1f5f9; padding: 8px 10px; font-size: 12px; border: 1px solid #27354a; border-radius: 6px; outline: none; }
.color-input { padding: 4px 6px; height: 36px; }
.toolbar { display: flex; align-items: center; gap: 10px; }
.btn-group { display: inline-flex; background: #0f172a; border: 1px solid #1e293b; border-radius: 8px; overflow: hidden; }
.tool-btn { padding: 6px 10px; color: #e2e8f0; background: transparent; border: none; cursor: pointer; font-size: 12px; min-width: 32px; }
.tool-btn:hover { background: #1e293b; }
.tool-btn.active { background: #2563eb; color: #f8fafc; }
</style>
