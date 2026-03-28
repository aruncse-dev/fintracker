#!/bin/bash
set -e

cd "$(dirname "$0")"

# Check prerequisites
if ! command -v clasp &> /dev/null; then
  echo "❌ clasp not found. Install: npm install -g @google/clasp"
  exit 1
fi

if ! command -v gh &> /dev/null; then
  echo "❌ GitHub CLI (gh) not found. Install: https://cli.github.com"
  exit 1
fi

echo "→ Pushing code to Apps Script..."
clasp push --force

echo "→ Creating deployment..."
DEPLOY_OUTPUT=$(clasp deploy --description "Deploy $(date +'%Y-%m-%d %H:%M')" 2>&1)
DEPLOYMENT_ID=$(echo "$DEPLOY_OUTPUT" | grep -oP '(?<="id":")[^"]*' | head -1)

if [ -z "$DEPLOYMENT_ID" ]; then
  echo "⚠ Failed to extract deployment ID"
  echo "Deploy output: $DEPLOY_OUTPUT"
  exit 1
fi

echo "✓ Deployed with ID: $DEPLOYMENT_ID"

if [ -n "$API_TOKEN" ]; then
  echo ""
  echo "→ Setting API token in Script Properties..."
  clasp run setApiToken --params "[\"$API_TOKEN\"]" && echo "✓ API token set" || echo "⚠ clasp run failed — set token manually"
fi

echo ""
echo "→ Verifying deployment..."
sleep 2
RESPONSE=$(curl -sL "https://script.google.com/macros/s/${DEPLOYMENT_ID}/exec?action=init" 2>/dev/null | head -c 50)
if echo "$RESPONSE" | grep -q "ok\|data"; then
  echo "✓ Deployment is working"

  GAS_URL="https://script.google.com/macros/s/${DEPLOYMENT_ID}/exec"
  echo ""
  echo "📋 Deployment ID: $DEPLOYMENT_ID"
  echo "🔗 URL: $GAS_URL"

  # Update GitHub secret
  echo ""
  echo "→ Updating GitHub secret VITE_GAS_URL..."
  if gh secret set VITE_GAS_URL --body "$GAS_URL" 2>/dev/null; then
    echo "✓ GitHub secret updated"
  else
    echo "⚠ Failed to update GitHub secret. Make sure you're authenticated: gh auth login"
  fi
else
  echo "⚠ Deployment returned unexpected response: $RESPONSE"
  echo ""
  echo "If you see HTML redirect, manually:"
  echo "1. Open: https://script.google.com"
  echo "2. Deploy → Manage deployments → Edit"
  echo "3. Set 'Who has access' → Anyone"
  exit 1
fi

# List and clean old deployments
echo ""
echo "→ Checking for old deployments..."
DEPLOYMENTS=$(clasp deployments 2>/dev/null | tail -n +2) # Skip header
if [ -z "$DEPLOYMENTS" ]; then
  echo "✓ No old deployments found"
else
  OLD_COUNT=$(echo "$DEPLOYMENTS" | grep -v "$DEPLOYMENT_ID" | wc -l)
  if [ "$OLD_COUNT" -gt 0 ]; then
    echo "Found $OLD_COUNT old deployment(s):"
    echo "$DEPLOYMENTS" | grep -v "$DEPLOYMENT_ID" | head -5
    echo ""
    read -p "Delete old deployments? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      echo "$DEPLOYMENTS" | grep -v "$DEPLOYMENT_ID" | awk '{print $1}' | while read old_id; do
        if [ ! -z "$old_id" ]; then
          clasp undeploy "$old_id" 2>/dev/null && echo "✓ Deleted: $old_id" || echo "⚠ Failed to delete: $old_id"
        fi
      done
    else
      echo "Skipped cleanup"
    fi
  else
    echo "✓ No old deployments to clean"
  fi
fi

echo ""
echo "✅ GAS deployment complete!"
