export const dynamic = "force-dynamic";

const feeds = [
  { name: "Google Ads", url: "https://blog.google/products/ads-commerce/rss/" },
  { name: "Microsoft Advertising", url: "https://about.ads.microsoft.com/en/blog/rss" },
  { name: "Microsoft Clarity", url: "https://clarity.microsoft.com/blog/feed/" }
];

type Article = { title: string; summary: string; source: string; url: string; sourceDate: string };
type FeedResult = {
  items: Article[];
  sources: { name: string; ok: boolean }[];
  fetchedAt: string;
};
let cache: { expires: number; payload: FeedResult } | undefined;

const entities: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", apos: "'", quot: '"', nbsp: " ",
  ndash: "–", mdash: "—", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“"
};

function decode(value: string) {
  return value.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (original, entity: string) => {
    if (!entity.startsWith("#")) return entities[entity] ?? original;
    const hexadecimal = entity[1].toLowerCase() === "x";
    const code = parseInt(entity.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
  });
}

function field(item: string, tag: string) {
  const value = item.match(new RegExp("<" + tag + ">([\\s\\S]*?)</" + tag + ">", "i"))?.[1] ?? "";
  return decode(value.trim().replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1"));
}

function plain(value: string) {
  return decode(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function articles(xml: string, feed: { name: string; url: string }, now: number) {
  if (!/<rss[\s>]/i.test(xml) || !/<\/channel>/i.test(xml)) throw Error("Formato de feed inválido");
  const items = new Map<string, Article>();
  const origin = new URL(feed.url).origin;
  const day = 86400000;
  for (const snippet of xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) ?? []) {
    const link = field(snippet, "link");
    if (!URL.canParse(link)) continue;
    const address = new URL(link);
    if (address.origin !== origin || address.username || address.password) continue;
    const timestamp = Date.parse(field(snippet, "pubDate"));
    if (!Number.isFinite(timestamp) || timestamp > now + day || timestamp < now - 120 * day) continue;
    const title = plain(field(snippet, "title")).slice(0, 240);
    if (!title) continue;
    const description = field(snippet, "description").replace(/<p>\s*The post <a[\s\S]*$/i, "");
    const summary = plain(description);
    address.hash = "";
    items.set(address.href, {
      title, summary: summary.length > 200 ? summary.slice(0, 197).replace(/\s+\S*$/, "") + "…" : summary,
      source: feed.name, url: address.href, sourceDate: new Date(timestamp).toISOString().slice(0, 10)
    });
  }
  return [...items.values()].sort((a, b) => b.sourceDate.localeCompare(a.sourceDate)).slice(0, 6);
}

async function readFeed(feed: { name: string; url: string }, now: number) {
  const response = await fetch(feed.url, {
    redirect: "error", headers: { Accept: "application/rss+xml, application/xml, text/xml" },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok || !response.body) throw Error("Fonte indisponível");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let xml = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    if (bytes > 1500000) {
      await reader.cancel();
      throw Error("Feed excedeu o limite de tamanho");
    }
    xml += decoder.decode(value, { stream: true });
  }
  return articles(xml + decoder.decode(), feed, now);
}

export async function GET() {
  const now = Date.now();
  if (!cache || cache.expires <= now) {
    const results = await Promise.allSettled(feeds.map(feed => readFeed(feed, now)));
    const sources = results.map((result, i) => ({ name: feeds[i].name, ok: result.status === "fulfilled" }));
    const items = results.flatMap(result => result.status === "fulfilled" ? result.value : []);
    const payload = {
      sources, items: items.sort((a, b) => b.sourceDate.localeCompare(a.sourceDate)),
      fetchedAt: new Date(now).toISOString()
    };
    cache = { payload, expires: now + (sources.every(source => source.ok) ? 10 * 60000 : 30000) };
  }
  return Response.json(cache.payload, { headers: { "Cache-Control": "private, no-cache" } });
}
