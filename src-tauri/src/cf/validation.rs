// src/cf/validation.rs
//
// Shared validation utilities used by both mapper and inspector.
// - SHA-256 checksum computation over canonical JSON
// - CF schema validation (published status, required fields)
// - Component registry (Rust mirror of EVIDENCE_COMPONENT_MAP)

use std::collections::HashMap;
use sha2::{Digest, Sha256};
use serde_json::Value;

use super::types::{CompetenceFramework, EvidenceType, ElementCFProof};

// ─────────────────────────────────────────────────────────────────────────────
// CHECKSUM
// ─────────────────────────────────────────────────────────────────────────────

/// Compute a SHA-256 checksum over canonical JSON.
/// Canonical = keys sorted recursively, no whitespace.
/// Returns "sha256:<64 hex chars>"
pub fn compute_checksum(framework: &CompetenceFramework) -> String {
    let mut json = serde_json::to_value(framework)
        .expect("CompetenceFramework is always serialisable");

    // Exclude self-referential fields so checksum verification is stable.
    if let Value::Object(root) = &mut json {
        if let Some(Value::Object(metadata)) = root.get_mut("metadata") {
            metadata.remove("checksum");
            metadata.remove("signing_key_id");
        }
    }

    let canonical = canonical_json(&json);
    let serialised = serde_json::to_string(&canonical)
        .expect("canonical value is always serialisable");

    let mut hasher = Sha256::new();
    hasher.update(serialised.as_bytes());
    let result = hasher.finalize();
    let hex_digest: String = result.iter().map(|b| format!("{:02x}", b)).collect();
    format!("sha256:{}", hex_digest)
}

/// Verify a checksum string matches the framework's current state.
pub fn verify_checksum(framework: &CompetenceFramework, claimed_checksum: &str) -> bool {
    compute_checksum(framework) == claimed_checksum
}

/// Recursively sort object keys so JSON is canonical.
fn canonical_json(value: &Value) -> Value {
    match value {
        Value::Object(map) => {
            let mut sorted: Vec<(&String, &Value)> = map.iter().collect();
            sorted.sort_by_key(|(k, _)| *k);
            let new_map: serde_json::Map<String, Value> = sorted
                .into_iter()
                .map(|(k, v)| (k.clone(), canonical_json(v)))
                .collect();
            Value::Object(new_map)
        }
        Value::Array(arr) => Value::Array(arr.iter().map(canonical_json).collect()),
        other => other.clone(),
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CF SCHEMA VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug)]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

impl ValidationResult {
    pub fn _ok() -> Self {
        Self { valid: true, errors: vec![], warnings: vec![] }
    }

    pub fn _with_error(msg: impl Into<String>) -> Self {
        Self { valid: false, errors: vec![msg.into()], warnings: vec![] }
    }
}

