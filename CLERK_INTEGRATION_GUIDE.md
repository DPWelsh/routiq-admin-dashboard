# Clerk Integration Guide

## Overview

This project uses [Clerk](https://clerk.com/) for authentication and organization management. Clerk provides a complete authentication solution with built-in organization (multi-tenancy) support, making it perfect for SaaS applications where users can belong to multiple organizations with different roles.

## 🚀 Quick Start

### 1. Environment Variables

Create a `.env.local` file with the following variables:

```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=sk_test_your_secret_here

# Optional: Set your app URL (defaults to localhost:3000)
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### 2. Clerk Dashboard Setup

1. Create a [Clerk account](https://dashboard.clerk.com/)
2. Create a new application
3. Enable **Organizations** in the Clerk dashboard
4. Copy your publishable key and secret key to `.env.local`

### 3. Project Structure

```
src/
├── components/
│   ├── providers/
│   │   ├── clerk-provider.tsx     # Main Clerk provider setup
│   │   └── dynamic-clerk.tsx      # Dynamic import wrapper
│   └── organization/
│       └── organization-selector.tsx # Multi-org selection component
├── hooks/
│   └── useClerkOrganization.ts     # Clerk hooks wrapper
├── lib/
│   ├── auth/
│   │   ├── clerk-config.ts         # Clerk configuration
│   │   ├── clerk-request-context.ts # Request context utilities
│   │   └── api-auth.ts             # API authentication helpers
│   └── routiq-api.ts               # API client with Clerk integration
├── middleware.ts                   # Clerk middleware setup
└── app/
    ├── sign-in/[[...sign-in]]/     # Authentication pages
    ├── sign-up/[[...sign-up]]/
    └── layout.tsx                  # Root layout with providers
```

## 🔧 Core Components

### 1. Clerk Provider Setup

**File: `src/components/providers/clerk-provider.tsx`**

```typescript
import { ClerkProvider } from '@clerk/nextjs'

export function AuthProvider({ children }: { children: ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

  return (
    <ClerkProvider 
      publishableKey={publishableKey}
      afterSignOutUrl="/sign-in"
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      appearance={{
        variables: {
          colorPrimary: '#000000',
        },
      }}
    >
      {children}
    </ClerkProvider>
  )
}
```

**Key Features:**
- Automatic redirect URLs for sign-in/sign-up/sign-out
- Custom appearance configuration
- Error handling for missing environment variables

### 2. Dynamic Loading

**File: `src/components/providers/dynamic-clerk.tsx`**

```typescript
const AuthProvider = dynamic(
  () => import('./clerk-provider').then(mod => ({ default: mod.AuthProvider })),
  {
    ssr: false,
    loading: () => <LoadingSpinner />
  }
)
```

**Why Dynamic Loading?**
- Prevents hydration issues
- Faster initial page load
- Better error handling during development

### 3. Middleware Configuration

**File: `src/middleware.ts`**

```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/health',
])

