#!/bin/bash

# Test script for ShieldAI API routes
# This script tests all API endpoints including SSE streaming

set -e

API_URL="${API_URL:-http://localhost:8484}"
TOKEN="${SHIELDAI_TOKEN:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper function to print colored output
print_test() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}TEST: $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Prepare auth header
AUTH_HEADER=""
if [ -n "$TOKEN" ]; then
    AUTH_HEADER="Authorization: Bearer $TOKEN"
fi

# Test 1: Health Check
print_test "Health Check"
response=$(curl -s -w "\n%{http_code}" "$API_URL/api/health")
status=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed \$d)

if [ "$status" = "200" ]; then
    print_success "Health check passed"
    echo "$body" | jq .
else
    print_error "Health check failed with status $status"
    echo "$body"
fi

echo ""

# Test 2: Get Containers
print_test "GET /api/containers"
response=$(curl -s -w "\n%{http_code}" -H "$AUTH_HEADER" "$API_URL/api/containers")
status=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed \$d)

if [ "$status" = "200" ]; then
    print_success "Containers endpoint passed"
    container_count=$(echo "$body" | jq 'length')
    echo "Found $container_count containers"
    echo "$body" | jq -r '.[] | "\(.name) - \(.status)"' | head -5
else
    print_error "Containers endpoint failed with status $status"
    echo "$body"
fi

echo ""

# Test 3: Get Infrastructure
print_test "GET /api/infrastructure"
response=$(curl -s -w "\n%{http_code}" -H "$AUTH_HEADER" "$API_URL/api/infrastructure")
status=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed \$d)

if [ "$status" = "200" ]; then
    print_success "Infrastructure endpoint passed"
    echo "$body" | jq '{
        containers: .containers | length,
        networks: .networks | length,
        volumes: .volumes | length,
        dockerVersion: .dockerVersion,
        os: .os
    }'
else
    print_error "Infrastructure endpoint failed with status $status"
    echo "$body"
fi

echo ""

# Test 4: Audit SSE Stream
print_test "POST /api/audit (SSE Stream)"
echo "Streaming audit results..."
echo ""

# Use a temporary file to capture the stream
TMPFILE=$(mktemp)
curl -s -N -H "$AUTH_HEADER" -X POST "$API_URL/api/audit" > "$TMPFILE" &
CURL_PID=$!

# Monitor the stream for 10 seconds or until completion
timeout=10
elapsed=0
while [ $elapsed -lt $timeout ]; do
    if ! kill -0 $CURL_PID 2>/dev/null; then
        break
    fi

    # Check for events
    if grep -q "data:" "$TMPFILE"; then
        # Print latest events
        tail -n 5 "$TMPFILE" | grep "data:" | while read -r line; do
            event=$(echo "$line" | sed 's/data: //')
            if [ "$event" != "[DONE]" ]; then
                event_type=$(echo "$event" | jq -r '.type' 2>/dev/null || echo "")
                if [ -n "$event_type" ]; then
                    case "$event_type" in
                        finding)
                            echo -e "${YELLOW}📋 Finding:${NC}"
                            echo "$event" | jq '.data | {severity, category, title, container}'
                            ;;
                        good-practice)
                            echo -e "${GREEN}✓ Good Practice:${NC}"
                            echo "$event" | jq '.data | {category, title}'
                            ;;
                        complete)
                            echo -e "${GREEN}✓ Audit Complete${NC}"
                            echo "$event" | jq '.data | {overallScore, scoreExplanation, findingsCount: .findings | length}'
                            ;;
                        error)
                            echo -e "${RED}✗ Error:${NC}"
                            echo "$event" | jq '.error'
                            ;;
                    esac
                fi
            fi
        done
        break
    fi

    sleep 1
    elapsed=$((elapsed + 1))
done

# Clean up
kill $CURL_PID 2>/dev/null || true
wait $CURL_PID 2>/dev/null || true

if grep -q "data:" "$TMPFILE"; then
    print_success "Audit SSE stream working"
else
    print_error "No data received from audit stream"
fi

rm -f "$TMPFILE"

echo ""

# Test 5: Fix Preview (will fail without audit first, but tests endpoint)
print_test "POST /api/fix/preview"
response=$(curl -s -w "\n%{http_code}" \
    -H "$AUTH_HEADER" \
    -H "Content-Type: application/json" \
    -X POST \
    -d '{"findingId": "test-finding-id"}' \
    "$API_URL/api/fix/preview")
status=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed \$d)

if [ "$status" = "404" ]; then
    print_success "Fix preview endpoint working (404 expected without audit)"
    echo "Response: Finding not found (expected)"
else
    echo "Status: $status"
    echo "$body" | jq .
fi

echo ""

# Test 6: Chat SSE Stream
print_test "POST /api/chat (SSE Stream)"
echo "Streaming chat response..."
echo ""

TMPFILE=$(mktemp)
curl -s -N -H "$AUTH_HEADER" \
    -H "Content-Type: application/json" \
    -X POST \
    -d '{"message": "What is my Docker infrastructure?", "history": []}' \
    "$API_URL/api/chat" > "$TMPFILE" &
CURL_PID=$!

# Monitor the stream for 10 seconds or until completion
timeout=10
elapsed=0
content=""
while [ $elapsed -lt $timeout ]; do
    if ! kill -0 $CURL_PID 2>/dev/null; then
        break
    fi

    # Check for events
    if grep -q "data:" "$TMPFILE"; then
        # Accumulate content chunks
        while IFS= read -r line; do
            if [[ "$line" == data:* ]]; then
                event=$(echo "$line" | sed 's/data: //')
                if [ "$event" != "[DONE]" ]; then
                    event_type=$(echo "$event" | jq -r '.type' 2>/dev/null || echo "")
                    if [ "$event_type" = "chunk" ]; then
                        chunk=$(echo "$event" | jq -r '.content' 2>/dev/null)
                        content="${content}${chunk}"
                    elif [ "$event_type" = "done" ]; then
                        break 2
                    fi
                fi
            fi
        done < "$TMPFILE"
    fi

    sleep 1
    elapsed=$((elapsed + 1))
done

# Clean up
kill $CURL_PID 2>/dev/null || true
wait $CURL_PID 2>/dev/null || true

if [ -n "$content" ]; then
    print_success "Chat SSE stream working"
    echo "Response preview: ${content:0:200}..."
elif grep -q "error" "$TMPFILE"; then
    print_error "Chat returned error (may be expected if service not implemented yet)"
    grep "error" "$TMPFILE" | head -1 | jq '.error'
else
    print_error "No data received from chat stream"
fi

rm -f "$TMPFILE"

echo ""

# Test 7: Auth Test (if token is set)
if [ -n "$TOKEN" ]; then
    print_test "Authentication Test"

    # Test without token
    response=$(curl -s -w "\n%{http_code}" "$API_URL/api/containers")
    status=$(echo "$response" | tail -n1)

    if [ "$status" = "401" ]; then
        print_success "Auth middleware blocking unauthorized requests"
    else
        print_error "Auth middleware not working (expected 401, got $status)"
    fi

    # Test with invalid token
    response=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer invalid" "$API_URL/api/containers")
    status=$(echo "$response" | tail -n1)

    if [ "$status" = "401" ]; then
        print_success "Auth middleware rejecting invalid tokens"
    else
        print_error "Auth middleware not working (expected 401, got $status)"
    fi
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}API Tests Complete${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
