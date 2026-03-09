$f = "c:\Users\USER\Desktop\TechBrain Projects\Pinnacle Dental Website"

# Replace carousel images
1..5 | ForEach-Object {
    $opt = "$f\carousel${_}_opt.jpg"
    $orig = "$f\carousel$_.jpg"
    if (Test-Path $opt) { Copy-Item $opt $orig -Force; Remove-Item $opt -Force; Write-Host "Replaced carousel$_.jpg" }
}

# Replace service/gallery images
@(
    "Braces.jpg","Dental Check-ups.jpg","Dental Exrays.jpg",
    "Dental Fillings and  Sealants.jpg","Cosmetic Dentistry.jpg",
    "Paediatric Dentistry.jpg","Veneers.jpg","Teeth Whitening.jpg",
    "implant-after.jpg","implant-before.jpg","crown-after.jpg","crown-before.jpg",
    "Braces Treatment-before.jpg","Braces Treatment-after.jpg",
    "Invisalign Treatment-after.jpg","Digital Imaging.jpg"
) | ForEach-Object {
    $opt = "$f\opt_$_"
    $orig = "$f\$_"
    if (Test-Path $opt) { Copy-Item $opt $orig -Force; Remove-Item $opt -Force; Write-Host "Replaced $_" }
}

# Replace Tooth extraction (now JPG)
if (Test-Path "$f\Tooth extraction_opt.jpg") {
    Copy-Item "$f\Tooth extraction_opt.jpg" "$f\Tooth extraction.jpg" -Force
    Remove-Item "$f\Tooth extraction_opt.jpg" -Force
    Write-Host "Created Tooth extraction.jpg"
}
Write-Host "All done!"
