#!/bin/bash

# Test Webhook Script
# Simulates a GitHub release webhook to test the automatic APK detection

# Default values
TAG="${1:-v1.0.0-test}"
APK_URL="${2:-https://github.com/QuestNav/QuestNav/releases/download/v1.0.0/QuestNav-v1.0.0.apk}"
APK_NAME="${3:-QuestNav-v1.0.0.apk}"
BACKEND_URL="${4:-http://localhost:3000}"

echo "================================================"
echo "Test Webhook for APK Release Detection"
echo "================================================"
echo ""
echo "Testing with:"
echo "  Tag:      $TAG"
echo "  APK Name: $APK_NAME"
echo "  APK URL:  $APK_URL"
echo "  Backend:  $BACKEND_URL"
echo ""

# Create test payload
PAYLOAD=$(cat <<EOF
{
  "tag_name": "$TAG",
  "apk_url": "$APK_URL",
  "apk_name": "$APK_NAME"
}
EOF
)

echo "Sending test webhook..."
echo ""

# Send request
RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  "$BACKEND_URL/api/webhooks/github/test" \
  -w "\nHTTP_STATUS:%{http_code}")

# Extract status code
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS:/d')

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✓ Success!"
    echo ""
    echo "Response:"
    echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
    echo ""
    echo "================================================"
    echo "Next Steps:"
    echo "  1. Open the admin panel at http://localhost:5173"
    echo "  2. Navigate to 'QuestNav APK Releases' section"
    echo "  3. You should see the new release with status 'downloading' or 'completed'"
    echo "================================================"
    echo ""
else
    echo "✗ Failed! (HTTP Status: $HTTP_STATUS)"
    echo ""
    echo "Response:"
    echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
    echo ""
    echo "================================================"
    echo "Troubleshooting:"
    echo "  1. Make sure the backend is running (npm run dev in backend/)"
    echo "  2. Check that NODE_ENV is set to 'development' (not production)"
    echo "  3. Verify the backend URL is correct: $BACKEND_URL"
    echo "  4. Try: ./test-webhook.sh v1.0.0-test <apk-url> <apk-name> http://localhost:3000"
    echo "================================================"
    echo ""
    exit 1
fi

