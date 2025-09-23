#!/bin/bash

# Entente Version and Publish Script
# Versions and publishes all packages in the correct dependency order

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

echo -e "${GREEN}🚀 Starting version and publish process...${NC}"

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

# Check if we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo -e "${YELLOW}⚠️  Warning: You're on branch '$CURRENT_BRANCH', not 'main'${NC}"
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

echo -e "${GREEN}🧪 Building all packages and apps...${NC}"

# Use the consolidated build script
echo "  📦 Building all packages and apps..."
if node scripts/build-packages.js; then
  echo -e "${GREEN}✅ All packages and apps built successfully!${NC}"
else
  echo -e "${RED}❌ Build failed${NC}"
  exit 1
fi

echo -e "${GREEN}🧪 Running tests for each package in dependency order...${NC}"

# Process each package in order - test only (build already done)
for PACKAGE in "${PACKAGES[@]}"; do
  PACKAGE_DIR="packages/$PACKAGE"

  if [ ! -d "$PACKAGE_DIR" ]; then
    echo -e "${YELLOW}⚠️  Skipping $PACKAGE (directory not found)${NC}"
    continue
  fi

  echo -e "${GREEN}🧪 Testing @entente/$PACKAGE...${NC}"

  cd "$PACKAGE_DIR"

  # Run tests if test script exists
  if grep -q '"test"' package.json; then
    echo "  🧪 Testing @entente/$PACKAGE..."
    if pnpm test; then
      echo "  ✅ Tests passed"
    else
      echo -e "${RED}❌ Tests failed for @entente/$PACKAGE${NC}"
      cd ../..
      exit 1
    fi
  else
    echo "  ⚠️  No test script found, skipping tests"
  fi

  cd ../..
done

echo -e "${GREEN}✅ All tests passed successfully!${NC}"

# Process each package in order for versioning and publishing
for PACKAGE in "${PACKAGES[@]}"; do
  PACKAGE_DIR="packages/$PACKAGE"

  if [ ! -d "$PACKAGE_DIR" ]; then
    echo -e "${YELLOW}⚠️  Skipping $PACKAGE (directory not found)${NC}"
    continue
  fi

  echo -e "${GREEN}📦 Processing package: $PACKAGE${NC}"

  cd "$PACKAGE_DIR"

  # Get current version
  CURRENT_VERSION=$(node -p "require('./package.json').version")
  echo "  Current version: $CURRENT_VERSION"

  # Increment patch version
  npm version patch --no-git-tag-version

  # Get new version
  NEW_VERSION=$(node -p "require('./package.json').version")
  echo -e "  ${GREEN}New version: $NEW_VERSION${NC}"

  # Go back to root for git operations
  cd ../..

  # Add and commit changes
  echo "  Committing..."
  git add "$PACKAGE_DIR/package.json"

  # Check if there are dist files to commit
  if [ -d "$PACKAGE_DIR/dist" ]; then
    git add "$PACKAGE_DIR/dist" 2>/dev/null || true
  fi

  git commit -m "Bump @entente/$PACKAGE to $NEW_VERSION" || {
    echo -e "${YELLOW}  No changes to commit for $PACKAGE${NC}"
  }

  # Go back to package dir for publishing
  cd "$PACKAGE_DIR"

  # Publish to npm
  echo "  Publishing..."
  pnpm publish --access public --no-git-checks

  echo -e "${GREEN}  ✅ Published @entente/$PACKAGE@$NEW_VERSION${NC}"

  # Go back to root
  cd ../..

  # Small delay to avoid npm rate limits
  sleep 2
done

echo -e "${GREEN}🎉 All packages have been versioned and published successfully!${NC}"
echo -e "${GREEN}📌 Don't forget to push your commits:${NC}"
echo "   git push origin $CURRENT_BRANCH"
