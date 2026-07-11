<template>
    <div class="panel-root px-3">
        <div class="section-head mb-3">
            <h3 class="section-title">Form</h3>
            <span class="badge">Inputs</span>
        </div>

        <div v-if="isSelect">
            <div class="section-sub mb-2">Options</div>
            <div class="flex flex-col gap-2">
                <div v-for="(opt, idx) in options" :key="idx" class="flex gap-2 items-center">
                    <input class="w-full input" v-model="options[idx]" />
                    <button class="step" type="button" @click="remove(idx)">✕</button>
                </div>
                <button class="btn" type="button" @click="add">Add Option</button>
            </div>
        </div>

        <div v-else>
            <div class="section mb-2">
                <label class="clab">Placeholder</label>
                <input class="w-full input" :value="placeholder" @change="set('placeholder', $event.target.value)" />
            </div>
            <div class="flex gap-2">
                <label class="checkbox"><input type="checkbox" :checked="disabled" @change="set('disabled', $event.target.checked)" /> Disabled</label>
                <label class="checkbox"><input type="checkbox" :checked="required" @change="set('required', $event.target.checked)" /> Required</label>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts" vapor>
import { computed } from 'vue'
import { useActiveElement } from '../../../composables/useActiveElement'
import type { FlatHtmlElement } from '../../../types/element'

const { element, update } = useActiveElement()

const el = computed(() => element.value as FlatHtmlElement | null)

const isSelect = computed(() => el.value?.type === 'select')

const attrs = computed(() => el.value?.attributes ?? {})

const options = computed({
    get: () => Array.isArray(attrs.value.options) ? [...attrs.value.options] : ['Option 1', 'Option 2', 'Option 3'],
    set: (v: string[]) => update({ attributes: { ...(attrs.value ?? {}), options: v } })
})

function add() { options.value = [...options.value, `Option ${options.value.length + 1}`] }
function remove(i: number) { const copy = [...options.value]; copy.splice(i,1); options.value = copy }

const placeholder = computed(() => attrs.value.placeholder ?? '')
const disabled = computed(() => !!attrs.value.disabled)
const required = computed(() => !!attrs.value.required)

function set(key: string, value: unknown) { update({ attributes: { ...(attrs.value ?? {}), [key]: value } }) }
</script>

<style scoped>
.panel-root { font-family: system-ui, sans-serif; font-size: 12px; color: #e2e8f0; }
.section-title { font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #cbd5e1; }
.badge { font-size: 10px; padding: 2px 8px; border-radius: 8px; background: #0f172a; color: #94a3b8; text-transform: uppercase; }
.input { background: #0f172a; border: 1px solid #334155; color: #e2e8f0; padding: 6px 8px; border-radius: 6px }
.clab { font-size: 11px; color: #94a3b8; display: block; margin-bottom: 6px }
.checkbox { font-size: 12px; color: #cbd5e1 }
.btn { background:#0f172a; color:#e2e8f0; padding:6px 8px; border-radius:6px; border:1px solid #334155 }
</style>
