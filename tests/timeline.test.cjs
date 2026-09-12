const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { Canvas: NativeCanvas, loadImage } = require('skia-canvas')
const { appearance, renderer } = require('./support.cjs')
const source = name => fs.readFileSync(path.join(__dirname, '../src', name), 'utf8').replace(/^import .*\r?\n/gm, '')
const render = renderer()
const key = (name, uid, width = 480) => ({ uid, cid: 'com.sonw.cider.' + name, width, style: { width, iconSize: 42, fontSize: 24 }, cfg: { keyType: name === 'volume' ? 'slider' : 'default' } })
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const settle = async () => { for (let i = 0; i < 20; i++) await new Promise(resolve => setImmediate(resolve)) }
const info = id => ({ name: 'Track ' + id, artistName: 'Artist', playParams: { id }, artwork: { url: 'https://example.invalid/cover/{w}x{h}.{f}' } })

function api() {
  const calls = []
  let body = { data: { time: { currentTime: 25, duration: 100 }, state: 'playing', nowPlaying: info('a') } }, status = 200, fails = false, track = info('a')
  const fetch = async (url, options) => {
    calls.push({ url, ...options })
    if (fails) throw Error('offline')
    if (url.startsWith('https://example.invalid/')) return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } })
    if (url.endsWith('/api/v1/playback/now-playing')) return new Response(JSON.stringify({ info: track }))
    return new Response(status === 204 ? null : typeof body === 'string' ? body : JSON.stringify(body), { status })
  }
  const methods = new Function('fetch', source('musicControl.js').replace(/export /g, '') + '\nreturn {setCiderToken,getPlaybackProgress,getTrackInfo}')(fetch)
  methods.setCiderToken('fixture-token')
  return { ...methods, calls, fixture(value, code = 200, error = false) { body = value; status = code; fails = error }, track(value) { track = value } }
}

test('playback timing uses authenticated v2 snapshots, seconds, state, and matching v1 track identity', async () => {
  const a = api()
  for (const state of ['playing', 'paused', 'stopped']) {
    for (const nested of [false, true]) {
      const snapshot = { time: { currentTime: 62.4, duration: 240, remaining: 177.6 }, state, nowPlaying: info('a') }
      a.fixture(nested ? { data: snapshot } : snapshot)
      assert.deepEqual(await a.getPlaybackProgress(), { currentTime: 62.4, duration: 240, state, trackId: 'a' })
    }
  }
  assert.ok(a.calls.every(call => call.url === 'http://127.0.0.1:10767/api/v2/playback' && call.method === 'GET' && call.headers.apptoken === 'fixture-token' && call.signal instanceof AbortSignal && call.body === undefined))
  assert.equal((await a.getTrackInfo()).trackId, 'a')
  const stream = { name: 'Live', artistName: 'Station', albumName: 'Radio' }
  a.track(stream); a.fixture({ time: { currentTime: 1, duration: 100 }, nowPlaying: stream })
  assert.equal((await a.getPlaybackProgress()).trackId, (await a.getTrackInfo()).trackId)
})

test('invalid/offline/no-song timing is hidden and finite out-of-range positions clamp safely', async () => {
  const a = api()
  for (const value of [null, false, '', '12', {}, [], undefined]) {
    a.fixture({ time: { currentTime: value, duration: 100 } }); assert.equal(await a.getPlaybackProgress(), null)
    a.fixture({ time: { currentTime: 0, duration: value } }); assert.equal(await a.getPlaybackProgress(), null)
  }
  for (const duration of [0, -1]) { a.fixture({ time: { currentTime: 0, duration } }); assert.equal(await a.getPlaybackProgress(), null) }
  for (const [body, code, failure] of [[{},200], ['invalid JSON',200], [{},204], [{},401], [{},500], [{},200,true], [{ time: { currentTime: 0, duration: 100 }, nowPlaying: null },200]]) {
    a.fixture(body, code, failure); assert.equal(await a.getPlaybackProgress(), null)
  }
  for (const [currentTime, expected] of [[-1,0],[999,100]]) {
    a.fixture({ time: { currentTime, duration: 100 } }); assert.equal((await a.getPlaybackProgress()).currentTime, expected)
  }
  a.setCiderToken(''); const count = a.calls.length
  assert.equal(await a.getPlaybackProgress(), null); assert.equal(a.calls.length, count)
})

