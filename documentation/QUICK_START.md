# 🚀 QUICK START CHECKLIST - Run Your App in 5 Minutes!

**Last Updated:** 2026-11-20  
**Current Status:** System verified ✅

---

## ✅ System Verification Results

| Component | Status | Notes |
|-----------|--------|-------|
| Git | ✅ Ready | v2.39.5 installed |
| Node.js | ✅ Ready | v24.11.0 installed (need v18+) |
| Yarn | ✅ Ready | v1.22.22 installed |
| Python 3 | ✅ Ready | v3.13.5 installed (need v3.10+) |
| Project Structure | ✅ Ready | frontend, backend, aws-deployment found |
| Package Files | ✅ Ready | package.json, requirements.txt found |

---

## 📋 Setup Checklist (Do Once)

### **Step 1: Backend Setup** ⏱️ 2 minutes

```bash
# Terminal Window 1 - Run these commands
cd /Users/rogersramirez/Documents/mobile-app-prod/backend

# Create Python virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate
# (you should see (venv) at start of prompt)

# Install Python dependencies
pip install -r requirements.txt
# Wait for all packages to install (~1-2 min)

# Verify installation
pip list | grep -E "fastapi|motor|paypal"
# Should show: fastapi, motor, paypal-server-sdk installed
```

✅ **Backend setup complete!**

### **Step 2: Frontend Setup** ⏱️ 2 minutes

```bash
# Terminal Window 1 or New Terminal - Run these commands
cd /Users/rogersramirez/Documents/mobile-app-prod/frontend

# Install Node dependencies
yarn install
# Wait for all packages to install (~1-2 min)

# Verify installation
yarn list --depth=0 | grep -E "expo|react-native"
# Should show: expo, react-native, etc.
```

✅ **Frontend setup complete!**

### **Step 3: Configure Environment Variables** ⏱️ 1 minute

#### **Frontend Configuration**

```bash
cd /Users/rogersramirez/Documents/mobile-app-prod/frontend

# Copy example config
cp .env.example .env.local

# Edit the file
nano .env.local
# Press Ctrl+X, then Y, then Enter to save

# Or use VS Code (more user-friendly)
code .env.local
```

**Fill in these values in .env.local:**
```env
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_BACKEND_URL=http://localhost:8000
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key_here
GOOGLE_MAPS_ANDROID_API_KEY=your_android_key_here
GOOGLE_MAPS_IOS_API_KEY=your_ios_key_here
```

**Don't have Google Maps keys?** Use empty values for now - app will work without them.

#### **Backend Configuration**

```bash
cd /Users/rogersramirez/Documents/mobile-app-prod/backend

# Copy example config
cp .env.example .env

# Edit the file
nano .env
# Or: code .env
```

**Fill in these values in .env:**
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=trip_development
PAYPAL_CLIENT_ID=
PAYPAL_SECRET=
GOOGLE_MAPS_API_KEY=
```

**Don't have PayPal/Maps keys?** Leave them empty for now - basic features will still work.

✅ **Environment configuration complete!**

---

## 🎮 Running the App (Do Every Time You Want to Test)

### **Method 1: Run Backend + Frontend (Full Test)**

#### **Terminal 1 - Backend**
```bash
cd /Users/rogersramirez/Documents/mobile-app-prod/backend

# Activate virtual environment
source venv/bin/activate

# Start server
uvicorn server:app --reload --host 0.0.0.0 --port 8000

# Expected output:
# INFO:     Uvicorn running on http://0.0.0.0:8000
# INFO:     Application startup complete

# ✅ Backend is running!
# Keep this terminal open. Press Ctrl+C to stop.
```

#### **Terminal 2 - Frontend**
```bash
cd /Users/rogersramirez/Documents/mobile-app-prod/frontend

# Start Expo
yarn start

# Expected output:
# > expo start
# Starting Expo CLI...
# Press 'w' to open web
# Press 'a' to open Android
# Press 'i' to open iOS
# Press 'q' to quit

# Press 'w' to open in browser
# Your app will open at: http://localhost:19006

# ✅ Frontend is running!
# Keep this terminal open. Press Ctrl+C to stop.
```

---

### **Method 2: Run Only Frontend (Quick Web Testing)**

```bash
cd /Users/rogersramirez/Documents/mobile-app-prod/frontend
yarn start
# Press 'w' to open in browser
```

---

### **Method 3: Run Only Backend (Server Testing)**

```bash
cd /Users/rogersramirez/Documents/mobile-app-prod/backend
source venv/bin/activate
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

---

## 🌐 Access Your App

| Platform | How to Access | URL/Steps |
|----------|---------------|-----------|
| **Web** | Browser | http://localhost:19006 |
| **iOS** | Xcode Simulator | Press 'i' in Terminal (macOS only) |
| **Android** | Android Emulator | Press 'a' in Terminal |
| **Phone** | Scan QR Code | Install Expo Go app, scan QR from terminal |

