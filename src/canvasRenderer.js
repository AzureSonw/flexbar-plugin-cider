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
  const width = Math.max(60, Math.round(Number(key.width || key.style?.width) || 480))
  const canvas = new Canvas(width, 60)
  canvas.gpu = false
  const context = canvas.getContext("2d")
  context.fillStyle = key.style?.bgColor || "#000000"
  context.fillRect(0, 0, width, 60)

  const coverSize = Math.min(60, Number(key.style?.iconSize) || 42)
  const coverX = Math.max(0, width * 0.12 - coverSize / 2)
  const coverY = (60 - coverSize) / 2
  let artwork
  if (track.artwork) {
    try { artwork = await loadImage(track.artwork) } catch { /* Keep text when artwork is unavailable. */ }
  }
  if (artwork) {
    const scale = Math.min(coverSize / artwork.width, coverSize / artwork.height)
    const imageWidth = artwork.width * scale
    const imageHeight = artwork.height * scale
    context.drawImage(artwork, coverX + (coverSize - imageWidth) / 2, coverY + (coverSize - imageHeight) / 2, imageWidth, imageHeight)
  } else {
    context.fillStyle = "#333333"
    context.fillRect(coverX, coverY, coverSize, coverSize)
    context.fillStyle = "#ffffff"
    context.font = `24px ${FONT_STACK}`
    context.textAlign = "center"
    context.textBaseline = "middle"
    context.fillText("♪", coverX + coverSize / 2, 30)
  }

  const textX = width * 0.72
  const textWidth = Math.max(0, 2 * Math.min(textX - coverX - coverSize - 10, width - textX - 6))
  const fontSize = Math.min(24, Math.max(12, Number(key.style?.fontSize) || 24))
  context.textAlign = "center"
  context.textBaseline = "middle"
  context.fillStyle = key.style?.fgColor || "#ffffff"
  context.font = `${fontSize}px ${FONT_STACK}`
  context.fillText(fitText(context, track.title, textWidth), textX, track.artist ? 19 : 30)
  if (track.artist) {
    context.fillStyle = "#bdbdbd"
    context.font = `${Math.max(11, fontSize - 4)}px ${FONT_STACK}`
    context.fillText(fitText(context, track.artist, textWidth), textX, 44)
  }
  return canvas.toDataURL("image/png")
}
