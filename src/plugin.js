import { plugin, logger } from "@eniac/flexdesigner"
import { setCiderToken, testConnection, getTrackInfo, togglePlayPause, nextTrack, previousTrack, getVolume, setVolume, getListeningMode, setListeningMode, getPlaybackProgress } from "./musicControl"
import { renderNowPlaying } from "./canvasRenderer"

const activeKeys = new Map()
const activeVolumeKeys = new Map()
const activeListeningModeKeys = new Map()
const listeningControls = new Map([
  ["com.sonw.cider.listeningMode", null],
  ["com.sonw.cider.listeningModeOff", "off"],
  ["com.sonw.cider.listeningModeGaming", "game"],
  ["com.sonw.cider.listeningModeUnwind", "antifatigue"],
])
const listeningVisuals = {
  off: { title: "Off", icon: "mdi mdi-close-box-outline" },
  game: { title: "Gaming", icon: "mdi mdi-gamepad-variant-outline" },
  antifatigue: { title: "Unwind", icon: "mdi mdi-bed-king-outline" },
}
const listeningModeOrder = ["off", "game", "antifatigue"]
let currentListeningMode = null
let listeningToken = ""
let listeningRevision = 0
let listeningRefreshPromise
let listeningRefreshAgain = false
let listeningWriteQueue = Promise.resolve()
let pendingListeningWrites = 0
let configRevision = 0
let refreshPromise
let refreshAgain = false
let renderErrorReported = false
let nowPlayingRevision = 0
let cachedNowPlaying = null
let cachedProgress = null
let metadataRefreshAt = 0
let volumeRefreshPromise
let volumeWritePromise
let pendingVolume = null
let volumeRevision = 0
let volumeWriteAt = 0
let volumeSyncAfter = 0

function keyId(serialNumber, key) {
  return `${serialNumber}:${key.uid}`
}

function applyConfig(config) {
  configRevision++
  cachedNowPlaying = null
  cachedProgress = null
  metadataRefreshAt = 0
  setCiderToken(config?.ciderToken)
  listeningRevision++
  const token = typeof config?.ciderToken === "string" ? config.ciderToken : ""
  if (token !== listeningToken) {
    listeningToken = token
    currentListeningMode = null
    for (const entry of activeListeningModeKeys.values()) entry.visualState = undefined
  }
  volumeRevision++
  pendingVolume = null
  for (const entry of activeVolumeKeys.values()) entry.value = undefined
}

async function loadConfig() {
  const revision = configRevision
  try {
    const config = await plugin.getConfig()
    if (revision === configRevision) applyConfig(config)
  } catch {
    logger.warn("Could not load Cider settings.")
  }
}

async function refreshNowPlaying(refreshMetadata = true) {
  if (refreshMetadata) {
    nowPlayingRevision++
    refreshAgain = true
  }
  // Timer ticks never queue extra work behind a slow API, image, or device.
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    do {
      const forceMetadata = refreshAgain
      refreshAgain = false
      if (!activeKeys.size) break
      const revision = configRevision
      const displayRevision = nowPlayingRevision
      const entries = [...activeKeys]
      const isCurrent = () => revision === configRevision && displayRevision === nowPlayingRevision
      const progress = await getPlaybackProgress()
      if (!isCurrent()) continue
      const trackChanged = progress && (
        (progress.trackId && progress.trackId !== cachedNowPlaying?.trackId) ||
        (cachedProgress && (progress.duration !== cachedProgress.duration || progress.currentTime < cachedProgress.currentTime))
      )
      if (forceMetadata || !cachedNowPlaying || Date.now() >= metadataRefreshAt || trackChanged || (cachedProgress && !progress)) {
        const metadata = await getTrackInfo()
        if (!isCurrent()) continue
        cachedNowPlaying = metadata
        metadataRefreshAt = Date.now() + 3000
      }
      cachedProgress = progress
      const mismatchedTrack = progress?.trackId && cachedNowPlaying.trackId && progress.trackId !== cachedNowPlaying.trackId
      // A track can change between v2 timing and v1 metadata requests.
      if (mismatchedTrack) metadataRefreshAt = 0
      const track = { ...cachedNowPlaying, progress: cachedNowPlaying.isRunning === false || mismatchedTrack ? null : progress }
      const frame = JSON.stringify([track.title, track.artist, track.artwork, track.progress?.currentTime, track.progress?.duration])
      for (const [id, entry] of entries) {
        if (!isCurrent()) break
        if (activeKeys.get(id) !== entry || (!forceMetadata && entry.frame === frame)) continue
        const { serialNumber, key } = entry
        const imageData = await renderNowPlaying(track, key)
        if (!isCurrent() || activeKeys.get(id) !== entry) continue
        const drawKey = {
          ...key,
          style: { ...key.style, showImage: true, showIcon: false, showTitle: false },
        }
        const result = await plugin.draw(serialNumber, drawKey, "base64", imageData)
        if (result?.status !== "error" && isCurrent() && activeKeys.get(id) === entry) entry.frame = frame
      }
      renderErrorReported = false
    } while (refreshAgain)
  })().catch(() => {
    if (!renderErrorReported) logger.warn("Could not update the Cider display.")
    renderErrorReported = true
  }).finally(() => {
    refreshPromise = null
  })
  return refreshPromise
}

