export default function Home() {
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
      <p>
        本機網址 <code>localhost</code> 只能給你自己看，LINE 串接一定要用公開網址。
      </p>

      <h2>正式上線</h2>
      <ol>
        <li>把專案推到 GitHub。</li>
        <li>到 Vercel 匯入 GitHub repo 並部署。</li>
        <li>到 Vercel 設定環境變數。</li>
        <li>
          到 LINE Developers 把 webhook 設成：
          <pre>https://你的專案.vercel.app/api/line/webhook</pre>
        </li>
      </ol>

      <h2>臨時測試</h2>
      <p>如果還沒上 Vercel，可以用 ngrok 或 Cloudflare Tunnel 把本機暫時公開。</p>
      <pre>https://你的臨時網址/api/line/webhook</pre>

      <h2>狀態檢查</h2>
      <p>看到這頁代表網站服務正常。LINE 真正會打的是 webhook API：</p>
      <pre>/api/line/webhook</pre>
    </main>
  );
}
