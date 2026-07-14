const WIDTH = 1240;
const HEIGHT = 1754;
const MARGIN = 72;
const INK = "#11100e";
const PAPER = "#f2efe8";
const WHITE = "#ffffff";
const MUTED = "#6c6962";
const LINE = "#d3cfc6";
const ACCENT = "#f05423";
const GREEN = "#1c7443";
const FONT = '"PingFang SC", "Microsoft YaHei", Arial, sans-serif';

function browserCanvasFactory(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function setFont(ctx, size, weight = 500, color = INK, align = "left") {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
}

function fitText(ctx, value, maxWidth) {
  const text = String(value);
  if (ctx.measureText(text).width <= maxWidth) return text;
  let output = text;
  while (output.length > 1 && ctx.measureText(`${output}…`).width > maxWidth) {
    output = output.slice(0, -1);
  }
  return `${output}…`;
}

function line(ctx, x1, y1, x2, y2, color = INK, width = 1) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function createPage(canvasFactory) {
  const canvas = canvasFactory(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = "rgba(17,16,14,.045)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= WIDTH; x += 40) line(ctx, x, 0, x, HEIGHT, "rgba(17,16,14,.045)");
  for (let y = 0; y <= HEIGHT; y += 40) line(ctx, 0, y, WIDTH, y, "rgba(17,16,14,.045)");
  return { canvas, ctx };
}

function drawHeader(ctx, pageNumber, pageCount) {
  ctx.fillStyle = INK;
  ctx.fillRect(MARGIN, 58, 48, 48);
  setFont(ctx, 25, 800, WHITE, "center");
  ctx.fillText("R", MARGIN + 24, 91);
  setFont(ctx, 22, 760);
  ctx.fillText("App 排名侦测站", MARGIN + 66, 90);
  setFont(ctx, 13, 650, MUTED, "right");
  ctx.fillText(`APP STORE RANKING REPORT  ·  ${pageNumber}/${pageCount}`, WIDTH - MARGIN, 88);
  line(ctx, MARGIN, 128, WIDTH - MARGIN, 128, INK, 2);
}

function drawFooter(ctx, checkedAt, pageNumber, pageCount) {
  line(ctx, MARGIN, 1645, WIDTH - MARGIN, 1645, INK, 1);
  setFont(ctx, 13, 550, MUTED);
  ctx.fillText(`生成时间：${formatDate(checkedAt)}`, MARGIN, 1683);
  setFont(ctx, 12, 550, MUTED, "right");
  ctx.fillText(`数据来自 Apple 公开搜索页  ·  第 ${pageNumber}/${pageCount} 页`, WIDTH - MARGIN, 1683);
  setFont(ctx, 11, 500, MUTED);
  ctx.fillText("说明：排名可能受广告、账户个性化、缓存及 Apple 实时实验影响。", MARGIN, 1714);
}

function formatDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString("zh-CN", { hour12: false });
}

function safeFilePart(value) {
  return String(value).replace(/[\\/:*?"<>|]/g, "-").slice(0, 40) || "report";
}

function dateStamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("");
}

function drawSummaryCard(ctx, x, y, width, label, value, note) {
  ctx.fillStyle = WHITE;
  ctx.fillRect(x, y, width, 132);
  ctx.strokeStyle = INK;
  ctx.strokeRect(x, y, width, 132);
  setFont(ctx, 13, 650, MUTED);
  ctx.fillText(label, x + 22, y + 34);
  setFont(ctx, 38, 820, INK);
  ctx.fillText(value, x + 22, y + 82);
  setFont(ctx, 11, 550, MUTED);
  ctx.fillText(note, x + 22, y + 108);
}

/**
 * @param {{keyword:string,target:string,storeLabel:string,rank:number|null,resultCount:number,checkedAt:Date|string,results:Array<{trackName:string,artistName:string}>,targetFound:boolean}} data
 * @param {(width:number,height:number)=>any} [canvasFactory]
 */
export function renderSingleReportPages(data, canvasFactory = browserCanvasFactory) {
  const { canvas, ctx } = createPage(canvasFactory);
  drawHeader(ctx, 1, 1);

  setFont(ctx, 15, 700, ACCENT);
  ctx.fillText("SINGLE KEYWORD REPORT", MARGIN, 180);
  setFont(ctx, 55, 850);
  ctx.fillText("单关键词排名报告", MARGIN, 245);
  setFont(ctx, 17, 550, MUTED);
  ctx.fillText(`关键词「${fitText(ctx, data.keyword, 430)}」  ·  ${data.storeLabel} App Store`, MARGIN, 289);

  const cardY = 340;
  ctx.fillStyle = ACCENT;
  ctx.fillRect(MARGIN, cardY, 405, 360);
  setFont(ctx, 14, 700, WHITE);
  ctx.fillText("当前排名", MARGIN + 34, cardY + 48);
  if (data.rank !== null) {
    setFont(ctx, 190, 880, WHITE);
    ctx.fillText(`#${data.rank}`, MARGIN + 27, cardY + 245);
    setFont(ctx, 14, 650, WHITE);
    ctx.fillText("已进入当前 Apple 搜索结果", MARGIN + 34, cardY + 314);
  } else {
    setFont(ctx, 46, 820, WHITE);
    ctx.fillText("未进入结果", MARGIN + 34, cardY + 185);
    setFont(ctx, 14, 650, WHITE);
    ctx.fillText(data.targetFound ? "Apple 已识别目标 App" : "未能匹配目标 App", MARGIN + 34, cardY + 235);
  }

  const detailX = MARGIN + 405;
  const detailWidth = WIDTH - MARGIN - detailX;
  ctx.fillStyle = WHITE;
  ctx.fillRect(detailX, cardY, detailWidth, 360);
  ctx.strokeStyle = INK;
  ctx.strokeRect(detailX, cardY, detailWidth, 360);
  setFont(ctx, 13, 650, MUTED);
  ctx.fillText("目标 App", detailX + 38, cardY + 50);
  setFont(ctx, 29, 780);
  ctx.fillText(fitText(ctx, data.target, detailWidth - 76), detailX + 38, cardY + 94);
  line(ctx, detailX + 38, cardY + 128, WIDTH - MARGIN - 38, cardY + 128, LINE);
  setFont(ctx, 13, 650, MUTED);
  ctx.fillText("扫描结果", detailX + 38, cardY + 178);
  setFont(ctx, 31, 800);
  ctx.fillText(`${data.resultCount} 条`, detailX + 38, cardY + 220);
  setFont(ctx, 13, 650, MUTED);
  ctx.fillText("检查时间", detailX + 280, cardY + 178);
  setFont(ctx, 18, 700);
  ctx.fillText(formatDate(data.checkedAt), detailX + 280, cardY + 220);
  setFont(ctx, 12, 550, MUTED);
  ctx.fillText("匹配方式：App 名称", detailX + 38, cardY + 302);

  setFont(ctx, 15, 700, ACCENT);
  ctx.fillText("SEARCH SNAPSHOT", MARGIN, 780);
  setFont(ctx, 34, 820);
  ctx.fillText("前 10 位搜索快照", MARGIN, 829);
  const tableY = 865;
  ctx.fillStyle = INK;
  ctx.fillRect(MARGIN, tableY, WIDTH - MARGIN * 2, 48);
  setFont(ctx, 12, 650, WHITE);
  ctx.fillText("排名", MARGIN + 18, tableY + 31);
  ctx.fillText("App 名称", MARGIN + 108, tableY + 31);
  ctx.fillText("开发者", MARGIN + 690, tableY + 31);

  const snapshot = data.results.slice(0, 10);
  if (snapshot.length === 0) {
    ctx.fillStyle = WHITE;
    ctx.fillRect(MARGIN, tableY + 48, WIDTH - MARGIN * 2, 84);
    setFont(ctx, 15, 550, MUTED);
    ctx.fillText("当前没有可展示的搜索快照。", MARGIN + 20, tableY + 99);
  }
  snapshot.forEach((app, index) => {
    const y = tableY + 48 + index * 62;
    ctx.fillStyle = index % 2 === 0 ? WHITE : "#f8f6f1";
    ctx.fillRect(MARGIN, y, WIDTH - MARGIN * 2, 62);
    line(ctx, MARGIN, y + 62, WIDTH - MARGIN, y + 62, LINE);
    setFont(ctx, 13, 700, MUTED);
    ctx.fillText(String(index + 1).padStart(2, "0"), MARGIN + 18, y + 39);
    setFont(ctx, 16, 700);
    ctx.fillText(fitText(ctx, app.trackName, 530), MARGIN + 108, y + 39);
    setFont(ctx, 13, 550, MUTED);
    ctx.fillText(fitText(ctx, app.artistName, 365), MARGIN + 690, y + 39);
  });

  drawFooter(ctx, data.checkedAt, 1, 1);
  return [canvas];
}

/**
 * @param {{targetApp:string,storeLabel:string,checkedAt:Date|string,results:Array<{keyword:string,rank:number|null,resultCount:number,error?:string}>}} data
 * @param {(width:number,height:number)=>any} [canvasFactory]
 */
export function renderBatchReportPages(data, canvasFactory = browserCanvasFactory) {
  // Batch input is capped at 30 keywords in the UI. Keeping those rows on one
  // adaptive A4 page makes the report easier to compare and avoids WebKit's
  // multi-canvas corruption on memory-constrained browsers.
  const rowsPerPage = 30;
  const chunks = [];
  for (let index = 0; index < data.results.length; index += rowsPerPage) {
    chunks.push(data.results.slice(index, index + rowsPerPage));
  }
  const ranked = data.results.filter((item) => item.rank !== null);
  const best = ranked[0]?.rank ?? null;
  const average = ranked.length
    ? Math.round(ranked.reduce((sum, item) => sum + item.rank, 0) / ranked.length)
    : null;

  return chunks.map((rows, pageIndex) => {
    const { canvas, ctx } = createPage(canvasFactory);
    drawHeader(ctx, pageIndex + 1, chunks.length);
    setFont(ctx, 15, 700, ACCENT);
    ctx.fillText("BATCH KEYWORD REPORT", MARGIN, 180);
    setFont(ctx, 52, 850);
    ctx.fillText(pageIndex === 0 ? "关键词排名报告" : "关键词排名报告（续）", MARGIN, 242);
    setFont(ctx, 16, 550, MUTED);
    ctx.fillText(`目标 App：${fitText(ctx, data.targetApp, 630)}  ·  ${data.storeLabel} App Store`, MARGIN, 286);
    setFont(ctx, 13, 700, ACCENT, "right");
    ctx.fillText("↑ 排名数字升序 · 未找到置底", WIDTH - MARGIN, 284);

    const gap = 12;
    const cardWidth = (WIDTH - MARGIN * 2 - gap * 3) / 4;
    drawSummaryCard(ctx, MARGIN, 326, cardWidth, "关键词数", String(data.results.length), "去重后");
    drawSummaryCard(ctx, MARGIN + (cardWidth + gap), 326, cardWidth, "已找到排名", String(ranked.length), "个关键词");
    drawSummaryCard(ctx, MARGIN + (cardWidth + gap) * 2, 326, cardWidth, "最佳排名", best ? `#${best}` : "—", "当前结果");
    drawSummaryCard(ctx, MARGIN + (cardWidth + gap) * 3, 326, cardWidth, "平均排名", average ? `#${average}` : "—", "仅统计已找到");

    const tableY = 510;
    const widths = [80, 430, 170, 190, 226];
    const labels = ["序号", "关键词", "当前排名 ↑", "扫描结果", "状态"];
    let x = MARGIN;
    ctx.fillStyle = INK;
    ctx.fillRect(MARGIN, tableY, WIDTH - MARGIN * 2, 52);
    labels.forEach((label, index) => {
      setFont(ctx, 12, 650, WHITE);
      ctx.fillText(label, x + 15, tableY + 34);
      x += widths[index];
    });

    const rowHeight = Math.min(58, Math.floor((1620 - (tableY + 52)) / Math.max(rows.length, 1)));
    const textOffset = Math.min(36, rowHeight - 10);
    rows.forEach((item, rowIndex) => {
      const absoluteIndex = pageIndex * rowsPerPage + rowIndex;
      const y = tableY + 52 + rowIndex * rowHeight;
      ctx.fillStyle = item.rank === null ? "#ebe8e1" : rowIndex % 2 === 0 ? WHITE : "#f8f6f1";
      ctx.fillRect(MARGIN, y, WIDTH - MARGIN * 2, rowHeight);
      line(ctx, MARGIN, y + rowHeight, WIDTH - MARGIN, y + rowHeight, LINE);
      setFont(ctx, rowHeight < 44 ? 10 : 12, 700, MUTED);
      ctx.fillText(String(absoluteIndex + 1).padStart(2, "0"), MARGIN + 15, y + textOffset);
      setFont(ctx, rowHeight < 44 ? 13 : 15, 720, item.rank === null ? MUTED : INK);
      ctx.fillText(fitText(ctx, item.keyword, widths[1] - 30), MARGIN + widths[0] + 15, y + textOffset);
      setFont(ctx, rowHeight < 44 ? 14 : 16, 820, item.rank === null ? MUTED : ACCENT);
      ctx.fillText(item.rank === null ? "—" : `#${item.rank}`, MARGIN + widths[0] + widths[1] + 15, y + textOffset);
      setFont(ctx, rowHeight < 44 ? 11 : 13, 600, MUTED);
      ctx.fillText(item.resultCount ? `${item.resultCount} 条` : "—", MARGIN + widths[0] + widths[1] + widths[2] + 15, y + textOffset);
      setFont(ctx, rowHeight < 44 ? 10 : 12, 700, item.rank === null ? MUTED : GREEN);
      ctx.fillText(item.error || (item.rank === null ? "未进入结果" : "已找到"), WIDTH - MARGIN - widths[4] + 15, y + textOffset);
    });

    drawFooter(ctx, data.checkedAt, pageIndex + 1, chunks.length);
    return canvas;
  });
}

export async function createPdfDocument(canvases) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: false });
  canvases.forEach((canvas, index) => {
    if (index > 0) pdf.addPage("a4", "portrait");
    // Avoid jsPDF's fast image compressor here: WebKit can produce corrupted later
    // pages when multiple large canvases are compressed into one PDF.
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 210, 297, `report-page-${index}`, "NONE");
  });
  return pdf;
}

export async function downloadSingleRankReport(data) {
  await document.fonts?.ready;
  const pdf = await createPdfDocument(renderSingleReportPages(data));
  pdf.save(`App排名报告-${safeFilePart(data.keyword)}-${dateStamp(data.checkedAt)}.pdf`);
}

export async function downloadBatchRankReport(data) {
  await document.fonts?.ready;
  const pdf = await createPdfDocument(renderBatchReportPages(data));
  pdf.save(`App批量排名报告-${dateStamp(data.checkedAt)}.pdf`);
}
