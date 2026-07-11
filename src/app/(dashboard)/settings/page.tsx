"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { Save, Key, Palette, User, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);

    const form = new FormData(e.currentTarget);
    const settings: Record<string, string> = {};

    for (const [key, value] of form.entries()) {
      if (typeof value === "string" && value.trim()) {
        settings[key] = value.trim();
      }
    }

    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      console.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Configure your QR_Shield Enterprise preferences
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardHeader>
            <Key className="mb-2 h-6 w-6 text-emerald-500" />
            <CardTitle>API Keys</CardTitle>
            <CardDescription>
              Configure third-party security APIs for enhanced threat detection
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="VIRUSTOTAL_API_KEY">VirusTotal API Key</Label>
              <Input
                id="VIRUSTOTAL_API_KEY"
                name="VIRUSTOTAL_API_KEY"
                type="password"
                placeholder="Enter your VirusTotal API key"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="OPENROUTER_API_KEY">OpenRouter API Key</Label>
              <Input
                id="OPENROUTER_API_KEY"
                name="OPENROUTER_API_KEY"
                type="password"
                placeholder="Enter your OpenRouter API key"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Palette className="mb-2 h-6 w-6 text-emerald-500" />
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Customize the look and feel</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant={theme === "light" ? "default" : "outline"}
                onClick={() => setTheme("light")}
              >
                Light
              </Button>
              <Button
                type="button"
                variant={theme === "dark" ? "default" : "outline"}
                onClick={() => setTheme("dark")}
              >
                Dark
              </Button>
              <Button
                type="button"
                variant={theme === "system" ? "default" : "outline"}
                onClick={() => setTheme("system")}
              >
                System
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <User className="mb-2 h-6 w-6 text-emerald-500" />
            <CardTitle>Profile</CardTitle>
            <CardDescription>Manage your account settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Display Name</Label>
              <Input id="name" name="name" placeholder="Your name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="your@email.com"
                disabled
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Settings"}
          </Button>
          {saved && (
            <span className="text-sm text-emerald-500">
              Settings saved successfully
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
