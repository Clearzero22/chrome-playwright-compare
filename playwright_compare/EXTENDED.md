# 更多框架/工具延伸对比（2025-2026）

前 5 种方案是主流 JS/Node.js 方案。下面是更多维度的补充。

## 一、Playwright 补丁系（Drop-in Replacement）

无需改代码，换掉 import 即可，CDP 协议层面打补丁：

| 名称 | 实现方式 | 核心能力 | npm |
|------|---------|---------|-----|
| **Patchright** | 打入 Playwright 源码补丁 | 消除 `Runtime.enable` 泄漏、移除自动化特征 flag | `patchright` |
| **CloakBrowser** | C++ 源码级 Chromium 补丁（42个） | reCAPTCHA v3 得分 0.9，30/30 全过 CreepJS | `@cloakhq/cloak` |

**Patchright** 使用方式：
```js
const { chromium } = require('patchright');
// 其余代码与 Playwright 完全一致，自动获得协议级隐身
```

**CloakBrowser** 使用方式：
```js
const { chromium } = require('@cloakhq/cloak');
// drop-in playwight replacement
```

## 二、自定义浏览器引擎

完全脱离 Chromium，从底层避免检测：

| 名称 | 引擎 | 核心优势 | 大小 |
|------|------|---------|------|
| **Obscura** | 自研 V8 + CDP | 内存 ~30MB（Chrome 的 1/7），加载 ~85ms，内置 stealth 模式 | ~15MB 单二进制 |
| **Camoufox** | Firefox 魔改（C++） | CreepJS 检测率 0%，指纹随机化，BrowserForge 级统计精度 | 不适合 JS 项目 |

Obscura 的用法尤其有趣——一个二进制文件就替代了整个 Chrome：
```bash
obscura fetch https://example.com --stealth
# 或以 CDP Server 模式运行，Puppeteer/Playwright 可以直接连
obscura serve --stealth --port 9222
```

## 三、无头浏览器驱动替代

Selenium 生态的演进：

| 名称 | 前身 | 核心改进 |
|------|------|---------|
| **Nodriver** | undetected-chromedriver 作者继任 | 异步优先，零 Selenium 依赖，避免传统 CDP 检测 |
| **Zendriver** | Nodriver fork | 支持 Docker，速度更快 |

```py
# Nodriver (Python，JS 生态暂无对应)
import asyncio
import nodriver as uc

browser = await uc.start()
page = await browser.get('https://example.com')
```

## 四、HTTP 级伪装（无浏览器）

不需要浏览器，纯 HTTP 请求模拟浏览器 TLS 指纹，速度极快：

| 工具 | 原理 | 速度 |
|------|------|------|
| **curl_cffi** | TLS 握手指纹（JA3/JA4）模拟 Chrome/Firefox | 飞快的 HTTP 请求 |
| **Hrequests** | requests 风格 API + TLS 指纹 | 比 Selenium 快 100x |

Node.js 的对应方案：`undici` 或 `node-fetch` 配合 `tls` 模块自定义 cipher，但成熟度不如 Python 生态。

## 五、付费/商业方案（Stealth as a Service）

| 服务 | 特点 | 适用场景 |
|------|------|---------|
| **Browserbase** | 云端浏览器 + 隐身份 + CAPTCHA 解算 | 企业级爬虫 |
| **Steel** | 开源 Browserbase 替代，内置 CAPTCHA 解算 | 中等规模 |
| **ScrapingBee** | API 调用，不关心底层 | 小型项目快速接入 |

## 纵向对比总结

```
方案                             Node.js    检测通过率    相对速度    维护成本
──────────────────────────────────────────────────────────────────────
① Playwright + channel:chrome    ✅          ~20-30%       ★★★★★    零维护
② Puppeteer Stealth              ✅          ~60-70%       ★★★★☆    低（社区维护）
③ Patchright                     ✅          ~70-85%       ★★★★★    中（跟进补丁）
④ CloakBrowser                   ✅          ~90-95%       ★★★★☆    低（闭源核心免费）
⑤ 手动 initScript                ✅          ~30-50%       ★★★★★    高（自维护）
⑥ Obscura                        (CDP兼容)   ~80-90%       ★★★★★★   （二进制更新）
⑦ Nodriver                       ❌(仅Python)~60-70%       ★★★★☆    低
⑧ Camoufox                       ❌(仅Python)~95%+         ★★★☆☆    中（Python生态）
⑨ curl_cffi (HTTP only)          ❌(仅Python) N/A(无JS)    ★★★★★★   零维护
```

**2025-2026 年的趋势：**
- JS 注入补丁（方案 2/5）的有效性在持续下降，Chrome 不断封堵运行时检测入口
- C++ 源码级补丁（CloakBrowser）和协议级补丁（Patchright、Obscura）是新方向
- Chrome 147+ 废弃 `--disable-blink-features=AutomationControlled` 是标志性事件
- IP 声誉 > 指纹伪装：任何隐身方案被标记的数据中心 IP 都会前功尽弃
