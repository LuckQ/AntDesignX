<template>
  <div class="workflow-container" v-if="steps && steps.length > 0">
    <!-- 工作流程标题 -->
    <div class="workflow-header" @click="toggleWorkflow">
      <t-icon name="bulb" class="workflow-icon" />
      <span class="workflow-title">思考过程</span>
      <t-icon :name="showWorkflow ? 'chevron-up' : 'chevron-down'" class="toggle-icon" />
    </div>

    <!-- 工作流程详情 -->
    <div class="workflow-details" v-if="showWorkflow">
      <div v-for="(step, index) in filteredSteps" :key="`step-${index}`" class="workflow-step">
        <!-- 工具调用决策 -->
        <div v-if="step.node_type === 'action_decision'" class="decision-step">
          <div class="step-badge tool-badge">
            <t-icon :name="getToolIcon(step.action?.tool)" />
          </div>
          <div class="step-content">
            <!-- 思考过程显示在上方 -->
            <div v-if="step.thought" class="thought-text">
              <div class="thought-label">思考过程:</div>
              <div class="thought-content">{{ step.thought }}</div>
            </div>
            <!-- 工具调用显示在下方 -->
            <div class="tool-call">
              <div class="tool-header">
                <span class="tool-name">调用工具: {{ step.action?.tool || '未知工具' }}</span>
              </div>
              <div v-if="step.action?.tool_input" class="tool-params">
                <pre>{{ formatJson(step.action.tool_input) }}</pre>
              </div>
            </div>
          </div>
        </div>

        <!-- 工具执行结果 -->
        <div v-else-if="step.node_type === 'tool_result'" class="result-step">
          <div class="step-badge result-badge">
            <t-icon name="check-circle" />
          </div>
          <div class="step-content">
            <div class="result-header">
              <span :class="['result-status', step.is_error ? 'error' : 'success']">
                {{ step.tool || '工具' }}执行{{ step.is_error ? '失败' : '成功' }}
              </span>
            </div>
            <div v-if="!step.is_error" class="result-data">
              <pre>{{ formatToolResult(step.result) }}</pre>
            </div>
            <div v-else class="result-error">
              {{ step.result || '未知错误' }}
            </div>
          </div>
        </div>

        <!-- 其他步骤类型 -->
        <div v-else class="generic-step">
          <div class="step-badge">
            <t-icon :name="getNodeIcon(step.node_type)" />
          </div>
          <div class="step-content">
            <div class="step-title">{{ getStepTitle(step) }}</div>
            <div v-if="step.content" class="step-data">{{ step.content }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

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

// 工作流显示状态
const showWorkflow = ref(true);

// 切换工作流显示状态
const toggleWorkflow = () => {
  showWorkflow.value = !showWorkflow.value;
};

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
/* 工作流展示容器 */
.workflow-container {
  margin-bottom: 12px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--td-component-stroke, rgba(0, 0, 0, 0.08));
  background-color: var(--td-bg-color-container);
  transition: all 0.3s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  
  // 深色模式适配
  [theme-mode="dark"] & {
    border-color: var(--td-component-stroke, rgba(255, 255, 255, 0.08));
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }
}

/* 工作流标题 */
.workflow-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background-color: var(--td-bg-color-container-select);
  cursor: pointer;
  transition: all 0.3s ease;
  border-bottom: 1px solid var(--td-component-stroke, rgba(0, 0, 0, 0.08));
  
  &:hover {
    background-color: var(--td-bg-color-container-hover);
  }
  
  .workflow-icon {
    color: var(--td-brand-color);
    margin-right: 8px;
    font-size: 18px;
  }
  
  .workflow-title {
    flex: 1;
    font-weight: 500;
    font-size: 15px;
    color: var(--td-text-color-primary);
  }
  
  .toggle-icon {
    color: var(--td-text-color-secondary);
    font-size: 18px;
    transition: transform 0.3s ease;
  }
}

/* 工作流详情区域 */
.workflow-details {
  padding: 12px 16px 16px;
  transition: all 0.3s ease;
}

/* 工作流步骤 */
.workflow-step {
  position: relative;
  display: flex;
  margin-bottom: 20px;
  transition: all 0.3s ease;
  
  &:last-child {
    margin-bottom: 0;
  }
  
  &:not(:last-child)::after {
    content: '';
    position: absolute;
    top: 28px;
    left: 12px;
    width: 2px;
    height: calc(100% + 12px);
    background-color: var(--td-component-stroke);
    z-index: 1;
  }
}

