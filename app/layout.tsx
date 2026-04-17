import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "stone · AI 访谈",
  description: "本地 AI 访谈助手，支持导出 Markdown",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
