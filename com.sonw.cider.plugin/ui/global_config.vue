<template>
  <v-card title="Cider Connection">
    <v-card-text>
      <v-text-field
        v-model="ciderToken"
        label="Cider API Token"
        type="password"
        autocomplete="off"
        :disabled="busy || loading"
        @update:model-value="message = ''"
      />
      <v-alert v-if="message" :type="messageType" variant="tonal" class="mb-4">
        {{ message }}
      </v-alert>
      <v-btn :disabled="busy || loading || !ciderToken" @click="testConnection">TEST CONNECTION</v-btn>
      <v-btn class="ml-2" color="primary" :disabled="busy || loading" @click="saveSettings">SAVE SETTINGS</v-btn>
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
    </v-card-text>
  </v-card>
</template>

<script>
export default {
  props: { modelValue: { type: Object, required: true } },
  data() {
    return {
      ciderToken: "", loading: true, busy: false, message: "", messageType: "info",
      showPlayPauseOverlay: true, timelineColor: "#ffffff", fontFamily: "",
      fonts: [], fontsLoading: true, fontMessage: "",
    }
  },
  computed: {
    normalizedColor() {
      const color = typeof this.timelineColor === "string" ? this.timelineColor.trim() : ""
      return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : "#ffffff"
    },
    fontItems() {
      return [{ title: "System Default", value: "" }, ...this.fonts.map(family => ({ title: family, value: family }))]
    },
  },
  async mounted() {
    try {
      const config = await this.$fd.getConfig()
      this.ciderToken = typeof config?.ciderToken === "string" ? config.ciderToken : ""
      this.showPlayPauseOverlay = config?.showPlayPauseOverlay !== false
      this.timelineColor = typeof config?.timelineColor === "string" ? config.timelineColor : "#ffffff"
      this.timelineColor = this.normalizedColor
      this.fontFamily = typeof config?.fontFamily === "string" ? config.fontFamily : ""
    } catch {
      this.message = "Could not load settings. Reopen this page to try again."
      this.messageType = "error"
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
    async saveSettings() {
      this.busy = true
      try {
        const config = {
          ...await this.$fd.getConfig(),
          ciderToken: this.ciderToken,
          showPlayPauseOverlay: this.showPlayPauseOverlay !== false,
          timelineColor: this.normalizedColor,
          fontFamily: this.fontsLoading || this.fonts.includes(this.fontFamily) ? this.fontFamily : "",
        }
        const result = await this.$fd.setConfig(config)
        if (result?.status === "error") throw new Error("Save failed")
        this.modelValue.config = config
        this.timelineColor = config.timelineColor
        this.message = "Settings saved"
        this.messageType = "success"
      } catch {
        this.message = "Could not save settings"
        this.messageType = "error"
      } finally {
        this.busy = false
      }
    },
    async testConnection() {
      this.busy = true
      try {
        const result = await this.$fd.sendToBackend({ data: "cider-test-connection", ciderToken: this.ciderToken })
        this.message = result?.success ? "Connected to Cider" : "Connection failed / invalid token"
        this.messageType = result?.success ? "success" : "error"
      } catch {
        this.message = "Connection failed / invalid token"
        this.messageType = "error"
      } finally {
        this.busy = false
      }
    },
  },
}
</script>
