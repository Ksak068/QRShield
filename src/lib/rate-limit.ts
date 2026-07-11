import { prisma } from "@/lib/prisma";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInMs: number;
  limit: number;
}

const LIMITS: Record<string, { max: number; windowMs: number }> = {
  scan: { max: 10, windowMs: 60_000 },
  auth: { max: 5, windowMs: 60_000 },
  default: { max: 30, windowMs: 60_000 },
};

function matchLimit(endpoint: string): { max: number; windowMs: number } {
  for (const [key, cfg] of Object.entries(LIMITS)) {
    if (endpoint.includes(key)) return cfg;
  }
  return LIMITS.default;
}

export async function checkRateLimit(
  ip: string,
  endpoint: string,
): Promise<RateLimitResult> {
  const { max, windowMs } = matchLimit(endpoint);
  const since = new Date(Date.now() - windowMs);

  const count = await prisma.apiLog.count({
    where: {
      ip,
      endpoint: { startsWith: endpoint },
      createdAt: { gte: since },
    },
  });

  return {
    allowed: count < max,
    remaining: Math.max(0, max - count),
    resetInMs: windowMs,
    limit: max,
  };
}

export async function logRequest(params: {
  endpoint: string;
  method: string;
  userId?: string;
  status: number;
  duration: number;
  ip?: string;
}): Promise<void> {
  try {
    await prisma.apiLog.create({ data: params });
  } catch {
    // Logging failure must never crash the request
  }
}
