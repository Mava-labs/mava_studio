import { computed, ref, watch } from "vue";
import { useProjectStore } from "../../../stores/project";
import type { Element, ElementType } from "../../../types/element";
import type { Lesson, Module, Page, ProjectData } from "../../../types/project";

export type ElementNode = { element: Element; children: ElementNode[] };
export type OutlineRow = { node: ElementNode; depth: number; hasChildren: boolean };

export function useStructureModel() {
  const project = useProjectStore();

  const explorerCollapsed = ref(false);
  const outlineCollapsed = ref(false);
  const autoReveal = ref(true);
  const expandedModules = ref<Set<string>>(new Set());
  const expandedLessons = ref<Set<string>>(new Set());
  const expandedElements = ref<Set<string>>(new Set());
  const selectedElementId = ref<string | null>(null);

  const projectLabel = computed(() => project.project?.projectName || "Workspace");

  const modules = computed<Module[]>(() => {
    const data = project.project;
    if (!data) return [];
    return (data.course.modules || [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((refItem) => data.modulesById[refItem.id])
      .filter(Boolean);
  });

  const activePage = computed<Page | null>(() => {
    const data = project.project;
    const path = project.activePath;
    if (!data || !path) return null;
    return data.pagesById[path.pageId] || null;
  });

  const outlineTree = computed<ElementNode[]>(() => buildElementTree(activePage.value?.elements || []));
  const flatOutline = computed<OutlineRow[]>(() => flattenElementTree(outlineTree.value, expandedElements.value));

  watch(
    () => project.project,
    (data) => {
      if (data) {
        ensureActivePath(data);
      } else {
        resetLocalState();
      }
    },
    { immediate: true }
  );

  watch(
    () => project.activePath,
    (path) => {
      if (path) openAncestors(path);
    },
    { deep: true }
  );

  watch(
    () => activePage.value?.id,
    () => {
      selectedElementId.value = null;
      expandedElements.value = new Set(outlineTree.value.map((node) => node.element.id));
    }
  );

  function lessonsForModule(moduleId: string): Lesson[] {
    const data = project.project;
    if (!data) return [];
    const module = data.modulesById[moduleId];
    if (!module) return [];
    return module.lessons
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((refItem) => data.lessonsById[refItem.id])
      .filter(Boolean);
  }

  function pagesForLesson(lessonId: string): Page[] {
    const data = project.project;
    if (!data) return [];
    const lesson = data.lessonsById[lessonId];
    if (!lesson) return [];
    return lesson.pages
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((refItem) => data.pagesById[refItem.id])
      .filter(Boolean);
  }

  function buildElementTree(elements: Element[]): ElementNode[] {
    const byParent = new Map<string | undefined, Element[]>();
    elements.forEach((el) => {
      const key = el.parentId;
      const bucket = byParent.get(key) || [];
      bucket.push(el);
      byParent.set(key, bucket);
    });

    const toNodes = (parentId?: string): ElementNode[] => {
      const bucket = byParent.get(parentId) || [];
      const sorted = bucket.slice().sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
      return sorted.map((el) => ({ element: el, children: toNodes(el.id) }));
    };

    return toNodes(undefined);
  }

  function flattenElementTree(nodes: ElementNode[], expanded: Set<string>, depth = 0): OutlineRow[] {
    const rows: OutlineRow[] = [];
    nodes.forEach((node) => {
      const hasChildren = node.children.length > 0;
      rows.push({ node, depth, hasChildren });
      if (hasChildren && expanded.has(node.element.id)) {
        rows.push(...flattenElementTree(node.children, expanded, depth + 1));
      }
    });
    return rows;
  }

  function ensureActivePath(data: ProjectData) {
    if (project.activePath) {
      openAncestors(project.activePath);
      return;
    }

    const firstModuleRef = (data.course.modules || []).slice().sort((a, b) => a.order - b.order)[0];
    const firstModule = firstModuleRef ? data.modulesById[firstModuleRef.id] : null;
    const firstLessonRef = firstModule?.lessons?.slice().sort((a, b) => a.order - b.order)[0];
    const firstLesson = firstLessonRef ? data.lessonsById[firstLessonRef.id] : null;
    const firstPageRef = firstLesson?.pages?.slice().sort((a, b) => a.order - b.order)[0];
    const firstPage = firstPageRef ? data.pagesById[firstPageRef.id] : null;

    if (firstModule && firstLesson && firstPage) {
      project.activePath = { moduleId: firstModule.id, lessonId: firstLesson.id, pageId: firstPage.id };
      openAncestors(project.activePath);
    }
  }

  function openAncestors(path: { moduleId: string; lessonId: string }) {
    expandedModules.value = addToSet(expandedModules.value, path.moduleId);
    expandedLessons.value = addToSet(expandedLessons.value, path.lessonId);
  }

  function resetLocalState() {
    expandedModules.value = new Set();
    expandedLessons.value = new Set();
    expandedElements.value = new Set();
    selectedElementId.value = null;
  }

  function addToSet(setRef: Set<string>, id: string) {
    const next = new Set(setRef);
    next.add(id);
    return next;
  }

  function toggleModule(id: string) {
    expandedModules.value = toggleSet(expandedModules.value, id);
  }

  function toggleLesson(id: string) {
    expandedLessons.value = toggleSet(expandedLessons.value, id);
  }

  function toggleElement(id: string) {
    expandedElements.value = toggleSet(expandedElements.value, id);
  }

  function toggleSet(setRef: Set<string>, id: string) {
    const next = new Set(setRef);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  }

  function isModuleExpanded(id: string) {
    return expandedModules.value.has(id);
  }

  function isLessonExpanded(id: string) {
    return expandedLessons.value.has(id);
  }

  function collapseAllExplorer() {
    expandedModules.value = new Set();
    expandedLessons.value = new Set();
  }

  function expandAllOutline() {
    const ids = new Set<string>();
    outlineTree.value.forEach((node) => collectElementIds(node, ids));
    expandedElements.value = ids;
  }

  function collectElementIds(node: ElementNode, ids: Set<string>) {
    ids.add(node.element.id);
    node.children.forEach((child) => collectElementIds(child, ids));
  }

  function selectModule(module: Module) {
    const lesson = lessonsForModule(module.id)[0];
    if (!lesson) return;
    const page = pagesForLesson(lesson.id)[0];
    if (!page) return;
    selectPage(module.id, lesson.id, page);
  }

  function selectLesson(moduleId: string, lesson: Lesson) {
    const page = pagesForLesson(lesson.id)[0];
    if (!page) return;
    selectPage(moduleId, lesson.id, page);
  }

  function selectPage(moduleId: string, lessonId: string, page: Page) {
    project.activePath = { moduleId, lessonId, pageId: page.id };
    openAncestors({ moduleId, lessonId });
  }

  function selectElement(elementId: string) {
    selectedElementId.value = elementId;
    if (autoReveal.value) expandedElements.value = addToSet(expandedElements.value, elementId);
  }

  function toggleExplorerCollapsed() {
    explorerCollapsed.value = !explorerCollapsed.value;
  }

  function toggleOutlineCollapsed() {
    outlineCollapsed.value = !outlineCollapsed.value;
  }

  function formatElementLabel(type: ElementType) {
    return type.charAt(0).toUpperCase() + type.slice(1);
  }

  function elementIconPath(type: ElementType, hasChildren: boolean) {
    if (hasChildren || type === "collection" || type === "component") {
      return "M4 4h12v10H4z";
    }
    if (type === "text") return "M4 4h12v2H4V4zm4 3h4v2H8V7zm0 3h6v2H8v-2z";
    if (type === "image") return "M4 4h12v10H4V4zm2 2v6h8V6H6zm6 3a1 1 0 11-2 0 1 1 0 012 0z";
    if (type === "ellipse" || type === "circle") return "M10 4a6 6 0 110 12 6 6 0 010-12z";
    if (type === "rectangle") return "M4 5h12v8H4V5z";
    if (type === "line") return "M5 10h10v1H5z";
    if (type === "path") return "M4 12c2-4 6-4 8 0l2-6";
    if (type === "polygon") return "M10 3l5 5-2 7H7L5 8l5-5z";
    if (type === "hotspot") return "M10 3a4 4 0 014 4c0 3-4 7-4 7s-4-4-4-7a4 4 0 014-4zm0 5.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z";
    return "M4 4h12v10H4z";
  }

  function setAutoReveal(next: boolean) {
    autoReveal.value = next;
  }

  return {
    project,
    projectLabel,
    modules,
    activePage,
    flatOutline,
    outlineTree,
    explorerCollapsed,
    outlineCollapsed,
    autoReveal,
    expandedElements,
    selectedElementId,
    isModuleExpanded,
    isLessonExpanded,
    toggleModule,
    toggleLesson,
    toggleElement,
    collapseAllExplorer,
    expandAllOutline,
    selectModule,
    selectLesson,
    selectPage,
    selectElement,
    toggleExplorerCollapsed,
    toggleOutlineCollapsed,
    formatElementLabel,
    elementIconPath,
    lessonsForModule,
    pagesForLesson,
    setAutoReveal,
  };
}
