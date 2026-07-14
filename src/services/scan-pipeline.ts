import { prisma } from "@/lib/prisma";
import { normalizeUrl } from "@/services/qr-decoder";
import { extractFeatures } from "@/services/feature-extractor";
import { predict } from "@/services/random-forest";
import { lookupUrl as vtLookup } from "@/services/virus-total";
import { lookupUrl as sbLookup } from "@/services/safe-browsing";
import { classifyWithGPT } from "@/services/ai-explainer";
import { calculateRisk } from "@/services/risk-engine";
import { notifyAdmins } from "@/lib/notifications";
import type { ExtractedFeatures, RiskEngineResult } from "@/types";
import type { RiskLevel, ScanStatus } from "@prisma/client";

export interface ScanPipelineResult {
  scanId: string;
  extractedUrl: string;
  normalizedUrl: string;
  features: ExtractedFeatures;
  rfPrediction: number;
  rfLabel: string;
  gptScore: number;
  gptLabel: string;
  vtDetected: boolean;
  vtMaliciousCount: number;
  sbThreat: boolean;
  sbThreatTypes: string[];
  riskScore: number;
  riskLevel: RiskLevel;
  aiExplanation: Record<string, unknown> | null;
}

export async function runScanPipeline(
  qrContent: string,
  qrImage: string | null,
  userId?: string,
): Promise<ScanPipelineResult> {
  const extractedUrl =
    qrContent.match(/https?:\/\/[^\s<>"']+/i)?.[0] || qrContent;
  const normalizedUrl = normalizeUrl(extractedUrl);

  const scan = await prisma.scan.create({
    data: {
      userId: userId || null,
      qrImage,
      qrRawContent: qrContent,
      extractedUrl,
      normalizedUrl,
      status: "PROCESSING" as ScanStatus,
    },
  });

  try {
    const features = await extractFeatures(normalizedUrl);

    await prisma.scan.update({
      where: { id: scan.id },
      data: { features: features as any },
    });

    const rfResult = await predict(features);

    await prisma.scan.update({
      where: { id: scan.id },
      data: { rfPrediction: rfResult.probability, rfLabel: rfResult.label },
    });

    const gptResult = await classifyWithGPT(normalizedUrl, features);

    await prisma.scan.update({
      where: { id: scan.id },
      data: {
        gptScore: gptResult.riskScore,
        gptLabel: gptResult.riskLevel,
        aiExplanation: {
          summary: gptResult.summary,
          reasons: gptResult.reasons,
          recommendation: gptResult.recommendation,
        } as any,
      },
    });

    const vtResult = await vtLookup(normalizedUrl);
    const vtDetected = vtResult?.detected || false;
    const vtMaliciousCount = vtResult?.maliciousCount || 0;

    await prisma.scan.update({
      where: { id: scan.id },
      data: {
        vtDetected,
        vtMaliciousCount,
        vtReport: vtResult as any,
      },
    });

    const sbResult = await sbLookup(normalizedUrl);
    const sbThreat = sbResult?.threat || false;
    const sbThreatTypes = sbResult?.threatTypes || [];

    await prisma.scan.update({
      where: { id: scan.id },
      data: {
        sbThreat,
        sbThreatTypes: sbThreatTypes as any,
      },
    });

    const [suspiciousThreshold, phishingThreshold] = await Promise.all([
      prisma.setting.findUnique({ where: { key: "RISK_THRESHOLD_SUSPICIOUS" } }),
      prisma.setting.findUnique({ where: { key: "RISK_THRESHOLD_PHISHING" } }),
    ]);

    const riskResult: RiskEngineResult = calculateRisk(
      rfResult.probability,
      gptResult.riskScore,
      vtDetected,
      vtMaliciousCount,
      sbThreat,
      features.domainAge,
      {
        suspicious: Number(suspiciousThreshold?.value) || 30,
        phishing: Number(phishingThreshold?.value) || 70,
      },
    );

    await prisma.scan.update({
      where: { id: scan.id },
      data: {
        riskScore: riskResult.riskScore,
        riskLevel: riskResult.riskLevel as RiskLevel,
        status: "COMPLETED" as ScanStatus,
      },
    });

    if (riskResult.riskLevel === "PHISHING" || riskResult.riskLevel === "SUSPICIOUS") {
      const notifType = riskResult.riskLevel === "PHISHING" ? "scan.phishing" : "scan.suspicious";
      await notifyAdmins(
        notifType,
        riskResult.riskLevel === "PHISHING" ? "Phishing QR Detected" : "Suspicious QR Detected",
        `Risk score ${riskResult.riskScore} — ${extractedUrl.slice(0, 80)}`,
        `/admin`,
      );
    }

    return {
      scanId: scan.id,
      extractedUrl,
      normalizedUrl,
      features,
      rfPrediction: rfResult.probability,
      rfLabel: rfResult.label,
      gptScore: gptResult.riskScore,
      gptLabel: gptResult.riskLevel,
      vtDetected,
      vtMaliciousCount,
      sbThreat,
      sbThreatTypes,
      riskScore: riskResult.riskScore,
      riskLevel: riskResult.riskLevel as RiskLevel,
      aiExplanation: {
        summary: gptResult.summary,
        reasons: gptResult.reasons,
        recommendation: gptResult.recommendation,
      },
    };
  } catch (error) {
    await prisma.scan.update({
      where: { id: scan.id },
      data: { status: "FAILED" as ScanStatus },
    });
    throw error;
  }
}
