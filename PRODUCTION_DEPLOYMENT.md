# Production Deployment Guide - Vercel

This guide covers deploying the Routiq Admin Dashboard to Vercel with production-grade configuration.

## 🚀 Quick Start

1. **Install dependencies**
   ```bash
   npm ci
   ```

2. **Build and test locally**
   ```bash
   npm run type-check
   npm run build:production
   npm run start
   ```

3. **Deploy to Vercel**
   ```bash
   vercel --prod
   ```

## 📋 Prerequisites

- Node.js 18+ and npm 8+
- Vercel CLI installed (`npm i -g vercel`)
- Access to required environment variables

## 🔧 Environment Variables

Required environment variables for production:

### Authentication (Clerk)
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_your_key_here
CLERK_SECRET_KEY=sk_live_your_key_here
CLERK_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

### Database
```
DATABASE_URL=your_production_database_url
DIRECT_URL=your_direct_database_url
```

### API Configuration
```
NEXT_PUBLIC_API_URL=https://routiq-backend-v10-production.up.railway.app
NEXT_PUBLIC_DEFAULT_ORG_ID=org_your_org_id_here
```

### Production Settings
```
NODE_ENV=production
NEXT_PUBLIC_ENABLE_DEBUG=false
```

## 📦 Vercel Configuration

The project includes optimized configurations:

- **`vercel.json`** - Deployment settings, security headers, function timeouts
- **`next.config.js`** - Production optimizations, security headers, image optimization
- **`tsconfig.json`** - TypeScript production settings

## 🔧 Production Optimizations

### Security Headers
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Strict-Transport-Security
- Content Security Policy for Clerk integration

### Performance
- Image optimization with WebP/AVIF
- Package import optimization
- Compression enabled
- API route caching

### API Proxy Architecture
- Next.js API routes proxy backend calls to avoid CORS
- Server-side API calls for better security
- Proper error handling and retry logic

## 🏗️ Build Process

### Local Development
```bash
npm run dev
```

### Production Build
```bash
npm run build:production
npm run start
```

### Type Checking
```bash
npm run type-check
```

### Linting
```bash
npm run lint:fix
```

## 🚀 Deployment Steps

### 1. Connect Repository
```bash
vercel login
vercel --confirm
```

### 2. Configure Environment Variables
In Vercel dashboard or via CLI:
```bash
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
vercel env add CLERK_SECRET_KEY
# ... add all required env vars
```

### 3. Deploy
```bash
vercel --prod
```

## 🔍 Monitoring & Debugging

### Build Logs
- Check Vercel dashboard for build logs
- Monitor function performance
- Review error logs

### Health Checks
- `/api/health` - Basic health check
- `/api/clerk/status` - Authentication status

### Performance Monitoring
- Core Web Vitals in Vercel Analytics
- Function execution times
- Error rates

## 🛠️ Troubleshooting

### Common Issues

1. **CORS Errors**
   - Solution: API routes proxy backend calls
   - Check `src/lib/routiq-api.ts` uses local routes

2. **Environment Variables**
   - Verify all required vars are set in Vercel
   - Check variable names match exactly

3. **Build Failures**
   - Run `npm run type-check` locally
   - Fix TypeScript errors before deploying

4. **Clerk Authentication**
   - Verify publishable key matches environment
   - Check webhook endpoints are configured

### Performance Optimization

1. **Bundle Analysis**
   ```bash
   npm run build:analyze
   ```

2. **Image Optimization**
   - All images use Next.js Image component
   - WebP/AVIF formats enabled

3. **API Optimization**
   - Response caching where appropriate
   - Error handling with retries

## 📁 Project Structure

```
├── src/
│   ├── app/
│   │   ├── api/           # API routes (proxy to backend)
│   │   ├── dashboard/     # Main dashboard pages
│   │   └── layout.tsx     # Root layout with providers
│   ├── components/        # Reusable UI components
│   ├── lib/              # Utilities and API clients
│   └── hooks/            # Custom React hooks
├── public/               # Static assets
├── vercel.json          # Vercel configuration
├── next.config.js       # Next.js configuration
└── package.json         # Dependencies and scripts
```

## 🔐 Security Best Practices

1. **Environment Variables**
   - Never commit secrets to Git
   - Use Vercel environment variables
   - Separate dev/staging/prod environments

2. **API Security**
   - All API routes use Clerk authentication
   - Organization-scoped data access
   - Request validation and sanitization

3. **Content Security Policy**
   - Configured for Clerk integration
   - Restricts script sources
   - Prevents XSS attacks

## 📊 Performance Targets

- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Time to Interactive**: < 3.0s
- **Cumulative Layout Shift**: < 0.1

## 🚦 Status Monitoring

Monitor these endpoints post-deployment:

- `https://your-domain.vercel.app/` - Main application
- `https://your-domain.vercel.app/api/health` - Health check
- `https://your-domain.vercel.app/api/clerk/status` - Auth status

## 📞 Support

For deployment issues:
1. Check Vercel dashboard logs
2. Review environment variables
3. Test API endpoints individually
4. Check backend connectivity

## 🔄 Continuous Deployment

The project is configured for automatic deployment:
- Push to `main` branch triggers production deployment
- Pull requests create preview deployments
- Environment variables are inherited per environment 