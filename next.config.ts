import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 允许通过 Cloudflare Tunnel 访问开发服务器（*.trycloudflare.com）
  // Next.js 16 默认只允许 localhost 来源的请求
  allowedDevOrigins: ["*.trycloudflare.com", "*.ngrok-free.app", "*.ngrok-free.dev"],
};

export default nextConfig;
