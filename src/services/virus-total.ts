import { prisma } from "@/lib/prisma";

const BASE_URL = "https://www.virustotal.com/api/v3";

interface VtResponse {
  detected: boolean;
  maliciousCount: number;
  suspiciousCount: number;
  harmlessCount: number;
  undetectedCount: number;
  status: "ok" | "not-configured" | "failed";
  report: Record<string, unknown>;
}

function encodeBase64Url(input: string): string {
  return btoa(unescape(encodeURIComponent(input)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function lookupUrl(url: string): Promise<VtResponse | null> {
  const apiKey = process.env.VIRUSTOTAL_API_KEY;
  if (!apiKey) {
    return { detected: false, maliciousCount: 0, suspiciousCount: 0, harmlessCount: 0, undetectedCount: 0, status: "not-configured", report: {} };
  }

  const normalized = url.toLowerCase().replace(/\/+$/, "");

  const cached = await prisma.threatCache.findUnique({
    where: { url: normalized },
  });

  if (cached && cached.vtData && cached.expiresAt > new Date()) {
    return cached.vtData as unknown as VtResponse;
  }

  try {
    const encodedUrl = encodeBase64Url(normalized);

    const submitResponse = await fetch(`${BASE_URL}/urls`, {
      method: "POST",
      headers: {
        "x-apikey": apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `url=${encodeURIComponent(normalized)}`,
    });

    if (!submitResponse.ok) {
      console.error(`VirusTotal submit failed: ${submitResponse.status}`);
      return { detected: false, maliciousCount: 0, suspiciousCount: 0, harmlessCount: 0, undetectedCount: 0, status: "failed", report: {} };
    }

    const submitData = await submitResponse.json();
    const analysisId = submitData.data?.id;
    if (!analysisId) return null;

    let stats: any = null;
    let lastStatus = "queued";
    for (let attempt = 0; attempt < 6; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const analysisResponse = await fetch(
        `${BASE_URL}/analyses/${analysisId}`,
        { headers: { "x-apikey": apiKey } },
      );

      if (!analysisResponse.ok) {
        return { detected: false, maliciousCount: 0, suspiciousCount: 0, harmlessCount: 0, undetectedCount: 0, status: "failed", report: {} };
      }

      const analysisData = await analysisResponse.json();
      lastStatus = analysisData.data?.attributes?.status;
      if (lastStatus === "completed") {
        stats = analysisData.data?.attributes?.stats;
        if (stats) break;
      }
    }

    if (!stats) {
      console.warn(`VirusTotal analysis still ${lastStatus} after polling`);
      return { detected: false, maliciousCount: 0, suspiciousCount: 0, harmlessCount: 0, undetectedCount: 0, status: "failed", report: {} };
    }

    const result: VtResponse = {
      detected: (stats.malicious || 0) > 0,
      maliciousCount: stats.malicious || 0,
      suspiciousCount: stats.suspicious || 0,
      harmlessCount: stats.harmless || 0,
      undetectedCount: stats.undetected || 0,
      status: "ok",
      report: { stats },
    };

    await prisma.threatCache.upsert({
      where: { url: normalized },
      update: { vtData: result as any, expiresAt: new Date(Date.now() + 3600000) },
      create: {
        url: normalized,
        vtData: result as any,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });

    return result;
  } catch (error) {
    console.error("VirusTotal lookup failed:", error);
    return { detected: false, maliciousCount: 0, suspiciousCount: 0, harmlessCount: 0, undetectedCount: 0, status: "failed", report: {} };
  }
}
