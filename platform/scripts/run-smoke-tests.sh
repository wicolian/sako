#!/bin/bash

# Sako v1 - Smoke Test Runner
# Runs critical integration tests to validate core flows

set -e

echo "🧪 Sako v1 Smoke Tests"
echo "========================"
echo ""

# Navigate to API directory
cd "$(dirname "$0")/../services/api"

echo "📋 Running test suite..."
echo ""

# Run specific smoke test files
echo "1️⃣  Stripe Subscription Sync Tests"
npm test -- stripe-subscription-sync.spec.ts --verbose 2>&1 | tail -20

echo ""
echo "2️⃣  From Composer (Send to Sako) Tests"
npm test -- from-composer.spec.ts --verbose 2>&1 | tail -20

echo ""
echo "3️⃣  Task Pipeline Tests"
npm test -- task-pipeline.spec.ts --verbose 2>&1 | tail -20

echo ""
echo "4️⃣  Day Credit Burn Tests"
npm test -- day-credit-burn.spec.ts --verbose 2>&1 | tail -20

echo ""
echo "5️⃣  Task Slots Tests"
npm test -- task-slots.spec.ts --verbose 2>&1 | tail -20

echo ""
echo "========================"
echo "✅ Smoke tests complete!"
echo ""
echo "📝 For manual QA checklist, see: docs/QA_CHECKLIST.md"


