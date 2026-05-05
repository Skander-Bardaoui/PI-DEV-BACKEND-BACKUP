#!/bin/bash

# Backend Error Checker Script
# This script checks for TypeScript/ESLint errors across the entire backend project
# It will NOT fix any errors - only report them

echo "=========================================="
echo "🔍 BACKEND ERROR CHECKER"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found. Please run this script from the PI-DEV-BACKEND directory.${NC}"
    exit 1
fi

echo -e "${BLUE}📦 Project: $(grep -m 1 '"name"' package.json | cut -d'"' -f4)${NC}"
echo ""

# Create a log file with timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="error-report-${TIMESTAMP}.log"

echo "📝 Detailed logs will be saved to: ${LOG_FILE}"
echo ""

# Function to print section header
print_section() {
    echo "" | tee -a "$LOG_FILE"
    echo "===========================================" | tee -a "$LOG_FILE"
    echo "$1" | tee -a "$LOG_FILE"
    echo "===========================================" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
}

# Initialize counters
TOTAL_ERRORS=0
TOTAL_WARNINGS=0

# 1. TypeScript Type Checking
print_section "1️⃣  TYPESCRIPT TYPE CHECKING"
echo -e "${YELLOW}Running TypeScript compiler in check mode...${NC}" | tee -a "$LOG_FILE"
echo ""

if npx tsc --noEmit --pretty false 2>&1 | tee -a "$LOG_FILE"; then
    echo -e "${GREEN}✅ No TypeScript errors found!${NC}" | tee -a "$LOG_FILE"
else
    TS_ERRORS=$(npx tsc --noEmit --pretty false 2>&1 | grep -c "error TS")
    TOTAL_ERRORS=$((TOTAL_ERRORS + TS_ERRORS))
    echo -e "${RED}❌ Found ${TS_ERRORS} TypeScript errors${NC}" | tee -a "$LOG_FILE"
fi

# 2. ESLint Checking
print_section "2️⃣  ESLINT CHECKING"
echo -e "${YELLOW}Running ESLint...${NC}" | tee -a "$LOG_FILE"
echo ""

if npx eslint . --ext .ts,.js --max-warnings 0 2>&1 | tee -a "$LOG_FILE"; then
    echo -e "${GREEN}✅ No ESLint errors found!${NC}" | tee -a "$LOG_FILE"
else
    ESLINT_OUTPUT=$(npx eslint . --ext .ts,.js --format json 2>/dev/null || echo "[]")
    ESLINT_ERRORS=$(echo "$ESLINT_OUTPUT" | grep -o '"errorCount":[0-9]*' | cut -d':' -f2 | awk '{s+=$1} END {print s}')
    ESLINT_WARNINGS=$(echo "$ESLINT_OUTPUT" | grep -o '"warningCount":[0-9]*' | cut -d':' -f2 | awk '{s+=$1} END {print s}')
    
    TOTAL_ERRORS=$((TOTAL_ERRORS + ESLINT_ERRORS))
    TOTAL_WARNINGS=$((TOTAL_WARNINGS + ESLINT_WARNINGS))
    
    echo -e "${RED}❌ Found ${ESLINT_ERRORS} ESLint errors${NC}" | tee -a "$LOG_FILE"
    echo -e "${YELLOW}⚠️  Found ${ESLINT_WARNINGS} ESLint warnings${NC}" | tee -a "$LOG_FILE"
fi

# 3. NestJS Build Check
print_section "3️⃣  NESTJS BUILD CHECK"
echo -e "${YELLOW}Checking if NestJS project builds...${NC}" | tee -a "$LOG_FILE"
echo ""

if npm run build 2>&1 | tee -a "$LOG_FILE"; then
    echo -e "${GREEN}✅ Build successful!${NC}" | tee -a "$LOG_FILE"
else
    BUILD_ERRORS=$(npm run build 2>&1 | grep -c "error")
    TOTAL_ERRORS=$((TOTAL_ERRORS + BUILD_ERRORS))
    echo -e "${RED}❌ Build failed with ${BUILD_ERRORS} errors${NC}" | tee -a "$LOG_FILE"
fi

