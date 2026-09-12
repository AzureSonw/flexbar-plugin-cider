import { Canvas, loadImage } from "skia-canvas"
import { FONT_STACK, getFontStack, normalizeAppearance } from "./appearance"

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" })

function fitText(context, value, maxWidth) {
  const text = String(value || "").replace(/[\r\n]+/g, " ")
  if (context.measureText(text).width <= maxWidth) return text
  const characters = Array.from(graphemes.segment(text), ({ segment }) => segment)
  while (characters.length && context.measureText(`${characters.join("")}…`).width > maxWidth) characters.pop()
  return characters.length ? `${characters.join("")}…` : ""
}

function drawPlaybackOverlay(context, state, coverX, coverY, coverSize) {
  if (coverSize <= 0 || (state !== "playing" && state !== "paused")) return
  const iconSize = Math.min(36, coverSize * 0.68)
  const scale = iconSize / 24
  context.save()
  // Clip even the glow to the actual artwork, including very narrow keys.
  context.beginPath()
  context.rect(coverX, coverY, coverSize, coverSize)
  context.clip()
  context.translate(coverX + coverSize / 2, coverY + coverSize / 2)
  context.fillStyle = "#ffffff"
  context.shadowColor = "rgba(0, 0, 0, 0.65)"
  context.shadowBlur = Math.min(4, iconSize * 0.15)
  context.beginPath()
  if (state === "paused") {
    context.moveTo(-5 * scale, -8 * scale)
    context.lineTo(7 * scale, 0)
    context.lineTo(-5 * scale, 8 * scale)
    context.closePath()
  } else {
    context.roundRect(-5 * scale, -8 * scale, 4 * scale, 16 * scale, 2 * scale)
    context.roundRect(scale, -8 * scale, 4 * scale, 16 * scale, 2 * scale)
  }
  context.fill()
  context.restore()
}

export async function renderNowPlaying(track, key, appearance = {}) {
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
  const settings = normalizeAppearance(appearance)
  const fontStack = getFontStack(settings.fontFamily)
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

  if (settings.showPlayPauseOverlay) {
    drawPlaybackOverlay(context, track.progress?.state, coverX, coverY, coverSize)
  }

  const textWidth = Math.max(0, textRight - textLeft)
  const textX = textLeft + textWidth / 2
  const fontSize = settings.fontSize ?? Math.min(24, Math.max(12, Number(key.style?.fontSize) || 24))
  context.textAlign = "center"
  context.textBaseline = "middle"
  context.fillStyle = key.style?.fgColor || "#ffffff"
  context.font = `${fontSize}px ${fontStack}`
  const title = fitText(context, track.title, textWidth)
  let titleY = track.artist ? 15 : 26
  let artistY = 34
  let artistSize = Math.max(11, fontSize - 4)
  // Keep the established layout at normal sizes. Larger titles share the
  // space above the timeline with an artist line sized to its actual glyphs.
  if (track.artist && fontSize > 24 && textWidth > 0) {
    const titleBounds = context.measureText(title)
    let artistBounds
    do {
      context.font = `${artistSize}px ${fontStack}`
      artistBounds = context.measureText(fitText(context, track.artist, textWidth))
      const height = titleBounds.actualBoundingBoxAscent + titleBounds.actualBoundingBoxDescent
        + artistBounds.actualBoundingBoxAscent + artistBounds.actualBoundingBoxDescent + 2
      if (height <= 48 || artistSize <= 11) {
        const top = Math.max(0, (48 - height) / 2)
        titleY = top + titleBounds.actualBoundingBoxAscent
        artistY = titleY + titleBounds.actualBoundingBoxDescent + 2 + artistBounds.actualBoundingBoxAscent
        break
      }
      artistSize--
    } while (true)
    context.font = `${fontSize}px ${fontStack}`
  }
  if (textWidth > 0) context.fillText(title, textX, titleY)
  if (track.artist && textWidth > 0) {
    context.fillStyle = "#bdbdbd"
    context.font = `${artistSize}px ${fontStack}`
    context.fillText(fitText(context, track.artist, textWidth), textX, artistY)
  }

  const timelineX = coverX + coverSize + 45
  const timelineWidth = Math.max(0, width - 45 - timelineX)
  const progress = track.progress
  if (timelineWidth > 0 && Number.isFinite(progress?.currentTime) && Number.isFinite(progress?.duration) && progress.duration > 0) {
    const played = Math.max(0, Math.min(1, progress.currentTime / progress.duration))
    context.fillStyle = "#404040"
    context.fillRect(timelineX, 50, timelineWidth, 3)
    if (played > 0) {
      context.fillStyle = settings.timelineColor
      context.fillRect(timelineX, 50, timelineWidth * played, 3)
    }
  }
  return canvas.toDataURL("image/png")
}
