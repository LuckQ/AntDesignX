# 样式系统使用说明

## 文件结构

- `variables.scss`: 包含所有样式变量，从TDesign引入的CSS变量
- `index.scss`: 主样式文件，导入所有其他样式文件，提供通用样式类
- `overrides.scss`: 覆盖TDesign默认样式的文件
- `dark-theme.scss`: 暗黑模式专用样式文件

## 使用方法

### 1. 在Vue组件中引入样式

在Vue组件中引入样式系统:

```vue
<style lang="scss">
@use '/static//styles/index.scss';

// 组件特定样式...
</style>
```

### 2. 使用变量

如果需要使用变量:

```vue
<style lang="scss">
@use '/static//styles/variables.scss' as vars;

.my-component {
  color: vars.$brand-color;
  margin: vars.$comp-margin-m;
  padding: vars.$comp-paddingTB-m vars.$comp-paddingLR-m;
}
</style>
```

### 3. 使用工具类

组件中可以直接使用预定义的工具类:

```html
<div class="app-card m-m">
  <h2 class="text-primary mb-s">标题</h2>
  <p class="text-secondary">内容</p>
  <button class="app-button app-button--primary mt-m">按钮</button>
</div>
```

## 可用工具类

### 边距类

- `.m-*`: 外边距 (xxs, xs, s, m, l, xl, xxl)
- `.mt-*`: 上外边距
- `.mr-*`: 右外边距
- `.mb-*`: 下外边距
- `.ml-*`: 左外边距
- `.p-*`: 内边距
- `.pt-*`: 上内边距
- `.pr-*`: 右内边距
- `.pb-*`: 下内边距
- `.pl-*`: 左内边距

### 文本类

- `.text-primary`: 主要文本颜色
- `.text-secondary`: 次要文本颜色
- `.text-placeholder`: 占位符文本颜色
- `.text-disabled`: 禁用状态文本颜色
- `.text-brand`: 品牌色文本
- `.text-link`: 链接文本颜色
- `.text-success`: 成功状态文本颜色
- `.text-warning`: 警告状态文本颜色
- `.text-error`: 错误状态文本颜色

### 组件类

- `.app-card`: 卡片组件
- `.app-button`: 基础按钮
  - `.app-button--primary`: 主要按钮
  - `.app-button--success`: 成功按钮
  - `.app-button--warning`: 警告按钮
  - `.app-button--danger`: 危险按钮
- `.app-input`: 输入框
- `.custom-scrollbar`: 自定义滚动条

## 主题切换

系统支持亮色和暗色模式，通过在根元素上设置`theme-mode`属性切换:

```javascript
// 设置暗色模式
document.documentElement.setAttribute('theme-mode', 'dark');

// 设置亮色模式
document.documentElement.setAttribute('theme-mode', 'light');
```

## 变量参考

请参考`variables.scss`文件获取所有可用的变量。主要变量类别包括:

- 颜色变量 (品牌色、警告色、错误色、成功色、灰度色)
- 字体变量 (字体族、字体大小、行高)
- 尺寸变量 (基础尺寸、组件尺寸)
- 内外边距变量
- 圆角变量
- 阴影变量
- 过渡变量