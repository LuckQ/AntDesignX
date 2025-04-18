/**
 * 主题管理工具
 */

// 主题类型
export const ThemeMode = {
  LIGHT: 'light',
  DARK: 'dark',
};

/**
 * 设置主题模式
 * @param {string} mode - 主题模式，可选值: 'light' | 'dark'
 */
export function setThemeMode(mode) {
  if (mode !== ThemeMode.LIGHT && mode !== ThemeMode.DARK) {
    console.warn(`Invalid theme mode: ${mode}, using default: ${ThemeMode.LIGHT}`);
    mode = ThemeMode.LIGHT;
  }
  
  document.documentElement.setAttribute('theme-mode', mode);
  localStorage.setItem('theme-mode', mode);
}

/**
 * 获取当前主题模式
 * @returns {string} 当前主题模式
 */
export function getThemeMode() {
  return document.documentElement.getAttribute('theme-mode') || ThemeMode.LIGHT;
}

/**
 * 切换主题模式
 * @returns {string} 切换后的主题模式
 */
export function toggleThemeMode() {
  const currentMode = getThemeMode();
  const newMode = currentMode === ThemeMode.DARK ? ThemeMode.LIGHT : ThemeMode.DARK;
  
  setThemeMode(newMode);
  return newMode;
}

/**
 * 初始化主题
 * 从本地存储加载主题设置，如果没有则使用系统偏好
 */
export function initTheme() {
  // 从本地存储中获取主题设置
  const savedTheme = localStorage.getItem('theme-mode');
  
  if (savedTheme) {
    // 使用保存的主题设置
    setThemeMode(savedTheme);
  } else {
    // 检查系统是否偏好暗色模式
    const prefersDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setThemeMode(prefersDarkMode ? ThemeMode.DARK : ThemeMode.LIGHT);
  }
} 