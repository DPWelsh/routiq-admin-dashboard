import { ClientDashboardLayout } from "@/components/layout/client-dashboard-layout"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Middleware handles authentication - if we reach here, user is authenticated
  return (
    <ClientDashboardLayout>
      {children}
    </ClientDashboardLayout>
  )
} 