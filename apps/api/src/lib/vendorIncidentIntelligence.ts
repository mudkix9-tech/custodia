/**
 * Vendor Incident Intelligence & Blast Radius Triage — audit D16.
 *
 * Provides:
 *   - Intersection analysis between incident affectedDataCategories and an
 *     organisation's dataCategoriesShared.
 *   - Severity calculation and Article 33/34 notification triggers.
 *   - Documented negative rationale generation ("Assessed, not affected").
 */

import { isSpecialCategoryValue } from '../constants/vendorDataCategories.js';

export interface IncidentTriageResult {
  isImpacted: boolean;
  impactLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  sharedAffectedCategories: string[];
  involvesSpecialCategory: boolean;
  requiresArt33Evaluation: boolean;
  rationale: string;
  recommendedAction: string;
}

export interface BlastRadiusEvaluation {
  isBlastRadiusRelevant: boolean;
  categoryIntersection: string[];
  hasSpecialCategoryExposure: boolean;
  blastRadiusScore: number;
  rationale: string;
  recommendedAction: string;
}

/**
 * Calculates the blast radius and customer impact of a security incident
 * based on the intersection of affected data categories and shared data categories.
 */
export function evaluateIncidentImpact(
  affectedCategories: string[] = [],
  sharedCategories: string[] = []
): IncidentTriageResult {
  const normAffected = affectedCategories.map((c) => c.toLowerCase().trim());
  const normShared = sharedCategories.map((c) => c.toLowerCase().trim());

  // Compute category intersection
  const sharedAffected = normShared.filter((cat) =>
    normAffected.some((aff) => aff.includes(cat) || cat.includes(aff))
  );

  const isImpacted = sharedAffected.length > 0;
  const involvesSpecialCategory = sharedAffected.some((cat) => isSpecialCategoryValue(cat));

  if (!isImpacted) {
    return {
      isImpacted: false,
      impactLevel: 'none',
      sharedAffectedCategories: [],
      involvesSpecialCategory: false,
      requiresArt33Evaluation: false,
      rationale: `Organisation records ${sharedCategories.length} data categories with this vendor (${sharedCategories.join(', ') || 'none'}), none of which overlap with the incident's affected scope (${affectedCategories.join(', ') || 'unspecified'}).`,
      recommendedAction: 'Document as assessed with zero impact. No regulator or data subject notification required.',
    };
  }

  let impactLevel: 'low' | 'medium' | 'high' | 'critical' = 'medium';
  if (involvesSpecialCategory) {
    impactLevel = 'critical';
  } else if (sharedAffected.length >= 3) {
    impactLevel = 'high';
  } else if (sharedAffected.length === 1) {
    impactLevel = 'low';
  }

  const requiresArt33Evaluation = involvesSpecialCategory || impactLevel === 'high';

  return {
    isImpacted: true,
    impactLevel,
    sharedAffectedCategories: sharedAffected,
    involvesSpecialCategory,
    requiresArt33Evaluation,
    rationale: `Direct impact confirmed: ${sharedAffected.length} category/categories shared with vendor are affected (${sharedAffected.join(', ')}).${
      involvesSpecialCategory ? ' WARNING: Includes Special Category data under GDPR Article 9.' : ''
    }`,
    recommendedAction: requiresArt33Evaluation
      ? 'Initiate statutory GDPR Article 33 breach assessment (72-hour clock) and verify security measures.'
      : 'Review vendor response measures, request breach remediation report, and update risk score.',
  };
}

/**
 * Higher-level blast radius evaluator returning scored metrics.
 */
export function evaluateIncidentBlastRadius(
  incident: { title?: string; affectedCategories?: string[]; severity?: string },
  sharedCategories: string[] = []
): BlastRadiusEvaluation {
  const result = evaluateIncidentImpact(incident.affectedCategories || [], sharedCategories);
  const baseScore = incident.severity === 'critical' ? 80 : incident.severity === 'high' ? 60 : 40;
  const multiplier = result.involvesSpecialCategory ? 1.5 : result.isImpacted ? 1.2 : 0.2;
  const blastRadiusScore = Math.min(100, Math.round(baseScore * multiplier));

  return {
    isBlastRadiusRelevant: result.isImpacted,
    categoryIntersection: result.sharedAffectedCategories,
    hasSpecialCategoryExposure: result.involvesSpecialCategory,
    blastRadiusScore,
    rationale: result.rationale,
    recommendedAction: result.recommendedAction,
  };
}
