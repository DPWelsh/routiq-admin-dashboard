import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Modify the database URL to include pgbouncer mode which disables prepared statements
const getDatabaseUrl = () => {
  const baseUrl = process.env.DATABASE_URL
  if (!baseUrl) return baseUrl
  
  // If using Supabase pooler, add pgbouncer mode to disable prepared statements
  if (baseUrl.includes('pooler.supabase.com')) {
    const url = new URL(baseUrl)
    url.searchParams.set('pgbouncer', 'true')
    return url.toString()
  }
  
  return baseUrl
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: ['error'],
  datasources: {
    db: {
      url: getDatabaseUrl()
    }
  }
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma 