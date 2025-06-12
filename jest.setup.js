// Jest setup file
import '@testing-library/jest-dom'
 
// Mock environment variables
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_test'
process.env.CLERK_SECRET_KEY = 'sk_test_test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test' 