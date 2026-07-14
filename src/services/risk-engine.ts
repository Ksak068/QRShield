import type { RiskLevel, RiskEngineResult } from "@/types";

const WEIGHTS = {
  rfPrediction: 0.35,
  gptClassification: 0.35,
  vtDetection: 0.20,
  sbDetection: 0.05,
  domainAge: 0.05,
};

function calculateDomainAgeScore(domainAge: number | null): number {
  if (domainAge === null) return 50;
  const days = domainAge;
  if (days < 7) return 90;
  if (days < 30) return 70;
  if (days < 90) return 50;
  if (days < 365) return 30;
  return 10;
}

const DEFAULT_THRESHOLDS = {
  suspicious: 30,
  phishing: 70,
};

export function calculateRisk(
  rfProbability: number,
  gptScore: number | null,
  vtDetected: boolean,
  vtMaliciousCount: number,
  sbThreat: boolean,
  domainAge: number | null,
  thresholds?: { suspicious: number; phishing: number },
): RiskEngineResult {
  const rfContribution = rfProbability * 100 * WEIGHTS.rfPrediction;

  const gptContribution = gptScore !== null
    ? gptScore * WEIGHTS.gptClassification
    : 0;

  const vtScore = vtDetected
    ? Math.min(vtMaliciousCount * 20, 100)
    : 0;
  const vtContribution = vtScore * WEIGHTS.vtDetection;

  const sbScore = sbThreat ? 85 : 0;
  const sbContribution = sbScore * WEIGHTS.sbDetection;

  const domainAgeScore = calculateDomainAgeScore(domainAge);
  const domainAgeContribution = domainAgeScore * WEIGHTS.domainAge;

  const riskScore = Math.min(
    Math.round(rfContribution + gptContribution + vtContribution + sbContribution + domainAgeContribution),
    100,
  );

  const t = thresholds || DEFAULT_THRESHOLDS;
  let riskLevel: RiskLevel;
  if (riskScore >= t.phishing) riskLevel = "PHISHING";
  else if (riskScore >= t.suspicious) riskLevel = "SUSPICIOUS";
  else riskLevel = "SAFE";

  return {
    riskScore,
    riskLevel,
    contributions: {
      rfPrediction: Math.round(rfContribution),
      gptClassification: Math.round(gptContribution),
      vtDetection: Math.round(vtContribution),
      sbDetection: Math.round(sbContribution),
      domainAge: Math.round(domainAgeContribution),
    },
  };
}
