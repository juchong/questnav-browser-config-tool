#!/bin/bash

# Quest Navigation Browser Configuration Tool - Setup Script
# This script sets up the development environment

echo "================================================"
echo "Quest Configuration Tool - Development Setup"
echo "================================================"
echo ""

# Check Node.js version
echo "Checking Node.js version..."
NODE_VERSION=$(node -v 2>/dev/null)
if [ $? -ne 0 ]; then
    echo "❌ Node.js is not installed!"
    echo ""
    echo "Please install Node.js 20 LTS:"
    echo ""
    
    # Detect OS and provide specific instructions
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macOS installation options:"
        echo "  1. Download installer: https://nodejs.org/dist/v20.18.1/node-v20.18.1.pkg"
        echo "  2. Using Homebrew: brew install node@20"
        echo "  3. Using nvm: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash && nvm install 20"
    else
        echo "Linux installation options:"
        echo "  1. Using package manager:"
        echo "     curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
        echo "     sudo apt-get install -y nodejs"
        echo "  2. Using nvm:"
        echo "     curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
        echo "     nvm install 20"
    fi
    echo ""
    read -p "Would you like to open the Node.js download page? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if command -v xdg-open > /dev/null; then
            xdg-open "https://nodejs.org/en/download/"
        elif command -v open > /dev/null; then
            open "https://nodejs.org/en/download/"
        else
            echo "Please visit: https://nodejs.org/en/download/"
        fi
    fi
    exit 1
fi

NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
if [ $NODE_MAJOR -lt 20 ]; then
    echo "❌ Node.js version must be 20 or higher (found $NODE_VERSION)"
    echo ""
    echo "Please upgrade to Node.js 20 LTS:"
    echo "  https://nodejs.org/en/download/"
    echo ""
    read -p "Would you like to open the Node.js download page? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if command -v xdg-open > /dev/null; then
            xdg-open "https://nodejs.org/en/download/"
        elif command -v open > /dev/null; then
            open "https://nodejs.org/en/download/"
        else
            echo "Please visit: https://nodejs.org/en/download/"
        fi
    fi
    exit 1
fi

if [ $NODE_MAJOR -gt 22 ]; then
    echo "⚠️  WARNING: You are using Node.js $NODE_VERSION"
    echo "⚠️  This project is tested with Node.js 20 LTS."
    echo "⚠️  Native modules like better-sqlite3 may fail to compile."
    echo ""
    echo "We recommend Node.js 20 LTS for best compatibility."
    echo ""
    echo "Options:"
    echo "  1. Continue with Node.js $NODE_VERSION (may fail)"
    echo "  2. Install Node.js 20 LTS"
    echo "  3. Cancel setup"
    echo ""
    read -p "Choose an option (1/2/3): " choice
    
    case $choice in
        2)
            echo ""
            echo "To install Node.js 20 LTS, we recommend using nvm (Node Version Manager):"
            echo ""
            if [[ "$OSTYPE" == "darwin"* ]]; then
                echo "macOS:"
                echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
            else
                echo "Linux:"
                echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
            fi
            echo ""
            echo "Then run:"
            echo "  nvm install 20"
            echo "  nvm use 20"
            echo "  nvm alias default 20"
            echo ""
            read -p "Would you like to open the Node.js download page? (y/n) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                if command -v xdg-open > /dev/null; then
                    xdg-open "https://nodejs.org/en/download/"
                elif command -v open > /dev/null; then
                    open "https://nodejs.org/en/download/"
                else
                    echo "Please visit: https://nodejs.org/en/download/"
                fi
            fi
            exit 0
            ;;
        3)
            echo "Setup cancelled."
            exit 0
            ;;
        *)
            echo ""
            echo "Continuing with Node.js $NODE_VERSION..."
            ;;
    esac
fi

echo "✅ Node.js $NODE_VERSION detected"
echo ""

# Install backend dependencies
echo "Installing backend dependencies..."
cd backend
if npm install; then
    echo "✅ Backend dependencies installed"
else
    echo "❌ Failed to install backend dependencies"
    exit 1
fi
cd ..
echo ""

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd frontend
if npm install; then
    echo "✅ Frontend dependencies installed"
else
    echo "❌ Failed to install frontend dependencies"
    exit 1
fi
cd ..
echo ""

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cp .env.example .env
    echo "✅ .env file created"
else
    echo "ℹ️  .env file already exists"
fi
echo ""

# Create data directory
echo "Creating data directory..."
mkdir -p data
echo "✅ Data directory created"
echo ""

echo "================================================"
echo "✅ Setup complete!"
echo "================================================"
echo ""
echo "To start the development servers:"
echo ""
echo "Terminal 1 (Backend):"
echo "  cd backend"
echo "  npm run dev"
echo ""
echo "Terminal 2 (Frontend):"
echo "  cd frontend"
echo "  npm run dev"
echo ""
echo "Then open http://localhost:5173 in your browser"
echo ""
echo "For production deployment, see DEPLOYMENT.md"
echo "================================================"

