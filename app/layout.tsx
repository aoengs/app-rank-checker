import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = "https://aoengs.github.io/app-rank-checker";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "App Store 实时排名侦测｜检查 App Store 关键词排名",
  description:
    "输入关键词和 App 名称，按 iPhone App Store 搜索页顺序查看目标 App 的位置。",
  openGraph: {
    title: "App Store 实时排名侦测",
    description: "你的 App，排在第几位？",
    images: [
      { url: "/og.png", width: 1734, height: 907, alt: "App Store 实时排名侦测" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "App Store 实时排名侦测",
    description: "按 iPhone App Store 搜索页顺序检查关键词排名",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
