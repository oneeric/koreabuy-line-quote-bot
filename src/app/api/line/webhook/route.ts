import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { buildQuoteReply } from "@/lib/quote";

export const runtime = "nodejs";

type LineTextEvent = {
  type: "message";
  replyToken: string;
  message: {
    type: "text";
    text: string;
  };
};

type LineWebhookBody = {
  events?: Array<LineTextEvent | { type: string; replyToken?: string }>;
};

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!verifyLineSignature(rawBody, req.headers.get("x-line-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody) as LineWebhookBody;
  const events = body.events ?? [];

  await Promise.all(
    events.map(async (event) => {
      if (!isLineTextEvent(event)) return;

      const replyText = await buildQuoteReply(event.message.text);
      await replyToLine(event.replyToken, replyText);
    }),
  );

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "koreabuy-line-quote-bot" });
}

function verifyLineSignature(rawBody: string, signature: string | null) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("base64");
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  return (
    expectedBuffer.length === signatureBuffer.length &&
    timingSafeEqual(expectedBuffer, signatureBuffer)
  );
}

function isLineTextEvent(event: unknown): event is LineTextEvent {
  if (!event || typeof event !== "object") return false;
  const candidate = event as LineTextEvent;
  return (
    candidate.type === "message" &&
    typeof candidate.replyToken === "string" &&
    candidate.message?.type === "text" &&
    typeof candidate.message.text === "string"
  );
}

async function replyToLine(replyToken: string, text: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    throw new Error("Missing LINE_CHANNEL_ACCESS_TOKEN");
  }

  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }],
    }),
  });

  if (!response.ok) {
    throw new Error(`LINE reply failed: ${response.status} ${await response.text()}`);
  }
}
