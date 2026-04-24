// =============================================================================
// mava-studio/types/cf-alignment.types.ts
//
// All CF-related types consumed by Mava Studio — project alignment,
// project inspector slice, Mapper output (CourseBrief),
// Inspector output (InspectorReport), element-level proof,
// and the component registry.
//
// DEPENDENCY: imports primitive enums from cf.types.ts (shared with CF Builder).
// Copy cf.types.ts into mava-studio/types/ and import from './cf.types' until
// the shared @bitpulse/cf-types package exists.
// =============================================================================

import type {
    EvidenceType,
    BloomLevel,
    ValidatorMode,
    ProficiencyLevel,
    CompetenceFramework,
    Rubric,
} from './cf.types'

// Re-export primitives consumed by components that only import from this file
export type {
    EvidenceType,
    BloomLevel,
    ValidatorMode,
    ProficiencyLevel,
    CompetenceFramework,
    Rubric,
} from './cf.types'

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — PROJECT-LEVEL ALIGNMENT TYPES
// Persisted in the .mava file inside ProjectData.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Course-level binding to a single published CompetenceFramework.
 * A course may align to multiple frameworks (micro-framework composition).
 * One entry per framework. Stored in Course.cf_alignments[].
 */
export interface CourseFrameworkAlignment {
    /** ID of the CompetenceFramework this course is aligned to */
    framework_id: string

    /**
     * Semver of the CF version pinned at Mapper run time.
     * Inspector warns when the published CF has a newer version.
     */
    framework_version: string

    /**
     * SHA-256 checksum of the canonical CF JSON at pin time.
     * Inspector flags drift if the cached CF checksum no longer matches.
     * Format: "sha256:<64 hex chars>"
     */
    framework_checksum: string

    /** Unix timestamp (ms) of when the Mapper last ran for this framework */
    aligned_at: number

    /**
     * References cfBriefs[brief_id] in app-data cache.
     * CourseBrief is NOT persisted in the .mava file — it is recomputed
     * from the cached CF JSON on project open.
     */
    brief_id: string

    /**
     * Human-readable name cached at align time so the UI can display it
     * without requiring the brief to be loaded.
     */
    framework_title: string
}

/**
 * Module-level binding. Exactly one competency per module.
 * Domain is implicit — derivable from the CF via competency_id.
 * A domain with N competencies requires N modules to be fully covered.
 */
export interface ModuleCFAlignment {
    /** Must reference one of the framework_ids in Course.cf_alignments */
    framework_id: string

    /** Exactly one competency. Enforced by Inspector. */
    competency_id: string
}

/**
 * Lesson-level binding for activity and practice lessons.
 * Declares which indicators this lesson addresses.
 */
export interface LessonCFAlignment {
    framework_id: string
    competency_id: string

    /**
     * IDs of indicators this lesson addresses.
     * Must reference indicator IDs from the named competency.
     * Inspector checks these against the CF indicator list.
     */
    indicator_ids: string[]
}

/**
 * Assessment-lesson binding — extends LessonCFAlignment with evidence proof.
 * Only lessons of type 'assessment' carry this shape.
 */
export interface AssessmentCFAlignment extends LessonCFAlignment {
    /**
     * ID of the EvidenceItem in the CF this lesson satisfies.
     * e.g. "ev_03_02"
     */
    evidence_item_id: string

    /**
     * Denormalised evidence type — must match the EvidenceItem.type in the CF.
     * Inspector validates this and also validates that a ComponentElement
     * with a matching cf_proof exists in this lesson's pages.
     */
    evidence_type: EvidenceType // denormalised; must match EvidenceItem.type in CF
}

/** Type guard — narrows LessonCFAlignment | AssessmentCFAlignment */
export function isAssessmentAlignment(
    a: LessonCFAlignment | AssessmentCFAlignment,
): a is AssessmentCFAlignment {
    return 'evidence_item_id' in a
}

