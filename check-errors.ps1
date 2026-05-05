# Backend Error Checker Script (PowerShell)
# This script checks for TypeScript/ESLint errors across the entire backend project
# It will NOT fix any errors - only report them

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "🔍 BACKEND ERROR CHECKER" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: package.json not found. Please run this script from the PI-DEV-BACKEND directory." -ForegroundColor Red
    exit 1
}

$packageJson = Get-Content "package.json" | ConvertFrom-Json
Write-Host "📦 Project: $($packageJson.name)" -ForegroundColor Blue
Write-Host ""

# Create a log file with timestamp
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$logFile = "error-report-$timestamp.log"

Write-Host "📝 Detailed logs will be saved to: $logFile"
Write-Host ""

# Function to print section header
function Print-Section {
    param($title)
    "" | Out-File -Append $logFile
    "===========================================" | Out-File -Append $logFile
    $title | Out-File -Append $logFile
    "===========================================" | Out-File -Append $logFile
    "" | Out-File -Append $logFile
    Write-Host ""
    Write-Host "===========================================" -ForegroundColor Yellow
    Write-Host $title -ForegroundColor Yellow
    Write-Host "===========================================" -ForegroundColor Yellow
    Write-Host ""
}

# Initialize counters
$totalErrors = 0
$totalWarnings = 0

# 1. TypeScript Type Checking
Print-Section "1️⃣  TYPESCRIPT TYPE CHECKING"
Write-Host "Running TypeScript compiler in check mode..." -ForegroundColor Yellow
Write-Host ""

$tscOutput = npx tsc --noEmit --pretty false 2>&1
$tscOutput | Out-File -Append $logFile

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ No TypeScript errors found!" -ForegroundColor Green
    "✅ No TypeScript errors found!" | Out-File -Append $logFile
} else {
    $tsErrors = ($tscOutput | Select-String "error TS").Count
    $totalErrors += $tsErrors
    Write-Host "❌ Found $tsErrors TypeScript errors" -ForegroundColor Red
    "❌ Found $tsErrors TypeScript errors" | Out-File -Append $logFile
    $tscOutput | Write-Host
}

# 2. ESLint Checking
Print-Section "2️⃣  ESLINT CHECKING"
Write-Host "Running ESLint..." -ForegroundColor Yellow
Write-Host ""

$eslintOutput = npx eslint . --ext .ts,.js 2>&1
$eslintOutput | Out-File -Append $logFile

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ No ESLint errors found!" -ForegroundColor Green
    "✅ No ESLint errors found!" | Out-File -Append $logFile
} else {
    $eslintErrors = ($eslintOutput | Select-String "error").Count
    $eslintWarnings = ($eslintOutput | Select-String "warning").Count
    
    $totalErrors += $eslintErrors
    $totalWarnings += $eslintWarnings
    
    Write-Host "❌ Found $eslintErrors ESLint errors" -ForegroundColor Red
    Write-Host "⚠️  Found $eslintWarnings ESLint warnings" -ForegroundColor Yellow
    "❌ Found $eslintErrors ESLint errors" | Out-File -Append $logFile
    "⚠️  Found $eslintWarnings ESLint warnings" | Out-File -Append $logFile
    
    $eslintOutput | Select-Object -First 50 | Write-Host
}

# 3. NestJS Build Check
Print-Section "3️⃣  NESTJS BUILD CHECK"
Write-Host "Checking if NestJS project builds..." -ForegroundColor Yellow
Write-Host ""

$buildOutput = npm run build 2>&1
$buildOutput | Out-File -Append $logFile

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Build successful!" -ForegroundColor Green
    "✅ Build successful!" | Out-File -Append $logFile
} else {
    $buildErrors = ($buildOutput | Select-String "error").Count
    $totalErrors += $buildErrors
    Write-Host "❌ Build failed with $buildErrors errors" -ForegroundColor Red
    "❌ Build failed with $buildErrors errors" | Out-File -Append $logFile
    $buildOutput | Select-Object -Last 30 | Write-Host
}

# 4. Check for console.log statements
Print-Section "6️⃣  CONSOLE.LOG STATEMENTS CHECK"
Write-Host "Checking for console.log statements..." -ForegroundColor Yellow
Write-Host ""

$consoleLogs = Get-ChildItem -Path "src" -Recurse -Include *.ts,*.js | 
    Select-String "console\.log" | 
    Measure-Object | 
    Select-Object -ExpandProperty Count

