# 五种主流方案对比：使用本地 Chrome 进行自动化

## 方案一览

| 方案 | 成熟度 | 反检测能力 | 维护状态 | 推荐场景 |
|------|--------|-----------|---------|---------|
| 1. Playwright + channel:chrome | ★★★★★ 稳定 | ☆☆☆☆☆ 无 | 微软主力维护 | 不需要反检测的常规自动化 |
| 2. Puppeteer Extra + Stealth | ★★★★★ 最成熟 | ★★★★★ 最强 | 社区维护（活跃度下降） | **反检测首选**，对付 Google 强检测 |
| 3. Playwright Extra + Stealth 桥接 | ★★★☆☆ | ★★★★☆ | 插件维护者较少 | 想用 Playwright API + 需要隐身 |
| 4. Playwright + CDP connectOverCDP | ★★★★☆ | ★★☆☆☆ (依赖启动参数) | 微软维护 | 已有 Chrome 进程，需附加操作 |
| 5. Playwright + 手动 stealth initScript | ★★☆☆☆ | ★★★☆☆ (需自行维护) | 无（自维护） | 只有轻量匿名需求，不想引入 extra |

## 详细对比

### 方案 1：Playwright + channel:chrome
**Npm 包：** `playwright`

```
const { chromium } = require('playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: false });
```

- **优点**：API 最现代，自动等待机制完善，network 拦截强大，微软主力维护
- **缺点**：**零反检测能力**，`navigator.webdriver` 标志明显，canvas/WebGL 指纹无防护
- **适用**：内部工具、爬虫（不检测的环境）

### 方案 2：Puppeteer Extra + Stealth Plugin ✅ 最成熟
**Npm 包：** `puppeteer-extra` + `puppeteer-extra-plugin-stealth`

```
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const browser = await puppeteer.launch({ headless: false, executablePath: '...' });
```

- **内置反检测补丁清单**（数十种）：
  - `navigator.webdriver` → false
  - `navigator.plugins` → 填充真实插件数量（Chrome 通常有 5+ 个）
  - `navigator.languages` → 保留正常语言列表
  - WebGL vendor/renderer → 遮蔽真实 GPU 指纹
  - Canvas 指纹 → 添加细微噪声
  - `chrome.runtime` → 模拟扩展环境
  - `sourceurl` → 隐藏 `//# sourceURL`
  - `iframe.contentWindow` → 修复检测
  - 视频帧率/编解码器 → 正常化
  - `webdriver` → 删除所有相关属性
  - Permissions → 模拟真实权限状态
- **社区验证时间**：5 年以上，对抗 Google reCAPTCHA、Cloudflare 验证
- **缺点**：Puppeteer API 不如 Playwright 现代化，需要手动处理很多等待逻辑

### 方案 3：Playwright Extra + Stealth 桥接
**Npm 包：** `playwright-extra` + `puppeteer-extra-plugin-stealth`

```
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());
const browser = await chromium.launch({ headless: false });
```

- **优点**：Playwright 的现代 API 性能 + Stealth 的反检测能力
- **缺点**：
  - `playwright-extra` 不是官方包，维护频率低
  - Stealth Plugin 是为 Puppeteer 设计的，Playwright 环境下部分补丁可能不生效
  - 调试难度高：出问题时难以区分是 Playwright 还是 Stealth 的问题

### 方案 4：Playwright + CDP connectOverCDP
**Npm 包：** `playwright`

```
const browser = await chromium.connectOverCDP('http://localhost:9222');
// 或者连接远程：chrome.connectOverCDP({ endpointURL: 'ws://...' })
```

- **优点**：附加到已有浏览器进程，可手动预先配置 Chrome 参数
- **优点**：可复用用户已有的会话（cookies、登录态）
- **缺点**：需要事先手动或通过脚本来启动 Chrome，多进程管理复杂

### 方案 5：Playwright + 手动 stealth via addInitScript
**Npm 包：** `playwright`

```
await page.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => false });
});
await page.route('**/*', route => {
  // 拦截并修改 sourceURL
});
```

- **优点**：零额外依赖，完全可控
- **缺点**：需要自行维护数十个补丁，难以跟上反检测进化

## ⚠️ 重要发现：Chrome 147 已废弃关键反检测 Flag

在 Chrome 147 (2026年4月) 上测试发现：

```
You are using an unsupported command-line flag: --disable-blink-features=AutomationControlled.
Stability and security will suffer.
```

**`--disable-blink-features=AutomationControlled` 已被 Chrome 官方废弃。** 这个 flag 曾是最基础的反检测手段（隐藏 `navigator.webdriver`），Chrome 团队正在逐步封堵所有 "自动化痕迹" 的 CLI 入口。

### 影响分析

| 方案 | 受影响程度 | 说明 |
|------|-----------|------|
| 方案 1 Playwright + channel | ⚠️ 中 | 失去最基础的 webdriver 隐藏手段 |
| 方案 2 Puppeteer Stealth | ✅ 无影响 | Stealth 通过 JS 层面打补丁，不依赖 CLI flag |
| 方案 3 Playwright Extra | ⚠️ 低 | Stealth 本身不依赖此 flag |
| 方案 4 CDP | ⚠️ 中 | 自启动 Chrome 传此参数同样触发警告 |
| 方案 5 手动 initScript | ⚠️ 低 | addInitScript 补丁不依赖 CLI flag |

### 趋势

- Chrome 团队正在持续收紧自动化检测能力，后续版本可能完全移除 `--disable-blink-features=AutomationControlled`
- **方案 2 (Puppeteer Stealth) 的 JS 层面补丁将成为唯一可靠的方案**
- 未来可能只剩两条路：用 Stealth 级别的 patch，或用真实用户操作（如 Browserbase/Playwright as a service）

## 最终建议

## 跨平台支持

| 方案 | macOS | Windows | Linux | 备注 |
|------|:-----:|:-------:|:-----:|------|
| 1. Playwright + channel | ✅ | ✅ 原生 | ✅ 原生 | Playwright 自动查找 Chrome |
| 2. Puppeteer Stealth | ✅ | ✅ 改路径 | ✅ 改路径 | 使用 `_platform.js` 自动适配 |
| 3. Playwright Extra | ✅ | ✅ 原生 | ✅ 原生 | 同 Playwright |
| 4. CDP connect | ✅ | ✅ 改路径 | ✅ 改路径 | `spawn` 的跨平台差异已处理 |
| 5. 手动 initScript | ✅ | ✅ 原生 | ✅ 原生 | 纯 JS 注入，无平台依赖 |

> 方案 1/3/5 使用 `channel: 'chrome'` 让 Playwright 自动查找系统 Chrome，**天然跨平台**。
> 方案 2/4 需指定路径，已内置 `_platform.js` 辅助模块自动适配。
> Windows 注意：`spawn` 的 `stdio: 'ignore'` 和路径正斜杠需额外处理（`_platform.js` 已涵盖）。

```
强检测（Google 登录/Cloudflare/reCAPTCHA）→ 方案 2 Puppeteer Extra + Stealth
一般检测（爬数据、自动化测试）       → 方案 1 Playwright + channel:chrome
既要反检测又要 Playwright 生态       → 方案 3 Playwright Extra + Stealth（谨慎尝试）
需要附加到已有浏览器                 → 方案 4 CDP connectOverCDP
轻量匿名、不想引入大包               → 方案 5 手动 initScript
```

