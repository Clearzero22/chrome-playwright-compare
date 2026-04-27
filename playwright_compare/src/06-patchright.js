/**
 * 方案 6：Patchright — Playwright 协议级补丁
 * drop-in 替换，CDP 协议层处理 Runtime.enable 泄漏等检测点
 *
 * 安装：
 *   npm install patchright
 *   npx patchright install chrome
 *
 * 注意：patchright 尚不是稳定包，安装后如遇问题可降级到 playwright 手动对比
 */
// const { chromium } = require('patchright');
//
// (async () => {
//   const browser = await chromium.launch({
//     channel: 'chrome',
//     headless: false,
//   });
//   // ... 使用方式与 Playwright 完全一致
// })();

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
方案 6: Patchright

安装：
  npm install patchright
  npx patchright install chrome

使用：
  const { chromium } = require('patchright');

核心补丁：
  - 消除 Runtime.enable 的 timing 泄漏 (CDP 协议层)
  - 禁用 Console API 防检测
  - 移除 --enable-automation、--disable-component-update 等 flag
  - 替换二进制中的 cdc_ 签名

与方案 2 (Puppeteer Stealth) 配合可达到当前最强隐身效果。
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
