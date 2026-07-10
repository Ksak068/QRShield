import type { ExtractedFeatures } from "@/types";
import { RandomForestClassifier } from "ml-random-forest";

let model: RandomForestClassifier | null = null;

const FEATURE_NAMES = [
  "domainLength",
  "subdomainCount",
  "hasHttps",
  "entropy",
  "specialCharRatio",
  "isIpAddress",
  "hasSuspiciousKeywords",
  "redirectCount",
] as const;

function featuresToVector(features: ExtractedFeatures): number[] {
  return [
    features.domainLength,
    features.subdomainCount,
    features.hasHttps ? 1 : 0,
    features.entropy,
    features.specialCharRatio,
    features.isIpAddress ? 1 : 0,
    features.hasSuspiciousKeywords ? 1 : 0,
    features.redirectCount,
  ];
}

export async function loadModel(): Promise<void> {
  if (model) return;

  try {
    const response = await fetch("/models/rf-model.json");
    const modelData = await response.json();
    model = RandomForestClassifier.load(modelData);
  } catch (error) {
    console.error("Failed to load ML model:", error);
  }
}

export async function predict(
  features: ExtractedFeatures,
): Promise<{ probability: number; label: string }> {
  await loadModel();

  if (!model) {
    const entropy = features.entropy;
    const hasSuspicious = features.hasSuspiciousKeywords;
    const isIp = features.isIpAddress;

    let rawScore = 0;
    if (features.domainLength > 30) rawScore += 0.2;
    if (entropy > 4) rawScore += 0.25;
    if (hasSuspicious) rawScore += 0.25;
    if (isIp) rawScore += 0.3;
    if (!features.hasHttps) rawScore += 0.15;
    if (features.subdomainCount > 2) rawScore += 0.1;
    if (features.redirectCount > 0) rawScore += 0.15;

    const probability = Math.min(rawScore, 1);
    return {
      probability: Math.round(probability * 100) / 100,
      label: probability > 0.5 ? "phishing" : "safe",
    };
  }

  const vector = featuresToVector(features);
  const predictions = model.predict([vector]);
  const probability = predictions[0] as number;

  return {
    probability: Math.round(probability * 100) / 100,
    label: probability > 0.5 ? "phishing" : "safe",
  };
}