export default clerkMiddleware(async (auth, req) => {
  // Allow public routes
  if (isPublicRoute(req)) {
    return NextResponse.next()
  }

  const { userId, orgId, orgRole, orgSlug } = await auth()
  
  // Require authentication
  if (!userId) {
    if (req.nextUrl.pathname.startsWith('/api/')) {
      return new Response('Unauthorized', { status: 401 })
    }
    return NextResponse.redirect(new URL('/sign-in', req.url))
  }

  // Set organization headers for API routes
  if (req.nextUrl.pathname.startsWith('/api/')) {
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-clerk-user-id', userId)
    if (orgId) {
      requestHeaders.set('x-clerk-org-id', orgId)
      requestHeaders.set('x-clerk-org-role', orgRole || '')
      requestHeaders.set('x-clerk-org-slug', orgSlug || '')
    }
    
    return NextResponse.next({
      request: { headers: requestHeaders }
    })
  }

  return NextResponse.next()
})
```

**Key Features:**
- Public route protection
- Automatic organization context injection
- API route authentication
- Proper redirect handling for unauthorized users

## 🏢 Organization Management

### 1. Organization Hook

**File: `src/hooks/useClerkOrganization.ts`**

```typescript
export function useClerkOrganization() {
  const { user } = useUser()
  const { organization, membership } = useOrganization()
  const { userMemberships } = useOrganizationList()

  return {
    // User info
    user,
    userId: user?.id,
    
    // Current organization
    organization,
    organizationId: organization?.id,
    organizationName: organization?.name,
    
    // User's role in current organization
    membershipRole: membership?.role,
    isAdmin: membership?.role === 'admin',
    isMember: membership?.role === 'member',
    
    // All organizations user belongs to
    userMemberships: userMemberships?.data || [],
    
    // Utility functions
    hasOrganization: !!organization,
    canInviteMembers: membership?.role === 'admin',
    canManageOrganization: membership?.role === 'admin',
  }
}
```

### 2. Organization Selector Component

**File: `src/components/organization/organization-selector.tsx`**

```typescript
export function OrganizationSelector({ 
  selectedOrgId, 
  onOrgChange 
}: OrganizationSelectorProps) {
  const { userMemberships } = useClerkOrganization()
  const { setActive } = useOrganizationList()
  
  const handleOrgChange = async (orgId: string) => {
    // Switch Clerk's active organization
    await setActive({ organization: orgId })
    
    // Notify parent component
    onOrgChange?.(orgId, selectedMembership.organization.name)
  }

  return (
    <Select value={selectedOrgId} onValueChange={handleOrgChange}>
      {/* Organization list with roles */}
    </Select>
  )
}
```

**Features:**
- Lists all user organizations
- Shows user roles (Admin/Member) with badges
- Switches active organization context
- Provides callback for parent components

## 🔐 API Authentication

### 1. API Route Protection

**File: `src/lib/auth/api-auth.ts`**

```typescript
export async function getApiAuth(request: NextRequest) {
  try {
    // Get session token from headers or cookies
    let sessionToken = request.headers.get('authorization')?.substring(7) ||
                      request.cookies.get('__session')?.value

    if (!sessionToken) {
      return { success: false, error: 'No session token', status: 401 }
    }

    // Verify token with Clerk
    const verificationResult = await verifyToken(sessionToken, {
      secretKey: process.env.CLERK_SECRET_KEY
    })

    const userId = verificationResult.sub
    const orgContext = await getOrganizationContext(userId)

    return {
      success: true,
      context: {
        organizationId: orgContext.organizationId,
        userRole: orgContext.userRole,
        clerkUserId: userId,
      }
    }
  } catch (error) {
    return { success: false, error: error.message, status: 401 }
  }
}
```

### 2. Client-Side API Calls

**File: `src/lib/routiq-api.ts`**

```typescript
export class RoutiqAPI {
  private async getAuthHeaders(): Promise<HeadersInit> {
    try {
      // Get Clerk session token
      const token = await window.Clerk?.session?.getToken()
      
      return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    } catch (error) {
      console.error('Failed to get auth token:', error)
      return { 'Content-Type': 'application/json' }
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = await this.getAuthHeaders()
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: { ...headers, ...options.headers },
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`)
    }

    return response.json()
  }
}
```

## 🎨 Authentication Pages

### Sign-In Page

**File: `src/app/sign-in/[[...sign-in]]/page.tsx`**

```typescript
export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <SignIn 
        appearance={{
          elements: {
            formButtonPrimary: 'bg-primary hover:bg-primary/90',
            card: 'shadow-2xl',
          }
        }}
      />
    </div>
  )
}
```

**Features:**
- Custom styling with Tailwind classes
- Responsive design
- Branded appearance
- Background image support

## 📝 Environment Configuration

**File: `src/config/env.ts`**

```typescript
const envSchema = z.object({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  // ... other environment variables
})

export const env = envSchema.parse(process.env)
```

**Features:**
- Runtime environment validation
- Type-safe environment variables
- Development fallbacks
- Clear error messages for missing variables

## 🔄 Authentication Flow

### 1. User Signs In
1. User visits protected route
2. Middleware redirects to `/sign-in`
3. Clerk handles authentication
4. User is redirected to intended page

### 2. Organization Selection
1. User selects organization from dropdown
2. `setActive()` updates Clerk's organization context
3. Middleware injects organization headers
4. API routes receive organization context

### 3. API Authentication
1. Client gets Clerk session token
2. Token sent in `Authorization` header
3. Server verifies token and extracts user/org context
4. API logic uses authenticated context

## 🛠️ Common Patterns

### 1. Protected Component

```typescript
function ProtectedComponent() {
  const { isLoaded, userId } = useUser()
  
  if (!isLoaded) return <LoadingSpinner />
  if (!userId) return <div>Please sign in</div>
  
  return <div>Protected content</div>
}
```

### 2. Organization-Specific Data

```typescript
function OrganizationDashboard() {
  const { organizationId, isAdmin } = useClerkOrganization()
  
  const { data } = useQuery({
    queryKey: ['dashboard', organizationId],
    queryFn: () => api.getDashboard(organizationId),
    enabled: !!organizationId
  })
  
  return (
    <div>
      {isAdmin && <AdminPanel />}
      <Dashboard data={data} />
    </div>
  )
}
```

### 3. API Route with Organization Context

```typescript
export async function GET(request: NextRequest) {
  const orgContext = getClerkOrganizationContext(request)
  
  if (!orgContext) {
    return NextResponse.json({ error: 'Organization required' }, { status: 403 })
  }
  
  const data = await getDashboardData(orgContext.organizationId)
  return NextResponse.json(data)
}
```

## 🚨 Troubleshooting

### Common Issues

1. **Hydration Mismatch**
   - Solution: Use dynamic imports for Clerk components
   - Set `ssr: false` in dynamic imports

2. **Missing Organization Context**
   - Check if user belongs to an organization
   - Verify organization is active in Clerk dashboard

3. **API Authentication Failing**
   - Verify `CLERK_SECRET_KEY` is set correctly
   - Check if session token is being sent properly

4. **Middleware Not Working**
   - Ensure middleware is properly configured
   - Check route matchers for public routes

### Debug Commands

```typescript
// Check Clerk configuration
import { debugClerkConfig } from '@/lib/auth/clerk-config'
debugClerkConfig()

// Check environment variables
import { debugEnv } from '@/config/env'
debugEnv()
```

## 📚 Additional Resources

- [Clerk Documentation](https://clerk.com/docs)
- [Clerk Next.js Integration](https://clerk.com/docs/nextjs/overview)
- [Clerk Organizations](https://clerk.com/docs/organizations/overview)
- [Clerk Middleware](https://clerk.com/docs/references/nextjs/clerk-middleware)

## 🔄 Migration Guide

### From Other Auth Solutions

1. **Replace auth provider** with Clerk provider
2. **Update middleware** to use Clerk middleware
3. **Modify API routes** to use Clerk authentication
4. **Update components** to use Clerk hooks
5. **Configure environment variables**

### Organization Setup

1. Enable organizations in Clerk dashboard
2. Create initial organizations
3. Invite users to organizations
4. Set up organization roles (admin/member)
5. Update UI to show organization selector

## 🎯 Best Practices

1. **Always use TypeScript** for type safety
2. **Implement proper loading states** for auth checks
3. **Use organization context** for multi-tenant data
4. **Implement proper error handling** for auth failures
5. **Test authentication flows** thoroughly
6. **Keep environment variables secure**
7. **Use Clerk's built-in components** when possible
8. **Implement proper permission checks** based on roles

---

This guide provides a comprehensive overview of the Clerk integration. For specific implementation details, refer to the actual source files in the project. 