/**
 * Element-level proof. Present only on ComponentElements that constitute
 * CF evidence. Proves the lesson contains actual implementation.
 *
 * Inspector proof chain:
 *   CF evidence demand (ev_03_02, type: quiz)
 *     → assessment lesson with AssessmentCFAlignment.evidence_item_id === 'ev_03_02'
 *       → page → ComponentElement with cf_proof.evidence_item_id === 'ev_03_02'
 *           AND cf_proof.evidence_type === 'quiz'
 *           AND EVIDENCE_COMPONENT_MAP[componentId] === 'quiz'
 *
 * PROVEN   = all three levels match
 * 
 * CLAIMED  = lesson mapped, but no component proof found
 * 
 * MISSING  = no lesson mapped at all
 */
export interface ElementCFProof {
    framework_id: string
    competency_id: string

    /** Must match the evidence_item_id in the parent lesson's AssessmentCFAlignment */
    evidence_item_id: string

    /**
     * Must match:
     *   1. The EvidenceItem.type in the CF
     *   2. EVIDENCE_COMPONENT_MAP[componentId] in the component registry
     * Both checks run independently. Mismatch on either → Inspector error.
     */
    evidence_type: EvidenceType
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — PROJECT INSPECTOR SLICE
// Lean payload passed to cf_inspector_run. Built by useCfProjectSlice.
// Only CF-relevant data — not the full ProjectData.
// ─────────────────────────────────────────────────────────────────────────────

/** A ComponentElement reduced to what the Inspector needs */
export interface CfElementSlice {
    element_id: string
    component_id: string
    cf_proof: ElementCFProof | null
}

/** A page reduced to its CF-bearing elements */
export interface PageSlice {
    id: string
    cf_elements: CfElementSlice[]
}

/**
 * A lesson reduced to CF alignment + page IDs.
 * Uses a flat shape (not the LessonCFAlignment | AssessmentCFAlignment union)
 * so Rust can deserialise it without needing tagged unions.
 */
export interface LessonSlice {
    id: string
    lesson_type: string           // 'activity' | 'assessment' | 'practice' | 'reference'
    cf_alignment: {
        framework_id: string
        competency_id: string
        indicator_ids: string[]
        evidence_item_id: string | null   // null for non-assessment lessons
        evidence_type: EvidenceType | null
    } | null
    page_ids: string[]
}

/** A module reduced to CF alignment + lesson IDs */
export interface ModuleSlice {
    id: string
    cf_alignment: ModuleCFAlignment | null
    lesson_ids: string[]
}

/**
 * The full project slice accepted by the cf_inspector_run Tauri command.
 * Built by the useCfProjectSlice composable from the project store.
 */
export interface ProjectInspectorSlice {
    project_id: string
    framework_alignments: CourseFrameworkAlignment[]
    modules: ModuleSlice[]
    lessons: Record<string, LessonSlice>  // lesson_id → LessonSlice
    pages: Record<string, PageSlice>      // page_id   → PageSlice
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — CF MAPPER OUTPUT (CourseBrief)
// Computed on project open from cached CF JSON. NOT persisted in .mava file.
// ─────────────────────────────────────────────────────────────────────────────

/** Flat competency entry — denormalised for O(1) Inspector lookups */
export interface BriefCompetency {
    competency_id: string
    domain_id: string
    domain_name: string
    title: string
    description: string
    context?: string
    proficiency_level: ProficiencyLevel
    bloom_level: BloomLevel
    difficulty: number
    indicators: BriefIndicator[]
    evidence_demands: BriefEvidenceDemand[]
    rubric: Rubric
    prerequisite_ids: string[]
    corequisite_ids: string[]
    related_ids: string[]
}

/** Flat indicator entry keyed in CourseBrief.indicators */
export interface BriefIndicator {
    indicator_id: string
    competency_id: string
    description: string
    bloom_level: BloomLevel
    /** Primary suggested evidence type for this indicator (from assessment_hints) */
    suggested_evidence_type?: EvidenceType
    alternative_evidence_types?: EvidenceType[]
}

/**
 * Flat evidence demand entry.
 * The Inspector checks each demand against the course's assessment lessons + elements.
 */
export interface BriefEvidenceDemand {
    evidence_item_id: string
    competency_id: string
    type: EvidenceType
    description: string
    validator_mode: ValidatorMode
    offline_compatible: boolean
    optional: boolean
    triangulation_required: boolean
    live_presence_required: boolean
}

/**
 * Unresolved cross-framework prerequisite.
 * Populated when a CF references a competency in an external framework
 * that is not imported into this project.
 */
export interface UnresolvedDependency {
    competency_id: string
    framework_id: string
    framework_version?: string
    referenced_by_competency_id: string
    edge_type: 'prerequisite' | 'corequisite' | 'related'
}

/**
 * CourseBrief — the CF Mapper's output.
 *
 * Computed by: Tauri command `cf_mapper_run`
 * Stored in:   app-data/cf-cache/<framework_id>/<brief_id>.json
 * Loaded on:   project open (recomputed if stale or missing)
 * NOT stored in ProjectData / .mava file.
 */
export interface CourseBrief {
    brief_id: string
    framework_id: string
    framework_version: string
    framework_checksum: string
    generated_at: number

