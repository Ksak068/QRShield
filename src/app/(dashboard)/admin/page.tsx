"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users,
  Shield,
  Ban,
  Trash2,
  Download,
  BarChart3,
  QrCode,
  Search,
  ArrowUpDown,
  ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatDate, formatRelativeTime, truncate } from "@/lib/utils";
import { StatCard } from "@/components/shared/stat-card";
import { PieChartWidget } from "@/components/charts/pie-chart";
import { LineChartWidget } from "@/components/charts/line-chart";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteScan } from "@/actions/scan";
import { AdminSettings } from "@/components/admin/settings";

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  isSuspended: boolean;
  createdAt: string;
  _count: { scans: number };
}

interface AdminScan {
  id: string;
  extractedUrl: string | null;
  riskLevel: string;
  riskScore: number | null;
  createdAt: string;
  user?: { name: string | null; email: string } | null;
}

interface Analytics {
  totalScans: number;
  totalUsers: number;
  riskDistribution: Record<string, number>;
  scansByDay: Array<{ date: string; count: number }>;
  recentScans: AdminScan[];
}

interface HealthStatus {
  status: string;
  vtConfigured: boolean;
  orConfigured: boolean;
  dbConnected: boolean;
}

interface TopDomain {
  domain: string;
  count: number;
  avgRiskScore: number;
  riskLevels: Record<string, number>;
}

