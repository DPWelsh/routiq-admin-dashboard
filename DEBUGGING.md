# Debugging Guide for Routiq Admin Dashboard

## Enhanced Logging System

The application now includes comprehensive logging for debugging issues in production.

## Viewing Logs in Vercel

1. **Go to Vercel Dashboard** → Your Project → Functions tab
2. **Click on any function** (like `/api/active-patients`)
3. **View real-time logs** in the Functions panel
4. **Logs are structured JSON** with timestamps and context

## Log Types

### 🔵 [INFO] - Normal Operations
- API requests and responses
- Successful operations
- User actions

### 🟡 [WARN] - Warnings
- Non-critical issues
- Fallback behaviors

### 🔴 [ERROR] - Errors
- Failed API calls
- Authentication issues
- System errors with full stack traces

### 🟢 [DEBUG] - Debug Information
- Detailed request flows
- Variable states
- Only shown when `DEBUG_LOGS=true`

## Environment Variables for Enhanced Debugging

Add these to your **Vercel Environment Variables**:

```bash
# Enable debug logs (shows detailed request flows)
DEBUG_LOGS=true

# Enable verbose API logging (shows all API request/response details)
VERBOSE_API_LOGS=true

# Your backend API URL (already set)
NEXT_PUBLIC_API_URL=https://routiq-backend-v10-production.up.railway.app
```

## Log Categories

### Middleware Logs
```json
{
  "type": "middleware",
  "message": "Processing request",
  "context": {
    "pathname": "/api/active-patients",
    "method": "GET",
    "userAgent": "...",
    "duration_ms": 45
  }
}
```

### Authentication Logs
```json
{
  "type": "auth",
  "message": "Clerk auth result",
  "context": {
    "userId": "present",
    "pathname": "/dashboard"
  }
}
```

### Cliniko API Logs
```json
{
  "type": "cliniko",
  "message": "Backend response",
  "context": {
    "status": 200,
    "duration_ms": 1200,
    "organizationId": "org_xxxxx"
  }
}
```

### API Request/Response Logs
```json
{
  "type": "api_request",
  "message": "API GET /api/active-patients",
  "context": {
    "routeName": "active-patients-proxy",
    "userAgent": "Mozilla/5.0...",
    "origin": "https://routiq-admin-dashboard.vercel.app"
  }
}
```

## Common Issues to Look For

### 1. Middleware Errors
Look for logs with `type: "middleware"` and error level. Common issues:
- Clerk authentication failures
- Missing organization context

### 2. Backend API Issues
Look for logs with `type: "cliniko"`:
- High response times (>3000ms)
- 404/500 errors from backend
- Network timeouts

### 3. Authentication Problems
Look for logs with `type: "auth"`:
- Missing user IDs
- Organization access issues

## Sample Debug Session

1. **User reports "500 error"**
2. **Check Vercel logs** for that timeframe
3. **Look for ERROR level logs** with stack traces
4. **Trace the request flow** through middleware → API → backend
5. **Check timing** for performance issues

## Quick Debugging Commands

Search logs in Vercel for specific patterns:
- `"level": "ERROR"` - All errors
- `"type": "cliniko"` - Backend API calls
- `"userId": "missing"` - Auth issues
- `"status": 500` - Server errors

## Log Retention

- **Vercel Pro**: 30 days of logs
- **Vercel Hobby**: 1 day of logs
- Logs are real-time during active debugging

## Performance Monitoring

Each log includes `duration_ms` to track:
- Middleware processing time
- API response times
- Backend call durations
- Total request time

Look for patterns where durations exceed:
- Middleware: >100ms
- API calls: >2000ms
- Backend calls: >3000ms 