import { prisma } from "@/lib/prisma";

const BASE_URL = "https://www.virustotal.com/api/v3";
const MAX_POLL_ATTEMPTS = 15;
const POLL_INTERVAL_MS = 2000;
const MAX_RETRY_ATTEMPTS = 3;

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

interface FetchResult {
  ok: boolean;
  status: number;
  data: any;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  apiKey: string,
): Promise<FetchResult | null> {
  let delay = 2000;
  for (let attempt = 0; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, {
        ...init,
        headers: {
          "x-apikey": apiKey,
          ...(init.headers || {}),
        },
      });

      if (response.status === 429) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }

      const data = response.ok ? await response.json() : null;
      return { ok: response.ok, status: response.status, data };
    } catch (error) {
      if (attempt === MAX_RETRY_ATTEMPTS) return null;
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
  return null;
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
    const submit = await fetchWithRetry(
      `${BASE_URL}/urls`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `url=${encodeURIComponent(normalized)}`,
      },
      apiKey,
    );

    if (!submit) {
      return { detected: false, maliciousCount: 0, suspiciousCount: 0, harmlessCount: 0, undetectedCount: 0, status: "failed", report: {} };
    }

    if (!submit.ok) {
      return {
        detected: false,
        maliciousCount: 0,
        suspiciousCount: 0,
        harmlessCount: 0,
        undetectedCount: 0,
        status: submit.status === 429 ? "rate-limited" : "failed",
        report: {},
      };
    }

    const analysisId = submit.data?.data?.id;
    if (!analysisId) return null;

    let stats: any = null;
    let lastStatus = "queued";
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

      const poll = await fetchWithRetry(
        `${BASE_URL}/analyses/${analysisId}`,
        { method: "GET" },
        apiKey,
      );

      if (!poll) {
        return { detected: false, maliciousCount: 0, suspiciousCount: 0, harmlessCount: 0, undetectedCount: 0, status: "failed", report: {} };
      }

      if (!poll.ok) {
        return {
          detected: false,
          maliciousCount: 0,
          suspiciousCount: 0,
          harmlessCount: 0,
          undetectedCount: 0,
          status: poll.status === 429 ? "rate-limited" : "failed",
          report: {},
        };
      }

      lastStatus = poll.data?.data?.attributes?.status;
      if (lastStatus === "completed") {
        stats = poll.data?.data?.attributes?.stats;
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
