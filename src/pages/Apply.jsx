import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../lib/api";
import ChannelSelect from "../components/ChannelSelect";
import "./Apply.css";

const STATUS_LABELS = {
  pending: { ja: "未処理", en: "Pending", color: "#f0b232" },
  approved: { ja: "承認", en: "Approved", color: "#23a55a" },
  rejected: { ja: "拒否", en: "Rejected", color: "#f23f42" },
  revoked: { ja: "取消", en: "Revoked", color: "#6d6f78" },
};

export default function Apply() {
  const { i18n } = useTranslation();
  const { guildId } = useParams();
  const lang = i18n.language.startsWith("ja") ? "ja" : "en";

  const [settings, setSettings] = useState(null);
  const [applications, setApps] = useState([]);
  const [statusFilter, setFilter] = useState("all");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get(`/guilds/${guildId}/apply-settings`),
      api.get(`/guilds/${guildId}/apply?status=all&limit=50`),
      api.get(`/guilds/${guildId}/roles`),
    ])
      .then(([s, a, r]) => {
        setSettings(s.data);
        setApps(a.data);
        setRoles(r.data ?? []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [guildId]);

  const update = (key, val) => setSettings((prev) => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/guilds/${guildId}/apply-settings`, settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(lang === "ja" ? "削除しますか？" : "Delete this application?"))
      return;
    await api.delete(`/guilds/${guildId}/apply?id=${id}`).catch(console.error);
    setApps((prev) => prev.filter((a) => a.id !== id));
  };

  const filteredApps =
    statusFilter === "all"
      ? applications
      : applications.filter((a) => a.status === statusFilter);

  if (loading)
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          padding: "60px 40px",
        }}
      >
        <div className="spinner" />
      </div>
    );

  return (
    <div className="apply-page fade-in">
      <div className="page-header">
        <h1 className="page-title">
          📩 {lang === "ja" ? "申請システム" : "Application System"}
        </h1>
        <p className="page-subtitle">
          {lang === "ja"
            ? "申請の設定と履歴を管理します"
            : "Manage application settings and history"}
        </p>
      </div>

      {/* 設定 */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 className="section-title">
          ⚙️ {lang === "ja" ? "設定" : "Settings"}
        </h3>

        <div className="apply-settings-grid">
          <div className="form-group">
            <label className="form-label">
              {lang === "ja" ? "申請チャンネル" : "Apply Channel"}
            </label>
            <ChannelSelect
              value={settings?.apply_channel_id ?? ""}
              onChange={(val) => update("apply_channel_id", val)}
              placeholder={
                lang === "ja" ? "— チャンネルを選択 —" : "— Select channel —"
              }
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              {lang === "ja" ? "管理者チャンネル" : "Admin Channel"}
            </label>
            <ChannelSelect
              value={settings?.admin_channel_id ?? ""}
              onChange={(val) => update("admin_channel_id", val)}
              placeholder={
                lang === "ja" ? "— チャンネルを選択 —" : "— Select channel —"
              }
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              {lang === "ja" ? "通知ロール" : "Notify Role"}
            </label>
            <select
              className="form-input"
              value={settings?.operator_role_id ?? ""}
              onChange={(e) => update("operator_role_id", e.target.value)}
            >
              <option value="">
                {lang === "ja" ? "— 選択してください —" : "— Select role —"}
              </option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">
              {lang === "ja" ? "通知方法" : "Notify Type"}
            </label>
            <select
              className="form-input"
              value={settings?.notify_type ?? "dm"}
              onChange={(e) => update("notify_type", e.target.value)}
            >
              <option value="dm">DM</option>
              <option value="channel">
                {lang === "ja" ? "チャンネル" : "Channel"}
              </option>
            </select>
          </div>

          {settings?.notify_type === "channel" && (
            <div className="form-group">
              <label className="form-label">
                {lang === "ja" ? "通知チャンネル" : "Notify Channel"}
              </label>
              <ChannelSelect
                value={settings?.notify_target ?? ""}
                onChange={(val) => update("notify_target", val)}
                placeholder={
                  lang === "ja" ? "— チャンネルを選択 —" : "— Select channel —"
                }
              />
            </div>
          )}
        </div>

        <div className="save-bar">
          {saved && (
            <span className="badge badge-success">
              ✓ {lang === "ja" ? "保存しました" : "Saved"}
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
            {lang === "ja" ? "保存" : "Save"}
          </button>
        </div>
      </div>

      {/* 申請履歴 */}
      <div className="card">
        <div className="apply-history-header">
          <h3 className="section-title">
            📋 {lang === "ja" ? "申請履歴" : "Application History"}
          </h3>
          <div className="status-filters">
            {["all", "pending", "approved", "rejected", "revoked"].map((s) => (
              <button
                key={s}
                className={`filter-btn ${statusFilter === s ? "filter-btn--active" : ""}`}
                onClick={() => setFilter(s)}
              >
                {s === "all"
                  ? lang === "ja"
                    ? "全て"
                    : "All"
                  : (STATUS_LABELS[s]?.[lang] ?? s)}
              </button>
            ))}
          </div>
        </div>

        {filteredApps.length === 0 ? (
          <div className="apply-empty">
            <p>
              {lang === "ja" ? "申請がありません" : "No applications found"}
            </p>
          </div>
        ) : (
          <div className="apply-list">
            {filteredApps.map((app) => (
              <div key={app.id} className="apply-item">
                <div className="apply-item-header">
                  <span className="apply-id">{app.id}</span>
                  <span
                    className="apply-status"
                    style={{
                      color: STATUS_LABELS[app.status]?.color ?? "#fff",
                    }}
                  >
                    {STATUS_LABELS[app.status]?.[lang] ?? app.status}
                  </span>
                </div>
                <div className="apply-item-body">
                  <div className="apply-content">
                    <span className="apply-label">
                      {lang === "ja" ? "内容" : "Content"}
                    </span>
                    <span>{app.content}</span>
                  </div>
                  {app.comment && (
                    <div className="apply-content">
                      <span className="apply-label">
                        {lang === "ja" ? "コメント" : "Comment"}
                      </span>
                      <span>{app.comment}</span>
                    </div>
                  )}
                  <div className="apply-meta">
                    <span>by {app.username}</span>
                    <span>
                      {new Date(Number(app.created_at)).toLocaleString(
                        lang === "ja" ? "ja-JP" : "en-US",
                      )}
                    </span>
                  </div>
                </div>
                <button
                  className="apply-delete"
                  onClick={() => handleDelete(app.id)}
                  title={lang === "ja" ? "削除" : "Delete"}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
