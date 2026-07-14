"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { downloadBatchRankReport, downloadSingleRankReport } from "@/lib/report-pdf";
import {
  resolveTargetApp,
  searchKeyword,
} from "@/lib/app-store-search-client";
import type { AppResult } from "@/lib/app-store-search-client";

type MatchResult = {
  app: AppResult;
  rank: number;
};

type SearchMode = "single" | "batch";

type BatchRankResult = {
  keyword: string;
  rank: number | null;
  resultCount: number;
  error?: string;
};

type BatchResponse = {
  targetApp: AppResult;
  results: BatchRankResult[];
  checkedAt: string;
  error?: string;
};

type HistoryItem = {
  id: string;
  mode: SearchMode;
  keywords: string;
  target: string;
  country: string;
  storeLabel: string;
  rank: number | null;
  timestamp: number;
};

const STORES = [
  { code: "cn", label: "中国大陆" },
  { code: "hk", label: "中国香港" },
  { code: "tw", label: "中国台湾" },
  { code: "us", label: "美国" },
  { code: "jp", label: "日本" },
  { code: "sg", label: "新加坡" },
  { code: "gb", label: "英国" },
];

const HISTORY_KEY = "app-rank-history";
const HISTORY_MAX = 30;

function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryItem[];
  } catch {
    return [];
  }
}

function saveHistory(items: HistoryItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, HISTORY_MAX)));
  } catch { /* quota exceeded — silently drop oldest */ }
}

function dateLabel(ts: number): string {
  const now = new Date();
  const d = new Date(ts);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} 小时前`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} 天前`;
  return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

function Rating({ value, count }: { value?: number; count?: number }) {
  if (!value) return <span className="muted">暂无评分</span>;
  return (
    <span className="rating" aria-label={`${value.toFixed(1)} 分，${count ?? 0} 个评分`}>
      <span aria-hidden="true">★</span> {value.toFixed(1)}
      <span className="muted"> · {(count ?? 0).toLocaleString("zh-CN")} 个评分</span>
    </span>
  );
}

