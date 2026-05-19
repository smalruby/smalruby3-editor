#!/usr/bin/env bash
# scripts/security-monitor.sh
#
# GitHub Pages subdomain takeover defense check.
#
# 13 checks against the smalruby org's GitHub Pages exposure:
#   - DNS verification TXT (2 domains)
#   - CAA records (smalruby.app: 6 entries, smalruby.jp: 2 entries)
#   - Pages settings (5 repos × https_enforced + cname'd repos × protected_domain_state)
#   - Content sanity (2 URLs × "smalruby" string presence)
#
# Usage (local):
#   gh auth status                       # must be logged in
#   ./scripts/security-monitor.sh        # all green → exit 0
#
# Usage (CI): called by .github/workflows/security-monitor.yml
#
# Env vars (all optional):
#   ERROR_FILE   Append failure details here (one per line, markdown bullet form).
#                Default: /dev/null. CI sets this to a file so the next step can
#                read failures and open an issue.
#   GH_TOKEN     gh CLI token. CI sets this from secrets.GITHUB_TOKEN.
#                Locally, gh auth login covers this; do not set unless overriding.
#
# Exit codes:
#   0  all 13 checks passed
#   1  one or more checks failed (details on stdout and in ERROR_FILE)
#   2  required dependency missing (gh / dig / curl / jq)
#
# Runbook: docs/security/github-pages-subdomain-takeover.md

set -uo pipefail

ERROR_FILE="${ERROR_FILE:-/dev/null}"
ERRORS=()

# --- preflight: required commands ---
missing_cmds=()
for cmd in gh dig curl jq; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    missing_cmds+=("$cmd")
  fi
done
if [ ${#missing_cmds[@]} -gt 0 ]; then
  echo "❌ Required commands missing: ${missing_cmds[*]}" >&2
  echo "   Install: gh (github cli), dnsutils (dig), curl, jq" >&2
  exit 2
fi

# --- check functions ---

check_dns_txt() {
  local domain="$1"
  local txt
  txt=$(dig +short "_github-pages-challenge-smalruby.$domain" TXT 2>/dev/null)
  if [ -z "$txt" ]; then
    ERRORS+=("DNS verification TXT missing for $domain — Org-level domain verification at risk")
  else
    echo "✓ DNS verification TXT present for $domain"
  fi
}

check_caa() {
  local domain="$1"
  shift
  local caa
  caa=$(dig +short "$domain" CAA 2>/dev/null)
  if [ -z "$caa" ]; then
    ERRORS+=("CAA records missing entirely for $domain — any CA can issue certificates")
    return
  fi
  local missing=()
  for required in "$@"; do
    if ! echo "$caa" | grep -qF "$required"; then
      missing+=("$required")
    fi
  done
  if [ ${#missing[@]} -gt 0 ]; then
    local list
    list=$(IFS=', '; echo "${missing[*]}")
    ERRORS+=("CAA $domain: missing entries — $list")
  else
    echo "✓ CAA records OK for $domain"
  fi
}

check_pages() {
  local repo="$1"
  local expect_verified="$2"
  local data
  data=$(gh api "repos/smalruby/$repo/pages" 2>/dev/null)
  if [ -z "$data" ]; then
    ERRORS+=("Pages $repo: API returned empty (repo deleted / Pages disabled / API access denied)")
    return
  fi
  local https protected cname
  https=$(echo "$data" | jq -r '.https_enforced')
  protected=$(echo "$data" | jq -r '.protected_domain_state // "n/a"')
  cname=$(echo "$data" | jq -r '.cname // "(none)"')
  if [ "$https" != "true" ]; then
    ERRORS+=("Pages $repo (cname=$cname): https_enforced=$https (expected: true)")
  fi
  if [ "$expect_verified" = "yes" ] && [ "$protected" != "verified" ]; then
    ERRORS+=("Pages $repo (cname=$cname): protected_domain_state=$protected (expected: verified)")
  fi
  echo "✓ Pages $repo: cname=$cname https=$https protected=$protected"
}

check_content() {
  local url="$1"
  local needle="$2"
  local body_file http
  body_file=$(mktemp)
  trap 'rm -f "$body_file"' RETURN
  http=$(curl -sL --max-time 15 -o "$body_file" -w '%{http_code}' "$url")
  if [ "$http" != "200" ]; then
    ERRORS+=("Content check $url: HTTP $http (expected: 200) — possible DNS or Pages disruption")
    return
  fi
  if ! grep -qi "$needle" "$body_file"; then
    ERRORS+=("Content check $url: did not contain '$needle' — possible takeover or unrelated content")
  else
    echo "✓ Content check $url: '$needle' present, HTTP 200"
  fi
}

# --- run all checks ---

echo "=== Layer 1: DNS verification TXT records ==="
check_dns_txt smalruby.app
check_dns_txt smalruby.jp
echo ""

echo "=== Layer 6: CAA records ==="
check_caa smalruby.app \
  '0 issue "letsencrypt.org"' \
  '0 issue "amazon.com"' \
  '0 issue "amazontrust.com"' \
  '0 issue "awstrust.com"' \
  '0 issue "amazonaws.com"' \
  '0 issuewild ";"'
check_caa smalruby.jp \
  '0 issue "letsencrypt.org"' \
  '0 issuewild ";"'
echo ""

echo "=== Layer 1+2: Pages settings (verified + https_enforced) ==="
check_pages smalruby.app yes
check_pages smalruby.github.com yes
check_pages smalruby3-editor no
check_pages smalruby3-gui no
check_pages dxruby_sdl no
echo ""

echo "=== Content sanity (takeover detection) ==="
check_content https://smalruby.app/ smalruby
check_content https://smalruby.jp/ smalruby
echo ""

# --- report ---

if [ ${#ERRORS[@]} -eq 0 ]; then
  echo "✅ All checks passed"
  exit 0
fi

echo "❌ ${#ERRORS[@]} error(s) detected:"
printf '  - %s\n' "${ERRORS[@]}"
{
  printf -- '- %s\n' "${ERRORS[@]}"
} >> "$ERROR_FILE"
exit 1
