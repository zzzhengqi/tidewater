# Tidewater（zzzhengqi fork）进度记录

开工前先读这份文件，收工时更新它。

## 产品定位（不变的约束）

- "个人私密世界"：核心是自由调时间 / 太阳方位 / 海浪，潜水、开船、自由相机飞行。
- 钓鱼是保留的**可选**玩法之一，不能让项目变成"只是钓鱼游戏"。不加金币驱动的新系统、排行榜、强制任务。
- 所有用户可见文字走多语言机制；新增 key 必须同时补全所有已支持语言。
- 不引入联网素材；保持性能；不让已有功能退化。
- 每个阶段结束 git commit，`npm run build` 与 `npm test` 必须通过。

## 分支与远端

| 名称 | 指向 | 说明 |
|---|---|---|
| `origin` | github.com/zzzhengqi/tidewater | 我的 fork |
| `upstream` | github.com/dgreenheck/tidewater | 上游（自研 WebGPU 引擎 + WGSL，带钓鱼玩法） |
| `backup-fork-old` | `d9fcc35` | 换底座前的旧 main（three.js/TSL 版 + 多语言）。**不要动它**，是退路 |
| `main-v2` | 基于 `upstream/main` `4811ba4` | 新底座 + 移植过来的多语言 |

旧 fork 相对上游合并基点 `d32799f` 只有 3 个自己的提交：`6606368`（设置面板多语言、独立预览）、`35310a5`（语言菜单配色）、
`d9fcc35`（README 演示链接指向本 fork）。这些改动已全部移植到 `main-v2`，three.js 代码没有带回来。

## 上游引擎结构概述

- `src/engine/`：自研渲染引擎。CPU 侧是与 three.js 接口相近的数学 / 场景 / 几何（`Vector3`、`Mesh`、`BufferGeometry`…），
  GPU 侧（`engine/webgpu.js`）是 `GPU` 单例、`Texture` / `RenderTarget`、`UniformBlock`、`ShaderModule`（WGSL 片段按前缀共享）、
  `ComputeKernel`、`Material`、`MeshRenderer`、`FullscreenPass`、阴影 `SunShadows`、蒙皮 `SkinnedModel`。移植约定见 `docs/PORTING.md`。
- `src/App.js`：启动顺序（大气 → 地形 → 村庄 → 植被 → 海浪 → 珊瑚礁 → 海洋 → 着色器编译 → 预热），每帧更新与渲染。
- 系统目录：`ocean/`（FFT 海洋、岸浪、碎浪、航迹、焦散、水下光照）、`sky/`、`world/`、`post/`（AO、TAAU、动态模糊、泛光、镜头光晕…）、
  `materials/`、`player/`（步行、游泳、开船、自由相机）、`audio/`、`fx/`。
- `src/game/`：钓鱼玩法。`Game.js`（总控、提示、吐司）、`GameHUD.js`（钱包 / 冷藏箱 / 油量 / 声呐、搏鱼条、渔获卡片、冷藏箱面板、
  鱼摊与船具店面板）、`Guide.js`（新手引导 3 张卡片 + 一次性提示）、`Minimap.js`、`FishTable.js`（18 种鱼）、`Gear.js`（升级）、
  `Vendor.js` / `FishStand.js` / `Chandlery.js`（乔与玛尔塔）、`FishPortrait.js`（渔获卡片里的实时 3D 鱼）。
- `src/ui/`：`UI.js`（通用设置面板组件、HUD、帮助、开始画面、加载器）、`AppUI.js`（把设置项绑到 App）、`i18n.js` + `locales/`（多语言）。
- `index.html`：加载器的静态标记（带 `data-i18n`）。
- 测试：`test/i18n-check.mjs`、`test/i18n.test.mjs`、`test/game-logic.mjs`、`test/engine-smoke.mjs`（Node 里用 Dawn 无头 WebGPU 跑引擎冒烟）。

## 多语言机制

支持语言：`en`（源语言）、`zh-CN`、`ja`、`ko`、`ar`。列表在 `src/ui/i18n.js` 的 `languages`。

### 运行时（`src/ui/i18n.js`）

- `t( key, params )`：取当前语言的文字，`{name}` 占位符由 `params` 填充。当前语言缺这个 key（或为空）时**回退到英文并在控制台警告一次**；
  英文也没有则返回 key 本身并警告。
