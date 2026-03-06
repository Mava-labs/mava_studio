<template>
  <div class="panel-root flex-1 min-h-0 overflow-hidden">
    <div v-if="!element" class="text-xs text-slate-500 px-3">Select an element to edit its properties.</div>

    <div v-else class="flex-1 min-h-0 overflow-y-auto px-3 space-y-3">
      <div class="border-b border-slate-300 dark:border-slate-600 pb-2 flex justify-between items-center">
        <div class="font-semibold text-sm">Element Properties</div>
        <span class="text-[11px] text-slate-500 dark:text-slate-400">{{ schema ? schema.displayName : 'No schema' }}</span>
      </div>

      <div v-if="schema" class="space-y-3">
        <div class="text-xs text-slate-600 dark:text-slate-300 flex gap-2 items-center">
          <span class="px-2 py-1 bg-slate-200 dark:bg-slate-800 rounded">{{ schema.category }}</span>
          <span v-if="schema.renderAsSvg" class="px-2 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 rounded">SVG</span>
        </div>

        <div class="space-y-1">
          <div class="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Allowed children</div>
          <div class="text-xs text-slate-700 dark:text-slate-300">
            <span class="font-semibold">Mode:</span> {{ schema.allowedChildren?.mode ?? 'warn' }}
            <span v-if="schema.allowedChildren?.allow?.length"> • allow: {{ schema.allowedChildren.allow.join(', ') }}</span>
            <span v-if="schema.allowedChildren?.disallow?.length"> • disallow: {{ schema.allowedChildren.disallow.join(', ') }}</span>
            <span v-if="schema.allowedChildren?.reason"> — {{ schema.allowedChildren.reason }}</span>
          </div>
        </div>

        <div class="space-y-1" v-if="schema.collection && schema.collection.kind !== 'none'">
          <div class="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Collection</div>
          <div class="text-xs text-slate-700 dark:text-slate-300">
            {{ schema.collection.kind === 'locked-collection' ? 'Locked collection' : 'Collection' }}
            <span v-if="schema.collection.detachMode"> • detach: {{ schema.collection.detachMode }}</span>
            <span v-if="schema.collection.reason"> — {{ schema.collection.reason }}</span>
          </div>
        </div>

        <div class="space-y-1" v-if="schema.controls?.length">
          <div class="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Properties</div>
          <div class="flex flex-col gap-2">
            <div v-for="ctrl in schema.controls" :key="ctrl.id" class="rounded border border-slate-200 dark:border-slate-700 px-2 py-2 space-y-1">
              <div class="text-xs font-semibold text-slate-800 dark:text-slate-100 flex justify-between items-center">
                <span>{{ ctrl.label }}</span>
                <span class="text-[11px] text-slate-500 dark:text-slate-400" v-if="ctrl.help">{{ ctrl.help }}</span>
              </div>

              <template v-if="ctrl.type === 'select'">
                <select class="w-full text-xs bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1" v-model="form[ctrl.id]" @change="(e: any) => updateControl(ctrl, e.target.value)">
                  <option v-for="opt in ctrl.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </template>

              <template v-else-if="ctrl.type === 'text'">
                <input class="w-full text-xs bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1" type="text" :value="form[ctrl.id]" @input="(e: any) => updateControl(ctrl, e.target.value)" />
              </template>

              <template v-else-if="ctrl.type === 'number'">
                <input class="w-full text-xs bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1" type="number" :value="form[ctrl.id]" @input="(e: any) => updateControl(ctrl, Number(e.target.value))" />
              </template>

              <template v-else-if="ctrl.type === 'toggle'">
                <label class="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
                  <input type="checkbox" :checked="!!form[ctrl.id]" @change="(e: any) => updateControl(ctrl, !!e.target.checked)" />
                  <span>{{ form[ctrl.id] ? 'On' : 'Off' }}</span>
                </label>
              </template>

              <template v-else-if="ctrl.type === 'radio'">
                <div class="flex flex-wrap gap-2 text-xs text-slate-700 dark:text-slate-200">
                  <label v-for="opt in ctrl.options" :key="opt.value" class="flex items-center gap-1">
                    <input type="radio" :name="ctrl.id" :value="opt.value" :checked="form[ctrl.id] === opt.value" @change="() => updateControl(ctrl, opt.value)" />
                    <span>{{ opt.label }}</span>
                  </label>
                </div>
              </template>
            </div>
          </div>
          <div class="text-[11px] text-slate-500 dark:text-slate-400" v-if="isSaving">Saving…</div>
        </div>

        <div class="space-y-1" v-if="schema.responsive">
          <div class="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Responsive</div>
          <div class="flex gap-1 flex-wrap">
            <span v-for="bp in schema.responsive.breakpoints" :key="bp" class="px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 text-[11px] text-slate-700 dark:text-slate-200">{{ bp }}</span>
          </div>
          <div class="text-[11px] text-slate-500 dark:text-slate-400">Overrides: {{ schema.responsive.supportsOverrides ? 'supported' : 'n/a' }}</div>
        </div>
      </div>

      <div v-else class="text-xs text-slate-500 dark:text-slate-400">No property schema is defined for this element type yet.</div>
    </div>
  </div>
</template>

<script setup lang="ts" vapor>
import { computed, reactive, ref, watch } from 'vue';
import { usePagesStore } from '../../stores/pages';
import { useElementStore } from '../../stores/element';
import { ELEMENT_PROPERTY_SCHEMAS, type ControlDescriptor } from '../../types/elementPropertySchemas';

const pages = usePagesStore();
const elements = useElementStore();

const element = computed(() => {
  const activeId = elements.activeElementId;
  if (!activeId) return null;
  return pages.getElementById(activeId);
});

const schema = computed(() => {
  if (!element.value) return null;
  const key = element.value.subtype ?? element.value.type;
  return ELEMENT_PROPERTY_SCHEMAS[key] ?? ELEMENT_PROPERTY_SCHEMAS[element.value.type] ?? null;
});

const form = reactive<Record<string, any>>({});
const isSaving = ref(false);

function hydrateForm() {
  const el = element.value;
  const sc = schema.value;
  if (!el || !sc) {
    Object.keys(form).forEach((k) => delete form[k]);
    return;
  }

  const style = (el as any).style ?? {};
  const defaults = sc.defaultStyle ?? {};

  (sc.controls ?? []).forEach((ctrl) => {
    const existing = style[ctrl.id];
    const fallback = defaults[ctrl.id] ?? ctrl.defaultValue ?? '';
    form[ctrl.id] = existing !== undefined ? existing : fallback;
  });
}

watch([element, schema], hydrateForm, { immediate: true });

async function updateControl(ctrl: ControlDescriptor, value: any) {
  const page = pages.getActivePageData();
  const el = element.value;
  if (!page || !el) return;

  const target = page.elements[el.id];
  if (!target) return;

  const nextStyle = { ...(target as any).style, [ctrl.id]: value };
  (target as any).style = nextStyle;

  isSaving.value = true;
  try {
    pages.pagesCache[page.id] = { ...page, elements: { ...page.elements, [el.id]: target } } as any;
    elements.clearPageMarkup(page.id);
    await pages.savePage(page);
  } finally {
    isSaving.value = false;
  }
}
</script>

<style scoped>
.panel-root { font-family: system-ui, sans-serif; font-size: 12px; }
</style>
