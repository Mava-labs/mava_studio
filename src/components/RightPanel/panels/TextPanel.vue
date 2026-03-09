<template>
    <div class="panel-root px-3">
        <h3 class="section-title mb-3">Text</h3>

        <div class="grid grid-cols-2 gap-2">
            <div class="input-block">
                <label class="input-label">Family</label>
                <input type="text" class="input-field" :value="fontFamily"
                    @change="setFontFamily(($event.target as HTMLInputElement).value)" placeholder="Font family" />
            </div>

            <div class="input-block">
                <label class="input-label">Size</label>
                <input type="number" min="1" class="input-field" :value="fontSize"
                    @change="setFontSize(+($event.target as HTMLInputElement).value)" />
            </div>

            <div class="input-block">
                <label class="input-label">Color</label>
                <input type="color" class="input-field color-input" :value="fontColor"
                    @input="setFontColor(($event.target as HTMLInputElement).value)" />
            </div>

            <div class="input-block">
                <label class="input-label">Weight</label>
                <select class="input-field" :value="fontWeight"
                    @change="setFontWeight(($event.target as HTMLSelectElement).value as any)">
                    <option value="normal">Regular</option>
                    <option :value="500">Medium</option>
                    <option :value="600">Semibold</option>
                    <option :value="700">Bold</option>
                </select>
            </div>

            <div class="input-block">
                <label class="input-label">Transform</label>
                <select class="input-field" :value="textTransform"
                    @change="setTextTransform(($event.target as HTMLSelectElement).value as any)">
                    <option value="normal">Normal</option>
                    <option value="uppercase">Uppercase</option>
                    <option value="lowercase">Lowercase</option>
                    <option value="capitalize">Capitalize</option>
                </select>
            </div>

            <div class="input-block">
                <label class="input-label">Line height</label>
                <input type="number" step="0.1" min="0" class="input-field" :value="lineHeight"
                    @change="setLineHeight(+($event.target as HTMLInputElement).value)" />
            </div>

            <div class="input-block">
                <label class="input-label">Spacing</label>
                <input type="number" step="0.1" class="input-field" :value="letterSpacing"
                    @change="setLetterSpacing(+($event.target as HTMLInputElement).value)" />
            </div>
        </div>

        <div class="toolbar mt-3">
            <div class="btn-group">
                <button type="button" class="tool-btn" :class="{ active: textAlign === 'left' }"
                    @click="setAlign('left')" aria-label="Left">⇤</button>
                <button type="button" class="tool-btn" :class="{ active: textAlign === 'center' }"
                    @click="setAlign('center')" aria-label="Center">⇌</button>
                <button type="button" class="tool-btn" :class="{ active: textAlign === 'right' }"
                    @click="setAlign('right')" aria-label="Right">⇥</button>
            </div>
            <div class="btn-group">
                <button type="button" class="tool-btn" :class="{ active: fontStyle === 'italic' }" @click="toggleItalic"
                    aria-label="Italic">𝘐</button>
                <button type="button" class="tool-btn" :class="{ active: decoration === 'underline' }"
                    @click="toggleDecoration('underline')" aria-label="Underline">U</button>
                <button type="button" class="tool-btn" :class="{ active: decoration === 'line-through' }"
                    @click="toggleDecoration('line-through')" aria-label="Strikethrough">S</button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts" vapor>
    import { computed } from 'vue';
    import { useActiveElement } from '../../../composables/useActiveElement';
    import type { TextStyle } from '../../../types/element';

    const { element, update } = useActiveElement();

    const ts = computed(() => {
        const el = element.value;
        if (!el || (el.type !== 'text' && el.type !== 'button' && el.type !== 'label')) return null;
        return el.style as TextStyle;
    });

    const fontFamily = computed(() => ts.value?.font.family ?? '');
    const fontSize = computed(() => ts.value?.font.size ?? 16);
    const fontColor = computed(() => ts.value?.color ?? '#ffffff');
    const fontWeight = computed(() => ts.value?.font.weight ?? 'normal');
    const textTransform = computed(() => ts.value?.transform ?? 'normal');
    const lineHeight = computed(() => ts.value?.lineHeight ?? 1.4);
    const letterSpacing = computed(() => ts.value?.letterSpacing ?? 0);
    const textAlign = computed(() => ts.value?.align ?? 'left');
    const fontStyle = computed(() => ts.value?.font.style ?? 'normal');
    const decoration = computed(() => ts.value?.decoration ?? 'none');

    function font(patch: Partial<TextStyle['font']>) {
        if (!ts.value) return;
        update({ style: { font: { ...ts.value.font, ...patch } } });
    }

    function setFontFamily(v: string) { font({ family: v }); }
    function setFontSize(v: number) { font({ size: Math.max(1, v || 1) }); }
    function setFontWeight(v: any) { font({ weight: v }); }
    function setFontColor(v: string) { update({ style: { color: v || '#ffffff' } }); }
    function setTextTransform(v: any) { update({ style: { transform: v } }); }
    function setLineHeight(v: number) { update({ style: { lineHeight: v || 1 } }); }
    function setLetterSpacing(v: number) { update({ style: { letterSpacing: v || 0 } }); }
    function setAlign(v: 'left' | 'center' | 'right') { update({ style: { align: v } }); }
    function toggleItalic() { font({ style: fontStyle.value === 'italic' ? 'normal' : 'italic' }); }
    function toggleDecoration(v: 'underline' | 'line-through') {
        update({ style: { decoration: decoration.value === v ? 'none' : v } });
    }
</script>

<style scoped>
    .panel-root {
        font-family: system-ui, sans-serif;
        font-size: 12px;
        color: #e2e8f0;
    }

    .section-title {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #cbd5e1;
        border-bottom: 1px solid #1e293b;
        padding-bottom: 6px;
    }

    .input-block {
        display: flex;
        flex-direction: column;
        gap: 4px;
        background: #0f172a;
        padding: 8px 10px;
        border-radius: 6px;
        border: 1px solid #1e293b;
    }

    .input-label {
        font-weight: 600;
        font-size: 11px;
        letter-spacing: 0.08em;
        color: #cbd5e1;
    }

    .input-field {
        width: 100%;
        background: #0b1221;
        color: #f1f5f9;
        padding: 8px 10px;
        font-size: 12px;
        border: 1px solid #27354a;
        border-radius: 6px;
        outline: none;
    }

    .color-input {
        padding: 4px 6px;
        height: 36px;
    }

    .toolbar {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .btn-group {
        display: inline-flex;
        background: #0f172a;
        border: 1px solid #1e293b;
        border-radius: 8px;
        overflow: hidden;
    }

    .tool-btn {
        padding: 6px 10px;
        color: #e2e8f0;
        background: transparent;
        border: none;
        cursor: pointer;
        font-size: 12px;
        min-width: 32px;
    }

    .tool-btn:hover {
        background: #1e293b;
    }

    .tool-btn.active {
        background: #2563eb;
        color: #f8fafc;
    }
</style>