import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["1486864508960899153.discordsays.com"],
    },
  },
  allowedDevOrigins: ["1486864508960899153.discordsays.com"],
};

export default nextConfig;