    /** Source CF, cached for Inspector use without re-parsing */
    framework: CompetenceFramework

    // ── Indexed structures for O(1) Inspector lookups ──────────────────────

    /** competency_id → BriefCompetency */
    competencies: Record<string, BriefCompetency>

    /** indicator_id → BriefIndicator */
    indicators: Record<string, BriefIndicator>

    /** evidence_item_id → BriefEvidenceDemand */
    evidence_demands: Record<string, BriefEvidenceDemand>

    // ── Ordered lists for Mapper panel UI ──────────────────────────────────

    /** domain_id → competency_ids[] — for Mapper panel domain tree */
    domain_map: Record<string, string[]>

    /** This is a directed graph representing prerequisite relationships */
    prerequisite_graph: Record<string, string[]>

    // ── Platform demand summary ─────────────────────────────────────────────

    required_evidence_types: EvidenceType[]
    required_validator_modes: ValidatorMode[]
    requires_offline_support: boolean
    requires_async_validation_queue: boolean
    requires_peer_validation: boolean
    min_bloom_level_demanded: BloomLevel
    max_bloom_level_demanded: BloomLevel

    // ── External dependency tracking ────────────────────────────────────────

    unresolved_dependencies: UnresolvedDependency[]

    /** framework_ids of external CFs referenced as prerequisites */
    external_framework_ids: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — CF INSPECTOR OUTPUT (InspectorReport)
// Produced by Tauri command `cf_inspector_run`.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inspector strictness levels.
 * Configured per-project by the lead author.
 *
 * lenient  — hard errors only (CF ref invalid, type mismatches)
 * 
 * standard — errors for uncovered competencies, warnings for uncovered indicators
 * 
 * strict   — all of standard + integrity posture validation + assessment hint compliance
 */
export type InspectorStrictness = 'lenient' | 'standard' | 'strict'
export type InspectorSeverity = 'error' | 'warning' | 'suggestion' | 'ok'

/**
 * Evidence coverage status for a single CF evidence demand.
 *
 * PROVEN   — assessment lesson exists AND matching ComponentElement with cf_proof found
 * 
 * CLAIMED  — assessment lesson mapped BUT no matching ComponentElement found in pages
 * 
 * MISSING  — no assessment lesson references this evidence item at all
 */
export type EvidenceCoverageStatus = 'proven' | 'claimed' | 'missing'
export type IndicatorCoverageStatus = 'covered' | 'partial' | 'missing'
export type CompetencyCoverageStatus = 'complete' | 'partial' | 'not_started'

/** Deep-link target used by Inspector action buttons */
export interface InspectorNavTarget {
    type: 'course' | 'module' | 'lesson' | 'page' | 'element' | 'competency'
    module_id?: string
    lesson_id?: string
    page_id?: string
    element_id?: string
}

// ── Compatibility ─────────────────────────────────────────────────────────

export interface CompatibilityCheck {
    check_id: string
    label: string
    severity: InspectorSeverity
    message: string
    navigation?: InspectorNavTarget
}

/** Named type for the compatibility section — consumed by InspectorCompatibilitySection */
export interface CompatibilitySection {
    overall: InspectorSeverity
    checks: CompatibilityCheck[]
}

// ── Coverage ──────────────────────────────────────────────────────────────

export interface IndicatorCoverageResult {
    indicator_id: string
    description: string
    bloom_level: BloomLevel
    status: IndicatorCoverageStatus
    /** Lesson IDs that claim to cover this indicator */
    covered_by_lesson_ids: string[]
}

export interface EvidenceCoverageResult {
    evidence_item_id: string
    evidence_type: EvidenceType
    description: string
    optional: boolean
    status: EvidenceCoverageStatus
    /** Lesson ID of the assessment lesson, if mapped */
    mapped_lesson_id: string | null
    /** Page ID + element ID of the ComponentElement carrying cf_proof, if found */
    proven_by_element?: { page_id: string; element_id: string; component_id: string }
    /** Populated when status is 'claimed' — explains what is missing */
    claim_gap?: string
}

export interface CompetencyCoverageResult {
    competency_id: string
    title: string
    domain_name: string
    bloom_level: BloomLevel
    proficiency_level: ProficiencyLevel
    status: CompetencyCoverageStatus
    /** Module ID aligned to this competency, if any */
    covered_by_module_id: string | null
    indicators: IndicatorCoverageResult[]
    evidence: EvidenceCoverageResult[]
}

export interface CoverageSummary {
    total_competencies: number
    complete: number
    partial: number
    not_started: number
    total_indicators: number
    indicators_covered: number
    total_evidence_demands: number
    evidence_proven: number
    evidence_claimed: number
    evidence_missing: number
}

/** Named type for the coverage section — consumed by InspectorCoverageList */
export interface CoverageSection {
    overall: CompetencyCoverageStatus
    by_competency: Record<string, CompetencyCoverageResult>
    summary: CoverageSummary
}

// ── Assessment quality ────────────────────────────────────────────────────

export interface AssessmentQualityIssue {
    issue_id: string
    lesson_id: string
    competency_id: string
    bloom_level: BloomLevel
    evidence_type_used: EvidenceType
    suggested_types: EvidenceType[]
    severity: InspectorSeverity
    message: string
    navigation: InspectorNavTarget
}

/** Named type for the quality section — consumed by InspectorQualitySection */
export interface AssessmentQualitySection {
    issues: AssessmentQualityIssue[]
}

// ── Integrity posture (strict mode) ──────────────────────────────────────

export interface IntegrityPostureIssue {
    issue_id: string
    evidence_item_id: string
    competency_id: string
    check: 'triangulation_not_met' | 'live_presence_not_met' | 'context_binding_not_met' | 'collaboration_conflict'
    severity: InspectorSeverity
    message: string
    navigation: InspectorNavTarget
}

export interface IntegritySection {
    issues: IntegrityPostureIssue[]
}

// ── Report root ───────────────────────────────────────────────────────────

/**
 * InspectorReport — the CF Inspector's full output for one framework alignment.
 * One report per aligned framework per project.
 * Produced by Tauri command `cf_inspector_run`.
 */
export interface InspectorReport {
    report_id: string
    framework_id: string
    framework_version: string
    generated_at: number
    strictness: InspectorStrictness

