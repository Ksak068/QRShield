"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SETTINGS_META: Record<
  string,
  { label: string; description: string; type: string; min?: number; max?: number; step?: number }
> = {
  RISK_THRESHOLD_SUSPICIOUS: {
    label: "Suspicious Threshold",
    description: "Score above this is SUSPICIOUS (below is SAFE)",
    type: "number",
    min: 0,
    max: 100,
    step: 5,
  },
  RISK_THRESHOLD_PHISHING: {
    label: "Phishing Threshold",
    description: "Score above this is PHISHING",
    type: "number",
    min: 0,
    max: 100,
    step: 5,
  },
  MIN_PASSWORD_LENGTH: {
    label: "Min Password Length",
    description: "Minimum characters required for user passwords",
    type: "number",
    min: 4,
    max: 32,
    step: 1,
  },
  SESSION_MAX_AGE: {
    label: "Session Duration (hours)",
    description: "Maximum session lifetime before re-login required",
    type: "number",
    min: 1,
    max: 720,
    step: 1,
  },
};

export function AdminSettings() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all(
      Object.keys(SETTINGS_META).map((key) =>
        fetch(`/api/settings`).then(async (r) => {
          const data = await r.json();
          return [key, data[key] || ""];
        }),
      ),
    )
      .then((entries) => setValues(Object.fromEntries(entries)))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          Object.fromEntries(
            Object.entries(values).filter(([, v]) => v !== ""),
          ),
        ),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      console.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Risk Thresholds</CardTitle>
          <CardDescription>
            Configure the score cutoffs that determine risk level classification.
            Changes apply to new scans only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {["RISK_THRESHOLD_SUSPICIOUS", "RISK_THRESHOLD_PHISHING"].map((key) => {
            const meta = SETTINGS_META[key];
            return (
              <div key={key} className="space-y-2">
                <Label htmlFor={key}>{meta.label}</Label>
                <p className="text-xs text-muted-foreground">{meta.description}</p>
                <Input
                  id={key}
                  type={meta.type}
                  min={meta.min}
                  max={meta.max}
                  step={meta.step}
                  value={values[key] ?? ""}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [key]: e.target.value }))
                  }
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security Policy</CardTitle>
          <CardDescription>
            Configure authentication and session policies.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {["MIN_PASSWORD_LENGTH", "SESSION_MAX_AGE"].map((key) => {
            const meta = SETTINGS_META[key];
            return (
              <div key={key} className="space-y-2">
                <Label htmlFor={key}>{meta.label}</Label>
                <p className="text-xs text-muted-foreground">{meta.description}</p>
                <Input
                  id={key}
                  type={meta.type}
                  min={meta.min}
                  max={meta.max}
                  step={meta.step}
                  value={values[key] ?? ""}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [key]: e.target.value }))
                  }
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save Settings"}
        </Button>
        {saved && (
          <span className="text-sm text-emerald-500">
            Settings saved successfully
          </span>
        )}
      </div>
    </div>
  );
}
