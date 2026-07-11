<template>
    <div class="panel-root flex-1 min-h-0 relative overflow-y-auto thin-scroll overflow-x-hidden flex flex-col gap-4 pb-3">
        <div v-if="element" class="sticky top-0 z-50 bg-slate-900 border-b border-slate-300 dark:border-slate-600 mb-2 px-3">
            <UnifiedToolbar mode="multiselect" :singleStageAlign="true" placement="panel" />
        </div>
        <div v-if="element" class="element-header flex justify-between items-center px-3">
            <button v-if="!isRenaming" aria-label="Edit element name" tabindex="0"
                class="w-[60%] border-b border-dashed text-left name-btn" @click="startRename">
                {{ element.name }}
            </button>
            <input v-else ref="renameInputRef" v-model="renameValue" aria-label="Element name"
                class="w-[60%] name-input"
                @keydown.enter.prevent="confirmRename" @keydown.escape.prevent="cancelRename" @blur="confirmRename" />
            <div class="flex gap-2">
                <svg v-if="element.layout.locked" role="button" tabindex="0" aria-label="Unlock element"
                    aria-pressed="true" class="w-4 h-4 cursor-pointer outline-0 text-gray-800 dark:text-white"
                    aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor"
                    viewBox="0 0 24 24" @click="toggleLocked" @keydown.enter="toggleLocked" @keydown.space.prevent="toggleLocked">
                    <path fill-rule="evenodd"
                        d="M8 10V7a4 4 0 1 1 8 0v3h1a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h1Zm2-3a2 2 0 1 1 4 0v3h-4V7Zm2 6a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0v-3a1 1 0 0 1 1-1Z"
                        clip-rule="evenodd" />
                </svg>
                <svg v-else role="button" tabindex="0" aria-label="Lock element" aria-pressed="true"
                    class="w-4 h-4 cursor-pointer outline-0 text-gray-800 dark:text-white" aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"
                    @click="toggleLocked" @keydown.enter="toggleLocked" @keydown.space.prevent="toggleLocked">
                    <path fill-rule="evenodd"
                        d="M15 7a2 2 0 1 1 4 0v4a1 1 0 1 0 2 0V7a4 4 0 0 0-8 0v3H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2V7Zm-5 6a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0v-3a1 1 0 0 1 1-1Z"
                        clip-rule="evenodd" />
                </svg>

                <svg v-if="element.layout.visible" role="button" tabindex="0" aria-label="Hide element"
                    aria-pressed="true" class="w-4 h-4 cursor-pointer outline-0 text-gray-800 dark:text-white"
                    aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none"
                    viewBox="0 0 24 24" @click="toggleVisible" @keydown.enter="toggleVisible" @keydown.space.prevent="toggleVisible">
                    <path stroke="currentColor" stroke-width="2"
                        d="M21 12c0 1.2-4.03 6-9 6s-9-4.8-9-6c0-1.2 4.03-6 9-6s9 4.8 9 6Z" />
                    <path stroke="currentColor" stroke-width="2" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
                <svg v-else role="button" tabindex="0" aria-label="Show element" aria-pressed="true"
                    class="w-4 h-4 cursor-pointer outline-0 text-gray-800 dark:text-white" aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"
                    @click="toggleVisible" @keydown.enter="toggleVisible" @keydown.space.prevent="toggleVisible">
                    <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M3.933 13.909A4.357 4.357 0 0 1 3 12c0-1 4-6 9-6m7.6 3.8A5.068 5.068 0 0 1 21 12c0 1-3 6-9 6-.314 0-.62-.014-.918-.04M5 19 19 5m-4 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>

                <svg v-if="canMakeComponent" role="button" tabindex="0" aria-label="Make component"
                    title="Make a reusable component from this element"
                    class="w-4 h-4 cursor-pointer outline-0 text-gray-800 dark:text-white hover:text-sky-400" aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"
                    @click="makeComponent" @keydown.enter="makeComponent" @keydown.space.prevent="makeComponent">
                    <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                </svg>

                <svg role="button" tabindex="0" aria-label="Delete element" aria-pressed="true"
                    class="w-4 h-4 cursor-pointer outline-0 text-gray-800 dark:text-white hover:text-red-400" aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"
                    @click="deleteElement" @keydown.enter="deleteElement" @keydown.space.prevent="deleteElement">
                    <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M6 7h12M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2m3 0-.867 12.142A2 2 0 0 1 14.138 21H9.862a2 2 0 0 1-1.995-1.858L7 7" />
                </svg>
            </div>
        </div>

        <div v-if="!element" class="flex-1 min-h-0 h-full overflow-y-auto overflow-x-hidden">
            <ComponentSchemaPanel v-if="isComponentSurface" />
            <PageSettingsPanel v-else />
        </div>

        <template v-else>
            <!--
                Curated panels, composed directly by element kind/type — no more
                routing through a generic property-group guesser. Layout/Transform/
                Effects apply to everything; the rest gate on what the element's
                style shape actually supports.
            -->
            <LayoutPanel />
            <TransformPanel />
            <AutoLayoutPanel v-if="showAutoLayout" />
            <TextPanel v-if="showText" />
            <ImagePanel v-if="showImage" />
            <FillStroke v-if="showFillStroke" />
            <GeometryPanel v-if="showGeometry" />
            <EffectsPanel />
            <RadiusPanel v-if="showRadius" />
            <PaddingPanel v-if="showPadding" />
            <MarginPanel />
            <ShadowPanel />
            <BlurPanel />
        </template>

    </div>
