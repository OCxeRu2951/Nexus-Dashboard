import ChannelSelect from "../components/ChannelSelect.jsx";
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../lib/api";
import "./Moderation.css";

const DEFAULTS = {
  log_channel_id: "",
  warn_threshold_timeout: 3,
  warn_threshold_ban: 5,
  timeout_duration_min: 60,
  automod_spam: false,
  automod_invite: false,
};

export default function Moderation() {
  const { t } = useTranslation();
  const { guildId } = useParams();
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .get(`/guilds/${guildId}/moderation`)
      .then((res) => setSettings({ ...DEFAULTS, ...res.data }))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [guildId]);

  const update = (key, val) => setSettings((prev) => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/guilds/${guildId}/moderation`, settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="moderation-page fade-in">
      <div className="page-header">
        <h1 className="page-title">{t("moderation.title")}</h1>
        <p className="page-subtitle">
          ログチャンネルや警告しきい値を設定します
        </p>
      </div>

      {loading ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "60px 0",
          }}
        >
          <div className="spinner" />
        </div>
      ) : (
        <div className="moderation-layout">
          {/* ログチャンネル */}
          <div className="card">
            <h3 className="section-title">📋 {t("moderation.logChannel")}</h3>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{t("moderation.logChannel")}</label>
              <ChannelSelect
                value={settings.log_channel_id}
                onChange={(val) => update("log_channel_id", val)}
                placeholder="— ログチャンネルを選択 —"
              />
            </div>
          </div>

          {/* 警告しきい値 */}
          <div className="card">
            <h3 className="section-title">
              ⚠️ {t("moderation.warnThreshold")}
            </h3>
            <p className="section-desc">
              警告ポイントが設定値に達すると自動的に処罰が適用されます
            </p>

            <div className="threshold-grid">
              <div className="form-group">
                <label className="form-label">
                  {t("moderation.timeoutAt")}
                </label>
                <input
                  type="number"
                  className="form-input"
                  min={1}
                  max={100}
                  value={settings.warn_threshold_timeout}
                  onChange={(e) =>
                    update("warn_threshold_timeout", Number(e.target.value))
                  }
                />
                <p className="form-hint">このポイント数でタイムアウト</p>
              </div>
              <div className="form-group">
                <label className="form-label">{t("moderation.banAt")}</label>
                <input
                  type="number"
                  className="form-input"
                  min={1}
                  max={100}
                  value={settings.warn_threshold_ban}
                  onChange={(e) =>
                    update("warn_threshold_ban", Number(e.target.value))
                  }
                />
                <p className="form-hint">このポイント数でBAN</p>
              </div>
              <div className="form-group">
                <label className="form-label">
                  {t("moderation.timeoutDuration")}
                </label>
                <input
                  type="number"
                  className="form-input"
                  min={1}
                  max={40320}
                  value={settings.timeout_duration_min}
                  onChange={(e) =>
                    update("timeout_duration_min", Number(e.target.value))
                  }
                />
                <p className="form-hint">自動タイムアウトの時間（分）</p>
              </div>
            </div>

            <div className="threshold-flow">
              <div className="flow-item">
                <span className="flow-badge flow-badge--warn">警告</span>
                <span className="flow-pts">
                  {settings.warn_threshold_timeout}pt
                </span>
              </div>
              <span className="flow-arrow">→</span>
              <div className="flow-item">
                <span className="flow-badge flow-badge--timeout">
                  タイムアウト {settings.timeout_duration_min}分
                </span>
              </div>
              <span className="flow-arrow">→</span>
              <div className="flow-item">
                <span className="flow-pts">
                  {settings.warn_threshold_ban}pt
                </span>
                <span className="flow-badge flow-badge--ban">BAN</span>
              </div>
            </div>
          </div>

          {/* 自動モデレーション */}
          <div className="card">
            <h3 className="section-title">🤖 {t("moderation.automod")}</h3>
            <p className="section-desc">
              自動的に問題のあるメッセージを検知します
            </p>

            <div className="automod-list">
              <div className="automod-item">
                <div className="automod-info">
                  <span className="automod-name">
                    {t("moderation.automodSpam")}
                  </span>
                  <span className="automod-desc">
                    短時間の連投を自動検知して警告
                  </span>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={settings.automod_spam}
                    onChange={(e) => update("automod_spam", e.target.checked)}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
              <div className="automod-item">
                <div className="automod-info">
                  <span className="automod-name">
                    {t("moderation.automodInvite")}
                  </span>
                  <span className="automod-desc">
                    Discord招待リンクを自動削除・警告
                  </span>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={settings.automod_invite}
                    onChange={(e) => update("automod_invite", e.target.checked)}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
            </div>
          </div>

          <div className="save-bar">
            {saved && (
              <span className="badge badge-success">
                ✓ {t("common.success")}
              </span>
            )}
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving && (
                <div className="spinner" style={{ width: 16, height: 16 }} />
              )}
              {t("common.save")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
