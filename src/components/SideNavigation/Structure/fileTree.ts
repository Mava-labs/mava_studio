import { exists, readTextFile } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import type { Course, Lesson, Module, Page, ProjectData } from "../../../types/project";
import { readJSON } from "../../../utils/diskIO";

export type ExplorerNodeKind = "course" | "module" | "lesson" | "page";

export type ExplorerNode = {
  id: string;
  name: string;
  kind: ExplorerNodeKind;
  children?: ExplorerNode[];
  meta?: {
    moduleId?: string;
    lessonId?: string;
    pageId?: string;
    visible?: boolean;
  };
};

type MinimalModule = Pick<Module, "id" | "visible" | "lessons">;
type MinimalLesson = Pick<Lesson, "id" | "visible" | "pages">;
type MinimalCourse = Pick<Course, "id" | "modules" | "metadata">;
type MinimalPage = Pick<Page, "id" | "metadata" | "visible">;



export async function buildExplorerTree(projectPath: string | null | undefined): Promise<ExplorerNode[]> {
    if (!projectPath) return [];

    const projectFile = await join(projectPath, "project.mava");
    const project = await readJSON<ProjectData>(projectFile);
    if (!project) return [];

    const course = project.course as MinimalCourse;

    const modules = await Promise.all(
        [...course.modules]
        .sort((a, b) => a.order - b.order)
        .map(async (moduleRef) => {
            const modulePath = await join(projectPath, "modules", `${moduleRef.id}.json`);
            const module = await readJSON<MinimalModule>(modulePath);
            if (!module) return null;

            const lessons = await Promise.all(
            [...module.lessons]
                .sort((a, b) => a.order - b.order)
                .map(async (lessonRef) => {
                    const lessonPath = await join(projectPath, "lessons", `${lessonRef.id}.json`);
                    const lesson = await readJSON<MinimalLesson>(lessonPath);
                    if (!lesson) return null;

                    const pages = await Promise.all(
                        [...lesson.pages]
                        .sort((a, b) => a.order - b.order)
                        .map(async (pageRef) => {
                            const pagePath = await join(projectPath, "pages", `${pageRef.id}.json`);
                            const page = await readJSON<MinimalPage>(pagePath);
                            if (!page) return null;

                            return {
                                id: page.id,
                                name: page.metadata.title || "Untitled page",
                                kind: "page" as const,
                                meta: {
                                    moduleId: module.id,
                                    lessonId: lesson.id,
                                    pageId: page.id,
                                    visible: page.visible,
                                },
                            } satisfies ExplorerNode;
                        })
                    );

                    const filteredPages = pages.filter(Boolean) as ExplorerNode[];

                    return {
                        id: lesson.id,
                        name: lessonRef.name,
                        kind: "lesson" as const,
                        meta: { moduleId: module.id, lessonId: lesson.id, visible: lesson.visible },
                        children: filteredPages,
                    } satisfies ExplorerNode;
                })
            );

            const filteredLessons = lessons.filter(Boolean) as ExplorerNode[];

            return {
                id: module.id,
                name: moduleRef.name,
                kind: "module" as const,
                meta: { moduleId: module.id, visible: module.visible },
                children: filteredLessons,
            } satisfies ExplorerNode;
        })
    );

    const filteredModules = modules.filter(Boolean) as ExplorerNode[];

    return [
        {
            id: course.id,
            name: course.metadata.title || "Untitled course",
            kind: "course",
            children: filteredModules,
        },
    ];
}
