/**
 * 跨平台 Chrome 路径/启动工具
 * 自动适配 macOS / Windows / Linux
 */
const os = require('os');
const path = require('path');

function getChromePath() {
  const platform = os.platform();
  switch (platform) {
    case 'darwin':
      return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    case 'win32': {
      const candidates = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      ];
      return candidates; // 返回候选列表
    }
    case 'linux':
      return '/usr/bin/google-chrome';
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

/** 通过 channel 查找 Chrome（推荐，跨平台最干净） */
function getChromeLaunchOptions() {
  return { channel: 'chrome' };
}

module.exports = { getChromePath, getChromeLaunchOptions };
