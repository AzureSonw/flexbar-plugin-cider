import { Canvas, loadImage } from "skia-canvas"

const FONT_STACK = '"Microsoft YaHei", "Microsoft JhengHei", "Yu Gothic", "Malgun Gothic", "Segoe UI", sans-serif'
const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" })

function fitText(context, value, maxWidth) {
  const text = String(value || "").replace(/[\r\n]+/g, " ")
  if (context.measureText(text).width <= maxWidth) return text
  const characters = Array.from(graphemes.segment(text), ({ segment }) => segment)
  while (characters.length && context.measureText(`${characters.join("")}…`).width > maxWidth) characters.pop()
  return characters.length ? `${characters.join("")}…` : ""
}

export async function renderNowPlaying(track, key) {
  const width = Number(key.width ?? key.style?.width)
  // Never invent or round up a drawing allocation. Runtime and style widths
  // agree in FlexDesigner; skip an inconsistent snapshot instead of guessing.
  if (!Number.isSafeInteger(width) || width <= 0 ||
      (key.style?.width != null && Number(key.style.width) !== width)) {
    throw new RangeError("Invalid Now Playing key width.")
  }
  const canvas = new Canvas(width, 60)
  canvas.gpu = false
  const context = canvas.getContext("2d")
  context.fillStyle = key.style?.bgColor || "#000000"
  context.fillRect(0, 0, width, 60)

  const horizontalPadding = Math.min(8, Math.floor(width / 4))
  const requestedCoverSize = Number(key.style?.iconSize)
  const layoutCoverSize = Math.min(60, width - 2 * horizontalPadding,
    Number.isFinite(requestedCoverSize) && requestedCoverSize > 0 ? requestedCoverSize : 42)
  const textGap = 10
  // Keep the v1.2.1 text allocation independent of the larger artwork.
  const textRight = width - horizontalPadding
  const textLeft = Math.min(textRight, horizontalPadding + layoutCoverSize + textGap)
  const coverSize = Math.max(0, Math.min(58, width - 2, textLeft - 2))
  const coverX = 1
  const coverY = (60 - coverSize) / 2
  let artwork
  if (track.artwork) {
    try { artwork = await loadImage(track.artwork) } catch { /* Keep text when artwork is unavailable. */ }
  }
  if (coverSize > 0) {
    context.fillStyle = "#000000"
    context.fillRect(0, coverY - 1, coverSize + 2, coverSize + 2)
  }
  if (artwork && coverSize > 0) {
    const cropSize = Math.min(artwork.width, artwork.height)
    context.drawImage(artwork, (artwork.width - cropSize) / 2, (artwork.height - cropSize) / 2,
      cropSize, cropSize, coverX, coverY, coverSize, coverSize)
  } else if (coverSize > 0) {
    context.fillStyle = "#333333"
    context.fillRect(coverX, coverY, coverSize, coverSize)
    context.fillStyle = "#ffffff"
    context.font = `24px ${FONT_STACK}`
    context.textAlign = "center"
    context.textBaseline = "middle"
    if (coverSize >= context.measureText("♪").width) {
      context.fillText("♪", coverX + coverSize / 2, 30)
    }
  }

  const textWidth = Math.max(0, textRight - textLeft)
  const textX = textLeft + textWidth / 2
  const fontSize = Math.min(24, Math.max(12, Number(key.style?.fontSize) || 24))
  context.textAlign = "center"
  context.textBaseline = "middle"
  context.fillStyle = key.style?.fgColor || "#ffffff"
  context.font = `${fontSize}px ${FONT_STACK}`
  if (textWidth > 0) context.fillText(fitText(context, track.title, textWidth), textX, track.artist ? 15 : 26)
  if (track.artist && textWidth > 0) {
    context.fillStyle = "#bdbdbd"
    context.font = `${Math.max(11, fontSize - 4)}px ${FONT_STACK}`
    context.fillText(fitText(context, track.artist, textWidth), textX, 34)
  }

  const timelineX = coverX + coverSize + 30
  const timelineWidth = Math.max(0, width - 30 - timelineX)
  const progress = track.progress
  if (timelineWidth > 0 && Number.isFinite(progress?.currentTime) && Number.isFinite(progress?.duration) && progress.duration > 0) {
    const played = Math.max(0, Math.min(1, progress.currentTime / progress.duration))
    context.fillStyle = "#404040"
    context.fillRect(timelineX, 50, timelineWidth, 2)
    if (played > 0) {
      context.fillStyle = "#ffffff"
      context.fillRect(timelineX, 50, timelineWidth * played, 2)
    }
  }
  return canvas.toDataURL("image/png")
}
