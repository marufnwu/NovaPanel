#!/bin/bash
# Test runner script for NovaPanel API
# Usage: ./scripts/test.sh [filter]

set -e

cd "$(dirname "$0")/.."

echo "Running API tests..."
cd apps/api

if [ -n "$1" ]; then
  echo "Running tests matching: $1"
  npx vitest run --reporter=verbose "$1"
else
  npx vitest run --reporter=verbose
fi

echo ""
echo "All tests passed!"