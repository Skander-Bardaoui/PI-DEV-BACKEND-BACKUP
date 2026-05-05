#!/bin/bash

# Salary Permissions Deployment Script
# This script deploys the salary permissions feature

echo "🚀 Starting Salary Permissions Deployment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found. Please run this script from the backend root directory.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Found package.json${NC}"
echo ""

# Step 2: Install dependencies (if needed)
echo "📦 Checking dependencies..."
npm install
echo ""

# Step 3: Build the project
echo "🔨 Building project..."
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed. Please fix errors and try again.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Build successful${NC}"
echo ""

# Step 4: Run migration
echo "🗄️  Running database migration..."
echo -e "${YELLOW}⚠️  This will add salary_permissions column to business_members table${NC}"
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    npm run migration:run
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Migration failed. Check the error above.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Migration successful${NC}"
else
    echo -e "${YELLOW}⚠️  Migration skipped${NC}"
    exit 0
fi
echo ""

# Step 5: Verify migration
echo "🔍 Verifying migration..."
echo "Checking if salary_permissions column exists..."

# This requires psql to be installed and configured
# Uncomment and modify if you want automatic verification
# psql -U your_user -d your_database -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'business_members' AND column_name = 'salary_permissions';"

echo -e "${YELLOW}⚠️  Please manually verify the migration:${NC}"
echo "   Run this SQL query:"
echo "   SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'business_members' AND column_name = 'salary_permissions';"
echo ""

# Step 6: Restart application
echo "🔄 Restarting application..."
echo -e "${YELLOW}⚠️  Make sure to restart your application to load the new code${NC}"
echo ""

# Step 7: Test endpoints
echo "🧪 Testing endpoints..."
echo -e "${YELLOW}⚠️  Please test these endpoints:${NC}"
echo "   1. GET /businesses/:id/members (should return salary_permissions)"
echo "   2. POST /salary/:businessId/propose (should check send_proposal permission)"
echo "   3. POST /salary/:businessId/pay/:proposalId (should check pay_salary permission)"
echo ""

# Step 8: Summary
echo "📋 Deployment Summary:"
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo -e "${GREEN}✅ Project built${NC}"
echo -e "${GREEN}✅ Migration executed${NC}"
echo ""
echo "📚 Next Steps:"
echo "   1. Verify migration in database"
echo "   2. Restart your application"
echo "   3. Test API endpoints"
echo "   4. Test frontend integration"
echo "   5. Deploy frontend changes"
echo ""
echo -e "${GREEN}🎉 Deployment script completed!${NC}"
echo ""
echo "📖 For more information, see:"
echo "   - SALARY_PERMISSIONS_COMPLETE.md"
echo "   - TESTING_GUIDE.md"
echo "   - BACKEND_TODO_SALARY_PERMISSIONS.md"