/// Validates the CF before the Mapper processes it.
/// Checks: status must be published, checksum must be present and valid,
/// at least one domain with one competency, rubric weights sum to 1.0 per competency.
pub fn validate_framework(framework: &CompetenceFramework) -> ValidationResult {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    // Must be published
    use super::types::FrameworkStatus;
    if framework.metadata.status != FrameworkStatus::Published {
        errors.push(format!(
            "Framework '{}' has status '{:?}' — only published frameworks can be imported.",
            framework.id, framework.metadata.status
        ));
    }

    // Checksum must be present
    match &framework.metadata.checksum {
        None => errors.push("Framework has no checksum. Re-publish from CF Builder.".into()),
        Some(checksum) => {
            if !verify_checksum(framework, checksum) {
                errors.push(
                    "Checksum mismatch — framework content has changed since publication.".into()
                );
            }
        }
    }

    // At least one domain
    if framework.domains.is_empty() {
        errors.push("Framework has no domains.".into());
    }

    // Per-competency checks
    for domain in &framework.domains {
        if domain.competencies.is_empty() {
            warnings.push(format!("Domain '{}' has no competencies.", domain.name));
        }
        for comp in &domain.competencies {
            // At least one indicator
            if comp.indicators.is_empty() {
                errors.push(format!(
                    "Competency '{}' has no indicators.", comp.id
                ));
            }
            // At least one evidence item
            if comp.evidence_required.is_empty() {
                errors.push(format!(
                    "Competency '{}' has no evidence items.", comp.id
                ));
            }
            // At least one offline-compatible evidence item
            let has_offline = comp.evidence_required.iter().any(|e| e.offline_compatible);
            if !has_offline {
                warnings.push(format!(
                    "Competency '{}' has no offline-compatible evidence item.", comp.id
                ));
            }
            // Rubric weights must sum to ~1.0
            let weight_sum: f32 = comp.rubric.criteria.iter().map(|c| c.weight).sum();
            if (weight_sum - 1.0).abs() > 0.001 {
                errors.push(format!(
                    "Competency '{}' rubric weights sum to {:.3}, expected 1.0.",
                    comp.id, weight_sum
                ));
            }
        }
    }

    // Check for circular prerequisites (DFS)
    let cycle = detect_prerequisite_cycle(framework);
    if let Some(ids) = cycle {
        errors.push(format!(
            "Circular prerequisite chain detected involving: {}",
            ids.join(", ")
        ));
    }

    ValidationResult {
        valid: errors.is_empty(),
        errors,
        warnings,
    }
}

/// DFS cycle detection on within-framework prerequisite graph.
/// Returns Some(Vec<competency_id>) if a cycle is found, None otherwise.
pub fn detect_prerequisite_cycle(framework: &CompetenceFramework) -> Option<Vec<String>> {
    let mut graph: HashMap<&str, Vec<&str>> = HashMap::new();

    for domain in &framework.domains {
        for comp in &domain.competencies {
            let prereqs: Vec<&str> = comp.relationships
                .as_ref()
                .and_then(|r| r.prerequisites.as_ref())
                .map(|ps| {
                    ps.iter()
                        .filter(|r| r.framework_id.is_none())
                        .map(|r| r.competency_id.as_str())
                        .collect()
                })
                .unwrap_or_default();
            graph.insert(comp.id.as_str(), prereqs);
        }
    }

    let mut visited = std::collections::HashSet::new();
    let mut in_stack = std::collections::HashSet::new();
    let mut cycle_ids = Vec::new();

    for start in graph.keys() {
        if dfs_cycle(start, &graph, &mut visited, &mut in_stack, &mut cycle_ids) {
            return Some(cycle_ids);
        }
    }
    None
}

