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
# Use sed instead of grep -P for macOS compatibility
DEPLOYMENT_ID=$(echo "$DEPLOY_OUTPUT" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -1)

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

  # Update .env file
  echo ""
  echo "→ Updating .env file..."
  if [ -f "web/.env" ]; then
    sed -i '' "s|^VITE_GAS_URL=.*|VITE_GAS_URL=$GAS_URL|" "web/.env"
    echo "✓ .env updated"
  else
    echo "⚠ web/.env not found"
  fi

  # Update GitHub secret
  echo ""
  echo "→ Updating GitHub secret VITE_GAS_URL..."
  if gh secret set VITE_GAS_URL --body "$GAS_URL" 2>/dev/null; then
    echo "✓ GitHub secret updated"
    echo ""
    echo "→ Triggering Worker redeploy to pick up new GAS URL..."
    if gh workflow run deploy-worker.yml 2>/dev/null; then
      echo "✓ Worker redeploy triggered (see: gh run list --workflow=deploy-worker.yml)"
    else
      echo "⚠ Worker redeploy trigger failed. Run manually:"
      echo "   gh workflow run deploy-worker.yml"
    fi
  else
    echo "⚠ GitHub secret update skipped. Run these manually:"
    echo "   gh secret set VITE_GAS_URL --body \"$GAS_URL\""
    echo "   gh workflow run deploy-worker.yml"
  fi
else
  echo "⚠ Deployment returned unexpected response: $RESPONSE"
  echo ""
  echo "This is expected on first deployment. Complete these steps:"
  echo "1. Open: https://script.google.com"
  echo "2. Click 'Editor' (left sidebar)"
  echo "3. Find the latest deployment"
  echo "4. Click 'Manage deployments' ⚙️"
  echo "5. Edit the new deployment"
  echo "6. Set 'Who has access' → 'Anyone'"
  echo "7. Save"
fi

# List and clean old deployments (non-interactive)
echo ""
echo "→ Checking for old deployments..."
DEPLOYMENTS=$(clasp deployments 2>/dev/null | tail -n +2) # Skip header
if [ -z "$DEPLOYMENTS" ]; then
  echo "✓ No old deployments found"
else
  OLD_COUNT=$(echo "$DEPLOYMENTS" | grep -v "$DEPLOYMENT_ID" | wc -l)
  if [ "$OLD_COUNT" -gt 0 ]; then
    echo "Found $OLD_COUNT old deployment(s). Deleting..."
    echo "$DEPLOYMENTS" | grep -v "$DEPLOYMENT_ID" | awk '{print $1}' | while read old_id; do
      if [ ! -z "$old_id" ]; then
        clasp undeploy "$old_id" 2>/dev/null && echo "✓ Deleted: $old_id" || echo "⚠ Failed to delete: $old_id"
      fi
    done
  else
    echo "✓ No old deployments to clean"
  fi
fi

echo ""
echo "✅ GAS deployment complete!"
echo ""
echo "Next steps:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1️⃣  REQUIRED: Set GAS deployment permissions"
echo "   → Open: https://script.google.com"
echo "   → Manage deployments → Edit latest → Who has access → Anyone"
echo ""
echo "2️⃣  OPTIONAL: Authenticate GitHub CLI for auto-secret updates"
echo "   → Run: gh auth login"
echo "   → Redeploy to auto-set GitHub secret: ./deploy.sh"
echo ""
echo "3️⃣  CREATE: Savings sheet in FinanceTrackerAssets"
echo "   → Open spreadsheet"
echo "   → Insert new sheet → Name: 'Savings'"
echo "   → (Headers auto-created by GAS on first API call)"
echo ""
echo "4️⃣  TEST: Frontend"
echo "   → cd web && npm run dev"
echo "   → Click Savings in nav → Should show Dashboard"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
