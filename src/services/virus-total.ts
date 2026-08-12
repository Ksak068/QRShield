import { prisma } from "@/lib/prisma";

const BASE_URL = "https://www.virustotal.com/api/v3";
const MAX_POLL_ATTEMPTS = 6;
const POLL_INTERVAL_MS = 2000;

interface VtResponse {
  detected: boolean;
  maliciousCount: number;
  suspiciousCount: number;
  harmlessCount: number;
  undetectedCount: number;
  status: "ok" | "not-configured" | "failed" | "rate-limited";
  report: Record<string, unknown>;
}

function encodeBase64Url(input: string): string {
  return btoa(unescape(encodeURIComponent(input)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function buildResponse(stats: any): VtResponse {
  const malicious = stats?.malicious || 0;
  return {
    detected: malicious > 0,
    maliciousCount: malicious,
    suspiciousCount: stats?.suspicious || 0,
    harmlessCount: stats?.harmless || 0,
    undetectedCount: stats?.undetected || 0,
    status: "ok",
    report: { stats },
  };
}

const empty = (status: VtResponse["status"]): VtResponse => ({
  detected: false,
  maliciousCount: 0,
  suspiciousCount: 0,
  harmlessCount: 0,
  undetectedCount: 0,
  status,
  report: {},
});

export async function lookupUrl(url: string): Promise<VtResponse | null> {
  const apiKey = process.env.VIRUSTOTAL_API_KEY;
  if (!apiKey) {
    return empty("not-configured");
  }

  const normalized = url.toLowerCase().replace(/\/+$/, "");

  const cached = await prisma.threatCache.findUnique({
    where: { url: normalized },
  });

  if (cached && cached.vtData && cached.expiresAt > new Date()) {
    return cached.vtData as unknown as VtResponse;
  }

  const headers = { "x-apikey": apiKey };

  try {
    const encodedUrl = encodeBase64Url(normalized);

    const cachedLookup = await fetch(`${BASE_URL}/urls/${encodedUrl}`, { headers });
    if (cachedLookup.status === 429) {
      return empty("rate-limited");
    }
    if (cachedLookup.ok) {
      const data = await cachedLookup.json();
      const stats = data.data?.attributes?.last_analysis_stats;
      if (stats) {
        const result = buildResponse(stats);
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
      }
    }

    const submitResponse = await fetch(`${BASE_URL}/urls`, {
      method: "POST",
      headers: {
        "x-apikey": apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `url=${encodeURIComponent(normalized)}`,
    });

    if (submitResponse.status === 429) {
      return empty("rate-limited");
    }
    if (!submitResponse.ok) {
      console.error(`VirusTotal submit failed: ${submitResponse.status}`);
      return empty("failed");
    }

    const submitData = await submitResponse.json();
    const analysisId = submitData.data?.id;
    if (!analysisId) return null;

    let stats: any = null;
    let lastStatus = "queued";
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

      const analysisResponse = await fetch(
        `${BASE_URL}/analyses/${analysisId}`,
        { headers },
      );

      if (analysisResponse.status === 429) {
        return empty("rate-limited");
      }
      if (!analysisResponse.ok) {
        return empty("failed");
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
      return empty("failed");
    }

    const result = buildResponse(stats);
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
    return empty("failed");
  }
}