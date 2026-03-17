"use client";

import { Menu, Bell } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface HeaderProps {
  onMenuClick: () => void;
  title?: string;
}

export function Header({ onMenuClick, title }: HeaderProps) {
  const { profile } = useAuth();

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center gap-3">
      {/* Menu button (mobile) */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
      >
        <Menu size={20} />
      </button>

      {/* Page title */}
      {title && (
        <h1 className="text-lg font-semibold text-slate-900 hidden sm:block">
          {title}
        </h1>
      )}

      <div className="ml-auto flex items-center gap-2">
        {/* <button className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
          <Bell size={18} />
        </button> */}
        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">
          <span className="text-white text-xs font-semibold">
            {profile?.full_name?.[0]?.toUpperCase() ?? "U"}
          </span>
        </div>
      </div>
    </header>
  );
}
