# Selenium 版本 — 5 种方案对比

对应 Playwright/Puppeteer 方案的 Selenium 实现。

## 方案总览

| # | 方案 | 对应 Playwright 版 | 核心手段 |
|---|------|-------------------|---------|
| 01 | 标准 ChromeDriver | 方案 1 channel:chrome | 纯标准 API |
| 02 | CDP Stealth 注入 | 方案 2 Stealth | `sendDevToolsCommand` + 页面注入 |
| 03 | Options 隐身 | 方案 3 Playwright Extra | `excludeSwitches` + 启动参数 + CDP |
| 04 | Remote WebDriver | 方案 4 CDP connect | 连接已有 chromedriver |
| 05 | 完整隐身方案  | 方案 5 手动 initScript | 综合 02+03 + 全面补丁 |

## 关键差异

| 能力 | Playwright | Selenium |
|------|-----------|----------|
| 自动等待 | `page.waitForSelector()` | `driver.wait(until.elementLocated())` |
| CDP 注入 | `page.addInitScript()` | `driver.sendDevToolsCommand()` |
| 浏览器启动 | `channel:'chrome'` 自动查找 | `setBinaryPath()` 或 PATH |
| stealth 生态 | **puppeteer-extra-plugin-stealth** | **无成熟 JS 包** |

## 为何 Selenium 隐身不如 Playwright/Puppeteer

1. **undetected-chromedriver 是 Python 独占** —— JS 生态没有同等级替代品
2. Selenium 的 `excludeSwitches('enable-automation')` 可以隐藏横幅，但 `navigator.webdriver` 仍是 true，只能靠 CDP 注入覆盖
3. `Page.addScriptToEvaluateOnNewDocument`（Selenium 4+）可以达到 `addInitScript` 的效果
4. 方案 05 已是最佳实践的汇编，仍不如 Puppeteer Stealth 的数十种补丁全面

## 运行

```bash
npm run 01   # 方案 1
npm run 02   # 方案 2
# ...
```
