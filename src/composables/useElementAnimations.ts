/**
 * useElementAnimations.ts
 *
 * Composable — drives autoplay animations in live mode.
 * Cancels all animations on unmount.
 */

import { inject, onMounted, onUnmounted, type Ref } from 'vue'
import {
    autoplay,
    cancelAllAnimations,
} from '../utils/element.animations'
import type { ElementTrigger, ElementAnimation } from '../types/element'

function collectTriggerBoundIds(triggers: ElementTrigger[]): Set<string> {
    const ids = new Set<string>()
    for (const trigger of triggers)
        for (const action of trigger.actions)
            if (action.type === 'playAnimation' && action.params?.animationId)
                ids.add(action.params.animationId as string)
    return ids
}

export function useElementAnimations(
    elRef: Ref<HTMLElement | SVGSVGElement | null>,
    animations: ElementAnimation[],
    triggers: ElementTrigger[],
    elementId: string,
) {
    const isAuthoring = inject<boolean>('isAuthoring', false)

    onMounted(() => {
        if (isAuthoring || !animations.length || !elRef.value) return
        const triggerBoundIds = collectTriggerBoundIds(triggers)
        autoplay(elRef.value as HTMLElement, animations, triggerBoundIds, elementId)
    })

    onUnmounted(() => {
        cancelAllAnimations(elementId)
    })
}