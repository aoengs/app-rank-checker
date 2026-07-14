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

export const SUPPORTED_STORES = new Set([
  "cn",
  "hk",
  "tw",
  "us",
  "jp",
  "sg",
  "gb",
]);

const ITUNES_API = "https://itunes.apple.com/search";

const normalize = (value: string) =>
  value.toLocaleLowerCase().replace(/[\s·・:：—_\-–]/g, "");

function toAppResult(raw: Record<string, unknown>): AppResult | null {
  const trackId = raw.trackId as number | undefined;
  const trackName = raw.trackName as string | undefined;
  if (!trackId || !trackName) return null;
  return {
    trackId,
    trackName,
    artistName: (raw.artistName as string) ?? "Apple App Store",
    artworkUrl100: raw.artworkUrl100 as string | undefined,
    trackViewUrl: raw.trackViewUrl as string | undefined,
    averageUserRating: raw.averageUserRating as number | undefined,
    userRatingCount: raw.userRatingCount as number | undefined,
    primaryGenreName: raw.primaryGenreName as string | undefined,
  };
}

export async function resolveTargetApp(
  target: string,
  country: string,
): Promise<AppResult | null> {
  const url = `${ITUNES_API}?term=${encodeURIComponent(target)}&country=${country}&entity=software&limit=10`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Apple 搜索服务暂时不可用（${response.status}）。`);
  }
  const data = await response.json();
  const results: Record<string, unknown>[] = data.results ?? [];
  const expected = normalize(target);

  const match =
    results.find((r) => normalize(String(r.trackName ?? "")) === expected) ??
    results.find((r) =>
      normalize(String(r.trackName ?? "")).startsWith(expected),
    ) ??
    results.find((r) =>
      normalize(String(r.trackName ?? "")).includes(expected),
    ) ??
    null;

  return match ? toAppResult(match) : null;
}

export async function searchKeyword(
  term: string,
  country: string,
  targetId: number | null,
) {
  const url = `${ITUNES_API}?term=${encodeURIComponent(term)}&country=${country}&entity=software&limit=200`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Apple 搜索服务暂时不可用（${response.status}）。`);
  }
  const data = await response.json();
  const results: Record<string, unknown>[] = data.results ?? [];

  const index =
    targetId === null
      ? -1
      : results.findIndex((r) => String(r.trackId) === String(targetId));

  const appResults = results
    .map(toAppResult)
    .filter((app): app is AppResult => Boolean(app))
    .slice(0, 10);

  return {
    resultCount: (data.resultCount as number) ?? results.length,
    rank: index >= 0 ? index + 1 : null,
    results: appResults,
  };
}
