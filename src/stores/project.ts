import { defineStore } from "pinia";
import { computed, Ref, ref } from "vue";
import { join } from "@tauri-apps/api/path";
import { mkdir, exists, writeTextFile } from "@tauri-apps/plugin-fs";
import { Author, Course, CURRENT_PROJECT_VERSION, Lesson, Module, Page, ProjectData } from "../types/project";
import { generateId } from "../utils/id";

const PROJECT_FILE_NAME = "mava.project.json";

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

        function createProject(params: { name: string; path: string; authors?: Author[] }) {
            // ---- Root IDs ----
        const projectId = generateId("project");
        const courseId = generateId("course");
        const moduleId = generateId("module");
        const lessonId = generateId("lesson");
        const pageId = generateId("page");
        const now = Date.now();
        const course: Course = {
            id: courseId,
            modules: [{ id: moduleId, order: 1 }],
            cfNodeIds: [],
            metadata: {
                title: 'Untitled Course', description: '', duration: 0, version: 1,
                createdAt: now, updatedAt: now, lastEditedBy: { userId: 'system', name: 'System' }, publishedAt: 'pending'
            }
        };
        const module: Module = {
            id: moduleId, visible: true, lessons: [{ id: lessonId, order: 1 }], metadata: {
                title: 'Module 1', description: '', duration: 0, version: 1, createdAt: now, updatedAt: now, lastEditedBy: { userId: 'system', name: 'System' }
            }
        };
        const lesson: Lesson = {
            id: lessonId, type: 'activity', visible: true, pages: [{ id: pageId, order: 1 }], metadata: {
                title: 'Lesson 1', duration: 0, version: 1, createdAt: now, updatedAt: now, lastEditedBy: { userId: 'system', name: 'System' }
            }
        };
        const page: Page = {
            id: pageId, visible: true, elements: [], backgroundColor: '#ffffff', layouts: {
                desktop: { stageSize: { width: 1280, height: 720 }, elementProps: {} },
                tablet: { stageSize: { width: 1024, height: 768 }, elementProps: {} },
                mobile: { stageSize: { width: 375, height: 667 }, elementProps: {} }
            }, metadata: { title: 'Page 1', duration: 0, version: 1, createdAt: now, updatedAt: now, lastEditedBy: { userId: 'system', name: 'System' } }
        };
        project.value = {
            projectVersion: CURRENT_PROJECT_VERSION,
            projectId,
            projectName: params.name,
            projectPath: params.path,
            authors: params.authors || [],
            createdAt: now,
            updatedAt: now,
            course,
            modulesById: { [module.id]: module },
            lessonsById: { [lesson.id]: lesson },
            pagesById: { [page.id]: page },
            dslTriggers: {},
            actionScripts: {}
        };

        return project.value;
    }

    async function persistProjectToDisk(targetDir?: string) {
        const data = project.value;
        if (!data) throw new Error("No project loaded to persist");

        const directory = targetDir || data.projectPath;
        if (!directory) throw new Error("Missing project directory");

        const existsOnDisk = await exists(directory);
        if (!existsOnDisk) {
            await mkdir(directory, { recursive: true });
        }

        data.updatedAt = Date.now();
        const filePath = await join(directory, PROJECT_FILE_NAME);
        const payload = JSON.stringify(data, null, 2);
        await writeTextFile(filePath, payload);

        return filePath;
    }

    return { 
        setProjectName, setProjectPath, createProject, persistProjectToDisk,
        shallowProject, narrowProject, projectActions,
        project, openPages, activePath
    }
})

