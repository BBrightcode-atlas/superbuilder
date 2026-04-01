#!/bin/bash
# Run compose E2E 5 times, track pass/fail
set -a && source .env && set +a

PASS=0
FAIL=0
RESULTS=()

for i in 1 2 3 4 5; do
  echo ""
  echo "════════════════════════════════════════════"
  echo "  RUN $i / 5"
  echo "════════════════════════════════════════════"

  if RUN_ID=$i npx tsx scripts/compose-e2e-full.ts; then
    PASS=$((PASS + 1))
    RESULTS+=("R$i: ✅ PASS")
  else
    FAIL=$((FAIL + 1))
    RESULTS+=("R$i: ❌ FAIL")
  fi

  echo ""
  echo "── Progress: $PASS pass / $FAIL fail ──"
done

echo ""
echo "════════════════════════════════════════════"
echo "  FINAL RESULTS: $PASS / 5 passed"
echo "════════════════════════════════════════════"
for r in "${RESULTS[@]}"; do
  echo "  $r"
done
echo "════════════════════════════════════════════"

if [ $FAIL -eq 0 ]; then
  echo "🎉 ALL 5 RUNS PASSED!"
  exit 0
else
  echo "💔 $FAIL runs failed"
  exit 1
fi