/* 步骤图标 */
.step-badge {
  position: relative;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: var(--td-brand-color-light);
  color: var(--td-brand-color);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  flex-shrink: 0;
  z-index: 2;
  
  .t-icon {
    font-size: 14px;
  }
  
  &.tool-badge {
    background-color: var(--td-warning-color-light);
    color: var(--td-warning-color);
  }
  
  &.result-badge {
    background-color: var(--td-success-color-light);
    color: var(--td-success-color);
  }
}

/* 步骤内容容器 */
.step-content {
  flex: 1;
  min-width: 0;
  transition: all 0.3s ease;
}

/* 决策步骤样式 */
.decision-step {
  .thought-text {
    margin-bottom: 12px;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--td-component-stroke);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
    
    .thought-label {
      padding: 8px 12px;
      background-color: rgba(var(--td-warning-color-rgb), 0.1);
      color: var(--td-warning-color);
      font-weight: 500;
      font-size: 14px;
      border-bottom: 1px solid var(--td-component-stroke);
    }
    
    .thought-content {
      padding: 12px;
      color: var(--td-text-color-secondary);
      font-size: 13px;
      line-height: 1.6;
      white-space: pre-wrap;
      background-color: var(--td-bg-color-container);
    }
  }
  
  .tool-call {
    border: 1px solid var(--td-component-stroke);
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
    
    .tool-header {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      background-color: rgba(var(--td-warning-color-rgb), 0.1);
      color: var(--td-warning-color);
      font-weight: 500;
      
      .tool-name {
        font-size: 14px;
      }
    }
    
    .tool-params {
      padding: 12px;
      background-color: var(--td-bg-color-container);
      font-family: 'Courier New', Courier, monospace;
      font-size: 13px;
      line-height: 1.5;
      overflow-x: auto;
      
      pre {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
      }
    }
  }
}

/* 结果步骤样式 */
.result-step {
  .result-header {
    margin-bottom: 10px;
    
    .result-status {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 500;
      
      &.success {
        background-color: var(--td-success-color-light);
        color: var(--td-success-color);
      }
      
      &.error {
        background-color: var(--td-error-color-light);
        color: var(--td-error-color);
      }
    }
  }
  
  .result-data {
    padding: 12px;
    background-color: var(--td-bg-color-container-hover);
    border-radius: 8px;
    font-family: 'Courier New', Courier, monospace;
    font-size: 13px;
    line-height: 1.5;
    overflow-x: auto;
    border: 1px solid var(--td-component-stroke);
    
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
    }
  }
  
  .result-error {
    padding: 12px;
    background-color: var(--td-error-color-light);
    border-radius: 8px;
    color: var(--td-error-color);
    font-size: 13px;
  }
}

/* 通用步骤样式 */
.generic-step {
  .step-title {
    margin-bottom: 8px;
    font-weight: 500;
    color: var(--td-text-color-primary);
  }
  
  .step-data {
    padding: 12px;
    background-color: var(--td-bg-color-container-hover);
    border-radius: 8px;
    font-size: 13px;
    line-height: 1.5;
    border: 1px solid var(--td-component-stroke);
  }
}

/* 响应式调整 */
@media (max-width: 768px) {
  .workflow-container {
    margin-left: -8px;
    margin-right: -8px;
    border-radius: 0;
    border-left: none;
    border-right: none;
  }
  
  .workflow-step {
    &:not(:last-child)::after {
      left: 10px;
    }
  }
  
  .step-badge {
    width: 20px;
    height: 20px;
    margin-right: 8px;
    
    .t-icon {
      font-size: 12px;
    }
  }
  
  .tool-call .tool-header {
    padding: 6px 10px;
    
    .tool-name {
      font-size: 13px;
    }
  }
  
  .tool-params,
  .result-data,
  .thought-content {
    padding: 8px;
    font-size: 12px;
  }
}

/* 适应暗色模式 */
[theme-mode="dark"] {
  .workflow-container {
    background-color: var(--td-bg-color-container);
  }
  
  .workflow-header {
    background-color: var(--td-bg-color-container-select);
    
    &:hover {
      background-color: var(--td-bg-color-container-hover);
    }
  }
  
  .tool-call .tool-header {
    background-color: rgba(var(--td-warning-color-rgb), 0.15);
  }
  
  .thought-content,
  .tool-params,
  .result-data, 
  .step-data {
    background-color: rgba(255, 255, 255, 0.05);
  }
}
</style> 