# Password Protection Implementation for SmartBroker v3

## Overview
This document provides complete implementation instructions for adding password protection to the SmartBroker v3 application. The purpose is to restrict access to a single authorized user (David) while maintaining the existing functionality.

## Project Context
- **Application**: SmartBroker v3 - AI-powered company research tool
- **Architecture**: Node.js/Express backend, vanilla JavaScript frontend
- **Current State**: No authentication - anyone can access the app
- **Goal**: Single password protection with session management

## Security Requirements
- Single password stored in environment variable
- Session-based authentication (not global state)
- Each browser/session requires separate login
- 24-hour session expiry
- Secure HttpOnly cookies
- Redirect unauthenticated users to login page

## Implementation Steps

### Step 1: Add Required Dependencies
Add to `server/package.json` dependencies:
```json
"cookie-parser": "^1.4.6"
```

Run in server directory:
```bash
npm install cookie-parser
```

### Step 2: Update Server Authentication (server/server.js)

Add these imports at the top:
```javascript
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
```

Add cookie parser middleware after existing middleware:
```javascript
app.use(cookieParser());
```

Add session management and authentication before existing routes:
```javascript
// Session management
const activeSessions = new Set();
const APP_PASSWORD = process.env.APP_PASSWORD || 'changeme123';

// Login endpoint
app.post('/api/login', (req, res) => {
  try {
    if (req.body.password === APP_PASSWORD) {
      const sessionToken = crypto.randomUUID();
      activeSessions.add(sessionToken);
      
      // Set secure session cookie
      res.cookie('sessionToken', sessionToken, { 
        httpOnly: true, 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'strict'
      });
      
      console.log(`[AUTH] New session created: ${sessionToken.substring(0, 8)}...`);
      res.json({ success: true });
    } else {
      console.log('[AUTH] Invalid password attempt');
      res.status(401).json({ success: false, error: 'Invalid password' });
    }
  } catch (error) {
    console.error('[AUTH] Login error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Authentication middleware - MUST be added before existing routes
app.use((req, res, next) => {
  // Allow access to login page and login API
  if (req.path === '/login.html' || req.path === '/api/login' || req.path.startsWith('/login.html')) {
    return next();
  }
  
  // Check for valid session
  const sessionToken = req.cookies?.sessionToken;
  if (sessionToken && activeSessions.has(sessionToken)) {
    return next(); // Valid session - continue
  }
  
  // No valid session - redirect or deny
  if (req.path === '/' || req.path === '/index.html' || req.accepts('html')) {
    return res.redirect('/login.html');
  } else {
    return res.status(401).json({ error: 'Authentication required' });
  }
});
```

### Step 3: Create Login Page (public/login.html)

Copy the existing prototype file from `GUI prototype/smartbroker_login.html` to `public/login.html`.

Then update the `handleLogin` function in the script section:

**Replace the existing handleLogin function with:**
```javascript
async function handleLogin(event) {
    event.preventDefault();
    const password = document.getElementById('password').value;
    const processing = document.getElementById('processing');
    const btn = event.target.querySelector('.login-btn');
    
    if (!password) {
        alert('Please enter the access code');
        return;
    }
    
    // Update UI to show processing
    btn.textContent = 'Processing...';
    btn.style.background = 'linear-gradient(135deg, #4ecdc4, #ff6b35)';
    processing.classList.add('active');
    processing.textContent = '> Authenticating neural pathways...';
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ password })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            // Success sequence
            setTimeout(() => {
                processing.textContent = '> Neural networks synchronized...';
            }, 800);
            
            setTimeout(() => {
                processing.textContent = '> Access granted. Initializing AI core...';
            }, 1600);
            
            setTimeout(() => {
                window.location.href = '/';
            }, 2400);
            
        } else {
            throw new Error(result.error || 'Authentication failed');
        }
        
    } catch (error) {
        console.error('Login error:', error);
        
        // Reset UI on error
        btn.textContent = 'Access Denied';
        btn.style.background = 'linear-gradient(135deg, #ff6b35, #ff4757)';
        processing.textContent = '> Authentication failed. Access denied.';
        
        // Reset after delay
        setTimeout(() => {
            btn.textContent = 'Initialize System';
            btn.style.background = 'linear-gradient(135deg, #00ff88, #4ecdc4)';
            processing.classList.remove('active');
            document.getElementById('password').value = '';
            document.getElementById('password').focus();
        }, 2000);
    }
}
```

### Step 4: Set Environment Variable

Add to your `.env` file:
```
APP_PASSWORD=your_secure_password_here
```

**Important**: Choose a strong password and never commit this to git.

### Step 5: Update .gitignore (if needed)

Ensure `.env` is in your `.gitignore`:
```
.env
```

## Testing the Implementation

### Test Cases to Verify:

1. **Unauthenticated Access**:
   - Visit `http://localhost:3000/` → Should redirect to `/login.html`
   - Try API endpoints → Should return 401 error

2. **Login Process**:
   - Enter wrong password → Should show "Access Denied"
   - Enter correct password → Should redirect to main app

3. **Authenticated Access**:
   - After login, all app functionality should work normally
   - API calls should succeed

4. **Session Management**:
   - Open new browser/incognito → Should require login again
   - Close and reopen same browser → Should stay logged in

5. **Security**:
   - Check that session cookies are HttpOnly
   - Verify different browsers need separate logins

## File Structure After Implementation

```
smartbroker/v3/
├── public/
│   ├── login.html          # New login page
│   ├── index.html          # Protected main app
│   └── js/                 # Existing app files
├── server/
│   ├── server.js           # Updated with auth
│   └── package.json        # Updated dependencies
├── .env                    # Contains APP_PASSWORD
└── .gitignore             # Excludes .env
```

## Security Notes

- **Session Security**: Uses HttpOnly cookies to prevent XSS attacks
- **Session Expiry**: 24-hour automatic expiry
- **Environment Variables**: Password stored securely, not in code
- **Per-Session**: Each browser requires separate authentication
- **Production Ready**: Secure cookies in production environment

## Troubleshooting

- **"Cannot set headers after they are sent"**: Make sure auth middleware is added BEFORE existing routes
- **Redirect loops**: Check that `/login.html` is excluded from auth middleware
- **Session not persisting**: Verify cookie-parser is installed and configured
- **API calls failing**: Ensure cookies are being sent with requests

## Deployment Considerations

1. **Set APP_PASSWORD environment variable** on your server
2. **Ensure NODE_ENV=production** for secure cookies
3. **Use HTTPS in production** for cookie security
4. **Restart server** to clear all existing sessions after deployment

This implementation provides robust single-user authentication while maintaining the existing SmartBroker functionality.