</template>

<script setup lang="ts" vapor>
    import { computed, ref, nextTick, watch } from 'vue';
    import { usePagesStore } from '../../stores/pages';
    import { useElementStore } from '../../stores/element';

    import LayoutPanel from './panels/LayoutPanel.vue';
    import TransformPanel from './panels/TransformPanel.vue';
    import EffectsPanel from './panels/EffectsPanel.vue';
    import TextPanel from './panels/TextPanel.vue';
    import ImagePanel from './panels/ImagePanel.vue';
    import FillStroke from './panels/FillStroke.vue';
    import GeometryPanel from './panels/GeometryPanel.vue';
    import RadiusPanel from './panels/RadiusPanel.vue';
    import PaddingPanel from './panels/PaddingPanel.vue';
    import MarginPanel from './panels/MarginPanel.vue';
    import ShadowPanel from './panels/ShadowPanel.vue';
    import BlurPanel from './panels/BlurPanel.vue';
    import PageSettingsPanel from './panels/PageSettingsPanel.vue';
    import ComponentSchemaPanel from './panels/ComponentSchemaPanel.vue';
    import AutoLayoutPanel from './panels/AutoLayoutPanel.vue';
    import UnifiedToolbar from './UnifiedToolbar.vue';
    import { styleCapabilityMode, hasRadiusCapability, hasPaddingCapability } from '../../utils/elementCapabilities';
    import type { Element } from '../../types/element';

    const pages = usePagesStore();
    const elementStore = useElementStore();

    const element = computed<Element | null>(() =>
        pages.getElementById(elementStore.activeElementId ?? '')
    );

    // Editing a component on the canvas (vs a page) → show its prop-schema
    // editor instead of Page Settings when nothing is selected.
    const isComponentSurface = computed(() => pages.isComponentSurface(pages.activePageId));

    /**
     * The element name here (top of the panel, dashed underline signaling
     * "editable") had `ref="elementNameRef"` and an "Edit element name"
     * aria-label but no click handler and no script-side use of that ref at
     * all — purely decorative, same dead-control shape as the lock/hide
     * icons below (fixed in Phase 3.32) and the delete affordance (3.35).
     * There was no rename UI anywhere else in the app either, so this was a
     * real gap, not a duplicate of some other working control. Mirrors the
     * inline-rename pattern already used in Structure/explorerItem.vue.
     */
    const isRenaming = ref(false);
    const renameValue = ref('');
    const renameInputRef = ref<HTMLInputElement | null>(null);

    async function startRename() {
        if (!element.value) return;
        renameValue.value = element.value.name;
        isRenaming.value = true;
        await nextTick();
        renameInputRef.value?.focus();
        renameInputRef.value?.select();
    }

    function confirmRename() {
        const el = element.value;
        isRenaming.value = false;
        if (!el) return;
        const trimmed = renameValue.value.trim();
        if (trimmed && trimmed !== el.name) {
            elementStore.updateElement(el.id, { name: trimmed });
        }
    }

    function cancelRename() {
        isRenaming.value = false;
    }

    // Selecting a different element mid-rename shouldn't leave the input
    // open editing the wrong element's name.
    watch(() => elementStore.activeElementId, () => { isRenaming.value = false; });

    /**
     * The lock/hide icons here reflected element.layout.locked/visible
     * reactively but had no click handler at all — purely decorative,
     * despite looking exactly like toggle buttons (role="button", hover
     * cursor, aria-pressed). Locked is already enforced everywhere it
     * matters (drag/resize/reorder all skip locked elements); visible:false
     * already resolves to display:none (resolver.ts's resolveDisplay) so a
     * hidden element already doesn't render at all, in both authoring and
     * Preview/publish — these two handlers were the only missing piece.
     */
    function toggleLocked() {
        const el = element.value;
        if (!el) return;
        elementStore.updateElement(el.id, { layout: { locked: !el.layout.locked } });
    }

    function toggleVisible() {
        const el = element.value;
        if (!el) return;
        elementStore.updateElement(el.id, { layout: { visible: !el.layout.visible } });
    }

    /**
     * elementStore.removeElement() was fully built (recursive removal,
     * delete animation, undo entry) but had no way to trigger it anywhere in
     * the app — no keyboard shortcut, no button, nothing. This is the
     * visible affordance; useDeleteSelection.ts (mounted in App.vue) adds
     * Delete/Backspace as the keyboard path for the same action.
     */
    function deleteElement() {
        const el = element.value;
        if (!el) return;
        void elementStore.removeElement(el.id);
    }

    // Offer "make component" on a real page element — not on an existing
    // component instance, and not while editing a component definition.
    const canMakeComponent = computed(() =>
        !!element.value && element.value.kind !== 'component' && !isComponentSurface.value,
    );

    function makeComponent() {
        const el = element.value;
        if (!el) return;
        elementStore.convertToComponent(el.id);
    }

    const showText = computed(() => {
        const el = element.value;
        return !!el && el.kind === 'flatHtml' && (el.type === 'text' || el.type === 'button' || el.type === 'label' || el.type === 'code');
    });

    const showImage = computed(() => element.value?.type === 'image');

    /** Only meaningful for elements that can arrange children (containers/components) —
     *  shown even when currently empty, since the setting applies to whatever gets added. */
    const showAutoLayout = computed(() => {
        const el = element.value;
        return !!el && (el.kind === 'container' || el.kind === 'component');
    });

    /**
     * SVG shapes (fill/stroke), container/input/button-shaped styles
     * (background/border), or any composite/group with children — FillStroke.vue
     * also lists per-child fills for the latter, and no-ops its own section if
     * `mode` doesn't apply. Gated by type capability, not key presence — see
     * elementCapabilities.ts.
     */
    const showFillStroke = computed(() => {
        const el = element.value as any;
        if (!el) return false;
        if (styleCapabilityMode(element.value) !== null) return true;
        return Array.isArray(el.children) && el.children.length > 0;
    });

    const showGeometry = computed(() => element.value?.kind === 'svg');

    const showRadius = computed(() => hasRadiusCapability(element.value));

    const showPadding = computed(() => hasPaddingCapability(element.value));
</script>

<style scoped>
    .panel-root {
        font-family: system-ui, sans-serif;
        font-size: 12px;
        color: #e2e8f0;
    }

    .element-header {
        font-weight: 600;
        font-size: 13px;
    }

    .name-btn {
        cursor: text;
        border-color: #475569;
        background: transparent;
        color: inherit;
    }

    .name-input {
        background: transparent;
        border: none;
        border-bottom: 1px solid #3b82f6;
        color: inherit;
        font: inherit;
        outline: none;
        padding: 0;
    }
</style>