# Script to generate MSIX package images from source HorrorVerse logo
# Run this script from the HorrorTracker.Package/Images directory
# 
# IMPORTANT: Save your HorrorVerse logo image as "source-logo.png" in this directory first!

Add-Type -AssemblyName System.Drawing

function Create-ResizedImage {
    param(
        [string]$SourcePath,
        [string]$OutputFileName,
        [int]$Width,
        [int]$Height
    )

    if (-not (Test-Path $SourcePath)) {
        Write-Host "ERROR: Source image not found at: $SourcePath" -ForegroundColor Red
        Write-Host "Please save your HorrorVerse logo as 'source-logo.png' in this directory." -ForegroundColor Yellow
        return
    }

    # Load source image
    $sourceImage = [System.Drawing.Image]::FromFile($SourcePath)

    # Create new bitmap with target size
    $destImage = New-Object System.Drawing.Bitmap $Width, $Height
    $graphics = [System.Drawing.Graphics]::FromImage($destImage)

    # High quality settings
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    # Calculate aspect ratio and scaling
    $sourceRatio = $sourceImage.Width / $sourceImage.Height
    $targetRatio = $Width / $Height

    if ($sourceRatio -gt $targetRatio) {
        # Source is wider - fit to width
        $newWidth = $Width
        $newHeight = [int]($Width / $sourceRatio)
        $x = 0
        $y = ($Height - $newHeight) / 2
    }
    else {
        # Source is taller - fit to height
        $newHeight = $Height
        $newWidth = [int]($Height * $sourceRatio)
        $x = ($Width - $newWidth) / 2
        $y = 0
    }

    # Fill background with black (in case image doesn't fill entire space)
    $graphics.Clear([System.Drawing.Color]::Black)

    # Draw resized image
    $destRect = New-Object System.Drawing.Rectangle $x, $y, $newWidth, $newHeight
    $srcRect = New-Object System.Drawing.Rectangle 0, 0, $sourceImage.Width, $sourceImage.Height
    $graphics.DrawImage($sourceImage, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

    # Save
    $destImage.Save($OutputFileName, [System.Drawing.Imaging.ImageFormat]::Png)

    # Cleanup
    $graphics.Dispose()
    $destImage.Dispose()
    $sourceImage.Dispose()

    Write-Host "Created: $OutputFileName ($Width x $Height)" -ForegroundColor Green
}

# Check if source image exists
$sourceImagePath = Join-Path $PSScriptRoot "source-logo.png"

if (-not (Test-Path $sourceImagePath)) {
    Write-Host "`n========================================" -ForegroundColor Yellow
    Write-Host "  SOURCE IMAGE NOT FOUND!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "`nPlease follow these steps:" -ForegroundColor White
    Write-Host "1. Save your HorrorVerse logo image in this directory" -ForegroundColor Cyan
    Write-Host "2. Name it: source-logo.png" -ForegroundColor Cyan
    Write-Host "3. Run this script again" -ForegroundColor Cyan
    Write-Host "`nCurrent directory: $PSScriptRoot`n" -ForegroundColor Gray
    exit 1
}

Write-Host "`n🎃 Generating HorrorVerse MSIX package images... 🎃`n" -ForegroundColor DarkYellow

# Generate all required images from source
Create-ResizedImage -SourcePath $sourceImagePath -OutputFileName "SplashScreen.scale-200.png" -Width 1240 -Height 600
Create-ResizedImage -SourcePath $sourceImagePath -OutputFileName "LockScreenLogo.scale-200.png" -Width 48 -Height 48
Create-ResizedImage -SourcePath $sourceImagePath -OutputFileName "Square150x150Logo.scale-200.png" -Width 300 -Height 300
Create-ResizedImage -SourcePath $sourceImagePath -OutputFileName "Square44x44Logo.scale-200.png" -Width 88 -Height 88
Create-ResizedImage -SourcePath $sourceImagePath -OutputFileName "Square44x44Logo.targetsize-24_altform-unplated.png" -Width 24 -Height 24
Create-ResizedImage -SourcePath $sourceImagePath -OutputFileName "StoreLogo.png" -Width 50 -Height 50
Create-ResizedImage -SourcePath $sourceImagePath -OutputFileName "Wide310x150Logo.scale-200.png" -Width 620 -Height 300

Write-Host "`n✅ All HorrorVerse package images created successfully!" -ForegroundColor Green
Write-Host "🩸 Your professional horror branding is ready! 🩸`n" -ForegroundColor Red
