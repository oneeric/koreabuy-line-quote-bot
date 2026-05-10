import { extractProductInfo } from "@/lib/scraper";
import { getQuoteConfig, type QuoteConfig } from "@/lib/settings";

type QuoteInput = {
  url: string;
  manualKrwPrice?: number;
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
      "請貼商品連結給我，我會幫你估算台幣報價。",
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

  const quote = calculateQuote(product.priceKrw, config);
  const sourceLabel = product.source === "manual" ? "手動提供" : "自動擷取";

  return [
    `${config.shopName} 報價`,
    "",
    `商品：${product.title || "商品連結"}`,
    `連結：${input.url}`,
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

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-TW").format(value);
}
