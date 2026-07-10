"use client";

import { useState, useCallback, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface UseScannerOptions {
  onScanSuccess?: (content: string) => void;
  onScanError?: (error: string) => void;
}

export function useScanner(options: UseScannerOptions = {}) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const startCamera = useCallback(
    async (elementId: string) => {
      setError(null);
      setIsScanning(true);

      try {
        scannerRef.current = new Html5Qrcode(elementId);
        await scannerRef.current.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            options.onScanSuccess?.(decodedText);
            stopCamera();
          },
          undefined,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Camera access denied";
        setError(msg);
        setIsScanning(false);
        options.onScanError?.(msg);
      }
    },
    [options],
  );

  const stopCamera = useCallback(() => {
    if (scannerRef.current) {
      scannerRef.current
        .stop()
        .catch(() => {})
        .finally(() => {
          scannerRef.current = null;
          setIsScanning(false);
        });
    }
  }, []);

  const scanFromFile = useCallback(
    (file: File) => {
      setError(null);
      setIsScanning(true);

      const reader = new FileReader();
      reader.onload = async (e) => {
        const imageUrl = e.target?.result as string;
        if (!imageUrl) {
          setError("Failed to read image");
          setIsScanning(false);
          return;
        }

        try {
          const tempScanner = new Html5Qrcode("qr-reader-file");
          const result = await tempScanner.scanFile(file, true);
          options.onScanSuccess?.(result);
          setIsScanning(false);
        } catch {
          setError("No QR code found in image");
          setIsScanning(false);
          options.onScanError?.("No QR code found");
        }
      };
      reader.onerror = () => {
        setError("Failed to read file");
        setIsScanning(false);
      };
      reader.readAsDataURL(file);
    },
    [options],
  );

  const scanFromClipboard = useCallback(async () => {
    setError(null);
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], "clipboard.png", { type: imageType });
          scanFromFile(file);
          return;
        }
      }
      setError("No image found in clipboard");
    } catch {
      setError("Clipboard access denied");
    }
  }, [scanFromFile]);

  return {
    isScanning,
    error,
    startCamera,
    stopCamera,
    scanFromFile,
    scanFromClipboard,
    fileInputRef,
  };
}
