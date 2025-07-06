# Clerk Quick Reference

## 🚀 Setup Checklist

- [ ] Install `@clerk/nextjs`
- [ ] Set environment variables (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`)  
- [ ] Enable Organizations in Clerk dashboard
- [ ] Configure middleware
- [ ] Set up providers in layout
- [ ] Create authentication pages

## 🔑 Environment Variables

```bash
# Required
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx

# Optional
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

## 🎯 Common Hooks

### Basic Authentication
```typescript
import { useUser, useAuth } from '@clerk/nextjs'

function Component() {
  const { isLoaded, isSignedIn, user } = useUser()
  const { signOut } = useAuth()
  
  if (!isLoaded) return <Loading />
  if (!isSignedIn) return <SignIn />
  
  return <div>Hello {user.firstName}!</div>
}
```

### Organization Management
```typescript
import { useOrganization, useOrganizationList } from '@clerk/nextjs'

function OrgComponent() {
  const { organization, membership } = useOrganization()
  const { userMemberships, setActive } = useOrganizationList()
  
  const isAdmin = membership?.role === 'admin'
  const switchOrg = (orgId: string) => setActive({ organization: orgId })
  
  return (
    <div>
      <h1>{organization?.name}</h1>
      {isAdmin && <AdminPanel />}
    </div>
  )
}
```

### Custom Organization Hook
```typescript
import { useClerkOrganization } from '@/hooks/useClerkOrganization'

function Dashboard() {
  const { 
    organizationId, 
    organizationName, 
    isAdmin, 
    userMemberships 
  } = useClerkOrganization()
  
  return <div>Org: {organizationName}</div>
}
```

## 🛡️ API Route Protection

### Basic Protection
```typescript
// app/api/protected/route.ts
import { auth } from '@clerk/nextjs/server'

export async function GET() {
  const { userId } = auth()
  
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  return Response.json({ userId })
}
```

### Organization Context
```typescript
// app/api/org-data/route.ts
import { getClerkOrganizationContext } from '@/lib/auth/clerk-request-context'

export async function GET(request: NextRequest) {
  const orgContext = getClerkOrganizationContext(request)
  
  if (!orgContext) {
    return Response.json({ error: 'Organization required' }, { status: 403 })
  }
  
  const data = await getOrgData(orgContext.organizationId)
  return Response.json(data)
}
```

### Advanced API Auth (Fallback)
```typescript
import { getApiAuth } from '@/lib/auth/api-auth'

export async function GET(request: NextRequest) {
  const auth = await getApiAuth(request)
  
  if (!auth.success) {
    return Response.json({ error: auth.error }, { status: auth.status })
  }
  
  // Use auth.context.organizationId
  return Response.json({ success: true })
}
```

## 🎨 UI Components

### Loading States
```typescript
function ProtectedPage() {
  const { isLoaded, userId } = useUser()
  
  if (!isLoaded) {
    return <div className="animate-pulse">Loading...</div>
  }
  
  if (!userId) {
    return <div>Please sign in</div>
  }
  
  return <MainContent />
}
```

### Organization Selector
```typescript
import { OrganizationSelector } from '@/components/organization/organization-selector'

function Header() {
  const handleOrgChange = (orgId: string, orgName: string) => {
    console.log('Switched to:', orgName)
  }
  
  return (
    <OrganizationSelector 
      onOrgChange={handleOrgChange}
      className="w-64"
    />
  )
}
```

### Permission-Based Rendering
```typescript
function AdminPanel() {
  const { isAdmin } = useClerkOrganization()
  
  if (!isAdmin) return null
  
  return <div>Admin only content</div>
}
```

## 🔄 Client-Side API Calls

### With Automatic Auth
```typescript
import { RoutiqAPI } from '@/lib/routiq-api'

function Component() {
  const api = new RoutiqAPI()
  
  const fetchData = async () => {
    try {
      const data = await api.getDashboard('org-id')
      console.log(data)
    } catch (error) {
      console.error('API error:', error)
    }
  }
  
  return <button onClick={fetchData}>Fetch Data</button>
}
```

### Manual Token Handling
```typescript
async function apiCall() {
  const token = await window.Clerk?.session?.getToken()
  
  const response = await fetch('/api/data', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
  })
  
  return response.json()
}
```

## 🚨 Error Handling

### Authentication Errors
```typescript
function Component() {
  const { isLoaded, isSignedIn, user } = useUser()
  
  if (!isLoaded) return <Loading />
  
  if (!isSignedIn) {
    return (
      <div className="text-center p-4">
        <p>Please sign in to continue</p>
        <SignInButton mode="modal">
          <button className="btn-primary">Sign In</button>
        </SignInButton>
      </div>
    )
  }
  
  return <MainContent />
}
```

### Organization Errors
```typescript
function OrgContent() {
  const { organization, isLoaded } = useOrganization()
  
  if (!isLoaded) return <Loading />
  
  if (!organization) {
    return (
      <div className="text-center p-4">
        <p>No organization selected</p>
        <CreateOrganization />
      </div>
    )
  }
  
  return <div>Org: {organization.name}</div>
}
```

## 🎯 Middleware Patterns

### Basic Setup
```typescript
// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)'])

export default clerkMiddleware((auth, req) => {
  if (isPublicRoute(req)) return
  auth().protect()
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
```

### Organization Middleware
```typescript
export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return NextResponse.next()
  
  const { userId, orgId, orgRole } = await auth()
  
  if (!userId) {
    return NextResponse.redirect(new URL('/sign-in', req.url))
  }
  
  // Add org headers for API routes
  if (req.nextUrl.pathname.startsWith('/api/')) {
    const headers = new Headers(req.headers)
    headers.set('x-clerk-user-id', userId)
    if (orgId) {
      headers.set('x-clerk-org-id', orgId)
      headers.set('x-clerk-org-role', orgRole || '')
    }
    return NextResponse.next({ request: { headers } })
  }
  
  return NextResponse.next()
})
```

## 🔧 Debugging

### Environment Check
```typescript
import { debugClerkConfig } from '@/lib/auth/clerk-config'
import { debugEnv } from '@/config/env'

// In console or component
debugClerkConfig()
debugEnv()
```

### User Info Debug
```typescript
function DebugUser() {
  const { user, organization, membership } = useUser()
  
  return (
    <pre>
      {JSON.stringify({
        userId: user?.id,
        orgId: organization?.id,
        role: membership?.role
      }, null, 2)}
    </pre>
  )
}
```

## 📱 Common UI Patterns

### Sign In Button
```typescript
import { SignInButton, SignedIn, SignedOut } from '@clerk/nextjs'

function AuthButton() {
  return (
    <>
      <SignedOut>
        <SignInButton mode="modal">
          <button>Sign In</button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <UserButton />
      </SignedIn>
    </>
  )
}
```

### Organization Switcher
```typescript
import { OrganizationSwitcher } from '@clerk/nextjs'

function Header() {
  return (
    <OrganizationSwitcher 
      appearance={{
        elements: {
          organizationSwitcherTrigger: 'px-4 py-2 rounded-md border'
        }
      }}
    />
  )
}
```

## 🚀 Performance Tips

1. **Use dynamic imports** for Clerk components
2. **Enable SSR selectively** based on needs  
3. **Cache organization data** when possible
4. **Implement loading states** for better UX
5. **Use React Query** with Clerk context as keys

## 🔍 TypeScript Types

```typescript
// User types
import type { User, Organization, OrganizationMembership } from '@clerk/nextjs/server'

// Custom context type
interface ClerkContext {
  userId: string
  organizationId: string | null
  role: 'admin' | 'member' | null
}

// API response with auth
interface AuthenticatedResponse<T> {
  data: T
  user: User
  organization?: Organization
}
```

---

For detailed explanations, see the full [Clerk Integration Guide](./CLERK_INTEGRATION_GUIDE.md). 