- `phrase( english )`：把一段英文源文字翻译成当前语言（按 en.js 的值反查 key）。只在这些命名空间里反查：
  `language ui settings phase mode prompt toast loader error`，避免把按键 `E`、数字之类误翻。用于：
  - 设置面板 / 侧栏：`AppUI.js` 用英文标签搭建，`UI.js` 里的 `MutationObserver` 把面板里的文本节点和
    `aria-label / data-tip / data-tip-hint / title / placeholder / aria-valuetext` 原地翻译，切换语言时从记录的英文原文重新翻译（沿用旧 fork 的做法）。
  - HUD 的模式标签（`setMode`）、交互提示（`setPrompt`，玩家模块传英文）、吐司（`toast`）、加载状态（`setLoading`）。
- `setLanguage( code )`：保存到 `localStorage['tidewater.ui.language']`，更新 `<html lang>`，重刷所有 `data-i18n` 静态标记，通知订阅者。
- `onLanguageChange( fn )`：订阅切换；`UI`、`GameHUD`、`Guide`、`Minimap` 都订阅了，切换后已打开的面板 / 卡片 / 引导会立即重绘。
- 默认语言：有保存的选择用保存的；否则按浏览器语言列表，`zh*` → `zh-CN`，`ja` / `ko` / `ar` 各自对应，其余英文。
- `localizeStatic( root )`：`data-i18n="key"`（写 innerHTML）与 `data-i18n-attr="aria-label:key;title:key"`。
- 语言选择器在设置面板标题栏（`H` 打开）。阿拉伯语时设置标签、钓鱼面板、引导卡片为 RTL（`ui.css` 末尾的 `[data-lang='ar']` 规则）。

### 新增 / 修改一条界面文字要改哪里

1. 在 `src/ui/locales/en.js` 加 key（按命名空间分组：`ui.` 面板外壳、`settings.` 设置项、`hud.` HUD、`prompt.` 交互提示、
   `toast.` 吐司、`loader.` 加载器、`help.` 帮助页、`start.` 开始画面、`fish.<id>` 鱼名、`gear.<track>[.<level>]` 装备、
   `vendor.<id>.*` 商贩、`catch.` 渔获卡片、`inv.` 冷藏箱、`stand.` 鱼摊、`shop.` 船具店、`game.` 钓鱼吐司、`guide.` / `tip.` 引导、
   `unit.` 单位、`dir.` / `compass.` 方位、`key.` 按键名、`error.` 错误）。
2. **同一次提交**里在 `zh-CN.js`、`ja.js`、`ko.js`、`ar.js` 补上同一个 key，占位符 `{x}` 必须一致。值可以含 `<b> <kbd> <small> <p>`。
3. 代码里：
   - 游戏 / HUD 代码直接 `t( 'key', { … } )`（`Guide.js`、`Minimap.js`、`UI.js` 里导入为 `tr`，避免和局部变量 `t` 冲突）。
   - 设置面板：`AppUI.js` 照常写英文 `label` / `tooltip`，只要 en.js 的 `settings.*` 里有同样的英文就会被翻译。
   - 玩家提示 / 模式 / 吐司 / 加载状态可以传英文（会走 `phrase()`），但英文必须在对应命名空间里有条目。
   - 单位用 `src/game/text.js` 的 `kg() cm() metres() litres() money()`，中文显示公斤、厘米、米、升。
4. `npm run i18n:check`（已并入 `npm test`）会报：某语言缺 key、多余 key、空翻译、占位符不一致、代码里 `t('…')` 用了不存在的 key、
   走 `phrase()` 的英文没有条目、`GameHUD / Guide / Minimap` 的标记里残留英文句子。
5. `npm run i18n:preview` 重新生成 `test/i18n.html`，直接用浏览器打开（不需要 WebGPU、不需要服务器），底部工具栏切语言和画面。

新增一种语言：在 `languages` 里加一行，新建 `locales/<code>.js`（所有 key），在 `i18n.js` 顶部 import 并放进 `locales`。

## 当前键位表（来自帮助页，作为基线）

