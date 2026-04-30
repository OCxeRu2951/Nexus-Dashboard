import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';
import './Hourly.css';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const EMPTY_MESSAGE = {
  content: '',
  image: '',
  embed: null,
};

export default function Hourly() {
  const { t } = useTranslation();
  const { guildId } = useParams();
  const [channelId, setChannelId] = useState('');
  const [messages, setMessages] = useState({});
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [useEmbed, setUseEmbed] = useState(false);

  useEffect(() => {
    api.get(`/guilds/${guildId}/hourly`)
      .then(res => {
        setChannelId(res.data.channel_id ?? '');
        setMessages(res.data.messages ?? {});
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [guildId]);

  const handleSelectHour = (hour) => {
    const key = hour === 'default' ? 'default' : String(hour);
    setSelected(key);
    const msg = messages[key] ?? { ...EMPTY_MESSAGE };
    setUseEmbed(!!msg.embed);
  };

  const currentMsg = selected !== null ? (messages[selected] ?? { ...EMPTY_MESSAGE }) : null;

  const updateCurrentMsg = (field, value) => {
    setMessages(prev => ({
      ...prev,
      [selected]: {
        ...(prev[selected] ?? EMPTY_MESSAGE),
        [field]: value,
      },
    }));
  };

  const updateEmbed = (field, value) => {
    setMessages(prev => ({
      ...prev,
      [selected]: {
        ...(prev[selected] ?? EMPTY_MESSAGE),
        embed: {
          ...(prev[selected]?.embed ?? {}),
          [field]: value,
        },
      },
    }));
  };

  const toggleEmbed = (val) => {
    setUseEmbed(val);
    if (!val) {
      setMessages(prev => ({
        ...prev,
        [selected]: {
          ...(prev[selected] ?? EMPTY_MESSAGE),
          embed: null,
        },
      }));
    } else {
      setMessages(prev => ({
        ...prev,
        [selected]: {
          ...(prev[selected] ?? EMPTY_MESSAGE),
          embed: { title: '', description: '', color: '#5865f2' },
        },
      }));
    }
  };

  const deleteMessage = () => {
    setMessages(prev => {
      const next = { ...prev };
      delete next[selected];
      return next;
    });
    setSelected(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/guilds/${guildId}/hourly`, {
        channel_id: channelId,
        messages,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const hasMessage = (key) => !!messages[key];

  return (
    <div className="hourly-page fade-in">
      <div className="page-header">
        <h1 className="page-title">{t("hourly.title")}</h1>
        <p className="page-subtitle">
          時間ごとのアナウンスメッセージを設定します
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
        <div className="hourly-layout">
          {/* 左：チャンネル設定・時間選択 */}
          <div className="hourly-sidebar">
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{t("hourly.channel")}</label>
                <ChannelSelect
                  value={channelId}
                  onChange={setChannelId}
                  placeholder="— チャンネルを選択 —"
                />
              </div>
            </div>

            <div className="card">
              <p className="form-label" style={{ marginBottom: 12 }}>
                {t("hourly.messages")}
              </p>

              <div
                className={`hour-item ${selected === "default" ? "hour-item--active" : ""}`}
                onClick={() => handleSelectHour("default")}
              >
                <span className="hour-label">Default</span>
                {hasMessage("default") && <span className="hour-dot" />}
              </div>

              <div className="divider" style={{ margin: "8px 0" }} />

              <div className="hours-grid">
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className={`hour-item hour-item--grid ${selected === String(h) ? "hour-item--active" : ""}`}
                    onClick={() => handleSelectHour(h)}
                  >
                    <span className="hour-label">
                      {String(h).padStart(2, "0")}
                    </span>
                    {hasMessage(String(h)) && <span className="hour-dot" />}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 右：メッセージ編集 */}
          <div className="hourly-editor">
            {selected === null ? (
              <div className="hourly-empty">
                <span>🕐</span>
                <p>時間を選択してメッセージを編集します</p>
              </div>
            ) : (
              <div className="card fade-in">
                <div className="editor-header">
                  <h3 className="editor-title">
                    {selected === "default"
                      ? "Default"
                      : `${selected.padStart(2, "0")}:00`}
                    のメッセージ
                  </h3>
                  {hasMessage(selected) && (
                    <button
                      className="btn btn-danger"
                      style={{ padding: "6px 14px", fontSize: 13 }}
                      onClick={deleteMessage}
                    >
                      削除
                    </button>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">{t("hourly.content")}</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="{hour}:00 — 時報です。"
                    value={currentMsg?.content ?? ""}
                    onChange={(e) =>
                      updateCurrentMsg("content", e.target.value)
                    }
                    style={{ resize: "vertical" }}
                  />
                  <p className="form-hint">
                    プレースホルダー: <code>{"{hour}"}</code>{" "}
                    <code>{"{minute}"}</code>
                  </p>
                </div>

                <div className="form-group">
                  <label className="form-label">{t("hourly.imageUrl")}</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="https://example.com/image.png"
                    value={currentMsg?.image ?? ""}
                    onChange={(e) => updateCurrentMsg("image", e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">File URL</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="https://example.com/file.mp3"
                    value={currentMsg?.file_url ?? ""}
                    onChange={(e) =>
                      updateCurrentMsg("file_url", e.target.value)
                    }
                  />
                  <p className="form-hint">
                    {i18n.language === "ja"
                      ? "画像・音声・その他ファイルのURL"
                      : "URL of image, audio, or other file"}
                  </p>
                </div>

                <div className="embed-toggle-row">
                  <label className="form-label">Embed</label>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={useEmbed}
                      onChange={(e) => toggleEmbed(e.target.checked)}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>

                {useEmbed && (
                  <div className="embed-fields fade-in">
                    <div className="form-group">
                      <label className="form-label">
                        {t("hourly.embedTitle")}
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        value={currentMsg?.embed?.title ?? ""}
                        onChange={(e) => updateEmbed("title", e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">
                        {t("hourly.embedDescription")}
                      </label>
                      <textarea
                        className="form-input"
                        rows={3}
                        value={currentMsg?.embed?.description ?? ""}
                        onChange={(e) =>
                          updateEmbed("description", e.target.value)
                        }
                        style={{ resize: "vertical" }}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">
                        {t("hourly.embedColor")}
                      </label>
                      <div className="color-row">
                        <input
                          type="color"
                          className="color-picker"
                          value={currentMsg?.embed?.color ?? "#5865f2"}
                          onChange={(e) => updateEmbed("color", e.target.value)}
                        />
                        <input
                          type="text"
                          className="form-input"
                          value={currentMsg?.embed?.color ?? "#5865f2"}
                          onChange={(e) => updateEmbed("color", e.target.value)}
                          style={{ maxWidth: 140 }}
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Embed Image URL</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="https://example.com/image.png"
                        value={currentMsg?.embed?.image ?? ""}
                        onChange={(e) => updateEmbed("image", e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

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
        </div>
      )}
    </div>
  );
}
