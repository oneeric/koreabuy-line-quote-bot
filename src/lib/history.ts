import { hasGitHubWriteAccess, readPublicJsonFile, writeJsonFile } from "@/lib/github-json";

export type QuoteRecord = {
  id: string;
  createdAt: string;
  source: "manual" | "scrape" | "gemini" | "image";
  title: string;
  url?: string;
  priceKrw: number;
  itemTwd: number;
  serviceFeeTwd: number;
  shippingTwd: number;
  totalTwd: number;
};

const HISTORY_PATH = process.env.HISTORY_PATH || "quote-history.json";
const HISTORY_LIMIT = 50;

export async function getQuoteHistory() {
  const history = await readPublicJsonFile<QuoteRecord[]>(HISTORY_PATH);
  return Array.isArray(history) ? history : [];
}

export async function appendQuoteRecord(record: Omit<QuoteRecord, "id" | "createdAt">) {
  if (!hasGitHubWriteAccess()) return;

  const nextRecord: QuoteRecord = {
    ...record,
    id: buildRecordId(),
    createdAt: new Date().toISOString(),
  };

  const history = await getQuoteHistory();
  await writeJsonFile(
    HISTORY_PATH,
    [nextRecord, ...history].slice(0, HISTORY_LIMIT),
    "Add quote history record",
  );
}

export async function appendQuoteRecordBestEffort(record: Omit<QuoteRecord, "id" | "createdAt">) {
  try {
    await Promise.race([
      appendQuoteRecord(record),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
  } catch (error) {
    console.error("Failed to append quote history", error);
  }
}

function buildRecordId() {
  const date = new Date();
  const timestamp = date
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(/\..+$/, "");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `KB-${timestamp}-${suffix}`;
}
