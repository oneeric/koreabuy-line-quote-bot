export type QuoteConfig = {
  krwToTwdRate: number;
  agencyFeeRate: number;
  defaultShippingTwd: number;
  shopName: string;
  bankInfo: string;
  noticeText: string;
};

const SETTINGS_KEY = "koreabuy:quote-settings";

export async function getQuoteConfig(): Promise<QuoteConfig> {
  const stored = await readStoredSettings();
  return {
    ...getDefaultQuoteConfig(),
    ...stored,
  };
}

export function getDefaultQuoteConfig(): QuoteConfig {
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

export async function saveQuoteConfig(input: QuoteConfig) {
  const config = normalizeQuoteConfig(input);
  await redisCommand(["SET", SETTINGS_KEY, JSON.stringify(config)]);
  return config;
}

export function normalizeQuoteConfig(input: QuoteConfig): QuoteConfig {
  return {
    krwToTwdRate: ensurePositiveNumber(input.krwToTwdRate, "匯率"),
    agencyFeeRate: ensureNonNegativeNumber(input.agencyFeeRate, "代購費"),
    defaultShippingTwd: ensureNonNegativeNumber(input.defaultShippingTwd, "運費"),
    shopName: ensureText(input.shopName, "店名"),
    bankInfo: ensureText(input.bankInfo, "匯款資訊"),
    noticeText: ensureText(input.noticeText, "購買須知"),
  };
}

export function hasWritableSettingsStore() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function readStoredSettings(): Promise<Partial<QuoteConfig>> {
  if (!hasWritableSettingsStore()) return {};

  const stored = await redisCommand<string | null>(["GET", SETTINGS_KEY]);
  if (!stored) return {};

  try {
    return normalizeQuoteConfig(JSON.parse(stored) as QuoteConfig);
  } catch {
    return {};
  }
}

async function redisCommand<T = unknown>(command: Array<string | number>) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error("Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Settings store failed: ${response.status} ${await response.text()}`);
  }

  const payload = (await response.json()) as { result?: T; error?: string };
  if (payload.error) {
    throw new Error(payload.error);
  }

  return payload.result as T;
}

function readNumberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function ensurePositiveNumber(value: number, label: string) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${label} 必須大於 0`);
  }
  return number;
}

function ensureNonNegativeNumber(value: number, label: string) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`${label} 不可小於 0`);
  }
  return number;
}

function ensureText(value: string, label: string) {
  const text = String(value || "").trim();
  if (!text) {
    throw new Error(`${label} 不可空白`);
  }
  return text;
}
