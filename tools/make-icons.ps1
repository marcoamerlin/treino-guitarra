# Gera os ícones do app (knob de amplificador em latão). Uso: powershell -File tools\make-icons.ps1
Add-Type -AssemblyName System.Drawing

$out = Join-Path (Split-Path $PSScriptRoot -Parent) 'icons'
New-Item -ItemType Directory -Force $out | Out-Null

function New-Icon([int]$size, [double]$scale, [string]$path) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.ColorTranslator]::FromHtml('#1B1613'))

  $c = $size / 2.0
  $r = $size * 0.30 * $scale

  # anel de LEDs em volta do knob
  $ledBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#7FA65B'))
  $offBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#55483A'))
  $ringR = $r * 1.42
  $dot = $size * 0.022 * $scale
  for ($i = 0; $i -le 10; $i++) {
    $a = (-225 + $i * 27) * [Math]::PI / 180
    $x = $c + [Math]::Cos($a) * $ringR
    $y = $c + [Math]::Sin($a) * $ringR
    $brush = if ($i -le 7) { $ledBrush } else { $offBrush }
    $g.FillEllipse($brush, $x - $dot, $y - $dot, 2 * $dot, 2 * $dot)
  }

  # corpo do knob
  $knob = New-Object System.Drawing.Drawing2D.LinearGradientBrush ((New-Object System.Drawing.PointF ($c, ($c - $r))), (New-Object System.Drawing.PointF ($c, ($c + $r))), ([System.Drawing.ColorTranslator]::FromHtml('#4A3F33')), ([System.Drawing.ColorTranslator]::FromHtml('#241E19')))
  $g.FillEllipse($knob, $c - $r, $c - $r, 2 * $r, 2 * $r)
  $pen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#C9A227')), ($size * 0.018 * $scale)
  $g.DrawEllipse($pen, $c - $r, $c - $r, 2 * $r, 2 * $r)

  # indicador do knob (âmbar), apontando para cima e à direita
  $tick = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#E8B84B')), ($size * 0.035 * $scale)
  $tick.StartCap = 'Round'; $tick.EndCap = 'Round'
  $a = -55 * [Math]::PI / 180
  $g.DrawLine($tick, $c + [Math]::Cos($a) * $r * 0.30, $c + [Math]::Sin($a) * $r * 0.30, $c + [Math]::Cos($a) * $r * 0.82, $c + [Math]::Sin($a) * $r * 0.82)

  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

New-Icon 512 1.0 (Join-Path $out 'icon-512.png')
New-Icon 192 1.0 (Join-Path $out 'icon-192.png')
New-Icon 180 1.0 (Join-Path $out 'apple-touch-icon.png')
# maskable: conteúdo menor, para sobreviver ao recorte circular do Android
New-Icon 512 0.72 (Join-Path $out 'icon-maskable-512.png')
Write-Output 'ok'
