import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  transpilePackages: ["lucide-react", "framer-motion"],
};

export default nextConfig;
