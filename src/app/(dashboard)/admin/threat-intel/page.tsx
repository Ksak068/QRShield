"use client";

import { useEffect, useState } from "react";
import { Shield, AlertTriangle, AlertCircle, Skull, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/shared/stat-card";
import { formatRelativeTime, truncate } from "@/lib/utils";

interface ThreatIntel {
  totalScans: number;
  phishingCount: number;
  suspiciousCount: number;
  threatRate: number;
  vtHits: number;
  scanRateLastHour: number;
  recentThreats: Array<{
    id: string;
    url: string | null;
    riskLevel: string;
    riskScore: number | null;
    userEmail: string;
    createdAt: string;
  }>;
}

export default function ThreatIntelPage() {
  const [data, setData] = useState<ThreatIntel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/threat-intel")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Threat Intelligence</h1>
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Threat Intelligence</h1>
        <p className="text-muted-foreground">
          Real-time threat monitoring and intelligence dashboard
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Scans"
          value={data?.totalScans || 0}
          icon={Shield}
        />
        <StatCard
          title="Phishing Detected"
          value={data?.phishingCount || 0}
          icon={Skull}
          variant="danger"
        />
        <StatCard
          title="Suspicious"
          value={data?.suspiciousCount || 0}
          icon={AlertTriangle}
          variant="warning"
        />
        <StatCard
          title="Threat Rate"
          value={`${data?.threatRate || 0}%`}
          icon={AlertCircle}
          variant={data && data.threatRate > 20 ? "danger" : "success"}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>VirusTotal</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Detected URLs</dt>
                <dd className="font-semibold text-red-500">{data?.vtHits || 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Detection Rate</dt>
                <dd className="font-semibold">
                  {data && data.totalScans > 0
                    ? `${Math.round((data.vtHits / data.totalScans) * 100)}%`
                    : "0%"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scan Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Scans (Last Hour)</dt>
                <dd className="font-semibold">{data?.scanRateLastHour || 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total All Time</dt>
                <dd className="font-semibold">{data?.totalScans || 0}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Threats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 font-medium">URL</th>
                  <th className="pb-3 font-medium">Risk</th>
                  <th className="pb-3 font-medium">Score</th>
                  <th className="pb-3 font-medium">User</th>
                  <th className="pb-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {data?.recentThreats.map((t) => (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-mono text-xs">
                      {truncate(t.url || "N/A", 45)}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge
                        variant={
                          t.riskLevel === "PHISHING" ? "danger" : "warning"
                        }
                      >
                        {t.riskLevel}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4">{t.riskScore ?? "—"}</td>
                    <td className="py-3 pr-4 text-xs text-muted-foreground">
                      {t.userEmail}
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {formatRelativeTime(new Date(t.createdAt))}
                    </td>
                  </tr>
                ))}
                {(!data?.recentThreats || data.recentThreats.length === 0) && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No threats detected yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
