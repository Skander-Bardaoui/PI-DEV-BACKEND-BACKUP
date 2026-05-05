#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# 🧪 Script de Test Coverage Local - Backend
# ═══════════════════════════════════════════════════════════════════════════
# Ce script permet de tester localement la génération du coverage
# avant de pousser vers Jenkins
# ═══════════════════════════════════════════════════════════════════════════

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║          🧪 TEST COVERAGE LOCAL - BACKEND                  ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ─────────────────────────────────────────────────────────────────────
echo -e "${BLUE}📥 Step 1: Installing dependencies...${NC}"
# ─────────────────────────────────────────────────────────────────────
npm ci --prefer-offline --no-audit
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# ─────────────────────────────────────────────────────────────────────
echo -e "${BLUE}🧪 Step 2: Running tests with coverage...${NC}"
# ─────────────────────────────────────────────────────────────────────
npm run test:cov
echo -e "${GREEN}✅ Tests completed${NC}"
echo ""

# ─────────────────────────────────────────────────────────────────────
echo -e "${BLUE}📊 Step 3: Analyzing coverage files...${NC}"
# ─────────────────────────────────────────────────────────────────────

# Vérifier le répertoire coverage
if [ ! -d "coverage" ]; then
    echo -e "${RED}❌ Coverage directory not found!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Coverage directory exists${NC}"
echo ""

# Lister les fichiers de coverage
echo "📁 Coverage files:"
ls -lh coverage/
echo ""

# Vérifier lcov.info
if [ ! -f "coverage/lcov.info" ]; then
    echo -e "${RED}❌ lcov.info not found!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ lcov.info found${NC}"
echo "📄 File size: $(du -h coverage/lcov.info | cut -f1)"
echo ""

# Afficher les premières lignes de lcov.info
echo "📝 First 15 lines of lcov.info:"
head -n 15 coverage/lcov.info
echo ""

# Vérifier coverage-summary.json
if [ ! -f "coverage/coverage-summary.json" ]; then
    echo -e "${YELLOW}⚠️ coverage-summary.json not found${NC}"
else
    echo -e "${GREEN}✅ coverage-summary.json found${NC}"
    echo ""
    
    # Extraire les métriques de coverage
    echo "📈 Coverage Metrics:"
    echo "─────────────────────────────────────────────────────────────"
    
    LINE_COV=$(node -pe "JSON.parse(require('fs').readFileSync('coverage/coverage-summary.json')).total.lines.pct")
    BRANCH_COV=$(node -pe "JSON.parse(require('fs').readFileSync('coverage/coverage-summary.json')).total.branches.pct")
    FUNC_COV=$(node -pe "JSON.parse(require('fs').readFileSync('coverage/coverage-summary.json')).total.functions.pct")
    STMT_COV=$(node -pe "JSON.parse(require('fs').readFileSync('coverage/coverage-summary.json')).total.statements.pct")
    
    echo "  • Line Coverage:      ${LINE_COV}%"
    echo "  • Branch Coverage:    ${BRANCH_COV}%"
    echo "  • Function Coverage:  ${FUNC_COV}%"
    echo "  • Statement Coverage: ${STMT_COV}%"
    echo "─────────────────────────────────────────────────────────────"
    echo ""
    
    # Vérifier le seuil minimum
    MIN_COVERAGE=70
    if (( $(echo "$LINE_COV < $MIN_COVERAGE" | bc -l) )); then
        echo -e "${YELLOW}⚠️ Line coverage ${LINE_COV}% is below minimum ${MIN_COVERAGE}%${NC}"
        echo -e "${YELLOW}   More tests needed to reach the Quality Gate threshold${NC}"
    else
        echo -e "${GREEN}✅ Coverage meets minimum requirement (${MIN_COVERAGE}%)${NC}"
    fi
fi

echo ""

# ─────────────────────────────────────────────────────────────────────
echo -e "${BLUE}📊 Step 4: Coverage Report${NC}"
# ─────────────────────────────────────────────────────────────────────

if [ -d "coverage/lcov-report" ]; then
    echo -e "${GREEN}✅ HTML coverage report generated${NC}"
    echo "📂 Location: coverage/lcov-report/index.html"
    echo ""
    echo "To view the report in your browser:"
    echo "  • Windows: start coverage/lcov-report/index.html"
    echo "  • macOS:   open coverage/lcov-report/index.html"
    echo "  • Linux:   xdg-open coverage/lcov-report/index.html"
else
    echo -e "${YELLOW}⚠️ HTML coverage report not found${NC}"
fi

echo ""

# ─────────────────────────────────────────────────────────────────────
echo "╔════════════════════════════════════════════════════════════╗"
echo "║              ✅ COVERAGE TEST COMPLETED                    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📝 Summary:"
echo "  • Tests: Passed"
echo "  • Coverage files: Generated"
echo "  • lcov.info: Ready for SonarQube"
echo ""
echo "🚀 Next steps:"
echo "  1. Review the coverage report"
echo "  2. Add more tests if coverage is below 70%"
echo "  3. Commit and push to trigger Jenkins CI pipeline"
echo ""
