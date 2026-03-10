#!/usr/bin/env bash
# FlipperAI startup script

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$SCRIPT_DIR/backend"
VENV="$SCRIPT_DIR/.venv"

echo "=== FlipperAI House Flipping Helper ==="
echo ""

# Create virtualenv if missing
if [ ! -d "$VENV" ]; then
  echo "Creating Python virtual environment..."
  python3 -m venv "$VENV"
fi

# Install dependencies
echo "Installing dependencies..."
"$VENV/bin/pip" install -q -r "$BACKEND/requirements.txt"

# Check for API key
if [ -z "$ANTHROPIC_API_KEY" ]; then
  if [ -f "$SCRIPT_DIR/.env" ]; then
    export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs)
  fi
  if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo ""
    echo "ERROR: ANTHROPIC_API_KEY is not set."
    echo "  Option 1: export ANTHROPIC_API_KEY=sk-ant-..."
    echo "  Option 2: Create a .env file in the house-flipper/ directory:"
    echo "            echo 'ANTHROPIC_API_KEY=sk-ant-...' > .env"
    echo ""
    exit 1
  fi
fi

echo ""
echo "Starting FlipperAI on http://localhost:8000"
echo "Press Ctrl+C to stop."
echo ""

cd "$BACKEND"
"$VENV/bin/python" -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