**Recommended for getting started:** Press 'w' for web access (easiest!)

---

## ✨ What You Should See

### **In Browser (Web Access)**
1. App loads at http://localhost:19006
2. No red error messages in console
3. Sign-up/Login page visible
4. Maps display (if Google Maps key added)

### **In Terminal (Backend)**
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete
INFO:     GET /docs
```

### **In Browser Console (F12)**
```
No errors
Connected to backend: http://localhost:8000
```

---

## 🔧 Troubleshooting

### ❌ "Module not found" error

```bash
# Frontend
cd frontend && yarn install

# Backend
cd backend && source venv/bin/activate && pip install -r requirements.txt
```

### ❌ "Port 8000 already in use"

```bash
# Check what's using port 8000
lsof -i :8000

# Kill the process
kill -9 <PID>

# Or use different port
uvicorn server:app --port 8001
# Then update frontend .env.local to use 8001
```

### ❌ "Cannot connect to MongoDB"

```bash
# Start MongoDB (if not running)
brew services start mongodb-community

# Verify it's running
brew services list | grep mongodb
```

### ❌ "CORS Error" or "Backend URL not found"

```bash
# Check backend URL in frontend/.env.local
grep EXPO_PUBLIC_BACKEND_URL frontend/.env.local
# Should output: EXPO_PUBLIC_BACKEND_URL=http://localhost:8000

# Check backend is actually running
curl http://localhost:8000/docs
# Should show API documentation
```

### ❌ App won't load in browser

```bash
# Check Expo is running
# Terminal should show: "Press 'w' to open web"

# Check port 19006 is not blocked
lsof -i :19006

# Try refreshing browser (Cmd+R or Ctrl+R)
```

---

## 📊 Expected Performance

| Metric | Expected |
|--------|----------|
| Backend Startup | 2-5 seconds |
| Frontend Startup | 10-20 seconds |
| Web Load | 3-5 seconds |
| Maps Load | 2-3 seconds (if key added) |
| API Response | <500ms |

---

## 🎯 Next Steps After Running

1. **Test Sign-Up**
   - Click "Sign Up"
   - Create test account
   - Verify sign-up works

2. **Test Maps**
   - On main screen, check if map displays
   - Try moving around map
   - Try searching for location

3. **Test Navigation**
   - Click tabs at bottom
   - Navigate between screens
   - Check all pages load

4. **Check Logs**
   - Terminal 1: Look for backend errors
   - Terminal 2: Look for Expo errors
   - Browser Console (F12): Look for JS errors

5. **Test Features**
   - Try booking a ride
   - Try uploading documents (driver)
   - Try payments (if PayPal key added)

---

## 🛑 Stopping the App

```bash
# Terminal 1 (Backend)
Press Ctrl+C

# Terminal 2 (Frontend)
Press Ctrl+C
# Or press 'q' at Expo prompt
```

---

## 🔄 Restarting After Changes

**If you change code:**
- Frontend: Refresh browser (auto-reload enabled)
- Backend: Restart terminal (Ctrl+C then `uvicorn server:app --reload`)

**If you change .env:**
- Restart both backend and frontend

**If you install new packages:**
- Frontend: `yarn add <package-name>`
- Backend: `pip install <package-name>` then update requirements.txt

---

## 🗑️ Cleanup (Optional)

**If something breaks:**

```bash
# Clean frontend
cd frontend && rm -rf node_modules && yarn install

# Clean backend
cd backend && rm -rf venv && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt
```

---

## 📚 Additional Commands

```bash
# Frontend

# Start without opening browser
yarn start

# Run linter
yarn lint

# Clean cache
rm -rf .expo/

# Backend

# Stop server gracefully
# Press Ctrl+C

# Debug mode
uvicorn server:app --reload --log-level debug

# View API docs
# Visit: http://localhost:8000/docs

# Test backend with curl
curl http://localhost:8000/health
```

---

## 💡 Tips

- **Hot Reload:** Changes auto-refresh in browser (save file and check)
- **Dev Tools:** Browser F12 → Console, Network, Application tabs
- **Backend Docs:** Visit http://localhost:8000/docs while backend is running
- **Multiple Terminals:** Use tabs or split terminal for convenience
- **Keep Running:** Don't close terminals while testing - they need to stay open

---

## 🎉 You're Ready!

Your system is configured and ready to run! 

### **Quick Start Command** (Copy & Paste)

```bash
# Terminal 1 - Backend
cd /Users/rogersramirez/Documents/mobile-app-prod/backend && source venv/bin/activate && uvicorn server:app --reload

# Terminal 2 - Frontend  
cd /Users/rogersramirez/Documents/mobile-app-prod/frontend && yarn start
# Then press 'w' for web
```

**That's it! Your app is now running! 🚀**

---

### **Still need help?**
See `SETUP_AND_RUN_GUIDE.md` for detailed explanations and more troubleshooting.

