// =============================================================================
// cf-builder/types/cf.types.ts
// Core schema types — derived from cf.schema.json v2.1
// These are the canonical data types for the CF. All stores, composables,
// and components import from here.
// =============================================================================

// ─── Primitive enums ─────────────────────────────────────────────────────────

export type BloomLevel =
    | 'remember'
    | 'understand'
    | 'apply'
    | 'analyze'
    | 'evaluate'
    | 'create'

export type EvidenceType =
    | 'quiz'
    | 'file_upload'
    | 'video_demo'
    | 'project_submission'
    | 'portfolio_link'
    | 'peer_observation'
    | 'mentor_sign_off'
    | 'reflection'
    | 'live_assessment'

export type ValidatorMode = 'auto' | 'mentor' | 'peer' | 'team' | 'self'

export type ContextBinding = 'none' | 'session' | 'device' | 'location'

export type ProficiencyLevel = 'emerging' | 'developing' | 'proficient' | 'mastered'

export type ScoringMode = 'weighted_sum' | 'all_or_nothing' | 'highest_criterion'

export type GroupingType = 'badge' | 'certificate' | 'track' | 'pathway'

export type FrameworkStatus = 'draft' | 'review' | 'published' | 'archived'

// ─── Sub-objects ─────────────────────────────────────────────────────────────

export interface PlatformCapabilities {
    required_evidence_types: EvidenceType[]
    required_validator_modes: ValidatorMode[]
    requires_offline_support: boolean
    requires_async_validation_queue: boolean
    requires_peer_validation: boolean
    min_bloom_level_demanded: BloomLevel
    max_bloom_level_demanded: BloomLevel
    notes?: string
}

export interface FrameworkMetadata {
    version: string           // semver, e.g. "1.0.0"
    status: FrameworkStatus
    created_by: string
    created_at: string        // ISO 8601
    updated_at: string        // ISO 8601
    tags?: string[]
    license?: string
    origin_institution?: string
    forked_from?: string | null
    checksum?: string | null  // sha256:<64 hex chars> — populated on publish
    signing_key_id?: string | null
    locale?: string           // BCP 47, e.g. "en-UG"
}

export interface CognitiveProfile {
    bloom_level: BloomLevel
    difficulty: number        // integer 1–5
    effort_hours?: number
    notes?: string
}

export interface ValidityConfig {
    validity_period_days: number
    revalidation_criteria: string
    revalidation_evidence?: EvidenceItem[]
}

export interface AssessmentHint {
    suggested_type: EvidenceType
    rationale?: string
    alternatives?: EvidenceType[]
}

export interface Indicator {
    id: string
    description: string
    bloom_level?: BloomLevel  // overrides competency bloom_level if set
    assessment_hints?: AssessmentHint[]
}

export interface ValidatorConfig {
    mode: ValidatorMode
    min_validators?: number   // for peer/team; default 1
    async_queue?: boolean
}

export interface IntegrityPosture {
    triangulation_required: boolean
    live_presence_required: boolean
    context_binding: ContextBinding
    allow_collaboration: boolean
    notes?: string
}

export interface EvidenceItem {
    id: string
    type: EvidenceType
    description: string
    assessment_id?: string    // for quiz type
    indicator_ids?: string[]
    validator: ValidatorConfig
    integrity_posture: IntegrityPosture
    offline_compatible: boolean
    optional?: boolean        // default false
}

export interface ScoringLevel {
    label: string
    min_score: number         // 0–1
    description: string
}

export interface RubricCriterion {
    id: string
    description: string
    weight: number            // 0–1; all criteria must sum to 1.0
    indicator_ids?: string[]
    bloom_level?: BloomLevel
    levels?: ScoringLevel[]
}

export interface Rubric {
    criteria: RubricCriterion[]
    mastery_threshold: number // 0–1
    scoring_mode?: ScoringMode // default: weighted_sum
}

export interface RelationshipRef {
    competency_id: string
    framework_id?: string     // omit for within-framework refs
    framework_version?: string // semver; omit to resolve to latest published
}

export interface CompetencyRelationships {
    prerequisites?: RelationshipRef[]
    corequisites?: RelationshipRef[]
    related?: RelationshipRef[]
}

export interface Competency {
    id: string
    title: string
    description: string
    proficiency_level: ProficiencyLevel
    context?: string
    cognitive_profile: CognitiveProfile
    validity?: ValidityConfig | null
    indicators: Indicator[]
    evidence_required: EvidenceItem[]
    rubric: Rubric
    relationships?: CompetencyRelationships
}

export interface Domain {
    id: string
    name: string
    description?: string
    competencies: Competency[]
}

export interface Grouping {
    id: string
    title: string
    description?: string
    type: GroupingType
    competency_ids: string[]
    partial_credit?: boolean  // default false
    credential_template_id?: string
}

// ─── Root framework ───────────────────────────────────────────────────────────

export interface CompetenceFramework {
    id: string
    title: string
    description: string
    domains: Domain[]
    groupings?: Grouping[]
    platform_capabilities: PlatformCapabilities
    metadata: FrameworkMetadata
}
