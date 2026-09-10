# Flexbar Cider 插件

在 Windows 11 上通过 FlexDesigner 和 Flexbar 控制 Cider。

English documentation: [README.md](README.md)

## 功能

- 上一首、播放/暂停、下一首。
- Now Playing 按键显示专辑封面、歌曲名和歌手。
- 点击 Now Playing 按键的任意位置（包括封面）可切换播放状态。
- 使用电脑上的系统字体绘制中文、日文、韩文和带重音字符的文本，并保持封面比例。

插件 ID：`com.sonw.cider`。作者：Sonw。版本：`1.0.0`。

## 安装与连接

1. 在 FlexDesigner 的插件管理器中安装发布包 `com.sonw.cider.flexplugin`。
2. 打开 Cider，启用本地 RPC/API 服务，并获取你自己的 Cider API token。
3. 在 FlexDesigner 中打开 **设置 → 应用 → Cider**。
4. 将 token 填入 **Cider API Token**。
5. 点击 **TEST CONNECTION**。成功后会显示 **Connected to Cider**。
6. 点击 **SAVE SETTINGS**。保存的配置会立即生效。
7. 从 FlexDesigner 的按键库将四个 Cider 按键添加到布局中。

插件连接到 `http://127.0.0.1:10767/api/v1`，使用 `apptoken` 请求头鉴权。
连接测试调用 `GET /playback/active`，所有成功的 HTTP 状态码（包括 204）都会视为成功。
测试 token 不会自动保存；要删除已保存的 token，请清空输入框后保存。

FlexDesigner 将 token 保存为插件应用配置中的 `ciderToken`。插件不声称对该配置加密，请勿分享本机 FlexDesigner 配置或日志。每位用户都应使用自己的 token，发布包不包含任何凭据。

现有 Cider 按键的 ID 和默认宽度保持不变：Now Playing 480、Play/Pause 80、Next 70、Previous 90。无需单独导入布局文件。

## 使用与故障排查

保持 Cider 运行并启用本地 API。Now Playing 每三秒刷新一次。

如果显示 **Set Cider Token**，请配置并保存 token；如果连接测试失败，请确认 Cider 正在运行、本地 API 已启用且 token 正确。若个别字符缺字，请在 Windows 中安装对应语言的字体。

较长的歌名和歌手名会以省略号缩短，并且不会拆分 Unicode 字符簇。

## 从源码构建

请在 Windows x64 使用 **Node.js 20.20.2** 和 npm：

```sh
npm ci
npm run build
npm run plugin:validate
npm run plugin:pack
```

请使用 `.node-version` 或 `.nvmrc` 指定的 Node 版本。原生 Canvas 二进制文件与平台相关，因此 Windows 发布包应在 Windows x64 上构建。

Rollup 会从 `src/` 重新生成 `com.sonw.cider.plugin/backend/`，并打包 JavaScript 依赖、`skia-canvas` 原生文件和第三方许可证说明。FlexCLI 会校验标准插件目录并生成 `com.sonw.cider.flexplugin`。

不要把本地配置、日志、凭据或开发临时文件加入插件目录。

## 源码结构

- `src/plugin.js`：SDK 事件、配置更新、轮询、绘制和按键动作。
- `src/musicControl.js`：Cider 请求与封面获取。
- `src/canvasRenderer.js`：Now Playing 绘制器。
- `com.sonw.cider.plugin/manifest.json`：插件身份、四个按键和配置页面。
- `com.sonw.cider.plugin/ui/global_config.vue`：应用设置页面。
- `rollup.config.mjs`：干净构建与原生资源打包。

字体使用 Microsoft YaHei、Microsoft JhengHei、Yu Gothic、Malgun Gothic、Segoe UI 和系统回退字体，不随插件打包。

## 参考

- [Flexbar SDK](https://flexdocumentation.readthedocs.io/en/latest/sdk/index.html)
- [插件结构](https://flexdocumentation.readthedocs.io/en/latest/sdk/plugin_structure.html)
- [YouTube Music 插件示例](https://github.com/MrCodeEU/Flexbar-Plugin-Youtube-Music-Desktop-App)
