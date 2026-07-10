"use client";

import { useEffect, useState } from "react";
import { Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, truncate } from "@/lib/utils";
import { deleteScan } from "@/actions/scan";

interface ScanRecord {
  id: string;
  extractedUrl: string | null;
  normalizedUrl: string | null;
  riskScore: number | null;
  riskLevel: string;
  vtDetected: boolean;
  sbThreat: boolean;
  createdAt: string;
}

export default function HistoryPage() {
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const limit = 20;

  useEffect(() => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(page * limit),
    });
    fetch(`/api/scan?${params}`)
      .then((r) => r.json())
      .then((r) => {
        setScans(r.scans || []);
        setTotal(r.total || 0);
      })
      .finally(() => setLoading(false));
  }, [page]);

  const filtered = search
    ? scans.filter((s) =>
        s.extractedUrl?.toLowerCase().includes(search.toLowerCase()),
      )
    : scans;

  const handleDelete = async (id: string) => {
    const result = await deleteScan(id);
    if (result.success) {
      setScans((prev) => prev.filter((s) => s.id !== id));
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Scan History</h1>
        <p className="text-muted-foreground">
          View and manage all your QR code scans
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search URLs..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {total} Scan{total !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 font-medium">URL</th>
                    <th className="pb-3 font-medium">Score</th>
                    <th className="pb-3 font-medium">Risk</th>
                    <th className="pb-3 font-medium">VT</th>
                    <th className="pb-3 font-medium">SB</th>
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((scan) => (
                    <tr key={scan.id} className="border-b last:border-0">
                      <td className="py-3 pr-4">
                        {truncate(scan.extractedUrl || "N/A", 35)}
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
                      <td className="py-3 pr-4">
                        {scan.vtDetected ? (
                          <Badge variant="danger">Detected</Badge>
                        ) : (
                          <Badge variant="secondary">Clean</Badge>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {scan.sbThreat ? (
                          <Badge variant="danger">Threat</Badge>
                        ) : (
                          <Badge variant="secondary">Clean</Badge>
                        )}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {formatDate(new Date(scan.createdAt))}
                      </td>
                      <td className="py-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(scan.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No scans found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
