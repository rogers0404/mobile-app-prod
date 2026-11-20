# Trip Ride-Share App - Setup & Run Guide

**Last Updated:** 2026-11-20  
**Status:** Complete Setup & Verification Guide

---

## 📋 Project Overview

This is a **full-stack ride-share application** built with:

**Frontend (Mobile & Web):**
- Expo (React Native + React Native Web)
- TypeScript
- React Router
- React Navigation
- Socket.io for real-time updates

**Backend:**
- FastAPI (Python)
- MongoDB
- PayPal SDK
- Google Maps API
- Socket.io for real-time communication

---

## 🔍 System Requirements

### **Minimum System Requirements:**
- **Node.js:** v18+ (check with `node --version`)
- **Yarn:** v1.22.22+ (check with `yarn --version`)
- **Python:** v3.10+ (check with `python3 --version`)
- **Git:** Already installed (check with `git --version`)
- **MongoDB:** Local instance or MongoDB Atlas connection

### **For Mobile Testing:**
- **iOS:** Xcode + iOS Simulator (macOS only) OR Expo Go app on iPhone
- **Android:** Android Studio + Emulator OR Expo Go app on Android device
- **Web:** Any modern browser (Chrome, Safari, Firefox, Edge)

---

## ⚙️ Prerequisites - Install Required Tools

### **1. Node.js & Yarn** (If not already installed)

```bash
# Check if Node.js is installed
node --version
# Should show v18 or higher

# Check if Yarn is installed
yarn --version
# Should show 1.22.22 or higher

# If not installed, visit: https://nodejs.org and https://yarnpkg.com
```

### **2. Python 3.10+** (For Backend)

```bash
# Check Python version
python3 --version
# Should show 3.10 or higher

# If not installed, visit: https://www.python.org/downloads/
```

### **3. MongoDB**

**Option A: Local MongoDB** (Recommended for local development)
```bash
# macOS (using Homebrew)
brew install mongodb-community
brew services start mongodb-community

# Verify it's running
brew services list | grep mongodb-community
```

**Option B: MongoDB Atlas** (Cloud)
1. Go to https://www.mongodb.com/cloud/atlas
2. Create free account
3. Create a cluster
4. Get connection string (use in .env)

---

## 📦 Step-by-Step Installation

### **Step 1: Clone Repository** (Already Done)
```bash
cd /Users/rogersramirez/Documents/mobile-app-prod
git status  # Verify you're on main branch
```

### **Step 2: Setup Frontend**

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
yarn install
# This will install all Node packages listed in package.json

# Verify installation
yarn list --depth=0
# Should show all major dependencies like expo, react-native, etc.
```

### **Step 3: Setup Backend**

```bash
# Navigate to backend directory
cd ../backend

# Create Python virtual environment
python3 -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
# venv\Scripts\activate

# Verify activation (should show (venv) in prompt)

# Install Python dependencies
pip install -r requirements.txt

# Verify installation
pip list
```

### **Step 4: Configure Environment Variables**

#### **Frontend Configuration**

```bash
cd ../frontend

# Copy example env file
cp .env.example .env.local

# Edit .env.local
nano .env.local
# Or use VS Code:
# code .env.local
```

**Fill in these values:**
```env
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_BACKEND_URL=http://localhost:8000
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
GOOGLE_MAPS_ANDROID_API_KEY=your_android_key_here
GOOGLE_MAPS_IOS_API_KEY=your_ios_key_here
```

**Get Google Maps API Key:**
1. Go to https://console.cloud.google.com
2. Create a new project
3. Enable "Maps SDK for Android" and "Maps SDK for iOS"
4. Create API key
5. Paste it in .env.local

#### **Backend Configuration**

```bash
cd ../backend

# Copy example env file
cp .env.example .env

# Edit .env
nano .env
# Or use VS Code:
# code .env
```

**Fill in these values:**
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=trip_development
PAYPAL_CLIENT_ID=your_paypal_sandbox_client_id
PAYPAL_SECRET=your_paypal_sandbox_secret
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

**Get PayPal Sandbox Credentials:**
1. Go to https://developer.paypal.com
2. Log in (create account if needed)
3. Go to "Sandbox" → "Apps"
4. Create Business and Personal accounts
5. Copy Client ID and Secret
6. Paste in .env

---

## 🚀 Running the Application

### **Option 1: Run Backend & Frontend (Recommended for Full Testing)**

#### **Terminal 1 - Start Backend**

```bash
# From repository root
cd backend

# Activate Python virtual environment
source venv/bin/activate

# Start FastAPI server
uvicorn server:app --reload --host 0.0.0.0 --port 8000

