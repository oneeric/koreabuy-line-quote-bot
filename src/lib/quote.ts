import { extractProductInfo } from "@/lib/scraper";

type QuoteInput = {
  url: string;
  manualKrwPrice?: number;
};

type QuoteConfig = {
  krwToTwdRate: number;
  agencyFeeRate: number;
  defaultShippingTwd: number;
  shopName: string;
  bankInfo: string;
  noticeText: string;
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

  const config = getQuoteConfig();
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

function getQuoteConfig(): QuoteConfig {
  return {
    krwToTwdRate: readNumberEnv("KRW_TO_TWD_RATE", 0.025),
    agencyFeeRate: readNumberEnv("AGENCY_FEE_RATE", 0.15),
    defaultShippingTwd: readNumberEnv("DEFAULT_SHIPPING_TWD", 200),
    shopName: process.env.SHOP_NAME || "韓國代購",
    bankInfo: process.env.BANK_INFO || "請私訊取得匯款資訊",
    noticeText:
      process.env.NOTICE_TEXT ||
      "報價為預估金額，實際以付款當下匯率、商品庫存與韓國境內運費為準。下單後不接受取消，缺貨會全額退款。",
  };
}

function readNumberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
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
