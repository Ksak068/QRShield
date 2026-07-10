"use client";

import { useState, useCallback, useRef } from "react";
import { Camera, Upload, Clipboard, Loader2, ScanQrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useScanner } from "@/hooks/use-scanner";
import { cn } from "@/lib/utils";

interface QrScannerProps {
  onScan: (content: string) => void;
  isProcessing?: boolean;
}

export function QrScanner({ onScan, isProcessing }: QrScannerProps) {
  const [mode, setMode] = useState<"camera" | "upload" | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const handleSuccess = useCallback(
    (content: string) => {
      setMode(null);
      onScan(content);
    },
    [onScan],
  );

  const { isScanning, error, startCamera, stopCamera, scanFromFile, scanFromClipboard } =
    useScanner({ onScanSuccess: handleSuccess });

  const handleFileSelect = useCallback(
    (file: File) => {
      if (file.type.startsWith("image/")) {
        scanFromFile(file);
        setMode(null);
      }
    },
    [scanFromFile],
  );

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handlePaste = useCallback(async () => {
    await scanFromClipboard();
    setMode(null);
  }, [scanFromClipboard]);

  if (isProcessing) {
    return (
      <Card className="glass-card">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Loader2 className="mb-4 h-12 w-12 animate-spin text-emerald-500" />
          <p className="text-lg font-medium">Analyzing QR Code...</p>
          <p className="text-sm text-muted-foreground">
            Running ML model, threat intelligence, and risk assessment
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScanQrCode className="h-5 w-5" />
          QR Code Scanner
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!mode && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Button
              variant="outline"
              className="flex h-32 flex-col gap-2"
              onClick={() => setMode("camera")}
            >
              <Camera className="h-8 w-8" />
              <span>Camera</span>
            </Button>
            <Button
              variant="outline"
              className="flex h-32 flex-col gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8" />
              <span>Upload Image</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
              />
            </Button>
            <Button
              variant="outline"
              className="flex h-32 flex-col gap-2"
              onClick={handlePaste}
            >
              <Clipboard className="h-8 w-8" />
              <span>Paste</span>
            </Button>
          </div>
        )}

        {mode === "camera" && (
          <div className="space-y-4">
            <div
              id="qr-reader-camera"
              className="overflow-hidden rounded-lg"
            />
            {error && <Badge variant="destructive">{error}</Badge>}
            <Button
              variant="outline"
              onClick={isScanning ? stopCamera : () => startCamera("qr-reader-camera")}
              className="w-full"
            >
              {isScanning ? "Stop Camera" : "Start Camera"}
            </Button>
          </div>
        )}

        {mode === "upload" && (
          <div
            ref={dropZoneRef}
            className={cn(
              "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors",
              dragOver
                ? "border-emerald-500 bg-emerald-500/10"
                : "border-muted-foreground/25",
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <Upload className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="mb-2 text-sm font-medium">
              Drag & drop QR code image here
            </p>
            <p className="mb-4 text-xs text-muted-foreground">
              or click to browse files
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Browse Files
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
