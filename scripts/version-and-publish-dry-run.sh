#!/bin/bash

# Entente Version and Publish Script (Dry Run)
# Shows what would be versioned and published without actually doing it

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Package order based on dependencies
PACKAGES=(
  "types"
  "fixtures"
  "client"
  "provider"
  "cli"
)

echo -e "${BLUE}🔍 DRY RUN: Version and publish process...${NC}"

# Ensure we're in the root directory
if [ ! -f "package.json" ] || [ ! -d "packages" ]; then
  echo -e "${RED}❌ Error: Must run from project root${NC}"
  exit 1
fi

# Check if we have uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
  echo -e "${RED}❌ Error: You have uncommitted changes. Please commit or stash them first.${NC}"
  echo -e "${YELLOW}💡 Run 'git status' to see uncommitted changes${NC}"
  exit 1
fi

echo -e "${BLUE}📋 Current package versions:${NC}"

# Process each package in order
for PACKAGE in "${PACKAGES[@]}"; do
  PACKAGE_DIR="packages/$PACKAGE"

  if [ ! -d "$PACKAGE_DIR" ]; then
    echo -e "${YELLOW}⚠️  Skipping $PACKAGE (directory not found)${NC}"
    continue
  fi

  cd "$PACKAGE_DIR"

  # Get current version
  CURRENT_VERSION=$(node -p "require('./package.json').version")

  # Calculate what the new version would be
  IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
  MAJOR=${VERSION_PARTS[0]}
  MINOR=${VERSION_PARTS[1]}
  PATCH=${VERSION_PARTS[2]}
  NEW_PATCH=$((PATCH + 1))
  NEW_VERSION="$MAJOR.$MINOR.$NEW_PATCH"

  echo -e "  📦 ${GREEN}@entente/$PACKAGE${NC}: $CURRENT_VERSION → $NEW_VERSION"

  cd ../..
done

echo -e "${BLUE}📝 What would happen:${NC}"
echo "  1. Build all packages"
echo "  2. Run all tests"
echo "  3. For each package (in order):"
echo "     - Increment patch version"
echo "     - Build package"
echo "     - Commit version change"
echo "     - Publish to npm with --access public"

echo -e "${YELLOW}💡 To actually run: pnpm version-and-publish${NC}"