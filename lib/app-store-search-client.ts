export type AppResult = {
  trackId: number;
  trackName: string;
  artistName: string;
  artworkUrl100?: string;
  trackViewUrl?: string;
  averageUserRating?: number;
  userRatingCount?: number;
  primaryGenreName?: string;
};

type StorefrontItem = {
  lockup?: {
    adamId?: string;
    title?: string;
    developerName?: string;
    rating?: number;
    ratingCount?: number | string;
    icon?: {
      template?: string;
      crop?: string;
      variants?: Array<{ format?: string }>;
    };
    clickAction?: { pageUrl?: string };
  };
};

type StorefrontPage = {
  data?: Array<{
    data?: {
      shelves?: Array<{ items?: StorefrontItem[] }>;
      nextPage?: { results?: Array<{ id?: string; type?: string }> };
    };
  }>;
};

export const SUPPORTED_STORES = new Set([
  "cn", "hk", "tw", "us", "jp", "sg", "gb",
]);

const normalize = (value: string) =>
  value.toLocaleLowerCase().replace(/[\s·・:：—_\-–]/g, "");

function parseRatingCount(value: number | string | undefined) {
  if (typeof value === "number") return value;
  if (!value) return undefined;
  const amount = Number.parseFloat(value.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(amount)) return undefined;
  if (value.includes("万")) return Math.round(amount * 10_000);
  if (value.toLocaleLowerCase().includes("k")) return Math.round(amount * 1_000);
  return Math.round(amount);
}

function toAppResult(item: StorefrontItem): AppResult | null {
  const lockup = item.lockup;
  if (!lockup?.adamId || !lockup.title) return null;
  const fmt = lockup.icon?.variants?.[0]?.format === "webp" ? "webp" : "jpg";
  const artworkUrl100 = lockup.icon?.template
    ?.replace("{w}", "100")
    .replace("{h}", "100")
    .replace("{c}", lockup.icon.crop ?? "bb")
    .replace("{f}", fmt);

  return {
    trackId: Number(lockup.adamId),
    trackName: lockup.title,
    artistName: lockup.developerName ?? "Apple App Store",
    artworkUrl100,
    trackViewUrl: lockup.clickAction?.pageUrl,
    averageUserRating: lockup.rating,
    userRatingCount: parseRatingCount(lockup.ratingCount),
  };
}

function parseStorefrontOrder(html: string) {
  const match = html.match(
    /<script[^>]*id=["']serialized-server-data["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!match) throw new Error("Apple 搜索页格式暂时无法识别，请稍后重试。");

  const payload = JSON.parse(match[1]) as StorefrontPage;
  const page = payload.data?.find((entry) => entry.data?.shelves)?.data;
  if (!page) throw new Error("Apple 搜索页没有返回可用结果。");

  const initialItems = (page.shelves ?? []).flatMap((shelf) => shelf.items ?? []);
  const initialIds = initialItems.map((item) => item.lockup?.adamId ?? "");
  const remainingIds = (page.nextPage?.results ?? []).map((r) => r.id ?? "");

  return {
    ids: [...initialIds, ...remainingIds].filter(Boolean),
    initialItems,
  };
}

// CORS proxy: browser can't fetch apps.apple.com directly
function proxyUrl(target: string) {
  return `https://corsproxy.io/?${encodeURIComponent(target)}`;
}

async function fetchStorefront(term: string, country: string) {
  const url = `https://apps.apple.com/${country}/iphone/search?term=${encodeURIComponent(term)}`;
  const response = await fetch(proxyUrl(url), {
    headers: {
      "x-cors-headers": JSON.stringify({
        "accept-language": country === "cn" ? "zh-CN,zh;q=0.9" : "en-US,en;q=0.8",
        "user-agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
      }),
    },
  });

  if (!response.ok) {
    throw new Error(`Apple 搜索服务暂时不可用（${response.status}）。`);
  }
  return parseStorefrontOrder(await response.text());
}

export async function resolveTargetApp(
  target: string,
  country: string,
): Promise<AppResult | null> {
  const storefront = await fetchStorefront(target, country);
  const candidates = storefront.initialItems
    .map(toAppResult)
    .filter((app): app is AppResult => Boolean(app));
  const expected = normalize(target);

  return (
    candidates.find((app) => normalize(app.trackName) === expected) ??
    candidates.find((app) => normalize(app.trackName).startsWith(expected)) ??
    candidates.find((app) => normalize(app.trackName).includes(expected)) ??
    null
  );
}

export async function searchKeyword(
  term: string,
  country: string,
  targetId: number | null,
) {
  const storefront = await fetchStorefront(term, country);
  const index =
    targetId === null
      ? -1
      : storefront.ids.findIndex((id) => id === String(targetId));
  const results = storefront.initialItems
    .map(toAppResult)
    .filter((app): app is AppResult => Boolean(app))
    .slice(0, 10);

  return {
    resultCount: storefront.ids.length,
    rank: index >= 0 ? index + 1 : null,
    results,
  };
}
