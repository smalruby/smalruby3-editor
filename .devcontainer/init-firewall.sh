#!/usr/bin/env bash
# .devcontainer/init-firewall.sh — egress allowlist firewall for the devcontainer.
#
# Applied at every container start via devcontainer.json `postStartCommand` (iptables
# rules live in the container's network namespace and are gone after a stop/start, so
# they must be reapplied). Policy:
#
#   - default-DROP on INPUT / OUTPUT / FORWARD (IPv4 *and* IPv6).
#   - allow loopback, ESTABLISHED/RELATED, and DNS only to the configured resolvers.
#   - allow an IPv4 allowlist: GitHub + npm + Anthropic + AWS (this deploy region +
#     global services) + a few small hosts resolved via dig.
#
# Why this exists: this container can hold non-public credentials (AWS SSO short-lived
# tokens for `cdk deploy`, the in-container Claude login), so per the NaCl isolation
# guideline the container's egress must be limited to known destinations.
#
# Fail-closed: `set -e` is intentionally NOT used — even if building the allowlist
# partly fails, the DROP policy is still applied at the end. Broaden the allowlist via
# EXTRA_HOSTS below or .devcontainer/firewall-allow.local (gitignored; one host or
# CIDR per line). See .devcontainer/README.md "egress allowlist firewall".
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

log()  { echo "init-firewall: $*"; }
warn() { echo "init-firewall: WARN $*" >&2; }

# --- AWS settings (region + SSO portal) from the committed, non-secret source -----
# infra/aws-sso.env is the single source of truth used by bin/setup-aws-sso. Reusing
# it keeps the firewall fork-friendly: a different AWS org only edits that one file.
AWS_REGION="ap-northeast-1"
SSO_PORTAL_HOST=""
if [[ -f "${ROOT}/infra/aws-sso.env" ]]; then
  # shellcheck source=/dev/null
  . "${ROOT}/infra/aws-sso.env" 2>/dev/null || true
  [[ -n "${AWS_SSO_REGION:-}" ]] && AWS_REGION="${AWS_SSO_REGION}"
  if [[ -n "${AWS_SSO_START_URL:-}" ]]; then
    SSO_PORTAL_HOST="$(printf '%s' "${AWS_SSO_START_URL}" | sed -E 's#^https?://##; s#/.*$##')"
  fi
fi

# Small / region-specific destinations that are easier to dig-resolve than to carve
# out of the AWS range list. Add more here when something legitimate gets blocked.
EXTRA_HOSTS=(
  # Anthropic (Claude Code). statsig.anthropic.com has no A record, so it is omitted.
  api.anthropic.com
  sentry.io
  # npm + packages that fetch binaries from GitHub asset / Node hosts
  registry.npmjs.org
  objects.githubusercontent.com
  codeload.github.com
  nodejs.org
  # AWS IAM Identity Center (SSO) endpoints for the deploy region
  "oidc.${AWS_REGION}.amazonaws.com"
  "portal.sso.${AWS_REGION}.amazonaws.com"
  "sso.${AWS_REGION}.amazonaws.com"
)
[[ -n "${SSO_PORTAL_HOST}" ]] && EXTRA_HOSTS+=("${SSO_PORTAL_HOST}")

