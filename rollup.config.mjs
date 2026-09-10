import commonjs from "@rollup/plugin-commonjs"
import nodeResolve from "@rollup/plugin-node-resolve"
import json from "@rollup/plugin-json"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.dirname(fileURLToPath(import.meta.url))
const pluginRoot = path.join(root, "com.sonw.cider.plugin")
const backend = path.join(pluginRoot, "backend")
const isWatching = !!process.env.ROLLUP_WATCH
const nativeModule = path.join(root, "node_modules/skia-canvas/lib/skia.node")

function thirdPartyNotices(moduleIds) {
  const packages = new Map()
  for (const id of moduleIds) {
    if (!id.includes("node_modules") || id.includes("\0") || !path.isAbsolute(id)) continue
    let directory = path.dirname(id)
    while (directory.startsWith(root) && !fs.existsSync(path.join(directory, "package.json"))) {
      directory = path.dirname(directory)
    }
    if (!directory.includes("node_modules") || packages.has(directory)) continue
    const metadata = JSON.parse(fs.readFileSync(path.join(directory, "package.json"), "utf8"))
    const licenseFile = fs.readdirSync(directory).find(name => /^licen[cs]e(\..*)?$/i.test(name))
    packages.set(directory, `${metadata.name} ${metadata.version} (${metadata.license || "see package"})\n` +
      (licenseFile ? fs.readFileSync(path.join(directory, licenseFile), "utf8") : metadata.homepage || ""))
  }
  return [...packages.values()].sort().join("\n\n----------------------------------------\n\n") + "\n"
}

export default {
  input: "src/plugin.js",
  output: {
    file: "com.sonw.cider.plugin/backend/plugin.cjs",
    format: "cjs",
    sourcemap: isWatching,
    paths: id => id === nativeModule ? "./skia.node" : id,
  },
  plugins: [
    {
      name: "clean-runtime",
      buildStart() {
        if (path.dirname(backend) !== pluginRoot || !pluginRoot.startsWith(root + path.sep)) throw new Error("Invalid build path")
        fs.rmSync(backend, { recursive: true, force: true })
        fs.mkdirSync(path.join(pluginRoot, "resources"), { recursive: true })
        this.addWatchFile(path.join(pluginRoot, "manifest.json"))
        this.addWatchFile(path.join(pluginRoot, "ui/global_config.vue"))
      },
      resolveId(id) {
        if (id.endsWith("/skia.node")) return { id: nativeModule, external: true }
      },
      generateBundle() {
        this.emitFile({ type: "asset", fileName: "skia.node", source: fs.readFileSync(nativeModule) })
        this.emitFile({ type: "asset", fileName: "package.json", source: '{ "type": "commonjs" }\n' })
        fs.writeFileSync(path.join(pluginRoot, "resources/THIRD_PARTY_LICENSES.txt"), thirdPartyNotices(this.getModuleIds()))
      },
    },
    json(),
    nodeResolve({ browser: false, exportConditions: ["node"], preferBuiltins: true }),
    // Native Canvas bindings look up classes by name, so leave this bundle unminified.
    commonjs({ strictRequires: true }),
  ],
}
