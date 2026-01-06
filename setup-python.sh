#!/bin/bash
# Quick setup script for Python YouTube downloader

echo "🐍 Python YouTube Downloader Setup"
echo "===================================="
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found!"
    echo "   Install from: https://www.python.org/downloads/"
    exit 1
fi

echo "✅ Python found: $(python3 --version)"
echo ""

# Install dependencies
echo "📦 Installing Python dependencies..."
pip3 install -r requirements.txt

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    echo "   Try: pip3 install -r requirements.txt"
    exit 1
fi

echo ""
echo "✅ Dependencies installed!"
echo ""
echo "🚀 Next steps:"
echo ""
echo "1. Start Python service:"
echo "   npm run python:service"
echo ""
echo "2. In another terminal, expose with ngrok:"
echo "   ngrok http 8000"
echo ""
echo "3. Copy the ngrok HTTPS URL (e.g., https://abc123.ngrok.io)"
echo ""
echo "4. Set in Supabase:"
echo "   - Go to: Supabase Dashboard → Edge Functions → youtube-download → Settings"
echo "   - Add secret: PYTHON_DOWNLOADER_URL = https://your-ngrok-url.ngrok.io"
echo ""
echo "📖 For detailed instructions, see: SETUP_PYTHON.md"
echo ""