test('timeline pixels follow the real cover and runtime width at every requested progress value', async () => {
  const widths = [1, 2, 7, 8, 16, 59, 60, 64, 65, 66, 68, 120, 148, 149, 150, 180, 240, 300, 480, 600, 800]
  for (const width of widths) {
    for (const percent of [0, 1, 25, 50, 75, 99, 100]) {
      const image = await loadImage(await render({ title: '', artist: '', progress: { currentTime: percent, duration: 100 } }, key('nowPlaying', 1, width)))
      assert.equal(image.width, width); assert.equal(image.height, 60)
      const canvas = new NativeCanvas(width, 60); canvas.gpu = false
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0)
      const row = context.getImageData(0, 50, width, 1).data
      const coverRow = context.getImageData(0, 30, width, 1).data
      const coverPixels = []
      for (let x = 0; x < width; x++) if (coverRow[x * 4] === 51 && coverRow[x * 4 + 1] === 51) coverPixels.push(x)
      const start = (coverPixels.at(-1) ?? 0) + 46
      const barWidth = width - 45 - start
      const trackPixels = []
      for (let x = 0; x < width; x++) if (row[x * 4] > 51 && row[x * 4 + 1] === row[x * 4]) trackPixels.push(x)
      if (barWidth > 0) {
        if (width >= 68) assert.equal(start, 104)
        assert.equal(trackPixels[0], start)
        assert.equal(trackPixels.at(-1), width - 46)
        for (let x = start; x < width - 45; x++) {
          const relative = x - start, played = barWidth * percent / 100
          if (relative + 1 <= played) assert.equal(row[x * 4], 255)
          if (relative >= played) assert.equal(row[x * 4], 64)
        }
        assert.deepEqual(context.getImageData(start, 52, barWidth, 1).data, context.getImageData(start, 50, barWidth, 1).data)
        assert.deepEqual([...context.getImageData(width - 45, 50, 45, 3).data].filter((_, i) => i % 4 !== 3), Array(405).fill(0))
        assert.deepEqual([...context.getImageData(start, 53, barWidth, 1).data].filter((_, i) => i % 4 !== 3), Array(barWidth * 3).fill(0))
      } else assert.equal(trackPixels.length, 0, 'insufficient width must hide the timeline')
    }
  }
})

test('timeline geometry uses smaller saved cover sizes and invalid progress never draws a track', async () => {
  const rects = [], text = []
  class Canvas extends NativeCanvas {
    getContext(type) {
      const context = super.getContext(type)
      return new Proxy(context, {
        set(target, name, value) { target[name] = value; return true },
        get(target, name) {
          if (name === 'fillRect') return (x,y,w,h) => { rects.push({ x,y,w,h,color:target.fillStyle }); target.fillRect(x,y,w,h) }
          if (name === 'fillText') return (value,x,y) => { text.push({ value,x,y,align:target.textAlign }); target.fillText(value,x,y) }
          const value = target[name]; return typeof value === 'function' ? value.bind(target) : value
        },
      })
    }
  }
  const draw = renderer(Canvas)
  for (const [iconSize, start, center] of [[24,86,257],[42,104,266],[60,104,275]]) {
    rects.length = text.length = 0
    await draw({ title:'Title',artist:'Artist',progress:{ currentTime:50,duration:100 } }, { width:480, style:{ width:480,iconSize } })
    assert.deepEqual(rects.filter(r => r.y === 50), [{x:start,y:50,w:435-start,h:3,color:'#404040'}, {x:start,y:50,w:(435-start)/2,h:3,color:'#ffffff'}])
    assert.deepEqual(text.filter(t => t.value !== '♪').map(t => [t.x,t.y,t.align]), [[center,15,'center'],[center,34,'center']])
  }
  for (const progress of [null, {}, {currentTime:NaN,duration:100}, {currentTime:Infinity,duration:100}, {currentTime:1,duration:Infinity}, {currentTime:1,duration:0}]) {
    rects.length = 0; await draw({ title:'Title',progress }, key('nowPlaying',1)); assert.equal(rects.filter(r => r.y === 50).length, 0)
  }
  for (const [currentTime, expected] of [[-5,0],[1000,331]]) {
    rects.length = 0; await draw({title:'',progress:{currentTime,duration:100}},key('nowPlaying',1))
    assert.equal(rects.filter(r => r.y === 50 && r.color === '#ffffff')[0]?.w ?? 0, expected)
  }
  text.length = 0; await draw({title:'Solo'},key('nowPlaying',1))
  assert.equal(text.find(t => t.value === 'Solo').y,26)
})

