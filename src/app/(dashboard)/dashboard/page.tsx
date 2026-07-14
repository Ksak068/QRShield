"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Shield,
  QrCode,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { PieChartWidget } from "@/components/charts/pie-chart";
import { BarChartWidget } from "@/components/charts/bar-chart";
import { LineChartWidget } from "@/components/charts/line-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelativeTime, truncate } from "@/lib/utils";

interface DashboardData {
  total: number;
  SAFE: number;
  SUSPICIOUS: number;
  PHISHING: number;
  recent: Array<{
    id: string;
    extractedUrl: string | null;
    riskLevel: string;
    riskScore: number | null;
    createdAt: string;
  }>;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.user?.role === "ADMIN") {
      router.replace("/admin");
    }
  }, [session, router]);

  useEffect(() => {
    fetch("/api/scan?limit=10")
      .then((r) => r.json())
      .then((r) => {
        const scans = r.scans || [];
        const total = scans.length;
        const SAFE = scans.filter((s: any) => s.riskLevel === "SAFE").length;
        const SUSPICIOUS = scans.filter((s: any) => s.riskLevel === "SUSPICIOUS").length;
        const PHISHING = scans.filter((s: any) => s.riskLevel === "PHISHING").length;
        setData({ total, SAFE, SUSPICIOUS, PHISHING, recent: scans });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const pieData = [
    { name: "Safe", value: data?.SAFE || 0, color: "#10b981" },
    { name: "Suspicious", value: data?.SUSPICIOUS || 0, color: "#f59e0b" },
    { name: "Phishing", value: data?.PHISHING || 0, color: "#ef4444" },
  ];

  const barData = [
    { name: "Safe", value: data?.SAFE || 0 },
    { name: "Suspicious", value: data?.SUSPICIOUS || 0 },
    { name: "Phishing", value: data?.PHISHING || 0 },
  ];

  const safeCount = data?.SAFE || 0;
  const suspiciousCount = data?.SUSPICIOUS || 0;
  const phishingCount = data?.PHISHING || 0;
  const total = data?.total || 0;

  const safePct = total > 0 ? Math.round((safeCount / total) * 100) : 0;
  const suspiciousPct = total > 0 ? Math.round((suspiciousCount / total) * 100) : 0;
  const phishingPct = total > 0 ? Math.round((phishingCount / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Welcome, {session?.user?.name || "User"}
          </h1>
          <p className="text-muted-foreground">
            {session?.user?.role === "ADMIN"
              ? "Overview of all scans across your organization"
              : "Overview of your QR code security scans"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/scanner">
            <Button className="gap-2">
              <QrCode className="h-4 w-4" /> Quick Scan
            </Button>
          </Link>
          <Badge
            variant={session?.user?.role === "ADMIN" ? "default" : "success"}
            className="text-xs"
          >
            {session?.user?.role}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Scans"
          value={total}
          icon={QrCode}
          variant="default"
        />
        <StatCard
          title="Safe"
          value={`${safeCount} (${safePct}%)`}
          icon={CheckCircle}
          variant="success"
        />
        <StatCard
          title="Suspicious"
          value={`${suspiciousCount} (${suspiciousPct}%)`}
          icon={AlertTriangle}
          variant="warning"
        />
        <StatCard
          title="Phishing"
          value={`${phishingCount} (${phishingPct}%)`}
          icon={AlertCircle}
          variant="danger"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Risk Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <PieChartWidget data={pieData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scan Results</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChartWidget data={barData} color="hsl(173, 58%, 39%)" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Scans</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 font-medium">URL</th>
                  <th className="pb-3 font-medium">Score</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {data?.recent.map((scan) => (
                  <tr key={scan.id} className="border-b last:border-0">
                    <td className="py-3 pr-4">
                      {truncate(scan.extractedUrl || "", 40)}
                    </td>
                    <td className="py-3 pr-4">{scan.riskScore ?? "—"}</td>
                    <td className="py-3 pr-4">
                      <Badge
                        variant={
                          scan.riskLevel === "SAFE"
                            ? "success"
                            : scan.riskLevel === "SUSPICIOUS"
                              ? "warning"
                              : "danger"
                        }
                      >
                        {scan.riskLevel}
                      </Badge>
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {formatRelativeTime(new Date(scan.createdAt))}
                    </td>
                  </tr>
                ))}
                {(!data?.recent || data.recent.length === 0) && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-foreground">
                      No scans yet. Go to the Scanner to analyze your first QR code.
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
