const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { Canvas: NativeCanvas, loadImage } = require('skia-canvas')
const { appearance, renderer } = require('./support.cjs')

const sourceRoot = process.env.CIDER_TEST_SOURCE || path.join(__dirname, '..', 'src')
const readSource = name => fs.readFileSync(path.join(sourceRoot, name), 'utf8').replace(/^import .*\r?\n/gm, '')
const render = renderer()
const track = { title: '夜曲 · アイドル · 좋은 날 · déjà vu 👩🏽‍🚀', artist: '周杰伦 · YOASOBI · 아이유 · Beyoncé' }
const key = (name, uid, width = 180) => ({
  uid, cid: 'com.sonw.cider.' + name, width, style: { width, iconSize: 42, fontSize: 24 },
  cfg: { keyType: 'default', clickable: true }, sz: 497,
})
function harness(renderImage = render) {
  const handlers = {}, draws = [], sliders = [], actions = [], warnings = []
  let timer
  const plugin = {
    on: (name, handler) => { handlers[name] = handler },
    getConfig: async () => ({}), start() {}, transport: { ws: { once() {} } },
    draw: async (serialNumber, key, type, image) => { draws.push({ serialNumber, key, type, image }) },
    setSlider: async (serialNumber, key, value) => { sliders.push({ serialNumber, key, value }) },
  }
  const action = name => async () => { actions.push(name); return true }
  const names = ['plugin', 'logger', 'setCiderToken', 'testConnection', 'getTrackInfo', 'togglePlayPause', 'nextTrack', 'previousTrack', 'getVolume', 'setVolume', 'renderNowPlaying', 'setInterval', 'getPlaybackProgress']
  new Function(...names, ...Object.keys(appearance), readSource('plugin.js'))(plugin, { warn: msg => warnings.push(msg) }, () => {}, async () => true, async () => track,
    action('playpause'), action('next'), action('previous'), async () => 0.72, action('volume'), renderImage,
    callback => { timer = callback; return { unref() {} } }, async () => null, ...Object.values(appearance))
  return { handlers, draws, sliders, actions, warnings, tick: () => timer(),
    alive: (keys, serialNumber = 'device-a') => handlers['plugin.alive']({ serialNumber, keys }) }
}
const settle = async () => { for (let i = 0; i < 15; i++) await new Promise(resolve => setImmediate(resolve)) }

test('near-full-height cover crops without stretching and keeps legacy horizontal text positions', async () => {
  const text = [], crops = []
  class Canvas extends NativeCanvas {
    getContext(type) {
      const context = super.getContext(type)
      return new Proxy(context, {
        set(target, name, value) { target[name] = value; return true },
        get(target, name) {
          if (name === 'fillText') return (value, x, y) => {
            text.push({ value, x, y, align: target.textAlign, font: target.font, color: target.fillStyle })
            return target.fillText(value, x, y)
          }
          if (name === 'drawImage') return (image, ...args) => { crops.push(args); return target.drawImage(image, ...args) }
          const value = target[name]
          return typeof value === 'function' ? value.bind(target) : value
        },
      })
    }
  }
  const art = new NativeCanvas(160, 80); art.gpu = false
  const context = art.getContext('2d')
  context.fillStyle = '#ff0000'; context.fillRect(0, 0, 160, 80)
  context.fillStyle = '#00cc88'; context.fillRect(40, 0, 80, 80)
  const artwork = await art.toDataURL('png')
  const renderCover = renderer(Canvas)
  for (const [width, iconSize, center] of [[300, 42, 176], [480, 42, 266], [800, 42, 426], [480, 24, 257], [480, 60, 275]]) {
    text.length = crops.length = 0
    const image = await loadImage(await renderCover({ title: '夜曲', artist: '周杰伦', artwork }, { width, style: { width, iconSize, bgColor: '#222222' } }))
    assert.deepEqual(text.map(({ value, x, y, align }) => ({ value, x, y, align })), [
      { value: '夜曲', x: center, y: 15, align: 'center' }, { value: '周杰伦', x: center, y: 34, align: 'center' },
    ])
    assert.match(text[0].font, /(?:^| )24px /); assert.match(text[1].font, /(?:^| )20px /)
    if (iconSize === 42) {
      assert.deepEqual(crops, [[40, 0, 80, 80, 1, 1, 58, 58]])
      const check = new NativeCanvas(width, 60); check.gpu = false
      const cc = check.getContext('2d'); cc.drawImage(image, 0, 0)
      for (const [x, y] of [[0,0], [30,0], [59,30], [30,59], [0,30]]) {
        assert.deepEqual([...cc.getImageData(x, y, 1, 1).data], [0,0,0,255])
      }
      assert.deepEqual([...cc.getImageData(30,30,1,1).data], [0,204,136,255])
    }
  }
})