function harness(options = {}) {
  const handlers = {}, draws = [], timers = new Map(), counters = { progress:0, metadata:0, render:0, volume:0, modes:0, actions:[] }
  let time = 0, track = { title:'Track a',artist:'Artist',artwork:'cached-art',isRunning:true,trackId:'a' }, progress = {currentTime:0,duration:100,state:'playing',trackId:'a'}
  const plugin = {
    on(name, fn) { handlers[name] = fn }, getConfig:async () => ({ciderToken:'fixture-token'}), start() {}, transport:{ws:{once(){}}},
    draw:async (serialNumber,key,type,image) => { draws.push({serialNumber,key,type,image}); return options.draw?.() ?? {status:'success'} },
    setSlider:async () => ({status:'success'}),
  }
  const params = { ...appearance, plugin,logger:{warn(){}},setCiderToken(){},testConnection:async()=>true,
    getTrackInfo:async()=>{ counters.metadata++; return options.metadata ? options.metadata() : {...track} },
    getPlaybackProgress:async()=>{ counters.progress++; return options.progress ? options.progress() : progress && {...progress} },
    renderNowPlaying:async(t,k,settings)=>{ counters.render++; return options.render ? options.render(t,k,settings) : JSON.stringify({track:t,width:k.width,settings}) },
    getVolume:async()=>{ counters.volume++; return 0.5 },setVolume:async()=>true,
    getListeningMode:async()=>{ counters.modes++; return 'off' },setListeningMode:async mode=>mode,
    togglePlayPause:async()=>{ counters.actions.push('playpause'); return true },nextTrack:async()=>{ counters.actions.push('next'); return true },previousTrack:async()=>{ counters.actions.push('previous'); return true },
    Date:class extends Date { static now() { return time } },
    setInterval(fn, ms) { assert.ok([1000,3000].includes(ms)); assert.ok(!timers.has(ms)); timers.set(ms,fn); return {unref(){}} },
  }
  const runtime = new Function(...Object.keys(params),source('plugin.js') + '\nreturn {idle:()=>refreshPromise}')( ...Object.values(params))
  return { handlers,draws,counters,timers,options, setProgress(value){progress=value},setTrack(value){track=value},last:()=>JSON.parse(draws.filter(d=>d.type==='base64').at(-1).image),
    alive:(keys,serialNumber='device')=>handlers['plugin.alive']({serialNumber,keys}),
    tick:async()=>{ time+=1000; timers.get(1000)(); await runtime.idle() },
    timer:()=>{time+=1000; timers.get(1000)()}, idle:runtime.idle,
    click:name=>handlers['plugin.data']({data:{key:key(name,1)}}),
  }
}

