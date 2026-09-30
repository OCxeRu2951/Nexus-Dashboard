import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../lib/api";
import "./Recruit.css";

// 募集一覧（閲覧専用）
// 作成・参加・締切はDiscord側（/recruit, b!, ボタン）で行う
const FILTERS = ["all", "open", "closed"];

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

function RecruitItem({ recruit, guildId, channelName, lang, now, t }) {
  const isOpen = recruit.status === "open";
  const count = recruit.members.length;
  const capacity = recruit.capacity;
  const fillPct = capacity ? Math.min(100, Math.round((count / capacity) * 100)) : 0;
  const jumpUrl = recruit.message_id
    ? `https://discord.com/channels/${guildId}/${recruit.channel_id}/${recruit.message_id}`
    : null;

  return (
    <article className={`recruit-item ${isOpen ? "" : "recruit-item--closed"}`}>
      <header className="recruit-item-header">
        <span className={`recruit-status recruit-status--${recruit.status}`}>
          {t(`recruit.status.${recruit.status}`)}
        </span>
        <h4 className="recruit-title">{recruit.title}</h4>
        {jumpUrl && (
          <a className="recruit-jump" href={jumpUrl} target="_blank" rel="noreferrer">
            {t("recruit.openInDiscord")} ↗
          </a>
        )}
      </header>

      {recruit.description && <p className="recruit-desc">{recruit.description}</p>}

      <div className="recruit-meta">
        <MetaItem label={t("recruit.host")}>
          <span title={recruit.author_id}>{recruit.author_name ?? recruit.author_id}</span>
        </MetaItem>
        <MetaItem label={t("recruit.channel")}>
          {channelName ? `#${channelName}` : recruit.channel_id}
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
    </article>
  );
}

export default function Recruit() {
  const { t, i18n } = useTranslation();
  const { guildId } = useParams();
  const lang = i18n.language.startsWith("ja") ? "ja" : "en";

  const [recruits, setRecruits] = useState([]);
  const [channels, setChannels] = useState({});
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const loadRecruits = useCallback(async () => {
    const res = await api.get(`/guilds/${guildId}/recruits?status=all&limit=100`);
    setRecruits(Array.isArray(res.data) ? res.data : []);
    setNow(Date.now());
  }, [guildId]);

  useEffect(() => {
    setLoading(true);
    setError(false);

    const channelsReq = api
      .get(`/guilds/${guildId}/channels`)
      .then((res) =>
        setChannels(Object.fromEntries((res.data ?? []).map((c) => [c.id, c.name]))),
      )
      .catch(() => {}); // チャンネル名が取れなくてもIDで表示できる

    Promise.all([loadRecruits(), channelsReq])
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [guildId, loadRecruits]);

  // 「あと○分」の表示を定期的に更新する
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(timer);
  }, []);

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

  const counts = useMemo(
    () => ({
      all: recruits.length,
      open: recruits.filter((r) => r.status === "open").length,
      closed: recruits.filter((r) => r.status === "closed").length,
    }),
    [recruits],
  );

  const visible = filter === "all" ? recruits : recruits.filter((r) => r.status === filter);

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
        <p className="page-subtitle">{t("recruit.subtitle")}</p>
      </div>

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
                channelName={channels[r.channel_id]}
                lang={lang}
                now={now}
                t={t}
              />
            ))}
          </div>
        )}

        <p className="recruit-footnote">{t("recruit.retention")}</p>
      </div>
    </div>
  );
}
