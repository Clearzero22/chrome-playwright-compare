# 浏览器自动化框架全景图谱（2025-2026）

## 一、传统三强

| 框架 | 语言 | 核心定位 | 当前状态 (2026) |
|------|------|---------|----------------|
| **Playwright** | TS/JS, Python, Java, C# | 跨浏览器测试自动化 | 新项目首选，~38M 周下载 |
| **Puppeteer** | JS/Node.js | Chrome 专用自动化 | 被 Playwright 超越但爬虫生态深厚 |
| **Selenium** | Java, Python, C#, JS, Ruby | WebDriver 标准实现 | 存量最大（31k+ 企业），新项目减少 |

Playwright 目前下载量是 Cypress 的 5x、Selenium 的 10x+。

---

## 二、隐身/抗检测系

| 工具 | 语言 | 原理 | 绕过能力 |
|------|------|------|---------|
| Puppeteer Extra + Stealth | JS | 数十种 JS 注入补丁 | Cloudflare Free ✅ / Pro ⚠️ |
| Patchright | JS | Playwright CDP 协议层补丁 | 消除 Runtime.enable 泄漏 |
| CloakBrowser | JS/Python | C++ 源码级 Chromium 补丁 42 个 | reCAPTCHA v3 得分 0.9 |
| Nodriver | Python | 无 WebDriver 依赖，异步 CDP | Cloudflare/DataDome 级别 |
| Camoufox | Python | Firefox 魔改 C++，指纹随机化 | CreepJS 检测率 0% |
| Botright | Python | Playwright 封装 + CAPTCHA 解算 | 自动处理 Turnstile |

---

## 三、AI Agent 驱动系（2025-2026 最热）

通过自然语言控制浏览器，2025-2026 年增长最快。

| 框架 | 语言 | 基于 | 核心能力 |
|------|------|------|---------|
| **Stagehand** | TS/JS | Playwright | `act('登录')`、`extract('价格')` 自然语言操作 |
| **Browser Use** | Python | Playwright | LangChain 集成，多 LLM 支持，~58k stars |
| **Midscene.js** | JS | Playwright | 国产，自然语言测试，支持本地模型 |
| **Skyvern** | Python | Playwright | 计算机视觉 + LLM，WebVoyager 榜单 85.8% |
| **Pydoll** | Python | CDP | 模拟真实交互，无 WebDriver |

示例 — Stagehand：
```js
const { stagehand } = require('@browserbasehq/stagehand');
const agent = await stagehand.init({ model: 'claude-4-5' });
await agent.act('search for "chrome automation framework"');
const results = await agent.extract('the search results');
```

---

## 四、MCP 服务器系（AI 工具调用）

专为 LLM 设计的浏览器控制协议层。

| 工具 | 特点 |
|------|------|
| **@playwright/mcp** | 微软官方，34 个工具，accessibility tree 定位 |
| **browse-mcp** | 研究型，一次调用完成搜索→访问→提取，持久化 profile |
| **Taprun** | AI 编译为确定性脚本后执行成本为 $0，140+ 预置 skill |
| **FreeWeb MCP** | 7 层降级（从 fetch 到 Playwright），零 API key |
| **smallright** | 分区域检索 DOM，节省 token |

---

## 五、云托管 / Browser as a Service

| 平台 | 模型 | 特色 |
|------|------|------|
| **Browserbase** | SaaS + open-source | Stagehand 母公司，session 录制回放 |
| **Steel.dev** | 开源可自托管 | Docker 部署，内置 CAPTCHA 解算 |
| **Bright Data** | 商业 | 最大代理网络 + Web Unlocker |
| **Hyperbrowser** | SaaS | AI Agent 优化 + Ultra Stealth 模式 |

---

## 六、测试专项

| 工具 | 类型 | 语言 |
|------|------|------|
| **Cypress** | E2E 测试 | JS/TS |
| **WebdriverIO** | E2E + 移动端 | JS/Node.js |
| **TestCafe** | E2E 测试 | JS/TS |
| **Appium** | 移动端 + Web | Java, Python, JS |
| **Storybook + Chromatic** | 组件级 + 视觉回归 | JS/TS |

---

## 选型决策树

```
你的场景是什么？
│
├─ 写自动化测试
│   ├─ 新项目 → Playwright
│   ├─ React/Vue 组件 → Storybook + Playwright
│   └─ 存量 Selenium 项目 → 继续 Selenium 或渐进迁移
│
├─ 爬虫 / 数据提取
│   ├─ 无反检测要求 → Playwright + channel:chrome
│   ├─ Cloudflare / reCAPTCHA → Puppeteer Stealth 或 Patchright
│   └─ 企业级反爬 (DataDome/Akamai) → CloakBrowser 或 Camoufox + 住宅代理
│
├─ AI Agent 自动化
│   ├─ TypeScript 技术栈 → Stagehand + Browserbase
│   ├─ Python 技术栈 → Browser Use + Hyperbrowser
│   └─ LLM 工具调用 → @playwright/mcp 或 browse-mcp
│
└─ 无头浏览器基础设施
    ├─ 自建 → Playwright + 自行处理 session 管理
    ├─ 托管 → Browserbase / Steel.dev
    └─ 轻量 → Obscura（单二进制 15MB，内置 stealth）
```

---

## 关键趋势

1. **Playwright 成为事实标准** — 微软主力维护，API 最好用，生态最活跃
2. **AI Agent 自动化是 2025-2026 最大增长点** — Stagehand/Browser Use 增速远超传统工具
3. **隐身技术进入 C++ 源码级时代** — JS 注入补丁有效性递减，CloakBrowser/Obscura 是方向
4. **MCP 协议成为 AI 与浏览器之间的标准接口** — `@playwright/mcp` 是微软官方背书
5. **IP 声誉 > 指纹伪装** — 任何隐身方案遇到被标记的数据中心 IP 都白费