test('one-second timing preserves pause/resume, refreshes metadata every three seconds, and leaves other polling alone', async () => {
  const h = harness()
  await h.alive([key('nowPlaying',1),key('volume',2),key('listeningMode',3)])
  h.draws.length = 0
  for (const currentTime of [1,2,3]) { h.setProgress({currentTime,duration:100,state:'playing',trackId:'a'}); await h.tick() }
  assert.equal(h.last().track.progress.currentTime,3)
  assert.equal(h.counters.metadata,2); assert.equal(h.counters.progress,4)
  assert.equal(h.counters.volume,1); assert.equal(h.counters.modes,1)
  h.setProgress({currentTime:3,duration:100,state:'paused',trackId:'a'})
  const count = h.draws.length
  for (let i=0;i<4;i++) await h.tick()
  assert.equal(h.draws.length,count+1,'pause changes the overlay once; repeated paused snapshots should not redraw')
  h.setProgress({currentTime:4,duration:100,state:'playing',trackId:'a'}); await h.tick()
  assert.equal(h.last().track.progress.currentTime,4)
  for (const [name,action] of [['nowPlaying','playpause'],['playPause','playpause'],['next','next'],['previous','previous']]) {
    assert.equal((await h.click(name)).status,'success'); await h.idle(); assert.equal(h.counters.actions.at(-1),action)
  }
})

test('one-second redraws reuse cached artwork and avoid extra metadata/artwork requests', async () => {
  const a = api(), h = harness({metadata:a.getTrackInfo,progress:a.getPlaybackProgress})
  await h.alive([key('nowPlaying',1)])
  for (let currentTime=1;currentTime<=9;currentTime++) {
    a.fixture({time:{currentTime,duration:100},state:'playing',nowPlaying:info('a')}); await h.tick()
  }
  assert.equal(a.calls.filter(c=>c.url.startsWith('https://')).length,1)
  assert.equal(a.calls.filter(c=>c.url.endsWith('/api/v1/playback/now-playing')).length,4)
  assert.equal(a.calls.filter(c=>c.url.endsWith('/api/v2/playback')).length,10)
})

test('track changes, endings, offline recovery, and invalid duration never reuse another track progress', async () => {
  const h = harness(); await h.alive([key('nowPlaying',1)])
  for (const [id,currentTime,duration] of [['a',100,100],['b',0,200],['b',1,200],['a',0,100]]) {
    h.setTrack({title:'Track '+id,trackId:id,isRunning:true}); h.setProgress({currentTime,duration,state:'playing',trackId:id}); await h.tick()
    assert.equal(h.last().track.title,'Track '+id); assert.equal(h.last().track.progress.currentTime,currentTime); assert.equal(h.last().track.progress.duration,duration)
  }
  h.setTrack({title:'Cider Offline',isRunning:false}); h.setProgress(null); await h.tick()
  assert.equal(h.last().track.progress,null); assert.equal(h.last().track.title,'Cider Offline')
  h.setTrack({title:'Track c',trackId:'c',isRunning:true}); h.setProgress({currentTime:0,duration:300,state:'playing',trackId:'c'}); await h.tick()
  assert.equal(h.last().track.title,'Track c'); assert.equal(h.last().track.progress.currentTime,0)
  // A track changed between timing and metadata requests: display no mixed timeline.
  h.setTrack({title:'Track d',trackId:'d',isRunning:true}); h.setProgress({currentTime:0,duration:400,state:'playing',trackId:'e'}); await h.tick()
  assert.equal(h.last().track.progress,null)
  h.setProgress({currentTime:1,duration:400,state:'playing',trackId:'d'}); await h.tick()
  assert.equal(h.last().track.progress.currentTime,1)
})

test('slow timing requests coalesce timer ticks and never draw a replaced UID or width', async () => {
  const h=harness(); await h.alive([key('nowPlaying',1,800)])
  const gate=deferred(); h.options.progress=()=>gate.promise; h.draws.length=0
  const before=h.counters.progress; h.timer(); for(let i=0;i<20;i++) h.timer()
  assert.equal(h.counters.progress,before+1)
  const replacement=h.alive([key('previous',1),key('nowPlaying',2,300)])
  await settle(); h.options.progress=undefined; gate.resolve({currentTime:1,duration:100,state:'playing',trackId:'a'})
  await replacement; await h.idle()
  assert.ok(h.draws.length); assert.ok(h.draws.every(d=>d.key.uid===2 && d.key.width===300))
})

