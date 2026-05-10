type ProductInfo = {
  title?: string;
  priceKrw?: number;
  source: "scrape" | "gemini" | "manual";
};

const PRICE_PATTERNS = [
  /(?:₩|KRW)\s*([0-9][0-9,]{2,})/i,
  /([0-9][0-9,]{2,})\s*(?:원|韓元|krw)/i,
  /"price"\s*:\s*"?([0-9][0-9,]{2,})"?/i,
  /property=["']product:price:amount["']\s+content=["']([0-9][0-9,]{2,})["']/i,
];

export async function extractProductInfo(url: string): Promise<ProductInfo> {
  try {
    const html = await fetchProductHtml(url);
    const title = extractTitle(html);
    const priceKrw = extractPriceFromHtml(html);

    if (priceKrw) {
      return { title, priceKrw, source: "scrape" };
    }

    const geminiInfo = await extractWithGemini(url, html);
    return {
      title: geminiInfo.title || title,
      priceKrw: geminiInfo.priceKrw,
      source: "gemini",
    };
  } catch {
    return { source: "scrape" };
  }
}

async function fetchProductHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ko-KR,ko;q=0.9,zh-TW;q=0.8,en;q=0.7",
    },
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`Fetch failed: ${response.status}`);
  }

  return response.text();
}

function extractTitle(html: string) {
  return (
    readMetaContent(html, "og:title") ||
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim()
  );
}

function extractPriceFromHtml(html: string) {
  const metaPrice =
    readMetaContent(html, "product:price:amount") ||
    readMetaContent(html, "og:price:amount");

  const fromMeta = parseKrwPrice(metaPrice);
  if (fromMeta) return fromMeta;

  for (const pattern of PRICE_PATTERNS) {
    const value = parseKrwPrice(html.match(pattern)?.[1]);
    if (value) return value;
  }
}

function readMetaContent(html: string, property: string) {
  const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escapedProperty}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i",
  );
  return html.match(pattern)?.[1]?.trim();
}

function parseKrwPrice(value?: string) {
  if (!value) return undefined;
  const parsed = Number(value.replaceAll(",", "").match(/[0-9]+/)?.[0]);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}

async function extractWithGemini(url: string, html: string): Promise<Partial<ProductInfo>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return {};

  const compactText = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 60000);

  const prompt = [
    "你是韓國電商商品頁解析器。請只回 JSON，不要 Markdown。",
    "從商品頁文字中找出商品名稱與韓元售價。若找不到售價，priceKrw 為 null。",
    '格式：{"title":"商品名稱或空字串","priceKrw":59000}',
    `URL: ${url}`,
    `PAGE_TEXT: ${compactText}`,
  ].join("\n");

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) return {};

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return {};

  try {
    const json = JSON.parse(text) as { title?: string; priceKrw?: number | null };
    return {
      title: json.title,
      priceKrw: json.priceKrw ?? undefined,
    };
  } catch {
    return {};
  }
}
