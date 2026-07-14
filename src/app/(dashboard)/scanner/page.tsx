"use client";

import { useState, useRef, useCallback } from "react";
import {
  Camera,
  Upload,
  Clipboard,
  X,
  QrCode,
  Shield,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useScanner } from "@/hooks/use-scanner";
import { useToast } from "@/components/ui/toast";

type ScanResult = {
  scanId: string;
  extractedUrl: string;
  normalizedUrl: string;
  riskScore: number;
  riskLevel: string;
  rfPrediction: number;
  rfLabel: string;
  vtDetected: boolean;
  vtMaliciousCount: number;
  sbThreat: boolean;
  sbThreatTypes: string[];
  aiExplanation: {
    summary: string;
    reasons: string[];
    recommendation: string;
  } | null;
  features: Record<string, unknown>;
};

export default function ScannerPage() {
  const { toast } = useToast();
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"idle" | "camera" | "upload" | "result">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleScanSuccess = useCallback(async (content: string) => {
    setMode("idle");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrContent: content }),
      });

      if (!res.ok) throw new Error("Scan failed");

      const data = await res.json();
      setResult(data);
      setMode("result");
      toast(
        data.riskLevel === "SAFE"
          ? "✓ Safe QR detected"
          : data.riskLevel === "SUSPICIOUS"
            ? "⚠️ Suspicious QR detected"
            : "🚫 High-risk QR detected",
        data.riskLevel === "SAFE" ? "success" : data.riskLevel === "SUSPICIOUS" ? "warning" : "danger",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const { isScanning, startCamera, stopCamera, scanFromFile, scanFromClipboard } =
    useScanner({ onScanSuccess: handleScanSuccess });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      scanFromFile(file);
      setMode("upload");
    }
  };

  const handlePaste = async () => {
    await scanFromClipboard();
  };

  const reset = () => {
    setMode("idle");
    setResult(null);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      scanFromFile(file);
      setMode("upload");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">QR Scanner</h1>
        <p className="text-muted-foreground">Scan a QR code to analyze its URL for threats</p>
      </div>

      {loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="mb-4 h-12 w-12 animate-spin text-emerald-500" />
            <p className="text-lg font-medium">Analyzing QR Code...</p>
            <p className="text-sm text-muted-foreground">
              Running ML model, checking threat intelligence, and generating report
            </p>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
            <p className="text-lg font-medium text-red-500">Scan Failed</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={reset} className="mt-4">
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {mode === "idle" && !loading && !error && (
        <>
          <Card>
            <CardContent
              className="flex flex-col items-center justify-center py-16"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <QrCode className="mb-4 h-16 w-16 text-emerald-500" />
              <h2 className="mb-2 text-xl font-semibold">Scan a QR Code</h2>
              <p className="mb-6 text-sm text-muted-foreground">
                Use your camera, upload an image, or paste from clipboard
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button
                  onClick={() => {
                    setMode("camera");
                    setTimeout(() => startCamera("qr-reader"), 100);
                  }}
                  className="gap-2"
                >
                  <Camera className="h-4 w-4" /> Camera
                </Button>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" /> Upload Image
                </Button>
                <Button variant="outline" onClick={handlePaste} className="gap-2">
                  <Clipboard className="h-4 w-4" /> Paste
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <Camera className="h-8 w-8 text-emerald-500" />
                <CardTitle className="mt-2">Camera</CardTitle>
                <CardDescription>
                  Point your camera at any QR code for instant scanning
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Upload className="h-8 w-8 text-emerald-500" />
                <CardTitle className="mt-2">Image Upload</CardTitle>
                <CardDescription>
                  Upload a screenshot or image containing a QR code
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Clipboard className="h-8 w-8 text-emerald-500" />
                <CardTitle className="mt-2">Clipboard</CardTitle>
                <CardDescription>
                  Paste a QR code image directly from your clipboard
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </>
      )}

      {mode === "camera" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Camera Scanner</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                stopCamera();
                setMode("idle");
              }}
            >
              <X className="h-5 w-5" />
            </Button>
          </CardHeader>
          <CardContent>
            <div
              id="qr-reader"
              className="mx-auto max-w-md overflow-hidden rounded-lg"
            />
            {isScanning && (
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Point your camera at a QR code...
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {mode === "result" && result && (
        <div className="space-y-6">
          <Card className={`border-2 ${result.riskLevel === "SAFE" ? "border-emerald-500" : result.riskLevel === "SUSPICIOUS" ? "border-amber-500" : "border-red-500"}`}>
            <CardHeader className="text-center">
              <div className="mb-4 flex justify-center">
                {result.riskLevel === "SAFE" ? (
                  <Shield className="h-16 w-16 text-emerald-500" />
                ) : result.riskLevel === "SUSPICIOUS" ? (
                  <AlertTriangle className="h-16 w-16 text-amber-500" />
                ) : (
                  <AlertCircle className="h-16 w-16 text-red-500" />
                )}
              </div>
              <CardTitle className="text-2xl">
                Risk Score: {result.riskScore}/100
              </CardTitle>
              <Badge
                variant={
                  result.riskLevel === "SAFE"
                    ? "success"
                    : result.riskLevel === "SUSPICIOUS"
                      ? "warning"
                      : "danger"
                }
                className="mt-2 text-sm"
              >
                {result.riskLevel}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm font-medium">URL</p>
                <a
                  href={result.normalizedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-emerald-500 hover:underline"
                >
                  {result.extractedUrl}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm font-medium">ML Detection</p>
                  <p className="text-sm text-muted-foreground">
                    {result.rfLabel} ({Math.round(result.rfPrediction * 100)}% confidence)
                  </p>
                </div>
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm font-medium">VirusTotal</p>
                  <p className="text-sm text-muted-foreground">
                    {result.vtDetected
                      ? `${result.vtMaliciousCount} engines detected`
                      : "No threats detected"}
                  </p>
                </div>
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm font-medium">Safe Browsing</p>
                  <p className="text-sm text-muted-foreground">
                    {result.sbThreat
                      ? result.sbThreatTypes.join(", ")
                      : "No threats detected"}
                  </p>
                </div>
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm font-medium">Classification</p>
                  <p className="text-sm text-muted-foreground">
                    {result.riskLevel}
                  </p>
                </div>
              </div>

              {result.aiExplanation && (
                <div className="rounded-lg border p-4">
                  <h3 className="mb-2 font-semibold">AI Analysis</h3>
                  <p className="text-sm text-muted-foreground">
                    {result.aiExplanation.summary}
                  </p>
                  {result.aiExplanation.reasons.length > 0 && (
                    <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                      {result.aiExplanation.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 rounded-md bg-amber-500/10 p-3 text-sm">
                    <strong>Recommendation:</strong>{" "}
                    {result.aiExplanation.recommendation}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-center">
            <Button onClick={reset} size="lg">
              Scan Another QR Code
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
