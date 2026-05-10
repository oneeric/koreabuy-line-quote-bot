export type QuoteConfig = {
  krwToTwdRate: number;
  agencyFeeRate: number;
  defaultShippingTwd: number;
  shopName: string;
  bankInfo: string;
  noticeText: string;
};

const SETTINGS_PATH = process.env.SETTINGS_PATH || "settings.json";

export async function getQuoteConfig(): Promise<QuoteConfig> {
  const stored = await readGitHubSettings();
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
  await saveGitHubSettings(config);
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
  return Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_OWNER && process.env.GITHUB_REPO);
}

function readNumberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

async function readGitHubSettings(): Promise<Partial<QuoteConfig>> {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  if (!owner || !repo) return {};

  const response = await fetch(
    `https://raw.githubusercontent.com/${owner}/${repo}/main/${SETTINGS_PATH}`,
    { cache: "no-store" },
  );

  if (response.status === 404) return {};
  if (!response.ok) return {};

  try {
    return normalizeQuoteConfig((await response.json()) as QuoteConfig);
  } catch {
    return {};
  }
}

async function saveGitHubSettings(config: QuoteConfig) {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  if (!token || !owner || !repo) {
    throw new Error("Missing GITHUB_TOKEN, GITHUB_OWNER or GITHUB_REPO");
  }

  const endpoint = `https://api.github.com/repos/${owner}/${repo}/contents/${SETTINGS_PATH}`;
  const current = await getGitHubFile(endpoint, token);
  const content = Buffer.from(`${JSON.stringify(config, null, 2)}\n`, "utf8").toString(
    "base64",
  );

  const response = await fetch(endpoint, {
    method: "PUT",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      message: "Update quote settings",
      content,
      sha: current?.sha,
      branch: "main",
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub settings update failed: ${await response.text()}`);
  }
}

async function getGitHubFile(endpoint: string, token: string) {
  const response = await fetch(endpoint, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`GitHub settings read failed: ${await response.text()}`);
  }

  return (await response.json()) as { sha: string };
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
