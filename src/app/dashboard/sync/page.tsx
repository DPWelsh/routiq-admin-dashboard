import { SyncDashboard } from '@/components/dashboard/sync-dashboard';

export default function SyncDashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Data Synchronization</h1>
        <p className="text-muted-foreground">
          Monitor and manage patient data synchronization with Cliniko
        </p>
      </div>
      
      <SyncDashboard />
    </div>
  );
} 