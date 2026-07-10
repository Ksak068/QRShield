"use client";

import { motion } from "framer-motion";
import {
  Shield,
  ScanQrCode,
  Brain,
  Globe,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import Link from "next/link";

const features = [
  {
    icon: ScanQrCode,
    title: "QR Code Decoding",
    description: "Decode QR codes from camera, image upload, or clipboard in real-time.",
  },
  {
    icon: Brain,
    title: "Machine Learning Detection",
    description: "Random Forest model trained on thousands of phishing URLs for accurate threat detection.",
  },
  {
    icon: Globe,
    title: "Threat Intelligence",
    description: "VirusTotal and Google Safe Browsing integration for comprehensive URL reputation checking.",
  },
  {
    icon: BarChart3,
    title: "Advanced Analytics",
    description: "Beautiful dashboards with real-time risk distribution, trends, and detailed reports.",
  },
];

const steps = [
  { number: "01", title: "Scan QR Code", description: "Use your camera, upload an image, or paste from clipboard." },
  { number: "02", title: "URL Analysis", description: "Extract features, check against ML model, and query threat intelligence APIs." },
  { number: "03", title: "Risk Assessment", description: "Combine all evidence into a weighted risk score with clear classification." },
  { number: "04", title: "AI Explanation", description: "Get natural language explanations of why a URL was classified as safe or phishing." },
];

const stats = [
  { value: "10K+", label: "URLs Analyzed" },
  { value: "99.9%", label: "Detection Accuracy" },
  { value: "500ms", label: "Average Scan Time" },
  { value: "3", label: "Threat Intelligence Sources" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="relative overflow-hidden pt-32 pb-20">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-background to-blue-500/10" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-muted px-4 py-1.5 text-sm">
              <Shield className="h-4 w-4 text-emerald-500" />
              Enterprise-Grade Security
            </div>
            <h1 className="bg-gradient-to-r from-emerald-500 to-blue-500 bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-6xl lg:text-7xl">
              Intelligent QR Code
              <br />
              Phishing Detection
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Protect your organization from QR code-based phishing attacks using machine learning,
              real-time threat intelligence, and AI-powered explanations.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link href="/register">
                <Button size="lg" className="gap-2">
                  Get Started <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" size="lg">
                  Sign In
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold">Enterprise-Grade Features</h2>
            <p className="mt-2 text-muted-foreground">
              Everything you need to detect and prevent QR code phishing attacks.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
              >
                <Card className="glass-card h-full">
                  <CardHeader>
                    <feature.icon className="h-10 w-10 text-emerald-500" />
                    <CardTitle className="mt-4">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm">{feature.description}</CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t bg-muted/50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold">How It Works</h2>
            <p className="mt-2 text-muted-foreground">
              From QR scan to risk report in seconds.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-4">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.15, duration: 0.5 }}
                className="relative"
              >
                <div className="mb-4 text-4xl font-bold text-emerald-500/30">{step.number}</div>
                <h3 className="mb-2 text-lg font-semibold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-4">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                className="text-center"
              >
                <div className="text-4xl font-bold text-emerald-500">{stat.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
