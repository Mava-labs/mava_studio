/**
 * stage.ts
 * Pinia store — view mode router + canvas interaction state.
 *
 * Responsibilities:
 *   - StageKey routing (empty → home, create → page canvas, template, animate)
 *   - Zoom level and pan offset for the canvas
 *   - Canvas interaction mode (select, pan, draw etc.)
 *   - Active component editor tab (for isolated component editing)
 *
 * NOT responsible for:
 *   - Page content / elements      → pagesStore / elementStore
 *   - Selection state              → elementStore
 *   - Project metadata             → projectMetadata store
 */

import { defineStore } from 'pinia';
import { ref, computed, readonly } from 'vue';
import { tauriStorage } from '../utils/tauriStorage';

/* ============================================================
   TYPES
   ============================================================ */

export type StageKey = 'empty' | 'create' | 'template' | 'animate';

/**
 * What the cursor/tool is doing on the canvas.
 * 'select'  — default pointer, click to select elements
 * 'pan'     — hand tool, drag to pan the canvas
 * 'draw'    — actively placing a new element (after insert panel click)
 * 'text'    — inline text editing active
 * 'resize'  — drag handle active
 */
export type CanvasMode = 'select' | 'pan' | 'draw' | 'text' | 'resize';

/** Zoom constraints. */
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 4.0;
const ZOOM_STEP = 0.1;
const ZOOM_DEFAULT = 1.0;

/* ============================================================
   STORE
   ============================================================ */

export const useStageStore = defineStore('stage', () => {

    /* ----------------------------------------------------------
       STATE — VIEW MODE (persisted)
    ---------------------------------------------------------- */

    const currentStage = ref<StageKey>('empty');

    function setStage(key: StageKey) {
        currentStage.value = key;
    }

    /* ----------------------------------------------------------
       STATE — CANVAS INTERACTION (session only, not persisted)
    ---------------------------------------------------------- */

    /** Current zoom level. 1.0 = 100%. */
    const zoom = ref<number>(ZOOM_DEFAULT);

    /** Pan offset in canvas pixels. */
    const panX = ref<number>(0);
    const panY = ref<number>(0);

    /** Active tool/interaction mode. */
    const canvasMode = ref<CanvasMode>('select');

    /**
     * True while the user is actively panning (space+drag or middle-mouse drag).
     * Consumers use this to suppress click-selection during pan gestures.
     */
    const isPanning = ref<boolean>(false);

    /* ----------------------------------------------------------
       COMPUTED
    ---------------------------------------------------------- */

    const zoomPercent = computed(() => Math.round(zoom.value * 100));
    const isDefaultZoom = computed(() => zoom.value === ZOOM_DEFAULT);
    const canZoomIn = computed(() => zoom.value < ZOOM_MAX);
    const canZoomOut = computed(() => zoom.value > ZOOM_MIN);

    /** CSS transform string for the canvas container. */
    const canvasTransform = computed(() =>
        `scale(${zoom.value}) translate(${panX.value}px, ${panY.value}px)`
    );

    /* ----------------------------------------------------------
       ZOOM
    ---------------------------------------------------------- */

    function setZoom(value: number) {
        zoom.value = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
    }

    function zoomIn() {
        setZoom(parseFloat((zoom.value + ZOOM_STEP).toFixed(2)));
    }

    function zoomOut() {
        setZoom(parseFloat((zoom.value - ZOOM_STEP).toFixed(2)));
    }

    function zoomTo(percent: number) {
        setZoom(percent / 100);
    }

    function resetZoom() {
        zoom.value = ZOOM_DEFAULT;
        panX.value = 0;
        panY.value = 0;
    }

    /**
     * Zoom toward a focal point (e.g. cursor position on scroll).
     * focalX/focalY are in canvas-space coordinates.
     */
    function zoomAtPoint(delta: number, focalX: number, focalY: number) {
        const prevZoom = zoom.value;
        const nextZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN,
            parseFloat((prevZoom + delta * ZOOM_STEP).toFixed(2))
        ));
        if (nextZoom === prevZoom) return;

        // Adjust pan to keep focal point stationary
        const scale = nextZoom / prevZoom;
        panX.value = focalX - scale * (focalX - panX.value);
        panY.value = focalY - scale * (focalY - panY.value);
        zoom.value = nextZoom;
    }

    /* ----------------------------------------------------------
       PAN
    ---------------------------------------------------------- */

    function setPan(x: number, y: number) {
        panX.value = x;
        panY.value = y;
    }

    function applyPanDelta(dx: number, dy: number) {
        panX.value += dx;
        panY.value += dy;
    }

    function setIsPanning(value: boolean) {
        isPanning.value = value;
    }

    /* ----------------------------------------------------------
       CANVAS MODE
    ---------------------------------------------------------- */

    function setCanvasMode(mode: CanvasMode) {
        canvasMode.value = mode;
    }

    function resetToSelect() {
        canvasMode.value = 'select';
        isPanning.value = false;
    }

    /* ----------------------------------------------------------
       RESET (on project close or stage switch)
    ---------------------------------------------------------- */

    function resetCanvas() {
        zoom.value = ZOOM_DEFAULT;
        panX.value = 0;
        panY.value = 0;
        canvasMode.value = 'select';
        isPanning.value = false;
    }

    /* ----------------------------------------------------------
       PUBLIC API
    ---------------------------------------------------------- */

    return {
        // View mode
        currentStage,
        setStage,

        // Canvas state
        zoom: readonly(zoom),
        panX: readonly(panX),
        panY: readonly(panY),
        canvasMode: readonly(canvasMode),
        isPanning: readonly(isPanning),

        // Computed
        zoomPercent,
        isDefaultZoom,
        canZoomIn,
        canZoomOut,
        canvasTransform,

        // Zoom actions
        setZoom,
        zoomIn,
        zoomOut,
        zoomTo,
        resetZoom,
        zoomAtPoint,

        // Pan actions
        setPan,
        applyPanDelta,
        setIsPanning,

        // Mode
        setCanvasMode,
        resetToSelect,

        // Reset
        resetCanvas,
    };
}, {
    persist: {
        storage: tauriStorage as any,
        // Only persist the view mode — canvas state resets per session
        pick: ['currentStage'],
    },
});