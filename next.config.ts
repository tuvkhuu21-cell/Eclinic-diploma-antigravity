import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.10.167", "192.168.10.99", "192.168.11.95"],
  transpilePackages: ["lucide-react"],
  serverExternalPackages: ["@prisma/client", "bcryptjs", "jsonwebtoken"],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
