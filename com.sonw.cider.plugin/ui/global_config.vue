<template>
  <v-card title="Cider Connection">
    <v-card-text>
      <v-text-field
        v-model="ciderToken"
        label="Cider API Token"
        type="password"
        autocomplete="off"
        :disabled="busy || loading"
        @update:model-value="connectionMessage = ''"
      />
      <v-alert v-if="connectionMessage" :type="connectionMessageType" variant="tonal" class="mb-4">
        {{ connectionMessage }}
      </v-alert>
      <v-btn :disabled="busy || loading || !ciderToken" @click="testConnection">TEST CONNECTION</v-btn>
      <v-btn class="ml-2" color="primary" :disabled="busy || loading" @click="saveConnectionSettings">SAVE TOKEN</v-btn>
    </v-card-text>
  </v-card>
  <v-card title="Now Playing Appearance" class="mt-4">
    <v-card-text>
      <v-switch
        v-model="showPlayPauseOverlay"
        label="Show Play/Pause Overlay"
        color="primary"
        inset
        hide-details
        class="mb-4"
        :disabled="busy || loading"
      />
      <v-switch
        v-model="autoHidePlayPauseOverlay"
        label="Auto-hide Play/Pause Overlay"
        color="primary"
        inset
        hide-details
        class="mb-4"
        :disabled="busy || loading || !showPlayPauseOverlay"
      />
      <v-text-field
        v-model="playPauseOverlayHideDelaySeconds"
        label="Hide Overlay After"
        type="number"
        min="1"
        max="30"
        step="1"
        suffix="seconds"
        hint="1–30 seconds. Invalid values use 3 seconds."
        persistent-hint
        class="mb-4"
        :disabled="busy || loading || !showPlayPauseOverlay || !autoHidePlayPauseOverlay"
      />
      <v-menu :close-on-content-click="false">
        <template v-slot:activator="{ props: menuProps }">
          <v-text-field
            v-bind="menuProps"
            v-model="timelineColor"
            label="Timeline Color"
            hint="Played portion only. Use a color such as #FFFFFF."
            persistent-hint
            :disabled="busy || loading"
            class="mb-4"
          >
            <template v-slot:prepend-inner>
              <span :style="{ backgroundColor: normalizedColor, width: '20px', height: '20px', borderRadius: '4px', border: '1px solid #888', display: 'inline-block' }" />
            </template>
          </v-text-field>
        </template>
        <v-color-picker
          :model-value="normalizedColor"
          @update:model-value="timelineColor = $event"
          mode="hex"
          :modes="['hex']"
          :disabled="busy || loading"
        />
      </v-menu>
      <v-autocomplete
        v-model="fontFamily"
        :items="fontItems"
        item-title="title"
        item-value="value"
        label="Now Playing Font"
        :loading="fontsLoading"
        :disabled="busy || loading || fontsLoading"
        :hint="fontMessage || 'Applies to the song title and artist.'"
        persistent-hint
        no-data-text="No matching fonts"
      />
      <v-text-field
        v-model="fontSize"
        label="Now Playing Font Size"
        type="number"
        min="12"
        max="30"
        step="1"
        suffix="px"
        clearable
        class="mt-4"
        :disabled="busy || loading"
        hint="Title size: 12–30 px. The artist line adapts to fit. Leave empty to use the key's font size."
        persistent-hint
      />
      <v-alert v-if="appearanceMessage" :type="appearanceMessageType" variant="tonal" class="mt-4">
        {{ appearanceMessage }}
      </v-alert>
      <v-btn class="mt-4" color="primary" :disabled="busy || loading" @click="saveAppearanceSettings">SAVE APPEARANCE</v-btn>
    </v-card-text>
  </v-card>
</template>

