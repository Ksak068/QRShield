import { prisma } from "@/lib/prisma";
import { normalizeUrl } from "@/services/qr-decoder";
import { extractFeatures } from "@/services/feature-extractor";
import { predict } from "@/services/random-forest";
import { lookupUrl as vtLookup } from "@/services/virus-total";
import { lookupUrl as sbLookup } from "@/services/safe-browsing";
import { classifyWithGPT } from "@/services/ai-explainer";
import { calculateRisk } from "@/services/risk-engine";
import { notifyAdmins, createNotification } from "@/lib/notifications";
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
  gptStatus: "ok" | "fallback" | "unavailable";
  vtDetected: boolean;
  vtMaliciousCount: number;
  vtStatus: "ok" | "not-configured" | "failed" | "rate-limited";
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
    const EMPTY_FEATURES: ExtractedFeatures = {
      domain: "",
      domainLength: 0,
      subdomainCount: 0,
      hasHttps: false,
      entropy: 0,
      specialCharRatio: 0,
      isIpAddress: false,
      hasSuspiciousKeywords: false,
      tld: "",
      domainAge: null,
      redirectCount: 0,
    };

    let features: ExtractedFeatures;
    let isNonUrl = false;
    try {
      features = await extractFeatures(normalizedUrl);
    } catch {
      isNonUrl = true;
      features = EMPTY_FEATURES;
    }

    if (isNonUrl) {
      const aiExplanation = {
        summary: "QR content is not a URL — no threat analysis performed.",
        reasons: ["The scanned QR code does not contain a valid web address."],
        recommendation: "This QR contains plain text, not a URL.",
      };
      await prisma.scan.update({
        where: { id: scan.id },
        data: {
          riskScore: 0,
          riskLevel: "SAFE" as RiskLevel,
          status: "COMPLETED" as ScanStatus,
          aiExplanation: aiExplanation as any,
        },
      });
      return {
        scanId: scan.id,
        extractedUrl,
        normalizedUrl,
        features,
        rfPrediction: 0,
        rfLabel: "SAFE",
        gptScore: 0,
        gptLabel: "SAFE",
        gptStatus: "ok",
        vtDetected: false,
        vtMaliciousCount: 0,
        vtStatus: "ok",
        sbThreat: false,
        sbThreatTypes: [],
        riskScore: 0,
        riskLevel: "SAFE",
        aiExplanation,
      };
    }

    await prisma.scan.update({
      where: { id: scan.id },
      data: { features: features as any },
    });

    const rfResult = await predict(features);

    await prisma.scan.update({
      where: { id: scan.id },
      data: { rfPrediction: rfResult.probability, rfLabel: rfResult.label },
    });

    const [gptOutcome, vtOutcome, sbOutcome] = await Promise.allSettled([
      classifyWithGPT(normalizedUrl, features),
      vtLookup(normalizedUrl),
      sbLookup(normalizedUrl),
    ]);

    const gptResult =
      gptOutcome.status === "fulfilled" ? gptOutcome.value : null;
    const gptStatus: "ok" | "fallback" | "unavailable" = gptResult === null
      ? "unavailable"
      : gptResult.usedFallback
        ? "fallback"
        : "ok";

    if (gptResult) {
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
    }

    const vtResult = vtOutcome.status === "fulfilled" ? vtOutcome.value : null;
    const vtDetected = vtResult?.detected || false;
    const vtMaliciousCount = vtResult?.maliciousCount || 0;
    const vtStatus = vtResult?.status || "failed";

    await prisma.scan.update({
      where: { id: scan.id },
      data: {
        vtDetected,
        vtMaliciousCount,
        vtReport: vtResult as any,
      },
    });

    const sbResult = sbOutcome.status === "fulfilled" ? sbOutcome.value : null;
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
      gptResult?.riskScore ?? null,
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
      const title = riskResult.riskLevel === "PHISHING" ? "Phishing QR Detected" : "Suspicious QR Detected";
      const message = `Risk score ${riskResult.riskScore} — ${extractedUrl.slice(0, 80)}`;
      await notifyAdmins(notifType, title, message, `/admin`);
      if (userId) {
        await createNotification(notifType, title, message, `/history`, userId);
      }
    }

    return {
      scanId: scan.id,
      extractedUrl,
      normalizedUrl,
      features,
      rfPrediction: rfResult.probability,
      rfLabel: rfResult.label,
      gptScore: gptResult?.riskScore ?? 0,
      gptLabel: gptResult?.riskLevel ?? "SAFE",
      gptStatus,
      vtDetected,
      vtMaliciousCount,
      vtStatus,
      sbThreat,
      sbThreatTypes,
      riskScore: riskResult.riskScore,
      riskLevel: riskResult.riskLevel as RiskLevel,
      aiExplanation: gptResult
        ? {
            summary: gptResult.summary,
            reasons: gptResult.reasons,
            recommendation: gptResult.recommendation,
          }
        : null,
    };
  } catch (error) {
    await prisma.scan.update({
      where: { id: scan.id },
      data: { status: "FAILED" as ScanStatus },
    });
    throw error;
  }
}
