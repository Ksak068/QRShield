"use client";

import { useState } from "react";
import { FileText, Download, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ReportsPage() {
  const [generating, setGenerating] = useState(false);

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/scan?limit=100");
      const data = await res.json();
      const scans = data.scans || [];

      if (scans.length === 0) {
        alert("No scan data to generate report.");
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
      doc.text(`Total Scans: ${scans.length}`, 14, 42);

      const safe = scans.filter((s: any) => s.riskLevel === "SAFE").length;
      const suspicious = scans.filter((s: any) => s.riskLevel === "SUSPICIOUS").length;
      const phishing = scans.filter((s: any) => s.riskLevel === "PHISHING").length;

      doc.setFontSize(12);
      doc.text("Summary", 14, 54);
      doc.setFontSize(10);
      doc.text(`Safe: ${safe}`, 14, 62);
      doc.text(`Suspicious: ${suspicious}`, 14, 68);
      doc.text(`Phishing: ${phishing}`, 14, 74);

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
        body: tableData.slice(0, 50),
        startY: 82,
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground">
          Generate and download security scan reports
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <FileText className="mb-2 h-8 w-8 text-emerald-500" />
            <CardTitle>Scan Report</CardTitle>
            <CardDescription>
              Generate a comprehensive PDF report of all your QR code scans,
              including risk distribution, threat intelligence results, and detailed scan history.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={generatePDF}
              disabled={generating}
              className="w-full gap-2"
            >
              <Download className="h-4 w-4" />
              {generating ? "Generating..." : "Download PDF Report"}
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
