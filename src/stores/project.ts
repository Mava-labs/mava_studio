import { defineStore } from "pinia";
import { computed, Ref, ref } from "vue";
import { Author, Course, CURRENT_PROJECT_VERSION, Lesson, Module, Page, ProjectData } from "../schemas/project";

export const useProjectStore = defineStore("project", () =>{
    const project: Ref<ProjectData | null> = ref(null);   
    const openPages: Ref<{pageTitle: string, lessonTitle: string, pageId: string}[]> = ref([]); // page IDs
    const activePath: Ref<{pageId: string, lessonId: string, moduleId: string} | null> = ref(null);
    const shallowProject = computed(() => {
        let { 
            projectName, projectPath, projectId, 
            createdAt, updatedAt, authors, course
        } = project.value || {};
        return { projectName, projectPath, projectId, createdAt, updatedAt, authors, course};
    });

    const narrowProject = computed(() => {
        let { modulesById, lessonsById, pagesById } = project.value || {};
        return { modulesById, lessonsById, pagesById };
    });

    const projectActions = computed(() => {
        let { actionScripts, dslTriggers } = project.value || {};
        return { actionScripts, dslTriggers };
    });
    
    function setProjectName(name: string) {
        project.value!.projectName = name;
    }

    function setProjectPath(path: string) {
        project.value!.projectPath = path;
    }

    function createProject(data: { name: string; path?: string; authors?: Author[] }) {
        const now = Date.now();
        const course: Course = {
            id: 'course-1',
            modules: [{ id: 'module-1', order: 1 }],
            cfNodeIds: [],
            metadata: {
                title: 'Untitled Course', description: '', duration: 0, version: 1,
                createdAt: now, updatedAt: now, lastEditedBy: { userId: 'system', name: 'System' }, publishedAt: 'pending'
            }
        };
        const module: Module = {
            id: 'module-1', visible: true, lessons: [{ id: 'lesson-1', order: 1 }], metadata: {
                title: 'Module 1', description: '', duration: 0, version: 1, createdAt: now, updatedAt: now, lastEditedBy: { userId: 'system', name: 'System' }
            }
        };
        const lesson: Lesson = {
            id: 'lesson-1', type: 'activity', visible: true, pages: [{ id: 'page-1', order: 1 }], metadata: {
                title: 'Lesson 1', duration: 0, version: 1, createdAt: now, updatedAt: now, lastEditedBy: { userId: 'system', name: 'System' }
            }
        };
        const page: Page = {
            id: 'page-1', visible: true, elements: [], backgroundColor: '#ffffff', layouts: {
                desktop: { stageSize: { width: 1280, height: 720 }, elementProps: {} },
                tablet: { stageSize: { width: 1024, height: 768 }, elementProps: {} },
                mobile: { stageSize: { width: 375, height: 667 }, elementProps: {} }
            }, metadata: { title: 'Page 1', duration: 0, version: 1, createdAt: now, updatedAt: now, lastEditedBy: { userId: 'system', name: 'System' } }
        };
        project.value = {
            projectVersion: CURRENT_PROJECT_VERSION,
            projectId: `project-${now}`,
            projectName: data.name,
            projectPath: data.path,
            authors: data.authors || [],
            createdAt: now,
            updatedAt: now,
            course,
            modulesById: { [module.id]: module },
            lessonsById: { [lesson.id]: lesson },
            pagesById: { [page.id]: page },
            dslTriggers: {},
            actionScripts: {}
        };
    }

    return { 
        setProjectName, setProjectPath, createProject,
        shallowProject, narrowProject, projectActions,
        project, openPages, activePath
    }
})

