/**
 * Environment Configuration for Debugging
 * Add to your Vercel environment variables for enhanced logging
 */

export const debugConfig = {
  // Enable debug logs (set DEBUG_LOGS=true in Vercel env vars)
  enableDebugLogs: process.env.DEBUG_LOGS === 'true',
  
  // Enable verbose API logging (set VERBOSE_API_LOGS=true in Vercel env vars)
  enableVerboseApiLogs: process.env.VERBOSE_API_LOGS === 'true',
  
  // Environment info
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isVercel: !!process.env.VERCEL,
  
  // Backend API URL
  backendApiUrl: process.env.NEXT_PUBLIC_API_URL || 'https://routiq-backend-prod.up.railway.app',
  
  // Vercel deployment info
  vercelRegion: process.env.VERCEL_REGION,
  vercelUrl: process.env.VERCEL_URL,
  
  // Log deployment context
  logDeploymentInfo() {
    console.log('🚀 Deployment Info:', {
      env: process.env.NODE_ENV,
      isVercel: this.isVercel,
      region: this.vercelRegion,
      url: this.vercelUrl,
      debugLogs: this.enableDebugLogs,
      verboseApiLogs: this.enableVerboseApiLogs,
      backendUrl: this.backendApiUrl
    })
  }
}

// Log deployment info on startup
if (typeof window === 'undefined') { // Server-side only
  debugConfig.logDeploymentInfo()
}
 