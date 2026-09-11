# Flexbar Cider 插件

在 Windows 11 和 macOS 15+ 上通过 FlexDesigner 和 Flexbar 控制 Cider。

English documentation: [README.md](README.md)

## 功能

- 上一首、播放/暂停、下一首。
- 原生 Volume 滑块，控制 Cider 自身的播放音量（0–100%）。
- Cider 4.0 Listening Mode：一个循环按钮和三个独立模式按钮。
- Now Playing 按键显示专辑封面、歌曲名和歌手。
- 点击 Now Playing 按键的任意位置（包括封面）可切换播放状态。
- 使用电脑上的系统字体绘制中文、日文、韩文和带重音字符的文本，并保持封面比例。

插件 ID：`com.sonw.cider`。作者：Sonw。版本：`1.3.1`。

## 安装与连接

1. 从 [Releases](https://github.com/AzureSonw/flexbar-plugin-cider/releases/latest) 下载对应平台的安装包，再通过 FlexDesigner 的插件管理器安装。
2. 打开 Cider，启用本地 RPC/API 服务，并获取你自己的 Cider API token。
3. 在 FlexDesigner 中打开 **设置 → 应用 → Cider**。
4. 将 token 填入 **Cider API Token**。
5. 点击 **TEST CONNECTION**。成功后会显示 **Connected to Cider**。
6. 点击 **SAVE SETTINGS**。保存的配置会立即生效。
7. 从 FlexDesigner 的按键库添加 Cider 按键，并按需添加 **Volume** 音量滑块。

| 平台 | 安装包 |
| --- | --- |
| Windows x64 | `com.sonw.cider.flexplugin` |
| macOS Apple Silicon | `com.sonw.cider.macos-arm64.flexplugin` |
| macOS Intel | `com.sonw.cider.macos-x64.flexplugin` |

各安装包包含对应平台的 Canvas 原生组件。请选择与 FlexDesigner 进程架构一致的包；
通过 Rosetta 运行 Intel 版 FlexDesigner 时使用 Intel 包。
macOS 支持为实验性：CI 会在两种架构上运行自动测试并加载原生组件，实体 Flexbar 测试目前仅在 Windows 上完成。

播放与音量连接到 `http://127.0.0.1:10767/api/v1`，使用 `apptoken` 请求头鉴权。
Listening Mode 使用 `/api/v2/audio/listening-mode`，共用原来保存的 token。
连接测试调用 `GET /playback/active`，所有成功的 HTTP 状态码（包括 204）都会视为成功。
测试 token 不会自动保存；要删除已保存的 token，请清空输入框后保存。

FlexDesigner 将 token 保存为插件应用配置中的 `ciderToken`。插件不声称对该配置加密，请勿分享本机 FlexDesigner 配置或日志。每位用户都应使用自己的 token，发布包不包含任何凭据。

现有 Cider 按键的 ID 和默认宽度保持不变：Now Playing 480、Play/Pause 80、Next 70、Previous 90。无需单独导入布局文件。

## 使用与故障排查

保持 Cider 运行并启用本地 API。Now Playing 每三秒刷新一次。

原生 **Volume** 滑块加载时会读取 Cider 当前音量，之后每三秒检查一次 Cider 内的音量变化。
拖动更新以 75 毫秒间隔合并，保留最新值；本地音量调整完成后再恢复外部同步。
音量控制继续使用应用设置中保存的个人 token。

如果显示 **Set Cider Token**，请配置并保存 token；如果连接测试失败，请确认 Cider 正在运行、本地 API 已启用且 token 正确。若个别字符缺字，请在电脑上安装对应语言的字体。

较长的歌名和歌手名会以省略号缩短，并且不会拆分 Unicode 字符簇。

Now Playing 使用按键加载时收到的宽度。常规封面为 58×58，位于 (1,1)，在 60 像素高的画布中保留 1 像素黑边；非正方形图片居中裁切，不拉伸。歌名和歌手沿用 1.2.1 的居中位置及文字宽度。极窄按键或较小的旧图标尺寸会限制封面大小，防止进入原文字区域。FlexDesigner 2.2.3 实测加载事件中的 `key.width` 与 `key.style.width` 相同，因此保留优先使用运行时 `key.width`、缺失时使用 `style.width` 的逻辑。修改宽度后，请应用修改并上传布局，使按键重新加载。SDK 没有文档化的普通按键尺寸变化事件；三秒刷新只会使用最近一次加载的尺寸。

Volume 是原生滑块，轨道宽度与外框宽度独立。2.2.3 实测加载事件只提供 `key.width`，不提供 `style`；`setSlider` 更新数值，SDK 没有文档化的原生轨道改宽接口。加宽外框不会自动加宽轨道。新增 Volume 默认外框为 300 像素，轨道为 230 像素，图标为 28 像素并默认显示；预留的 70 像素由 50 像素图标区域和宿主的 20 像素轨道内缩组成，原生百分比格式不变。已有按键保留保存的样式。

其他 Volume 尺寸请在 FlexDesigner 的 **背景 → 宽度** 和 **前景 → 滑块宽度** 中分别调整，再应用并上传。使用上述图标默认值时，可将轨道设为 `外框宽度 - 70`，外框至少为 250 像素：2.2.3 的滑块编辑器要求轨道至少为 180 像素，220 像素外框无法保留同样的图标间距。这是手动调整的兼容性回退，不是自动响应式缩放。

1.2.1 修复了重新排列并上传布局后，相邻按键可能被 Now Playing 图片覆盖的问题。FlexDesigner 2.2.3 会重新分配按键编号而不发送旧按键的移除事件；插件现在按设备替换活动按键列表，并丢弃过期绘制。位图严格使用有效的加载宽度，缺失、冲突或非整数宽度会跳过绘制；极窄按键会收缩封面并省略无法容纳的文字。

## Listening Mode

添加 **Listening Mode** 按钮可按 **Off → Gaming → Unwind → Off** 循环；也可添加
**Listening Mode - Off / Gaming / Unwind** 三个独立按钮，直接选择对应模式。
循环按钮显示当前模式的图标与名称；独立按钮保持各自图标，并用蓝色背景标出当前模式。

四种按键共享 Cider 的当前状态。设置成功后立即刷新，在 Cider 内修改模式则随原有三秒刷新同步。
此功能需要 Cider 4.0 的 v2 API；接口不可用时，原播放、音量和 Now Playing 仍可使用。
所有功能继续使用应用设置中的同一个 token。

FlexDesigner 插件信息中的 **Homepage** 会打开本仓库。

开发时替换已链接插件前，应停止旧后端。如果更新没有生效，请先保存布局再重启 FlexDesigner；
同一个插件 ID 同时运行两个后端，可能导致旧版本继续生效。

## 从源码构建

请在 Windows x64 或 macOS（Apple Silicon / Intel）使用 **Node.js 20.20.2** 和 npm：

```sh
npm ci
npm test
npm run build
npm run plugin:validate
npm run plugin:pack
```

请使用 `.node-version` 或 `.nvmrc` 指定的 Node 版本。原生 Canvas 二进制文件与平台相关，应在目标系统与架构上构建。发布工作流会分别构建并测试 Windows x64、macOS arm64 和 macOS x64。

Rollup 会从 `src/` 重新生成 `com.sonw.cider.plugin/backend/`，并打包 JavaScript 依赖、`skia-canvas` 原生文件、项目许可证和第三方许可证说明。FlexCLI 会校验标准插件目录并生成 `com.sonw.cider.flexplugin`。

不要把本地配置、日志、凭据或开发临时文件加入插件目录。

## 源码结构

- `src/plugin.js`：SDK 事件、配置更新、轮询、绘制和按键动作。
- `src/musicControl.js`：Cider 请求与封面获取。
- `src/canvasRenderer.js`：Now Playing 绘制器。
- `com.sonw.cider.plugin/manifest.json`：插件身份、八个普通按键、原生 Volume 滑块、仓库链接和配置页面。
- `com.sonw.cider.plugin/ui/global_config.vue`：应用设置页面。
- `rollup.config.mjs`：干净构建与原生资源打包。

字体使用 Microsoft YaHei、Microsoft JhengHei、Yu Gothic、Malgun Gothic、Segoe UI 和系统回退字体，不随插件打包。

## 参考

- [Flexbar SDK](https://flexdocumentation.readthedocs.io/en/latest/sdk/index.html)
- [插件结构](https://flexdocumentation.readthedocs.io/en/latest/sdk/plugin_structure.html)
- [YouTube Music 插件示例](https://github.com/MrCodeEU/Flexbar-Plugin-Youtube-Music-Desktop-App)

## 许可证

本项目采用 [MIT License](LICENSE)，版权归属为 © 2026 Sonw。
安装包中的 `resources/LICENSE.txt` 包含项目许可证；依赖保留各自许可证，
详见包内的 `resources/THIRD_PARTY_LICENSES.txt`。
