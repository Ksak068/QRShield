"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { Save, Key, Palette, User, Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const { theme, setTheme } = useTheme();

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");

  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const [keySaving, setKeySaving] = useState(false);
  const [keySaved, setKeySaved] = useState(false);

  const handleProfileSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileError("");

    const form = new FormData(e.currentTarget);
    const name = form.get("name") as string;

    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        const err = await res.json();
        setProfileError(err.error || "Failed to update profile");
        return;
      }

      await update();
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch {
      setProfileError("Failed to update profile");
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPasswordSaving(true);
    setPasswordError("");

    const form = new FormData(e.currentTarget);
    const currentPassword = form.get("currentPassword") as string;
    const newPassword = form.get("newPassword") as string;
    const confirmPassword = form.get("confirmPassword") as string;

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      setPasswordSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/user/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!res.ok) {
        const err = await res.json();
        setPasswordError(err.error || "Failed to change password");
        return;
      }

      setPasswordSaved(true);
      (e.target as HTMLFormElement).reset();
      setTimeout(() => setPasswordSaved(false), 3000);
    } catch {
      setPasswordError("Failed to change password");
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleKeySave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setKeySaving(true);

    const form = new FormData(e.currentTarget);
    const settings: Record<string, string> = {};
    for (const [key, value] of form.entries()) {
      if (typeof value === "string" && value.trim()) {
        settings[key] = value.trim();
      }
    }

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        setKeySaved(true);
        setTimeout(() => setKeySaved(false), 3000);
      }
    } catch {
      console.error("Failed to save settings");
    } finally {
      setKeySaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <User className="mb-2 h-6 w-6 text-emerald-500" />
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your display name</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Display Name</Label>
              <Input
                id="name"
                name="name"
                defaultValue={session?.user?.name || ""}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={session?.user?.email || ""}
                disabled
              />
            </div>
            {profileError && (
              <p className="text-sm text-red-500">{profileError}</p>
            )}
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={profileSaving} className="gap-2">
                <Save className="h-4 w-4" />
                {profileSaving ? "Saving..." : "Save Profile"}
              </Button>
              {profileSaved && (
                <span className="text-sm text-emerald-500">
                  Profile updated
                </span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Lock className="mb-2 h-6 w-6 text-emerald-500" />
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Update your account password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  name="currentPassword"
                  type={showCurrent ? "text" : "password"}
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  name="newPassword"
                  type={showNew ? "text" : "password"}
                  placeholder="Enter new password (min 8 chars)"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Confirm new password"
              />
            </div>
            {passwordError && (
              <p className="text-sm text-red-500">{passwordError}</p>
            )}
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={passwordSaving} className="gap-2">
                <Save className="h-4 w-4" />
                {passwordSaving ? "Changing..." : "Change Password"}
              </Button>
              {passwordSaved && (
                <span className="text-sm text-emerald-500">
                  Password changed successfully
                </span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Key className="mb-2 h-6 w-6 text-emerald-500" />
          <CardTitle>API Keys</CardTitle>
          <CardDescription>
            Configure third-party security APIs for enhanced threat detection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleKeySave} className="space-y-4">
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
            <Button type="submit" disabled={keySaving} className="gap-2">
              <Save className="h-4 w-4" />
              {keySaving ? "Saving..." : "Save API Keys"}
            </Button>
            {keySaved && (
              <span className="ml-3 text-sm text-emerald-500">
                API keys saved
              </span>
            )}
          </form>
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
    </div>
  );
}
