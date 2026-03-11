import { DashboardLayout } from "@/components/layout/DashboardLayout";

export default function InternLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
