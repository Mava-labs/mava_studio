import type { Course, Lesson, Module, ProjectData } from "../types/project";

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
type MinimalPageMeta = {
    id: string;
    name: string;
    lessonId: string;
    order: number;
};



export function buildExplorerTree(project: ProjectData, pageMetaById: Record<string, MinimalPageMeta>): ExplorerNode[] {
    if (!project) return [];
    const course = project.course as MinimalCourse;
    const modules = [...course.modules]
        .sort((a, b) => a.order - b.order)
        .map(moduleRef => {
            const module = project.modulesById[moduleRef.id] as MinimalModule;
            if (!module) return null;

            const lessons = [...module.lessons]
                .sort((a, b) => a.order - b.order)
                .map(lessonRef => {
                    const lesson = project.lessonsById[lessonRef.id] as MinimalLesson;
                    if (!lesson) return null;

                    const pages = [...lesson.pages]
                        .sort((a, b) => a.order - b.order)
                        .map(pageRef => {
                            const page = pageMetaById[pageRef.id];
                            if (!page) return null;

                            return {
                                id: page.id,
                                name: page.name || "Untitled page",
                                kind: "page" as const,
                                meta: {
                                    moduleId: module.id,
                                    lessonId: lesson.id,
                                    pageId: page.id,
                                    visible: true,
                                },
                            } satisfies ExplorerNode;
                        })


                    const filteredPages = pages.filter(Boolean) as ExplorerNode[];

                    return {
                        id: lesson.id,
                        name: lessonRef.name,
                        kind: "lesson" as const,
                        meta: { moduleId: module.id, lessonId: lesson.id, visible: lesson.visible },
                        children: filteredPages,
                    } satisfies ExplorerNode;
                })

            const filteredLessons = lessons.filter(Boolean) as ExplorerNode[];

            return {
                id: module.id,
                name: moduleRef.name,
                kind: "module" as const,
                meta: { moduleId: module.id, visible: module.visible },
                children: filteredLessons,
            } satisfies ExplorerNode;
        })

    const filteredModules = modules.filter(Boolean) as ExplorerNode[];

    return [
        {
            id: course.id,
            name: course.metadata.title || "Untitled course",
            kind: "course",
            children: filteredModules,
        },
    ];
};
