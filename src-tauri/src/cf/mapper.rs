// src/cf/mapper.rs
//
// CF Mapper — computes a CourseBrief from a validated CompetenceFramework.
//
// Responsibilities:
//   1. Validate the framework (checksum, status, schema rules)
//   2. Build indexed flat structures for O(1) Inspector lookups
//   3. Build the prerequisite graph
//   4. Derive platform capability summary
//   5. Identify unresolved cross-framework dependencies
//
// This module has no Tauri dependency — it is pure logic and fully unit-testable.

use std::collections::{HashMap, HashSet};

use super::types::*;
use super::cache::{new_brief_id, now_ms};
use super::validation::{validate_framework, ValidationResult};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

pub struct MapperResult {
    pub brief: Option<CourseBrief>,
    pub validation: ValidationResult,
    pub warnings: Vec<String>,
}

/// Build a CourseBrief from a CompetenceFramework.
///
/// Returns a MapperResult. If validation fails (errors present),
/// brief will be None. Warnings do not block brief production.
pub fn run_mapper(
    framework: &CompetenceFramework,
    existing_brief_id: Option<&str>,
) -> MapperResult {
    // Step 1: validate
    let validation = validate_framework(framework);
    if !validation.valid {
        return MapperResult {
            brief: None,
            validation,
            warnings: vec![],
        };
    }

    let mut warnings = validation.warnings.clone();

    // Step 2: build indexed structures
    let (competencies, indicators, evidence_demands) =
        build_indexes(framework, &mut warnings);

    // Step 3: domain map
    let domain_map = build_domain_map(framework);

    // Step 4: prerequisite graph
    let prerequisite_graph = build_prerequisite_graph(framework);

    // Step 5: platform capability summary
    let platform = compute_platform_summary(framework);

    // Step 6: external dependencies
    let (unresolved, external_ids) = collect_external_dependencies(framework);
    if !external_ids.is_empty() {
        warnings.push(format!(
            "Framework references {} external framework(s): {}. \
             Import them to enable full prerequisite validation.",
            external_ids.len(),
            external_ids.join(", ")
        ));
    }

    // Step 7: brief ID
    let brief_id = existing_brief_id
        .map(|s| s.to_string())
        .unwrap_or_else(|| new_brief_id(&framework.id, &framework.metadata.version));

    let brief = CourseBrief {
        brief_id,
        framework_id: framework.id.clone(),
        framework_version: framework.metadata.version.clone(),
        framework_checksum: framework.metadata.checksum.clone().unwrap_or_default(),
        generated_at: now_ms(),
        competencies,
        indicators,
        evidence_demands,
        domain_map,
        prerequisite_graph,
        required_evidence_types: platform.required_evidence_types,
        required_validator_modes: platform.required_validator_modes,
        requires_offline_support: platform.requires_offline_support,
        requires_async_validation_queue: platform.requires_async_validation_queue,
        requires_peer_validation: platform.requires_peer_validation,
        min_bloom_level_demanded: platform.min_bloom_level_demanded,
        max_bloom_level_demanded: platform.max_bloom_level_demanded,
        unresolved_dependencies: unresolved,
        external_framework_ids: external_ids,
    };

    MapperResult {
        brief: Some(brief),
        validation,
        warnings,
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// INDEX BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

/// Build three flat indexed maps for O(1) Inspector lookups.
fn build_indexes(
    framework: &CompetenceFramework,
    warnings: &mut Vec<String>,
) -> (
    HashMap<String, BriefCompetency>,
    HashMap<String, BriefIndicator>,
    HashMap<String, BriefEvidenceDemand>,
) {
    let mut competencies: HashMap<String, BriefCompetency> = HashMap::new();
    let mut indicators: HashMap<String, BriefIndicator> = HashMap::new();
    let mut evidence_demands: HashMap<String, BriefEvidenceDemand> = HashMap::new();

    for domain in &framework.domains {
        for comp in &domain.competencies {

            // ── Indicators ────────────────────────────────────────────────────
            let mut brief_indicators = Vec::new();
            for ind in &comp.indicators {
                let bloom = ind.bloom_level.clone()
                    .unwrap_or_else(|| comp.cognitive_profile.bloom_level.clone());

                let suggested_type = ind.assessment_hints
                    .as_ref()
                    .and_then(|hints| hints.first())
                    .map(|h| h.suggested_type.clone());

                let alternative_types = ind.assessment_hints
                    .as_ref()
                    .and_then(|hints| hints.first())
                    .and_then(|h| h.alternatives.clone());

                let brief_ind = BriefIndicator {
                    indicator_id: ind.id.clone(),
                    competency_id: comp.id.clone(),
                    description: ind.description.clone(),
                    bloom_level: bloom,
                    suggested_evidence_type: suggested_type,
                    alternative_evidence_types: alternative_types,
                };

                // Detect duplicate indicator IDs (should never happen in a valid CF)
                if indicators.contains_key(&ind.id) {
                    warnings.push(format!(
                        "Duplicate indicator ID '{}' in competency '{}'.",
                        ind.id, comp.id
                    ));
                }

                indicators.insert(ind.id.clone(), brief_ind.clone());
                brief_indicators.push(brief_ind);
            }

            // ── Evidence demands ──────────────────────────────────────────────
            let mut brief_evidence = Vec::new();
            for ev in &comp.evidence_required {
                let demand = BriefEvidenceDemand {
                    evidence_item_id: ev.id.clone(),
                    competency_id: comp.id.clone(),
                    evidence_type: ev.evidence_type.clone(),
                    description: ev.description.clone(),
                    validator_mode: ev.validator.mode.clone(),
                    offline_compatible: ev.offline_compatible,
                    optional: ev.is_optional(),
                    triangulation_required: ev.integrity_posture.triangulation_required,
                    live_presence_required: ev.integrity_posture.live_presence_required,
                };

                if evidence_demands.contains_key(&ev.id) {
                    warnings.push(format!(
                        "Duplicate evidence item ID '{}' in competency '{}'.",
                        ev.id, comp.id
                    ));
                }

                evidence_demands.insert(ev.id.clone(), demand.clone());
                brief_evidence.push(demand);
            }

            // ── Relationships ─────────────────────────────────────────────────
            let prereq_ids = extract_within_framework_refs(
                comp.relationships.as_ref()
                    .and_then(|r| r.prerequisites.as_ref()),
            );
            let coreq_ids = extract_within_framework_refs(
                comp.relationships.as_ref()
                    .and_then(|r| r.corequisites.as_ref()),
            );
            let related_ids = extract_within_framework_refs(
                comp.relationships.as_ref()
                    .and_then(|r| r.related.as_ref()),
            );

            // ── Brief competency ──────────────────────────────────────────────
            let brief_comp = BriefCompetency {
                competency_id: comp.id.clone(),
                domain_id: domain.id.clone(),
                domain_name: domain.name.clone(),
                title: comp.title.clone(),
                description: comp.description.clone(),
                context: comp.context.clone(),
                proficiency_level: comp.proficiency_level.clone(),
                bloom_level: comp.cognitive_profile.bloom_level.clone(),
                difficulty: comp.cognitive_profile.difficulty,
                indicators: brief_indicators,
                evidence_demands: brief_evidence,
                rubric: comp.rubric.clone(),
                prerequisite_ids: prereq_ids,
                corequisite_ids: coreq_ids,
                related_ids,
            };

            competencies.insert(comp.id.clone(), brief_comp);
        }
    }

    (competencies, indicators, evidence_demands)
}

fn extract_within_framework_refs(
    refs: Option<&Vec<RelationshipRef>>,
) -> Vec<String> {
    refs.map(|rs| {
        rs.iter()
            .filter(|r| r.framework_id.is_none())
            .map(|r| r.competency_id.clone())
            .collect()
    })
    .unwrap_or_default()
}

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN MAP
// ─────────────────────────────────────────────────────────────────────────────

fn build_domain_map(framework: &CompetenceFramework) -> HashMap<String, Vec<String>> {
    framework.domains.iter()
        .map(|d| {
            let comp_ids = d.competencies.iter()
                .map(|c| c.id.clone())
                .collect();
            (d.id.clone(), comp_ids)
        })
        .collect()
}

// ─────────────────────────────────────────────────────────────────────────────
// PREREQUISITE GRAPH
// ─────────────────────────────────────────────────────────────────────────────

/// Build competency_id → [prerequisite_ids] for within-framework edges only.
fn build_prerequisite_graph(
    framework: &CompetenceFramework,
) -> HashMap<String, Vec<String>> {
    framework.domains.iter()
        .flat_map(|d| d.competencies.iter())
        .map(|c| {
            let prereqs = extract_within_framework_refs(
                c.relationships.as_ref()
                    .and_then(|r| r.prerequisites.as_ref()),
            );
            (c.id.clone(), prereqs)
        })
        .collect()
}

// ─────────────────────────────────────────────────────────────────────────────
// PLATFORM CAPABILITY SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

struct PlatformSummary {
    required_evidence_types: Vec<EvidenceType>,
    required_validator_modes: Vec<ValidatorMode>,
    requires_offline_support: bool,
    requires_async_validation_queue: bool,
    requires_peer_validation: bool,
    min_bloom_level_demanded: BloomLevel,
    max_bloom_level_demanded: BloomLevel,
}

fn compute_platform_summary(framework: &CompetenceFramework) -> PlatformSummary {
    let mut _ev_types: HashSet<String> = HashSet::new();
    let mut _val_modes: HashSet<String> = HashSet::new();
    let mut _requires_offline = false;
    let mut _requires_async = false;
    let mut _requires_peer = false;
    let mut min_bloom_rank: u8 = 5;
    let mut max_bloom_rank: u8 = 0;

    for (_, comp) in framework.all_competencies() {
        let rank = comp.cognitive_profile.bloom_level.rank();
        if rank < min_bloom_rank { min_bloom_rank = rank; }
        if rank > max_bloom_rank { max_bloom_rank = rank; }

        for ev in &comp.evidence_required {
            _ev_types.insert(format!("{:?}", ev.evidence_type));
            _val_modes.insert(format!("{:?}", ev.validator.mode));
            if ev.offline_compatible { _requires_offline = true; }
            if ev.validator.async_queue.unwrap_or(false) { _requires_async = true; }
            if matches!(ev.validator.mode, ValidatorMode::Peer | ValidatorMode::Team) {
                _requires_peer = true;
            }
        }
    }

    // Use the CF's own platform_capabilities as the authoritative source
    // (it was derived by the CF Builder on publish — trust it)
    PlatformSummary {
        required_evidence_types: framework.platform_capabilities.required_evidence_types.clone(),
        required_validator_modes: framework.platform_capabilities.required_validator_modes.clone(),
        requires_offline_support: framework.platform_capabilities.requires_offline_support,
        requires_async_validation_queue: framework.platform_capabilities.requires_async_validation_queue,
        requires_peer_validation: framework.platform_capabilities.requires_peer_validation,
        min_bloom_level_demanded: framework.platform_capabilities.min_bloom_level_demanded.clone(),
        max_bloom_level_demanded: framework.platform_capabilities.max_bloom_level_demanded.clone(),
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTERNAL DEPENDENCIES
// ─────────────────────────────────────────────────────────────────────────────

fn collect_external_dependencies(
    framework: &CompetenceFramework,
) -> (Vec<UnresolvedDependency>, Vec<String>) {
    let mut unresolved = Vec::new();
    let mut external_ids: HashSet<String> = HashSet::new();

    for (_, comp) in framework.all_competencies() {
        let rels = match &comp.relationships {
            Some(r) => r,
            None => continue,
        };

        let check_refs = |refs: Option<&Vec<RelationshipRef>>, edge_type: &str| {
            refs.unwrap_or(&vec![])
                .iter()
                .filter(|r| r.framework_id.is_some())
                .map(|r| UnresolvedDependency {
                    competency_id: r.competency_id.clone(),
                    framework_id: r.framework_id.clone().unwrap(),
                    framework_version: r.framework_version.clone(),
                    referenced_by_competency_id: comp.id.clone(),
                    edge_type: edge_type.to_string(),
                })
                .collect::<Vec<_>>()
        };

        let mut prereq_deps = check_refs(rels.prerequisites.as_ref(), "prerequisite");
        let mut coreq_deps = check_refs(rels.corequisites.as_ref(), "corequisite");
        let mut related_deps = check_refs(rels.related.as_ref(), "related");

        for dep in prereq_deps.iter().chain(coreq_deps.iter()).chain(related_deps.iter()) {
            external_ids.insert(dep.framework_id.clone());
        }

        unresolved.append(&mut prereq_deps);
        unresolved.append(&mut coreq_deps);
        unresolved.append(&mut related_deps);
    }

    let mut external_vec: Vec<String> = external_ids.into_iter().collect();
    external_vec.sort();
    (unresolved, external_vec)
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIT TESTS
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
pub mod tests {

    use super::*;

    pub fn minimal_published_framework() -> CompetenceFramework {
        let mut fw = mock_framework();
        // Compute and stamp a real checksum so validate_framework passes
        use crate::cf::validation::compute_checksum;
        let checksum = compute_checksum(&fw);
        fw.metadata.checksum = Some(checksum);
        fw
    }

    fn mock_framework() -> CompetenceFramework {
        CompetenceFramework {
            id: "cf_test_001".into(),
            title: "Test Framework".into(),
            description: "A minimal test framework".into(),
            domains: vec![
                Domain {
                    id: "domain_01".into(),
                    name: "Basic Skills".into(),
                    description: None,
                    competencies: vec![
                        Competency {
                            id: "comp_01".into(),
                            title: "Operate a System".into(),
                            description: "Can operate a computer system".into(),
                            proficiency_level: ProficiencyLevel::Emerging,
                            context: None,
                            cognitive_profile: CognitiveProfile {
                                bloom_level: BloomLevel::Apply,
                                difficulty: 2,
                                effort_hours: Some(3.0),
                                notes: None,
                            },
                            validity: None,
                            indicators: vec![
                                Indicator {
                                    id: "ind_01_01".into(),
                                    description: "Can power on and log in".into(),
                                    bloom_level: None,
                                    assessment_hints: Some(vec![
                                        AssessmentHint {
                                            suggested_type: EvidenceType::VideoDemo,
                                            rationale: Some("Procedural demonstration".into()),
                                            alternatives: Some(vec![EvidenceType::PeerObservation]),
                                        }
                                    ]),
                                },
                            ],
                            evidence_required: vec![
                                EvidenceItem {
                                    id: "ev_01_01".into(),
                                    evidence_type: EvidenceType::VideoDemo,
                                    description: "Screen recording of login procedure".into(),
                                    assessment_id: None,
                                    indicator_ids: Some(vec!["ind_01_01".into()]),
                                    validator: ValidatorConfig {
                                        mode: ValidatorMode::Mentor,
                                        min_validators: Some(1),
                                        async_queue: Some(true),
                                    },
                                    integrity_posture: IntegrityPosture {
                                        triangulation_required: true,
                                        live_presence_required: true,
                                        context_binding: ContextBinding::Session,
                                        allow_collaboration: false,
                                        notes: None,
                                    },
                                    offline_compatible: true,
                                    optional: None,
                                },
                                EvidenceItem {
                                    id: "ev_01_02".into(),
                                    evidence_type: EvidenceType::Quiz,
                                    description: "10-question OS concepts quiz".into(),
                                    assessment_id: Some("quiz_01".into()),
                                    indicator_ids: Some(vec!["ind_01_01".into()]),
                                    validator: ValidatorConfig {
                                        mode: ValidatorMode::Auto,
                                        min_validators: None,
                                        async_queue: Some(false),
                                    },
                                    integrity_posture: IntegrityPosture {
                                        triangulation_required: true,
                                        live_presence_required: false,
                                        context_binding: ContextBinding::Session,
                                        allow_collaboration: false,
                                        notes: None,
                                    },
                                    offline_compatible: true,
                                    optional: None,
                                },
                            ],
                            rubric: Rubric {
                                criteria: vec![
                                    RubricCriterion {
                                        id: "rc_01_01".into(),
                                        description: "Correct login procedure".into(),
                                        weight: 0.4,
                                        indicator_ids: None,
                                        bloom_level: None,
                                        levels: None,
                                    },
                                    RubricCriterion {
                                        id: "rc_01_02".into(),
                                        description: "File management".into(),
                                        weight: 0.6,
                                        indicator_ids: None,
                                        bloom_level: None,
                                        levels: None,
                                    },
                                ],
                                mastery_threshold: 0.75,
                                scoring_mode: Some(ScoringMode::WeightedSum),
                            },
                            relationships: None,
                        },
                    ],
                },
            ],
            groupings: None,
            platform_capabilities: PlatformCapabilities {
                required_evidence_types: vec![EvidenceType::VideoDemo, EvidenceType::Quiz],
                required_validator_modes: vec![ValidatorMode::Auto, ValidatorMode::Mentor],
                requires_offline_support: true,
                requires_async_validation_queue: true,
                requires_peer_validation: false,
                min_bloom_level_demanded: BloomLevel::Apply,
                max_bloom_level_demanded: BloomLevel::Apply,
                notes: None,
            },
            metadata: FrameworkMetadata {
                version: "1.0.0".into(),
                status: FrameworkStatus::Published,
                created_by: "user_001".into(),
                created_at: "2026-04-01T00:00:00Z".into(),
                updated_at: "2026-04-01T00:00:00Z".into(),
                tags: None,
                license: None,
                origin_institution: None,
                forked_from: None,
                // We skip checksum verification in tests by leaving it None
                // and patching validate_framework in integration tests.
                checksum: None,
                signing_key_id: None,
                locale: None,
            },
        }
    }

    #[test]
    fn test_indexes_built_correctly() {
        let fw = mock_framework();
        let mut warnings = vec![];
        let (comps, inds, evs) = build_indexes(&fw, &mut warnings);

        assert!(comps.contains_key("comp_01"), "comp_01 should be indexed");
        assert!(inds.contains_key("ind_01_01"), "ind_01_01 should be indexed");
        assert!(evs.contains_key("ev_01_01"), "ev_01_01 should be indexed");
        assert!(evs.contains_key("ev_01_02"), "ev_01_02 should be indexed");
        assert!(warnings.is_empty(), "no warnings for clean CF");
    }

    #[test]
    fn test_domain_map() {
        let fw = mock_framework();
        let domain_map = build_domain_map(&fw);
        assert_eq!(
            domain_map.get("domain_01"),
            Some(&vec!["comp_01".to_string()])
        );
    }

    #[test]
    fn test_indicator_bloom_inherits_from_competency() {
        let fw = mock_framework();
        let mut warnings = vec![];
        let (_, inds, _) = build_indexes(&fw, &mut warnings);
        let ind = inds.get("ind_01_01").unwrap();
        // ind_01_01 has no bloom_level override → inherits from competency (Apply)
        assert_eq!(ind.bloom_level, BloomLevel::Apply);
    }

    #[test]
    fn test_evidence_demand_fields() {
        let fw = mock_framework();
        let mut warnings = vec![];
        let (_, _, evs) = build_indexes(&fw, &mut warnings);
        let ev = evs.get("ev_01_01").unwrap();
        assert_eq!(ev.evidence_type, EvidenceType::VideoDemo);
        assert!(ev.triangulation_required);
        assert!(ev.live_presence_required);
        assert!(ev.offline_compatible);
        assert!(!ev.optional);
    }
}
