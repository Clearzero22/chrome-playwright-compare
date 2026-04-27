# 如何操作"用户正在使用"的 Chrome

> 核心思路：不是启动新浏览器，而是**连接到用户已有的 Chrome 实例**。

## 方式一：CDP Remote Debugging（最常用）

让用户先启动 Chrome 时开启调试端口，然后你的脚本连上去控制。

**用户侧 — 先关闭所有 Chrome，重新启动：**

macOS：
```bash
# 以调试模式启动 Chrome，使用用户自己的 profile
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222
```

Windows (cmd)：
```cmd
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

**脚本侧 — 连接上去：**

```js
// 方式 A：Playwright connect
const { chromium } = require('playwright');
const http = require('http');

// 获取 WebSocket URL
const data = await new Promise(resolve => {
  http.get('http://127.0.0.1:9222/json/version', res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => resolve(JSON.parse(d).webSocketDebuggerUrl));
  });
});

const browser = await chromium.connect(data);
// 拿到用户已有的页面
const [page] = browser.contexts()[0]?.pages() || [];
await page.goto('https://example.com');
```

```js
// 方式 B：Puppeteer connect
const puppeteer = require('puppeteer');
const browser = await puppeteer.connect({
  browserURL: 'http://127.0.0.1:9222',
  defaultViewport: null,  // 保持原窗口大小
});
const [page] = await browser.pages();
```

```js
// 方式 C：Selenium debuggerAddress
const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

const options = new chrome.Options();
options.addArguments(`--remote-debugging-port=9222`);
// debuggerAddress 会让 Selenium 连接到已有的 Chrome 而不是启动新的
// 但需要确保 Chrome 已经在 9222 端口运行

const driver = await new Builder()
  .forBrowser('chrome')
  .setChromeOptions(options)
  .build();
```

## 方式二：复用 User Data 目录（不干扰用户当前会话）

启动一个**新的 Chrome 进程**，但使用用户已有的 profile 数据（cookies、书签、历史记录）。

```js
const { chromium } = require('playwright');

const browser = await chromium.launchPersistentContext(
  '/Users/用户名/Library/Application Support/Google/Chrome',  // macOS profile
  {
    channel: 'chrome',
    headless: false,
    args: ['--no-first-run'],
  }
);
```

macOS profile 路径：
```
/Users/用户名/Library/Application Support/Google/Chrome/Default
```

Windows profile 路径：
```
C:\Users\用户名\AppData\Local\Google\Chrome\User Data\Default
```

⚠️ **注意**：启动一个新 Chrome 实例指向同一个 user data 目录，会和用户正在运行的 Chrome 冲突（Profile 被锁定）。要在用户关掉 Chrome 后才能用。

## 方式三：Chrome Extension（持久控制，无需重启）

开发一个 Chrome 扩展，通过 `chrome.debugger` API 附加到页面，然后通过消息通道与你的脚本通信。

```
┌──────────────┐      message      ┌──────────────┐
│  你的脚本     │ ←──────────────→ │  Chrome 扩展  │
│ (Node.js)    │   WebSocket/HTTP  │  (background) │
└──────────────┘                   └──────┬───────┘
                                          │ chrome.debugger API
                                    ┌─────▼───────┐
                                    │  用户页面     │
                                    └─────────────┘
```

扩展 manifest.json 关键部分：
```json
{
  "permissions": ["debugger", "activeTab"],
  "background": {
    "scripts": ["background.js"]
  }
}
```

background.js：
```js
chrome.debugger.attach({ tabId: tab.id }, '1.3', () => {
  chrome.debugger.sendCommand({ tabId: tab.id }, 'Page.navigate', {
    url: 'https://example.com'
  });
});
```

**优点**：无需重启 Chrome，用户正常使用。适合企业内管、自动化流程。
**缺点**：需要发布扩展（或开发者模式加载），开发成本高。

## 方式四：Playwright connectOverCDP（最推荐）

如果 Chrome 已经以 `--remote-debugging-port=9222` 启动，这是最简洁的方式。

```js
const { chromium } = require('playwright');

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
// 获取用户浏览器上下文和页面
const defaultContext = browser.contexts()[0];
const pages = defaultContext.pages();  // 用户所有标签页

// 在用户当前页执行操作
await pages[0].goto('https://example.com');

// 或用用户的 session 打开新标签
const newPage = await defaultContext.newPage();
await newPage.goto('https://example.com');
```

## 对比总结

| 方式 | 需重启 Chrome | 干扰用户 | 侵入性 | 适用场景 |
|------|:------------:|:--------:|:------:|---------|
| CDP Remote Debugging (方式一) | ✅ 需要 | 低（后台操作） | 中 | 开发调试、自动化 |
| 复用 User Data (方式二) | ✅ 需要(关掉原Chrome) | 高（单独窗口） | 低 | 复用登录态 |
| Chrome 扩展 (方式三) | ❌ 不需 | 极低 | 高（需开发扩展） | 企业管控、长期运行 |
| connectOverCDP (方式四) | ✅ 需要 | 低 | 中 | Playwright 用户推荐 |

## 实际建议

1. **一次性操作**（跑完就结束）→ **方式一** CDP Remote Debugging，用户启动 Chrome 时加 `--remote-debugging-port=9222`
2. **长期后台服务** → **方式三** Chrome Extension，用户安装后无需做任何操作
3. **只想复用登录态** → **方式二**，但需要在启动脚本前关掉 Chrome
4. **已经在跑 Playwright** → **方式四** connectOverCDP，最顺手