async function refreshVolume() {
  if (!activeVolumeKeys.size || volumeWritePromise || Date.now() < volumeSyncAfter) return
  if (volumeRefreshPromise) return volumeRefreshPromise
  const revision = volumeRevision
  volumeRefreshPromise = (async () => {
    const volume = await getVolume()
    if (volume === null || revision !== volumeRevision || volumeWritePromise || Date.now() < volumeSyncAfter) return
    const value = Math.round(volume * 100)
    for (const [id, entry] of activeVolumeKeys) {
      if (revision !== volumeRevision) break
      if (entry.value === value || activeVolumeKeys.get(id) !== entry) continue
      const result = await plugin.setSlider(entry.serialNumber, entry.key, value)
      if (result?.status !== "error" && revision === volumeRevision) entry.value = value
    }
  })().catch(() => {
    // A disconnected device or unavailable Cider is retried on the next refresh.
  }).finally(() => {
    volumeRefreshPromise = null
  })
  return volumeRefreshPromise
}

async function drawListeningMode() {
  const revision = listeningRevision
  for (const [id, entry] of activeListeningModeKeys) {
    if (revision !== listeningRevision) break
    if (activeListeningModeKeys.get(id) !== entry) continue
    const directMode = listeningControls.get(entry.key.cid)
    const mode = directMode ?? currentListeningMode ?? "off"
    const active = directMode !== null && directMode === currentListeningMode
    const visualState = `${mode}:${active}`
    if (entry.visualState === visualState) continue
    const visual = listeningVisuals[mode]
    const drawKey = {
      ...entry.key,
      title: visual.title,
      style: {
        ...entry.key.style,
        icon: visual.icon,
        showImage: false,
        showIcon: true,
        showTitle: true,
        bgColor: active ? "#244a66" : entry.key.style?.bgColor || "#000000",
      },
    }
    try {
      const result = await plugin.draw(entry.serialNumber, drawKey, "draw")
      if (result?.status !== "error" && revision === listeningRevision && activeListeningModeKeys.get(id) === entry) {
        entry.visualState = visualState
      }
    } catch {
      // Retry disconnected keys on the next shared refresh.
    }
  }
}

async function refreshListeningMode() {
  if (!activeListeningModeKeys.size) return
  if (pendingListeningWrites) return drawListeningMode()
  if (listeningRefreshPromise) {
    listeningRefreshAgain = true
    return listeningRefreshPromise
  }
  listeningRefreshPromise = (async () => {
    do {
      listeningRefreshAgain = false
      if (!activeListeningModeKeys.size || pendingListeningWrites) break
      const revision = listeningRevision
      const mode = await getListeningMode()
      if (revision !== listeningRevision) continue
      if (mode !== null) currentListeningMode = mode
      await drawListeningMode()
    } while (listeningRefreshAgain)
  })().catch(() => {
    // A v2 failure must not interrupt playback, artwork, or Volume refreshes.
  }).finally(() => {
    listeningRefreshPromise = null
  })
  return listeningRefreshPromise
}

function changeListeningMode(directMode) {
  const revision = configRevision
  pendingListeningWrites++
  listeningRevision++ // Invalidate a poll that started before this click.
  const operation = listeningWriteQueue.then(async () => {
    if (revision !== configRevision) return false
    let target = directMode
    if (target === null) {
      const mode = await getListeningMode() ?? currentListeningMode ?? "off"
      target = listeningModeOrder[(listeningModeOrder.indexOf(mode) + 1) % listeningModeOrder.length]
    }
    if (revision !== configRevision) return false
    const mode = await setListeningMode(target)
    if (mode === null || revision !== configRevision) return false
    currentListeningMode = mode
    listeningRevision++
    await drawListeningMode()
    return true
  }).catch(() => false).finally(() => {
    pendingListeningWrites--
  })
  // Serialize rapid presses so each cycle starts from the previous result.
  listeningWriteQueue = operation
  return operation
}