test('an in-flight timeline image cannot outlive config or layout changes', async () => {
  const h=harness(); await h.alive([key('nowPlaying',1,800)])
  const gate=deferred(), entered=deferred(); h.options.render=async(t,k)=>{entered.resolve(); await gate.promise; return JSON.stringify({track:t,width:k.width})}
  h.setProgress({currentTime:1,duration:100,state:'playing',trackId:'a'}); h.draws.length=0
  const pending=h.tick(); await entered.promise
  const replacement=h.alive([key('previous',1),key('nowPlaying',3,600)])
  await settle(); h.options.render=undefined; gate.resolve(); await Promise.all([pending,replacement])
  assert.ok(h.draws.every(d=>d.key.uid===3 && d.key.width===600))
  const waiting=deferred(); h.options.progress=()=>waiting.promise; h.draws.length=0
  h.timer(); const changed=h.handlers['plugin.config.updated']({config:{ciderToken:'new-fixture'}})
  h.options.progress=async()=>null; waiting.resolve({currentTime:90,duration:100,state:'playing',trackId:'a'}); await changed
  assert.ok(h.draws.length); assert.ok(h.draws.every(d=>JSON.parse(d.image).track.progress===null))
})

test('layouts A/B/C at all required widths keep timeline updates on current live keys', async () => {
  const h=harness(), layouts=[['previous','nowPlaying','next','volume'],['volume','nowPlaying','listeningMode','previous'],['nowPlaying','listeningModeOff','listeningModeGaming','listeningModeUnwind','volume']]
  for(const width of [300,480,600,800]) for(const layout of [...layouts,...layouts.toReversed()]) {
    const keys=layout.map((name,i)=>key(name,i+1,name==='nowPlaying'?width:120)); h.draws.length=0
    await h.alive(keys); await h.tick()
    const expected=keys.find(k=>k.cid.endsWith('.nowPlaying'))
    for(const d of h.draws.filter(d=>d.type==='base64')) { assert.equal(d.key.uid,expected.uid); assert.equal(JSON.parse(d.image).width,width) }
    assert.ok(h.draws.some(d=>d.type==='base64'))
  }
  await h.alive([key('nowPlaying',7,300)],'other')
  await h.alive([]); h.draws.length=0; h.setProgress({currentTime:1,duration:100,state:'playing',trackId:'a'}); await h.tick()
  assert.ok(h.draws.length); assert.ok(h.draws.every(d=>d.serialNumber==='other'))
  await h.handlers['plugin.dead']({serialNumber:'other',keys:[key('nowPlaying',7,300)]})
  h.draws.length=0; const before={...h.counters}; await h.tick()
  assert.equal(h.counters.progress,before.progress); assert.equal(h.counters.metadata,before.metadata); assert.equal(h.counters.render,before.render)
})

test('appearance saves redraw current keys immediately from cached playback without extra API requests', async () => {
  const h=harness();await h.alive([key('nowPlaying',1),key('volume',2),key('listeningMode',3)])
  const config={ciderToken:'fixture-token'}
  for(const update of [{showPlayPauseOverlay:false},{timelineColor:'#ff0000'},{fontFamily:appearance.getAvailableFontFamilies()[0]},{showPlayPauseOverlay:true}]) {
    Object.assign(config,update)
    const calls={progress:h.counters.progress,metadata:h.counters.metadata,volume:h.counters.volume,modes:h.counters.modes}
    h.draws.length=0
    await h.handlers['plugin.config.updated']({config})
    assert.equal(h.draws.length,1);assert.equal(h.draws[0].key.uid,1)
    assert.deepEqual(h.last().settings,appearance.normalizeAppearance(config))
    assert.deepEqual({progress:h.counters.progress,metadata:h.counters.metadata,volume:h.counters.volume,modes:h.counters.modes},calls)
    const count=h.draws.length;await h.handlers['plugin.config.updated']({config});await h.tick()
    assert.equal(h.draws.length,count,'saving unchanged appearance must not continuously redraw')
  }
})

