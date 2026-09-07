#!/usr/bin/env bash
# Check whether usernames are usable in FEATURED_USERNAMES (src/app/page.tsx).
#
# The landing wall drops any page that is offline, password-protected or marked
# sensitive (see the `featured` filter in src/app/page.tsx), so a name that fails
# here would silently render nothing rather than error.
#
# Usage: ./scripts/check-featured.sh syun anyix bored
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env.local; set +a
U="$NEXT_PUBLIC_SUPABASE_URL"; K="$NEXT_PUBLIC_SUPABASE_ANON_KEY"
for n in "$@"; do
  curl -s -X POST "$U/rest/v1/rpc/get_public_page" \
    -H "apikey: $K" -H "Authorization: Bearer $K" \
    -H "Content-Type: application/json" \
    -d "{\"page_username\":\"$n\"}" \
  | NAME="$n" python3 -c '
import sys, os, json
n = os.environ["NAME"]
try:
    d = json.loads(sys.stdin.read(), strict=False)
except Exception:
    print(f"{n:<20} BAD RESPONSE"); raise SystemExit
d = d[0] if isinstance(d, list) and d else d
if not d:
    print(f"{n:<20} NO SUCH PAGE"); raise SystemExit
bad = []
if not d.get("live"): bad.append("offline")
if d.get("sensitive"): bad.append("sensitive")
if d.get("password_protected"): bad.append("password")
links = len(d.get("links") or [])
if not links: bad.append("no links")
status = "OK  " if not bad else "DROP"
label = repr(d.get("name") or "")
note = ", ".join(bad)
print("%-20s %s links=%-3d %-24s %s" % (n, status, links, label, note))
'
done
