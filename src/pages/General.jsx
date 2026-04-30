import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';
import './General.css';

const DEFAULTS = {
  afk_hours: 24,
  poll_days: 7,
  warnings_days: 90,
  application_days: 90,
};

export default function General() {
  const { t } = useTranslation();
  const { guildId } = useParams();
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get(`/guilds/${guildId}/settings`)
      .then(res => setSettings({ ...DEFAULTS, ...res.data }))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [guildId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/guilds/${guildId}/settings`, settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const fields = [
    { key: 'afk_hours', min: 1, max: 720 },
    { key: 'poll_days', min: 1, max: 365 },
    { key: 'warnings_days', min: 1, max: 365 },
    { key: 'application_days', min: 1, max: 365 },
  ];

  return (
    <div className="general-page fade-in">
      <div className="page-header">
        <h1 className="page-title">{t('general.title')}</h1>
        <p className="page-subtitle">データ保持期間やBot動作の設定</p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <div className="spinner" />
        </div>
      ) : (
        <div className="card">
          {fields.map(field => (
            <div className="form-group" key={field.key}>
              <label className="form-label">{t(`general.${field.key}`)}</label>
              <div className="number-input-wrap">
                <input
                  type="number"
                  className="form-input number-input"
                  value={settings[field.key]}
                  min={field.min}
                  max={field.max}
                  onChange={e => setSettings(prev => ({
                    ...prev,
                    [field.key]: Number(e.target.value),
                  }))}
                />
              </div>
            </div>
          ))}

          <div className="divider" />

          <div className="save-row">
            {saved && (
              <span className="badge badge-success">✓ {t('common.success')}</span>
            )}
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <div className="spinner" style={{ width: 16, height: 16 }} /> : null}
              {t('common.save')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
