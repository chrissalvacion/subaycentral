import { GraduationCap } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center justify-center p-4">
      {/* Brand mark */}
      {/* <div className="mb-8 flex flex-col items-center gap-2">
        <h1 className="text-2xl font-bold text-white">SubayCentral</h1>
        <p className="text-slate-400 text-sm text-center">
          Intern Daily Accomplishment & Time Monitoring System
        </p>
      </div> */}
      {children}
    </div>
  );
}
