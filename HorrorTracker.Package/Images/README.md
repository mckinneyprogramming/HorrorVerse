# Package Images

This folder should contain the following image assets for your MSIX package:

## Required Images

1. **SplashScreen.scale-200.png** - 1240x600 pixels
   - Shown when app launches

2. **LockScreenLogo.scale-200.png** - 48x48 pixels
   - App icon on lock screen

3. **Square150x150Logo.scale-200.png** - 300x300 pixels
   - Medium tile

4. **Square44x44Logo.scale-200.png** - 88x88 pixels
   - App list icon

5. **Square44x44Logo.targetsize-24_altform-unplated.png** - 24x24 pixels
   - Taskbar/small icon

6. **StoreLogo.png** - 50x50 pixels
   - Microsoft Store icon

7. **Wide310x150Logo.scale-200.png** - 620x300 pixels
   - Wide tile

## Quick Start

For testing purposes, you can create simple placeholder images using PowerShell:

```powershell
# Create a simple test image (requires .NET)
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap 300,300
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$graphics.Clear([System.Drawing.Color]::DarkRed)
$bmp.Save("Square150x150Logo.scale-200.png")
$graphics.Dispose()
$bmp.Dispose()
```

Or use the Visual Studio Asset Generator:
- Right-click on Package.appxmanifest
- Select "Open With" → "Visual Manifest Designer"
- Go to "Visual Assets" tab
- Generate all assets from a single source image

## Recommended

Use Visual Studio's built-in asset generator with a 400x400 source image for best results.
