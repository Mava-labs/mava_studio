import type { Element } from './element';
import type {
    CourseFrameworkAlignment,
    ModuleCFAlignment,
    LessonCFAlignment,
    AssessmentCFAlignment,
} from './cf-alignment.types';

// Project data schema version (increment on breaking structural changes)
export const CURRENT_PROJECT_VERSION = 2 as const;

// ─── Unchanged layout types ───────────────────────────────────────────────────

export type GridDisplay = {
    columns: string,
    rows: string,
    gap: string
}

export type FlexDisplay = {
    grow: number,
    row: boolean,
    spacing: 'space-between' | 'evenly-spaced' | 'start' | 'end'
    direction: 'row' | 'column' | 'row-reverse' | 'column-reverse'
    wrap: 'nowrap' | 'wrap' | 'wrap-reverse'
    gap: string
    alignItems: 'start' | 'center' | 'end' | 'stretch'
    justifyContent: 'start' | 'center' | 'end' | 'space-between' | 'space-around' | 'space-evenly'
}

// ─────────────────────────────────────────────────────────────────────────────

export type Page = {
    id: string;
    visible: boolean;

    stage: {
        width: number;
        height: number;
        background: string;
    };

    elements: Record<string, Element>;
    rootIds: string[]

    metadata: {
        title: string;
        description?: string;
        duration?: number;
        version: number;
        createdAt: number;
        updatedAt: number;
        lastEditedBy: {
            userId: string;
            name: string;
        };
    };
};

export interface DSLTriggerDocument {
    id: string;
    scope: 'global' | 'page';
    pageId?: string | null;
    dslSource: string;
    enabled: boolean;
    createdAt: number;
    updatedAt: number;
    lastError?: string | null;
}

export interface ScriptDef {
    id: string;
    name: string;
    scope: 'global' | 'page';
    codeTs: string;
    compiledJs?: string;
}

export type Author = {
    userId: string;
    name: string;
    email?: string;
    role: 'owner' | 'editor' | 'supervisor';
};

// ─────────────────────────────────────────────────────────────────────────────
// LESSON
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lesson type — extended for CF inspection.
 *
 * activity    — learning content; may declare LessonCFAlignment (indicator coverage)
 * assessment  — produces CF evidence; must carry AssessmentCFAlignment and contain
 *               a ComponentElement with a matching cf_proof
 * practice    — low-stakes exercises; may partially address indicators;
 *               Inspector treats as supporting material, not proof
 * reference   — pure resource material; Inspector ignores entirely for coverage checks
 *
 * Previous: "activity" | "assessment"
 * Added:    "practice" | "reference"
 */
export type LessonType = 'activity' | 'assessment' | 'practice' | 'reference';

