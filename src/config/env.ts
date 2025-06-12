import { z } from 'zod'

const envSchema = z.object({
  // Database - Main project database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  
  // Clerk
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1, 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required'),
  CLERK_SECRET_KEY: z.string().min(1, 'CLERK_SECRET_KEY is required'),
  
  // N8N Database (optional)
  N8N_DATABASE_URL: z.string().url().optional(),
  
  // Chatwoot Database (optional)
  CHATWOOT_DATABASE_URL: z.string().url().optional(),
  
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  
  // Security
  CORS_ORIGIN: z.string().default('https://app.routiq.ai'),
  RATE_LIMIT_MAX: z.string().transform(Number).default('100'),
  RATE_LIMIT_WINDOW: z.string().transform(Number).default('900000'),
  
  // Optional integrations
  GOOGLE_CLIENT_EMAIL: z.string().email().optional(),
  GOOGLE_PRIVATE_KEY: z.string().optional(),
  GOOGLE_SHEET_ID: z.string().optional(),
  SENTRY_DSN: z.string().url().optional(),
  ANALYTICS_ID: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
})

export type Env = z.infer<typeof envSchema>

function validateEnvironment(): Env {
  try {
    return envSchema.parse(process.env)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join('\n')
      console.error(`❌ Invalid environment variables:\n${missingVars}`)
      
      // In development, provide fallback values to prevent crashes
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ Using fallback environment values for development')
        return {
          DATABASE_URL: process.env.DATABASE_URL || 'postgresql://localhost:5432/fallback',
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || 'pk_test_fallback',
          CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || 'sk_test_fallback',
          N8N_DATABASE_URL: process.env.N8N_DATABASE_URL,
          CHATWOOT_DATABASE_URL: process.env.CHATWOOT_DATABASE_URL,
          NODE_ENV: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
          LOG_LEVEL: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
          CORS_ORIGIN: process.env.CORS_ORIGIN || 'https://app.routiq.ai',
          RATE_LIMIT_MAX: Number(process.env.RATE_LIMIT_MAX) || 100,
          RATE_LIMIT_WINDOW: Number(process.env.RATE_LIMIT_WINDOW) || 900000,
          GOOGLE_CLIENT_EMAIL: process.env.GOOGLE_CLIENT_EMAIL,
          GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY,
          GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID,
          SENTRY_DSN: process.env.SENTRY_DSN,
          ANALYTICS_ID: process.env.ANALYTICS_ID,
          OPENAI_API_KEY: process.env.OPENAI_API_KEY,
          NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        } as Env
      }
      
      throw new Error(`❌ Invalid environment variables:\n${missingVars}`)
    }
    throw error
  }
}

export const env = validateEnvironment()

// Export individual variables for convenience
export const {
  DATABASE_URL,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  CLERK_SECRET_KEY,
  N8N_DATABASE_URL,
  CHATWOOT_DATABASE_URL,
  NODE_ENV,
  LOG_LEVEL,
  CORS_ORIGIN,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW,
  OPENAI_API_KEY,
  NEXT_PUBLIC_APP_URL,
} = env

// Debug function
export function debugEnv() {
  console.log('🔧 Environment Configuration:', {
    NODE_ENV: env.NODE_ENV,
    hasClerkPublishableKey: !!env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    hasClerkSecretKey: !!env.CLERK_SECRET_KEY,
    hasDatabaseUrl: !!env.DATABASE_URL,
    hasChatwootDb: !!env.CHATWOOT_DATABASE_URL,
    hasN8nDb: !!env.N8N_DATABASE_URL,
    hasOpenAI: !!env.OPENAI_API_KEY,
  })
} 