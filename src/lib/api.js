import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // /user エンドポイントの401はリダイレクトしない（認証チェック用）
    if (err.response?.status === 401 && !err.config.url.includes("/user")) {
      window.location.href = "/login";
    }
    return Promise.reject(err);
  },
);

export default api;
