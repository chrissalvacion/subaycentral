import { DashboardLayout } from "@/components/layout/DashboardLayout";

export default function FacultyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout requiredRole="faculty">{children}</DashboardLayout>;
}
