/**
 * 方案 5：Playwright + 手动 stealth via addInitScript
 * 零额外依赖，手动注入常用反检测脚本
 * 适合：轻量匿名需求，不想引入大包
 */
const { chromium } = require('playwright');

/** 常用反检测补丁 */
const STEALTH_SCRIPT = () => {
  // 1. 隐藏 webdriver
  Object.defineProperty(navigator, 'webdriver', { get: () => false });

  // 2. 覆盖 chrome.runtime
  window.chrome = window.chrome || {};
  window.chrome.runtime = {};

  // 3. 填充 plugins（真实 Chrome 通常有 5+ 个插件）
  const origPlugins = navigator.plugins;
  if (origPlugins.length === 0) {
    // 伪造一个简单的 plugins 对象
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5].map((_, i) => ({
        name: `Chrome PDF Plugin ${i}`,
        filename: 'internal-pdf-viewer',
        description: 'Portable Document Format',
        length: 1,
        item: () => null,
        namedItem: () => null,
      })),
    });
  }

  // 4. 覆盖 permissions（假装非自动化）
  if (navigator.permissions) {
    const origQuery = navigator.permissions.query;
    navigator.permissions.query = (params) =>
      origQuery.call(navigator.permissions, params).then(status => {
        if (params.name === 'notifications') status.onchange = null;
        return status;
      });
  }

  // 5. 去除来源追踪
  Object.defineProperty(document, 'hidden', { get: () => false });
};

(async () => {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    // ⚠️ Chrome 147+ 已废弃此 flag，仅做演示
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const page = await browser.newPage();

  // 在每次页面加载前注入补丁
  await page.addInitScript(STEALTH_SCRIPT);

  await page.goto('https://www.google.com');
  console.log('✅ 方案 5：手动 stealth initScript');

  const result = await page.evaluate(() => ({
    webdriver: navigator.webdriver,
    pluginsLength: navigator.plugins.length,
  }));
  console.table(result);

  await page.waitForTimeout(3000);
  await browser.close();
})();