# Expected output:
# Uvicorn running on http://0.0.0.0:8000
# Press CTRL+C to quit
```

#### **Terminal 2 - Start Frontend**

```bash
# From repository root (new terminal window)
cd frontend

# Start Expo development server
yarn start
# Or: npm start

# Expected output:
# > expo start
# Starting Expo CLI...
# Press 'w' to open web
# Press 'a' to open Android
# Press 'i' to open iOS
# Press 'q' to quit
```

**Available Frontend Options:**

- **Press 'w'** → Opens web app in browser (http://localhost:19006)
- **Press 'a'** → Opens Android emulator (requires Android Studio)
- **Press 'i'** → Opens iOS simulator (requires Xcode, macOS only)
- **Scan QR code with Expo Go app** → Runs on physical device

---

### **Option 2: Run Only Frontend (If Backend Already Running)**

```bash
cd frontend
yarn start
# Then press 'w' for web, 'a' for Android, 'i' for iOS
```

---

### **Option 3: Run Only Backend (If Frontend Already Running)**

```bash
cd backend
source venv/bin/activate
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

---

## 🌐 Accessing the Application

### **Web (Easiest to Start)**
1. Start frontend: `cd frontend && yarn start`
2. Press 'w' in terminal
3. Browser opens to: http://localhost:19006

### **iOS (Requires Xcode on macOS)**
1. Start frontend: `cd frontend && yarn start`
2. Press 'i' in terminal
3. iOS Simulator launches

### **Android (Requires Android Studio)**
1. Start frontend: `cd frontend && yarn start`
2. Press 'a' in terminal
3. Android Emulator launches

### **Physical Device**
1. Install Expo Go app from App Store or Google Play
2. Start frontend: `cd frontend && yarn start`
3. Scan QR code with Expo Go
4. App opens on your phone

---

## ✅ Verification Checklist

After starting the application, verify everything is working:

```bash
# 1. Check Backend Server
curl http://localhost:8000/docs
# Should open FastAPI documentation page

# 2. Check Frontend (in browser console)
# - No red errors
# - Maps displays (if Google Maps key configured)
# - Console shows "Connected to backend: http://localhost:8000"

# 3. Test Features
# - Sign up page loads
# - Maps load correctly
# - WebSocket connection established (check Network tab)
# - No CORS errors in console
```

---

## 🔧 Common Issues & Solutions

### **Issue 1: Backend Connection Failed**

**Problem:** Frontend shows "Cannot connect to backend"

**Solutions:**
```bash
# 1. Verify backend is running
curl http://localhost:8000

# 2. Check .env file has correct backend URL
grep EXPO_PUBLIC_BACKEND_URL frontend/.env.local

# 3. Verify backend port is open
netstat -an | grep 8000  # macOS/Linux
netstat -ano | findstr :8000  # Windows

# 4. Try restarting both services
# Stop all terminals with Ctrl+C
# Restart backend then frontend
```

### **Issue 2: MongoDB Connection Error**

**Problem:** Backend crashes with "Cannot connect to MongoDB"

**Solutions:**
```bash
# 1. Check MongoDB is running
brew services list | grep mongodb  # macOS

# 2. Verify connection string
grep MONGO_URL backend/.env

# 3. If using MongoDB Atlas, check:
# - IP whitelist (add your IP)
# - Database name exists (should be "trip_development")
# - Connection string is correct

# 4. Test connection
mongosh "your_connection_string"
```

### **Issue 3: Google Maps Not Showing**

**Problem:** Maps display blank or show error

**Solutions:**
```bash
# 1. Verify API key in .env.local
grep GOOGLE_MAPS backend/.env
grep GOOGLE_MAPS frontend/.env.local

# 2. Check API key is enabled in Google Cloud Console
# - Go to https://console.cloud.google.com
# - Select your project
# - Verify "Maps SDK" is enabled

# 3. Check API key restrictions
# - Should have no IP restrictions for local development
# - Android: Restrict by package name when deploying

# 4. Restart frontend to reload API key
# Ctrl+C then: yarn start
```

### **Issue 4: PayPal Integration Not Working**

**Problem:** Payment fails or shows error

**Solutions:**
```bash
# 1. Verify PayPal sandbox credentials
grep PAYPAL backend/.env

# 2. Test PayPal connection
curl -X POST https://api.sandbox.paypal.com/v1/oauth2/token \
  -H "Accept: application/json" \
  -H "Accept-Language: en_US" \
  -d "grant_type=client_credentials" \
  -u "YOUR_CLIENT_ID:YOUR_SECRET"

# 3. Make sure using SANDBOX endpoint, not production
# Should be: https://api.sandbox.paypal.com (NOT api.paypal.com)
```

