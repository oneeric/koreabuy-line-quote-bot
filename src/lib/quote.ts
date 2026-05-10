import { extractProductInfo } from "@/lib/scraper";
import { getQuoteConfig, type QuoteConfig } from "@/lib/settings";

type QuoteInput = {
  url: string;
  manualKrwPrice?: number;
};

type ProductForQuote = {
  title?: string;
  priceKrw: number;
  source: "manual" | "scrape" | "gemini" | "image";
  url?: string;
};

const URL_PATTERN = /https?:\/\/[^\s]+/i;
const MANUAL_PRICE_PATTERNS = [
  /(?:價格|price|金額)[:：\s]*([0-9,]+)\s*(?:krw|韓元|원|₩)?/i,
  /([0-9,]+)\s*(?:krw|韓元|원|₩)/i,
];

export async function buildQuoteReply(message: string) {
  const input = parseQuoteInput(message);
  if (!input) {
    return [
      "請貼商品連結或商品截圖給我，我會幫你估算台幣報價。",
      "如果你已經知道韓元價格，也可以這樣傳：",
      "價格 59000 https://商品連結",
    ].join("\n");
  }

  const config = await getQuoteConfig();
  const product = input.manualKrwPrice
    ? {
        title: "客戶提供商品",
        priceKrw: input.manualKrwPrice,
        source: "manual" as const,
      }
    : await extractProductInfo(input.url);

  if (!product.priceKrw) {
    return [
      "我暫時抓不到這個商品的價格，可能是網站擋爬蟲或價格需要登入/選規格才顯示。",
      "請改傳：價格 59000 https://商品連結",
    ].join("\n");
  }

  return renderQuoteReply(
    {
      title: product.title,
      priceKrw: product.priceKrw,
      source: product.source,
      url: input.url,
    },
    config,
  );
}

export async function buildImageQuoteReply(image: Buffer, mimeType: string) {
  const config = await getQuoteConfig();
  const product = await extractImageProductInfo(image, mimeType);

  if (!product.priceKrw) {
    return [
      "我暫時無法從截圖判讀韓元價格。",
      "請截到商品名稱與價格，或直接傳：價格 59000 https://商品連結",
    ].join("\n");
  }

  return renderQuoteReply(
    {
      title: product.title || "截圖商品",
      priceKrw: product.priceKrw,
      source: "image",
    },
    config,
  );
}

function renderQuoteReply(product: ProductForQuote, config: QuoteConfig) {
  const quote = calculateQuote(product.priceKrw, config);
  const sourceLabel = getSourceLabel(product.source);
  const lines = [
    `${config.shopName} 報價`,
    "",
    `商品：${product.title || "商品"}`,
  ];

  if (product.url) {
    lines.push(`連結：${product.url}`);
  }

  return [
    ...lines,
    `韓幣售價：₩${formatNumber(product.priceKrw)}（${sourceLabel}）`,
    `匯率：1 KRW = ${config.krwToTwdRate} TWD`,
    "",
    `商品台幣：約 NT$${formatNumber(quote.itemTwd)}`,
    `代購費：NT$${formatNumber(quote.serviceFeeTwd)}`,
    `預估運費：NT$${formatNumber(quote.shippingTwd)}`,
    `合計：NT$${formatNumber(quote.totalTwd)}`,
    "",
    "購買須知",
    config.noticeText,
    "",
    "匯款資訊",
    config.bankInfo,
  ].join("\n");
}

function parseQuoteInput(message: string): QuoteInput | null {
  const url = message.match(URL_PATTERN)?.[0];
  if (!url) return null;

  const manualKrwPrice = MANUAL_PRICE_PATTERNS.map((pattern) => message.match(pattern)?.[1])
    .filter(Boolean)
    .map((value) => Number(value?.replaceAll(",", "")))
    .find((value) => Number.isFinite(value) && value > 0);

  return {
    url,
    manualKrwPrice,
  };
}

function calculateQuote(priceKrw: number, config: QuoteConfig) {
  const itemTwd = Math.ceil(priceKrw * config.krwToTwdRate);
  const serviceFeeTwd = Math.ceil(itemTwd * config.agencyFeeRate);
  const shippingTwd = Math.ceil(config.defaultShippingTwd);
  const totalTwd = itemTwd + serviceFeeTwd + shippingTwd;

  return {
    itemTwd,
    serviceFeeTwd,
    shippingTwd,
    totalTwd,
  };
}

function getSourceLabel(source: ProductForQuote["source"]) {
  if (source === "manual") return "手動提供";
  if (source === "image") return "截圖判讀";
  return "自動擷取";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-TW").format(value);
}

async function extractImageProductInfo(image: Buffer, mimeType: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return {};

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: [
                  "你是韓國電商截圖價格辨識器。請只回 JSON，不要 Markdown。",
                  "請從圖片中找商品名稱與韓元售價。只接受 KRW/₩/원 的商品價格。",
                  "不要把折扣率、評價數、運費、點數、數量、台幣換算當作商品售價。",
                  "若看不到明確韓元商品售價，priceKrw 為 null。",
                  "{\"title\":\"商品名稱或空字串\",\"priceKrw\":59000}",
                ].join("\n"),
              },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: image.toString("base64"),
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
      signal: controller.signal,
    },
  );
  clearTimeout(timeout);

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
