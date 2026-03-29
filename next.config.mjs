/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  allowedDevOrigins: ["1486864508960899153.discordsays.com"],
  experimental: {
    serverActions: {
      allowedOrigins: ["1486864508960899153.discordsays.com"],
      allowedDevOrigins: ["1486864508960899153.discordsays.com"],
    }
  }
};

export default nextConfig;
