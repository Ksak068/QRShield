import { prisma } from "@/lib/prisma";

const BASE_URL = "https://www.virustotal.com/api/v3";

interface VtResponse {
  detected: boolean;
  maliciousCount: number;
  suspiciousCount: number;
  harmlessCount: number;
  undetectedCount: number;
  report: Record<string, unknown>;
}

export async function lookupUrl(url: string): Promise<VtResponse | null> {
  const apiKey = process.env.VIRUSTOTAL_API_KEY;
  if (!apiKey) return null;

  const normalized = url.toLowerCase().replace(/\/+$/, "");

  const cached = await prisma.threatCache.findUnique({
    where: { url: normalized },
  });

  if (cached && cached.vtData && cached.expiresAt > new Date()) {
    return cached.vtData as unknown as VtResponse;
  }

  try {
    const encodedUrl = btoa(unescape(encodeURIComponent(normalized)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const submitResponse = await fetch(`${BASE_URL}/urls`, {
      method: "POST",
      headers: {
        "x-apikey": apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `url=${encodeURIComponent(normalized)}`,
    });

    if (!submitResponse.ok) return null;

    const submitData = await submitResponse.json();
    const analysisId = submitData.data?.id;
    if (!analysisId) return null;

    await new Promise((resolve) => setTimeout(resolve, 3000));

    const analysisResponse = await fetch(
      `${BASE_URL}/analyses/${analysisId}`,
      {
        headers: { "x-apikey": apiKey },
      },
    );

    if (!analysisResponse.ok) return null;

    const analysisData = await analysisResponse.json();
    const stats = analysisData.data?.attributes?.stats;

    if (!stats) return null;

    const result: VtResponse = {
      detected: (stats.malicious || 0) > 0,
      maliciousCount: stats.malicious || 0,
      suspiciousCount: stats.suspicious || 0,
      harmlessCount: stats.harmless || 0,
      undetectedCount: stats.undetected || 0,
      report: analysisData,
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
    return null;
  }
}