test('equal-time state changes invalidate frames and Now Playing clicks work in all overlay/state combinations', async () => {
  const h=harness();await h.alive([key('nowPlaying',1)])
  for(const showPlayPauseOverlay of [true,false]) {
    await h.handlers['plugin.config.updated']({config:{ciderToken:'fixture-token',showPlayPauseOverlay}})
    for(const state of ['playing','paused','stopped','invalid',undefined]) {
      h.setProgress({currentTime:0,duration:100,state,trackId:'a'})
      await h.tick()
      assert.equal(h.last().track.progress.state,state)
      const count=h.draws.length;await h.tick();assert.equal(h.draws.length,count)
      const clicks=h.counters.actions.length
      assert.equal((await h.click('nowPlaying')).status,'success');await h.idle()
      assert.equal(h.counters.actions.length,clicks+1);assert.equal(h.counters.actions.at(-1),'playpause')
    }
  }
  assert.equal((await h.click('playPause')).status,'success');await h.idle()
})

test('font command returns only available families and keeps connection testing independent', async () => {
  const h=harness()
  assert.deepEqual(await h.handlers['ui.message']({data:'cider-list-fonts'}),{success:true,fonts:appearance.getAvailableFontFamilies()})
  assert.deepEqual(await h.handlers['ui.message']({data:'cider-test-connection',ciderToken:'fixture-token',timelineColor:'invalid'}),{success:true})
  assert.equal(h.counters.progress,0);assert.equal(h.counters.metadata,0)
})

test('appearance redraw cannot send an old in-flight frame to reused layout UIDs', async () => {
  const h=harness();await h.alive([key('nowPlaying',1,800)])
  const entered=deferred(),gate=deferred()
  h.options.render=async(t,k,settings)=>{entered.resolve();await gate.promise;return JSON.stringify({track:t,width:k.width,settings})}
  h.draws.length=0
  const saving=h.handlers['plugin.config.updated']({config:{ciderToken:'fixture-token',showPlayPauseOverlay:false,timelineColor:'#0088ff'}})
  await entered.promise
  const replaced=h.alive([key('previous',1),key('volume',2),key('nowPlaying',3,300)])
  h.options.render=undefined;gate.resolve();await Promise.all([saving,replaced])
  assert.ok(h.draws.length);assert.ok(h.draws.every(d=>d.key.uid===3&&d.key.width===300))
  for(const update of [{showPlayPauseOverlay:false},{timelineColor:'#00ff88'},{fontFamily:appearance.getAvailableFontFamilies()[0]}]) {
    h.draws.length=0
    await h.handlers['plugin.config.updated']({config:{ciderToken:'fixture-token',...update}})
    assert.ok(h.draws.length);assert.ok(h.draws.every(d=>d.key.uid===3))
  }
  await h.alive([]);h.draws.length=0
  await h.handlers['plugin.config.updated']({config:{ciderToken:'fixture-token',timelineColor:'#ff0000'}})
  assert.equal(h.draws.length,0)
})

test('an appearance save invalidates an older polling snapshot and uses only its queued cached redraw', async () => {
  const h=harness();await h.alive([key('nowPlaying',1)])
  const gate=deferred();h.options.progress=()=>gate.promise
  h.draws.length=0;h.timer()
  const before=h.counters.progress
  const saving=h.handlers['plugin.config.updated']({config:{ciderToken:'fixture-token',showPlayPauseOverlay:false}})
  h.options.progress=undefined;gate.resolve({currentTime:99,duration:100,state:'playing',trackId:'a'})
  await saving
  assert.equal(h.counters.progress,before);assert.equal(h.draws.length,1)
  assert.equal(h.last().settings.showPlayPauseOverlay,false);assert.equal(h.last().track.progress.currentTime,0)
})