# 4. Check for unused dependencies
print_section "4️⃣  UNUSED DEPENDENCIES CHECK"
echo -e "${YELLOW}Checking for unused dependencies...${NC}" | tee -a "$LOG_FILE"
echo ""

if command -v npx &> /dev/null && npx depcheck --version &> /dev/null 2>&1; then
    npx depcheck 2>&1 | tee -a "$LOG_FILE"
else
    echo -e "${YELLOW}⚠️  depcheck not available. Skipping...${NC}" | tee -a "$LOG_FILE"
fi

# 5. Check for duplicate dependencies
print_section "5️⃣  DUPLICATE DEPENDENCIES CHECK"
echo -e "${YELLOW}Checking for duplicate dependencies...${NC}" | tee -a "$LOG_FILE"
echo ""

if [ -f "package-lock.json" ]; then
    DUPLICATES=$(npm ls --all 2>/dev/null | grep "deduped" | wc -l)
    if [ "$DUPLICATES" -gt 0 ]; then
        echo -e "${YELLOW}⚠️  Found ${DUPLICATES} duplicate dependencies${NC}" | tee -a "$LOG_FILE"
        npm ls --all 2>&1 | grep "deduped" | tee -a "$LOG_FILE"
    else
        echo -e "${GREEN}✅ No duplicate dependencies found${NC}" | tee -a "$LOG_FILE"
    fi
else
    echo -e "${YELLOW}⚠️  package-lock.json not found. Skipping...${NC}" | tee -a "$LOG_FILE"
fi

# 6. Check for console.log statements (code quality)
print_section "6️⃣  CONSOLE.LOG STATEMENTS CHECK"
echo -e "${YELLOW}Checking for console.log statements...${NC}" | tee -a "$LOG_FILE"
echo ""

