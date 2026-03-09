Add-Type -AssemblyName System.Drawing

$sourcePath = "c:\Users\USER\Desktop\TechBrain Projects\Pinnacle Dental Website\Pinnacle logo.jpg"
$destPath   = "c:\Users\USER\Desktop\TechBrain Projects\Pinnacle Dental Website\Pinnacle logo transparent.png"

# Load the source JPG
$src = [System.Drawing.Bitmap]::new($sourcePath)

# Create a new bitmap with 32-bit ARGB (supports transparency)
$dst = [System.Drawing.Bitmap]::new($src.Width, $src.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

# Threshold: how close to white a pixel must be to be removed (0-255; higher = more aggressive)
$threshold = 30

for ($y = 0; $y -lt $src.Height; $y++) {
    for ($x = 0; $x -lt $src.Width; $x++) {
        $pixel = $src.GetPixel($x, $y)

        # Check if the pixel is close to white (or the specific background colour #E6E7E8)
        $isWhite = ($pixel.R -gt (255 - $threshold)) -and
                   ($pixel.G -gt (255 - $threshold)) -and
                   ($pixel.B -gt (255 - $threshold))

        if ($isWhite) {
            # Make pixel fully transparent
            $dst.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 255, 255, 255))
        } else {
            $dst.SetPixel($x, $y, $pixel)
        }
    }
}

$src.Dispose()
$dst.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
$dst.Dispose()

Write-Host "Done! Saved transparent logo to: $destPath"
