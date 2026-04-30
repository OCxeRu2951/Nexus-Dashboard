import { useState, useEffect } from 'react';
import { Outlet, useParams, Navigate } from 'react-router-dom';
import { useAuth } from "../hooks/useAuth.jsx";
import Sidebar from './Sidebar';
import api from '../lib/api';
import './DashboardLayout.css';

export default function DashboardLayout() {
  const { user, loading } = useAuth();
  const { guildId } = useParams();
  const [guild, setGuild] = useState(null);

  useEffect(() => {
    if (guildId) {
      api.get(`/guilds/${guildId}`)
        .then(res => setGuild(res.data))
        .catch(console.error);
    }
  }, [guildId]);

  if (loading) {
    return (
      <div className="layout-loading">
        <div className="spinner" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="dashboard-layout">
      <Sidebar guild={guild} />
      <main className="dashboard-main">
        <Outlet />
      </main>
    </div>
  );
}
