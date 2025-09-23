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
  "metadata"
  "fixtures"
  "consumer"
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

echo -e "${BLUE}🔨 Building all packages and apps...${NC}"

# Use the consolidated build script
echo -e "  📦 Building all packages and apps..."
if node scripts/build-packages.js; then
  echo -e "${GREEN}✅ All packages and apps built successfully!${NC}"
else
  echo -e "${RED}❌ Build failed${NC}"
  exit 1
fi

echo -e "${BLUE}🧪 Running tests for each package in dependency order...${NC}"

# Process each package in order - test only (build already done)
for PACKAGE in "${PACKAGES[@]}"; do
  PACKAGE_DIR="packages/$PACKAGE"

  if [ ! -d "$PACKAGE_DIR" ]; then
    echo -e "${YELLOW}⚠️  Skipping $PACKAGE (directory not found)${NC}"
    continue
  fi

  echo -e "${BLUE}🧪 Testing @entente/$PACKAGE...${NC}"

  cd "$PACKAGE_DIR"

  # Run tests if test script exists
  if grep -q '"test"' package.json; then
    echo -e "  🧪 Testing @entente/$PACKAGE..."
    if pnpm test; then
      echo -e "  ✅ Tests passed"
    else
      echo -e "${RED}❌ Tests failed for @entente/$PACKAGE${NC}"
      cd ../..
      exit 1
    fi
  else
    echo -e "  ⚠️  No test script found, skipping tests"
  fi

  cd ../..
done

echo -e "${GREEN}✅ All tests passed successfully!${NC}"
echo -e "${BLUE}📝 What publishing would do:${NC}"
echo "  1. For each package (in order):"
echo "     - Increment patch version"
echo "     - Commit version change"
echo "     - Publish to npm with --access public"

echo -e "${YELLOW}💡 To actually publish: pnpm version-and-publish${NC}"