CONSOLE_LOGS=$(grep -r "console\.log" src/ --include="*.ts" --include="*.js" 2>/dev/null | wc -l)
if [ "$CONSOLE_LOGS" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Found ${CONSOLE_LOGS} console.log statements${NC}" | tee -a "$LOG_FILE"
    echo "Files with console.log:" | tee -a "$LOG_FILE"
    grep -r "console\.log" src/ --include="*.ts" --include="*.js" -l 2>/dev/null | tee -a "$LOG_FILE"
else
    echo -e "${GREEN}✅ No console.log statements found${NC}" | tee -a "$LOG_FILE"
fi

# 7. Check for TODO/FIXME comments
print_section "7️⃣  TODO/FIXME COMMENTS CHECK"
echo -e "${YELLOW}Checking for TODO/FIXME comments...${NC}" | tee -a "$LOG_FILE"
echo ""

TODO_COUNT=$(grep -r "TODO\|FIXME" src/ --include="*.ts" --include="*.js" 2>/dev/null | wc -l)
if [ "$TODO_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Found ${TODO_COUNT} TODO/FIXME comments${NC}" | tee -a "$LOG_FILE"
    echo "Files with TODO/FIXME:" | tee -a "$LOG_FILE"
    grep -r "TODO\|FIXME" src/ --include="*.ts" --include="*.js" -n 2>/dev/null | head -20 | tee -a "$LOG_FILE"
    if [ "$TODO_COUNT" -gt 20 ]; then
        echo "... and $((TODO_COUNT - 20)) more" | tee -a "$LOG_FILE"
    fi
else
    echo -e "${GREEN}✅ No TODO/FIXME comments found${NC}" | tee -a "$LOG_FILE"
fi

# 8. Check for any/unknown types (TypeScript)
print_section "8️⃣  ANY/UNKNOWN TYPES CHECK"
echo -e "${YELLOW}Checking for 'any' type usage...${NC}" | tee -a "$LOG_FILE"
echo ""

ANY_COUNT=$(grep -r ": any" src/ --include="*.ts" 2>/dev/null | grep -v "// @ts-" | wc -l)
if [ "$ANY_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Found ${ANY_COUNT} 'any' type usages${NC}" | tee -a "$LOG_FILE"
    echo "Files with 'any' types (first 10):" | tee -a "$LOG_FILE"
    grep -r ": any" src/ --include="*.ts" -l 2>/dev/null | head -10 | tee -a "$LOG_FILE"
else
    echo -e "${GREEN}✅ No 'any' types found${NC}" | tee -a "$LOG_FILE"
fi

# 9. Check for deprecated NestJS patterns
print_section "9️⃣  DEPRECATED PATTERNS CHECK"
echo -e "${YELLOW}Checking for deprecated NestJS patterns...${NC}" | tee -a "$LOG_FILE"
echo ""

DEPRECATED_COUNT=0

# Check for @nestjs/swagger deprecated decorators
DEPRECATED_SWAGGER=$(grep -r "@ApiModelProperty\|@ApiModelPropertyOptional" src/ --include="*.ts" 2>/dev/null | wc -l)
if [ "$DEPRECATED_SWAGGER" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Found ${DEPRECATED_SWAGGER} deprecated Swagger decorators${NC}" | tee -a "$LOG_FILE"
    DEPRECATED_COUNT=$((DEPRECATED_COUNT + DEPRECATED_SWAGGER))
fi

# Check for deprecated @nestjs/common imports
DEPRECATED_COMMON=$(grep -r "ReflectMetadata" src/ --include="*.ts" 2>/dev/null | wc -l)
if [ "$DEPRECATED_COMMON" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Found ${DEPRECATED_COMMON} deprecated @nestjs/common patterns${NC}" | tee -a "$LOG_FILE"
    DEPRECATED_COUNT=$((DEPRECATED_COUNT + DEPRECATED_COMMON))
fi

if [ "$DEPRECATED_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✅ No deprecated patterns found${NC}" | tee -a "$LOG_FILE"
fi

# 10. Check for missing error handling
print_section "🔟 ERROR HANDLING CHECK"
echo -e "${YELLOW}Checking for potential missing error handling...${NC}" | tee -a "$LOG_FILE"
echo ""

# Count async functions without try-catch
ASYNC_FUNCTIONS=$(grep -r "async " src/ --include="*.ts" --include="*.js" 2>/dev/null | wc -l)
TRY_CATCH=$(grep -r "try {" src/ --include="*.ts" --include="*.js" 2>/dev/null | wc -l)

echo "Async functions: ${ASYNC_FUNCTIONS}" | tee -a "$LOG_FILE"
echo "Try-catch blocks: ${TRY_CATCH}" | tee -a "$LOG_FILE"

if [ "$ASYNC_FUNCTIONS" -gt "$((TRY_CATCH * 2))" ]; then
    echo -e "${YELLOW}⚠️  Many async functions may be missing error handling${NC}" | tee -a "$LOG_FILE"
else
    echo -e "${GREEN}✅ Error handling looks reasonable${NC}" | tee -a "$LOG_FILE"
fi

# Final Summary
print_section "📊 FINAL SUMMARY"

echo "╔════════════════════════════════════════╗" | tee -a "$LOG_FILE"
echo "║         ERROR SUMMARY                  ║" | tee -a "$LOG_FILE"
echo "╠════════════════════════════════════════╣" | tee -a "$LOG_FILE"
printf "║ Total Errors:   %-22s ║\n" "$TOTAL_ERRORS" | tee -a "$LOG_FILE"
printf "║ Total Warnings: %-22s ║\n" "$TOTAL_WARNINGS" | tee -a "$LOG_FILE"
printf "║ Console.logs:   %-22s ║\n" "$CONSOLE_LOGS" | tee -a "$LOG_FILE"
printf "║ TODO/FIXME:     %-22s ║\n" "$TODO_COUNT" | tee -a "$LOG_FILE"
printf "║ 'any' types:    %-22s ║\n" "$ANY_COUNT" | tee -a "$LOG_FILE"
printf "║ Deprecated:     %-22s ║\n" "$DEPRECATED_COUNT" | tee -a "$LOG_FILE"
echo "╚════════════════════════════════════════╝" | tee -a "$LOG_FILE"
echo ""

if [ "$TOTAL_ERRORS" -eq 0 ]; then
    echo -e "${GREEN}🎉 SUCCESS! No critical errors found!${NC}" | tee -a "$LOG_FILE"
    exit 0
else
    echo -e "${RED}❌ FAILED! Found ${TOTAL_ERRORS} errors that need attention.${NC}" | tee -a "$LOG_FILE"
    echo -e "${YELLOW}📝 Check ${LOG_FILE} for detailed information.${NC}"
    exit 1
fi
