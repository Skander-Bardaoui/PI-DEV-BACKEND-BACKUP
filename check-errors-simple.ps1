# Backend Error Checker Script (PowerShell - Simple Version)
# This script checks for TypeScript/ESLint errors across the entire backend project

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "BACKEND ERROR CHECKER" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "Error: package.json not found. Please run this script from the PI-DEV-BACKEND directory." -ForegroundColor Red
    exit 1
}

$packageJson = Get-Content "package.json" | ConvertFrom-Json
Write-Host "Project: $($packageJson.name)" -ForegroundColor Blue
Write-Host ""

# Create a log file with timestamp
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$logFile = "error-report-$timestamp.txt"

Write-Host "Detailed logs will be saved to: $logFile"
Write-Host ""

# Initialize counters
$totalErrors = 0
$totalWarnings = 0
$consoleLogs = 0
$todoCount = 0
$anyCount = 0

# 1. TypeScript Type Checking
Write-Host "===========================================" -ForegroundColor Yellow
Write-Host "1. TYPESCRIPT TYPE CHECKING" -ForegroundColor Yellow
Write-Host "===========================================" -ForegroundColor Yellow
Write-Host ""

"=== TYPESCRIPT TYPE CHECKING ===" | Out-File $logFile
Write-Host "Running TypeScript compiler..." -ForegroundColor Gray

$tscOutput = npx tsc --noEmit 2>&1 | Out-String
$tscOutput | Out-File -Append $logFile

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] No TypeScript errors found!" -ForegroundColor Green
} else {
    $tsErrors = ([regex]::Matches($tscOutput, "error TS")).Count
    $totalErrors += $tsErrors
    Write-Host "[ERROR] Found $tsErrors TypeScript errors" -ForegroundColor Red
    Write-Host ""
    Write-Host "First 20 errors:" -ForegroundColor Gray
    $tscOutput -split "`n" | Where-Object { $_ -match "error TS" } | Select-Object -First 20 | ForEach-Object {
        Write-Host "  $_" -ForegroundColor Red
    }
}

Write-Host ""

# 2. ESLint Checking
Write-Host "===========================================" -ForegroundColor Yellow
Write-Host "2. ESLINT CHECKING" -ForegroundColor Yellow
Write-Host "===========================================" -ForegroundColor Yellow
Write-Host ""

"=== ESLINT CHECKING ===" | Out-File -Append $logFile
Write-Host "Running ESLint..." -ForegroundColor Gray

$eslintOutput = npx eslint . --ext .ts,.js 2>&1 | Out-String
$eslintOutput | Out-File -Append $logFile

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] No ESLint errors found!" -ForegroundColor Green
} else {
    $eslintErrors = ([regex]::Matches($eslintOutput, "error")).Count
    $eslintWarnings = ([regex]::Matches($eslintOutput, "warning")).Count
    
    $totalErrors += $eslintErrors
    $totalWarnings += $eslintWarnings
    
    Write-Host "[ERROR] Found $eslintErrors ESLint errors" -ForegroundColor Red
    Write-Host "[WARNING] Found $eslintWarnings ESLint warnings" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "First 30 lines:" -ForegroundColor Gray
    $eslintOutput -split "`n" | Select-Object -First 30 | ForEach-Object {
        if ($_ -match "error") {
            Write-Host "  $_" -ForegroundColor Red
        } elseif ($_ -match "warning") {
            Write-Host "  $_" -ForegroundColor Yellow
        } else {
            Write-Host "  $_" -ForegroundColor Gray
        }
    }
}

Write-Host ""

# 3. Check for console.log statements
Write-Host "===========================================" -ForegroundColor Yellow
Write-Host "3. CONSOLE.LOG STATEMENTS CHECK" -ForegroundColor Yellow
Write-Host "===========================================" -ForegroundColor Yellow
Write-Host ""

"=== CONSOLE.LOG STATEMENTS ===" | Out-File -Append $logFile

if (Test-Path "src") {
    $consoleLogs = (Get-ChildItem -Path "src" -Recurse -Include *.ts,*.js -ErrorAction SilentlyContinue | 
        Select-String "console\.log" -ErrorAction SilentlyContinue | 
        Measure-Object).Count

    if ($consoleLogs -gt 0) {
        Write-Host "[WARNING] Found $consoleLogs console.log statements" -ForegroundColor Yellow
        "Found $consoleLogs console.log statements" | Out-File -Append $logFile
        
        Write-Host "Files with console.log (first 10):" -ForegroundColor Gray
        Get-ChildItem -Path "src" -Recurse -Include *.ts,*.js -ErrorAction SilentlyContinue | 
            Select-String "console\.log" -ErrorAction SilentlyContinue | 
            Select-Object -ExpandProperty Path -Unique |
            Select-Object -First 10 | ForEach-Object {
                Write-Host "  $_" -ForegroundColor Gray
                "  $_" | Out-File -Append $logFile
            }
    } else {
        Write-Host "[OK] No console.log statements found" -ForegroundColor Green
    }
} else {
    Write-Host "[SKIP] src directory not found" -ForegroundColor Gray
}