fn dfs_cycle<'a>(
    node: &'a str,
    graph: &HashMap<&'a str, Vec<&'a str>>,
    visited: &mut std::collections::HashSet<&'a str>,
    in_stack: &mut std::collections::HashSet<&'a str>,
    cycle_ids: &mut Vec<String>,
) -> bool {
    if in_stack.contains(node) {
        cycle_ids.push(node.to_string());
        return true;
    }
    if visited.contains(node) {
        return false;
    }
    visited.insert(node);
    in_stack.insert(node);

    if let Some(neighbors) = graph.get(node) {
        for &neighbor in neighbors {
            if dfs_cycle(neighbor, graph, visited, in_stack, cycle_ids) {
                return true;
            }
        }
    }
    in_stack.remove(node);
    false
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

/// Rust mirror of EVIDENCE_COMPONENT_MAP from cf-alignment.types.ts.
/// Maps componentId → EvidenceType.
/// Inspector uses this to validate ElementCFProof.evidence_type
/// against the component's registered category.
pub fn get_component_evidence_type(component_id: &str) -> Option<EvidenceType> {
    match component_id {
        // Quiz
        "quiz.mcq.single"
        | "quiz.mcq.multi"
        | "quiz.truefalse"
        | "quiz.shortanswer"
        | "quiz.fillblank"
        | "quiz.matching"
        | "quiz.ordering"
        | "quiz.hotspot"
        | "quiz.dragdrop"
        | "quiz.code"                    => Some(EvidenceType::Quiz),

        // Video
        "evidence.recorder.screen"
        | "evidence.recorder.camera"
        | "evidence.recorder.pip"        => Some(EvidenceType::VideoDemo),

        // File / project
        "evidence.upload.file"           => Some(EvidenceType::FileUpload),
        "evidence.upload.project"        => Some(EvidenceType::ProjectSubmission),

        // Portfolio
        "evidence.portfolio.link"        => Some(EvidenceType::PortfolioLink),

        // Peer
        "evidence.peer.rubric"
        | "evidence.peer.checklist"      => Some(EvidenceType::PeerObservation),

        // Mentor
        "evidence.mentor.signoff"        => Some(EvidenceType::MentorSignOff),

        // Reflection
        "evidence.reflection.journal"
        | "evidence.reflection.guided"   => Some(EvidenceType::Reflection),

        // Live
        "evidence.live.session"          => Some(EvidenceType::LiveAssessment),

        _ => None,
    }
}

/// Validates an ElementCFProof against its componentId.
/// Returns Ok(()) if valid, Err(message) if invalid.
pub fn validate_element_proof(
    component_id: &str,
    proof: &ElementCFProof,
) -> Result<(), String> {
    match get_component_evidence_type(component_id) {
        None => Err(format!(
            "Component '{}' is not CF-capable and should not carry cf_proof",
            component_id
        )),
        Some(registered_type) if registered_type != proof.evidence_type => Err(format!(
            "Component '{}' is registered as '{:?}' but cf_proof declares '{:?}'",
            component_id, registered_type, proof.evidence_type
        )),
        _ => Ok(()),
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSESSMENT QUALITY HINTS
// ─────────────────────────────────────────────────────────────────────────────

/// For a given Bloom level and evidence type, determine if the
/// assessment format is appropriate and what alternatives are suggested.
/// Returns None if the combination is acceptable, Some((message, suggestions)) if not.
pub fn check_assessment_appropriateness(
    bloom_level: &super::types::BloomLevel,
    evidence_type: &EvidenceType,
) -> Option<(String, Vec<EvidenceType>)> {
    use super::types::BloomLevel;

    match (bloom_level, evidence_type) {
        // Quiz-only for create/evaluate is a mismatch
        (BloomLevel::Create, EvidenceType::Quiz) => Some((
            "A quiz alone cannot assess a Create-level competency. Consider a Project Submission or Video Demo.".into(),
            vec![EvidenceType::ProjectSubmission, EvidenceType::VideoDemo],
        )),
        (BloomLevel::Evaluate, EvidenceType::Quiz) => Some((
            "A quiz alone is weak evidence for an Evaluate-level competency. Consider adding a Reflection or Project Submission.".into(),
            vec![EvidenceType::Reflection, EvidenceType::ProjectSubmission],
        )),
        // Apply without demonstration
        (BloomLevel::Apply, EvidenceType::Quiz) => Some((
            "Apply-level skills are best demonstrated in action. A Video Demo or Project pairs well with a quiz.".into(),
            vec![EvidenceType::VideoDemo, EvidenceType::ProjectSubmission],
        )),
        // Live assessment offline warning
        (_, EvidenceType::LiveAssessment) => None, // always valid — offline flagged separately
        // Portfolio link for non-create levels
        (BloomLevel::Remember, EvidenceType::PortfolioLink)
        | (BloomLevel::Understand, EvidenceType::PortfolioLink) => Some((
            "Portfolio links are better suited to Apply+ level competencies. Consider a Quiz or File Upload for lower Bloom levels.".into(),
            vec![EvidenceType::Quiz, EvidenceType::FileUpload],
        )),
        _ => None,
    }
}
