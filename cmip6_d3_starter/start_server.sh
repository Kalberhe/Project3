#!/bin/bash
# Simple script to start a local HTTP server for D3 visualizations

echo "🚀 Starting local server for CMIP6 D3 Visualizations..."
echo "📁 Serving from: $(pwd)"
echo "🌐 Open http://localhost:8000 in your browser"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

python3 -m http.server 8000