Write-Host ""

# 4. Check for TODO/FIXME comments
Write-Host "===========================================" -ForegroundColor Yellow
Write-Host "4. TODO/FIXME COMMENTS CHECK" -ForegroundColor Yellow
Write-Host "===========================================" -ForegroundColor Yellow
Write-Host ""

"=== TODO/FIXME COMMENTS ===" | Out-File -Append $logFile

if (Test-Path "src") {
    $todoCount = (Get-ChildItem -Path "src" -Recurse -Include *.ts,*.js -ErrorAction SilentlyContinue | 
        Select-String "TODO|FIXME" -ErrorAction SilentlyContinue | 
        Measure-Object).Count

    if ($todoCount -gt 0) {
        Write-Host "[INFO] Found $todoCount TODO/FIXME comments" -ForegroundColor Yellow
        "Found $todoCount TODO/FIXME comments" | Out-File -Append $logFile
        
        Write-Host "First 10 occurrences:" -ForegroundColor Gray
        Get-ChildItem -Path "src" -Recurse -Include *.ts,*.js -ErrorAction SilentlyContinue | 
            Select-String "TODO|FIXME" -ErrorAction SilentlyContinue | 
            Select-Object -First 10 | ForEach-Object {
                Write-Host "  $($_.Path):$($_.LineNumber) - $($_.Line.Trim())" -ForegroundColor Gray
                "  $($_.Path):$($_.LineNumber) - $($_.Line.Trim())" | Out-File -Append $logFile
            }
    } else {
        Write-Host "[OK] No TODO/FIXME comments found" -ForegroundColor Green
    }
}

Write-Host ""

# 5. Check for 'any' types
Write-Host "===========================================" -ForegroundColor Yellow
Write-Host "5. ANY TYPE USAGE CHECK" -ForegroundColor Yellow
Write-Host "===========================================" -ForegroundColor Yellow
Write-Host ""

"=== ANY TYPE USAGE ===" | Out-File -Append $logFile

if (Test-Path "src") {
    $anyCount = (Get-ChildItem -Path "src" -Recurse -Include *.ts -ErrorAction SilentlyContinue | 
        Select-String ": any" -ErrorAction SilentlyContinue | 
        Where-Object { $_.Line -notmatch "// @ts-" } |
        Measure-Object).Count

    if ($anyCount -gt 0) {
        Write-Host "[WARNING] Found $anyCount 'any' type usages" -ForegroundColor Yellow
        "Found $anyCount 'any' type usages" | Out-File -Append $logFile
        
        Write-Host "Files with 'any' types (first 10):" -ForegroundColor Gray
        Get-ChildItem -Path "src" -Recurse -Include *.ts -ErrorAction SilentlyContinue | 
            Select-String ": any" -ErrorAction SilentlyContinue | 
            Where-Object { $_.Line -notmatch "// @ts-" } |
            Select-Object -ExpandProperty Path -Unique |
            Select-Object -First 10 | ForEach-Object {
                Write-Host "  $_" -ForegroundColor Gray
                "  $_" | Out-File -Append $logFile
            }
    } else {
        Write-Host "[OK] No 'any' types found" -ForegroundColor Green
    }
}

Write-Host ""

# Final Summary
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "FINAL SUMMARY" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Total Errors:     $totalErrors" -ForegroundColor $(if ($totalErrors -eq 0) { "Green" } else { "Red" })
Write-Host "Total Warnings:   $totalWarnings" -ForegroundColor $(if ($totalWarnings -eq 0) { "Green" } else { "Yellow" })
Write-Host "Console.logs:     $consoleLogs" -ForegroundColor $(if ($consoleLogs -eq 0) { "Green" } else { "Yellow" })
Write-Host "TODO/FIXME:       $todoCount" -ForegroundColor $(if ($todoCount -eq 0) { "Green" } else { "Yellow" })
Write-Host "'any' types:      $anyCount" -ForegroundColor $(if ($anyCount -eq 0) { "Green" } else { "Yellow" })
Write-Host ""

"=== SUMMARY ===" | Out-File -Append $logFile
"Total Errors:     $totalErrors" | Out-File -Append $logFile
"Total Warnings:   $totalWarnings" | Out-File -Append $logFile
"Console.logs:     $consoleLogs" | Out-File -Append $logFile
"TODO/FIXME:       $todoCount" | Out-File -Append $logFile
"'any' types:      $anyCount" | Out-File -Append $logFile

if ($totalErrors -eq 0) {
    Write-Host "SUCCESS! No critical errors found!" -ForegroundColor Green
    Write-Host ""
    exit 0
} else {
    Write-Host "FAILED! Found $totalErrors errors that need attention." -ForegroundColor Red
    Write-Host "Check $logFile for detailed information." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
