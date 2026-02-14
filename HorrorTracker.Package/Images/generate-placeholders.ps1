# Script to generate spooky horror-themed images for MSIX packaging
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
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

    # Create dark, ominous gradient background (black to dark red)
    $rect = New-Object System.Drawing.Rectangle 0, 0, $Width, $Height
    $startColor = [System.Drawing.Color]::FromArgb(10, 0, 0)      # Nearly black
    $endColor = [System.Drawing.Color]::FromArgb(60, 0, 0)        # Dark blood red
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $startColor, $endColor, 45)
    $graphics.FillRectangle($brush, $rect)
    $brush.Dispose()

    # Add subtle vignette effect (darker edges)
    $vignettePath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $vignettePath.AddEllipse(-$Width * 0.3, -$Height * 0.3, $Width * 1.6, $Height * 1.6)
    $vignetteBlend = New-Object System.Drawing.Drawing2D.PathGradientBrush($vignettePath)
    $vignetteBlend.CenterColor = [System.Drawing.Color]::FromArgb(0, 0, 0, 0)  # Transparent center
    $vignetteBlend.SurroundColors = @([System.Drawing.Color]::FromArgb(120, 0, 0, 0))  # Dark edges
    $graphics.FillRectangle($vignetteBlend, $rect)
    $vignetteBlend.Dispose()
    $vignettePath.Dispose()

    # Determine text and font size based on image dimensions
    $text = if ($Width -lt 100) { "HV" } else { "HorrorVerse" }
    $fontSize = [Math]::Max(10, [Math]::Min($Width, $Height) / 8)
    $font = New-Object System.Drawing.Font("Impact", $fontSize, [System.Drawing.FontStyle]::Bold)

    # Add "blood drip" effect with shadow
    $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(80, 0, 0, 0))
    $textSize = $graphics.MeasureString($text, $font)
    $x = ($Width - $textSize.Width) / 2
    $y = ($Height - $textSize.Height) / 2

    # Draw shadow (offset slightly)
    $graphics.DrawString($text, $font, $shadowBrush, $x + 3, $y + 3)

    # Draw main text with blood-red color
    $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(200, 20, 20))
    $graphics.DrawString($text, $font, $textBrush, $x, $y)

    # Add slight highlight/glow effect
    $glowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40, 255, 50, 50))
    $graphics.DrawString($text, $font, $glowBrush, $x - 1, $y - 1)

    # Save the image
    $bmp.Save($FileName, [System.Drawing.Imaging.ImageFormat]::Png)

    # Cleanup
    $graphics.Dispose()
    $glowBrush.Dispose()
    $textBrush.Dispose()
    $shadowBrush.Dispose()
    $font.Dispose()
    $bmp.Dispose()

    Write-Host "Created: $FileName ($Width x $Height)" -ForegroundColor DarkRed
}

# Generate all required images
Create-PlaceholderImage "SplashScreen.scale-200.png" 1240 600
Create-PlaceholderImage "LockScreenLogo.scale-200.png" 48 48
Create-PlaceholderImage "Square150x150Logo.scale-200.png" 300 300
Create-PlaceholderImage "Square44x44Logo.scale-200.png" 88 88
Create-PlaceholderImage "Square44x44Logo.targetsize-24_altform-unplated.png" 24 24
Create-PlaceholderImage "StoreLogo.png" 50 50
Create-PlaceholderImage "Wide310x150Logo.scale-200.png" 620 300

Write-Host "`nAll HorrorVerse images created successfully!" -ForegroundColor Red
Write-Host "🎃 Spooky branding ready for your horror app! 🎃" -ForegroundColor DarkYellow
