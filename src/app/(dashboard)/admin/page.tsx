"use client";

import { useEffect, useState } from "react";
import { Users, Shield, Ban, Trash2, Download, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { StatCard } from "@/components/shared/stat-card";
import { PieChartWidget } from "@/components/charts/pie-chart";

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  isSuspended: boolean;
  createdAt: string;
  _count: { scans: number };
}

interface Analytics {
  totalScans: number;
  totalUsers: number;
  riskDistribution: Record<string, number>;
}

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [activeTab, setActiveTab] = useState<"users" | "analytics">("users");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/users").then((r) => r.json()),
      fetch("/api/admin/analytics").then((r) => r.json()),
    ])
      .then(([usersData, analyticsData]) => {
        setUsers(usersData);
        setAnalytics(analyticsData);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleUserAction = async (userId: string, action: string) => {
    await fetch("/api/admin/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action }),
    });
    const updated = await fetch("/api/admin/users").then((r) => r.json());
    setUsers(updated);
  };

  const handleExport = async (format: string) => {
    window.open(`/api/admin/export?format=${format}`, "_blank");
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Administration</h1>
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const riskData = analytics?.riskDistribution
    ? Object.entries(analytics.riskDistribution).map(([key, value]) => ({
        name: key,
        value,
        color:
          key === "SAFE"
            ? "#10b981"
            : key === "SUSPICIOUS"
              ? "#f59e0b"
              : "#ef4444",
      }))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Administration</h1>
          <p className="text-muted-foreground">Manage users, view analytics, and export data</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport("csv")}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Total Users"
          value={analytics?.totalUsers || 0}
          icon={Users}
        />
        <StatCard
          title="Total Scans"
          value={analytics?.totalScans || 0}
          icon={BarChart3}
        />
        <StatCard title="System Status" value="Healthy" icon={Shield} variant="success" />
      </div>

      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab("users")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "users"
              ? "border-b-2 border-primary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          User Management
        </button>
        <button
          onClick={() => setActiveTab("analytics")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "analytics"
              ? "border-b-2 border-primary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Analytics
        </button>
      </div>

      {activeTab === "users" ? (
        <Card>
          <CardHeader>
            <CardTitle>Users ({users.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium">Email</th>
                    <th className="pb-3 font-medium">Role</th>
                    <th className="pb-3 font-medium">Scans</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Joined</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b last:border-0">
                      <td className="py-3 pr-4">{user.name || "—"}</td>
                      <td className="py-3 pr-4">{user.email}</td>
                      <td className="py-3 pr-4">
                        <Badge
                          variant={
                            user.role === "ADMIN" ? "default" : "secondary"
                          }
                        >
                          {user.role}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">{user._count.scans}</td>
                      <td className="py-3 pr-4">
                        {user.isSuspended ? (
                          <Badge variant="danger">Suspended</Badge>
                        ) : (
                          <Badge variant="success">Active</Badge>
                        )}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {formatDate(new Date(user.createdAt))}
                      </td>
                      <td className="py-3">
                        <div className="flex gap-1">
                          {user.isSuspended ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                handleUserAction(user.id, "unsuspend")
                              }
                              title="Unsuspend"
                            >
                              <Shield className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                handleUserAction(user.id, "suspend")
                              }
                              title="Suspend"
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleUserAction(user.id, "delete")}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Risk Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <PieChartWidget data={riskData} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-4">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Safe URLs</dt>
                  <dd className="font-semibold text-emerald-500">
                    {analytics?.riskDistribution.SAFE || 0}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Suspicious URLs</dt>
                  <dd className="font-semibold text-amber-500">
                    {analytics?.riskDistribution.SUSPICIOUS || 0}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Phishing URLs</dt>
                  <dd className="font-semibold text-red-500">
                    {analytics?.riskDistribution.PHISHING || 0}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
