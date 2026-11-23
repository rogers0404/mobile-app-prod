#!/bin/bash

# Trip Ride-Share App - Setup Verification Script
# This script checks if your system has all required dependencies

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║          Trip Ride-Share - Setup Verification Script          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter for checks
CHECKS_PASSED=0
CHECKS_TOTAL=0

# Function to check command exists
check_command() {
    local cmd=$1
    local name=$2
    local min_version=$3
    
    CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
    
    if command -v $cmd &> /dev/null; then
        version=$($cmd --version 2>&1 | head -1)
        echo -e "${GREEN}✓${NC} $name installed: $version"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
        return 0
    else
        echo -e "${RED}✗${NC} $name NOT installed"
        return 1
    fi
}

# Function to check directory exists
check_directory() {
    local dir=$1
    local name=$2
    
    CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
    
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✓${NC} $name directory found: $dir"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
        return 0
    else
        echo -e "${RED}✗${NC} $name directory NOT found: $dir"
        return 1
    fi
}

# Function to check file exists
check_file() {
    local file=$1
    local name=$2
    
    CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $name file found: $file"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
        return 0
    else
        echo -e "${YELLOW}!${NC} $name file NOT found: $file (this is OK, can be created)"
        return 1
    fi
}

echo "📋 SYSTEM REQUIREMENTS CHECK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

check_command "git" "Git" ""
check_command "node" "Node.js" "v18+"
check_command "yarn" "Yarn" "1.22+"
check_command "python3" "Python 3" "3.10+"

echo ""
echo "📁 PROJECT STRUCTURE CHECK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

check_directory "frontend" "Frontend"
check_directory "backend" "Backend"
check_directory "aws-deployment" "AWS Deployment"

echo ""
echo "📦 FRONTEND DEPENDENCIES CHECK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

check_file "frontend/package.json" "Frontend package.json"
check_file "frontend/app.json" "Frontend app.json"
check_file "frontend/tsconfig.json" "Frontend tsconfig.json"

if [ -d "frontend/node_modules" ]; then
    echo -e "${GREEN}✓${NC} Frontend node_modules installed"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
    echo -e "${YELLOW}!${NC} Frontend node_modules NOT installed (run: cd frontend && yarn install)"
fi
CHECKS_TOTAL=$((CHECKS_TOTAL + 1))

echo ""
echo "🐍 BACKEND DEPENDENCIES CHECK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

check_file "backend/server.py" "Backend server.py"
check_file "backend/requirements.txt" "Backend requirements.txt"

if [ -d "backend/venv" ]; then
    echo -e "${GREEN}✓${NC} Backend virtual environment exists"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
    echo -e "${YELLOW}!${NC} Backend virtual environment NOT created (run: cd backend && python3 -m venv venv)"
fi
CHECKS_TOTAL=$((CHECKS_TOTAL + 1))

echo ""
echo "🔐 ENVIRONMENT CONFIGURATION CHECK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

check_file "frontend/.env.local" "Frontend .env.local"
check_file "backend/.env" "Backend .env"

echo ""
echo "📊 SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Checks Passed: $CHECKS_PASSED / $CHECKS_TOTAL"
echo ""

if [ $CHECKS_PASSED -ge 10 ]; then
    echo -e "${GREEN}✓ READY TO RUN!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. If backend venv not created:"
    echo "   cd backend && python3 -m venv venv && source venv/bin/activate"
    echo ""
    echo "2. If node_modules not installed:"
    echo "   cd frontend && yarn install"
    echo ""
    echo "3. Create .env files if missing (copy from .env.example):"
    echo "   cd frontend && cp .env.example .env.local"
    echo "   cd ../backend && cp .env.example .env"
    echo ""
    echo "4. Add your credentials to .env files:"
    echo "   - Google Maps API Key"
    echo "   - PayPal Sandbox Credentials"
    echo "   - MongoDB URL"
    echo ""
    echo "5. Start the services:"
    echo "   Terminal 1: cd backend && source venv/bin/activate && uvicorn server:app --reload"
    echo "   Terminal 2: cd frontend && yarn start"
    echo ""
elif [ $CHECKS_PASSED -ge 8 ]; then
    echo -e "${YELLOW}! MOSTLY READY${NC}"
    echo ""
    echo "Some optional components are missing:"
    echo "- Install missing dependencies before running"
    echo "- See documentation/GETTING_STARTED.md for detailed instructions"
    echo ""
else
    echo -e "${RED}✗ NOT READY${NC}"
    echo ""
    echo "Critical components missing:"
    echo "- Install Node.js, Python 3, and Git"
    echo "- See documentation/GETTING_STARTED.md for installation instructions"
    echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
