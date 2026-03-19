import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Mic,
  FileText,
  PanelLeftClose,
  PanelLeft,
  LogOut,
  Database,
} from "lucide-react";
import { logout, getUser } from "../api";

const NAV_ITEMS = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/interviews", icon: Mic, label: "Sessions" },
  { to: "/knowledge-base", icon: Database, label: "Knowledge Base" },
  { to: "/reports", icon: FileText, label: "Reports" },
];

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const user = getUser();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-black flex">
      {/* Sidebar */}
      <aside
        className={`flex flex-col border-r border-neutral-800 bg-neutral-950 transition-all duration-200 ${
          collapsed ? "w-[72px]" : "w-64"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-neutral-800">
          {!collapsed && (
            <span className="text-base font-bold tracking-tight text-white">LSSU</span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-neutral-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-neutral-800"
          >
            {collapsed ? (
              <PanelLeft className="w-5 h-5" />
            ) : (
              <PanelLeftClose className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? "bg-white text-black font-semibold"
                    : "text-neutral-400 hover:text-white hover:bg-neutral-800/60"
                } ${collapsed ? "justify-center" : ""}`
              }
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="text-sm">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-neutral-800 p-4">
          <div
            className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}
          >
            <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-sm text-neutral-300 font-medium flex-shrink-0">
              {user?.email?.[0]?.toUpperCase() || "U"}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm text-neutral-300 truncate">
                  {user?.email || "User"}
                </p>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="text-neutral-600 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-neutral-800"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-hidden bg-black">{children}</main>
    </div>
  );
}
