import { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth.jsx";
import api from "../lib/api";
import "./Servers.css";

export default function Servers() {
  const { t } = useTranslation();
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [guilds, setGuilds] = useState([]);
  const [guildsLoading, setGuildsLoading] = useState(true);

  // 未認証の場合はログインページへ
  if (!loading && !user) return <Navigate to="/login" replace />;

  useEffect(() => {
    if (!user) return;
    api
      .get("/guilds")
      .then((res) => setGuilds(res.data))
      .catch(console.error)
      .finally(() => setGuildsLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="servers-page">
      <header className="servers-header">
        <div className="servers-logo">
          <span className="logo-icon">✦</span>
          <span>Nexus</span>
        </div>
        {user && (
          <div className="servers-user">
            <img
              src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`}
              alt={user.username}
              className="servers-avatar"
              onError={(e) => {
                e.target.src = `https://cdn.discordapp.com/embed/avatars/0.png`;
              }}
            />
            <span>{user.username}</span>
            <button className="btn btn-secondary" onClick={logout}>
              {t("nav.logout")}
            </button>
          </div>
        )}
      </header>

      <main className="servers-main fade-in">
        <div className="servers-title-area">
          <h1 className="page-title">{t("servers.title")}</h1>
          <p className="page-subtitle">{t("servers.subtitle")}</p>
        </div>

        {guildsLoading ? (
          <div className="servers-loading">
            <div className="spinner" />
          </div>
        ) : guilds.length === 0 ? (
          <div className="servers-empty">
            <span className="empty-icon">🤖</span>
            <p>{t("servers.noServers")}</p>
          </div>
        ) : (
          <div className="servers-grid">
            {guilds.map((guild) => (
              <div
                key={guild.id}
                className="server-card"
                onClick={() => navigate(`/dashboard/${guild.id}`)}
              >
                {guild.icon ? (
                  <img
                    src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`}
                    alt={guild.name}
                    className="server-icon"
                  />
                ) : (
                  <div className="server-icon-placeholder">{guild.name[0]}</div>
                )}
                <div className="server-info">
                  <span className="server-name">{guild.name}</span>
                  <span className="server-members">
                    {guild.approximate_member_count?.toLocaleString() ?? "?"}{" "}
                    members
                  </span>
                </div>
                <span className="server-arrow">→</span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
