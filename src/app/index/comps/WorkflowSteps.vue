<template>
  <div class="workflow-steps-list">
    <!-- 遍历每个步骤 -->
    <template v-for="(step, index) in filteredSteps" :key="`step-${index}`">
      <!-- 思考卡片 - 简化版 -->
      <div v-if="step.node_type === 'action_decision' && step.thought" class="workflow-step-card thought-card">
        <div class="step-row">
          <div class="step-icon thought">
            <t-icon name="chat-bubble-history" />
          </div>
          <div class="step-main">
            <div class="step-desc">{{ step.thought }}</div>
          </div>
        </div>
      </div>

      <!-- 工具调用决策卡片 -->
      <div v-if="step.node_type === 'action_decision'" class="workflow-step-card">
        <div class="step-row">
          <div class="step-icon tool">
            <t-icon :name="getToolIcon(step.action?.tool)" />
          </div>
          <div class="step-main">
            <div class="step-tool-params">
              <span class="step-tool-name">{{ step.action?.tool || '未知工具' }}</span>
              <!-- <pre v-if="step.action?.tool_input" class="step-json">{{ formatJson(step.action.tool_input) }}</pre> -->
            </div>
          </div>
        </div>
      </div>

      <!-- 工具执行结果卡片 -->
      <div v-if="step.node_type === 'tool_result'" class="workflow-step-card">
        <div class="step-row">
          <div class="step-icon result" :class="step.is_error ? 'error' : 'success'">
            <t-icon :name="step.is_error ? 'close-circle' : 'check-circle'" />
          </div>
          <div class="step-main">
            <div class="step-result-title" :class="step.is_error ? 'error' : 'success'">
              {{ step.tool || '工具' }}执行{{ step.is_error ? '失败' : '成功' }}
            </div>
            <pre v-if="!step.is_error" class="step-json">{{ formatToolResult(step.result) }}</pre>
            <div v-else class="step-error-msg">{{ step.result || '未知错误' }}</div>
          </div>
        </div>
      </div>

      <!-- 其他类型卡片 -->
      <div v-if="step.node_type !== 'action_decision' && step.node_type !== 'tool_result'" class="workflow-step-card">
        <div class="step-row">
          <div class="step-icon">
            <t-icon :name="getNodeIcon(step.node_type)" />
          </div>
          <div class="step-main">
            <div class="step-title">{{ getStepTitle(step) }}</div>
            <div v-if="step.content" class="step-desc">{{ step.content }}</div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { Icon } from 'tdesign-vue-next';

// 定义组件的属性
const props = defineProps({
  steps: {
    type: Array,
    default: () => []
  }
});

// 过滤掉最终回答步骤
const filteredSteps = computed(() => {
  return props.steps.filter(step => step.node_type !== 'final_answer');
});

// 工具图标映射
const toolIconMap = {
  'weather': 'cloud',
  'calculator': 'discount',
  'search': 'search',
  'web_search': 'internet',
  'database': 'server',
  'file': 'file',
  'api': 'api',
  'default': 'tools'
};

// 节点图标映射
const nodeIconMap = {
  'default': 'check-circle-filled',
  'start': 'play-circle-filled',
  'http': 'link',
  'condition': 'swap',
  'time': 'time',
  'search': 'search',
  'extract': 'filter',
  'web': 'internet',
  'file': 'file',
  'model': 'root-list',
  'reply': 'chat',
  'error': 'error-circle',
  'tool': 'tools',
  'action_decision': 'tools',
  'tool_result': 'check'
};

// 获取工具图标
const getToolIcon = (toolName) => {
  if (!toolName) return toolIconMap.default;
  return toolIconMap[toolName.toLowerCase()] || toolIconMap.default;
};

// 获取节点图标
const getNodeIcon = (nodeType) => {
  return nodeIconMap[nodeType] || nodeIconMap.default;
};

// 获取步骤标题
const getStepTitle = (step) => {
  if (step.node_type === 'action_decision') {
    return `调用${step.action?.tool || '未知工具'}工具`;
  } else if (step.node_type === 'tool_result') {
    return `处理${step.tool || '工具'}结果`;
  } else {
    return step.title || '未知步骤';
  }
};

