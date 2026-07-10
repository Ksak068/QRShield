import { prisma } from "@/lib/prisma";

interface SbResponse {
  threat: boolean;
  threatTypes: string[];
  platforms: string[];
}

const URL_SHORTENERS = [
  "bit.ly", "tinyurl.com", "ow.ly", "is.gd", "buff.ly", "tiny.cc",
  "tr.im", "rb.gy", "shorturl.at", "t.co", "goo.gl", "rebrand.ly",
  "cutt.ly", "shorte.st", "bl.ink", "s.id", "clck.ru", "vgd.ly",
];

const BRAND_NAMES = [
  "google", "facebook", "instagram", "twitter", "linkedin",
  "whatsapp", "telegram", "youtube", "tiktok", "snapchat", "reddit",
  "amazon", "ebay", "paypal", "netflix", "spotify", "dropbox",
  "microsoft", "apple", "meta", "binance", "coinbase", "blockchain",
  "bank", "chase", "wellsfargo", "hsbc", "barclays", "dhl", "fedex",
  "ups", "usps", "royalmail", "adobe", "canva", "github", "gitlab",
  "stackoverflow", "medium", "wordpress", "shopify", "squarespace",
];

const PHISHING_PATH_KEYWORDS = [
  "login", "signin", "verify", "account", "secure", "update",
  "confirm", "password", "credential", "authenticate", "wallet",
  "recover", "reset", "2fa", "two-factor", "sms-verify", "otp",
  "callback", "authorize", "payment", "checkout", "billing",
  "webscr", "signin-email", "email-signin", "identity-verify",
];

function checkShortener(hostname: string): string | null {
  const lower = hostname.toLowerCase();
  for (const s of URL_SHORTENERS) {
    if (lower === s || lower.endsWith("." + s)) return s;
  }
  return null;
}

function checkTyposquatting(hostname: string): string | null {
  const lower = hostname.toLowerCase();
  const parts = lower.split(".");
  const main = parts.length > 2 ? parts[parts.length - 2] : parts[0];
  if (!main) return null;

  for (const brand of BRAND_NAMES) {
    if (main === brand) continue;
    if (main.length < brand.length - 2 || main.length > brand.length + 3) continue;
    if (main.includes(brand) && main.length > brand.length) return brand;
    let diffs = 0;
    const len = Math.min(brand.length, main.length);
    for (let i = 0; i < len; i++) {
      if (brand[i] !== main[i]) diffs++;
    }
    diffs += Math.abs(brand.length - main.length);
    if (diffs >= 1 && diffs <= 2) return brand;
  }
  return null;
}

function getThreatForHostname(hostname: string): string[] {
  const threats: string[] = [];
  const lower = hostname.toLowerCase();
  const parts = lower.split(".");
  const tld = parts[parts.length - 1];
  const main = parts.length > 2 ? parts[parts.length - 2] : parts[0];

  const HIGH_RISK_TLDS = new Set([
    "tk", "ml", "ga", "cf", "gq", "xyz", "top", "work", "date",
    "men", "loan", "click", "download", "review", "trade", "webcam",
    "country", "stream", "win", "bid", "racing", "science", "party",
    "faith", "mom", "lol", "kim", "xxx", "gdn", "loan", "accountant",
  ]);

  if (HIGH_RISK_TLDS.has(tld)) {
    threats.push("MALWARE");
  }

  const shortener = checkShortener(lower);
  if (shortener) {
    threats.push("SOCIAL_ENGINEERING");
  }

  const impersonated = checkTyposquatting(lower);
  if (impersonated) {
    threats.push("SOCIAL_ENGINEERING");
  }

  const suspiciousPrefixes = ["secure-", "login-", "verify-", "account-", "support-"];
  for (const prefix of suspiciousPrefixes) {
    if (main && main.startsWith(prefix)) {
      threats.push("SOCIAL_ENGINEERING");
      break;
    }
  }

  return threats;
}

function getThreatForPath(path: string): string[] {
  const threats: string[] = [];
  const lower = path.toLowerCase();

  for (const kw of PHISHING_PATH_KEYWORDS) {
    if (lower.includes(kw)) {
      threats.push("SOCIAL_ENGINEERING");
      break;
    }
  }

  if (/\.(exe|dll|scr|bat|cmd|jar|apk|msi|vbs|ps1)$/i.test(lower)) {
    threats.push("MALWARE");
  }

  if (/\.(zip|rar|7z|tar\.gz)$/i.test(lower) && lower.includes("invoice")) {
    threats.push("POTENTIALLY_HARMFUL_APPLICATION");
  }

  const dataHarvest = ["stealer", "grabber", "logger", "exploit", "payload"];
  for (const kw of dataHarvest) {
    if (lower.includes(kw)) {
      threats.push("POTENTIALLY_HARMFUL_APPLICATION");
      break;
    }
  }

  return threats;
}

export async function lookupUrl(url: string): Promise<SbResponse | null> {
  const normalized = url.toLowerCase().replace(/\/+$/, "");

  const cached = await prisma.threatCache.findUnique({
    where: { url: normalized },
  });

  if (cached && cached.sbData && cached.expiresAt > new Date()) {
    return cached.sbData as unknown as SbResponse;
  }

  try {
    const parsed = new URL(normalized);
    const hostname = parsed.hostname;
    const path = parsed.pathname;

    const hostThreats = getThreatForHostname(hostname);
    const pathThreats = getThreatForPath(path);
    const allThreats = [...new Set([...hostThreats, ...pathThreats])];

    const result: SbResponse = {
      threat: allThreats.length > 0,
      threatTypes: allThreats,
      platforms: ["ANY_PLATFORM"],
    };

    await prisma.threatCache.upsert({
      where: { url: normalized },
      update: { sbData: result as any, expiresAt: new Date(Date.now() + 3600000) },
      create: {
        url: normalized,
        sbData: result as any,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });

    return result;
  } catch (error) {
    console.error("Safe Browsing lookup failed:", error);
    return null;
  }
}
