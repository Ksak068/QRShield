"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { X, Shield, AlertTriangle, AlertCircle, CheckCircle } from "lucide-react";

type ToastVariant = "success" | "warning" | "danger" | "info";

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const iconMap = {
  success: CheckCircle,
  warning: AlertTriangle,
  danger: AlertCircle,
  info: Shield,
};

const bgMap = {
  success: "border-emerald-500 bg-emerald-500/10",
  warning: "border-amber-500 bg-amber-500/10",
  danger: "border-red-500 bg-red-500/10",
  info: "border-blue-500 bg-blue-500/10",
};

const textMap = {
  success: "text-emerald-500",
  warning: "text-amber-500",
  danger: "text-red-500",
  info: "text-blue-500",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, variant: ToastVariant = "info") => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => {
          const Icon = iconMap[t.variant];
          return (
            <div
              key={t.id}
              className={`flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm ${bgMap[t.variant]}`}
            >
              <Icon className={`mt-0.5 h-5 w-5 ${textMap[t.variant]}`} />
              <p className="text-sm text-foreground">{t.message}</p>
              <button
                onClick={() => removeToast(t.id)}
                className="ml-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