### **Issue 5: Port Already in Use**

**Problem:** "Port 8000 is already in use" or "Port 19006 is already in use"

**Solutions:**
```bash
# Find process using port 8000
lsof -i :8000  # macOS/Linux
netstat -ano | findstr :8000  # Windows

# Kill the process
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows

# Or change port
uvicorn server:app --port 8001  # Backend on 8001
# Update frontend .env to use port 8001
```

---

## 📊 Project Structure

```
mobile-app-prod/
├── frontend/                          # Expo React Native + Web
│   ├── src/
│   │   ├── screens/                  # App screens
│   │   ├── components/               # Reusable components
│   │   ├── services/                 # API & WebSocket clients
│   │   ├── stores/                   # Zustand state management
│   │   └── utils/                    # Helper functions
│   ├── app/                          # Expo Router navigation
│   ├── package.json
│   ├── app.json                      # Expo configuration
│   ├── .env.local                    # Environment (create from .env.example)
│   └── tsconfig.json
│
├── backend/                           # FastAPI Python server
│   ├── server.py                     # Main FastAPI application
│   ├── requirements.txt              # Python dependencies
│   ├── .env                          # Environment (create from .env.example)
│   └── venv/                         # Python virtual environment
│
├── aws-deployment/                    # AWS CloudFormation files
│   ├── cloudformation-template.yaml  # Infrastructure template
│   └── parameters.json               # Deployment parameters
│
└── README.md                          # Project info
```

---

## 🔐 Security Notes

### **Local Development**
- ✅ Use `.env.local` and `.env` files (NOT committed to git)
- ✅ Never commit credentials to git
- ✅ Use sandbox credentials for PayPal
- ✅ Disable API key restrictions only for local development

### **Before Production Deployment**
- 🔒 Use AWS Secrets Manager for credentials
- 🔒 Restrict API keys by IP/domain
- 🔒 Use production PayPal credentials
- 🔒 Enable HTTPS
- 🔒 Set up proper authentication/authorization

---

## 🚀 Deployment Options

### **Frontend Deployment**
- **Expo:** `eas build --platform ios` (requires paid plan)
- **Web:** `yarn run build` then deploy to Vercel/Netlify
- **Manual:** Generate APK/IPA then sideload to device

### **Backend Deployment**
- **AWS:** Use CloudFormation template in `aws-deployment/`
- **Railway.app:** Push to GitHub, Railway auto-deploys
- **Heroku:** `git push heroku main`
- **DigitalOcean:** Follow FastAPI deployment guide

See: `AWS_CONSOLE_CLOUDFORMATION_GUIDE.md` for cloud deployment

---

## 📚 Additional Resources

| Topic | Reference |
|-------|-----------|
| **Expo Docs** | https://docs.expo.dev |
| **React Native** | https://reactnative.dev |
| **FastAPI** | https://fastapi.tiangolo.com |
| **MongoDB** | https://docs.mongodb.com |
| **Google Maps** | https://developers.google.com/maps |
| **PayPal SDK** | https://developer.paypal.com |
| **Socket.io** | https://socket.io/docs |

---

## 🆘 Getting Help

### **Debugging Tips**

1. **Frontend Console Logs**
   - Open browser dev tools: F12 or Cmd+Option+I
   - Check Console, Network, and Application tabs
   - Look for error messages and failed requests

2. **Backend Logs**
   - Terminal shows FastAPI startup messages
   - Look for error tracebacks
   - Enable debug mode: `uvicorn server:app --reload`

3. **Network Inspector**
   - Browser DevTools → Network tab
   - Check API requests and responses
   - Verify WebSocket connections

4. **Environment Variables**
   - Restart frontend/backend after changing .env
   - Verify files are in correct locations
   - Check for typos in URLs and credentials

---

## ✨ Next Steps

1. **Install Prerequisites** ← Start here
2. **Follow Setup Steps** ← One-time setup
3. **Configure Environment** ← Add credentials
4. **Run Backend** ← Terminal 1
5. **Run Frontend** ← Terminal 2
6. **Test in Browser** ← Press 'w' in frontend terminal
7. **Verify Features** ← Use checklist above
8. **Deploy to AWS** ← When ready (see CloudFormation guide)

---

## 📝 Notes

- **Development Mode:** Hot reload enabled for fast development
- **Monorepo:** Frontend and backend can run simultaneously
- **Real-time Updates:** WebSocket connections for live ride tracking
- **TypeScript:** Full type safety in frontend
- **Testing:** Run tests with `yarn test` or `pytest`

---

**Ready to run? Start with Terminal 1: Backend Setup!** 🚀
