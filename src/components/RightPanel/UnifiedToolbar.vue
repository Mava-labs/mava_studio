<template>
  <div
    :class="['unified-toolbar', placement]"
    :style="placement === 'stage' ? { transform: 'translateY(calc(-100% - 10px))' } : undefined"
  >
    <template v-if="mode === 'collection'">
      <button :title="'Ungroup'" aria-label="Ungroup collection" class="icon-btn" @click="ungroup">
        <span v-html="icons.ungroup"></span>
      </button>

      <span v-if="placement === 'stage'" class="sep"></span>

      <button :title="'Align left'" aria-label="Align members left" class="icon-btn" @click="(e) => alignMembers(e, 'left')">
        <span v-html="icons.left"></span>
      </button>
      <button :title="'Align horizontal center'" aria-label="Align members horizontal center" class="icon-btn" @click="(e) => alignMembers(e, 'hcenter')">
        <span v-html="icons.hcenter"></span>
      </button>
      <button :title="'Align right'" aria-label="Align members right" class="icon-btn" @click="(e) => alignMembers(e, 'right')">
        <span v-html="icons.right"></span>
      </button>

      <span v-if="placement === 'stage'" class="sep"></span>

      <button :title="'Align top'" aria-label="Align members top" class="icon-btn" @click="(e) => alignMembers(e, 'top')">
        <span v-html="icons.top"></span>
      </button>
      <button :title="'Align vertical center'" aria-label="Align members vertical center" class="icon-btn" @click="(e) => alignMembers(e, 'vcenter')">
        <span v-html="icons.vcenter"></span>
      </button>
      <button :title="'Align bottom'" aria-label="Align members bottom" class="icon-btn" @click="(e) => alignMembers(e, 'bottom')">
        <span v-html="icons.bottom"></span>
      </button>

      <span v-if="placement === 'stage'" class="sep"></span>

      <button :title="'Distribute horizontally'" aria-label="Distribute members horizontally" class="icon-btn" @click="(e) => distributeMembers(e, 'horizontal')">
        <span v-html="icons.distributeh"></span>
      </button>
      <button :title="'Distribute vertically'" aria-label="Distribute members vertically" class="icon-btn" @click="(e) => distributeMembers(e, 'vertical')">
        <span v-html="icons.distributev"></span>
      </button>
    </template>

    <template v-else>
      <button
        v-if="placement === 'stage'"
        :title="'Group (Ctrl+G)'"
        aria-label="Group selection"
        class="icon-btn"
        @click="groupSelectedAction"
      >
        <span v-html="icons.group"></span>
      </button>

      <button :title="'Align left'" aria-label="Align left" class="icon-btn" @click="(e) => alignSelection(e, 'left')">
        <span v-html="icons.left"></span>
      </button>
      <button :title="'Align horizontal center'" aria-label="Align horizontal center" class="icon-btn" @click="(e) => alignSelection(e, 'hcenter')">
        <span v-html="icons.hcenter"></span>
      </button>
      <button :title="'Align right'" aria-label="Align right" class="icon-btn" @click="(e) => alignSelection(e, 'right')">
        <span v-html="icons.right"></span>
      </button>

      <span v-if="placement === 'stage'" class="sep"></span>

      <button :title="'Align top'" aria-label="Align top" class="icon-btn" @click="(e) => alignSelection(e, 'top')">
        <span v-html="icons.top"></span>
      </button>
      <button :title="'Align vertical center'" aria-label="Align vertical center" class="icon-btn" @click="(e) => alignSelection(e, 'vcenter')">
        <span v-html="icons.vcenter"></span>
      </button>
      <button :title="'Align bottom'" aria-label="Align bottom" class="icon-btn" @click="(e) => alignSelection(e, 'bottom')">
        <span v-html="icons.bottom"></span>
      </button>

      <span v-if="placement === 'stage'" class="sep"></span>

      <button :title="'Distribute horizontally'" aria-label="Distribute horizontally" class="icon-btn" @click="(e) => distributeSelection(e, 'horizontal')">
        <span v-html="icons.distributeh"></span>
      </button>
      <button :title="'Distribute vertically'" aria-label="Distribute vertically" class="icon-btn" @click="(e) => distributeSelection(e, 'vertical')">
        <span v-html="icons.distributev"></span>
      </button>
    </template>
  </div>
</template>

<script setup lang="ts" vapor>
import { ref } from 'vue';
//import { currentPageId, ungroupCollection, alignCollectionMembers, distributeCollectionMembers, groupSelectedElements, alignSelected, distributeSelected, selectedElementIds, alignSingleToStage } from '../stores/project';