interface LogEntry {
  id: string;
  logType: "api" | "audit";
  action?: string;
  endpoint?: string;
  method?: string;
  status?: number;
  duration?: number;
  ip?: string;
  userId?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [scans, setScans] = useState<AdminScan[]>([]);
  const [activeTab, setActiveTab] = useState<"users" | "scans" | "analytics" | "logs" | "settings">("users");
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [topDomains, setTopDomains] = useState<TopDomain[]>([]);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logPage, setLogPage] = useState(0);
  const [logTypeFilter, setLogTypeFilter] = useState("");
  const [logActionFilter, setLogActionFilter] = useState("");

  const [exportFromDate, setExportFromDate] = useState("");
  const [exportToDate, setExportToDate] = useState("");

  const [userSearch, setUserSearch] = useState("");

  const [scanRiskFilter, setScanRiskFilter] = useState("");
  const [scanFromDate, setScanFromDate] = useState("");
  const [scanToDate, setScanToDate] = useState("");
  const [scanSearch, setScanSearch] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmVariant, setConfirmVariant] = useState<"danger" | "default">("danger");
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});

  const [sortField, setSortField] = useState<string>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const showConfirm = useCallback(
    (
      title: string,
      message: string,
      action: () => void,
      variant: "danger" | "default" = "danger",
    ) => {
      setConfirmTitle(title);
      setConfirmMessage(message);
      setConfirmAction(() => action);
      setConfirmVariant(variant);
      setConfirmOpen(true);
    },
    [],
  );

  const fetchLogs = useCallback(async (page = 0) => {
    const params = new URLSearchParams({ limit: "50", offset: String(page * 50) });
    if (logTypeFilter) params.set("type", logTypeFilter);
    if (logActionFilter) params.set("action", logActionFilter);
    const res = await fetch(`/api/admin/logs?${params}`);
    const data = await res.json();
    setLogs(data.logs || []);
    setLogTotal(data.total || 0);
  }, [logTypeFilter, logActionFilter]);

  const fetchData = useCallback(async () => {
    const [usersData, analyticsData, scansData, healthData] = await Promise.all([
      fetch("/api/admin/users").then((r) => r.json()),
      fetch("/api/admin/analytics").then((r) => r.json()),
      fetch("/api/scan?limit=50").then((r) => r.json()),
      fetch("/api/health")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]);
    setUsers(usersData || []);
    setAnalytics(analyticsData);
    setScans(scansData.scans || []);
    setHealth(healthData);

    fetch("/api/admin/top-domains")
      .then((r) => r.json())
      .then((d) => setTopDomains(d.domains || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  useEffect(() => {
    if (activeTab === "logs") fetchLogs(logPage);
  }, [activeTab, logPage, fetchLogs]);

  const handleUserAction = async (userId: string, action: string) => {
    await fetch("/api/admin/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action }),
    });
    const updated = await fetch("/api/admin/users").then((r) => r.json());
    setUsers(updated);
  };

  const handleDeleteScan = async (scanId: string) => {
    const result = await deleteScan(scanId);
    if (result.success) {
      setScans((prev) => prev.filter((s) => s.id !== scanId));
    }
  };

  const handleExport = (format: string) => {
    const params = new URLSearchParams({ format });
    if (exportFromDate) params.set("fromDate", exportFromDate);
    if (exportToDate) params.set("toDate", exportToDate);
    window.open(`/api/admin/export?${params}`, "_blank");
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const filteredUsers = userSearch
    ? users.filter(
        (u) =>
          u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
          u.email.toLowerCase().includes(userSearch.toLowerCase()),
      )
    : users;

  const filteredScans = scans.filter((s) => {
    if (scanRiskFilter && s.riskLevel !== scanRiskFilter) return false;
    if (scanFromDate && new Date(s.createdAt) < new Date(scanFromDate)) return false;
    if (scanToDate && new Date(s.createdAt) > new Date(scanToDate + "T23:59:59")) return false;
    if (scanSearch && !s.extractedUrl?.toLowerCase().includes(scanSearch.toLowerCase()))
      return false;
    return true;
  });

  const lineChartData =
    analytics?.scansByDay?.map((d) => ({
      name: d.date,
      value: d.count,
    })) || [];

  const monthlyChartData =
    analytics?.scansByMonth?.map((d) => ({
      name: d.month,
      value: d.count,
    })) || [];

  const riskData = analytics?.riskDistribution
    ? Object.entries(analytics.riskDistribution).map(([key, value]) => ({
        name: key,
        value,
        color:
          key === "SAFE" ? "#10b981" : key === "SUSPICIOUS" ? "#f59e0b" : "#ef4444",
      }))
    : [];

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Administration</h1>
          <p className="text-muted-foreground">
            Manage users, view analytics, and export data
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            className="w-36 h-9 text-xs"
            value={exportFromDate}
            onChange={(e) => setExportFromDate(e.target.value)}
            placeholder="From"
          />
          <Input
            type="date"
            className="w-36 h-9 text-xs"
            value={exportToDate}
            onChange={(e) => setExportToDate(e.target.value)}
            placeholder="To"
          />
          <Button variant="outline" size="sm" onClick={() => handleExport("csv")}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
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
        <StatCard
          title="System Status"
          value={health?.status === "healthy" ? "Healthy" : "Degraded"}
          icon={Shield}
          variant={health?.status === "healthy" ? "success" : "danger"}
        />
        <StatCard
          title="API Keys"
          value={
            [health?.vtConfigured, health?.orConfigured].filter(Boolean).length +
            "/2"
          }
          icon={QrCode}
        />
      </div>

      <div className="flex gap-2 border-b">
        {(["users", "scans", "analytics", "logs", "settings"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "users"
              ? "User Management"
              : tab === "scans"
                ? "All Scans"
                : tab === "analytics"
                  ? "Analytics"
                  : tab === "logs"
                    ? "Logs"
                    : "Settings"}
          </button>
        ))}
      </div>

      {activeTab === "users" ? (
        <Card>
          <CardHeader>
            <CardTitle>Users ({users.length})</CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                className="pl-10"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>
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
                  {filteredUsers.map((user) => (
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
                          {user.role === "ADMIN" ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                showConfirm(
                                  "Demote User",
                                  `Remove admin role from ${user.email}?`,
                                  () =>
                                    handleUserAction(user.id, "set-corporate"),
                                  "default",
                                )
                              }
                              title="Demote to Corporate"
                            >
                              <ArrowUpDown className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                handleUserAction(user.id, "set-admin")
                              }
                              title="Promote to Admin"
                            >
                              <ArrowUpDown className="h-4 w-4" />
                            </Button>
                          )}
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
                                showConfirm(
                                  "Suspend User",
                                  `Suspend ${user.email}? They won't be able to log in.`,
                                  () =>
                                    handleUserAction(user.id, "suspend"),
                                )
                              }
                              title="Suspend"
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              showConfirm(
                                "Delete User",
                                `Permanently delete ${user.email}? All their scans will also be deleted.`,
                                () => handleUserAction(user.id, "delete"),
                              )
                            }
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-8 text-center text-muted-foreground"
                      >
                        {userSearch
                          ? "No users match your search"
                          : "No users found"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : activeTab === "scans" ? (
        <Card>
          <CardHeader>
            <CardTitle>All Scans ({filteredScans.length})</CardTitle>
            <div className="mt-2 flex flex-wrap gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search URLs..."
                  className="pl-10"
                  value={scanSearch}
                  onChange={(e) => setScanSearch(e.target.value)}
                />
              </div>
              <select
                className="rounded-md border bg-background px-3 py-2 text-sm"
                value={scanRiskFilter}
                onChange={(e) => setScanRiskFilter(e.target.value)}
              >
                <option value="">All Risk Levels</option>
                <option value="SAFE">Safe</option>
                <option value="SUSPICIOUS">Suspicious</option>
                <option value="PHISHING">Phishing</option>
              </select>
              <Input
                type="date"
                className="w-40"
                value={scanFromDate}
                onChange={(e) => setScanFromDate(e.target.value)}
                placeholder="From"
              />
              <Input
                type="date"
                className="w-40"
                value={scanToDate}
                onChange={(e) => setScanToDate(e.target.value)}
                placeholder="To"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 font-medium">User</th>
                    <th className="pb-3 font-medium">URL</th>
                    <th className="pb-3 font-medium">Score</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Time</th>
                    <th className="pb-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {filteredScans.map((scan) => (
                    <tr key={scan.id} className="border-b last:border-0">
                      <td className="py-3 pr-4 text-xs text-muted-foreground">
                        {scan.user?.email || "Anonymous"}
                      </td>
                      <td className="py-3 pr-4">
                        {truncate(scan.extractedUrl || "", 50)}
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
                      <td className="py-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            showConfirm(
                              "Delete Scan",
                              `Delete scan for ${truncate(scan.extractedUrl || "", 40)}?`,
                              () => handleDeleteScan(scan.id),
                            )
                          }
                          title="Delete scan"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {filteredScans.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-8 text-center text-muted-foreground"
                      >
                        {scanSearch || scanRiskFilter || scanFromDate || scanToDate
                          ? "No scans match your filters"
                          : "No scans found across the organization."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : activeTab === "analytics" ? (
        <div className="space-y-6">
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
                <CardTitle>Scans (Last 30 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <LineChartWidget
                  data={lineChartData}
                  color="hsl(173, 58%, 39%)"
                />
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
                      {analytics?.riskDistribution?.SAFE || 0}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Suspicious URLs</dt>
                    <dd className="font-semibold text-amber-500">
                      {analytics?.riskDistribution?.SUSPICIOUS || 0}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Phishing URLs</dt>
                    <dd className="font-semibold text-red-500">
                      {analytics?.riskDistribution?.PHISHING || 0}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Health</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-4">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Status</dt>
                    <dd>
                      <Badge
                        variant={
                          health?.status === "healthy" ? "success" : "danger"
                        }
                      >
                        {health?.status || "Unknown"}
                      </Badge>
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Database</dt>
                    <dd>
                      <Badge
                        variant={health?.dbConnected ? "success" : "danger"}
                      >
                        {health?.dbConnected ? "Connected" : "Disconnected"}
                      </Badge>
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">VirusTotal API</dt>
                    <dd>
                      <Badge
                        variant={health?.vtConfigured ? "success" : "secondary"}
                      >
                        {health?.vtConfigured ? "Configured" : "Not Set"}
                      </Badge>
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">OpenRouter API</dt>
                    <dd>
                      <Badge
                        variant={health?.orConfigured ? "success" : "secondary"}
                      >
                        {health?.orConfigured ? "Configured" : "Not Set"}
                      </Badge>
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Monthly Trends (12 Months)</CardTitle>
            </CardHeader>
            <CardContent>
              <LineChartWidget
                data={monthlyChartData}
                color="hsl(220, 70%, 50%)"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Risky Domains</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-3 font-medium">Domain</th>
                      <th className="pb-3 font-medium">Scans</th>
                      <th className="pb-3 font-medium">Avg Risk</th>
                      <th className="pb-3 font-medium">Safe</th>
                      <th className="pb-3 font-medium">Suspicious</th>
                      <th className="pb-3 font-medium">Phishing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topDomains.map((d) => (
                      <tr key={d.domain} className="border-b last:border-0">
                        <td className="py-3 pr-4 font-mono text-xs">
                          {d.domain}
                        </td>
                        <td className="py-3 pr-4">{d.count}</td>
                        <td className="py-3 pr-4">
                          <Badge
                            variant={
                              d.avgRiskScore > 60
                                ? "danger"
                                : d.avgRiskScore > 30
                                  ? "warning"
                                  : "success"
                            }
                          >
                            {d.avgRiskScore}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 text-emerald-500">
                          {d.riskLevels.SAFE || 0}
                        </td>
                        <td className="py-3 pr-4 text-amber-500">
                          {d.riskLevels.SUSPICIOUS || 0}
                        </td>
                        <td className="py-3 text-red-500">
                          {d.riskLevels.PHISHING || 0}
                        </td>
                      </tr>
                    ))}
                    {topDomains.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-8 text-center text-muted-foreground"
                        >
                          No domain data available yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {health && (
            <Card>
              <CardHeader>
                <CardTitle>Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-4">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">VirusTotal API</dt>
                    <dd>
                      <Badge
                        variant={health.vtConfigured ? "success" : "secondary"}
                      >
                        {health.vtConfigured ? "Configured" : "Not Set"}
                      </Badge>
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">OpenRouter API</dt>
                    <dd>
                      <Badge
                        variant={health.orConfigured ? "success" : "secondary"}
                      >
                        {health.orConfigured ? "Configured" : "Not Set"}
                      </Badge>
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Server Uptime</dt>
                    <dd className="font-mono text-xs">
                      {Math.floor(health.uptime / 86400)}d{" "}
                      {Math.floor((health.uptime % 86400) / 3600)}h{" "}
                      {Math.floor((health.uptime % 3600) / 60)}m
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          )}
        </div>
      ) : activeTab === "logs" ? (
        <Card>
          <CardHeader>
            <CardTitle>Logs ({logTotal})</CardTitle>
            <div className="mt-2 flex flex-wrap gap-3">
              <select
                className="rounded-md border bg-background px-3 py-2 text-sm"
                value={logTypeFilter}
                onChange={(e) => {
                  setLogTypeFilter(e.target.value);
                  setLogPage(0);
                }}
              >
                <option value="">All Types</option>
                <option value="api">API Logs</option>
                <option value="audit">Audit Logs</option>
              </select>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Filter by action..."
                  className="pl-10"
                  value={logActionFilter}
                  onChange={(e) => {
                    setLogActionFilter(e.target.value);
                    setLogPage(0);
                  }}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 font-medium">Type</th>
                    <th className="pb-3 font-medium">Action / Endpoint</th>
                    <th className="pb-3 font-medium">Details</th>
                    <th className="pb-3 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b last:border-0">
                      <td className="py-3 pr-4">
                        <Badge
                          variant={
                            log.logType === "audit" ? "default" : "secondary"
                          }
                        >
                          {log.logType === "audit" ? "Audit" : "API"}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs">
                        {log.logType === "audit"
                          ? log.action
                          : `${log.method} ${log.endpoint}`}
                      </td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground">
                        {log.logType === "audit"
                          ? JSON.stringify(log.details).slice(0, 80)
                          : `${log.status} (${log.duration}ms)`}
                        {log.ip && <span className="ml-2">— {log.ip}</span>}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {formatRelativeTime(new Date(log.createdAt))}
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No logs found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {logTotal > 50 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {logPage + 1} of {Math.ceil(logTotal / 50)}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={logPage === 0}
                    onClick={() => setLogPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={logPage >= Math.ceil(logTotal / 50) - 1}
                    onClick={() => setLogPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : activeTab === "settings" ? (
        <AdminSettings />
      ) : null}
 
      <ConfirmDialog
        open={confirmOpen}
        title={confirmTitle}
        message={confirmMessage}
        variant={confirmVariant}
        onConfirm={() => {
          confirmAction();
          setConfirmOpen(false);
        }}
        onCancel={() => setConfirmOpen(false)}
        confirmLabel="Confirm"
      />
    </div>
  );
}
