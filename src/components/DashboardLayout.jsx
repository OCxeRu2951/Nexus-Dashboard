import { useState, useEffect } from 'react';
import { Outlet, useParams, Navigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from "../hooks/useAuth.jsx";
import Sidebar from './Sidebar';
import api from '../lib/api';
import './DashboardLayout.css';

// メンバー権限で開けるページ（それ以外は募集ページへ移動）
const MEMBER_PAGES = ["recruit"];

export default function DashboardLayout() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const { guildId } = useParams();
  const location = useLocation();
  const [guild, setGuild] = useState(null);
  const [guildState, setGuildState] = useState("loading"); // loading | ready | forbidden | error

  useEffect(() => {
    if (!guildId) return;
    setGuildState("loading");
    api.get(`/guilds/${guildId}`)
      .then(res => { setGuild(res.data); setGuildState("ready"); })
      .catch(err => {
        console.error(err);
        setGuildState(err.response?.status === 403 ? "forbidden" : "error");
      });
  }, [guildId]);

  if (loading) {
    return (
      <div className="layout-loading">
        <div className="spinner" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // 権限が確定するまでページを描画しない
  // （メンバーが管理者用APIを呼んでしまうのを防ぐため）
  if (guildState === "loading") {
    return (
      <div className="layout-loading">
        <div className="spinner" />
      </div>
    );
  }

  if (guildState !== "ready") {
    return (
      <div className="layout-message">
        <p>{t(guildState === "forbidden" ? "access.forbidden" : "access.loadError")}</p>
        <Link to="/servers" className="btn btn-secondary">{t("access.backToServers")}</Link>
      </div>
    );
  }

  if (guild?.access === "member") {
    const page = location.pathname.split("/")[3] ?? "";
    if (!MEMBER_PAGES.includes(page)) {
      return <Navigate to={`/dashboard/${guildId}/recruit`} replace />;
    }
  }

  return (
    <div className="dashboard-layout">
      <Sidebar guild={guild} />
      <main className="dashboard-main">
        <Outlet context={{ guild }} />
      </main>
    </div>
  );
}
