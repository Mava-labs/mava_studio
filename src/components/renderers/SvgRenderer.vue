<script setup lang="ts" vapor>
    import { computed, inject, ref, unref, type Ref, type ComputedRef } from 'vue'
    import type { SvgElement, SvgStyle, PathCommand, Element } from '../../types/element'
    import { resolveSvgElement } from './resolve'
    import { useElementTriggers } from '../../composables/useElementTriggers'
    import { useElementAnimations } from '../../composables/useElementAnimations'

    const props = defineProps<{ el: SvgElement }>()

    const elRef = ref<SVGSVGElement | null>(null)

    type ElementMapSource = Record<string, Element> | Ref<Record<string, Element>> | ComputedRef<Record<string, Element>>

    const elementsSource = inject<ElementMapSource>('elements', {})
    const elements = computed(() => unref(elementsSource) ?? {})

    const parent = computed(() => {
        if (!props.el.parentId) return undefined
        return elements.value[props.el.parentId]
    })

    // ─── SVG dimensions from geometry ────────────────────────────────────────────

    const svgDimensions = computed(() => {
        const g = props.el.geometry
        switch (g.type) {
            case 'rect':
            case 'hotspot': return { width: g.width, height: g.height }
            case 'circle': return { width: g.r * 2, height: g.r * 2 }
            case 'ellipse': return { width: g.rx * 2, height: g.ry * 2 }
            case 'line': return { width: Math.abs(g.x2 - g.x1) || 1, height: Math.abs(g.y2 - g.y1) || 1 }
            case 'polygon':
            case 'star':
            case 'arrow':
            case 'path': return {
                width: props.el.layout.width,
                height: props.el.layout.height
            }
        }
    })

    // ─── Shared shape attrs ───────────────────────────────────────────────────────

    const shapeAttrs = computed(() => {
        const s: SvgStyle = props.el.style
        const attrs: Record<string, string> = {
            fill: s.fill ?? 'none',
            stroke: s.stroke?.color ?? 'none',
            'stroke-width': String(s.stroke?.width ?? 0),
        }
        const style = s.stroke?.style ?? 'solid'
        if (style === 'dashed') attrs['stroke-dasharray'] = '6,3'
        else if (style === 'dotted') attrs['stroke-dasharray'] = '2,2'
        return attrs
    })

    const radius = computed(() => {
        const r = props.el.style.radius
        if (r === undefined) return 0
        return typeof r === 'number' ? r : r.tl
    })

    // ─── Path string builder ──────────────────────────────────────────────────────

    function buildPath(commands: PathCommand[]): string {
        return commands.map(cmd => {
            switch (cmd.type) {
                case 'M': return `M ${cmd.x} ${cmd.y}`
                case 'L': return `L ${cmd.x} ${cmd.y}`
                case 'C': return `C ${cmd.x1} ${cmd.y1} ${cmd.x2} ${cmd.y2} ${cmd.x} ${cmd.y}`
                case 'Q': return `Q ${cmd.x1} ${cmd.y1} ${cmd.x} ${cmd.y}`
                case 'Z': return 'Z'
            }
        }).join(' ')
    }

    // ─── Star point generator ─────────────────────────────────────────────────────

    function buildStarPoints(points: number, inner: number, outer: number): string {
        const cx = outer, cy = outer
        return Array.from({ length: points * 2 }, (_, i) => {
            const angle = (Math.PI / points) * i - Math.PI / 2
            const r = i % 2 === 0 ? outer : inner
            return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`
        }).join(' ')
    }

    // ─── Style ────────────────────────────────────────────────────────────────────

    const resolved = computed(() => resolveSvgElement(props.el, parent.value))

    useElementTriggers(elRef, props.el.interaction.triggers, props.el.id)
    useElementAnimations(elRef, props.el.interaction.animations, props.el.interaction.triggers, props.el.id)
</script>

<template>
    <svg ref="elRef" :data-eid="el.id" :width="svgDimensions.width" :height="svgDimensions.height" :style="resolved.style"
        xmlns="http://www.w3.org/2000/svg" v-bind="resolved.attrs">
        <!-- rect / hotspot -->
        <rect v-if="el.geometry.type === 'rect' || el.geometry.type === 'hotspot'" :width="el.geometry.width"
            :height="el.geometry.height" :rx="radius" v-bind="shapeAttrs" />

        <!-- circle -->
        <circle v-else-if="el.geometry.type === 'circle'" :cx="el.geometry.r" :cy="el.geometry.r" :r="el.geometry.r"
            v-bind="shapeAttrs" />

        <!-- ellipse -->
        <ellipse v-else-if="el.geometry.type === 'ellipse'" :cx="el.geometry.rx" :cy="el.geometry.ry"
            :rx="el.geometry.rx" :ry="el.geometry.ry" v-bind="shapeAttrs" />

        <!-- line -->
        <line v-else-if="el.geometry.type === 'line'" :x1="el.geometry.x1" :y1="el.geometry.y1" :x2="el.geometry.x2"
            :y2="el.geometry.y2" v-bind="shapeAttrs" />

        <!-- polygon -->
        <polygon v-else-if="el.geometry.type === 'polygon'"
            :points="el.geometry.points.map(p => `${p.x},${p.y}`).join(' ')" v-bind="shapeAttrs" />

        <!-- star -->
        <polygon v-else-if="el.geometry.type === 'star'"
            :points="buildStarPoints(el.geometry.points, el.geometry.innerRadius, el.geometry.outerRadius)"
            v-bind="shapeAttrs" />

        <!-- arrow -->
        <line v-else-if="el.geometry.type === 'arrow'" :x1="el.geometry.from.x" :y1="el.geometry.from.y"
            :x2="el.geometry.to.x" :y2="el.geometry.to.y" v-bind="shapeAttrs" />

        <!-- path -->
        <path v-else-if="el.geometry.type === 'path'" :d="buildPath(el.geometry.commands)" v-bind="shapeAttrs" />

        <!-- optional SVG text overlay -->
        <text v-if="el.style.textContent" :x="el.style.textContent.placementH === 'left' ? '0%'
            : el.style.textContent.placementH === 'right' ? '100%' : '50%'" :y="el.style.textContent.placementV === 'top' ? '0%'
            : el.style.textContent.placementV === 'bottom' ? '100%' : '50%'"
            :dominant-baseline="el.style.textContent.placementV === 'center' ? 'middle' : 'auto'" :text-anchor="el.style.textContent.placementH === 'center' ? 'middle'
                : el.style.textContent.placementH === 'right' ? 'end' : 'start'"
            :fill="el.style.textContent.text.color" :font-size="el.style.textContent.text.font.size">{{
                el.style.textContent.text.content }}
        </text>
        <!-- vapor anchor fallback -->
        <g v-else />
    </svg>
</template>