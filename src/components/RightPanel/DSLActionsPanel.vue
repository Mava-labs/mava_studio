<template>
  <div class="panel-root h-full min-h-0 overflow-hidden flex flex-col bg-white/80 dark:bg-slate-900/70 text-slate-800 dark:text-slate-100">
    <header class="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-700">
      <div class="flex items-center gap-2">
        <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Actions</p>
        <span class="text-[11px] text-slate-500 dark:text-slate-400">(placeholder)</span>
      </div>
    </header>

    <div class="flex-1 min-h-0 grid grid-cols-2 divide-x divide-slate-200 dark:divide-slate-800">
      <section class="h-full min-h-0 flex flex-col">
        <div class="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-800">
          <p class="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Triggers</p>
          <div class="flex gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <button class="pill" disabled>New</button>
            <button class="pill" disabled>Edit</button>
            <button class="pill" disabled>Duplicate</button>
            <button class="pill" disabled>Delete</button>
          </div>
        </div>
        <div class="flex-1 min-h-0 overflow-auto thin-scroll">
          <ul class="divide-y divide-slate-200 dark:divide-slate-800">
            <li v-for="n in 4" :key="`trigger-${n}`" class="px-3 py-2 text-sm flex items-center gap-2">
              <span class="inline-block h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
              <div>
                <p class="text-slate-800 dark:text-slate-100">Trigger {{ n }}</p>
                <p class="text-[11px] text-slate-500 dark:text-slate-400">Double-click to edit (disabled)</p>
              </div>
            </li>
          </ul>
        </div>
      </section>

      <section class="h-full min-h-0 flex flex-col">
        <div class="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-800">
          <p class="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Variables</p>
          <div class="flex gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <button class="pill" disabled>New</button>
            <button class="pill" disabled>Edit</button>
            <button class="pill" disabled>Delete</button>
          </div>
        </div>
        <div class="flex-1 min-h-0 overflow-auto thin-scroll">
          <ul class="divide-y divide-slate-200 dark:divide-slate-800">
            <li v-for="n in 4" :key="`var-${n}`" class="px-3 py-2 text-sm flex items-center gap-2">
              <span class="inline-block h-2 w-2 rounded-full bg-sky-400" aria-hidden="true" />
              <div>
                <p class="text-slate-800 dark:text-slate-100">Variable {{ n }}</p>
                <p class="text-[11px] text-slate-500 dark:text-slate-400">Value preview (read-only)</p>
              </div>
            </li>
          </ul>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts" vapor>
// Lightweight shell: wire triggers, selection, keyboard shortcuts, and variable CRUD once stores are ported.
</script>

<style scoped>
.panel-root { font-family: system-ui, sans-serif; font-size: 12px; }
.pill { padding: 4px 8px; border-radius: 999px; border: 1px solid #cbd5e1; background: #f8fafc; color: #475569; cursor: not-allowed; }
.thin-scroll { scrollbar-width: thin; }
</style>
