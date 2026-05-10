import type { QuoteRecord } from "@/lib/history";

export function QuoteHistory({ records }: { records: QuoteRecord[] }) {
  return (
    <section className="panel">
      <div className="panelHeader">
        <div>
          <h2>最近報價紀錄</h2>
          <p>成功產生報價後會自動記錄，最多保留最近 50 筆。</p>
        </div>
      </div>

      {records.length === 0 ? (
        <p className="empty">目前還沒有報價紀錄。</p>
      ) : (
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>時間</th>
                <th>來源</th>
                <th>商品</th>
                <th>韓元</th>
                <th>合計</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>{formatDate(record.createdAt)}</td>
                  <td>{formatSource(record.source)}</td>
                  <td>
                    <div className="productCell">
                      <span>{record.title}</span>
                      {record.url ? (
                        <a href={record.url} rel="noreferrer" target="_blank">
                          開啟連結
                        </a>
                      ) : null}
                    </div>
                  </td>
                  <td>₩{formatNumber(record.priceKrw)}</td>
                  <td>NT${formatNumber(record.totalTwd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-TW").format(value);
}

function formatSource(source: QuoteRecord["source"]) {
  if (source === "manual") return "手動";
  if (source === "image") return "截圖";
  return "連結";
}
