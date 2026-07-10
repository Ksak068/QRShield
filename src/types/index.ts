import type { DefaultSession } from "next-auth";

export type Role = "GUEST" | "CORPORATE" | "ADMIN";

export type RiskLevel = "SAFE" | "SUSPICIOUS" | "PHISHING";

export interface ExtractedFeatures {
  domain: string;
  domainLength: number;
  subdomainCount: number;
  hasHttps: boolean;
  entropy: number;
  specialCharRatio: number;
  isIpAddress: boolean;
  hasSuspiciousKeywords: boolean;
  tld: string;
  domainAge: number | null;
  redirectCount: number;
}

export interface GptClassification {
  riskScore: number;
  riskLevel: RiskLevel;
  summary: string;
  reasons: string[];
  recommendation: string;
}

export interface RiskEngineResult {
  riskScore: number;
  riskLevel: RiskLevel;
  contributions: {
    rfPrediction: number;
    gptClassification: number;
    vtDetection: number;
    sbDetection: number;
    domainAge: number;
  };
}

export interface AiExplanation {
  summary: string;
  reasons: string[];
  recommendation: string;
}

export interface ScanResult {
  id: string;
  qrRawContent: string | null;
  extractedUrl: string | null;
  normalizedUrl: string | null;
  features: ExtractedFeatures | null;
  rfPrediction: number | null;
  rfLabel: string | null;
  vtDetected: boolean;
  vtMaliciousCount: number;
  sbThreat: boolean;
  sbThreatTypes: string[];
  riskScore: number | null;
  riskLevel: RiskLevel;
  gptScore: number | null;
  gptLabel: string | null;
  aiExplanation: AiExplanation | null;
  status: string;
  createdAt: Date;
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
  }
}
