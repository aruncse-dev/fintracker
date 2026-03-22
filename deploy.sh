#!/bin/bash
set -e

# Paste your deployment ID here (run `clasp deployments` once to get it)
DEPLOYMENT_ID="AKfycbwKUQFS42Snl_DlXl1A4xk_D4HSThuTdiqd2DEtlTaX5PkkJ5Ia3ex9wHR_qpW_FfikXQ"

cd "$(dirname "$0")"

echo "→ Pushing code to Apps Script..."
clasp push --force

if [ -n "$DEPLOYMENT_ID" ]; then
  echo "→ Updating deployment..."
  clasp deploy --deploymentId "$DEPLOYMENT_ID" --description "Deploy $(date +'%Y-%m-%d %H:%M')"
else
  echo "→ Creating new deployment..."
  clasp deploy --description "Deploy $(date +'%Y-%m-%d %H:%M')"
fi

echo "✓ Done"

if [ -n "$API_TOKEN" ]; then
  echo ""
  echo "→ Setting API token in Script Properties..."
  clasp run setApiToken --params "[\"$API_TOKEN\"]" && echo "✓ API token set" || echo "⚠ clasp run failed — set token manually or via GitHub Actions"
fi

echo ""
echo "→ Verifying public access..."
TOKEN_PARAM="${API_TOKEN:+&token=$API_TOKEN}"
RESPONSE=$(curl -sL "${DEPLOYMENT_ID:+https://script.google.com/macros/s/${DEPLOYMENT_ID}/exec}?action=init${TOKEN_PARAM}" 2>/dev/null | head -c 20)
if echo "$RESPONSE" | grep -q "<!doctype\|<!DOCTYPE"; then
  echo ""
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║  ⚠  ACCESS RESTRICTED — fix required before app will work   ║"
  echo "╠══════════════════════════════════════════════════════════════╣"
  echo "║  1. Open: https://script.google.com                         ║"
  echo "║  2. Deploy → Manage deployments → ✏ Edit                    ║"
  echo "║  3. Set 'Who has access' → Anyone                           ║"
  echo "║  4. Click Deploy                                             ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  exit 1
else
  echo "✓ API is publicly accessible"
fi
