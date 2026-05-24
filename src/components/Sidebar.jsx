import { NavLink, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from "../hooks/useAuth.jsx";
import './Sidebar.css';
import NexusIcon from "../components/NexusIcon.jsx";

const NAV_ITEMS = [
  { key: "dashboard", path: "", icon: "⚡" },
  { key: "general", path: "general", icon: "⚙️" },
  { key: "hourly", path: "hourly", icon: "🕐" },
  { key: "moderation", path: "moderation", icon: "🛡️" },
  { key: "apply", path: "apply", icon: "📩" },
];

export default function Sidebar({ guild }) {
  const { t } = useTranslation();
  const { guildId } = useParams();
  const { user, logout } = useAuth();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <NexusIcon size={20} />
          <span className="logo-text">
            <NavLink to="/servers">Nexus</NavLink>
          </span>
        </div>
      </div>

      {guild && (
        <div className="sidebar-guild">
          {guild.icon ? (
            <img
              src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`}
              alt={guild.name}
              className="guild-icon"
            />
          ) : (
            <div className="guild-icon-placeholder">
              {guild.name[0]}
            </div>
          )}
          <span className="guild-name">{guild.name}</span>
        </div>
      )}

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.key}
            to={`/dashboard/${guildId}/${item.path}`}
            end={item.path === ''}
            className={({ isActive }) =>
              `nav-item ${isActive ? 'nav-item--active' : ''}`
            }
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{t(`nav.${item.key}`)}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        {user && (
          <div className="user-info">
            <img
              src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`}
              alt={user.username}
              className="user-avatar"
              onError={e => { e.target.src = `https://cdn.discordapp.com/embed/avatars/0.png`; }}
            />
            <div className="user-details">
              <span className="user-name">{user.username}</span>
            </div>
            <button className="logout-btn" onClick={logout} title={t('nav.logout')}>
              ↩
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
