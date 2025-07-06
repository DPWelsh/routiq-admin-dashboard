import { SyncDashboard } from '@/components/dashboard/sync-dashboard';

export default function SyncDashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Data Synchronization</h1>
        <p className="text-muted-foreground">
          Monitor and manage patient data synchronization with Cliniko
        </p>
        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-2">Sync Options</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li><strong>Regular Sync:</strong> Respects 5-minute cooldown to prevent excessive API calls</li>
            <li><strong>Force Sync:</strong> Bypasses cooldown - use when you need immediate data updates</li>
          </ul>
        </div>
      </div>
      
      <SyncDashboard />
    </div>
  );
} 