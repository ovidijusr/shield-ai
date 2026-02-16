#!/bin/bash
# Load ANTHROPIC_API_KEY from home folder
# Usage: source ./load-env.sh

if [ -f ~/.anthropic_api_key ]; then
  export ANTHROPIC_API_KEY=$(cat ~/.anthropic_api_key)
  echo "✓ Loaded ANTHROPIC_API_KEY from ~/.anthropic_api_key"
else
  echo "⚠ Warning: ~/.anthropic_api_key not found"
  echo "  Create it with: echo 'your-api-key' > ~/.anthropic_api_key"
fi