if ($consoleLogs -gt 0) {
    Write-Host "⚠️  Found $consoleLogs console.log statements" -ForegroundColor Yellow
    "⚠️  Found $consoleLogs console.log statements" | Out-File -Append $logFile
    
    Write-Host "Files with console.log:" -ForegroundColor Yellow
    "Files with console.log:" | Out-File -Append $logFile
    
    $consoleFiles = Get-ChildItem -Path "src" -Recurse -Include *.ts,*.js | 
        Select-String "console\.log" | 
        Select-Object -ExpandProperty Path -Unique
    
    $consoleFiles | ForEach-Object { 
        Write-Host "  $_" -ForegroundColor Gray
        "  $_" | Out-File -Append $logFile
    }
} else {
    Write-Host "✅ No console.log statements found" -ForegroundColor Green
    "✅ No console.log statements found" | Out-File -Append $logFile
}

# 5. Check for TODO/FIXME comments
Print-Section "7️⃣  TODO/FIXME COMMENTS CHECK"
Write-Host "Checking for TODO/FIXME comments..." -ForegroundColor Yellow
Write-Host ""

$todoCount = Get-ChildItem -Path "src" -Recurse -Include *.ts,*.js | 
    Select-String "TODO|FIXME" | 
    Measure-Object | 
    Select-Object -ExpandProperty Count

if ($todoCount -gt 0) {
    Write-Host "⚠️  Found $todoCount TODO/FIXME comments" -ForegroundColor Yellow
    "⚠️  Found $todoCount TODO/FIXME comments" | Out-File -Append $logFile
    
    Write-Host "Files with TODO/FIXME (first 20):" -ForegroundColor Yellow
    "Files with TODO/FIXME (first 20):" | Out-File -Append $logFile
    
    $todoItems = Get-ChildItem -Path "src" -Recurse -Include *.ts,*.js | 
        Select-String "TODO|FIXME" | 
        Select-Object -First 20
    
    $todoItems | ForEach-Object { 
        Write-Host "  $($_.Path):$($_.LineNumber) - $($_.Line.Trim())" -ForegroundColor Gray
        "  $($_.Path):$($_.LineNumber) - $($_.Line.Trim())" | Out-File -Append $logFile
    }
    
    if ($todoCount -gt 20) {
        Write-Host "  ... and $($todoCount - 20) more" -ForegroundColor Gray
        "  ... and $($todoCount - 20) more" | Out-File -Append $logFile
    }
} else {
    Write-Host "✅ No TODO/FIXME comments found" -ForegroundColor Green
    "✅ No TODO/FIXME comments found" | Out-File -Append $logFile
}

# 6. Check for 'any' types
Print-Section "8️⃣  ANY/UNKNOWN TYPES CHECK"
Write-Host "Checking for 'any' type usage..." -ForegroundColor Yellow
Write-Host ""

$anyCount = Get-ChildItem -Path "src" -Recurse -Include *.ts | 
    Select-String ": any" | 
    Where-Object { $_.Line -notmatch "// @ts-" } |
    Measure-Object | 
    Select-Object -ExpandProperty Count

if ($anyCount -gt 0) {
    Write-Host "⚠️  Found $anyCount 'any' type usages" -ForegroundColor Yellow
    "⚠️  Found $anyCount 'any' type usages" | Out-File -Append $logFile
    
    Write-Host "Files with 'any' types (first 10):" -ForegroundColor Yellow
    "Files with 'any' types (first 10):" | Out-File -Append $logFile
    
    $anyFiles = Get-ChildItem -Path "src" -Recurse -Include *.ts | 
        Select-String ": any" | 
        Where-Object { $_.Line -notmatch "// @ts-" } |
        Select-Object -ExpandProperty Path -Unique |
        Select-Object -First 10
    
    $anyFiles | ForEach-Object { 
        Write-Host "  $_" -ForegroundColor Gray
        "  $_" | Out-File -Append $logFile
    }
} else {
    Write-Host "✅ No 'any' types found" -ForegroundColor Green
    "✅ No 'any' types found" | Out-File -Append $logFile
}

# 7. Check for deprecated NestJS patterns
Print-Section "9️⃣  DEPRECATED PATTERNS CHECK"
Write-Host "Checking for deprecated NestJS patterns..." -ForegroundColor Yellow
Write-Host ""

$deprecatedCount = 0

# Check for deprecated Swagger decorators
$deprecatedSwagger = Get-ChildItem -Path "src" -Recurse -Include *.ts | 
    Select-String "@ApiModelProperty|@ApiModelPropertyOptional" | 
    Measure-Object | 
    Select-Object -ExpandProperty Count

if ($deprecatedSwagger -gt 0) {
    Write-Host "⚠️  Found $deprecatedSwagger deprecated Swagger decorators" -ForegroundColor Yellow
    "⚠️  Found $deprecatedSwagger deprecated Swagger decorators" | Out-File -Append $logFile
    $deprecatedCount += $deprecatedSwagger
}

