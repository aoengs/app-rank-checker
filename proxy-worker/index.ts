export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const target = url.searchParams.get("url") ?? "";
    if (!target) return new Response("missing ?url=", { status: 400 });

    // Only allow apps.apple.com
    if (!target.startsWith("https://apps.apple.com/"))
      return new Response("only apps.apple.com", { status: 403 });

    const country = url.searchParams.get("country") ?? "cn";

    const res = await fetch(target, {
      headers: {
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language":
          country === "cn" ? "zh-CN,zh;q=0.9" : "en-US,en;q=0.8",
        "user-agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
      },
    });

    return new Response(res.body, {
      status: res.status,
      headers: {
        "access-control-allow-origin": "*",
        "content-type":
          res.headers.get("content-type") ?? "text/html; charset=utf-8",
      },
    });
  },
};
