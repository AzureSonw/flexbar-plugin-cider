const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { appearance } = require('./support.cjs')
const source = name => fs.readFileSync(path.join(__dirname, '..', 'src', name), 'utf8').replace(/^import .*\r?\n/gm, '')
const modes = ['off', 'game', 'antifatigue']
const names = ['listeningMode', 'listeningModeOff', 'listeningModeGaming', 'listeningModeUnwind']
const icons = ['close-box-outline', 'gamepad-variant-outline', 'bed-king-outline']
const key = (name, uid) => ({ uid, cid: 'com.sonw.cider.' + name, width: 120, style: { width: 120, bgColor: '#121212' } })
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const settle = async () => { for (let i = 0; i < 20; i++) await new Promise(r => setImmediate(r)) }

function api() {
  const calls = []
  let response = { mode: 'off' }, status = 200, fail = false
  const fetch = async (url, options) => {
    calls.push({ url, ...options })
    if (fail) throw Error('offline')
    return new Response(status === 204 ? null : typeof response === 'string' ? response : JSON.stringify(response), { status })
  }
  const methods = ['setCiderToken', 'getListeningMode', 'setListeningMode', 'getVolume', 'setVolume', 'togglePlayPause', 'nextTrack', 'previousTrack']
  const control = new Function('fetch', source('musicControl.js').replace(/export /g, '') + '\nreturn {' + methods.join(',') + '}')(fetch)
  control.setCiderToken('test-token')
  return { ...control, calls, fixture(value, code = 200, error = false) { response = value; status = code; fail = error } }
}

test('v2 GET accepts both envelopes and only exact API mode strings', async () => {
  const a = api()
  for (const mode of modes) {
    for (const body of [{ mode }, { data: { mode } }]) {
      a.fixture(body)
      assert.equal(await a.getListeningMode(), mode)
    }
  }
  for (const mode of ['gaming', 'unwind', '', 'OFF', false, 0, null, {}, ['game']]) {
    a.fixture({ data: { mode } })
    assert.equal(await a.getListeningMode(), null)
  }
  for (const [body, code, error] of [['invalid JSON', 200], [{}, 204], [{}, 401], [{}, 404], [{}, 500], [{}, 200, true]]) {
    a.fixture(body, code, error)
    assert.equal(await a.getListeningMode(), null)
  }
  for (const call of a.calls) {
    assert.equal(call.url, 'http://127.0.0.1:10767/api/v2/audio/listening-mode')
    assert.equal(call.method, 'GET')
    assert.equal(call.headers.apptoken, 'test-token')
    assert.ok(call.signal instanceof AbortSignal)
  }
})

test('v2 PATCH validates before sending, authenticates, and uses authoritative returned state', async () => {
  const a = api()
  for (const invalid of ['gaming', 'unwind', '', null, {}, ['off'], 0]) assert.equal(await a.setListeningMode(invalid), null)
  assert.equal(a.calls.length, 0)
  for (const mode of modes) {
    a.fixture({ data: { mode: 'antifatigue' } })
    assert.equal(await a.setListeningMode(mode), 'antifatigue')
    const call = a.calls.at(-1)
    assert.equal(call.url, 'http://127.0.0.1:10767/api/v2/audio/listening-mode')
    assert.equal(call.method, 'PATCH')
    assert.deepEqual(call.headers, { apptoken: 'test-token', 'Content-Type': 'application/json' })
    assert.deepEqual(JSON.parse(call.body), { mode })
  }
  a.fixture({}, 204)
  assert.equal(await a.setListeningMode('off'), 'off')
  for (const status of [401, 404, 500]) {
    a.fixture({}, status)
    assert.equal(await a.setListeningMode('game'), null)
  }
  a.fixture({}, 200, true)
  assert.equal(await a.setListeningMode('game'), null)
  a.setCiderToken('')
  const count = a.calls.length
  assert.equal(await a.getListeningMode(), null)
  assert.equal(await a.setListeningMode('game'), null)
  assert.equal(a.calls.length, count)
})

test('existing playback and Volume still use authenticated v1 requests', async () => {
  const a = api()
  a.fixture({ volume: 0.72 })
  assert.equal(await a.getVolume(), 0.72)
  assert.equal(await a.setVolume(0.48), true)
  for (const action of ['togglePlayPause', 'previousTrack', 'nextTrack']) assert.equal(await a[action](), true)
  assert.ok(a.calls.every(c => c.url.startsWith('http://127.0.0.1:10767/api/v1/playback/') && c.headers.apptoken === 'test-token'))
  assert.deepEqual(JSON.parse(a.calls[1].body), { volume: 0.48 })
})

