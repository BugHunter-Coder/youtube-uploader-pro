#!/bin/bash
# Quick start script for Python YouTube downloader service

echo "Installing Python dependencies..."
pip install -r requirements.txt

echo ""
echo "Starting YouTube downloader service..."
echo "Service will be available at: http://localhost:8000"
echo "Health check: http://localhost:8000/health"
echo ""
echo "To use with Supabase Edge Function, set environment variable:"
echo "PYTHON_DOWNLOADER_URL=http://localhost:8000"
echo "(Or use ngrok for public access: ngrok http 8000)"
echo ""

python youtube_downloader_service.py

