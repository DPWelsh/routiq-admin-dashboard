'use client'

import { OrganizationSwitcher } from '@clerk/nextjs'

export function ClerkOrganizationSwitcher() {
  return (
    <OrganizationSwitcher 
      appearance={{
        elements: {
          rootBox: "flex items-center",
          organizationSwitcherTrigger: "px-3 py-2 rounded-md bg-white border border-gray-200 hover:bg-gray-50",
        }
      }}
      afterSelectOrganizationUrl="/dashboard"
      afterCreateOrganizationUrl="/dashboard"
      createOrganizationMode="modal"
      organizationProfileMode="modal"
    />
  )
}

// Simple organization display
export function OrganizationDisplay() {
  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-gray-600">Organization:</span>
      <ClerkOrganizationSwitcher />
    </div>
  )
} 