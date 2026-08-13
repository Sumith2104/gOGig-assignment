#!/usr/bin/env bash

# Test script for VehicleIQ API
BASE_URL="http://localhost:3000"

echo "=== 1. Checking Health Endpoint ==="
curl -s "${BASE_URL}/api/health" | jq .

echo ""
echo "=== 2. Listing Recent Images ==="
curl -s "${BASE_URL}/api/images?limit=5" | jq .

echo ""
echo "=== 3. Upload Sample Test Image ==="
# Create dummy sample image if not exists
mkdir -p sample-images
if [ ! -f "sample-images/test_vehicle.jpg" ]; stream
  convert -size 800x600 xc:gray sample-images/test_vehicle.jpg 2>/dev/null || touch sample-images/test_vehicle.jpg
fi

RESPONSE=$(curl -s -X POST "${BASE_URL}/api/images/upload" \
  -F "file=@sample-images/test_vehicle.jpg" \
  -H "x-idempotency-key: test-cli-upload-001")

echo "$RESPONSE" | jq .

IMAGE_ID=$(echo "$RESPONSE" | jq -r '.id')

if [ "$IMAGE_ID" != "null" ] && [ -n "$IMAGE_ID" ]; then
  echo ""
  echo "=== 4. Checking Status for Image ${IMAGE_ID} ==="
  sleep 2
  curl -s "${BASE_URL}/api/images/${IMAGE_ID}/status" | jq .

  echo ""
  echo "=== 5. Waiting for Async Processing... ==="
  sleep 4

  echo ""
  echo "=== 6. Fetching Analysis Results ==="
  curl -s "${BASE_URL}/api/images/${IMAGE_ID}/results" | jq .
fi
