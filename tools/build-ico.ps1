# 图标打包脚本：512px 母版 PNG -> 多尺寸 icon.ico
# 用法（在仓库根执行）：powershell -ExecutionPolicy Bypass -File tools\build-ico.ps1
param(
  [string]$MasterPng = 'assets\icon-512.png',
  [string]$OutIco = 'icon.ico',
  [int[]]$Sizes = @(16, 24, 32, 48, 64, 128, 256)
)
Add-Type -AssemblyName System.Drawing
$proj = Split-Path -Parent $PSScriptRoot
$master = Join-Path $proj $MasterPng
$outIco = Join-Path $proj $OutIco
$tmp = Join-Path $proj 'assets\_tmp'
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

$src = [System.Drawing.Image]::FromFile($master)
$pngs = @{}
foreach ($s in $Sizes) {
  $bmp = New-Object System.Drawing.Bitmap($s, $s)
  $gr = [System.Drawing.Graphics]::FromImage($bmp)
  $gr.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $gr.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $gr.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $gr.DrawImage($src, 0, 0, $s, $s)
  $p = Join-Path $tmp ("icon-$s.png")
  $bmp.Save($p, [System.Drawing.Imaging.ImageFormat]::Png)
  $gr.Dispose(); $bmp.Dispose()
  $pngs[$s] = [System.IO.File]::ReadAllBytes($p)
}
$src.Dispose()

# ICO 容器：ICONDIR(6) + 条目(16×N) + PNG 数据（Vista+ 支持 PNG 压缩条目）
$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($ms)
$bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]$Sizes.Count)
$offset = 6 + 16 * $Sizes.Count
foreach ($s in $Sizes) {
  $dim = if ($s -ge 256) { 0 } else { $s }
  $bw.Write([Byte]$dim); $bw.Write([Byte]$dim)
  $bw.Write([Byte]0); $bw.Write([Byte]0)
  $bw.Write([UInt16]1); $bw.Write([UInt16]32)
  $bw.Write([UInt32]$pngs[$s].Length)
  $bw.Write([UInt32]$offset)
  $offset += $pngs[$s].Length
}
foreach ($s in $Sizes) { $bw.Write($pngs[$s]) }
$bw.Flush()
[System.IO.File]::WriteAllBytes($outIco, $ms.ToArray())
$bw.Dispose(); $ms.Dispose()
Write-Output ("ICO written: $outIco (" + (Get-Item $outIco).Length + " bytes, " + $Sizes.Count + " sizes)")
