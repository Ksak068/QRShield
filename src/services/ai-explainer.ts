import OpenAI from "openai";
import type { ExtractedFeatures, RiskLevel, AiExplanation, GptClassification } from "@/types";

const PRIMARY_MODEL = process.env.OPENAI_MODEL || "openai/gpt-oss-120b:free";
const FALLBACK_MODEL = process.env.OPENROUTER_FALLBACK_MODEL || "openai/gpt-oss-20b:free";

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENAI_API_KEY || "",
  defaultHeaders: {
    "HTTP-Referer": process.env.AUTH_URL || "https://qrshield.vercel.app",
    "X-Title": "QR_Shield Enterprise",
  },
});

function buildPrompt(url: string, features: ExtractedFeatures): string {
  return `You are a cybersecurity URL analyzer. Classify this URL as SAFE, SUSPICIOUS, or PHISHING.

URL: ${url}
Domain: ${features.domain}
Domain Length: ${features.domainLength}
Subdomain Count: ${features.subdomainCount}
HTTPS: ${features.hasHttps ? "Yes" : "No"}
URL Entropy: ${features.entropy}
Special Character Ratio: ${features.specialCharRatio}
Is IP Address: ${features.isIpAddress ? "Yes" : "No"}
Suspicious Keywords Detected: ${features.hasSuspiciousKeywords ? "Yes" : "No"}
TLD: ${features.tld}
Redirect Count: ${features.redirectCount}

Analyze based on:
- Deceptive patterns (typosquatting, unusual subdomains, lookalike domains)
- Impersonation of legitimate brands or services
- Credential harvesting keywords (login, verify, secure, etc.)
- Unusual domain structure, obfuscation, or IP-based hosting
- TLD reputation for abuse (free/cheap TLDs)
- Overall risk to a corporate user

Respond with valid JSON only:
{"riskScore": <0-100>, "riskLevel": "<SAFE|SUSPICIOUS|PHISHING>", "summary": "...", "reasons": ["..."], "recommendation": "..."}`;
}

function heuristicFallback(features: ExtractedFeatures): GptClassification {
  let score = 0;
  const reasons: string[] = [];

  if (features.domainLength > 30) { score += 10; reasons.push("Unusually long domain name"); }
  if (features.subdomainCount > 2) { score += 10; reasons.push("Excessive subdomain count"); }
  if (!features.hasHttps) { score += 15; reasons.push("No HTTPS encryption"); }
  if (features.entropy > 4.5) { score += 10; reasons.push("High URL entropy suggests obfuscation"); }
  if (features.isIpAddress) { score += 20; reasons.push("URL uses raw IP address instead of domain"); }
  if (features.hasSuspiciousKeywords) { score += 15; reasons.push("Contains suspicious phishing-related keywords"); }
  if (features.redirectCount > 0) { score += 10; reasons.push("URL performs redirects"); }

  const riskScore = Math.min(score, 100);
  let riskLevel: RiskLevel = "SAFE";
  if (riskScore >= 70) riskLevel = "PHISHING";
  else if (riskScore >= 30) riskLevel = "SUSPICIOUS";

  return {
    riskScore,
    riskLevel,
    summary: `Heuristic analysis classified this URL as ${riskLevel.toLowerCase()} with a score of ${riskScore}/100.`,
    reasons: reasons.length > 0 ? reasons : ["No significant risk indicators detected"],
    recommendation: riskLevel === "PHISHING"
      ? "Do not visit this URL. Report it to your IT administrator immediately."
      : riskLevel === "SUSPICIOUS"
      ? "Exercise caution. Verify the URL's legitimacy before proceeding."
      : "This URL appears safe based on available indicators.",
  };
}

async function callGPT(model: string, url: string, features: ExtractedFeatures): Promise<GptClassification | null> {
  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: "You are a cybersecurity URL analyzer. Respond only with valid JSON. No markdown, no code fences, no explanation outside the JSON.",
        },
        { role: "user", content: buildPrompt(url, features) },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*$/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return {
      riskScore: Math.min(Math.max(Number(parsed.riskScore) || 0, 0), 100),
      riskLevel: ["SAFE", "SUSPICIOUS", "PHISHING"].includes(parsed.riskLevel)
        ? parsed.riskLevel as RiskLevel
        : "SUSPICIOUS",
      summary: parsed.summary || "",
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons.slice(0, 6) : [],
      recommendation: parsed.recommendation || "Review the URL carefully before proceeding.",
    };
  } catch (error) {
    console.error(`GPT call failed (${model}):`, error);
    return null;
  }
}

export async function classifyWithGPT(
  url: string,
  features: ExtractedFeatures,
): Promise<GptClassification> {
  if (!process.env.OPENAI_API_KEY) {
    return heuristicFallback(features);
  }

  const primary = await callGPT(PRIMARY_MODEL, url, features);
  if (primary) return primary;

  console.warn("Primary GPT model failed, trying fallback model...");
  const fallback = await callGPT(FALLBACK_MODEL, url, features);
  if (fallback) return fallback;

  console.warn("Both GPT models failed, using heuristic fallback");
  return heuristicFallback(features);
}

export async function generateExplanation(
  url: string,
  riskLevel: RiskLevel,
  riskScore: number,
  features: Record<string, unknown>,
  vtDetected: boolean,
  sbThreat: boolean,
): Promise<AiExplanation | null> {
  const gpt = await classifyWithGPT(url, features as unknown as ExtractedFeatures);

  const vtNote = vtDetected ? " VirusTotal detected threats." : "";
  const sbNote = sbThreat ? " Google Safe Browsing flagged this URL." : "";

  return {
    summary: gpt.summary + vtNote + sbNote,
    reasons: gpt.reasons,
    recommendation: gpt.recommendation,
  };
}