test('re-upload with a reused UID never paints the Previous key', async () => {
  const h = harness()
  await h.alive([key('nowPlaying', 1, 600), key('previous', 2)])
  h.draws.length = 0
  // Actual FlexDesigner 2.2.3 sequence: another alive snapshot, no dead event.
  const latest = [key('previous', 1), key('nowPlaying', 2, 600)]
  await h.alive(latest)
  assert.ok(h.draws.length)
  assert.ok(h.draws.every(d => d.key.uid === 2), 'stale Now Playing draw targets the left Previous key')
  const copied = h.draws.at(-1).key
  assert.deepEqual(copied, { ...latest[1], style: { ...latest[1].style, showImage: true, showIcon: false, showTitle: false } })
  assert.equal(latest[1].style.showImage, undefined, 'runtime key was mutated')
})

const layouts = [
  ['nowPlaying'], ['previous', 'nowPlaying'], ['playPause', 'nowPlaying'],
  ['volume', 'nowPlaying'], ['previous', 'nowPlaying', 'playPause', 'next'],
  ['previous', 'nowPlaying', 'volume'],
]
for (const width of [300, 480, 600, 800]) {
  for (const layout of layouts) {
    test(`safe draw target and controls: ${layout.join(' / ')} at ${width}px`, async () => {
      const h = harness()
      await h.alive([key('nowPlaying', 1, 480), key('volume', 2, 300)])
      const keys = layout.map((name, i) => key(name, i + 1, name === 'nowPlaying' ? width : name === 'volume' ? 300 : 180))
      h.draws.length = 0; h.sliders.length = 0
      await h.alive(keys)
      const expected = keys.find(k => k.cid.endsWith('.nowPlaying'))
      assert.ok(h.draws.length)
      for (const d of h.draws) {
        assert.equal(d.key.uid, expected.uid)
        assert.equal(d.key.width, width); assert.equal(d.key.style.width, width)
        const png = Buffer.from(d.image.split(',')[1], 'base64')
        assert.equal(png.readUInt32BE(16), width); assert.equal(png.readUInt32BE(20), 60)
      }
      assert.ok(h.sliders.every(s => keys.some(k => k.uid === s.key.uid && k.cid.endsWith('.volume'))))
      for (const k of keys) {
        const name = k.cid.split('.').at(-1)
        assert.equal((await h.handlers['plugin.data']({ serialNumber: 'device-a', data: { key: k, value: 75 } })).status, 'success')
        assert.equal(h.actions.at(-1), ['nowPlaying', 'playPause'].includes(name) ? 'playpause' : name)
      }
      await settle()
      assert.ok(h.draws.every(d => d.key.uid === expected.uid))
    })
  }
}

test('empty and shortened snapshots remove old targets but preserve other devices', async () => {
  const h = harness()
  await h.alive([key('nowPlaying', 7, 800)], 'device-a')
  await h.alive([key('nowPlaying', 7, 300)], 'device-b')
  h.draws.length = 0
  await h.alive([key('previous', 1)], 'device-a')
  assert.ok(h.draws.length)
  assert.ok(h.draws.every(d => d.serialNumber === 'device-b'))
  h.draws.length = 0
  await h.alive([], 'device-b')
  h.tick(); await settle()
  assert.equal(h.draws.length, 0)
})

