import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { generateId } from "../utils/id";
import type { Author, Course, Lesson, Module, Page, ProjectData } from "../types/project";
import type { Element } from "../types/element";
import { tauriStorage } from "../utils/tauriStorage";
import { join } from "@tauri-apps/api/path";
import { ensureDir, writeJSON } from "../utils/diskIO";

const DEFAULT_STAGE = {
    width: 1280,
    height: 720,
    background: "#1d293d",
};

export const useProjectMetadataStore = defineStore(
    "projectMetadata",
    () => {
        const PROJECT_FILE = "project.mava";
        const projectId = ref<string | null>(null);
        const projectName = ref<string>("");
        const projectPath = ref<string | null>(null);
        const projectArchivePath = ref<string | null>(null);
        const authors = ref<Author[]>([]);
        const course = ref<Course | null>(null);
        const createdAt = ref<number>(0);
        const updatedAt = ref<number>(0);
        const projectVersion = ref<number>(1);

        const shallowProject = computed(() => ({
            projectId: projectId.value,
            projectName: projectName.value,
            projectPath: projectPath.value,
            projectArchivePath: projectArchivePath.value,
            authors: authors.value,
            course: course.value,
            createdAt: createdAt.value,
            updatedAt: updatedAt.value,
            projectVersion: projectVersion.value,
        }));

        function setProjectName(name: string) {
            projectName.value = name;
            updatedAt.value = Date.now();
        }

        function setProjectPath(path: string) {
            projectPath.value = path;
            updatedAt.value = Date.now();
        }

        function setProjectArchivePath(path: string | null) {
            projectArchivePath.value = path;
            updatedAt.value = Date.now();
        }

        async function createProjectAndPersist(params: {
            name: string;
            path: string; // working directory where files are materialized
            archivePath?: string | null; // optional .mava archive path for later packing
            authors?: Author[];
        }) {
            const now = Date.now();

            // ----------------------------
            // IDs
            // ----------------------------
            const newProjectId = generateId("project");
            const newCourseId = generateId("course");
            const newModuleId = generateId("module");
            const newLessonId = generateId("lesson");
            const newPageId = generateId("page");
            const newElementId = generateId("el");

            // ----------------------------
            // Directories
            // ----------------------------
            const root = params.path;

            const dirs = {
                modules: await join(root, "modules"),
                lessons: await join(root, "lessons"),
                pages: await join(root, "pages"),
                scripts: await join(root, "scripts"),
                triggers: await join(root, "triggers"),
                assets: await join(root, "assets"),
            };

            await ensureDir(root);
            await Promise.all(Object.values(dirs).map(ensureDir));

            // ----------------------------
            // Course
            // ----------------------------
            const newCourse: Course = {
                id: newCourseId,
                modules: [{ name: "Module 1", id: newModuleId, order: 1 }],
                cfNodeIds: [],
                metadata: {
                    title: "untitled course",
                    description: "",
                    duration: 0,
                    publishedAt: 'pending',
                    version: 1,
                    createdAt: now,
                    updatedAt: now,
                    lastEditedBy: {
                        userId: "system",
                        name: "System"
                    }
                },
            };

            // ----------------------------
            // Module
            // ----------------------------
            const module: Module = {
                id: newModuleId,
                visible: true,
                lessons: [{name: "Lesson 1", id: newLessonId, order: 1 }],
                metadata: {
                    title: "Module 1",
                    duration: 0,
                    version: 1,
                    createdAt: now,
                    updatedAt: now,
                    lastEditedBy: {
                        userId: "system",
                        name: "System"
                    }
                },
            };

            // ----------------------------
            // Lesson
            // ----------------------------
            const lesson: Lesson = {
                id: newLessonId,
                type: "activity",
                visible: true,
                pages: [{name: "Page 1", id: newPageId, order: 1 }],
                metadata: {
                    title: "Lesson 1",
                    duration: 0,
                    version: 1,
                    createdAt: now,
                    updatedAt: now,
                    lastEditedBy: {
                        userId: "system",
                        name: "System"
                    }
                },
            };

            // ----------------------------
            // Page
            // ----------------------------
            const mockTextElement: Element = {
                id: newElementId,
                name: "Welcome Text",
                type: "text",
                children: [],
                layout: {
                    positioning: {
                        mode: "flow"
                    },
                    size: { width: 520, height: 120 },
                    visible: true,
                },
                effects: { opacity: 1 },
                style: {
                    content: "Double-click to edit me",
                    font: { size: 28, weight: "bold", family: "Inter, sans-serif" },
                    transform: "Normal",
                    color: "#ffffff",
                    align: "left",
                    lineHeight: 34,
                    decoration: "none",
                },
            };

            const page: Page = {
                id: newPageId,
                visible: true,
                elements: { [newElementId]: mockTextElement },
                roots: [newElementId],
                stage: {
                    width: DEFAULT_STAGE.width,
                    height: DEFAULT_STAGE.height,
                    background: DEFAULT_STAGE.background,
                    display: { columns: 1, rows: 3, gap: 0 },
                },
                metadata: {
                    title: "Page 1",
                    version: 1,
                    createdAt: now,
                    updatedAt: now,
                    lastEditedBy: {
                        userId: "system",
                        name: "System"
                    }
                },
            };

            // ----------------------------
            // Root Project Metadata
            // ----------------------------
            const project: ProjectData = {
                projectVersion: 1,
                projectId: newProjectId,
                projectName: params.name,
                projectPath: root,
                authors: params.authors || [],
                createdAt: now,
                updatedAt: now,
                course: newCourse,
                modulesById: { [newModuleId]: { id: newModuleId } as any },
                lessonsById: { [newLessonId]: { id: newLessonId } as any },
                pagesById: { [newPageId]: { id: newPageId } as any },
                dslTriggers: {},
                actionScripts: {},
            };

            // ----------------------------
            // Persist Everything
            // ----------------------------
            await Promise.all([
                writeJSON(await join(root, PROJECT_FILE), project),
                writeJSON(await join(dirs.modules, `${newModuleId}.json`), module),
                writeJSON(await join(dirs.lessons, `${newLessonId}.json`), lesson),
                writeJSON(await join(dirs.pages, `${newPageId}.json`), page),
                writeJSON(await join(dirs.scripts, "actions.json"), {}),
                writeJSON(await join(dirs.triggers, "dsl.json"), {}),
            ]);

            projectId.value = project.projectId;
            projectName.value = project.projectName;
            projectPath.value = project.projectPath || null;
            projectArchivePath.value = params.archivePath ?? null;
            course.value = project.course;
            createdAt.value = project.createdAt;
            updatedAt.value = project.updatedAt;

            return {
                projectId,
                newCourseId,
                newModuleId,
                newLessonId,
                newPageId,
                root,
            };
        }

        return {
            projectId, projectName, projectPath,
            projectArchivePath,
            authors, course, createdAt, updatedAt,
            projectVersion, shallowProject,
            setProjectName, setProjectPath, setProjectArchivePath,
            createProjectAndPersist,
        };
    },
    {
        persist: {
            storage: tauriStorage as any,
            // Only persist metadata fields; pages stored separately
            pick: ["projectId", "projectName", "projectPath", "projectArchivePath", "authors", "course", "createdAt", "updatedAt", "projectVersion"],
        },
    }
);
