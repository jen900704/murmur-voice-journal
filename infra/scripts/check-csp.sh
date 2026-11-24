#!/bin/sh
# Checks that the CSP header in modules/static-site matches the meta tag in index.html.
# The header may add frame-ancestors, which browsers ignore in a meta tag.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)

app=$(sed -n 's/.*http-equiv="Content-Security-Policy" content="\([^"]*\)".*/\1/p' "$root/index.html" | tr ';' '\n' | sed 's/^ *//; s/ *$//' | sed '/^$/d' | sort)
tf=$(sed -n '/default_csp = join/,/\])/p' "$here/../modules/static-site/main.tf" | sed -n 's/^ *"\(.*\)",$/\1/p' | grep -v '^frame-ancestors ' | sort)

if [ -z "$app" ]; then
  echo "check-csp: no CSP meta tag found in index.html" >&2
  exit 1
fi
if [ "$app" != "$tf" ]; then
  echo "check-csp: the CSP in infra/modules/static-site/main.tf differs from index.html" >&2
  echo "--- index.html" >&2
  echo "$app" >&2
  echo "--- static-site" >&2
  echo "$tf" >&2
  exit 1
fi
echo "check-csp: header matches index.html"
