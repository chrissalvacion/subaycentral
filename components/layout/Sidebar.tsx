"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Building2,
  ClipboardList,
  Settings,
  LogOut,
  ChevronRight,
  GraduationCap,
  FileBarChart,
  Clock,
  MessageSquare,
  UserCircle,
  Home,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const adminNav: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: <LayoutDashboard size={18} /> },
  { label: "Accounts", href: "/admin/accounts", icon: <Users size={18} /> },
  { label: "Programs", href: "/admin/programs", icon: <BookOpen size={18} /> },
  {
    label: "Partner Agencies",
    href: "/admin/agencies",
    icon: <Building2 size={18} />,
  },
  {
    label: "Deployments",
    href: "/admin/deployments",
    icon: <ClipboardList size={18} />,
  },
  { label: "Settings", href: "/admin/settings", icon: <Settings size={18} /> },
];

const facultyNav: NavItem[] = [
  { label: "Dashboard", href: "/faculty", icon: <LayoutDashboard size={18} /> },
  {
    label: "My Interns",
    href: "/faculty/interns",
    icon: <GraduationCap size={18} />,
  },
  {
    label: "Reports",
    href: "/faculty/reports",
    icon: <FileBarChart size={18} />,
  },
  {
    label: "Settings",
    href: "/faculty/settings",
    icon: <Settings size={18} />,
  },
];

const internNav: NavItem[] = [
  { label: "Home", href: "/intern", icon: <Home size={18} /> },
  {
    label: "Daily Records",
    href: "/intern/records",
    icon: <ClipboardList size={18} />,
  },
  { label: "Time Records", href: "/intern/time", icon: <Clock size={18} /> },
  {
    label: "Feedback",
    href: "/intern/feedback",
    icon: <MessageSquare size={18} />,
  },
  {
    label: "My Profile",
    href: "/intern/profile",
    icon: <UserCircle size={18} />,
  },
  {
    label: "Settings",
    href: "/intern/settings",
    icon: <Settings size={18} />,
  },
];

function NavGroup({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const isActive =
          item.href === "/admin" ||
          item.href === "/faculty" ||
          item.href === "/intern"
            ? pathname === item.href
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={[
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              isActive
                ? "bg-indigo-600 text-white"
                : "text-slate-300 hover:bg-slate-700 hover:text-white",
            ].join(" ")}
          >
            {item.icon}
            <span>{item.label}</span>
            {isActive && <ChevronRight size={14} className="ml-auto" />}
          </Link>
        );
      })}
    </nav>
  );
}

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { profile, signOut } = useAuth();

  const navItems =
    profile?.role === "admin"
      ? adminNav
      : profile?.role === "faculty"
        ? facultyNav
        : internNav;

  const roleLabel =
    profile?.role === "admin"
      ? "Administrator"
      : profile?.role === "faculty"
        ? "Faculty"
        : "Intern";

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={[
          "fixed top-0 left-0 h-full w-64 bg-slate-900 z-40 flex flex-col transition-transform duration-300",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <GraduationCap size={18} className="text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">
                SubayCentral
              </p>
              <p className="text-slate-400 text-xs">OJT Monitoring</p>
            </div>
          </div>
        </div>

        {/* User info */}
        <div className="px-5 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-semibold">
                {profile?.full_name?.[0]?.toUpperCase() ?? "U"}
              </span>
            </div>
            <div className="overflow-hidden">
              <p className="text-white text-sm font-medium truncate">
                {profile?.full_name ?? "Loading..."}
              </p>
              <p className="text-slate-400 text-xs">{roleLabel}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <NavGroup items={navItems} />
        </div>

        {/* Sign out */}
        <div className="px-3 py-4 border-t border-slate-700">
          <button
            onClick={signOut}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
