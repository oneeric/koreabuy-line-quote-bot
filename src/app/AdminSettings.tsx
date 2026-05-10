"use client";

import { FormEvent, useState } from "react";
import type { QuoteConfig } from "@/lib/settings";

type Props = {
  initialConfig: QuoteConfig;
  writable: boolean;
  protectedByToken: boolean;
};

export function AdminSettings({ initialConfig, writable, protectedByToken }: Props) {
  const [config, setConfig] = useState(initialConfig);
  const [adminToken, setAdminToken] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus("儲存中...");

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(config),
      });
      const payload = (await response.json()) as { config?: QuoteConfig; error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "儲存失敗");
      }

      if (payload.config) setConfig(payload.config);
      setStatus("已儲存，下一次 LINE 報價會套用新設定。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel" onSubmit={onSubmit}>
      <div className="panelHeader">
        <div>
          <h2>費用設定</h2>
          <p>這裡改的是伺服器設定，LINE bot 會直接使用。</p>
        </div>
        <span className={writable ? "badge ok" : "badge warn"}>
          {writable ? "可儲存" : "需接資料庫"}
        </span>
      </div>

      {!writable ? (
        <div className="notice">
          目前尚未設定 Upstash Redis。請在 Vercel Environment Variables 加上
          <code>UPSTASH_REDIS_REST_URL</code> 和 <code>UPSTASH_REDIS_REST_TOKEN</code>。
        </div>
      ) : null}

      {!protectedByToken ? (
        <div className="notice">
          尚未設定 <code>ADMIN_TOKEN</code>，為了安全，後台不允許儲存。
        </div>
      ) : null}

      <div className="grid">
        <label>
          <span>匯率 TWD/KRW</span>
          <input
            type="number"
            min="0"
            step="0.0001"
            value={config.krwToTwdRate}
            onChange={(event) =>
              setConfig({ ...config, krwToTwdRate: Number(event.target.value) })
            }
          />
        </label>

        <label>
          <span>代購費 %</span>
          <input
            type="number"
            min="0"
            step="0.1"
            value={Math.round(config.agencyFeeRate * 1000) / 10}
            onChange={(event) =>
              setConfig({ ...config, agencyFeeRate: Number(event.target.value) / 100 })
            }
          />
        </label>

        <label>
          <span>預設運費 TWD</span>
          <input
            type="number"
            min="0"
            step="1"
            value={config.defaultShippingTwd}
            onChange={(event) =>
              setConfig({ ...config, defaultShippingTwd: Number(event.target.value) })
            }
          />
        </label>

        <label>
          <span>店名</span>
          <input
            value={config.shopName}
            onChange={(event) => setConfig({ ...config, shopName: event.target.value })}
          />
        </label>
      </div>

      <label>
        <span>匯款資訊</span>
        <textarea
          rows={3}
          value={config.bankInfo}
          onChange={(event) => setConfig({ ...config, bankInfo: event.target.value })}
        />
      </label>

      <label>
        <span>購買須知</span>
        <textarea
          rows={5}
          value={config.noticeText}
          onChange={(event) => setConfig({ ...config, noticeText: event.target.value })}
        />
      </label>

      <label>
        <span>管理密碼</span>
        <input
          type="password"
          value={adminToken}
          placeholder="Vercel 的 ADMIN_TOKEN"
          onChange={(event) => setAdminToken(event.target.value)}
        />
      </label>

      <div className="actions">
        <button disabled={saving || !writable || !protectedByToken} type="submit">
          {saving ? "儲存中" : "儲存設定"}
        </button>
        <span>{status}</span>
      </div>
    </form>
  );
}
