/**
 * useElementTriggers.ts
 *
 * Composable — wires ElementTriggers onto a template ref in live mode.
 * No-ops in authoring mode. Cleans up on unmount.
 */

import { inject, onMounted, onUnmounted, type Ref } from 'vue'
import { dispatchActions, type ActionContext } from '../utils/element.actions'
import type { ElementTrigger } from '../types/element'

export function useElementTriggers(
    elRef: Ref<HTMLElement | SVGElement | null>,
    triggers: ElementTrigger[],
    elementId: string,
) {
    const isAuthoring = inject<boolean>('isAuthoring', false)
    const cleanups: Array<() => void> = []

    onMounted(() => {
        if (isAuthoring || !triggers.length || !elRef.value) return

        for (const trigger of triggers) {
            const handler = async (event: Event) => {
                await dispatchActions(trigger.actions, {
                    sourceNode: elRef.value as HTMLElement,
                    sourceId: elementId,
                    event,
                } as ActionContext)
            }
            elRef.value.addEventListener(trigger.event, handler)
            cleanups.push(() => elRef.value?.removeEventListener(trigger.event, handler))
        }
    })

    onUnmounted(() => {
        for (const cleanup of cleanups) cleanup()
    })
}