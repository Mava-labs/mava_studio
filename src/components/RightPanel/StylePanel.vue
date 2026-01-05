<template>
  <div class="panel-root h-full min-h-0 overflow-hidden flex flex-col bg-white/80 dark:bg-slate-900/70 text-slate-800 dark:text-slate-100">
    <header class="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-700">
      <div class="flex items-center gap-2">
        <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Styles</p>
        <span class="text-[11px] text-slate-500 dark:text-slate-400">(placeholder)</span>
      </div>
    </header>

    <div class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden thin-scroll px-3 py-2">
      <section class="mb-4">
        <p class="element-header mb-2">Page settings</p>
        <div class="grid grid-cols-2 gap-2">
          <div class="control-row">
            <label class="control-label">Width</label>
            <input class="control-input" type="number" placeholder="e.g. 1280" disabled />
          </div>
          <div class="control-row">
            <label class="control-label">Height</label>
            <input class="control-input" type="number" placeholder="e.g. 720" disabled />
          </div>
        </div>
      </section>

      <section class="mb-4">
        <p class="element-header mb-2">Padding</p>
        <div class="grid grid-cols-3 grid-rows-3 gap-1 place-items-center w-full">
          <div></div>
          <input class="control-input w-full" type="number" placeholder="Top" disabled />
          <div></div>
          <input class="control-input w-full" type="number" placeholder="Left" disabled />
          <div class="w-full h-6"></div>
          <input class="control-input w-full" type="number" placeholder="Right" disabled />
          <div></div>
          <input class="control-input w-full" type="number" placeholder="Bottom" disabled />
          <div></div>
        </div>
      </section>

      <section class="mb-4">
        <p class="element-header mb-2">Typography</p>
        <div class="grid grid-cols-2 gap-2">
          <div class="control-row">
            <label class="control-label">Font</label>
            <select class="control-input" disabled>
              <option>system-ui</option>
              <option>Georgia, serif</option>
              <option>Monospace</option>
            </select>
          </div>
          <div class="control-row">
            <label class="control-label">Size</label>
            <input class="control-input" type="number" placeholder="14" disabled />
          </div>
        </div>
      </section>

      <section>
        <p class="element-header mb-2">Effects</p>
        <div class="grid grid-cols-1 gap-2">
          <div class="control-row">
            <label class="control-label">Shadow</label>
            <input class="control-input" type="text" placeholder="e.g. 0 1px 2px rgba(...)" disabled />
          </div>
          <div class="control-row">
            <label class="control-label">Blur</label>
            <input class="control-input" type="number" placeholder="0" disabled />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts" vapor>
// Lightweight shell: wire real schema, controls, and handlers when the stores are ported.
</script>

<style scoped>
.panel-root { font-family: system-ui, sans-serif; font-size: 12px; }
.element-header { font-weight: 600; font-size: 13px; }
.control-row { display: flex; flex-direction: column; gap: 4px; }
.control-label { font-size: 11px; color: #64748b; }
.control-input { width: 100%; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; color: #0f172a; font-size: 12px; }
.control-input:disabled { background: #f8fafc; color: #94a3b8; }
.thin-scroll { scrollbar-width: thin; }
</style>