function harness() {
  const handlers = {}, draws = [], sliders = [], writes = [], playback = []
  let timer, state = 'off', get = async () => state, patch = async mode => (state = mode), draw = async () => ({ status: 'success' })
  const plugin = {
    on(name, fn) { handlers[name] = fn }, getConfig: async () => ({ ciderToken: 'test-token' }),
    start() {}, transport: { ws: { once() {} } },
    draw: async (serialNumber, key, type, image) => { draws.push({ serialNumber, key, type, image }); return draw(key) },
    setSlider: async (serialNumber, key, value) => { sliders.push({ serialNumber, key, value }); return { status: 'success' } },
  }
  const params = { ...appearance, plugin, logger: { warn() {} }, setCiderToken() {}, testConnection: async () => true,
    getTrackInfo: async () => ({ title: 'test' }), renderNowPlaying: async () => 'data:image/png;base64,fixture',
    getPlaybackProgress: async () => null,
    togglePlayPause: async () => { playback.push('playpause'); return true },
    nextTrack: async () => { playback.push('next'); return true },
    previousTrack: async () => { playback.push('previous'); return true },
    getVolume: async () => 0.72, setVolume: async () => true,
    getListeningMode: () => get(), setListeningMode: mode => { writes.push(mode); return patch(mode) },
    setInterval(callback, ms) {
      assert.ok([1000, 3000].includes(ms))
      if (ms === 3000) { assert.equal(timer, undefined); timer = callback }
      return { unref() {} }
    },
  }
  new Function(...Object.keys(params), source('plugin.js'))(...Object.values(params))
  return { handlers, draws, sliders, writes, playback,
    alive: (keys, serialNumber = 'a') => handlers['plugin.alive']({ serialNumber, keys }),
    click: name => handlers['plugin.data']({ serialNumber: 'a', data: { key: key(name, 1), value: 73 } }),
    tick: async () => { timer(); await settle() },
    state(mode) { state = mode }, get(fn) { get = fn }, patch(fn) { patch = fn }, draw(fn) { draw = fn },
  }
}
function lastDraw(h, name) { return h.draws.findLast(d => d.key.cid === 'com.sonw.cider.' + name) }
function assertMode(h, mode) {
  const index = modes.indexOf(mode)
  assert.equal(lastDraw(h, 'listeningMode').key.title, ['Off', 'Gaming', 'Unwind'][index])
  assert.equal(lastDraw(h, 'listeningMode').key.style.icon, 'mdi mdi-' + icons[index])
  for (let i = 0; i < 3; i++) {
    const d = lastDraw(h, names[i + 1])
    assert.equal(d.type, 'draw')
    assert.equal(d.image, undefined)
    assert.equal(d.key.style.icon, 'mdi mdi-' + icons[i])
    assert.equal(d.key.style.bgColor, i === index ? '#244a66' : '#121212')
  }
}

test('cycle, direct buttons and external state share native icons, labels and active indicators', async () => {
  const h = harness()
  const keys = names.map(key)
  const original = structuredClone(keys)
  await h.alive(keys)
  assertMode(h, 'off')
  for (const mode of ['game', 'antifatigue', 'off']) {
    assert.equal((await h.click('listeningMode')).status, 'success')
    assertMode(h, mode) // No timer tick: update is immediate.
  }
  for (const [i, mode] of modes.entries()) {
    assert.equal((await h.click(names[i + 1])).status, 'success')
    assert.equal(h.writes.at(-1), mode)
    assertMode(h, mode)
  }
  h.state('game'); await h.tick(); assertMode(h, 'game')
  h.state('antifatigue'); await h.tick(); assertMode(h, 'antifatigue')
  const count = h.draws.length
  await h.tick()
  assert.equal(h.draws.length, count, 'unchanged modes should not redraw')
  assert.deepEqual(keys, original, 'native rendering must not mutate the live snapshot')
})

test('rapid cycle presses serialize and each uses the latest Cider state', async () => {
  const h = harness()
  await h.alive(names.map(key))
  h.state('game') // External change just before a click.
  await Promise.all([h.click('listeningMode'), h.click('listeningMode'), h.click('listeningMode')])
  assert.deepEqual(h.writes, ['antifatigue', 'off', 'game'])
  assertMode(h, 'game')
})

