"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@/lib/types";
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
  ChevronUp,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const adminNav: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: <LayoutDashboard size={18} /> },
  { label: "Deployments", href: "/admin/deployments", icon: <ClipboardList size={18} />,},

  { label: "Programs", href: "/admin/programs", icon: <BookOpen size={18} /> },
  {
    label: "Partner Agencies",
    href: "/admin/agencies",
    icon: <Building2 size={18} />,
  },
  { label: "Accounts", href: "/admin/accounts", icon: <Users size={18} /> },
  { label: "Settings", href: "/admin/settings", icon: <Settings size={18} /> },
];

const facultyNav: NavItem[] = [
  { label: "Dashboard", href: "/faculty", icon: <LayoutDashboard size={18} /> },
  {
    label: "Deployments",
    href: "/faculty/deployments",
    icon: <ClipboardList size={18} />,
  },
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
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors [&_span]:!text-white [&_svg]:!text-white",
              isActive
                ? "bg-indigo-600 !text-white"
                : "!text-white hover:bg-slate-700 hover:!text-white",
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const navByRole: Record<UserRole, NavItem[]> = {
    admin: adminNav,
    faculty: facultyNav,
    intern: internNav,
  };

  const roleLabels: Record<UserRole, string> = {
    admin: "Administrator",
    faculty: "Faculty",
    intern: "Intern",
  };

  const role = profile?.role;
  const navItems = role ? navByRole[role] : [];

  const roleLabel = role ? roleLabels[role] : "Loading role...";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
              <p className="text-slate-200 text-xs">OJT Monitoring</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <NavGroup items={navItems} />
        </div>

        {/* User menu */}
        <div className="px-3 py-4 border-t border-slate-700" ref={menuRef}>
          <div className="relative">
            <div className="flex items-center gap-3 px-2">
              <button
                type="button"
                onClick={() => setMenuOpen((value) => !value)}
                className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 border border-indigo-500 hover:bg-indigo-500 transition-colors"
                aria-label="Open user menu"
              >
                <span className="text-white text-sm font-semibold">
                  {profile?.full_name?.[0]?.toUpperCase() ?? "U"}
                </span>
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm font-medium truncate">
                  {profile?.full_name ?? "Loading..."}
                </p>
                <p className="text-slate-200 text-xs">{roleLabel}</p>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen((value) => !value)}
                className="p-1.5 rounded-md text-slate-200 hover:text-white hover:bg-slate-700 transition-colors"
                aria-label="Toggle user menu"
              >
                <ChevronUp
                  size={16}
                  className={menuOpen ? "rotate-180 transition-transform" : "transition-transform"}
                />
              </button>
            </div>

            {menuOpen && (
              <div className="absolute bottom-12 left-0 right-0 bg-slate-800 border border-slate-700 rounded-lg p-1 shadow-xl">
                <button
                  type="button"
                  onClick={signOut}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm font-medium text-slate-100 hover:bg-slate-700 hover:text-white transition-colors"
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