function changeVolume(volume) {
  pendingVolume = volume
  volumeRevision++
  for (const entry of activeVolumeKeys.values()) entry.value = undefined
  if (!volumeWritePromise) {
    volumeWritePromise = (async () => {
      let success = false
      try {
        while (pendingVolume !== null) {
          const wait = 75 - (Date.now() - volumeWriteAt)
          if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait))
          if (pendingVolume === null) break
          const value = pendingVolume
          const revision = configRevision
          pendingVolume = null
          volumeWriteAt = Date.now()
          success = await setVolume(value)
          if (revision !== configRevision) success = false
        }
      } finally {
        volumeWritePromise = null
        volumeSyncAfter = Date.now() + 300
      }
      return success
    })()
  }
  return volumeWritePromise
}

plugin.on("plugin.alive", async ({ serialNumber, keys }) => {
  // FlexDesigner reuses numeric UIDs on layout upload without sending plugin.dead.
  // Replace this device's snapshot before any asynchronous render can resume.
  for (const [id, entry] of activeKeys) {
    if (entry.serialNumber === serialNumber) activeKeys.delete(id)
  }
  for (const [id, entry] of activeVolumeKeys) {
    if (entry.serialNumber === serialNumber) activeVolumeKeys.delete(id)
  }
  for (const [id, entry] of activeListeningModeKeys) {
    if (entry.serialNumber === serialNumber) activeListeningModeKeys.delete(id)
  }
  for (const key of keys) {
    if (key.cid === "com.sonw.cider.nowPlaying") {
      activeKeys.set(keyId(serialNumber, key), { serialNumber, key })
    }
    if (key.cid === "com.sonw.cider.volume") {
      activeVolumeKeys.set(keyId(serialNumber, key), { serialNumber, key })
    }
    if (listeningControls.has(key.cid)) {
      activeListeningModeKeys.set(keyId(serialNumber, key), { serialNumber, key })
    }
  }
  await loadConfig()
  await Promise.all([refreshNowPlaying(), refreshVolume(), refreshListeningMode()])
})

plugin.on("plugin.dead", ({ serialNumber, keys }) => {
  for (const key of keys) {
    activeKeys.delete(keyId(serialNumber, key))
    activeVolumeKeys.delete(keyId(serialNumber, key))
    activeListeningModeKeys.delete(keyId(serialNumber, key))
  }
})

plugin.on("plugin.config.updated", async ({ config }) => {
  applyConfig(config)
  await Promise.all([refreshNowPlaying(), refreshVolume(), refreshListeningMode()])
})

plugin.on("ui.message", async (payload) => {
  if (payload?.data !== "cider-test-connection") return { success: false }
  return { success: await testConnection(payload.ciderToken) }
})

plugin.on("plugin.data", async ({ data }) => {
  if (listeningControls.has(data?.key?.cid)) {
    const success = await changeListeningMode(listeningControls.get(data.key.cid))
    return { status: success ? "success" : "error" }
  }
  if (data?.key?.cid === "com.sonw.cider.volume") {
    const raw = data.value
    const value = typeof raw === "number" || (typeof raw === "string" && raw.trim()) ? Number(raw) : NaN
    if (!Number.isFinite(value)) return { status: "error" }
    const success = await changeVolume(Math.max(0, Math.min(100, value)) / 100)
    return { status: success ? "success" : "error" }
  }
  const actions = {
    "com.sonw.cider.nowPlaying": togglePlayPause,
    "com.sonw.cider.playPause": togglePlayPause,
    "com.sonw.cider.next": nextTrack,
    "com.sonw.cider.previous": previousTrack,
  }
  const action = actions[data?.key?.cid]
  if (!action) return { status: "error" }
  const success = await action()
  void refreshNowPlaying()
  return { status: success ? "success" : "error" }
})

setInterval(() => {
  void refreshVolume()
  void refreshListeningMode()
}, 3000).unref()
setInterval(() => { void refreshNowPlaying(false) }, 1000).unref()
plugin.start()
// This SDK can read config only after its WebSocket connection opens.
plugin.transport.ws.once("open", loadConfig)