<script>
export default {
  props: { modelValue: { type: Object, required: true } },
  data() {
    return {
      ciderToken: "", loading: true, busy: false,
      connectionMessage: "", connectionMessageType: "info",
      appearanceMessage: "", appearanceMessageType: "info",
      showPlayPauseOverlay: true, timelineColor: "#ffffff", fontFamily: "", fontSize: null,
      autoHidePlayPauseOverlay: false, playPauseOverlayHideDelaySeconds: 3,
      fonts: [], fontsLoading: true, fontMessage: "",
    }
  },
  computed: {
    normalizedOverlayDelay() {
      const value = this.playPauseOverlayHideDelaySeconds
      const delay = typeof value === "number" || typeof value === "string" ? Number(value) : NaN
      return Number.isInteger(delay) && delay >= 1 && delay <= 30 ? delay : 3
    },
    normalizedColor() {
      const color = typeof this.timelineColor === "string" ? this.timelineColor.trim() : ""
      return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : "#ffffff"
    },
    fontItems() {
      return [{ title: "System Default", value: "" }, ...this.fonts.map(family => ({ title: family, value: family }))]
    },
    normalizedFontSize() {
      const size = typeof this.fontSize === "number" || typeof this.fontSize === "string" ? Number(this.fontSize) : NaN
      return Number.isInteger(size) && size >= 12 && size <= 30 ? size : null
    },
  },
  async mounted() {
    try {
      const config = await this.$fd.getConfig()
      this.ciderToken = typeof config?.ciderToken === "string" ? config.ciderToken : ""
      this.showPlayPauseOverlay = config?.showPlayPauseOverlay !== false
      this.autoHidePlayPauseOverlay = config?.autoHidePlayPauseOverlay === true
      const delay = config?.playPauseOverlayHideDelaySeconds
      this.playPauseOverlayHideDelaySeconds = Number.isInteger(delay) && delay >= 1 && delay <= 30 ? delay : 3
      this.timelineColor = typeof config?.timelineColor === "string" ? config.timelineColor : "#ffffff"
      this.timelineColor = this.normalizedColor
      this.fontFamily = typeof config?.fontFamily === "string" ? config.fontFamily : ""
      this.fontSize = config?.fontSize
      this.fontSize = this.normalizedFontSize
    } catch {
      this.connectionMessage = this.appearanceMessage = "Could not load settings. Reopen this page to try again."
      this.connectionMessageType = this.appearanceMessageType = "error"
      return
    }
    this.loading = false
    await this.loadFonts()
  },
  methods: {
    async loadFonts() {
      try {
        const result = await this.$fd.sendToBackend({ data: "cider-list-fonts" })
        if (!result?.success || !Array.isArray(result.fonts)) throw new Error("Font list unavailable")
        this.fonts = [...new Set(result.fonts.filter(font => typeof font === "string" && font.trim()))]
          .sort((a, b) => a.localeCompare(b))
        if (this.fontFamily && !this.fonts.includes(this.fontFamily)) {
          this.fontFamily = ""
          this.fontMessage = "The saved font is unavailable. Using System Default."
        }
      } catch {
        this.fontFamily = ""
        this.fontMessage = "Could not load fonts. System Default is available. Reopen this page to retry."
      } finally {
        this.fontsLoading = false
      }
    },
    async saveConnectionSettings() {
      await this.persistSettings({ ciderToken: this.ciderToken }, "connection")
    },
    async saveAppearanceSettings() {
      const saved = await this.persistSettings({
        showPlayPauseOverlay: this.showPlayPauseOverlay !== false,
        autoHidePlayPauseOverlay: this.autoHidePlayPauseOverlay === true,
        playPauseOverlayHideDelaySeconds: this.normalizedOverlayDelay,
        timelineColor: this.normalizedColor,
        fontFamily: this.fontsLoading || this.fonts.includes(this.fontFamily) ? this.fontFamily : "",
        fontSize: this.normalizedFontSize,
      }, "appearance")
      if (saved) {
        this.timelineColor = saved.timelineColor
        this.fontSize = saved.fontSize
        this.playPauseOverlayHideDelaySeconds = saved.playPauseOverlayHideDelaySeconds
      }
    },
    async persistSettings(patch, section) {
      if (this.busy || this.loading) return null
      this.busy = true
      try {
        const latest = await this.$fd.getConfig()
        const config = { ...latest, ...patch }
        const changed = Object.keys(patch).some(key => JSON.stringify(latest?.[key]) !== JSON.stringify(patch[key]))
        if (changed) {
          const result = await this.$fd.setConfig(config)
          if (result?.status === "error") throw new Error("Save failed")
          this.modelValue.config = config
        }
        this[`${section}Message`] = section === "connection" ? "Token saved" : "Appearance saved"
        this[`${section}MessageType`] = "success"
        return config
      } catch {
        this[`${section}Message`] = section === "connection" ? "Could not save token" : "Could not save appearance"
        this[`${section}MessageType`] = "error"
        return null
      } finally {
        this.busy = false
      }
    },
    async testConnection() {
      this.busy = true
      try {
        const result = await this.$fd.sendToBackend({ data: "cider-test-connection", ciderToken: this.ciderToken })
        this.connectionMessage = result?.success ? "Connected to Cider" : "Connection failed / invalid token"
        this.connectionMessageType = result?.success ? "success" : "error"
      } catch {
        this.connectionMessage = "Connection failed / invalid token"
        this.connectionMessageType = "error"
      } finally {
        this.busy = false
      }
    },
  },
}
</script>
