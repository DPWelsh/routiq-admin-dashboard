import { SignOutButton } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'

export default function SignOutPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Sign Out
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Are you sure you want to sign out of Routiq Hub?
          </p>
        </div>
        
        <div className="space-y-4">
          <SignOutButton redirectUrl="/">
            <Button className="w-full bg-red-600 hover:bg-red-700">
              Yes, Sign Me Out
            </Button>
          </SignOutButton>
          
          <Button variant="outline" className="w-full" asChild>
            <a href="/dashboard">
              Cancel, Go Back to Dashboard
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
} 