"use client";

import Link from "next/link";
import { Shield, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-background to-blue-500/5" />
      <Card className="relative w-full max-w-md glass-card">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <Shield className="h-12 w-12 text-emerald-500" />
          </div>
          <CardTitle className="text-2xl">Verify Your Email</CardTitle>
          <CardDescription>
            We&apos;ve sent a verification link to your email address
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Mail className="mx-auto mb-4 h-16 w-16 text-emerald-500" />
          <p className="mb-4 text-sm text-muted-foreground">
            Please check your inbox and click the verification link to activate your account.
            If you don&apos;t see the email, check your spam folder.
          </p>
          <Link href="/login">
            <Button variant="outline" className="w-full">
              Back to Login
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
