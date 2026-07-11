<template>
    <div class="panel-root px-3">
        <h3 class="section-title mb-3">Text</h3>

        <div class="flex flex-col gap-2">
            <!-- Content: double-click the element on canvas to edit in place;
                 this is the fallback for elements too small/awkward to reach that way. -->
            <div class="field-col">
                <span class="clab">Content</span>
                <textarea class="sel content-area" rows="2" :value="content"
                    @change="setContent(($event.target as HTMLTextAreaElement).value)"
                    aria-label="Text content" />
            </div>

            <div v-if="isPlainText" class="field-col">
                <span class="clab">Tag</span>
                <div class="seg5" role="group" aria-label="Text tag">
                    <button type="button" class="seg5-btn" :class="{ selected: textTag === 'p' }" title="Paragraph — block text" @click="setTextTag('p')">P</button>
                    <button type="button" class="seg5-btn" :class="{ selected: textTag === 'span' }" title="Span — inline text, width follows content" @click="setTextTag('span')">Span</button>
                    <button type="button" class="seg5-btn" :class="{ selected: textTag === 'h1' }" title="Heading 1" @click="setTextTag('h1')">H1</button>
                    <button type="button" class="seg5-btn" :class="{ selected: textTag === 'h2' }" title="Heading 2" @click="setTextTag('h2')">H2</button>
                    <button type="button" class="seg5-btn" :class="{ selected: textTag === 'h3' }" title="Heading 3" @click="setTextTag('h3')">H3</button>
                </div>
            </div>

            <!-- Row 1: Font family + size -->
            <div class="row">
                <div class="field">
                    <!-- <span class="clab">Family</span> -->
                    <select class="sel" :value="fontFamily"
                        @change="setFontFamily(($event.target as HTMLSelectElement).value)">
                        <option value="">Default</option>
                        <option value="system-ui">System UI</option>
                        <option value="Georgia, serif">Georgia</option>
                        <option value="ui-monospace, monospace">Monospace</option>
                    </select>
                </div>
                <div class="field">
                    <!-- <span class="clab">Size</span> -->
                    <div class="num">
                        <input type="number" min="1" :value="fontSize"
                            @change="setFontSize(+($event.target as HTMLInputElement).value)" />
                        <span class="unit">px</span>
                        <div class="steppers">
                            <button class="step" type="button"
                                @click="setFontSize(Math.max(1, fontSize + 1))">▴</button>
                            <button class="step" type="button"
                                @click="setFontSize(Math.max(1, fontSize - 1))">▾</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Row 2: Weight + Transform -->
            <div class="row">
                <div class="field">
                    <!-- <span class="clab">Weight</span> -->
                    <select class="sel" :value="fontWeight"
                        @change="setFontWeight(($event.target as HTMLSelectElement).value as any)">
                        <option value="normal">Regular</option>
                        <option :value="500">Medium</option>
                        <option :value="600">Semibold</option>
                        <option :value="700">Bold</option>
                    </select>
                </div>
                <div class="field">
                    <div class="seg case-seg" role="group" aria-label="Text case">
                        <button type="button" class="seg-btn case-btn" :class="{ selected: textTransform === 'uppercase' }"
                            title="Uppercase" aria-label="Uppercase" @click="toggleTransform('uppercase')">AA</button>
                        <button type="button" class="seg-btn case-btn" :class="{ selected: textTransform === 'capitalize' }"
                            title="Capitalize" aria-label="Capitalize" @click="toggleTransform('capitalize')">Aa</button>
                        <button type="button" class="seg-btn case-btn" :class="{ selected: textTransform === 'lowercase' }"
                            title="Lowercase" aria-label="Lowercase" @click="toggleTransform('lowercase')">aa</button>
                    </div>
                </div>
            </div>

            <!-- Row 3: Line height + Letter spacing -->
            <div class="row">
                <div class="field space-x-1.5 border p-1 rounded border-gray-600">
                    <span class="clab-special font-semibold text-gray-600">Height</span>
                    <div class="num-special">
                        <input type="number" step="0.1" min="0" :value="lineHeight"
                            @change="setLineHeight(+($event.target as HTMLInputElement).value)" />
                        <div class="steppers-special">
                            <button class="step" type="button"
                                @click="setLineHeight(+(lineHeight + 0.1).toFixed(2))">▴</button>
                            <button class="step" type="button"
                                @click="setLineHeight(Math.max(0, +(lineHeight - 0.1).toFixed(2)))">▾</button>
                        </div>
                    </div>
                </div>
                <div class="field space-x-1.5 border p-1 rounded border-gray-600">
                    <span class="clab-special font-semibold text-gray-600">Spacing</span>
                    <div class="num-special">
                        <input type="number" step="0.1" :value="letterSpacing"
                            @change="setLetterSpacing(+($event.target as HTMLInputElement).value)" />
                        <div class="steppers-special">
                            <button class="step" type="button"
                                @click="setLetterSpacing(+(letterSpacing + 0.1).toFixed(2))">▴</button>
                            <button class="step" type="button"
                                @click="setLetterSpacing(+(letterSpacing - 0.1).toFixed(2))">▾</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Row 4: Color -->
            <div class="prop-row">
                <span class="clab">Color</span>
                <button type="button" class="color-chip" :style="{ background: fontColor }"
                    @click="pickColor(fontColor, setFontColor)" aria-label="Text color" />
            </div>

            <!-- Row 5: Alignment + style buttons -->
            <div class="toolbar mt-1">
                <div class="seg" role="group" aria-label="Text align">
                    <button type="button" class="seg-btn" :class="{ selected: textAlign === 'left' }"
                        @click="setAlign('left')" aria-label="Left">
                        <svg class="w-4.5 h-4.5 text-gray-800 dark:text-white" aria-hidden="true"
                            xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M6 6h8m-8 4h12M6 14h8m-8 4h12" />
                        </svg>
                    </button>
                    <button type="button" class="seg-btn" :class="{ selected: textAlign === 'center' }"
                        @click="setAlign('center')" aria-label="Center">
                        <svg class="w-4.5 h-4.5 text-gray-800 dark:text-white" aria-hidden="true"
                            xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M8 6h8M6 10h12M8 14h8M6 18h12" />
                        </svg>
                    </button>
                    <button type="button" class="seg-btn" :class="{ selected: textAlign === 'justify' }"
                        @click="setAlign('justify')" aria-label="Justify">
                        <svg class="w-4.5 h-4.5 text-gray-800 dark:text-white" aria-hidden="true"
                            xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M18 6H6m12 4H6m12 4H6m12 4H6" />
                        </svg>
                    </button>
                    <button type="button" class="seg-btn" :class="{ selected: textAlign === 'right' }"
                        @click="setAlign('right')" aria-label="Right">
                        <svg class="w-4.5 h-4.5 text-gray-800 dark:text-white" aria-hidden="true"
                            xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M18 6h-8m8 4H6m12 4h-8m8 4H6" />
                        </svg>
                    </button>
                    <button type="button" class="seg-btn" :class="{ selected: fontStyle === 'italic' }"
                        @click="toggleItalic" aria-label="Italic" style="font-style:italic;font-family:serif">
                        <svg class="w-4.5 h-4.5 text-gray-800 dark:text-white" aria-hidden="true"
                            xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="m8.874 19 6.143-14M6 19h6.33m-.66-14H18" />
                        </svg>
                    </button>
                    <button type="button" class="seg-btn" :class="{ selected: decoration === 'underline' }"
                        @click="toggleDecoration('underline')" aria-label="Underline" style="text-decoration:underline">
                        <svg class="w-4.5 h-4.5 text-gray-800 dark:text-white" aria-hidden="true"
                            xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                            <path stroke="currentColor" stroke-linecap="round" stroke-width="2"
                                d="M5 19h14M7.6 16l4.2979-10.92963c.0368-.09379.1674-.09379.2042 0L16.4 16m-8.8 0H6.5m1.1 0h1.65m7.15 0h-1.65m1.65 0h1.1m-8.33315-4h5.66025" />
                        </svg>
                    </button>
                    <button type="button" class="seg-btn" :class="{ selected: decoration === 'line-through' }"
                        @click="toggleDecoration('line-through')" aria-label="Strikethrough"
                        style="text-decoration:line-through">
                        <svg class="w-4.5 h-4.5 text-gray-800 dark:text-white" aria-hidden="true"
                            xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24"
                            fill="currentColor">
                            <path d="M0 0h24v24H0z" fill="none" />
                            <path stroke="none"
                                d="M7.24 8.75c-.26-.48-.39-1.03-.39-1.67 0-.61.13-1.16.4-1.67.26-.5.63-.93 1.11-1.29.48-.35 1.05-.63 1.7-.83.66-.19 1.39-.29 2.18-.29.81 0 1.54.11 2.21.34.66.22 1.23.54 1.69.94.47.4.83.88 1.08 1.43s.38 1.15.38 1.81h-3.01c0-.31-.05-.59-.15-.85-.09-.27-.24-.49-.44-.68-.2-.19-.45-.33-.75-.44-.3-.1-.66-.16-1.06-.16-.39 0-.74.04-1.03.13s-.53.21-.72.36c-.19.16-.34.34-.44.55-.1.21-.15.43-.15.66 0 .48.25.88.74 1.21.38.25.77.48 1.41.7H7.39c-.05-.08-.11-.17-.15-.25zM21 12v-2H3v2h9.62c.18.07.4.14.55.2.37.17.66.34.87.51s.35.36.43.57c.07.2.11.43.11.69 0 .23-.05.45-.14.66-.09.2-.23.38-.42.53-.19.15-.42.26-.71.35-.29.08-.63.13-1.01.13-.43 0-.83-.04-1.18-.13s-.66-.23-.91-.42c-.25-.19-.45-.44-.59-.75s-.25-.76-.25-1.21H6.4c0 .55.08 1.13.24 1.58s.37.85.65 1.21c.28.35.6.66.98.92.37.26.78.48 1.22.65.44.17.9.3 1.38.39.48.08.96.13 1.44.13.8 0 1.53-.09 2.18-.28s1.21-.45 1.67-.79c.46-.34.82-.77 1.07-1.27s.38-1.07.38-1.71c0-.6-.1-1.14-.31-1.61-.05-.11-.11-.23-.17-.33H21V12z" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts" vapor>
    import { computed } from 'vue';
    import { useActiveElement } from '../../../composables/useActiveElement';
    import { useNativeColorPicker } from '../../../composables/useNativeColorPicker';
    import type { TextStyle } from '../../../types/element';

    const { element, update } = useActiveElement();
    const { pickColor } = useNativeColorPicker();

    const ts = computed(() => {
        const el = element.value;
        if (!el || (el.type !== 'text' && el.type !== 'button' && el.type !== 'label' && el.type !== 'code')) return null;
        return el.style as TextStyle;
    });

    const content = computed(() => ts.value?.content ?? '');
    function setContent(v: string) { update({ style: { content: v } }); }

    const isPlainText = computed(() => element.value?.type === 'text');
    const textTag = computed(() => element.value?.layout.textTag ?? 'p');
    function setTextTag(v: 'p' | 'span' | 'h1' | 'h2' | 'h3') { update({ layout: { textTag: v } }); }

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
    /** Icon buttons toggle like the Bold/Italic pattern: clicking the active case turns it back off (Normal). */
    function toggleTransform(v: 'uppercase' | 'capitalize' | 'lowercase') {
        setTextTransform(textTransform.value === v ? 'normal' : v);
    }
    function setLineHeight(v: number) { update({ style: { lineHeight: v || 1 } }); }
    function setLetterSpacing(v: number) { update({ style: { letterSpacing: v || 0 } }); }
    function setAlign(v: 'left' | 'center' | 'right' | 'justify') { update({ style: { align: v } }); }
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

    .clab {
        font-size: 10px;
        color: #94a3b8;
        text-transform: uppercase;
        min-width: 34px;
    }

    .clab-special {
        font-size: 10px;
        text-transform: uppercase;
        min-width: 34px;
    }

    .row {
        display: flex;
        gap: 8px;
    }

    .field {
        display: flex;
        align-items: center;
        gap: 6px;
        flex: 1 1 0;
        min-width: 0;
    }

    .field-col {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .content-area {
        resize: vertical;
        min-height: 40px;
        font-family: inherit;
    }

    .checkbox-row {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        color: #cbd5e1;
    }

    .prop-row {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    /* Number input with steppers */
    .num {
        position: relative;
        flex: 1 1 auto;
        min-width: 0;
    }

    .num-special {
        position: relative;
        min-width: 0;
        flex: 1 1 auto
    }

    .num input[type=number] {
        width: 100%;
        background: #0f172a;
        border: 1px solid #334155;
        color: #e2e8f0;
        font-size: 11px;
        padding: 5px 20px 5px 8px;
        border-radius: 6px;
        outline: none;
    }

    .num-special input[type=number] {
        width: 100%;
        outline: none;
    }

    .unit {
        position: absolute;
        right: 22px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 10px;
        color: #94a3b8;
        pointer-events: none;
    }

    .steppers {
        position: absolute;
        right: 2px;
        top: 2px;
        bottom: 2px;
        display: flex;
        flex-direction: column;
        gap: 1px;
    }

    .steppers-special {
        position: absolute;
        right: 2px;
        top: -2px;
        display: flex;
        flex-direction: column;
        gap: 1px;
    }

    .step {
        width: 16px;
        flex: 1 1 0;
        background: #1f2937;
        border: 1px solid #334155;
        color: #e2e8f0;
        font-size: 9px;
        line-height: 1;
        padding: 0;
        border-radius: 2px;
        cursor: pointer;
    }

    .step:hover {
        background: #374151;
    }

    .sel {
        flex: 1 1 auto;
        min-width: 0;
        background: #0f172a;
        border: 1px solid #334155;
        color: #e2e8f0;
        font-size: 11px;
        padding: 5px 6px;
        border-radius: 6px;
        outline: none;
    }

    .color-chip {
        flex: 1 1 auto;
        height: 28px;
        padding: 0 1px;
        background: #0f172a;
        border: 1px solid #334155;
        border-radius: 6px;
        cursor: pointer;
    }

    /* Segmented buttons */
    .toolbar {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .seg {
        display: inline-flex;
        gap: 2px;
        /* background: #1e293b; */
        /* border: 1px solid #334155; */
        border-radius: 6px;
        padding: 2px;
    }

    .seg-btn {
        background: transparent;
        border: none;
        color: #e2e8f0;
        padding: 4px 6px;
        cursor: pointer;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .seg-btn:hover {
        background: #334155;
    }

    .seg-btn.selected {
        background: #334155;
        color: #f8fafc;
    }

    .case-seg {
        width: 100%;
        border: 1px solid #334155;
        border-radius: 6px;
        padding: 2px;
    }

    .case-btn {
        flex: 1 1 0;
        font-size: 10px;
        font-weight: 600;
        padding: 4px 0;
    }

    .seg5 { display: flex; border: 1px solid #334155; border-radius: 6px; overflow: hidden; }
    .seg5-btn { flex: 1 1 0; background: #0f172a; border: none; color: #94a3b8; font-size: 10px; padding: 5px 0; cursor: pointer; }
    .seg5-btn:hover { background: #1f2937; }
    .seg5-btn.selected { background: #334155; color: #f8fafc; }
    .seg5-btn + .seg5-btn { border-left: 1px solid #334155; }

    input[type=number]::-webkit-outer-spin-button,
    input[type=number]::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }

    /* input[type=number] { -moz-appearance: textfield; } */
</style>