// 格式化JSON工具结果
const formatToolResult = (result) => {
  if (!result) return '无结果数据';

  try {
    // 如果是JSON字符串，尝试解析并格式化
    if (typeof result === 'string' && (result.startsWith('{') || result.startsWith('['))) {
      const parsed = JSON.parse(result);
      return JSON.stringify(parsed, null, 2);
    }
  } catch (e) {
    // 解析失败，按原样返回
  }

  // 如果已经是对象，直接格式化
  if (typeof result === 'object' && result !== null) {
    return JSON.stringify(result, null, 2);
  }

  // 其他情况直接返回字符串
  return String(result);
};

// 通用JSON格式化函数
const formatJson = (data) => {
  if (!data) return '';
  return JSON.stringify(data, null, 2);
};
</script>

<style lang="scss" scoped>
@use '/static/styles/variables.scss' as vars;

/* 步骤列表区块 */
.workflow-steps-list {
  margin: 10px 6px 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
}

/* 单个步骤卡片 */
.workflow-step-card {
  background: var(--td-bg-color-container);
  border-radius: 10px;
  padding: 10px;
  margin-bottom: 10px;
  border: 1px solid var(--td-component-stroke);
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.05);
  width: max-content;
  max-width: calc(100% - 10px);
  align-self: flex-start;

  &.thought-card {
    background: var(--td-bg-color-container-hover);
  }
}

/* 步骤主行 */
.step-row {
  display: flex;
  align-items: flex-start;
  max-width: 100%;
}

/* 步骤图标 */
.step-icon {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--td-brand-color-light);
  color: var(--td-brand-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  margin-right: 6px;
  flex-shrink: 0;

  &.thought {
    background: var(--td-brand-color-light-hover);
    color: var(--td-brand-color);
  }

  &.tool {
    background: var(--td-warning-color-light);
    color: var(--td-warning-color);
  }

  &.result.success {
    background: var(--td-success-color-light);
    color: var(--td-success-color);
  }

  &.result.error {
    background: var(--td-error-color-light);
    color: var(--td-error-color);
  }
}

/* 步骤内容区 */
.step-main {
  flex: 0 1 auto;
  min-width: 0;
  // max-width: calc(100% - 52px);
  /* 图标宽度+右边距 */
}

/* 步骤描述 */
.step-desc {
  font-size: 15px;
  color: var(--td-text-color-secondary);
  line-height: 1.7;
  word-break: break-all;
  white-space: pre-wrap;
  overflow-wrap: break-word;
}

/* 工具参数区块 */
.step-tool-params {
  // background: var(--td-bg-color-container-hover);
  border-radius: 6px;
  // padding: 0px 12px;
  margin-top: 2px;
  width: 100%;
  box-sizing: border-box;

  .step-tool-name {
    font-weight: 500;
    color: var(--td-warning-color);
    font-size: 14px;
    display: block;
  }
}

/* JSON高亮 */
.step-json {
  background: none;
  color: var(--td-text-color-primary);
  font-size: 13px;
  margin: 0;
  padding: 0;
  white-space: pre-wrap;
  word-break: break-all;
  overflow-wrap: break-word;
  width: 100%;
  box-sizing: border-box;
}

/* 结果标题 */
.step-result-title {
  font-size: 15px;
  font-weight: 500;
  margin-bottom: 6px;

  &.success {
    color: var(--td-success-color);
  }

  &.error {
    color: var(--td-error-color);
  }
}

/* 错误信息 */
.step-error-msg {
  color: var(--td-error-color);
  background: var(--td-error-color-light);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
  margin-top: 4px;
  word-break: break-all;
  overflow-wrap: break-word;
}

/* 其他类型标题 */
.step-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--td-text-color-primary);
  margin-bottom: 4px;
}

/* 响应式优化 */
@media (max-width: 768px) {
  .workflow-step-card {
    padding: 12px;
    margin-bottom: 8px;
    width: calc(100% - 10px);
  }

  .step-icon {
    width: 28px;
    height: 28px;
    font-size: 16px;
    margin-right: 8px;
  }

  .step-main {
    font-size: 13px;
    max-width: calc(100% - 36px);
  }

  .step-desc {
    font-size: 14px;
  }
}
</style>