if [[ "$(id -u)" -ne 0 ]]; then warn "must run as root (needs NET_ADMIN/NET_RAW)"; exit 1; fi
missing=(); for c in iptables ipset dig curl jq; do command -v "$c" >/dev/null 2>&1 || missing+=("$c"); done
if [[ ${#missing[@]} -gt 0 ]]; then warn "missing tools: ${missing[*]} — firewall NOT applied"; exit 1; fi

log "starting (AWS region: ${AWS_REGION}${SSO_PORTAL_HOST:+, SSO portal: ${SSO_PORTAL_HOST}})"

# --- reset ------------------------------------------------------------------------
# Flush rules AND reopen the policy to ACCEPT first. Flushing alone leaves a prior
# DROP policy in place, which would block the dig/curl calls used to build the
# allowlist if this script is re-run inside an already-firewalled container.
iptables -F; iptables -X 2>/dev/null || true
iptables -t nat -F 2>/dev/null || true; iptables -t mangle -F 2>/dev/null || true
iptables -P INPUT ACCEPT; iptables -P FORWARD ACCEPT; iptables -P OUTPUT ACCEPT
ipset destroy allowed-dst 2>/dev/null || true

# Collect all CIDRs/IPs into a restore file and load them in a single ipset call —
# far faster than per-entry `ipset add` for the thousands of AWS prefixes.
SET_FILE="$(mktemp)"; trap 'rm -f "${SET_FILE}"' EXIT
echo "create allowed-dst hash:net family inet hashsize 4096 maxelem 262144" > "${SET_FILE}"
emit_cidr() { [[ "$1" =~ ^[0-9.]+(/[0-9]+)?$ ]] && echo "add allowed-dst $1" >> "${SET_FILE}"; }
emit_host() {
  local h="$1" ip f=0
  while read -r ip; do [[ "$ip" =~ ^[0-9.]+$ ]] || continue; emit_cidr "$ip"; f=1; done \
    < <(dig +short A "$h" 2>/dev/null)
  [[ $f -eq 1 ]] && log "+ $h" || warn "could not resolve $h"
}

# GitHub public ranges (git / gh / scratchfoundation upstream fetch / some npm deps).
gh_meta="$(curl -fsSL --max-time 20 https://api.github.com/meta 2>/dev/null || true)"
if [[ -n "$gh_meta" ]]; then
  n=0; while read -r c; do [[ "$c" =~ ^[0-9.]+/[0-9]+$ ]] || continue; emit_cidr "$c"; n=$((n+1)); done \
    < <(echo "$gh_meta" | jq -r '((.web//[])+(.api//[])+(.git//[]))[]' 2>/dev/null)
  log "GitHub ranges: $n"
else
  warn "github meta fetch failed — falling back to dig"
  for h in github.com api.github.com; do emit_host "$h"; done
fi

# AWS public ranges: the deploy region + us-east-1 + GLOBAL (IAM/STS/Route53 and other
# global endpoints resolve into us-east-1/GLOBAL). Narrow further with .service if the
# set gets too large; broaden by adding regions to the jq select below.
aws="$(curl -fsSL --max-time 20 https://ip-ranges.amazonaws.com/ip-ranges.json 2>/dev/null || true)"
if [[ -n "$aws" ]]; then
  n=0; while read -r c; do [[ "$c" =~ ^[0-9.]+/[0-9]+$ ]] || continue; emit_cidr "$c"; n=$((n+1)); done \
    < <(echo "$aws" | jq -r --arg r "$AWS_REGION" \
        '.prefixes[] | select(.region==$r or .region=="us-east-1" or .region=="GLOBAL") | .ip_prefix' 2>/dev/null)
  log "AWS ranges (${AWS_REGION}+us-east-1+GLOBAL): $n"
else
  warn "aws ip-ranges fetch failed — cdk deploy / sso login may be blocked"
fi

for h in "${EXTRA_HOSTS[@]}"; do emit_host "$h"; done

# Per-user additions (gitignored): one host or CIDR per line, '#' starts a comment.
LOCAL_ALLOW="${ROOT}/.devcontainer/firewall-allow.local"
if [[ -f "${LOCAL_ALLOW}" ]]; then
  while read -r line; do
    line="${line%%#*}"; line="$(printf '%s' "$line" | tr -d '[:space:]')"; [[ -z "$line" ]] && continue
    if [[ "$line" =~ ^[0-9.]+(/[0-9]+)?$ ]]; then emit_cidr "$line"; log "+ (local) $line"; else emit_host "$line"; fi
  done < "${LOCAL_ALLOW}"
fi

ipset restore -! < "${SET_FILE}" || warn "ipset restore reported errors"

# --- IPv4 rules -------------------------------------------------------------------
iptables -A INPUT  -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT
iptables -A INPUT  -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# DNS only to the configured resolvers (docker embedded DNS 127.0.0.11 +
# /etc/resolv.conf nameservers). Blocks DNS exfiltration to arbitrary servers.
resolvers="127.0.0.11"
while read -r ns; do [[ -n "$ns" ]] && resolvers+=" $ns"; done < <(awk '/^nameserver/ {print $2}' /etc/resolv.conf 2>/dev/null)
for r in $resolvers; do
  [[ "$r" =~ ^[0-9.]+$ ]] || continue
  iptables -A OUTPUT -p udp -d "$r" --dport 53 -j ACCEPT
  iptables -A OUTPUT -p tcp -d "$r" --dport 53 -j ACCEPT
done
log "DNS resolvers allowed: $resolvers"

iptables -A OUTPUT -m set --match-set allowed-dst dst -j ACCEPT
iptables -P INPUT DROP; iptables -P FORWARD DROP; iptables -P OUTPUT DROP

# --- IPv6: block entirely (allowlist is IPv4-only) --------------------------------
# Without this, any IPv6 egress would bypass the IPv4 allowlist above. Loopback stays
# open; everything else is dropped.
if command -v ip6tables >/dev/null 2>&1; then
  ip6tables -F 2>/dev/null || true
  ip6tables -A INPUT  -i lo -j ACCEPT 2>/dev/null || true
  ip6tables -A OUTPUT -o lo -j ACCEPT 2>/dev/null || true
  ip6tables -A INPUT  -m state --state ESTABLISHED,RELATED -j ACCEPT 2>/dev/null || true
  ip6tables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT 2>/dev/null || true
  ip6tables -P INPUT DROP 2>/dev/null && ip6tables -P FORWARD DROP 2>/dev/null && ip6tables -P OUTPUT DROP 2>/dev/null \
    && log "IPv6 egress blocked" || warn "could not fully block IPv6 (kernel may lack ip6tables)"
fi

log "applied. allowlist entries: $(ipset list allowed-dst 2>/dev/null | grep -cE '^[0-9]+\.')"

# --- verify -----------------------------------------------------------------------
curl -fsSL --max-time 8 https://api.github.com/zen >/dev/null 2>&1 \
  && log "verify OK: github reachable" || warn "verify: github NOT reachable"
curl -fsSL --max-time 6 https://example.com >/dev/null 2>&1 \
  && warn "verify FAIL: example.com reachable — allowlist too broad" || log "verify OK: example.com blocked"
log "done"
