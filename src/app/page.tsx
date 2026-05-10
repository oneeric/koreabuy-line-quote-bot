import { AdminSettings } from "@/app/AdminSettings";
import { getQuoteConfig, hasWritableSettingsStore } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function Home() {
  const config = await getQuoteConfig();

  return (
    <main
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        maxWidth: 760,
        margin: "0 auto",
        padding: 32,
        lineHeight: 1.7,
      }}
    >
      <h1>韓國代購 LINE 報價 Bot</h1>
      <p className="lead">修改報價用的匯率、代購費、運費與回覆文字。</p>

      <AdminSettings
        initialConfig={config}
        writable={hasWritableSettingsStore()}
        protectedByToken={Boolean(process.env.ADMIN_TOKEN)}
      />

      <section className="panel muted">
        <h2>LINE Webhook</h2>
        <pre>https://koreabuy-line-quote-bot.vercel.app/api/line/webhook</pre>
      </section>
    </main>
  );
}