export default function Home() {
  const [mode, setMode] = useState<SearchMode>("single");
  const [keyword, setKeyword] = useState("AI财报");
  const [batchInput, setBatchInput] = useState("");
  const [target, setTarget] = useState("不绕得财报");
  const [country, setCountry] = useState("cn");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<AppResult[]>([]);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [targetFound, setTargetFound] = useState(false);
  const [resultCount, setResultCount] = useState(0);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [batchReport, setBatchReport] = useState<BatchResponse | null>(null);
  const [error, setError] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  // History state — lazy init from localStorage
  const [history, setHistory] = useState<HistoryItem[]>(() => loadHistory());
  const [historyOpen, setHistoryOpen] = useState(false);

  const storeLabel = STORES.find((store) => store.code === country)?.label ?? country;
  const batchKeywords = [...new Set(
    batchInput.split(",").map((item) => item.trim()).filter(Boolean),
  )];
  const batchInputError = batchInput.includes("，")
    ? "检测到中文逗号，请改用英文逗号 , 分隔。"
    : batchKeywords.length > 30
      ? `已识别 ${batchKeywords.length} 个关键词，最多支持 30 个。`
      : "";
  const rankedBatchResults = batchReport?.results.filter((item) => item.rank !== null) ?? [];
  const bestBatchRank = rankedBatchResults[0]?.rank ?? null;
  const averageBatchRank = rankedBatchResults.length
    ? Math.round(
      rankedBatchResults.reduce((sum, item) => sum + (item.rank ?? 0), 0)
        / rankedBatchResults.length,
    )
    : null;

  // Filter history by current mode
  const filteredHistory = useMemo(
    () => history.filter((item) => item.mode === mode),
    [history, mode],
  );

  const addToHistory = useCallback((item: Omit<HistoryItem, "id" | "timestamp">) => {
    setHistory((prev) => {
      const key = `${item.keywords}::${item.target}::${item.country}`;
      const filtered = prev.filter((h) => `${h.keywords}::${h.target}::${h.country}` !== key);
      const next: HistoryItem[] = [
        { ...item, id: crypto.randomUUID(), timestamp: Date.now() },
        ...filtered,
      ];
      saveHistory(next);
      return next;
    });
  }, []);

  const removeHistoryItem = useCallback((id: string) => {
    setHistory((prev) => {
      const next = prev.filter((h) => h.id !== id);
      saveHistory(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  function applyHistory(item: HistoryItem) {
    if (item.mode === "single") {
      setMode("single");
      setKeyword(item.keywords);
      setTarget(item.target);
      setCountry(item.country);
    } else {
      setMode("batch");
      setBatchInput(item.keywords);
      setTarget(item.target);
      setCountry(item.country);
    }
    setHistoryOpen(false);
    clearOutput();
  }

  function clearOutput() {
    setSearched(false);
    setResults([]);
    setMatch(null);
    setTargetFound(false);
    setBatchReport(null);
    setError("");
    setDownloadError("");
  }

  function changeMode(nextMode: SearchMode) {
    if (nextMode === mode) return;
    setMode(nextMode);
    clearOutput();
  }

  async function runSearch(event?: FormEvent) {
    event?.preventDefault();
    if (!target.trim()) {
      setError("目标 App 名称不能为空。");
      return;
    }
    if (mode === "single" && !keyword.trim()) {
      setError("搜索关键词不能为空。");
      return;
    }
    if (mode === "batch" && (!batchKeywords.length || batchInputError)) {
      setError(batchInputError || "请至少输入 1 个批量关键词。");
      return;
    }

    setLoading(true);
    setError("");
    setDownloadError("");
    setSearched(false);
    setBatchReport(null);
    try {
      if (mode === "batch") {
        const targetApp = await resolveTargetApp(target.trim(), country);
        if (!targetApp) {
          setError(`没有匹配到目标 App「${target.trim()}」，请检查名称是否准确。`);
          setLoading(false);
          return;
        }

        const batchResults = await Promise.all(
          batchKeywords.map(async (kw) => {
            try {
              const result = await searchKeyword(kw, country, targetApp.trackId);
              return {
                keyword: kw,
                rank: result.rank,
                resultCount: result.resultCount,
              } satisfies BatchRankResult;
            } catch {
              return {
                keyword: kw,
                rank: null,
                resultCount: 0,
                error: "查询失败",
              } satisfies BatchRankResult;
            }
          }),
        );

        batchResults.sort((a, b) => {
          if (a.rank === null && b.rank === null) return 0;
          if (a.rank === null) return 1;
          if (b.rank === null) return -1;
          return a.rank - b.rank;
        });

        const keywordsStr = batchKeywords.join(",");
        const bestRank = batchResults.find((r) => r.rank !== null)?.rank ?? null;
        addToHistory({ mode: "batch", keywords: keywordsStr, target: target.trim(), country, storeLabel, rank: bestRank });

        setBatchReport({
          targetApp,
          results: batchResults,
          checkedAt: new Date().toISOString(),
        });
        setCheckedAt(new Date());
        return;
      }

      const targetApp = await resolveTargetApp(target.trim(), country);
      const rankedResult = await searchKeyword(
        keyword.trim(),
        country,
        targetApp?.trackId ?? null,
      );

      addToHistory({ mode: "single", keywords: keyword.trim(), target: target.trim(), country, storeLabel, rank: rankedResult.rank });

      setResults(rankedResult.results);
      setResultCount(rankedResult.resultCount);
      setMatch(
        targetApp && rankedResult.rank
          ? { app: targetApp, rank: rankedResult.rank }
          : null,
      );
      setTargetFound(Boolean(targetApp));
      setCheckedAt(new Date());
      setSearched(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "搜索失败，请稍后重试。");
      setResults([]);
      setMatch(null);
      setTargetFound(false);
      setBatchReport(null);
    } finally {
      setLoading(false);
    }
  }

  async function downloadPdf() {
    if (!checkedAt || pdfLoading) return;
    setPdfLoading(true);
    setDownloadError("");
    try {
      if (batchReport) {
        await downloadBatchRankReport({
          targetApp: batchReport.targetApp.trackName,
          storeLabel,
          checkedAt,
          results: batchReport.results,
        });
      } else if (searched) {
        await downloadSingleRankReport({
          keyword,
          target: match?.app.trackName ?? target,
          storeLabel,
          rank: match?.rank ?? null,
          resultCount,
          checkedAt,
          results,
          targetFound,
        });
      }
    } catch {
      setDownloadError("PDF 报告生成失败，请稍后重试。");
    } finally {
      setPdfLoading(false);
    }
  }

  useEffect(() => {
    const event = new CustomEvent("rank-checker-ready");
    window.dispatchEvent(event);
  }, []);

  return (
    <main>
      <nav className="nav" aria-label="主导航">
        <a className="brand" href="#top" aria-label="App 排名侦测站首页">
          <span className="brand-mark" aria-hidden="true">R</span>
          <span>App 排名侦测站</span>
        </a>
        <span className="live-pill"><i /> Apple 实时数据</span>
      </nav>

      <section className="hero" id="top">
        <div className="eyebrow"><span>01</span> ASO 关键词排名检查</div>
        <h1>你的 App，<br /><em>排在第几位？</em></h1>
        <p className="lede">输入搜索关键词和目标 App 名称，立即查看它在指定地区 Apple 搜索结果中的位置。也可一次生成最多 30 个关键词的排名报告。</p>

        <div className="mode-switcher" aria-label="查询模式">
          <button type="button" aria-pressed={mode === "single"} onClick={() => changeMode("single")}>
            <span>01</span> 单关键词
          </button>
          <button type="button" aria-pressed={mode === "batch"} onClick={() => changeMode("batch")}>
            <span>02</span> 批量关键词
          </button>
        </div>

        <form className={`search-panel ${mode === "batch" ? "batch-search-panel" : ""}`} onSubmit={runSearch}>
          {mode === "single" ? (
            <div className="field keyword-field">
              <label htmlFor="keyword">搜索关键词</label>
              <input
                id="keyword"
                name="keyword"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="例如：AI财报"
                autoComplete="off"
                required
              />
            </div>
          ) : (
            <div className={`field batch-keywords-field ${batchInputError ? "has-error" : ""}`}>
              <div className="batch-field-heading">
                <label htmlFor="batch-keywords">批量关键词</label>
                <span className={batchKeywords.length > 30 ? "over-limit" : ""}>已识别 {batchKeywords.length}/30</span>
              </div>
              <textarea
                id="batch-keywords"
                name="batch-keywords"
                value={batchInput}
                onChange={(event) => setBatchInput(event.target.value)}
                placeholder="例如：财报分析,AI财报,安全边际"
                autoComplete="off"
                aria-describedby="batch-keywords-help"
                aria-invalid={Boolean(batchInputError)}
                required
              />
              <p id="batch-keywords-help" className={batchInputError ? "input-error" : "input-help"}>
                {batchInputError || "请使用英文逗号 , 分隔；重复关键词会自动合并。"}
              </p>
            </div>
          )}
          <div className="field app-field">
            <label htmlFor="target">目标 App 名称</label>
            <input
              id="target"
              name="target"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              placeholder="例如：不绕得财报"
              autoComplete="off"
              required
            />
          </div>
          <div className="field store-field">
            <label htmlFor="country">App Store 地区</label>
            <select id="country" value={country} onChange={(event) => setCountry(event.target.value)}>
              {STORES.map((store) => <option key={store.code} value={store.code}>{store.label}</option>)}
            </select>
          </div>
          <button className="search-button" type="submit" disabled={loading}>
            {loading ? <><span className="spinner" />正在查询</> : <><span aria-hidden="true">↗</span> {mode === "batch" ? "生成报告" : "查询排名"}</>}
          </button>
        </form>

        <p className="helper">{mode === "batch" ? "最多 30 个关键词 · 英文逗号分隔 · 报告按排名升序" : "无需登录 · 按 iPhone App Store 搜索页顺序 · 实时读取 Apple 公开数据"}</p>

        {/* Search history panel */}
        <div className={`history-zone ${historyOpen ? "open" : ""}`}>
          <button
            className="history-toggle"
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            aria-expanded={historyOpen}
          >
            <span className="history-toggle-label">
              <span className="history-icon" aria-hidden="true">⌘</span>
              搜索历史
            </span>
            <span className="history-count">{filteredHistory.length}</span>
            <span className={`history-chevron ${historyOpen ? "up" : ""}`} aria-hidden="true">▾</span>
          </button>

          {historyOpen && (
            <div className="history-list">
              <div className="history-list-head">
                {filteredHistory.length > 0 ? (
                  <>
                    <span>点击任意记录，快速填入对应关键词和地区</span>
                    <button type="button" className="history-clear" onClick={clearHistory}>清空全部</button>
                  </>
                ) : (
                  <span>暂无{mode === "single" ? "单关键词" : "批量"}搜索记录，查询后自动保存在此</span>
                )}
              </div>
              {filteredHistory.length > 0 ? (
                filteredHistory.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="history-item"
                    onClick={() => applyHistory(item)}
                    title={`关键词：${item.keywords} · 目标：${item.target} · ${item.storeLabel}`}
                  >
                    <div className="history-item-main">
                      <span className="history-keyword">{item.keywords.length > 24 ? item.keywords.slice(0, 24) + "…" : item.keywords}</span>
                      <span className="history-target">{item.target}</span>
                      <span className="history-store">{item.storeLabel}</span>
                    </div>
                    <div className="history-item-meta">
                      {item.rank !== null ? (
                        <span className="history-rank">#{item.rank}</span>
                      ) : (
                        <span className="history-rank empty">—</span>
                      )}
                      <span className="history-time">{dateLabel(item.timestamp)}</span>
                    </div>
                    <button
                      type="button"
                      className="history-item-delete"
                      onClick={(e) => { e.stopPropagation(); removeHistoryItem(item.id); }}
                      aria-label={`删除记录：${item.keywords}`}
                    >
                      ×
                    </button>
                  </button>
                ))
              ) : (
                <div className="history-empty">
                  <span className="history-empty-icon">⌘</span>
                  <p>每次查询后自动保存关键词、目标 App 和地区<br />点击历史记录即可一键复用，无需重复输入</p>
                </div>
              )}
              {filteredHistory.length > 0 && (
                <div className="history-list-foot">
                  <span>共 {filteredHistory.length} 条{mode === "single" ? "单关键词" : "批量"}记录 · 最多保留 30 条</span>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className={`result-zone ${searched || batchReport || error || loading ? "visible" : ""}`} aria-live="polite">
        {loading && (
          <div className="loading-card">
            <div className="scan-line" />
            <span className="spinner dark" />
            <div><strong>{mode === "batch" ? `正在生成 ${batchKeywords.length} 个关键词的报告…` : "正在扫描搜索结果…"}</strong><p>正在等待 {storeLabel} Apple 搜索页返回数据</p></div>
          </div>
        )}

        {error && (
          <div className="error-card" role="alert">
            <span aria-hidden="true">!</span>
            <div><strong>这次没有查到</strong><p>{error}</p></div>
            <button onClick={() => runSearch()}>重新查询</button>
          </div>
        )}

        {batchReport && (
          <div className="batch-report">
            <div className="report-heading">
              <div>
                <span className="result-label">Batch ranking report</span>
                <h2>关键词排名报告</h2>
                <p>目标 App：<strong>{batchReport.targetApp.trackName}</strong> · {storeLabel} App Store</p>
              </div>
              <div className="report-heading-actions">
                <div className="sort-stamp"><span>↑</span> 排名升序</div>
                <button className="download-button" type="button" onClick={downloadPdf} disabled={pdfLoading}>
                  <span aria-hidden="true">↓</span> {pdfLoading ? "正在生成…" : "下载 PDF"}
                </button>
              </div>
            </div>

            <div className="report-summary" aria-label="报告摘要">
              <div><span>关键词数</span><strong>{batchReport.results.length}</strong><small>去重后</small></div>
              <div><span>已找到排名</span><strong>{rankedBatchResults.length}</strong><small>个关键词</small></div>
              <div><span>最佳排名</span><strong>{bestBatchRank ? `#${bestBatchRank}` : "—"}</strong><small>当前结果</small></div>
              <div><span>平均排名</span><strong>{averageBatchRank ? `#${averageBatchRank}` : "—"}</strong><small>仅统计已找到</small></div>
            </div>

            <div className="report-table-wrap">
              <table className="report-table">
                <caption>批量关键词排名，按排名数字升序展示，未找到的关键词位于最后</caption>
                <thead>
                  <tr>
                    <th scope="col">序号</th>
                    <th scope="col">关键词</th>
                    <th scope="col" aria-sort="ascending">当前排名 ↑</th>
                    <th scope="col">扫描结果</th>
                    <th scope="col">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {batchReport.results.map((item, index) => (
                    <tr key={item.keyword} className={item.rank === null ? "unranked" : ""}>
                      <td data-label="序号">{String(index + 1).padStart(2, "0")}</td>
                      <th scope="row" data-label="关键词">{item.keyword}</th>
                      <td data-label="当前排名">
                        {item.rank === null ? <span className="rank-empty">—</span> : <strong className="rank-chip">#{item.rank}</strong>}
                      </td>
                      <td data-label="扫描结果">{item.resultCount ? `${item.resultCount} 条` : "—"}</td>
                      <td data-label="状态">
                        <span className={`status-tag ${item.rank === null ? "missing" : "found"}`}>
                          {item.error || (item.rank === null ? "未进入结果" : "已找到")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="report-foot">
              <span>检查时间 <strong>{checkedAt?.toLocaleString("zh-CN", { hour12: false })}</strong></span>
              <span>排序规则 <strong>数字排名升序，未找到置底</strong></span>
            </div>
          </div>
        )}

        {searched && match && (
          <div className="result-card found-card">
            <div className="result-heading">
              <div>
                <span className="result-label">查询结果</span>
                <h2>找到目标 App</h2>
              </div>
              <span className="checked">刚刚更新</span>
            </div>

            <div className="rank-grid">
              <div className="rank-block">
                <span className="rank-kicker">当前排名</span>
                <div className="rank-number"><small>#</small>{match.rank}</div>
                <p>关键词「{keyword}」<br />{storeLabel} App Store</p>
              </div>
              <div className="app-block">
                {match.app.artworkUrl100 ? (
                  <img src={match.app.artworkUrl100.replace("100x100bb", "200x200bb")} alt={`${match.app.trackName} 图标`} />
                ) : <div className="app-placeholder">APP</div>}
                <div className="app-copy">
                  <h3>{match.app.trackName}</h3>
                  <p>{match.app.artistName}</p>
                  <div className="meta-row">
                    <Rating value={match.app.averageUserRating} count={match.app.userRatingCount} />
                    {match.app.primaryGenreName && <span className="genre">{match.app.primaryGenreName}</span>}
                  </div>
                </div>
                {match.app.trackViewUrl && <a className="store-link" href={match.app.trackViewUrl} target="_blank" rel="noreferrer">查看 App <span>↗</span></a>}
              </div>
            </div>

            <div className="result-foot">
              <span>共扫描 <strong>{resultCount}</strong> 条结果</span>
              <span>检查时间 <strong>{checkedAt?.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</strong></span>
              <span>匹配方式 <strong>App 名称</strong></span>
            </div>
          </div>
        )}

        {searched && !match && (
          <div className="result-card not-found-card">
            <div className="not-found-icon" aria-hidden="true">?</div>
            <div>
              <span className="result-label">未找到目标 App</span>
              <h2>{targetFound ? `当前 ${resultCount} 条结果中未出现&ldquo;${target}&rdquo;` : `没有匹配到&ldquo;${target}&rdquo;`}</h2>
              <p>{targetFound ? "Apple 已识别目标 App，但它没有出现在当前搜索结果范围内。" : "请检查名称是否准确，或尝试目标 App 的完整名称、品牌名。"}</p>
            </div>
          </div>
        )}

        {searched && (
          <div className="single-report-action">
            <div>
              <span className="result-label">PDF report</span>
              <strong>保存本次关键词排名报告</strong>
              <p>包含排名结论、查询信息与前 10 位搜索快照。</p>
            </div>
            <button className="download-button dark" type="button" onClick={downloadPdf} disabled={pdfLoading}>
              <span aria-hidden="true">↓</span> {pdfLoading ? "正在生成…" : "下载 PDF 报告"}
            </button>
          </div>
        )}

        {downloadError && <p className="download-error" role="alert">{downloadError}</p>}

        {searched && results.length > 0 && (
          <div className="top-list">
            <div className="list-heading">
              <div><span className="result-label">搜索快照</span><h2>前 10 位结果</h2></div>
              <span>关键词「{keyword}」</span>
            </div>
            <ol>
              {results.slice(0, 10).map((app, index) => (
                <li key={app.trackId} className={match?.app.trackId === app.trackId ? "is-target" : ""}>
                  <span className="list-rank">{String(index + 1).padStart(2, "0")}</span>
                  {app.artworkUrl100 ? <img src={app.artworkUrl100} alt="" /> : <span className="mini-placeholder" />}
                  <div><strong>{app.trackName}</strong><small>{app.artistName}</small></div>
                  {match?.app.trackId === app.trackId && <span className="target-badge">目标 App</span>}
                  {app.trackViewUrl && <a href={app.trackViewUrl} target="_blank" rel="noreferrer" aria-label={`在 App Store 查看 ${app.trackName}`}>↗</a>}
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>

      <section className="notes">
        <div className="note-number">02</div>
        <div>
          <h2>关于&ldquo;排名&rdquo;的说明</h2>
          <p>本工具按所选地区 Apple iPhone 搜索页返回的结果顺序计算位置，可单独查询，也可一次生成最多 30 个关键词的升序报告。广告、账户个性化、缓存和 Apple 的实时实验仍可能让个别设备看到不同结果；建议在同一地区、同一时间复查。</p>
        </div>
        <div className="note-stamp">PUBLIC DATA<br />NO LOGIN</div>
      </section>

      <footer>
        <span>APP RANK CHECKER</span>
        <p>独立工具，与 Apple Inc. 无关联。</p>
        <span>© 2026</span>
      </footer>
    </main>
  );
}
