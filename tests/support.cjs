const fs = require('node:fs')
const path = require('node:path')
const skia = require('skia-canvas')
const sourceRoot = process.env.CIDER_TEST_SOURCE || path.join(__dirname, '../src')
const source = name => fs.readFileSync(path.join(sourceRoot, name), 'utf8').replace(/^import .*\r?\n/gm, '').replace(/export /g, '')
function loadAppearance(FontLibrary = skia.FontLibrary) {
  return new Function('FontLibrary', source('appearance.js') + '\nreturn { FONT_STACK, getAvailableFontFamilies, normalizeAppearance, getFontStack }')(FontLibrary)
}
const appearance = loadAppearance()
function renderer(Canvas = skia.Canvas) {
  return new Function('Canvas', 'loadImage', ...Object.keys(appearance), source('canvasRenderer.js') + '\nreturn renderNowPlaying')(Canvas, skia.loadImage, ...Object.values(appearance))
}
module.exports = { source, loadAppearance, appearance, renderer }
