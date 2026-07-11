<script setup lang="ts" vapor>
    import { computed } from 'vue'
    import { useProjectMetadataStore } from '../../stores/projectMetadata'
    import { usePagesStore } from '../../stores/pages'
    import { useElementStore } from '../../stores/element'
    import { useNotificationStore } from '../../stores/notification'

    const project = useProjectMetadataStore()
    const pages = usePagesStore()
    const elements = useElementStore()
    const notifications = useNotificationStore()

    const components = computed(() =>
        Object.values(project.componentLibrary ?? {}).sort((a, b) => a.name.localeCompare(b.name))
    )

    /** Create a blank component and open it as an editable canvas tab. */
    function newComponent() {
        const def = project.createComponent(`Component_${Object.keys(project.componentLibrary ?? {}).length + 1}`)
        pages.openComponentSurface(def.id)
    }

    /** Open a component for editing on the canvas (a tab, like a page). */
    function edit(id: string) {
        pages.openComponentSurface(id)
    }

    /** Drop a fresh instance of a component onto the active surface. */
    function insert(id: string, name: string) {
        if (!pages.getActivePageData()) {
            notifications.addNotification('Open a page first to place an instance.', { type: 'warn', ttl: 3000 })
            return
        }
        if (pages.activePageId === id) {
            notifications.addNotification("A component can't contain itself.", { type: 'warn', ttl: 3500 })
            return
        }
        elements.addComponentInstance(id, name)
        notifications.addNotification(`Inserted "${name}".`, { type: 'info', ttl: 1800 })
    }

    function remove(id: string, name: string) {
        project.deleteComponent(id)
        notifications.addNotification(`Deleted component "${name}".`, { type: 'info', ttl: 1800 })
    }
</script>

<template>
    <div class="components-panel">
        <div class="components-panel__head">
            <span class="components-panel__title">Components</span>
            <button type="button" class="components-panel__new" @click="newComponent">+ New</button>
        </div>

        <p v-if="!components.length" class="components-panel__empty">
            No components yet. "+ New" opens a blank component on the canvas — author it like a page,
            then insert it onto pages here.
        </p>

        <ul v-else class="components-panel__list">
            <li v-for="def in components" :key="def.id" class="component-item">
                <button type="button" class="component-item__main" :title="`Edit ${def.name}`" @click="edit(def.id)">
                    <span class="component-item__name">{{ def.name }}</span>
                    <span class="component-item__meta">{{ def.rootIds.length }} root{{ def.rootIds.length === 1 ? '' : 's' }}</span>
                </button>
                <button type="button" class="component-item__action" title="Insert on the current page" @click="insert(def.id, def.name)">Insert</button>
                <button type="button" class="component-item__remove" title="Delete component" @click="remove(def.id, def.name)">✕</button>
            </li>
        </ul>
    </div>
</template>

<style scoped>
    .components-panel {
        display: flex;
        flex-direction: column;
        height: 100%;
        padding: 10px 12px;
        color: #e2e8f0;
        font-family: system-ui, sans-serif;
    }

    .components-panel__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 10px;
    }

    .components-panel__title {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #94a3b8;
    }

    .components-panel__new {
        font-size: 11px;
        color: #38bdf8;
        background: none;
        border: 1px solid #334155;
        border-radius: 6px;
        padding: 3px 8px;
        cursor: pointer;
    }

    .components-panel__new:hover {
        border-color: #38bdf8;
    }

    .components-panel__empty {
        font-size: 12px;
        color: #64748b;
        line-height: 1.5;
    }

    .components-panel__list {
        display: flex;
        flex-direction: column;
        gap: 4px;
        overflow-y: auto;
    }

    .component-item {
        display: flex;
        align-items: center;
        gap: 4px;
        border: 1px solid #1f2937;
        border-radius: 8px;
        background: rgba(15, 23, 42, 0.5);
        padding: 4px;
    }

    .component-item__main {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
        background: none;
        border: none;
        color: inherit;
        text-align: left;
        cursor: pointer;
        padding: 4px 6px;
        border-radius: 6px;
    }

    .component-item__main:hover {
        background: rgba(148, 163, 184, 0.1);
    }

    .component-item__name {
        font-size: 13px;
        font-weight: 600;
    }

    .component-item__meta {
        font-size: 11px;
        color: #64748b;
    }

    .component-item__action {
        flex-shrink: 0;
        font-size: 11px;
        color: #cbd5e1;
        background: rgba(15, 23, 42, 0.8);
        border: 1px solid #334155;
        border-radius: 6px;
        padding: 4px 8px;
        cursor: pointer;
    }

    .component-item__action:hover {
        border-color: #38bdf8;
        color: #f8fafc;
    }

    .component-item__remove {
        flex-shrink: 0;
        font-size: 12px;
        color: #64748b;
        background: none;
        border: none;
        cursor: pointer;
        padding: 2px 6px;
    }

    .component-item__remove:hover {
        color: #f87171;
    }
</style>