export type Lesson = {
    id: string;

    /**
     * Extended lesson type. The Inspector uses this to decide:
     *   activity   → check indicator coverage
     *   assessment → check indicator coverage + evidence proof chain
     *   practice   → informational only
     *   reference  → skip entirely
     */
    type: LessonType;

    visible: boolean;
    pages: {
        name: string;
        id: string;
        order: number;
    }[];

    /**
     * CF alignment for this lesson.
     *
     * Replaces cfNodeIds?: string[]
     *
     * - activity / practice lessons → LessonCFAlignment (indicators only)
     * - assessment lessons          → AssessmentCFAlignment (indicators + evidence item)
     * - reference lessons           → omit (no CF claim)
     *
     * Discriminate with isAssessmentAlignment() from cf-alignment.types.ts
     */
    cf_alignment?: LessonCFAlignment | AssessmentCFAlignment;

    summary?: string;
    metadata: {
        title: string;
        description?: string;
        duration: number;
        url?: string;
        version: number;
        createdAt: number;
        updatedAt: number;
        lastEditedBy: {
            userId: string;
            name: string;
        };
        estimatedCompletionTime?: number;
        required?: boolean;
        autoComplete?: boolean;
        prerequisites?: string[];
        tags?: string[];
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// MODULE
// ─────────────────────────────────────────────────────────────────────────────

export type Module = {
    id: string;
    visible: boolean;
    lessons: {
        name: string;
        id: string;
        order: number;
    }[];
    notes?: string;

    /**
     * CF alignment for this module.
     *
     * Replaces cfNodeIds?: string[]
     *
     * Exactly one competency per module. A domain with N competencies
     * requires N modules to achieve full domain coverage.
     * Domain is implicit — derivable from the CF via competency_id.
     *
     * Inspector check: one module → one competency → all lessons under
     * this module must align to the same competency_id.
     */
    cf_alignment?: ModuleCFAlignment;

    metadata: {
        title: string;
        description?: string;
        duration: number;
        url?: string;
        version: number;
        createdAt: number;
        updatedAt: number;
        lastEditedBy: {
            userId: string;
            name: string;
        };
        overview?: string;
        estimatedCompletionTime?: number;
        prerequisites?: string[];
        unlockConditions?: string[];
        tags?: string[];
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// COURSE
// ─────────────────────────────────────────────────────────────────────────────

export type Course = {
    id: string;
    modules: {
        name: string;
        id: string;
        order: number;
    }[];

    /**
     * CF alignments for this course — one entry per aligned framework.
     *
     * Replaces cfNodeIds: string[]
     *
     * A course may align to multiple frameworks (e.g. combining micro-frameworks
     * to achieve a composite skill). Each entry pins a specific CF version and
     * checksum. The Inspector runs once per entry and produces one InspectorReport
     * per framework.
     *
     * The corresponding CourseBrief for each alignment lives in app-data
     * (not in the .mava file) and is keyed by cf_alignments[n].brief_id.
     */
    cf_alignments: CourseFrameworkAlignment[];

    metadata: {
        title: string;
        subtitle?: string;
        description: string;
        category?: string;
        targetAudience?: string;
        difficulty?: 'beginner' | 'intermediate' | 'advanced';
        duration: number;
        prerequisites?: string[];
        tags?: string[];
        coverImage?: string;
        author?: string;
        languages?: string[];
        visibility?: 'public' | 'private' | 'draft';
        licensing?: string;
        pricing?: { type: 'free' | 'one-time' | 'subscription'; amount?: number; currency?: string };
        releaseSchedule?: 'all-at-once' | 'drip';
        completionRequirements?: string[];
        url?: string;
        publishedAt: number | 'pending';
        version: number;
        createdAt: number;
        updatedAt: number;
        lastEditedBy: {
            userId: string;
            name: string;
        };
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT DATA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalized project container.
 *
 * Changes from v1:
 *   - CURRENT_PROJECT_VERSION bumped to 2
 *   - Course.cfNodeIds replaced by Course.cf_alignments (CourseFrameworkAlignment[])
 *   - Module.cfNodeIds replaced by Module.cf_alignment (ModuleCFAlignment | undefined)
 *   - Lesson.cfNodeIds replaced by Lesson.cf_alignment (LessonCFAlignment | AssessmentCFAlignment | undefined)
 *   - Lesson.type extended to LessonType ('activity' | 'assessment' | 'practice' | 'reference')
 *
 * NOT changed (intentionally excluded from .mava):
 *   - CourseBrief (Mapper output) — recomputed on project open from app-data CF cache
 *   - InspectorReport — recomputed on project open and on content change
 */
export type ProjectData = {
    projectVersion: number;
    projectId: string;
    projectName: string;
    projectPath?: string;
    projectArchivePath?: string | null;
    createdAt: number;
    updatedAt: number;
    authors: Author[];
    course: Course;
    modulesById: Record<string, Module>;
    lessonsById: Record<string, Lesson>;
    pagesById: Record<string, Page>;
    componentLibrary: Record<string, Element>;
    mediaLibrary: Record<string, { id: string; name: string; type: string; url: string }>;
    dslTriggers: Record<string, DSLTriggerDocument>;
    actionScripts: Record<string, ScriptDef>;
};

export type HistoryMeta = {
    lastCommitAt: number;
    lastCommitId?: string;
    rev?: number;
};

export function deepClone<T>(obj: T): T {
    // @ts-ignore structuredClone global may not be in lib target
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(obj);
        } catch {
            // fall through
        }
    }
    return JSON.parse(JSON.stringify(obj));
}

// ─────────────────────────────────────────────────────────────────────────────
// MIGRATION HELPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Migrates a v1 ProjectData to v2.
 * Converts the old cfNodeIds string[] fields to the new typed alignment fields.
 *
 * Call this when opening a project with projectVersion < 2.
 *
 * Strategy:
 *   - Course.cfNodeIds  → Course.cf_alignments = [] (empty; author must re-run Mapper)
 *   - Module.cfNodeIds  → Module.cf_alignment = undefined (author must reassign)
 *   - Lesson.cfNodeIds  → Lesson.cf_alignment = undefined (author must reassign)
 *
 * The old cfNodeIds are preserved in migration_notes for reference until the
 * author has completed re-alignment.
 */
export function migrateV1toV2(project: any): ProjectData {
    const migrated = deepClone(project) as any;

    // Bump version
    migrated.projectVersion = 2;

    // Course: drop cfNodeIds, initialise cf_alignments
    if (Array.isArray(migrated.course?.cfNodeIds)) {
        migrated.course._migration_notes = {
            v1_cfNodeIds: migrated.course.cfNodeIds,
            note: 'Re-run CF Mapper to restore framework alignment',
        };
        delete migrated.course.cfNodeIds;
    }
    migrated.course.cf_alignments = migrated.course.cf_alignments ?? [];

    // Modules: drop cfNodeIds
    for (const module of Object.values(migrated.modulesById ?? {}) as any[]) {
        if (Array.isArray(module.cfNodeIds)) {
            module._migration_notes = {
                v1_cfNodeIds: module.cfNodeIds,
                note: 'Re-assign competency alignment via CF Mapper panel',
            };
            delete module.cfNodeIds;
        }
        module.cf_alignment = module.cf_alignment ?? undefined;
    }

    // Lessons: drop cfNodeIds, extend type
    for (const lesson of Object.values(migrated.lessonsById ?? {}) as any[]) {
        if (Array.isArray(lesson.cfNodeIds)) {
            lesson._migration_notes = {
                v1_cfNodeIds: lesson.cfNodeIds,
                note: 'Re-assign indicator/evidence alignment via Inspector panel',
            };
            delete lesson.cfNodeIds;
        }
        lesson.cf_alignment = lesson.cf_alignment ?? undefined;
        // Preserve existing type; it already fits the extended LessonType union
    }

    return migrated as ProjectData;
}
