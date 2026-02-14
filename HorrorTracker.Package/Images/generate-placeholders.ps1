# Script to generate placeholder images for MSIX packaging
# Run this script from the HorrorTracker.Package/Images directory

Add-Type -AssemblyName System.Drawing

function Create-PlaceholderImage {
    param(
        [string]$FileName,
        [int]$Width,
        [int]$Height
    )
    
    $bmp = New-Object System.Drawing.Bitmap $Width, $Height
    $graphics = [System.Drawing.Graphics]::FromImage($bmp)
    
    # Dark red background
    $graphics.Clear([System.Drawing.Color]::FromArgb(139, 0, 0))
    
    # Add text
    $font = New-Object System.Drawing.Font("Arial", 12, [System.Drawing.FontStyle]::Bold)
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $text = "HT"
    $textSize = $graphics.MeasureString($text, $font)
    $x = ($Width - $textSize.Width) / 2
    $y = ($Height - $textSize.Height) / 2
    $graphics.DrawString($text, $font, $brush, $x, $y)
    
    $bmp.Save($FileName, [System.Drawing.Imaging.ImageFormat]::Png)
    
    $graphics.Dispose()
    $brush.Dispose()
    $font.Dispose()
    $bmp.Dispose()
    
    Write-Host "Created: $FileName ($Width x $Height)"
}

# Generate all required images
Create-PlaceholderImage "SplashScreen.scale-200.png" 1240 600
Create-PlaceholderImage "LockScreenLogo.scale-200.png" 48 48
Create-PlaceholderImage "Square150x150Logo.scale-200.png" 300 300
Create-PlaceholderImage "Square44x44Logo.scale-200.png" 88 88
Create-PlaceholderImage "Square44x44Logo.targetsize-24_altform-unplated.png" 24 24
Create-PlaceholderImage "StoreLogo.png" 50 50
Create-PlaceholderImage "Wide310x150Logo.scale-200.png" 620 300

Write-Host "`nAll placeholder images created successfully!" -ForegroundColor Green
