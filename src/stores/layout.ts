import { defineStore } from "pinia";
import { Ref, ref } from "vue";
import { tauriStorage } from "../utils/tauriStorage";

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
}

export const useLayoutStore = defineStore("layout", () =>{
    const activeSideNav: Ref<SideNavKey | null> = ref(null);
    const activeRightUtil: Ref<RightUtilKey | null> = ref(null);
    const asideWidth: Ref<number> = ref(clamp(250, 150, 400));
    const terminalHeight: Ref<number> = ref(clamp(3, 3, Number.MAX_SAFE_INTEGER));
    const terminalState: Ref<TerminalState> = ref("closed");
    const terminalPrevHeight: Ref<number> = ref(clamp(3, 3, Number.MAX_SAFE_INTEGER));
    const terminalTab: Ref<TerminalTab> = ref("scripts");
    const outlineExpaded: Ref<boolean> = ref(true);
    const explorerOpen: Ref<boolean> = ref(true);

    function setActiveSideNav(key: SideNavKey | null) {
        if (activeSideNav.value === key) {
            activeSideNav.value = null;
            return;
        }
        activeSideNav.value = key;
    }

    function setActiveRightUtil(key: RightUtilKey | null) {
        if (activeRightUtil.value === key) {
            activeRightUtil.value = null;
            return;
        }
        activeRightUtil.value = key;
    }

    // Actions (Pinia-style)
    function setAsideWidth(width: number) {
        // Keep in sync with UI constraints (150-400)
        asideWidth.value = clamp(width, 150, 400);
    }

    function setTerminalHeight(height: number) {
        // UI minimum is 3px, no strict max since it depends on viewport
        const h = Math.max(3, Math.floor(height));
        terminalHeight.value = h;
        // Resizing implies we're in a resizable state
        const s = terminalState.value;
        if (s !== "normal") terminalState.value = "normal";
    }

    function setTerminalState(state: TerminalState) {
        const current = terminalState.value;
        if (state === current) return;

        if (state === "full") {
            // Remember height before going full
            const h = terminalHeight.value;
            terminalPrevHeight.value = h;
            // TODO
            // if (isBrowser) {
            //     const maxH = window.innerHeight;
            //     terminalHeight.value = Math.max(3, Math.floor(maxH));
            // }
            terminalState.value = "full";
            return;
        }

        if (state === "normal") {
            if (current === "full") {
                // Restore previous height if coming from full
                const prev = terminalPrevHeight.value;
                terminalHeight.value = Math.max(3, Math.floor(prev));
            }
            terminalState.value = "normal";
            return;
        }

        // closed
        const h = terminalHeight.value;
        terminalPrevHeight.value = h;
        terminalState.value = "closed";
    }

    function toggleFull() {
        const s = terminalState.value;
        if (s === "full") {
            setTerminalState("normal");
        } else {
            // If closed, use prevHeight to reopen later
            setTerminalState("full");
        }
    }

    function openTerminal() {
        const s = terminalState.value;
        let prev = terminalPrevHeight.value || terminalHeight.value;
        if (s === "closed") {
            if (prev <= 20) prev = 250; // Default to 250px if closed and prev was less that minimum open height

            terminalHeight.value = Math.max(3, Math.floor(prev));
            terminalState.value = "normal";
        } else if (s === "normal" && prev <= 3) {
            terminalHeight.value = Math.max(3, 250);
        }
    }

    function closeTerminal() {
        setTerminalState("closed");
    }

    function setTerminalTab(tab: TerminalTab) {
        terminalTab.value = tab;
    }

    function openTerminalWithTab(tab: TerminalTab) {
        setTerminalTab(tab);
        openTerminal();
    }

    function toggleOutlineOrExplorer(target: 'outline' | 'explorer') {
        if (target === 'outline') {
            outlineExpaded.value = !outlineExpaded.value;
        } else if (target === 'explorer') {
            explorerOpen.value = !explorerOpen.value;
        }
    }
    
    return { 
        activeSideNav, setActiveSideNav, activeRightUtil, setActiveRightUtil, 
        asideWidth, setAsideWidth, terminalHeight, setTerminalHeight,  toggleOutlineOrExplorer,
        terminalState, setTerminalState, toggleFull, openTerminal, closeTerminal, 
        terminalTab, setTerminalTab, openTerminalWithTab, outlineExpaded, explorerOpen
    }
}, {
    persist: {
        storage: tauriStorage as any,
        pick: [
            'explorerOpen',
            'outlineExpaded',
            'activeSideNav', 
            'activeRightUtil', 
            'asideWidth', 
            'terminalHeight', 
            'terminalState', 
            'terminalPrevHeight', 
            'terminalTab'
        ]
    }
});

export type SideNavKey =
    | "structure"
    | "elements"
    | "components"
    | "cf_map"
    | "assets"
    | "inspector"
    | "animations";

export type RightUtilKey = "styles" | "actions";

export type TerminalState = "full" | "normal" | "closed";
export type TerminalTab = "scripts" | "triggers" | "timeline" | "output";
