import { NextRequest, NextResponse } from "next/server";
import {
  getQuoteConfig,
  hasWritableSettingsStore,
  saveQuoteConfig,
  type QuoteConfig,
} from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    config: await getQuoteConfig(),
    writable: hasWritableSettingsStore(),
    protected: Boolean(process.env.ADMIN_TOKEN),
  });
}

export async function PUT(req: NextRequest) {
  if (!hasWritableSettingsStore()) {
    return NextResponse.json(
      {
        error:
          "尚未設定 GITHUB_TOKEN / GITHUB_OWNER / GITHUB_REPO，無法從 UI 儲存設定。",
      },
      { status: 503 },
    );
  }

  if (!verifyAdminToken(req)) {
    return NextResponse.json({ error: "管理密碼不正確" }, { status: 401 });
  }

  const body = (await req.json()) as QuoteConfig;
  const config = await saveQuoteConfig(body);
  return NextResponse.json({ config });
}

function verifyAdminToken(req: NextRequest) {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) return false;

  const header = req.headers.get("authorization");
  return header === `Bearer ${adminToken}`;
}
