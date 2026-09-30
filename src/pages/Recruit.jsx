import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../lib/api";
import ChannelSelect from "../components/ChannelSelect";
import "./Recruit.css";

// 募集ページ
//   管理者: 全件の閲覧・締切 + 募集設定（更新リスト / スレッド方式 / 閲覧ロール）
//   メンバー: Discord 上で見られるチャンネルの募集を閲覧。自分の募集を締切
// 締切はBotが数秒以内に実行する（Discordの投稿更新・通知をBot側で行うため）
const FILTERS = ["all", "open", "closed", "mine", "joined"];
const REFRESH_AFTER_CLOSE_MS = [6000, 15000];

function formatDateTime(ms, lang) {
  return new Date(ms).toLocaleString(lang === "ja" ? "ja-JP" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatRelative(ms, now, lang) {
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  const diff = ms - now;
  const abs = Math.abs(diff);
  if (abs < 60 * 60 * 1000) return rtf.format(Math.round(diff / 60000), "minute");
  if (abs < 24 * 60 * 60 * 1000) return rtf.format(Math.round(diff / 3600000), "hour");
  return rtf.format(Math.round(diff / 86400000), "day");
}

function MetaItem({ label, children }) {
  return (
    <div className="recruit-meta-item">
      <span className="recruit-meta-label">{label}</span>
      <span className="recruit-meta-value">{children}</span>
    </div>
  );
}

function RecruitItem({ recruit, guildId, lang, now, t, onClose, closing }) {
  const isOpen = recruit.status === "open";
  const count = recruit.members.length;
  const capacity = recruit.capacity;
  const fillPct = capacity ? Math.min(100, Math.round((count / capacity) * 100)) : 0;
  const jumpUrl = recruit.message_id
    ? `https://discord.com/channels/${guildId}/${recruit.channel_id}/${recruit.message_id}`
    : null;
  const threadUrl = recruit.thread_id
    ? `https://discord.com/channels/${guildId}/${recruit.thread_id}`
    : null;

  return (
    <article className={`recruit-item ${isOpen ? "" : "recruit-item--closed"}`}>
      <header className="recruit-item-header">
        <span className={`recruit-status recruit-status--${recruit.status}`}>
          {t(`recruit.status.${recruit.status}`)}
        </span>
        <h4 className="recruit-title">{recruit.title}</h4>
        <div className="recruit-links">
          {threadUrl && (
            <a className="recruit-jump" href={threadUrl} target="_blank" rel="noreferrer">
              {t(recruit.thread_kind === "forum" ? "recruit.openForum" : "recruit.openThread")} ↗
            </a>
          )}
          {jumpUrl && (
            <a className="recruit-jump" href={jumpUrl} target="_blank" rel="noreferrer">
              {t("recruit.openInDiscord")} ↗
            </a>
          )}
        </div>
      </header>

      {(recruit.is_mine || recruit.joined || recruit.close_pending) && (
        <div className="recruit-tags">
          {recruit.is_mine && <span className="recruit-tag recruit-tag--mine">{t("recruit.tagMine")}</span>}
          {recruit.joined && <span className="recruit-tag recruit-tag--joined">{t("recruit.tagJoined")}</span>}
          {recruit.close_pending && isOpen && (
            <span className="recruit-tag recruit-tag--pending">{t("recruit.closePending")}</span>
          )}
        </div>
      )}

      {recruit.description && <p className="recruit-desc">{recruit.description}</p>}

      <div className="recruit-meta">
        <MetaItem label={t("recruit.host")}>
          <span title={recruit.author_id}>{recruit.author_name ?? recruit.author_id}</span>
        </MetaItem>
        <MetaItem label={t("recruit.channel")}>
          {recruit.channel_name ? `#${recruit.channel_name}` : recruit.channel_id}
        </MetaItem>
        <MetaItem label={t("recruit.count")}>
          {capacity ? `${count} / ${capacity}` : t("recruit.countUnlimited", { n: count })}
        </MetaItem>
        <MetaItem label={t("recruit.deadline")}>
          {recruit.end_at ? (
            <>
              {formatDateTime(recruit.end_at, lang)}
              {isOpen && (
                <span className="recruit-relative">
                  {" "}({formatRelative(recruit.end_at, now, lang)})
                </span>
              )}
            </>
          ) : (
            t("recruit.noDeadline")
          )}
        </MetaItem>
        <MetaItem label={t("recruit.created")}>
          {formatDateTime(recruit.created_at, lang)}
        </MetaItem>
        {!isOpen && (
          <MetaItem label={t("recruit.closeReason")}>
            {t(`recruit.reason.${recruit.close_reason ?? "manual"}`)}
          </MetaItem>
        )}
      </div>

      {capacity ? (
        <div
          className={`recruit-progress ${count >= capacity ? "recruit-progress--full" : ""}`}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={capacity}
          aria-valuenow={count}
        >
          <div className="recruit-progress-bar" style={{ width: `${fillPct}%` }} />
        </div>
      ) : null}

      <div className="recruit-members">
        <span className="recruit-members-label">
          {t("recruit.members")} ({count})
        </span>
        {count === 0 ? (
          <span className="recruit-members-empty">{t("recruit.noMembers")}</span>
        ) : (
          <ul className="recruit-member-list">
            {recruit.members.map((m) => (
              <li key={m.user_id} className="recruit-member" title={m.user_id}>
                {m.username ?? m.user_id}
              </li>
            ))}
          </ul>
        )}
      </div>

      {recruit.can_close && isOpen && !recruit.close_pending && (
        <div className="recruit-actions">
          <button
            className="btn btn-secondary recruit-close-btn"
            onClick={() => onClose(recruit)}
            disabled={closing}
          >
            {closing && <div className="spinner" style={{ width: 14, height: 14 }} />}
            {t("recruit.close")}
          </button>
        </div>
      )}
    </article>
  );
}

function RecruitSettings({ guildId, t }) {
  const [settings, setSettings] = useState(null);
  const [roles, setRoles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // saved | error | forumRequired

  useEffect(() => {
    Promise.all([
      api.get(`/guilds/${guildId}/recruit-settings`),
      api.get(`/guilds/${guildId}/roles`),
    ])
      .then(([s, r]) => {
        setSettings(s.data);
        setRoles(r.data ?? []);
      })
      .catch(console.error);
  }, [guildId]);

  if (!settings) return null;

  const update = (key, val) => setSettings((prev) => ({ ...prev, [key]: val }));
  const toggleRole = (id) =>
    update(
      "viewer_role_ids",
      settings.viewer_role_ids.includes(id)
        ? settings.viewer_role_ids.filter((r) => r !== id)
        : [...settings.viewer_role_ids, id],
    );

  const handleSave = async () => {
    if (settings.thread_mode === "forum" && !settings.forum_channel_id) {
      setStatus("forumRequired");
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      await api.put(`/guilds/${guildId}/recruit-settings`, settings);
      setStatus("saved");
      setTimeout(() => setStatus(null), 4000);
    } catch (err) {
      console.error(err);
      setStatus("error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card recruit-settings">
      <h3 className="recruit-section-title">{t("recruit.settings.title")}</h3>

      <div className="recruit-settings-grid">
        <div className="form-group">
          <label className="form-label">{t("recruit.settings.listChannel")}</label>
          <ChannelSelect
            value={settings.list_channel_id}
            onChange={(val) => update("list_channel_id", val)}
            placeholder={t("recruit.settings.listDisabled")}
          />
          <span className="recruit-hint">{t("recruit.settings.listHint")}</span>
        </div>

        <div className="form-group">
          <label className="form-label">{t("recruit.settings.threadMode")}</label>
          <select
            className="form-input"
            value={settings.thread_mode}
            onChange={(e) => update("thread_mode", e.target.value)}
          >
            <option value="thread">{t("recruit.settings.modeThread")}</option>
            <option value="forum">{t("recruit.settings.modeForum")}</option>
          </select>
          <span className="recruit-hint">{t("recruit.settings.threadHint")}</span>
        </div>

        {settings.thread_mode === "forum" && (
          <div className="form-group">
            <label className="form-label">{t("recruit.settings.forumChannel")}</label>
            <ChannelSelect
              type="forum"
              value={settings.forum_channel_id}
              onChange={(val) => update("forum_channel_id", val)}
              placeholder={t("recruit.settings.selectForum")}
            />
          </div>
        )}
      </div>

      <div className="form-group">
        <label className="form-label">{t("recruit.settings.viewerRoles")}</label>
        <div className="recruit-role-list">
          {roles.map((r) => (
            <label
              key={r.id}
              className={`recruit-role ${settings.viewer_role_ids.includes(r.id) ? "recruit-role--on" : ""}`}
            >
              <input
                type="checkbox"
                checked={settings.viewer_role_ids.includes(r.id)}
                onChange={() => toggleRole(r.id)}
              />
              {r.name}
            </label>
          ))}
        </div>
        <span className="recruit-hint">
          {settings.viewer_role_ids.length === 0
            ? t("recruit.settings.viewerEveryone")
            : t("recruit.settings.viewerSelected", { n: settings.viewer_role_ids.length })}
        </span>
      </div>

      <div className="recruit-save-bar">
        {status === "saved" && <span className="badge badge-success">✓ {t("recruit.settings.saved")}</span>}
        {status === "error" && <span className="recruit-error">{t("recruit.settings.saveError")}</span>}
        {status === "forumRequired" && <span className="recruit-error">{t("recruit.settings.forumRequired")}</span>}
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving && <div className="spinner" style={{ width: 16, height: 16 }} />}
          {t("common.save")}
        </button>
      </div>
    </div>
  );
}

export default function Recruit() {
  const { t, i18n } = useTranslation();
  const { guildId } = useParams();
  const lang = i18n.language.startsWith("ja") ? "ja" : "en";

  const [data, setData] = useState({ access: null, recruits: [] });
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [closingId, setClosingId] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const timers = useRef([]);

  const loadRecruits = useCallback(async () => {
    const res = await api.get(`/guilds/${guildId}/recruits?status=all&limit=100`);
    setData({
      access: res.data?.access ?? null,
      recruits: Array.isArray(res.data?.recruits) ? res.data.recruits : [],
    });
    setNow(Date.now());
  }, [guildId]);

  useEffect(() => {
    setLoading(true);
    setError(false);
    loadRecruits()
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [loadRecruits]);

  // 「あと○分」の表示を定期的に更新する
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(false);
    try {
      await loadRecruits();
    } catch {
      setError(true);
    } finally {
      setRefreshing(false);
    }
  };

  const handleClose = async (recruit) => {
    if (!confirm(t("recruit.closeConfirm", { title: recruit.title }))) return;
    setClosingId(recruit.id);
    try {
      await api.post(`/guilds/${guildId}/recruits`, { action: "close", recruit_id: recruit.id });
      setData((prev) => ({
        ...prev,
        recruits: prev.recruits.map((r) => (r.id === recruit.id ? { ...r, close_pending: true } : r)),
      }));
      // Botが処理した結果を反映する
      timers.current.push(
        ...REFRESH_AFTER_CLOSE_MS.map((ms) => setTimeout(() => loadRecruits().catch(() => {}), ms)),
      );
    } catch (err) {
      if (err.response?.status === 409) {
        await loadRecruits().catch(() => {});
      } else {
        alert(t("recruit.closeError"));
      }
    } finally {
      setClosingId(null);
    }
  };

  const { recruits, access } = data;

  const counts = useMemo(
    () => ({
      all: recruits.length,
      open: recruits.filter((r) => r.status === "open").length,
      closed: recruits.filter((r) => r.status === "closed").length,
      mine: recruits.filter((r) => r.is_mine).length,
      joined: recruits.filter((r) => r.joined).length,
    }),
    [recruits],
  );

  const visible = recruits.filter((r) => {
    if (filter === "open" || filter === "closed") return r.status === filter;
    if (filter === "mine") return r.is_mine;
    if (filter === "joined") return r.joined;
    return true;
  });

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "60px 40px" }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="recruit-page fade-in">
      <div className="page-header">
        <h1 className="page-title">{t("recruit.title")}</h1>
        <p className="page-subtitle">
          {t(access === "admin" ? "recruit.subtitleAdmin" : "recruit.subtitleMember")}
        </p>
      </div>

      {access === "admin" && <RecruitSettings guildId={guildId} t={t} />}

      <div className="card">
        <div className="recruit-toolbar">
          <div className="recruit-filters">
            {FILTERS.map((f) => (
              <button
                key={f}
                className={`recruit-filter ${filter === f ? "recruit-filter--active" : ""}`}
                onClick={() => setFilter(f)}
              >
                {t(`recruit.filter.${f}`)} <span className="recruit-filter-count">{counts[f]}</span>
              </button>
            ))}
          </div>
          <button className="btn btn-secondary recruit-refresh" onClick={handleRefresh} disabled={refreshing}>
            {refreshing && <div className="spinner" style={{ width: 14, height: 14 }} />}
            {t("recruit.refresh")}
          </button>
        </div>

        {error ? (
          <div className="recruit-empty recruit-empty--error">{t("recruit.loadError")}</div>
        ) : visible.length === 0 ? (
          <div className="recruit-empty">
            <p>{t("recruit.empty")}</p>
            <p className="recruit-empty-hint">{t("recruit.emptyHint")}</p>
          </div>
        ) : (
          <div className="recruit-list">
            {visible.map((r) => (
              <RecruitItem
                key={r.id}
                recruit={r}
                guildId={guildId}
                lang={lang}
                now={now}
                t={t}
                onClose={handleClose}
                closing={closingId === r.id}
              />
            ))}
          </div>
        )}

        <p className="recruit-footnote">{t("recruit.retention")}</p>
      </div>
    </div>
  );
}
