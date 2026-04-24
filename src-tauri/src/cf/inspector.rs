// src/cf/inspector.rs
//
// CF Inspector — computes an InspectorReport from:
//   - A CourseBrief (Mapper output, loaded from app-data cache)
//   - A ProjectInspectorSlice (CF-relevant subset of ProjectData, from Vue)
//   - An InspectorStrictness setting
//
// Three verification sections:
//   1. Compatibility  — CF ref valid, version pinned, checksum matches
//   2. Coverage       — every indicator and evidence demand accounted for
//   3. Assessment quality — formats appropriate for Bloom level
//   4. Integrity posture  — strict mode only
//
// This module has no Tauri dependency — pure logic, fully unit-testable.

use std::collections::HashMap;

use super::types::*;
use super::validation::{check_assessment_appropriateness, validate_element_proof};
use super::cache::now_ms;

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

/// Run the Inspector for a single framework alignment.
///
/// Called once per `CourseFrameworkAlignment` in the project.
/// The Vue store collects one `InspectorReport` per alignment.
pub fn run_inspector(
    slice: &ProjectInspectorSlice,
    brief: &CourseBrief,
    strictness: &InspectorStrictness,
) -> InspectorReport {
    let report_id = format!("report_{}__{}", brief.framework_id, now_ms());

    // ── Section 1: Compatibility ──────────────────────────────────────────
    let compatibility = check_compatibility(slice, brief);

    // ── Section 2: Coverage ───────────────────────────────────────────────
    let coverage = check_coverage(slice, brief, strictness);

    // ── Section 3: Assessment quality ─────────────────────────────────────
    let assessment_quality = if matches!(strictness, InspectorStrictness::Standard | InspectorStrictness::Strict) {
        check_assessment_quality(slice, brief)
    } else {
        AssessmentQualitySection { issues: vec![] }
    };

    // ── Section 4: Integrity posture (strict only) ─────────────────────────
    let integrity = if matches!(strictness, InspectorStrictness::Strict) {
        check_integrity_posture(slice, brief)
    } else {
        IntegritySection { issues: vec![] }
    };

    // ── Publish readiness ─────────────────────────────────────────────────
    let (publish_ready, blocking_errors) =
        compute_publish_readiness(&compatibility, &coverage, &assessment_quality, &integrity, strictness);

    InspectorReport {
        report_id,
        framework_id: brief.framework_id.clone(),
        framework_version: brief.framework_version.clone(),
        generated_at: now_ms(),
        strictness: strictness.clone(),
        compatibility,
        coverage,
        assessment_quality,
        integrity,
        publish_ready,
        blocking_errors,
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: COMPATIBILITY
// ─────────────────────────────────────────────────────────────────────────────

fn check_compatibility(
    slice: &ProjectInspectorSlice,
    brief: &CourseBrief,
) -> CompatibilitySection {
    let mut checks = Vec::new();

    // Find the alignment for this brief's framework
    let alignment = slice.framework_alignments.iter()
        .find(|a| a.framework_id == brief.framework_id);

    match alignment {
        None => {
            checks.push(CompatibilityCheck {
                check_id: "no_alignment".into(),
                label: "Framework not aligned".into(),
                severity: InspectorSeverity::Error,
                message: format!(
                    "No course alignment found for framework '{}'. Run the CF Mapper to import it.",
                    brief.framework_id
                ),
                navigation: None,
            });
            return CompatibilitySection {
                overall: InspectorSeverity::Error,
                checks,
            };
        }
        Some(alignment) => {
            // Version match
            if alignment.framework_version != brief.framework_version {
                checks.push(CompatibilityCheck {
                    check_id: "version_mismatch".into(),
                    label: "Framework version mismatch".into(),
                    severity: InspectorSeverity::Warning,
                    message: format!(
                        "Course is aligned to v{} but the brief is for v{}. Re-run the CF Mapper.",
                        alignment.framework_version, brief.framework_version
                    ),
                    navigation: None,
                });
            } else {
                checks.push(CompatibilityCheck {
                    check_id: "version_pinned".into(),
                    label: "Framework version pinned".into(),
                    severity: InspectorSeverity::Ok,
                    message: format!("Aligned to v{}", alignment.framework_version),
                    navigation: None,
                });
            }

            // Checksum match
            if alignment.framework_checksum != brief.framework_checksum {
                checks.push(CompatibilityCheck {
                    check_id: "checksum_mismatch".into(),
                    label: "Framework content changed".into(),
                    severity: InspectorSeverity::Warning,
                    message: "The cached framework checksum differs from the alignment record. \
                               The CF may have been updated. Re-run the CF Mapper.".into(),
                    navigation: None,
                });
            } else {
                checks.push(CompatibilityCheck {
                    check_id: "checksum_ok".into(),
                    label: "Framework integrity verified".into(),
                    severity: InspectorSeverity::Ok,
                    message: "Framework checksum matches.".into(),
                    navigation: None,
                });
            }
        }
    }

    // Unresolved external dependencies
    for dep in &brief.unresolved_dependencies {
        if dep.edge_type == "prerequisite" {
            checks.push(CompatibilityCheck {
                check_id: format!("unresolved_dep_{}", dep.competency_id),
                label: "Unresolved prerequisite dependency".into(),
                severity: InspectorSeverity::Warning,
                message: format!(
                    "Competency '{}' has a prerequisite in external framework '{}' \
                     which is not imported into this project.",
                    dep.referenced_by_competency_id, dep.framework_id
                ),
                navigation: None,
            });
        }
    }

    // Module alignment consistency:
    // Every module with cf_alignment.framework_id must match this brief's framework_id
    for module in &slice.modules {
        if let Some(ma) = &module.cf_alignment {
            if ma.framework_id != brief.framework_id {
                // Different framework — not an error, just skip
                continue;
            }
            // Competency must exist in the brief
            if !brief.competencies.contains_key(&ma.competency_id) {
                checks.push(CompatibilityCheck {
                    check_id: format!("invalid_competency_ref_{}", module.id),
                    label: "Invalid competency reference".into(),
                    severity: InspectorSeverity::Error,
                    message: format!(
                        "Module '{}' references competency '{}' which does not exist in framework '{}'.",
                        module.id, ma.competency_id, brief.framework_id
                    ),
                    navigation: Some(InspectorNavTarget {
                        target_type: "module".into(),
                        module_id: Some(module.id.clone()),
                        lesson_id: None,
                        page_id: None,
                        element_id: None,
                    }),
                });
            }
        }
    }

    // Lesson alignment consistency: indicator_ids must exist in brief
    for lesson in slice.lessons.values() {
        if let Some(la) = &lesson.cf_alignment {
            if la.framework_id != brief.framework_id {
                continue;
            }
            for ind_id in &la.indicator_ids {
                if !brief.indicators.contains_key(ind_id) {
                    checks.push(CompatibilityCheck {
                        check_id: format!("invalid_indicator_ref_{}_{}", lesson.id, ind_id),
                        label: "Invalid indicator reference".into(),
                        severity: InspectorSeverity::Error,
                        message: format!(
                            "Lesson '{}' references indicator '{}' which does not exist in framework '{}'.",
                            lesson.id, ind_id, brief.framework_id
                        ),
                        navigation: Some(InspectorNavTarget {
                            target_type: "lesson".into(),
                            module_id: None,
                            lesson_id: Some(lesson.id.clone()),
                            page_id: None,
                            element_id: None,
                        }),
                    });
                }
            }
            // Assessment lessons: evidence_item_id must exist
            if let Some(ev_id) = &la.evidence_item_id {
                if !brief.evidence_demands.contains_key(ev_id.as_str()) {
                    checks.push(CompatibilityCheck {
                        check_id: format!("invalid_evidence_ref_{}_{}", lesson.id, ev_id),
                        label: "Invalid evidence item reference".into(),
                        severity: InspectorSeverity::Error,
                        message: format!(
                            "Assessment lesson '{}' references evidence item '{}' \
                             which does not exist in framework '{}'.",
                            lesson.id, ev_id, brief.framework_id
                        ),
                        navigation: Some(InspectorNavTarget {
                            target_type: "lesson".into(),
                            module_id: None,
                            lesson_id: Some(lesson.id.clone()),
                            page_id: None,
                            element_id: None,
                        }),
                    });
                }
            }
        }
    }

    // Element proof type consistency
    for page in slice.pages.values() {
        for el in &page.cf_elements {
            if let Some(proof) = &el.cf_proof {
                if proof.framework_id != brief.framework_id {
                    continue;
                }
                if let Err(msg) = validate_element_proof(&el.component_id, proof) {
                    checks.push(CompatibilityCheck {
                        check_id: format!("invalid_proof_{}_{}", page.id, el.element_id),
                        label: "Invalid element CF proof".into(),
                        severity: InspectorSeverity::Error,
                        message: msg,
                        navigation: Some(InspectorNavTarget {
                            target_type: "element".into(),
                            module_id: None,
                            lesson_id: None,
                            page_id: Some(page.id.clone()),
                            element_id: Some(el.element_id.clone()),
                        }),
                    });
                }
            }
        }
    }

    let overall = if checks.iter().any(|c| c.severity == InspectorSeverity::Error) {
        InspectorSeverity::Error
    } else if checks.iter().any(|c| c.severity == InspectorSeverity::Warning) {
        InspectorSeverity::Warning
    } else {
        InspectorSeverity::Ok
    };

    CompatibilitySection { overall, checks }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: COVERAGE
// ─────────────────────────────────────────────────────────────────────────────

fn check_coverage(
    slice: &ProjectInspectorSlice,
    brief: &CourseBrief,
    strictness: &InspectorStrictness,
) -> CoverageSection {

    // Build lookup: module_id → competency_id (for this framework only)
    let module_competency: HashMap<&str, &str> = slice.modules.iter()
        .filter_map(|m| {
            m.cf_alignment.as_ref()
                .filter(|a| a.framework_id == brief.framework_id)
                .map(|a| (m.id.as_str(), a.competency_id.as_str()))
        })
        .collect();

    // Reverse: competency_id → module_id
    let competency_module: HashMap<&str, &str> = module_competency.iter()
        .map(|(m, c)| (*c, *m))
        .collect();

    // Build lookup: evidence_item_id → (lesson_id, lesson_type)
    let mut evidence_lesson: HashMap<&str, &str> = HashMap::new();
    for lesson in slice.lessons.values() {
        if let Some(la) = &lesson.cf_alignment {
            if la.framework_id != brief.framework_id {
                continue;
            }
            if let Some(ev_id) = &la.evidence_item_id {
                evidence_lesson.insert(ev_id.as_str(), lesson.id.as_str());
            }
        }
    }

    // Build lookup: indicator_id → [lesson_id]
    let mut indicator_lessons: HashMap<&str, Vec<&str>> = HashMap::new();
    for lesson in slice.lessons.values() {
        if lesson.lesson_type == "reference" {
            continue; // reference lessons make no coverage claims
        }
        if let Some(la) = &lesson.cf_alignment {
            if la.framework_id != brief.framework_id {
                continue;
            }
            for ind_id in &la.indicator_ids {
                indicator_lessons
                    .entry(ind_id.as_str())
                    .or_default()
                    .push(lesson.id.as_str());
            }
        }
    }

    // Build lookup: evidence_item_id → ProvenByElement
    // Walk all pages and collect ComponentElements with matching cf_proof
    let mut evidence_proof: HashMap<&str, ProvenByElement> = HashMap::new();
    for page in slice.pages.values() {
        for el in &page.cf_elements {
            if let Some(proof) = &el.cf_proof {
                if proof.framework_id != brief.framework_id {
                    continue;
                }
                // Only insert if not already found (first match wins)
                evidence_proof.entry(proof.evidence_item_id.as_str()).or_insert(
                    ProvenByElement {
                        page_id: page.id.clone(),
                        element_id: el.element_id.clone(),
                        component_id: el.component_id.clone(),
                    }
                );
            }
        }
    }

    // ── Per-competency coverage ───────────────────────────────────────────
    let mut by_competency: HashMap<String, CompetencyCoverageResult> = HashMap::new();
    let mut summary = CoverageSummary {
        total_competencies: brief.competencies.len(),
        complete: 0,
        partial: 0,
        not_started: 0,
        total_indicators: 0,
        indicators_covered: 0,
        total_evidence_demands: 0,
        evidence_proven: 0,
        evidence_claimed: 0,
        evidence_missing: 0,
    };

    for (comp_id, brief_comp) in &brief.competencies {

        let module_id = competency_module.get(comp_id.as_str()).map(|s| s.to_string());

        // ── Indicators ────────────────────────────────────────────────────
        let mut indicator_results = Vec::new();
        for ind in &brief_comp.indicators {
            summary.total_indicators += 1;
            let covering_lessons = indicator_lessons
                .get(ind.indicator_id.as_str())
                .cloned()
                .unwrap_or_default();

            let status = if covering_lessons.is_empty() {
                IndicatorCoverageStatus::Missing
            } else {
                summary.indicators_covered += 1;
                IndicatorCoverageStatus::Covered
            };

            indicator_results.push(IndicatorCoverageResult {
                indicator_id: ind.indicator_id.clone(),
                description: ind.description.clone(),
                bloom_level: ind.bloom_level.clone(),
                status,
                covered_by_lesson_ids: covering_lessons.iter().map(|s| s.to_string()).collect(),
            });
        }

        // ── Evidence demands ──────────────────────────────────────────────
        let mut evidence_results = Vec::new();
        for ev_demand in &brief_comp.evidence_demands {
            if ev_demand.optional {
                // Optional demands don't count against coverage
                continue;
            }
            summary.total_evidence_demands += 1;

            let mapped_lesson_id = evidence_lesson
                .get(ev_demand.evidence_item_id.as_str())
                .map(|s| s.to_string());

            let proven_by = evidence_proof
                .get(ev_demand.evidence_item_id.as_str())
                .cloned();

            let (status, claim_gap) = determine_evidence_status(
                &mapped_lesson_id,
                &proven_by,
                ev_demand,
            );

            match &status {
                EvidenceCoverageStatus::Proven  => summary.evidence_proven  += 1,
                EvidenceCoverageStatus::Claimed => summary.evidence_claimed += 1,
                EvidenceCoverageStatus::Missing => summary.evidence_missing += 1,
            }

            evidence_results.push(EvidenceCoverageResult {
                evidence_item_id: ev_demand.evidence_item_id.clone(),
                evidence_type: ev_demand.evidence_type.clone(),
                description: ev_demand.description.clone(),
                optional: ev_demand.optional,
                status,
                mapped_lesson_id,
                proven_by_element: proven_by,
                claim_gap,
            });
        }

        // ── Competency status ─────────────────────────────────────────────
        let comp_status = compute_competency_status(
            &indicator_results,
            &evidence_results,
            &module_id,
            strictness,
        );

        match comp_status {
            CompetencyCoverageStatus::Complete   => summary.complete    += 1,
            CompetencyCoverageStatus::Partial    => summary.partial     += 1,
            CompetencyCoverageStatus::NotStarted => summary.not_started += 1,
        }

        by_competency.insert(comp_id.clone(), CompetencyCoverageResult {
            competency_id: comp_id.clone(),
            title: brief_comp.title.clone(),
            domain_name: brief_comp.domain_name.clone(),
            bloom_level: brief_comp.bloom_level.clone(),
            proficiency_level: brief_comp.proficiency_level.clone(),
            status: comp_status,
            covered_by_module_id: module_id,
            indicators: indicator_results,
            evidence: evidence_results,
        });
    }

    let overall = if summary.not_started == summary.total_competencies {
        CompetencyCoverageStatus::NotStarted
    } else if summary.complete == summary.total_competencies {
        CompetencyCoverageStatus::Complete
    } else {
        CompetencyCoverageStatus::Partial
    };

    CoverageSection { overall, by_competency, summary }
}

/// Three-tier evidence status determination.
fn determine_evidence_status(
    mapped_lesson_id: &Option<String>,
    proven_by: &Option<ProvenByElement>,
    demand: &BriefEvidenceDemand,
) -> (EvidenceCoverageStatus, Option<String>) {
    match (mapped_lesson_id, proven_by) {
        (None, _) => (
            EvidenceCoverageStatus::Missing,
            None,
        ),
        (Some(_), Some(_)) => (
            EvidenceCoverageStatus::Proven,
            None,
        ),
        (Some(lesson_id), None) => {
            let gap = format!(
                "Assessment lesson '{}' is mapped to evidence '{}' ({:?}) \
                 but no ComponentElement with a matching cf_proof was found in its pages. \
                 Add a {} component and set its CF proof.",
                lesson_id,
                demand.evidence_item_id,
                demand.evidence_type,
                format!("{:?}", demand.evidence_type).to_lowercase(),
            );
            (EvidenceCoverageStatus::Claimed, Some(gap))
        }
    }
}

fn compute_competency_status(
    indicators: &[IndicatorCoverageResult],
    evidence: &[EvidenceCoverageResult],
    module_id: &Option<String>,
    strictness: &InspectorStrictness,
) -> CompetencyCoverageStatus {
    // Not started: no module aligned
    if module_id.is_none() {
        return CompetencyCoverageStatus::NotStarted;
    }

    let all_indicators_covered = indicators.iter()
        .all(|i| i.status == IndicatorCoverageStatus::Covered);

    let required_evidence: Vec<_> = evidence.iter()
        .filter(|e| !e.optional)
        .collect();

    let all_evidence_proven = required_evidence.iter()
        .all(|e| e.status == EvidenceCoverageStatus::Proven);

    // In strict mode, CLAIMED counts as not complete
    // In standard mode, CLAIMED is acceptable for completeness
    let evidence_ok = match strictness {
        InspectorStrictness::Strict => all_evidence_proven,
        _ => required_evidence.iter()
            .all(|e| e.status != EvidenceCoverageStatus::Missing),
    };

    if all_indicators_covered && evidence_ok {
        CompetencyCoverageStatus::Complete
    } else if indicators.iter().any(|i| i.status == IndicatorCoverageStatus::Covered)
        || required_evidence.iter().any(|e| e.status != EvidenceCoverageStatus::Missing) {
        CompetencyCoverageStatus::Partial
    } else {
        CompetencyCoverageStatus::NotStarted
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: ASSESSMENT QUALITY
// ─────────────────────────────────────────────────────────────────────────────

fn check_assessment_quality(
    slice: &ProjectInspectorSlice,
    brief: &CourseBrief,
) -> AssessmentQualitySection {
    let mut issues = Vec::new();

    // Per-competency: if the only evidence types used are weak for the Bloom level, warn
    // Build: competency_id → [evidence_types used in assessment lessons]
    let mut comp_evidence_types: HashMap<&str, Vec<EvidenceType>> = HashMap::new();

    for lesson in slice.lessons.values() {
        if lesson.lesson_type != "assessment" {
            continue;
        }
        if let Some(la) = &lesson.cf_alignment {
            if la.framework_id != brief.framework_id {
                continue;
            }
            if let (Some(_ev_id), Some(ev_type)) = (&la.evidence_item_id, &la.evidence_type) {
                comp_evidence_types
                    .entry(la.competency_id.as_str())
                    .or_default()
                    .push(ev_type.clone());
            }
        }
    }

    for (comp_id, ev_types) in &comp_evidence_types {
        let brief_comp = match brief.competencies.get(*comp_id) {
            Some(c) => c,
            None => continue,
        };

        // For each evidence type used, check against Bloom level
        for ev_type in ev_types {
            if let Some((msg, suggestions)) =
                check_assessment_appropriateness(&brief_comp.bloom_level, ev_type)
            {
                // Only warn if ALL evidence types for this competency have the same issue
                // (i.e. don't warn if they also have a strong evidence type)
                let has_strong = ev_types.iter().any(|t| {
                    check_assessment_appropriateness(&brief_comp.bloom_level, t).is_none()
                });
                if !has_strong {
                    let issue_id = format!("quality_{}__{:?}", comp_id, ev_type);
                    issues.push(AssessmentQualityIssue {
                        issue_id,
                        lesson_id: String::new(), // competency-level warning
                        competency_id: comp_id.to_string(),
                        bloom_level: brief_comp.bloom_level.clone(),
                        evidence_type_used: ev_type.clone(),
                        suggested_types: suggestions,
                        severity: InspectorSeverity::Warning,
                        message: msg,
                        navigation: InspectorNavTarget {
                            target_type: "competency".into(),
                            module_id: None,
                            lesson_id: None,
                            page_id: None,
                            element_id: None,
                        },
                    });
                }
            }
        }
    }

    AssessmentQualitySection { issues }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: INTEGRITY POSTURE (STRICT MODE)
// ─────────────────────────────────────────────────────────────────────────────

fn check_integrity_posture(
    _slice: &ProjectInspectorSlice,
    brief: &CourseBrief,
) -> IntegritySection {
    let mut issues = Vec::new();

    // Build: evidence_item_id → how many non-optional evidence items exist for its competency
    let mut comp_evidence_counts: HashMap<&str, usize> = HashMap::new();
    for (comp_id, brief_comp) in &brief.competencies {
        let non_optional_count = brief_comp.evidence_demands.iter()
            .filter(|e| !e.optional)
            .count();
        comp_evidence_counts.insert(comp_id.as_str(), non_optional_count);
    }

    for demand in brief.evidence_demands.values() {
        if demand.optional {
            continue;
        }

        // Check 1: triangulation — competency must have ≥2 non-optional evidence items
        if demand.triangulation_required {
            let count = comp_evidence_counts
                .get(demand.competency_id.as_str())
                .copied()
                .unwrap_or(0);
            if count < 2 {
                issues.push(IntegrityPostureIssue {
                    issue_id: format!("integrity_triangulation_{}", demand.evidence_item_id),
                    evidence_item_id: demand.evidence_item_id.clone(),
                    competency_id: demand.competency_id.clone(),
                    check: "triangulation_not_met".into(),
                    severity: InspectorSeverity::Error,
                    message: format!(
                        "Evidence item '{}' requires triangulation but competency '{}' \
                         has only {} non-optional evidence item(s). Add at least one more.",
                        demand.evidence_item_id, demand.competency_id, count
                    ),
                    navigation: InspectorNavTarget {
                        target_type: "competency".into(),
                        module_id: None,
                        lesson_id: None,
                        page_id: None,
                        element_id: None,
                    },
                });
            }
        }

        // Check 2: live_presence — evidence type must be video_demo or live_assessment
        if demand.live_presence_required {
            let type_ok = matches!(
                demand.evidence_type,
                EvidenceType::VideoDemo | EvidenceType::LiveAssessment
            );
            if !type_ok {
                issues.push(IntegrityPostureIssue {
                    issue_id: format!("integrity_live_presence_{}", demand.evidence_item_id),
                    evidence_item_id: demand.evidence_item_id.clone(),
                    competency_id: demand.competency_id.clone(),
                    check: "live_presence_not_met".into(),
                    severity: InspectorSeverity::Error,
                    message: format!(
                        "Evidence item '{}' requires live presence but uses type '{:?}'. \
                         Only VideoDemo or LiveAssessment satisfy live presence.",
                        demand.evidence_item_id, demand.evidence_type
                    ),
                    navigation: InspectorNavTarget {
                        target_type: "competency".into(),
                        module_id: None,
                        lesson_id: None,
                        page_id: None,
                        element_id: None,
                    },
                });
            }
        }
    }

    IntegritySection { issues }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLISH READINESS
// ─────────────────────────────────────────────────────────────────────────────

fn compute_publish_readiness(
    compatibility: &CompatibilitySection,
    coverage: &CoverageSection,
    _quality: &AssessmentQualitySection,
    integrity: &IntegritySection,
    strictness: &InspectorStrictness,
) -> (bool, Vec<String>) {
    let mut errors = Vec::new();

    // Compatibility errors block publish
    for check in &compatibility.checks {
        if check.severity == InspectorSeverity::Error {
            errors.push(check.message.clone());
        }
    }

    // Coverage: any missing evidence demand blocks publish
    for comp_result in coverage.by_competency.values() {
        for ev in &comp_result.evidence {
            if !ev.optional && ev.status == EvidenceCoverageStatus::Missing {
                errors.push(format!(
                    "Evidence '{}' ({:?}) for competency '{}' is missing.",
                    ev.evidence_item_id, ev.evidence_type, comp_result.title
                ));
            } else if matches!(strictness, InspectorStrictness::Strict)
                && !ev.optional
                && ev.status == EvidenceCoverageStatus::Claimed
            {
                errors.push(format!(
                    "Evidence '{}' ({:?}) for competency '{}' is only claimed, not proven by a CF-proof element.",
                    ev.evidence_item_id, ev.evidence_type, comp_result.title
                ));
            }
        }
        // All indicators must be covered
        for ind in &comp_result.indicators {
            if ind.status == IndicatorCoverageStatus::Missing {
                errors.push(format!(
                    "Indicator '{}' for competency '{}' is not covered by any lesson.",
                    ind.indicator_id, comp_result.title
                ));
            }
        }
    }

    // Integrity errors (strict mode) block publish
    for issue in &integrity.issues {
        if issue.severity == InspectorSeverity::Error {
            errors.push(issue.message.clone());
        }
    }

    // Note: assessment quality warnings do NOT block publish

    (errors.is_empty(), errors)
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIT TESTS
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cf::mapper::run_mapper;

    fn make_brief() -> CourseBrief {
        // Build a minimal framework and run the Mapper to get a real brief
        use crate::cf::mapper::tests::*;
        // We need a published framework with checksum for full validation.
        // For unit tests we bypass checksum by using the brief directly.
        let fw = minimal_published_framework();
        let result = run_mapper(&fw, None);
        result.brief.expect("Mapper should produce a brief for a valid framework")
    }

    /// Build a minimal project slice for tests
    fn make_slice(brief: &CourseBrief) -> ProjectInspectorSlice {
        let framework_id = brief.framework_id.clone();
        let competency_id = brief.competencies.keys().next().unwrap().clone();
        let indicator_id = brief.indicators.keys().next().unwrap().clone();
        let mut module_lesson_ids = vec!["lesson_01".to_string()];

        let activity_lesson = LessonSlice {
            id: "lesson_01".into(),
            lesson_type: "activity".into(),
            cf_alignment: Some(LessonCFAlignment {
                framework_id: framework_id.clone(),
                competency_id: competency_id.clone(),
                indicator_ids: vec![indicator_id.clone()],
                evidence_item_id: None,
                evidence_type: None,
            }),
            page_ids: vec![],
        };

        let mut lessons = HashMap::new();
        lessons.insert("lesson_01".into(), activity_lesson);

        let mut pages = HashMap::new();

        // Build one assessment lesson + proof-bearing page per evidence demand.
        // This keeps the "fully covered" fixture aligned with evolving framework demands.
        for (idx, demand) in brief.evidence_demands.values().enumerate() {
            let n = idx + 1;
            let lesson_id = format!("lesson_assessment_{n:02}");
            let page_id = format!("page_{n:02}");
            let element_id = format!("el_{n:02}");

            module_lesson_ids.push(lesson_id.clone());

            let assessment_lesson = LessonSlice {
                id: lesson_id.clone(),
                lesson_type: "assessment".into(),
                cf_alignment: Some(LessonCFAlignment {
                    framework_id: framework_id.clone(),
                    competency_id: competency_id.clone(),
                    indicator_ids: vec![indicator_id.clone()],
                    evidence_item_id: Some(demand.evidence_item_id.clone()),
                    evidence_type: Some(demand.evidence_type.clone()),
                }),
                page_ids: vec![page_id.clone()],
            };
            lessons.insert(lesson_id, assessment_lesson);

            let page = PageSlice {
                id: page_id.clone(),
                cf_elements: vec![CfElementSlice {
                    element_id,
                    component_id: match &demand.evidence_type {
                        EvidenceType::VideoDemo => "evidence.recorder.screen".into(),
                        EvidenceType::Quiz => "quiz.mcq.single".into(),
                        _ => "evidence.upload.file".into(),
                    },
                    cf_proof: Some(ElementCFProof {
                        framework_id: framework_id.clone(),
                        competency_id: competency_id.clone(),
                        evidence_item_id: demand.evidence_item_id.clone(),
                        evidence_type: demand.evidence_type.clone(),
                    }),
                }],
            };
            pages.insert(page_id, page);
        }

        let module = ModuleSlice {
            id: "mod_01".into(),
            cf_alignment: Some(ModuleCFAlignment {
                framework_id: framework_id.clone(),
                competency_id: competency_id.clone(),
            }),
            lesson_ids: module_lesson_ids,
        };

        ProjectInspectorSlice {
            project_id: "proj_test".into(),
            framework_alignments: vec![
                CourseFrameworkAlignment {
                    framework_id: framework_id.clone(),
                    framework_version: brief.framework_version.clone(),
                    framework_checksum: brief.framework_checksum.clone(),
                    aligned_at: 0,
                    brief_id: brief.brief_id.clone(),
                    framework_title: "Test Framework".into(),
                },
            ],
            modules: vec![module],
            lessons,
            pages,
        }
    }

    #[test]
    fn test_fully_covered_project_is_publish_ready() {
        let brief = make_brief();
        let slice = make_slice(&brief);
        let report = run_inspector(&slice, &brief, &InspectorStrictness::Standard);
        assert!(
            report.publish_ready,
            "Fully covered project should be publish ready. Errors: {:?}",
            report.blocking_errors
        );
    }

    #[test]
    fn test_missing_module_gives_not_started() {
        let brief = make_brief();
        let mut slice = make_slice(&brief);
        // Remove module alignment
        slice.modules[0].cf_alignment = None;
        let report = run_inspector(&slice, &brief, &InspectorStrictness::Standard);
        let comp_id = brief.competencies.keys().next().unwrap();
        let comp_result = &report.coverage.by_competency[comp_id];
        assert_eq!(comp_result.status, CompetencyCoverageStatus::NotStarted);
    }

    #[test]
    fn test_claimed_evidence_without_element() {
        let brief = make_brief();
        let mut slice = make_slice(&brief);
        // Remove the cf_proof from the element
        for page in slice.pages.values_mut() {
            for el in page.cf_elements.iter_mut() {
                el.cf_proof = None;
            }
        }
        let report = run_inspector(&slice, &brief, &InspectorStrictness::Standard);
        let comp_id = brief.competencies.keys().next().unwrap();
        let comp_result = &report.coverage.by_competency[comp_id];
        let has_claimed = comp_result.evidence.iter()
            .any(|e| e.status == EvidenceCoverageStatus::Claimed);
        assert!(has_claimed, "Evidence without element proof should be CLAIMED");
    }

    #[test]
    fn test_strict_mode_claimed_is_not_complete() {
        let brief = make_brief();
        let mut slice = make_slice(&brief);
        // Remove element proof → CLAIMED
        for page in slice.pages.values_mut() {
            for el in page.cf_elements.iter_mut() {
                el.cf_proof = None;
            }
        }
        let report = run_inspector(&slice, &brief, &InspectorStrictness::Strict);
        assert!(
            !report.publish_ready,
            "Strict mode: CLAIMED evidence should block publish"
        );
    }
}
