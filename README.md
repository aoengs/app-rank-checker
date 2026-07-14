# 🔍 App Store 实时排名侦测

> 按 iPhone App Store 真实搜索顺序检查关键词排名。你的 App，排在第几位？

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-在线使用-orange)](https://aoengs.github.io/app-rank-checker/)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

---

## 简介

App Store 实时排名侦测是一个轻量级 ASO 关键词排名查询工具，直接抓取 **Apple App Store 搜索页**，解析内嵌的 `serialized-server-data` JSON，输出与手机端完全一致的排名结果。

与 iTunes Search API 不同，本工具读取的是 iPhone 用户实际看到的搜索结果顺序——包含首页 items + 分页数据，确保排名数据准确可靠。

### 核心功能

- 🔎 **单关键词查询** — 输入关键词 + 目标 App，实时返回排名和搜索结果快照
- 📊 **批量关键词** — 一次最多 30 个关键词，生成升序排名报告
- 🌏 **7 个地区** — 中国大陆、香港、台湾、美国、日本、新加坡、英国
- 📄 **PDF 报告** — 一键下载排名报告（含排名结论 + 前 10 位快照）
- 🕘 **搜索历史** — localStorage 自动保存，一键复用历史搜索

---

## 在线使用

👉 **[https://aoengs.github.io/app-rank-checker/](https://aoengs.github.io/app-rank-checker/)**

无需安装，打开浏览器即可使用。

---

## 本地开发

### 环境要求

- **Node.js** ≥ 22.13.0
- **npm** ≥ 10

### 快速开始

```bash
# 克隆仓库
git clone https://github.com/aoengs/app-rank-checker.git
cd app-rank-checker

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

浏览器打开 `http://localhost:3000` 即可。

### 可用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Next.js 开发服务器（HMR） |
| `npm run build` | 构建静态站点到 `out/` 目录 |
| `npm run lint` | ESLint 代码检查 |

### 代理 Worker

浏览器无法直接跨域请求 `apps.apple.com`，因此需要一层 CORS 代理。项目自带了 Cloudflare Worker 代理：

```bash
cd proxy-worker

# 部署到 Cloudflare Workers（需先登录）
npx wrangler deploy
```

部署后，将 `lib/app-store-search-client.ts` 中的 `PROXY` 常量替换为你的 Worker URL。

---

## 技术栈

| 技术 | 用途 |
|------|------|
| [Next.js](https://nextjs.org/) | 页面框架，静态导出（`output: "export"`） |
| [React 19](https://react.dev/) | UI 组件 |
| [Tailwind CSS v4](https://tailwindcss.com/) | 样式（`@tailwindcss/postcss` 插件） |
| [jsPDF](https://github.com/parallax/jsPDF) | PDF 报告生成 |
| [Cloudflare Workers](https://workers.cloudflare.com/) | CORS 代理（抓取 Apple 搜索页） |
| [GitHub Actions](https://github.com/features/actions) | CI/CD 自动部署到 GitHub Pages |
| TypeScript | 类型安全 |

---

## 项目结构

```
app-rank-checker/
├── app/
│   ├── layout.tsx          # 根布局（metadata、OG/Twitter 标签）
│   ├── page.tsx            # 主页面（"use client"）
│   └── globals.css         # 全局样式
├── lib/
│   ├── app-store-search-client.ts  # App Store storefront 搜索模块
│   └── report-pdf.js       # PDF 报告绘制（Canvas → jsPDF）
├── public/
│   └── og.png              # Open Graph 社交分享图
├── proxy-worker/
│   ├── index.ts            # Cloudflare Worker 代理入口
│   └── wrangler.toml       # Worker 配置
├── .github/workflows/
│   └── deploy.yml          # GitHub Actions 自动部署
├── next.config.ts          # Next.js 配置（basePath、static export）
├── tsconfig.json
└── package.json
```

---

## 排名原理

```
用户输入关键词
     │
     ▼
apps.apple.com/{地区}/iphone/search?term={关键词}
     │
     ▼
解析 <script id="serialized-server-data"> JSON
     │
     ├── shelves[].items[]        ← 首页搜索结果
     └── nextPage.results[]      ← 分页结果（翻页数据）
     │
     ▼
合并 items + nextPage → 完整排序 ID 列表
     │
     ▼
查找目标 App 的 trackId 在列表中的位置 → 排名
```

### 为什么不用 iTunes Search API？

- iTunes API 的排序逻辑与 iPhone 搜索页**不一致**，会导致排名偏差
- 本工具直接抓取 storefront HTML，获取的是用户在手机上看到的真实顺序
- 同时解析首页和分页数据，确保即使目标 App 排在第二页也能准确定位

---

## 部署

项目自动通过 GitHub Actions 部署到 GitHub Pages：

1. Push 到 `main` 分支
2. Actions 运行 `npm run build` 生成静态文件到 `out/`
3. 部署到 `aoengs.github.io/app-rank-checker/`

如需部署到自己的仓库，修改 `next.config.ts` 中的 `basePath` 和 `assetPrefix`。

---

## License

MIT

---

> 独立工具，与 Apple Inc. 无关联。数据来自 Apple 公开搜索页，排名可能受广告、缓存和实时实验影响。