| 键 | 作用 |
|---|---|
| W A S D / 鼠标 | 移动 / 环顾（点击画面锁定鼠标，Esc 释放） |
| Shift | 冲刺、船只加速 |
| Space | 跳跃、向上游、爬梯子 |
| C | 下蹲、下潜 |
| E | 互动：登船、掌舵、上岸、与乔 / 玛尔塔交易 |
| V | 船上视角（第一 / 第三人称） |
| R | 拿出 / 收起鱼竿 |
| 左键 | 抛竿（按住蓄力）、提竿、收线 |
| 右键 | 收回空线 |
| I / Tab | 冷藏箱与鱼类图鉴 |
| F | 自由相机 |
| T | 暂停时间 |
| L | 手电筒 |
| M | 静音 |
| H | 设置面板 |
| P | 拍照模式 |
| F1 / ? | 操作说明 |

轮盘接口：目前代码中**没有**轮盘（radial menu）组件，后续阶段若新增，在此记录接口。

## 阶段记录

### 阶段：换底座，保住多语言（2026-10-27，分支 `main-v2`）

已完成：
- 备份分支 `backup-fork-old`；添加 `upstream` 远端；`main-v2` 从 `upstream/main` 建立。
- 多语言改为按语言分文件（`src/ui/locales/*.js`，398 个 key × 5 种语言），新运行时 `src/ui/i18n.js`。
- 旧 fork 的设置面板翻译（约 90 条）全部沿用；补了上游新增的设置项（抗锯齿、渲染比例说明等）。
- 上游新增界面全部接入：钓鱼 HUD（钱包、冷藏箱 / 鱼舱、油量、声呐、搏鱼提示）、渔获卡片、冷藏箱与鱼类图鉴、鱼摊、船具店、
  新手引导 3 张卡与 8 条提示（含实时方位"西南方 4 米"）、小地图"北"、帮助页、开始画面、加载器（状态、提示轮播、错误信息、WebGPU 不可用提示）、
  HUD 模式标签、交互提示与按键名（左键 / 右键 / 空格）、船速表（节、转速、航向方位）、深度计。
- 18 种鱼中文通行名；中文单位公斤 / 厘米 / 米 / 升（英寸 / 磅作为副单位）。
- 缺 key 回退英文 + 控制台警告；选择持久化；中文浏览器默认中文。
- `npm run i18n:check`（并入 `npm test`）、`test/i18n.test.mjs`（运行时行为）、`npm run i18n:preview`（`test/i18n.html`）。
- `test/engine-smoke.mjs` 的截图改写到系统临时目录（原来硬编码 `/tmp`，Windows 上失败）。
- README：演示链接指向本 fork，补多语言说明；`.github/workflows/deploy.yml` 保持不变（push 到 main 自动部署 Pages）。

待办 / 留到后续阶段：
- **阶段五**：日 / 韩 / 阿语深度打磨（现在是可用翻译，鱼名多为音译；阿语只对部分容器做了 RTL）。
- 文案定位：上游的加载器副标题、引导欢迎卡、帮助页"钓鱼玩法"段落是以钓鱼为中心的写法，已忠实翻译；
  与"个人私密世界"定位的调整（例如加载器副标题改为探索向）需要另行决定。
- `UI.demo()`（上游的开发用示例面板，游戏里不调用）没有接入多语言，`i18n:check` 有意跳过它。
- 渔获卡片打开时切换语言会重绘文字，倒计时条会重新开始（无功能影响）。
- 时间滑块的 `aria-valuetext`（读屏用）在切换语言后要等时间值变化才会更新。
- 店铺 / 摊位 3D 模型上的招牌是贴图，不在多语言范围内。
- 首次打开时加载器会先闪现一瞬间英文（脚本模块执行前），之后立即变成所选语言。

验证情况：
- 已验证：`npm run build`、`npm test`（i18n 检查、运行时测试、钓鱼逻辑、Node 无头 WebGPU 引擎冒烟）通过；
  `test/i18n.html` 在浏览器里逐屏脚本检查，中文下可见文字除 `fps`、品牌名 TIDEWATER、单位 km/EV/ms 外无英文残留；阿语面板方向为 RTL。
- 本机内置浏览器（Chromium，localhost 下有 WebGPU）实际跑通了完整游戏：中文加载器到"准备就绪"、新手引导（含实时方位）、
  模式标签、R 拿竿吐司与提示、I 冷藏箱、渔获卡片（实时 3D 鱼）、卖鱼吐司、运行中切换 中→英→中 并写入 localStorage、无 i18n 警告。
  注意：当时浏览器窗口被遮挡，rAF 不触发，测试时在页面里把 rAF 换成了 setTimeout 才能推进帧；真实的鼠标抛竿 / 搏鱼 / 走到摊位前交易没有手动操作过。
