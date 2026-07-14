"use client";

import { useState } from "react";
import { FileText, Download, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ReportsPage() {
  const [generating, setGenerating] = useState(false);
  const [csvGenerating, setCsvGenerating] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const buildParams = () => {
    const params = new URLSearchParams({ limit: "1000" });
    if (fromDate) params.set("fromDate", fromDate);
    if (toDate) params.set("toDate", toDate);
    return params;
  };

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/scan?${buildParams()}`);
      const data = await res.json();
      const scans = data.scans || [];

      if (scans.length === 0) {
        alert("No scan data found for the selected date range.");
        return;
      }

      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF();
      doc.setFontSize(20);
      doc.text("QR_Shield Enterprise", 14, 22);
      doc.setFontSize(10);
      doc.text("Security Scan Report", 14, 30);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 36);
      if (fromDate || toDate) {
        doc.text(`Period: ${fromDate || "—"} to ${toDate || "—"}`, 14, 42);
      }
      doc.text(`Total Scans: ${scans.length}`, 14, 48);

      const safe = scans.filter((s: any) => s.riskLevel === "SAFE").length;
      const suspicious = scans.filter((s: any) => s.riskLevel === "SUSPICIOUS").length;
      const phishing = scans.filter((s: any) => s.riskLevel === "PHISHING").length;

      doc.setFontSize(12);
      doc.text("Summary", 14, 58);
      doc.setFontSize(10);
      doc.text(`Safe: ${safe}`, 14, 66);
      doc.text(`Suspicious: ${suspicious}`, 14, 72);
      doc.text(`Phishing: ${phishing}`, 14, 78);

      const tableData = scans.map((s: any) => [
        s.extractedUrl || "N/A",
        s.riskScore ?? "-",
        s.riskLevel,
        s.vtDetected ? "Yes" : "No",
        s.sbThreat ? "Yes" : "No",
        new Date(s.createdAt).toLocaleDateString(),
      ]);

      autoTable(doc, {
        head: [["URL", "Score", "Risk", "VT", "SB", "Date"]],
        body: tableData.slice(0, 100),
        startY: 86,
        styles: { fontSize: 8 },
      });

      doc.save(`qr-shield-report-${Date.now()}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Failed to generate PDF. Check console for details.");
    } finally {
      setGenerating(false);
    }
  };

  const generateCSV = async () => {
    setCsvGenerating(true);
    try {
      const res = await fetch(`/api/scan?${buildParams()}`);
      const data = await res.json();
      const scans = data.scans || [];

      if (scans.length === 0) {
        alert("No scan data found for the selected date range.");
        return;
      }

      const headers = ["URL", "Risk Score", "Risk Level", "VirusTotal", "Safe Browsing", "Date"];
      const rows = scans.map((s: any) => [
        `"${(s.extractedUrl || "N/A").replace(/"/g, '""')}"`,
        s.riskScore ?? "-",
        s.riskLevel,
        s.vtDetected ? "Detected" : "Clean",
        s.sbThreat ? "Threat" : "Clean",
        new Date(s.createdAt).toLocaleDateString(),
      ]);

      const csv = [headers.join(","), ...rows.map((r: any) => r.join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `qr-shield-report-${Date.now()}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error("CSV generation failed:", err);
      alert("Failed to generate CSV.");
    } finally {
      setCsvGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground">
          Generate and download security scan reports
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Date Range</CardTitle>
          <CardDescription>
            Filter scans by date period. Leave empty for all scans.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="fromDate">From</Label>
              <Input
                id="fromDate"
                type="date"
                className="w-44"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="toDate">To</Label>
              <Input
                id="toDate"
                type="date"
                className="w-44"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            {(fromDate || toDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setFromDate(""); setToDate(""); }}
              >
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <FileText className="mb-2 h-8 w-8 text-emerald-500" />
            <CardTitle>PDF Report</CardTitle>
            <CardDescription>
              Comprehensive PDF with risk summary, charts, and full scan history.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={generatePDF}
              disabled={generating}
              className="w-full gap-2"
            >
              <Download className="h-4 w-4" />
              {generating ? "Generating..." : "Download PDF"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Download className="mb-2 h-8 w-8 text-emerald-500" />
            <CardTitle>CSV Export</CardTitle>
            <CardDescription>
              Export scan data as CSV for analysis in Excel, Sheets, or other tools.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={generateCSV}
              disabled={csvGenerating}
              variant="outline"
              className="w-full gap-2"
            >
              <Download className="h-4 w-4" />
              {csvGenerating ? "Generating..." : "Download CSV"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Calendar className="mb-2 h-8 w-8 text-emerald-500" />
            <CardTitle>Scheduled Reports</CardTitle>
            <CardDescription>
              Configure automated report generation and email delivery.
              Coming soon.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md bg-muted p-4 text-center text-sm text-muted-foreground">
              Scheduled reporting will be available in a future update.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
