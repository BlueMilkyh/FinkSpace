#!/bin/bash
set -e

# FinkSpace Release Script
# Usage: ./scripts/release.sh [patch|minor|major] or ./scripts/release.sh 1.2.3

TAURI_CONF="src-tauri/tauri.conf.json"
PKG_JSON="package.json"

# Get current version
CURRENT=$(grep -o '"version": "[^"]*"' "$TAURI_CONF" | head -1 | cut -d'"' -f4)
echo "Current version: $CURRENT"

# Parse current version
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

# Determine new version
case "${1:-patch}" in
  patch) PATCH=$((PATCH + 1)) ; NEW="$MAJOR.$MINOR.$PATCH" ;;
  minor) MINOR=$((MINOR + 1)) ; PATCH=0 ; NEW="$MAJOR.$MINOR.$PATCH" ;;
  major) MAJOR=$((MAJOR + 1)) ; MINOR=0 ; PATCH=0 ; NEW="$MAJOR.$MINOR.$PATCH" ;;
  *) NEW="$1" ;;
esac

echo "New version: $NEW"
echo ""

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: You have uncommitted changes. Commit or stash them first."
  exit 1
fi

# Update version in tauri.conf.json
sed -i "s/\"version\": \"$CURRENT\"/\"version\": \"$NEW\"/" "$TAURI_CONF"

# Update version in package.json
sed -i "s/\"version\": \"$CURRENT\"/\"version\": \"$NEW\"/" "$PKG_JSON"

echo "Updated $TAURI_CONF and $PKG_JSON"

# Commit, tag, push
git add "$TAURI_CONF" "$PKG_JSON"
git commit -m "release: v$NEW"
git tag "v$NEW"
git push origin main
git push origin "v$NEW"

echo ""
echo "Done! v$NEW pushed. GitHub Actions will build and create the release."
echo "Check: https://github.com/AljazFink/FinkSpace/actions"
