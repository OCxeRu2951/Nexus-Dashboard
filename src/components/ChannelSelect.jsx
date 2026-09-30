import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import api from "../lib/api";
import "./ChannelSelect.css";

export default function ChannelSelect({ value, onChange, placeholder, type }) {
  const { guildId } = useParams();
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/guilds/${guildId}/channels${type ? `?type=${type}` : ""}`)
      .then((res) => setChannels(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [guildId, type]);

  if (loading)
    return (
      <div className="channel-select-loading">
        <div className="spinner" style={{ width: 16, height: 16 }} />
      </div>
    );

  return (
    <select
      className="form-input channel-select"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder ?? "— 選択してください —"}</option>
      {channels.map((ch) => (
        <option key={ch.id} value={ch.id}>
          # {ch.name}
        </option>
      ))}
    </select>
  );
}