const icons = {
  ungroup: '<svg viewBox="0 0 16 16"><rect width="16" height="16" rx="2" /></svg>',
  group: '<svg viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" rx="2" /></svg>',
  left: '<svg viewBox="0 0 16 16"><path d="M3 2v12M6 4v8M9 5v6M12 6v4" stroke="currentColor" fill="none"/></svg>',
  hcenter: '<svg viewBox="0 0 16 16"><path d="M8 2v12M4 5h8M5 8h6M4 11h8" stroke="currentColor" fill="none"/></svg>',
  right: '<svg viewBox="0 0 16 16"><path d="M13 2v12M10 4v8M7 5v6M4 6v4" stroke="currentColor" fill="none"/></svg>',
  top: '<svg viewBox="0 0 16 16"><path d="M2 3h12M4 6h8M5 9h6M6 12h4" stroke="currentColor" fill="none"/></svg>',
  vcenter: '<svg viewBox="0 0 16 16"><path d="M2 8h12M5 4v8M8 5v6M11 4v8" stroke="currentColor" fill="none"/></svg>',
  bottom: '<svg viewBox="0 0 16 16"><path d="M2 13h12M4 10h8M5 7h6M6 4h4" stroke="currentColor" fill="none"/></svg>',
  distributeh: '<svg viewBox="0 0 16 16"><path d="M3 3h2v10H3zM7 4h2v8H7zM11 3h2v10h-2z" fill="currentColor"/></svg>',
  distributev: '<svg viewBox="0 0 16 16"><path d="M3 3h10v2H3zM4 7h8v2H4zM3 11h10v2H3z" fill="currentColor"/></svg>'
};

type ToolbarMode = 'collection' | 'multiselect';

type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';
type Axis = 'horizontal' | 'vertical';

const props = withDefaults(defineProps<{
  mode: ToolbarMode;
  singleStageAlign?: boolean;
  targetCollectionId?: string | null;
  pageScope?: string | null;
  placement?: 'stage' | 'panel';
}>(), {
  singleStageAlign: false,
  targetCollectionId: null,
  pageScope: null,
  placement: 'stage'
});

const currentPageIdState = ref<string | null>(null);
const selectedIdsState = ref<Set<string>>(new Set());
const unsubscribes: Array<() => void> = [];

function pageId() {
  return props.pageScope || currentPageIdState.value;
}

function stop(e: MouseEvent) {
  e.stopPropagation();
}

function ungroup(e: MouseEvent) {
  stop(e);
  if (!props.targetCollectionId) return;
  //ungroupCollection(props.targetCollectionId);
}

function groupSelectedAction(e: MouseEvent) {
  stop(e);
  //groupSelectedElements();
}

function alignMembers(e: MouseEvent, mode: AlignMode) {
  stop(e);
  if (!props.targetCollectionId) return;
  //alignCollectionMembers(props.targetCollectionId, mode as any);
}

function distributeMembers(e: MouseEvent, axis: Axis) {
  stop(e);
  if (!props.targetCollectionId) return;
  //distributeCollectionMembers(props.targetCollectionId, axis);
}

function alignSelection(e: MouseEvent, mode: AlignMode) {
  stop(e);
  const pid = pageId();
  if (!pid) return;
  if (props.singleStageAlign && selectedIdsState.value.size === 1) {
    //alignSingleToStage(pid, mode as any);
  } else {
    //alignSelected(pid, mode as any);
  }
}

function distributeSelection(e: MouseEvent, axis: Axis) {
  stop(e);
  const pid = pageId();
  if (!pid) return;
  //distributeSelected(pid, axis);
}
</script>

<style scoped>
.unified-toolbar { display:flex; gap:4px; }
.unified-toolbar.stage { position:absolute; top:-6px; left:32px; background:rgba(17,24,39,0.9); padding:4px 6px; border-radius:6px; backdrop-filter:blur(4px); box-shadow:0 4px 12px rgba(0,0,0,0.25); }
.unified-toolbar.panel { position:relative; padding:0 0 6px 0; background:transparent; box-shadow:none; border-radius:0; }
.unified-toolbar.panel .sep { height:20px; align-self:center; }
.unified-toolbar { --toolbar-icon-color:#f1f5f9; --toolbar-icon-size:1.2rem; }
.unified-toolbar button { font-size:11px; line-height:1; padding:2px 4px; border:1px solid #334155; background:#1e293b; color:var(--toolbar-icon-color); border-radius:4px; cursor:pointer; display:flex; align-items:center; justify-content:center; min-width: calc(var(--toolbar-icon-size) + 4px); height: calc(var(--toolbar-icon-size) + 2px); }
.unified-toolbar button:hover { background:#334155; --toolbar-icon-color:#ffffff; }
.unified-toolbar button :deep(svg) { width:var(--toolbar-icon-size); height:var(--toolbar-icon-size); display:block; fill:currentColor; }
.unified-toolbar button :deep(svg [stroke]) { stroke: currentColor; }
.unified-toolbar button:focus-visible { outline:2px solid #3b82f6; outline-offset:2px; }
.unified-toolbar .sep { width:1px; background:#475569; margin:0 2px; }
</style>
