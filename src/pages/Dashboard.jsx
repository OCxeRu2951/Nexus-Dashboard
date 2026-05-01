import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';
import './Dashboard.css';

export default function Dashboard() {
  const { t } = useTranslation();
  const { guildId } = useParams();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/guilds/${guildId}/stats`)
      .then(res => setStats(res.data))
      .catch(() => setStats({ members: 0, warnings: 0, polls: 0 }))
      .finally(() => setLoading(false));
  }, [guildId]);

  const statCards = [
    { key: 'members', icon: '👥', value: stats?.members ?? 0, color: '#5865f2' },
    { key: 'warnings', icon: '⚠️', value: stats?.warnings ?? 0, color: '#f0b232' },
    { key: 'polls', icon: '📊', value: stats?.polls ?? 0, color: '#23a55a' },
  ];

  return (
    <div className="dashboard-page fade-in">
      <div className="page-header">
        <h1 className="page-title">{t('dashboard.title')}</h1>
        <p className="page-subtitle">サーバーの概要を確認できます</p>
      </div>

      {loading ? (
        <div className="dashboard-loading">
          <div className="spinner" />
        </div>
      ) : (
        <div className="stats-grid">
          {statCards.map(card => (
            <div key={card.key} className="stat-card">
              <div className="stat-icon" style={{ background: `${card.color}20`, color: card.color }}>
                {card.icon}
              </div>
              <div className="stat-info">
                <span className="stat-value">{card.value.toLocaleString()}</span>
                <span className="stat-label">{t(`dashboard.stats.${card.key}`)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="dashboard-cards">
        <div className="card">
          <h3 className="card-title">🕐 時報設定</h3>
          <p className="card-desc">時間ごとのアナウンスメッセージを設定します</p>
          <Link to={`/dashboard/${guildId}/hourly`} className="btn btn-secondary" style={{ marginTop: '16px', display: 'inline-flex' }}>
            設定する →
          </Link>
        </div>
        <div className="card">
          <h3 className="card-title">🛡️ モデレーション</h3>
          <p className="card-desc">ログチャンネルや警告しきい値を設定します</p>
          <Link to={`/dashboard/${guildId}/moderation`} className="btn btn-secondary" style={{ marginTop: '16px', display: 'inline-flex' }}>
            設定する →
          </Link>
        </div>
        <div className="card">
          <h3 className="card-title">⚙️ 一般設定</h3>
          <p className="card-desc">AFK時間やデータ保持期間を設定します</p>
          <Link to={`/dashboard/${guildId}/general`} className="btn btn-secondary" style={{ marginTop: '16px', display: 'inline-flex' }}>
            設定する →
          </Link>
        </div>
      </div>
    </div>
  );
}