# Check for deprecated @nestjs/common imports
$deprecatedCommon = Get-ChildItem -Path "src" -Recurse -Include *.ts | 
    Select-String "ReflectMetadata" | 
    Measure-Object | 
    Select-Object -ExpandProperty Count

if ($deprecatedCommon -gt 0) {
    Write-Host "⚠️  Found $deprecatedCommon deprecated @nestjs/common patterns" -ForegroundColor Yellow
    "⚠️  Found $deprecatedCommon deprecated @nestjs/common patterns" | Out-File -Append $logFile
    $deprecatedCount += $deprecatedCommon
}

if ($deprecatedCount -eq 0) {
    Write-Host "✅ No deprecated patterns found" -ForegroundColor Green
    "✅ No deprecated patterns found" | Out-File -Append $logFile
}

# 8. Check for error handling
Print-Section "🔟 ERROR HANDLING CHECK"
Write-Host "Checking for potential missing error handling..." -ForegroundColor Yellow
Write-Host ""

$asyncFunctions = Get-ChildItem -Path "src" -Recurse -Include *.ts,*.js | 
    Select-String "async " | 
    Measure-Object | 
    Select-Object -ExpandProperty Count

$tryCatch = Get-ChildItem -Path "src" -Recurse -Include *.ts,*.js | 
    Select-String "try \{" | 
    Measure-Object | 
    Select-Object -ExpandProperty Count

Write-Host "Async functions: $asyncFunctions" -ForegroundColor Gray
Write-Host "Try-catch blocks: $tryCatch" -ForegroundColor Gray
"Async functions: $asyncFunctions" | Out-File -Append $logFile
"Try-catch blocks: $tryCatch" | Out-File -Append $logFile

if ($asyncFunctions -gt ($tryCatch * 2)) {
    Write-Host "⚠️  Many async functions may be missing error handling" -ForegroundColor Yellow
    "⚠️  Many async functions may be missing error handling" | Out-File -Append $logFile
} else {
    Write-Host "✅ Error handling looks reasonable" -ForegroundColor Green
    "✅ Error handling looks reasonable" | Out-File -Append $logFile
}

# Final Summary
Print-Section "📊 FINAL SUMMARY"

Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         ERROR SUMMARY                  ║" -ForegroundColor Cyan
Write-Host "╠════════════════════════════════════════╣" -ForegroundColor Cyan
Write-Host "║ Total Errors:   $($totalErrors.ToString().PadRight(22)) ║" -ForegroundColor Cyan
Write-Host "║ Total Warnings: $($totalWarnings.ToString().PadRight(22)) ║" -ForegroundColor Cyan
Write-Host "║ Console.logs:   $($consoleLogs.ToString().PadRight(22)) ║" -ForegroundColor Cyan
Write-Host "║ TODO/FIXME:     $($todoCount.ToString().PadRight(22)) ║" -ForegroundColor Cyan
Write-Host "║ 'any' types:    $($anyCount.ToString().PadRight(22)) ║" -ForegroundColor Cyan
Write-Host "║ Deprecated:     $($deprecatedCount.ToString().PadRight(22)) ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

"╔════════════════════════════════════════╗" | Out-File -Append $logFile
"║         ERROR SUMMARY                  ║" | Out-File -Append $logFile
"╠════════════════════════════════════════╣" | Out-File -Append $logFile
"║ Total Errors:   $($totalErrors.ToString().PadRight(22)) ║" | Out-File -Append $logFile
"║ Total Warnings: $($totalWarnings.ToString().PadRight(22)) ║" | Out-File -Append $logFile
"║ Console.logs:   $($consoleLogs.ToString().PadRight(22)) ║" | Out-File -Append $logFile
"║ TODO/FIXME:     $($todoCount.ToString().PadRight(22)) ║" | Out-File -Append $logFile
"║ 'any' types:    $($anyCount.ToString().PadRight(22)) ║" | Out-File -Append $logFile
"║ Deprecated:     $($deprecatedCount.ToString().PadRight(22)) ║" | Out-File -Append $logFile
"╚════════════════════════════════════════╝" | Out-File -Append $logFile

if ($totalErrors -eq 0) {
    Write-Host "🎉 SUCCESS! No critical errors found!" -ForegroundColor Green
    "SUCCESS! No critical errors found!" | Out-File -Append $logFile
    exit 0
} else {
    Write-Host "FAILED! Found $totalErrors errors that need attention." -ForegroundColor Red
    Write-Host "Check $logFile for detailed information." -ForegroundColor Yellow
    "FAILED! Found $totalErrors errors that need attention." | Out-File -Append $logFile
    exit 1
}
