"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function RootPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!profile) {
      router.replace("/login");
      return;
    }
    switch (profile.role) {
      case "admin":
        router.replace("/admin");
        break;
      case "faculty":
        router.replace("/faculty");
        break;
      case "intern":
        router.replace("/intern");
        break;
      default:
        router.replace("/login");
    }
  }, [profile, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 text-sm">Loading SubayCentral...</p>
      </div>
    </div>
  );
}
