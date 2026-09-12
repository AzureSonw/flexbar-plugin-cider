import { FontLibrary } from "skia-canvas"

export const FONT_STACK = '"Microsoft YaHei", "Microsoft JhengHei", "Yu Gothic", "Malgun Gothic", "Segoe UI", sans-serif'

export function getAvailableFontFamilies() {
  return [...new Set(FontLibrary.families.filter(name => typeof name === "string" && name.trim()))]
    .sort((a, b) => a.localeCompare(b))
}

function availableFont(value) {
  if (typeof value !== "string" || !value.trim()) return ""
  try { return FontLibrary.has(value) ? value : "" } catch { return "" }
}

export function normalizeAppearance(config) {
  const color = typeof config?.timelineColor === "string" ? config.timelineColor.trim() : ""
  const size = typeof config?.fontSize === "number" || typeof config?.fontSize === "string" ? Number(config.fontSize) : NaN
  const delay = config?.playPauseOverlayHideDelaySeconds
  return {
    showPlayPauseOverlay: config?.showPlayPauseOverlay !== false,
    autoHidePlayPauseOverlay: config?.autoHidePlayPauseOverlay === true,
    playPauseOverlayHideDelaySeconds: Number.isInteger(delay) && delay >= 1 && delay <= 30 ? delay : 3,
    timelineColor: /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : "#ffffff",
    fontFamily: availableFont(config?.fontFamily),
    fontSize: Number.isInteger(size) && size >= 12 && size <= 30 ? size : null,
  }
}

export function getFontStack(fontFamily) {
  const family = availableFont(fontFamily)
  if (!family) return FONT_STACK
  // CSS quoted strings: escape quotes/backslashes and encode control characters.
  const quoted = family.replace(/["\\]/g, "\\$&")
    .replace(/[\x00-\x1f\x7f]/g, character => `\\${character.charCodeAt(0).toString(16)} `)
  return `"${quoted}", ${FONT_STACK}`
}
