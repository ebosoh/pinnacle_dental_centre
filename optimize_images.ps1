Add-Type -AssemblyName System.Drawing

$folder = "c:\Users\USER\Desktop\TechBrain Projects\Pinnacle Dental Website"

# JPEG encoder with quality setting
$jpegEncoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$encParams = New-Object System.Drawing.Imaging.EncoderParameters(1)

function Compress-Image {
    param(
        [string]$InputPath,
        [string]$OutputPath,
        [int]$MaxWidth = 1920,
        [int]$Quality = 78
    )
    
    $encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)
    
    $src = [System.Drawing.Bitmap]::new($InputPath)
    
    # Calculate new dimensions maintaining aspect ratio
    if ($src.Width -gt $MaxWidth) {
        $ratio  = $MaxWidth / $src.Width
        $newW   = $MaxWidth
        $newH   = [int]($src.Height * $ratio)
    } else {
        $newW = $src.Width
        $newH = $src.Height
    }
    
    $dst = New-Object System.Drawing.Bitmap($newW, $newH)
    $g   = [System.Drawing.Graphics]::FromImage($dst)
    $g.InterpolationMode  = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.SmoothingMode      = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.DrawImage($src, 0, 0, $newW, $newH)
    $g.Dispose()
    
    $beforeKB = [math]::Round((Get-Item $InputPath).Length / 1KB, 1)
    $dst.Save($OutputPath, $jpegEncoder, $encParams)
    $afterKB  = [math]::Round((Get-Item $OutputPath).Length / 1KB, 1)

    $src.Dispose()
    $dst.Dispose()

    $saving = [math]::Round((1 - $afterKB/$beforeKB)*100, 0)
    Write-Host ("  {0,-55} {1,8} KB -> {2,6} KB  (-{3}%)" -f (Split-Path $OutputPath -Leaf), $beforeKB, $afterKB, $saving)
}

Write-Host "`n=== Compressing Carousel Images (target: 1920px, Q78) ===`n"
foreach ($i in 1..5) {
    $src = "$folder\carousel$i.jpg"
    $tmp = "$folder\carousel${i}_opt.jpg"
    if (Test-Path $src) {
        Compress-Image -InputPath $src -OutputPath $tmp -MaxWidth 1920 -Quality 78
    }
}

Write-Host "`n=== Compressing Heavy Service/Gallery Images (target: 1400px, Q80) ===`n"
$heavy = @(
    "Braces.jpg",
    "Dental Check-ups.jpg",
    "Dental Exrays.jpg",
    "Dental Fillings and  Sealants.jpg",
    "Cosmetic Dentistry.jpg",
    "Paediatric Dentistry.jpg",
    "Veneers.jpg",
    "Teeth Whitening.jpg",
    "implant-after.jpg",
    "implant-before.jpg",
    "crown-after.jpg",
    "crown-before.jpg",
    "Braces Treatment-before.jpg",
    "Braces Treatment-after.jpg",
    "Invisalign Treatment-after.jpg",
    "Digital Imaging.jpg"
)
foreach ($name in $heavy) {
    $src = "$folder\$name"
    if (Test-Path $src) {
        $tmp = "$folder\opt_$name"
        Compress-Image -InputPath $src -OutputPath $tmp -MaxWidth 1400 -Quality 80
    }
}

# Compress Tooth extraction PNG (it's 1.3 MB)
Write-Host "`n=== Compressing Tooth extraction.png -> JPEG ===`n"
$pngSrc = "$folder\Tooth extraction.png"
if (Test-Path $pngSrc) {
    $encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]82)
    $src = [System.Drawing.Bitmap]::new($pngSrc)
    $ratio = 1400 / $src.Width
    if ($src.Width -gt 1400) { $newW=1400; $newH=[int]($src.Height*$ratio) } else { $newW=$src.Width; $newH=$src.Height }
    $dst = New-Object System.Drawing.Bitmap($newW,$newH)
    $g = [System.Drawing.Graphics]::FromImage($dst)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($src,0,0,$newW,$newH)
    $g.Dispose()
    $beforeKB = [math]::Round((Get-Item $pngSrc).Length/1KB,1)
    $dst.Save("$folder\Tooth extraction_opt.jpg", $jpegEncoder, $encParams)
    $afterKB = [math]::Round((Get-Item "$folder\Tooth extraction_opt.jpg").Length/1KB,1)
    $src.Dispose(); $dst.Dispose()
    $saving = [math]::Round((1-$afterKB/$beforeKB)*100,0)
    Write-Host ("  Tooth extraction.png  {0} KB -> {1} KB  (-{2}%)" -f $beforeKB,$afterKB,$saving)
}

Write-Host "`nDone! Optimized files saved with '_opt' prefix / 'carousel*_opt.jpg' naming."
Write-Host "Review them then run the rename/replace step."
