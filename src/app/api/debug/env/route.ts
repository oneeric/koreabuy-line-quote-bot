import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    lineChannelSecret: Boolean(process.env.LINE_CHANNEL_SECRET),
    lineChannelAccessToken: Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN),
    geminiApiKey: Boolean(process.env.GEMINI_API_KEY),
    krwToTwdRate: process.env.KRW_TO_TWD_RATE || null,
    agencyFeeRate: process.env.AGENCY_FEE_RATE || null,
    defaultShippingTwd: process.env.DEFAULT_SHIPPING_TWD || null,
  });
}
