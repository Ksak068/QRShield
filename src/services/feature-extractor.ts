import type { ExtractedFeatures } from "@/types";

const SUSPICIOUS_KEYWORDS = [
  "login", "signin", "verify", "update", "confirm", "secure",
  "account", "bank", "paypal", "password", "credential", "authenticate",
  "wallet", "recover", "reset", "support", "service", "alert",
];

const HIGH_RISK_TLDS = new Set([
  "tk", "ml", "ga", "cf", "gq", "xyz", "top", "work", "date",
  "men", "loan", "click", "download", "review",
]);

function shannonEntropy(s: string): number {
  const len = s.length;
  if (len === 0) return 0;
  const freq: Record<string, number> = {};
  for (const char of s) {
    freq[char] = (freq[char] || 0) + 1;
  }
  let entropy = 0;
  for (const count of Object.values(freq)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return Math.round(entropy * 100) / 100;
}

function countSubdomains(hostname: string): number {
  const parts = hostname.split(".");
  return parts.length > 2 ? parts.length - 2 : 0;
}

function hasSuspiciousKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  return SUSPICIOUS_KEYWORDS.some((kw) => lower.includes(kw));
}

async function getRedirectCount(url: string): Promise<number> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      signal: controller.signal,
    });
    clearTimeout(timer);

    let count = 0;
    if (
      response.status >= 300 &&
      response.status < 400 &&
      response.headers.has("location")
    ) {
      count = 1;
    }
    return count;
  } catch {
    return 0;
  }
}

export async function extractFeatures(url: string): Promise<ExtractedFeatures> {
  const parsed = new URL(url);
  const hostname = parsed.hostname;
  const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
  const tld = hostname.split(".").pop() || "";

  const specialChars = (url.match(/[<>{}|\\^~\[\]`]/g) || []).length;
  const specialCharRatio = Math.round((specialChars / url.length) * 1000) / 1000;

  return {
    domain: hostname,
    domainLength: hostname.length,
    subdomainCount: countSubdomains(hostname),
    hasHttps: parsed.protocol === "https:",
    entropy: shannonEntropy(url),
    specialCharRatio,
    isIpAddress: isIp,
    hasSuspiciousKeywords: hasSuspiciousKeywords(url),
    tld,
    domainAge: null,
    redirectCount: await getRedirectCount(url),
  };
}
