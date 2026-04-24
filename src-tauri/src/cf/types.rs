// src/cf/types.rs
//
// Rust mirrors of the TypeScript CF types.
// All types derive Serialize + Deserialize so they can be:
//   - read from cached framework.json files
//   - returned to the Vue frontend via Tauri commands
//   - used internally by mapper and inspector logic
//
// Naming follows the TS types exactly (snake_case in Rust ↔ camelCase in TS
// is handled by serde rename_all where needed).

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ─────────────────────────────────────────────────────────────────────────────
// PRIMITIVE ENUMS
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BloomLevel {
    Remember,
    Understand,
    Apply,
    Analyze,
    Evaluate,
    Create,
}

impl BloomLevel {
    /// Numeric rank for ordering/comparison (higher = more demanding)
    pub fn rank(&self) -> u8 {
        match self {
            BloomLevel::Remember    => 0,
            BloomLevel::Understand  => 1,
            BloomLevel::Apply       => 2,
            BloomLevel::Analyze     => 3,
            BloomLevel::Evaluate    => 4,
            BloomLevel::Create      => 5,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EvidenceType {
    Quiz,
    FileUpload,
    VideoDemo,
    ProjectSubmission,
    PortfolioLink,
    PeerObservation,
    MentorSignOff,
    Reflection,
    LiveAssessment,
}

impl EvidenceType {
    pub fn _is_offline_compatible_default(&self) -> bool {
        match self {
            EvidenceType::PortfolioLink | EvidenceType::LiveAssessment => false,
            _ => true,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ValidatorMode {
    Auto,
    Mentor,
    Peer,
    Team,
    #[serde(rename = "self")]
    SelfValidator,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ContextBinding {
    None,
    Session,
    Device,
    Location,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProficiencyLevel {
    Emerging,
    Developing,
    Proficient,
    Mastered,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ScoringMode {
    WeightedSum,
    AllOrNothing,
    HighestCriterion,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FrameworkStatus {
    Draft,
    Review,
    Published,
    Archived,
}

// ─────────────────────────────────────────────────────────────────────────────
// CF SCHEMA TYPES  (mirrors of cf.types.ts)
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformCapabilities {
    pub required_evidence_types: Vec<EvidenceType>,
    pub required_validator_modes: Vec<ValidatorMode>,
    pub requires_offline_support: bool,
    pub requires_async_validation_queue: bool,
    pub requires_peer_validation: bool,
    pub min_bloom_level_demanded: BloomLevel,
    pub max_bloom_level_demanded: BloomLevel,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameworkMetadata {
    pub version: String,
    pub status: FrameworkStatus,
    pub created_by: String,
    pub created_at: String,
    pub updated_at: String,
    pub tags: Option<Vec<String>>,
    pub license: Option<String>,
    pub origin_institution: Option<String>,
    pub forked_from: Option<String>,
    pub checksum: Option<String>,
    pub signing_key_id: Option<String>,
    pub locale: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CognitiveProfile {
    pub bloom_level: BloomLevel,
    pub difficulty: u8,
    pub effort_hours: Option<f32>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidityConfig {
    pub validity_period_days: u32,
    pub revalidation_criteria: String,
    pub revalidation_evidence: Option<Vec<EvidenceItem>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssessmentHint {
    pub suggested_type: EvidenceType,
    pub rationale: Option<String>,
    pub alternatives: Option<Vec<EvidenceType>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Indicator {
    pub id: String,
    pub description: String,
    pub bloom_level: Option<BloomLevel>,
    pub assessment_hints: Option<Vec<AssessmentHint>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidatorConfig {
    pub mode: ValidatorMode,
    pub min_validators: Option<u32>,
    pub async_queue: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrityPosture {
    pub triangulation_required: bool,
    pub live_presence_required: bool,
    pub context_binding: ContextBinding,
    pub allow_collaboration: bool,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceItem {
    pub id: String,
    #[serde(rename = "type")]
    pub evidence_type: EvidenceType,
    pub description: String,
    pub assessment_id: Option<String>,
    pub indicator_ids: Option<Vec<String>>,
    pub validator: ValidatorConfig,
    pub integrity_posture: IntegrityPosture,
    pub offline_compatible: bool,
    pub optional: Option<bool>,
}

impl EvidenceItem {
    pub fn is_optional(&self) -> bool {
        self.optional.unwrap_or(false)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoringLevel {
    pub label: String,
    pub min_score: f32,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RubricCriterion {
    pub id: String,
    pub description: String,
    pub weight: f32,
    pub indicator_ids: Option<Vec<String>>,
    pub bloom_level: Option<BloomLevel>,
    pub levels: Option<Vec<ScoringLevel>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rubric {
    pub criteria: Vec<RubricCriterion>,
    pub mastery_threshold: f32,
    pub scoring_mode: Option<ScoringMode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelationshipRef {
    pub competency_id: String,
    pub framework_id: Option<String>,
    pub framework_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompetencyRelationships {
    pub prerequisites: Option<Vec<RelationshipRef>>,
    pub corequisites: Option<Vec<RelationshipRef>>,
    pub related: Option<Vec<RelationshipRef>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Competency {
    pub id: String,
    pub title: String,
    pub description: String,
    pub proficiency_level: ProficiencyLevel,
    pub context: Option<String>,
    pub cognitive_profile: CognitiveProfile,
    pub validity: Option<ValidityConfig>,
    pub indicators: Vec<Indicator>,
    pub evidence_required: Vec<EvidenceItem>,
    pub rubric: Rubric,
    pub relationships: Option<CompetencyRelationships>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Domain {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub competencies: Vec<Competency>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Grouping {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    #[serde(rename = "type")]
    pub grouping_type: String,
    pub competency_ids: Vec<String>,
    pub partial_credit: Option<bool>,
    pub credential_template_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompetenceFramework {
    pub id: String,
    pub title: String,
    pub description: String,
    pub domains: Vec<Domain>,
    pub groupings: Option<Vec<Grouping>>,
    pub platform_capabilities: PlatformCapabilities,
    pub metadata: FrameworkMetadata,
}

impl CompetenceFramework {
    /// Flat iterator over all competencies across all domains
    pub fn all_competencies(&self) -> impl Iterator<Item = (&Domain, &Competency)> {
        self.domains.iter().flat_map(|d| {
            d.competencies.iter().map(move |c| (d, c))
        })
    }

    /// Find a competency by ID — O(n) but n is small for typical CFs
    pub fn _find_competency(&self, competency_id: &str) -> Option<(&Domain, &Competency)> {
        self.all_competencies()
            .find(|(_, c)| c.id == competency_id)
    }

    /// Collect all evidence items across all competencies
    pub fn _all_evidence_items(&self) -> impl Iterator<Item = (&Competency, &EvidenceItem)> {
        self.domains.iter()
            .flat_map(|d| d.competencies.iter())
            .flat_map(|c| c.evidence_required.iter().map(move |e| (c, e)))
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ALIGNMENT TYPES  (mirrors of cf-alignment.types.ts — project-persisted side)
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CourseFrameworkAlignment {
    pub framework_id: String,
    pub framework_version: String,
    pub framework_checksum: String,
    pub aligned_at: u64,
    pub brief_id: String,
    pub framework_title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleCFAlignment {
    pub framework_id: String,
    pub competency_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LessonCFAlignment {
    pub framework_id: String,
    pub competency_id: String,
    pub indicator_ids: Vec<String>,
    /// Present only for assessment lessons
    pub evidence_item_id: Option<String>,
    /// Present only for assessment lessons
    pub evidence_type: Option<EvidenceType>,
}

impl LessonCFAlignment {
    pub fn _is_assessment(&self) -> bool {
        self.evidence_item_id.is_some()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElementCFProof {
    pub framework_id: String,
    pub competency_id: String,
    pub evidence_item_id: String,
    pub evidence_type: EvidenceType,
}

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT SLICE  (only the CF-relevant parts of ProjectData)
// The Inspector receives this instead of the full ProjectData to keep
// the Tauri command payload small.
// ─────────────────────────────────────────────────────────────────────────────

/// Minimal module representation for Inspector
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleSlice {
    pub id: String,
    pub cf_alignment: Option<ModuleCFAlignment>,
    pub lesson_ids: Vec<String>,
}

/// Minimal lesson representation for Inspector
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LessonSlice {
    pub id: String,
    pub lesson_type: String,   // "activity" | "assessment" | "practice" | "reference"
    pub cf_alignment: Option<LessonCFAlignment>,
    pub page_ids: Vec<String>,
}

/// Minimal page representation for Inspector
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageSlice {
    pub id: String,
    /// Only ComponentElements that have cf_proof set
    pub cf_elements: Vec<CfElementSlice>,
}

/// A ComponentElement reduced to just what the Inspector needs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CfElementSlice {
    pub element_id: String,
    pub component_id: String,
    pub cf_proof: Option<ElementCFProof>,
}

/// The full project slice the Inspector command accepts
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectInspectorSlice {
    pub project_id: String,
    pub framework_alignments: Vec<CourseFrameworkAlignment>,
    pub modules: Vec<ModuleSlice>,
    pub lessons: HashMap<String, LessonSlice>,
    pub pages: HashMap<String, PageSlice>,
}

// ─────────────────────────────────────────────────────────────────────────────
// MAPPER OUTPUT  (CourseBrief)
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BriefIndicator {
    pub indicator_id: String,
    pub competency_id: String,
    pub description: String,
    pub bloom_level: BloomLevel,
    pub suggested_evidence_type: Option<EvidenceType>,
    pub alternative_evidence_types: Option<Vec<EvidenceType>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BriefEvidenceDemand {
    pub evidence_item_id: String,
    pub competency_id: String,
    pub evidence_type: EvidenceType,
    pub description: String,
    pub validator_mode: ValidatorMode,
    pub offline_compatible: bool,
    pub optional: bool,
    pub triangulation_required: bool,
    pub live_presence_required: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BriefCompetency {
    pub competency_id: String,
    pub domain_id: String,
    pub domain_name: String,
    pub title: String,
    pub description: String,
    pub context: Option<String>,
    pub proficiency_level: ProficiencyLevel,
    pub bloom_level: BloomLevel,
    pub difficulty: u8,
    pub indicators: Vec<BriefIndicator>,
    pub evidence_demands: Vec<BriefEvidenceDemand>,
    pub rubric: Rubric,
    pub prerequisite_ids: Vec<String>,
    pub corequisite_ids: Vec<String>,
    pub related_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnresolvedDependency {
    pub competency_id: String,
    pub framework_id: String,
    pub framework_version: Option<String>,
    pub referenced_by_competency_id: String,
    pub edge_type: String,  // "prerequisite" | "corequisite" | "related"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CourseBrief {
    pub brief_id: String,
    pub framework_id: String,
    pub framework_version: String,
    pub framework_checksum: String,
    pub generated_at: u64,

    // Indexed for O(1) Inspector lookup
    pub competencies: HashMap<String, BriefCompetency>,
    pub indicators: HashMap<String, BriefIndicator>,
    pub evidence_demands: HashMap<String, BriefEvidenceDemand>,

    // Ordered for Mapper panel UI
    pub domain_map: HashMap<String, Vec<String>>,       // domain_id → [competency_id]
    pub prerequisite_graph: HashMap<String, Vec<String>>, // competency_id → [prereq_ids]

    // Platform demand summary
    pub required_evidence_types: Vec<EvidenceType>,
    pub required_validator_modes: Vec<ValidatorMode>,
    pub requires_offline_support: bool,
    pub requires_async_validation_queue: bool,
    pub requires_peer_validation: bool,
    pub min_bloom_level_demanded: BloomLevel,
    pub max_bloom_level_demanded: BloomLevel,

    pub unresolved_dependencies: Vec<UnresolvedDependency>,
    pub external_framework_ids: Vec<String>,
}

// ─────────────────────────────────────────────────────────────────────────────
// INSPECTOR OUTPUT  (InspectorReport)
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InspectorSeverity {
    Error,
    Warning,
    Suggestion,
    Ok,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EvidenceCoverageStatus {
    /// Assessment lesson found AND ComponentElement with matching cf_proof found
    Proven,
    /// Assessment lesson mapped BUT no matching ComponentElement found in pages
    Claimed,
    /// No assessment lesson references this evidence item at all
    Missing,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IndicatorCoverageStatus {
    Covered,
    Partial,
    Missing,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CompetencyCoverageStatus {
    Complete,
    Partial,
    NotStarted,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InspectorStrictness {
    Lenient,
    Standard,
    Strict,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InspectorNavTarget {
    #[serde(rename = "type")]
    pub target_type: String,
    pub module_id: Option<String>,
    pub lesson_id: Option<String>,
    pub page_id: Option<String>,
    pub element_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompatibilityCheck {
    pub check_id: String,
    pub label: String,
    pub severity: InspectorSeverity,
    pub message: String,
    pub navigation: Option<InspectorNavTarget>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndicatorCoverageResult {
    pub indicator_id: String,
    pub description: String,
    pub bloom_level: BloomLevel,
    pub status: IndicatorCoverageStatus,
    pub covered_by_lesson_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProvenByElement {
    pub page_id: String,
    pub element_id: String,
    pub component_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceCoverageResult {
    pub evidence_item_id: String,
    pub evidence_type: EvidenceType,
    pub description: String,
    pub optional: bool,
    pub status: EvidenceCoverageStatus,
    pub mapped_lesson_id: Option<String>,
    pub proven_by_element: Option<ProvenByElement>,
    pub claim_gap: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompetencyCoverageResult {
    pub competency_id: String,
    pub title: String,
    pub domain_name: String,
    pub bloom_level: BloomLevel,
    pub proficiency_level: ProficiencyLevel,
    pub status: CompetencyCoverageStatus,
    pub covered_by_module_id: Option<String>,
    pub indicators: Vec<IndicatorCoverageResult>,
    pub evidence: Vec<EvidenceCoverageResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssessmentQualityIssue {
    pub issue_id: String,
    pub lesson_id: String,
    pub competency_id: String,
    pub bloom_level: BloomLevel,
    pub evidence_type_used: EvidenceType,
    pub suggested_types: Vec<EvidenceType>,
    pub severity: InspectorSeverity,
    pub message: String,
    pub navigation: InspectorNavTarget,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrityPostureIssue {
    pub issue_id: String,
    pub evidence_item_id: String,
    pub competency_id: String,
    pub check: String,
    pub severity: InspectorSeverity,
    pub message: String,
    pub navigation: InspectorNavTarget,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoverageSummary {
    pub total_competencies: usize,
    pub complete: usize,
    pub partial: usize,
    pub not_started: usize,
    pub total_indicators: usize,
    pub indicators_covered: usize,
    pub total_evidence_demands: usize,
    pub evidence_proven: usize,
    pub evidence_claimed: usize,
    pub evidence_missing: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InspectorReport {
    pub report_id: String,
    pub framework_id: String,
    pub framework_version: String,
    pub generated_at: u64,
    pub strictness: InspectorStrictness,

    pub compatibility: CompatibilitySection,
    pub coverage: CoverageSection,
    pub assessment_quality: AssessmentQualitySection,
    pub integrity: IntegritySection,

    pub publish_ready: bool,
    pub blocking_errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompatibilitySection {
    pub overall: InspectorSeverity,
    pub checks: Vec<CompatibilityCheck>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoverageSection {
    pub overall: CompetencyCoverageStatus,
    pub by_competency: HashMap<String, CompetencyCoverageResult>,
    pub summary: CoverageSummary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssessmentQualitySection {
    pub issues: Vec<AssessmentQualityIssue>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegritySection {
    pub issues: Vec<IntegrityPostureIssue>,
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND I/O TYPES
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct MapperRunInput {
    pub framework_json: String,
    pub project_id: String,
    pub existing_brief_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MapperRunOutput {
    pub success: bool,
    pub brief: Option<CourseBrief>,
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InspectorRunInput {
    pub project_slice: ProjectInspectorSlice,
    pub brief: CourseBrief,
    pub strictness: InspectorStrictness,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InspectorRunOutput {
    pub success: bool,
    pub report: Option<InspectorReport>,
    pub errors: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CacheFrameworkInput {
    pub bundle_json: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CacheFrameworkOutput {
    pub success: bool,
    pub framework_id: String,
    pub framework_version: String,
    pub checksum: String,
    pub cached_at: u64,
    pub errors: Vec<String>,
}
