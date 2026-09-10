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
</template>

<script>
export default {
  props: { modelValue: { type: Object, required: true } },
  data() {
    return { ciderToken: "", loading: true, busy: false, message: "", messageType: "info" }
  },
  async mounted() {
    try {
      const config = await this.$fd.getConfig()
      this.ciderToken = typeof config?.ciderToken === "string" ? config.ciderToken : ""
    } catch {
      this.message = "Could not load settings. Reopen this page to try again."
      this.messageType = "error"
      return
    }
    this.loading = false
  },
  methods: {
    async saveSettings() {
      this.busy = true
      try {
        const config = { ...await this.$fd.getConfig(), ciderToken: this.ciderToken }
        const result = await this.$fd.setConfig(config)
        if (result?.status === "error") throw new Error("Save failed")
        this.modelValue.config = config
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