test('in-flight image for an obsolete key is discarded after re-upload', async () => {
  let release, entered
  const waiting = new Promise(resolve => { entered = resolve })
  const held = new Promise(resolve => { release = resolve })
  let first = true
  const h = harness(async (track, key) => {
    if (first) { first = false; entered(); await held }
    return render(track, key)
  })
  const before = h.alive([key('nowPlaying', 1, 800)])
  await waiting
  const after = h.alive([key('previous', 1), key('nowPlaying', 2, 300)])
  await settle(); release()
  await Promise.all([before, after])
  assert.ok(h.draws.length)
  assert.ok(h.draws.every(d => d.key.uid === 2 && d.key.width === 300))
})

test('invalid or conflicting widths produce no bitmap', async () => {
  for (const width of [0, -1, NaN, Infinity, 59.9, '', 'invalid']) {
    await assert.rejects(render(track, { width, style: { width: 480 } }), RangeError)
  }
  await assert.rejects(render(track, {}), RangeError)
  await assert.rejects(render(track, { width: 600, style: { width: 300 } }), RangeError)
  const png = await loadImage(await render(track, { style: { width: 300 } }))
  assert.equal(png.width, 300)
})

test('artwork and Unicode stay inside the bitmap, including extremely narrow keys', async () => {
  let operations = []
  class Canvas extends NativeCanvas {
    getContext(type) {
      const context = super.getContext(type)
      return new Proxy(context, {
        set(target, name, value) { target[name] = value; return true },
        get(target, name) {
          if (name === 'fillRect' || name === 'clearRect') return (x, y, width, height) => { operations.push({ x, y, width, height }); target[name](x, y, width, height) }
          if (name === 'drawImage') return (image, ...args) => { const [x, y, width, height] = args.slice(-4); operations.push({ art: true, x, y, width, height }); target.drawImage(image, ...args) }
          if (name === 'fillText') return (text, x, y) => {
            const m = target.measureText(text)
            operations.push({ text, x: x - m.actualBoundingBoxLeft, y: y - m.actualBoundingBoxAscent, width: m.actualBoundingBoxLeft + m.actualBoundingBoxRight, height: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent })
            target.fillText(text, x, y)
          }
          const value = target[name]
          return typeof value === 'function' ? value.bind(target) : value
        },
      })
    }
  }
  const boundedRender = renderer(Canvas)
  const artwork = new NativeCanvas(160, 80); artwork.gpu = false
  const ac = artwork.getContext('2d'); ac.fillStyle = '#ff4060'; ac.fillRect(0, 0, 160, 80)
  const data = await artwork.toDataURL('image/png')
  for (const width of [1, 2, 7, 16, 30, 59, 60, 68, 100, 120, 180, 300, 480, 600, 800]) {
    for (const iconSize of [-3, 42, 60, Infinity]) {
      for (const art of [undefined, data]) {
        operations = []
        const k = key('nowPlaying', 1, width); k.style.iconSize = iconSize
        const original = structuredClone(k)
        const image = await loadImage(await boundedRender({ ...track, artwork: art }, k))
        assert.equal(image.width, width); assert.equal(image.height, 60)
        assert.deepEqual(k, original)
        const guard = Math.min(2, width - 1)
        assert.deepEqual(operations.at(-1), { x:width-guard, y:0, width:guard, height:60 })
        const check = new NativeCanvas(width,60); check.gpu=false
        const pixels = check.getContext('2d'); pixels.drawImage(image,0,0)
        if (guard) assert.ok([...pixels.getImageData(width-guard,0,guard,60).data].every(v=>v===0), `right edge at ${width}px must be transparent`)
        assert.equal(pixels.getImageData(0,0,1,1).data[3],255,'at least one opaque pixel survives even at width 1')
        for (const o of operations) {
          assert.ok(o.x >= 0 && o.y >= 0 && o.width >= 0 && o.height >= 0, JSON.stringify(o))
          assert.ok(o.x + o.width <= width && o.y + o.height <= 60, JSON.stringify({ width, o }))
        }
        if (width >= 300 && iconSize === 42 && art) {
          assert.deepEqual(operations.find(o => o.art), { art: true, x: 1, y: 1, width: 58, height: 58 })
          assert.ok(operations.filter(o => o.text).length === 2)
        }
      }
    }
  }
})