test('GET failures retain known mode; unknown starts from off; PATCH failure never fakes success', async () => {
  const h = harness()
  h.get(async () => null)
  await h.alive(names.map(key))
  assert.equal(lastDraw(h, 'listeningMode').key.title, 'Off')
  await h.click('listeningMode')
  assertMode(h, 'game')
  await h.tick()
  assertMode(h, 'game')
  h.patch(async () => null)
  assert.equal((await h.click('listeningModeUnwind')).status, 'error')
  assertMode(h, 'game')
  await h.alive([...names.map(key), key('nowPlaying', 10), key('volume', 11)])
  assert.ok(h.sliders.length && lastDraw(h, 'nowPlaying'))
  for (const control of ['nowPlaying', 'playPause', 'next', 'previous', 'volume']) assert.equal((await h.click(control)).status, 'success')
})

test('an old GET cannot roll back a successful PATCH', async () => {
  const h = harness()
  await h.alive(names.map(key))
  const read = deferred()
  h.get(() => read.promise)
  await h.tick()
  await h.click('listeningModeGaming')
  assertMode(h, 'game')
  read.resolve('off')
  await settle()
  assertMode(h, 'game')
})

test('PATCH returned mode wins and old credentials cannot update the current cache', async () => {
  const h = harness()
  await h.alive(names.map(key))
  h.patch(async () => 'antifatigue')
  await h.click('listeningModeGaming')
  assertMode(h, 'antifatigue')
  const write = deferred()
  h.patch(() => write.promise)
  const click = h.click('listeningModeGaming')
  await settle()
  h.get(async () => 'off')
  await h.handlers['plugin.config.updated']({ config: { ciderToken: 'replacement-fixture-token' } })
  write.resolve('game')
  assert.equal((await click).status, 'error')
  await h.tick()
  assertMode(h, 'off')
})

const layouts = [
  ['listeningMode', 'previous', 'nowPlaying', 'volume'],
  ['volume', 'nowPlaying', 'listeningMode', 'previous'],
  ['listeningModeOff', 'listeningModeGaming', 'listeningModeUnwind', 'nowPlaying'],
  ['previous', 'listeningModeOff', 'nowPlaying', 'listeningModeGaming', 'volume', 'listeningModeUnwind'],
]
test('layouts A/B/C/D replace reused UIDs across all three drawing paths', async () => {
  const h = harness()
  for (const layout of [...layouts, ...layouts.toReversed()]) {
    const keys = layout.map(key)
    h.draws.length = h.sliders.length = 0
    await h.alive(keys)
    for (const mode of modes) { h.state(mode); await h.tick() }
    assert.ok(h.draws.length)
    for (const d of [...h.draws, ...h.sliders]) {
      assert.equal(d.key.cid, keys.find(k => k.uid === d.key.uid)?.cid, JSON.stringify(d))
      if (d.type) assert.equal(d.type, d.key.cid.endsWith('.nowPlaying') ? 'base64' : 'draw')
    }
    for (const name of layout) assert.equal((await h.click(name)).status, 'success')
  }
})

test('other devices survive empty snapshots and a dead event removes Listening Mode keys', async () => {
  const h = harness()
  await h.alive(names.map(key), 'a')
  await h.alive(names.map(key), 'b')
  await h.alive([], 'a')
  h.draws.length = 0
  h.state('game'); await h.tick()
  assert.ok(h.draws.length)
  assert.ok(h.draws.every(d => d.serialNumber === 'b'))
  h.handlers['plugin.dead']({ serialNumber: 'b', keys: names.map(key) })
  h.draws.length = 0
  h.state('off'); await h.tick()
  assert.equal(h.draws.length, 0)
})

test('an awaited native draw cannot continue through a replaced snapshot', async () => {
  const h = harness()
  const held = deferred(), entered = deferred()
  let first = true
  h.draw(async () => { if (first) { first = false; entered.resolve(); await held.promise } })
  const old = h.alive(names.map(key))
  await entered.promise
  h.draws.length = 0
  const latest = [key('previous', 0), key('volume', 1), key('nowPlaying', 2), key('listeningModeGaming', 3)]
  const changed = h.alive(latest)
  await settle()
  held.resolve()
  await Promise.all([old, changed])
  assert.ok(h.draws.length)
  assert.ok(h.draws.every(d => d.key.cid === latest.find(k => k.uid === d.key.uid)?.cid))
})
