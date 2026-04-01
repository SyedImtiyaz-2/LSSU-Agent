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
  Mail,
  Menu,
  X,
  MessageSquare,
} from "lucide-react";
import { logout, getUser } from "../api";

const NAV_ITEMS = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/interviews", icon: Mic, label: "Sessions" },
  { to: "/chat", icon: MessageSquare, label: "Chatbot" },
  { to: "/invitations", icon: Mail, label: "Invitations" },
  { to: "/knowledge-base", icon: Database, label: "Knowledge Base" },
  { to: "/reports", icon: FileText, label: "Reports" },
];

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const user = getUser();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleNavClick = () => {
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen bg-black flex">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          flex flex-col border-r border-neutral-800 bg-neutral-950 transition-all duration-200
          fixed lg:relative inset-y-0 left-0 z-50
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          ${collapsed ? "lg:w-[72px] w-64" : "w-64"}
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-neutral-800">
          {!collapsed && (
            <span className="text-base font-bold tracking-tight text-white">LSSU</span>
          )}
          {/* Desktop toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:block text-neutral-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-neutral-800"
          >
            {collapsed ? (
              <PanelLeft className="w-5 h-5" />
            ) : (
              <PanelLeftClose className="w-5 h-5" />
            )}
          </button>
          {/* Mobile close */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden text-neutral-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-neutral-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={handleNavClick}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? "bg-white text-black font-semibold"
                    : "text-neutral-400 hover:text-white hover:bg-neutral-800/60"
                } ${collapsed ? "lg:justify-center" : ""}`
              }
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {(!collapsed || mobileOpen) && <span className="text-sm lg:hidden block">{label}</span>}
              {!collapsed && <span className="text-sm hidden lg:block">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-neutral-800 p-4">
          <div
            className={`flex items-center gap-3 ${collapsed ? "lg:justify-center" : ""}`}
          >
            <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-sm text-neutral-300 font-medium flex-shrink-0">
              {user?.email?.[0]?.toUpperCase() || "U"}
            </div>
            {(!collapsed || mobileOpen) && (
              <div className="flex-1 min-w-0 lg:hidden block">
                <p className="text-sm text-neutral-300 truncate">
                  {user?.email || "User"}
                </p>
              </div>
            )}
            {!collapsed && (
              <div className="flex-1 min-w-0 hidden lg:block">
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
      <main className="flex-1 overflow-hidden bg-black flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center justify-between h-14 px-4 border-b border-neutral-800 flex-shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-neutral-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-neutral-800"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-bold text-white">LSSU</span>
          <div className="w-8" />
        </div>
        <div className="flex-1 overflow-hidden">{children}</div>
      </main>
    </div>
  );
}
