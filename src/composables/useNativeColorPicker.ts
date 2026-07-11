/**
 * useNativeColorPicker.ts
 *
 * Every color swatch in the Properties panel is a native `<input
 * type="color">` — deliberately kept (a real, accessible, well-tested color
 * picker UI, not worth rebuilding from scratch). The bug reported against
 * it: the panel is docked at the far right of the window, right at the
 * viewport's edge, and the native color picker popup (rendered by the
 * WebView2/Chromium engine itself, entirely outside this app's DOM/CSS)
 * anchors to wherever the triggering `<input>` sits on screen — so it
 * consistently opened partially off-screen, with no way to reach the
 * cut-off portion. Not fixable with CSS; the popup isn't a DOM node this
 * app renders.
 *
 * The fix: don't trigger the native picker from the *visible* swatch at all
 * (it's still an inert-looking `<button>` styled to match) — instead create
 * a detached, invisible `<input type="color">`, position it well inside the
 * viewport (away from every edge) via `position: fixed`, and `.click()` it
 * programmatically. The native popup anchors to *that* input's on-screen
 * position instead, which is always safely placed regardless of where the
 * real swatch happens to sit in the docked panel.
 */

export function useNativeColorPicker() {
    function pickColor(current: string | undefined, onChange: (value: string) => void) {
        const input = document.createElement('input')
        input.type = 'color'
        input.value = /^#[0-9a-fA-F]{6}$/.test(current ?? '') ? (current as string) : '#000000'

        const safeLeft = Math.max(16, Math.min(window.innerWidth - 260, window.innerWidth / 2 - 130))
        const safeTop = Math.max(16, Math.min(window.innerHeight - 320, 120))
        Object.assign(input.style, {
            position: 'fixed',
            left: `${safeLeft}px`,
            top: `${safeTop}px`,
            width: '1px',
            height: '1px',
            opacity: '0',
            pointerEvents: 'none',
        } satisfies Partial<CSSStyleDeclaration>)

        document.body.appendChild(input)

        function onInput() {
            onChange(input.value)
        }

        function cleanup() {
            input.removeEventListener('input', onInput)
            input.removeEventListener('change', cleanup)
            input.remove()
        }

        input.addEventListener('input', onInput)
        input.addEventListener('change', cleanup)
        // 'change' doesn't reliably fire if the user dismisses the picker
        // without confirming a color (varies by OS/engine) — clean up the
        // detached node regardless once focus moves on.
        input.addEventListener('blur', () => setTimeout(cleanup, 300))

        input.click()
    }

    return { pickColor }
}