    compatibility: CompatibilitySection
    coverage: CoverageSection
    assessment_quality: AssessmentQualitySection
    integrity: IntegritySection

    // ── Can the course be published? ──────────────────────────────────────
    /**
     * True only when:
     * - All compatibility checks pass
     * - All non-optional evidence demands are PROVEN (not just claimed)
     * - All indicators are covered
     * - No errors (warnings are allowed)
     */
    publish_ready: boolean

    /** Human-readable list for the publish gate */
    blocking_errors: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — COMPONENT REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All default Mava Studio component IDs that can carry cf_proof,
 * mapped to their EvidenceType category.
 *
 * Inspector rule: for every ComponentElement where cf_proof is set,
 *   EVIDENCE_COMPONENT_MAP[element.componentId] must equal element.cf_proof.evidence_type.
 * Mismatch → error: "Component type does not match declared evidence type"
 */
export const EVIDENCE_COMPONENT_MAP: Readonly<Record<string, EvidenceType>> = {
    // ── Quiz (10 question types, all satisfy 'quiz' evidence) ──────────────
    'quiz.mcq.single': 'quiz',
    'quiz.mcq.multi': 'quiz',
    'quiz.truefalse': 'quiz',
    'quiz.shortanswer': 'quiz',
    'quiz.fillblank': 'quiz',
    'quiz.matching': 'quiz',
    'quiz.ordering': 'quiz',
    'quiz.hotspot': 'quiz',
    'quiz.dragdrop': 'quiz',
    'quiz.code': 'quiz',

    // ── Video demonstration ────────────────────────────────────────────────
    'evidence.recorder.screen': 'video_demo',
    'evidence.recorder.camera': 'video_demo',
    'evidence.recorder.pip': 'video_demo',

    // ── File and project submission ────────────────────────────────────────
    'evidence.upload.file': 'file_upload',
    'evidence.upload.project': 'project_submission',

    // ── Portfolio ──────────────────────────────────────────────────────────
    'evidence.portfolio.link': 'portfolio_link',

    // ── Peer observation ───────────────────────────────────────────────────
    'evidence.peer.rubric': 'peer_observation',
    'evidence.peer.checklist': 'peer_observation',

    // ── Mentor sign-off ────────────────────────────────────────────────────
    'evidence.mentor.signoff': 'mentor_sign_off',

    // ── Reflection ─────────────────────────────────────────────────────────
    'evidence.reflection.journal': 'reflection',
    'evidence.reflection.guided': 'reflection',

    // ── Live assessment ────────────────────────────────────────────────────
    'evidence.live.session': 'live_assessment',
} as const

export const CF_CAPABLE_COMPONENT_IDS = new Set(Object.keys(EVIDENCE_COMPONENT_MAP))

/**
 * All componentIds that can carry cf_proof.
 * Use this for validation: if cf_proof is set on a component
 * whose componentId is NOT in this set, that is a configuration error.
 */
export function getComponentEvidenceType(componentId: string): EvidenceType | null {
    return (EVIDENCE_COMPONENT_MAP[componentId] as EvidenceType) ?? null
}

/**
 * Validates an ElementCFProof against its componentId.
 * Returns null if valid, or an error string if invalid.
 */
export function validateElementCFProof(
    componentId: string,
    proof: ElementCFProof,
): string | null {
    const registered = getComponentEvidenceType(componentId)
    if (!registered)
        return `Component "${componentId}" is not CF-capable and should not carry cf_proof`
    if (registered !== proof.evidence_type)
        return `Component "${componentId}" is registered as "${registered}" but cf_proof declares "${proof.evidence_type}"`
    return null
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — TAURI COMMAND I/O TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Input to Tauri command `cf_mapper_run` */
export interface MapperRunInput {
    /** Raw JSON string of the published CF bundle (from app-data cache) */
    framework_json: string
    project_id: string
    /** If the brief already exists, pass its ID to trigger a diff instead of full rebuild */
    existing_brief_id?: string | null
}

/** Output from Tauri command `cf_mapper_run` */
export interface MapperRunOutput {
    success: boolean
    brief: CourseBrief | null
    /** Human-readable warnings (e.g. unresolved external dependencies) */
    warnings: string[]
    /** Human-readable errors (e.g. invalid checksum, schema version mismatch) */
    errors: string[]
}

/**
 * Input to Tauri command `cf_inspector_run`.
 * Passes the full project slice and brief directly — the Rust command
 * does not load the brief from disk on every run (brief is loaded once
 * on project open and passed from the Vue store).
 */
export interface InspectorRunInput {
    project_slice: ProjectInspectorSlice
    brief: CourseBrief
    strictness: InspectorStrictness
}

export interface InspectorRunOutput {
    success: boolean
    report: InspectorReport | null
    errors: string[]
}

export interface CacheFrameworkInput {
    bundle_json: string
}

export interface CacheFrameworkOutput {
    success: boolean
    framework_id: string
    framework_version: string
    checksum: string
    cached_at: number
    errors: string[]
}

/**
 * Input to Tauri command `cf_get_brief`.
 * Called on project open to load the brief from app-data cache.
 */
export interface GetBriefInput {
    framework_id: string
    framework_version: string
    brief_id: string
}

/**
 * Output from Tauri command `cf_get_brief`.
 * If is_fresh is false, caller should trigger cf_mapper_run to rebuild.
 */
export interface GetBriefOutput {
    found: boolean
    brief: CourseBrief | null
    is_fresh: boolean
    error: string | null
}
