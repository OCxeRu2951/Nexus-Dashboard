import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth.jsx";
import "./i18n/index.js";

import Login from "./pages/Login";
import Servers from "./pages/Servers";
import Dashboard from "./pages/Dashboard";
import General from "./pages/General";
import Hourly from "./pages/Hourly";
import Moderation from "./pages/Moderation";
import Apply from "./pages/Apply";
import DashboardLayout from "./components/DashboardLayout";

function AppRoutes() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/servers" element={<Servers />} />
        <Route path="/dashboard/:guildId" element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="general" element={<General />} />
          <Route path="hourly" element={<Hourly />} />
          <Route path="moderation" element={<Moderation />} />
          <Route path="apply" element={<Apply />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
