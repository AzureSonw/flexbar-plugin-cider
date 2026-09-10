import { plugin, logger } from "@eniac/flexdesigner"
import { setCiderToken, testConnection, getTrackInfo, togglePlayPause, nextTrack, previousTrack } from "./musicControl"
import { renderNowPlaying } from "./canvasRenderer"

const activeKeys = new Map()
let configRevision = 0
let refreshPromise
let refreshAgain = false
let renderErrorReported = false

function keyId(serialNumber, key) {
  return `${serialNumber}:${key.uid}`
}

function applyConfig(config) {
  configRevision++
  setCiderToken(config?.ciderToken)
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

plugin.on("plugin.alive", async ({ serialNumber, keys }) => {
  for (const key of keys) {
    if (key.cid === "com.sonw.cider.nowPlaying") {
      activeKeys.set(keyId(serialNumber, key), { serialNumber, key })
    }
  }
  await loadConfig()
  await refreshNowPlaying()
})

plugin.on("plugin.dead", ({ serialNumber, keys }) => {
  for (const key of keys) activeKeys.delete(keyId(serialNumber, key))
})

plugin.on("plugin.config.updated", async ({ config }) => {
  applyConfig(config)
  await refreshNowPlaying()
})

plugin.on("ui.message", async (payload) => {
  if (payload?.data !== "cider-test-connection") return { success: false }
  return { success: await testConnection(payload.ciderToken) }
})

plugin.on("plugin.data", async ({ data }) => {
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

setInterval(() => void refreshNowPlaying(), 3000).unref()
plugin.start()
// This SDK can read config only after its WebSocket connection opens.
plugin.ws.once("open", loadConfig)
