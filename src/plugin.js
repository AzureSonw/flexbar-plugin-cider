import { plugin, logger } from "@eniac/flexdesigner"
import { setCiderToken, testConnection, getTrackInfo, togglePlayPause, nextTrack, previousTrack, getVolume, setVolume } from "./musicControl"
import { renderNowPlaying } from "./canvasRenderer"

const activeKeys = new Map()
const activeVolumeKeys = new Map()
let configRevision = 0
let refreshPromise
let refreshAgain = false
let renderErrorReported = false
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
  setCiderToken(config?.ciderToken)
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

async function refreshNowPlaying() {
  if (refreshPromise) {
    refreshAgain = true
    return refreshPromise
  }
  refreshPromise = (async () => {
    do {
      refreshAgain = false
      if (!activeKeys.size) break
      const revision = configRevision
      const track = await getTrackInfo()
      if (revision !== configRevision) continue
      for (const [id, entry] of activeKeys) {
        const { serialNumber, key } = entry
        const imageData = await renderNowPlaying(track, key)
        if (revision !== configRevision || activeKeys.get(id) !== entry) continue
        const drawKey = {
          ...key,
          style: { ...key.style, showImage: true, showIcon: false, showTitle: false },
        }
        await plugin.draw(serialNumber, drawKey, "base64", imageData)
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
  for (const key of keys) {
    if (key.cid === "com.sonw.cider.nowPlaying") {
      activeKeys.set(keyId(serialNumber, key), { serialNumber, key })
    }
    if (key.cid === "com.sonw.cider.volume") {
      activeVolumeKeys.set(keyId(serialNumber, key), { serialNumber, key })
    }
  }
  await loadConfig()
  await Promise.all([refreshNowPlaying(), refreshVolume()])
})

plugin.on("plugin.dead", ({ serialNumber, keys }) => {
  for (const key of keys) {
    activeKeys.delete(keyId(serialNumber, key))
    activeVolumeKeys.delete(keyId(serialNumber, key))
  }
})

plugin.on("plugin.config.updated", async ({ config }) => {
  applyConfig(config)
  await Promise.all([refreshNowPlaying(), refreshVolume()])
})

plugin.on("ui.message", async (payload) => {
  if (payload?.data !== "cider-test-connection") return { success: false }
  return { success: await testConnection(payload.ciderToken) }
})

plugin.on("plugin.data", async ({ data }) => {
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
  void refreshNowPlaying()
  void refreshVolume()
}, 3000).unref()
plugin.start()
// This SDK can read config only after its WebSocket connection opens.
plugin.transport.ws.once("open", loadConfig)
