/**
 * 聊天消息处理相关工具函数
 */

/**
 * 消息处理钩子函数
 * 提供统一的消息处理函数，减少重复代码
 * @returns {Object} 包含处理函数的对象
 */
export function useMessageHandlers() {
  /**
   * 处理思考内容更新
   * @param {Object} lastItem - 当前助手消息对象
   * @param {string} reasoningText - 思考内容
   * @param {Object} firstTokenReceived - 是否已收到第一个token的状态引用
   */
  const handleReasoningUpdate = (lastItem, reasoningText, firstTokenReceived) => {
    if (!firstTokenReceived.value) {
      firstTokenReceived.value = true;
    }

    try {
      // 如果是首次收到思考内容，则替换"思考中..."
      if (!lastItem.reasoning || lastItem.reasoning === '思考中...') {
        lastItem.reasoning = reasoningText || '';
      } else {
        // 否则，追加思考内容
        lastItem.reasoning += reasoningText || '';
      }
    } catch (e) {
      console.error('处理思考内容出错:', e);
    }
  };

  /**
   * 处理消息内容更新
   * @param {Object} lastItem - 当前助手消息对象
   * @param {string} text - 新的消息内容
   * @param {Object} firstTokenReceived - 是否已收到第一个token的状态引用
   * @param {Object} isScrolling - 是否正在滚动的状态引用
   * @param {Function} scrollFunc - 滚动到底部的函数
   * @param {Object} chatRef - 聊天容器的引用
   */
  const handleMessageUpdate = (
    lastItem, 
    text, 
    firstTokenReceived,
    isScrolling,
    scrollFunc,
    chatRef
  ) => {
    if (!firstTokenReceived.value) {
      firstTokenReceived.value = true;
    }

    try {
      // 设置或追加内容
      if (!lastItem.content) {
        lastItem.content = text || '';
      } else {
        lastItem.content += text || '';
      }

      if (text && !isScrolling.value) {
        // 添加一些延迟以确保更新后滚动
        setTimeout(() => {
          if (chatRef.value) {
            scrollFunc(chatRef.value, true);
          }
        }, 10);
      }
    } catch (e) {
      console.error('处理消息内容出错:', e);
    }
  };

  /**
   * 处理文件事件
   * @param {Object} lastItem - 当前助手消息对象
   * @param {Object} fileData - 文件数据
   */
  const handleFileEvent = (lastItem, fileData) => {
    try {
      // 确保lastItem.files是一个数组
      if (!lastItem.files) {
        lastItem.files = [];
      }

      // 添加文件到助手消息的文件列表
      lastItem.files.push(fileData);
    } catch (e) {
      console.error('处理文件事件出错:', e);
    }
  };

  /**
   * 处理工作流步骤更新
   * @param {Array} steps - 工作流步骤
   * @param {Object} chatList - 聊天列表
   * @param {Object} loading - 加载状态
   * @param {Object} firstTokenReceived - 是否已收到第一个token的状态引用
   */
  const handleWorkflowSteps = (steps, chatList, loading, firstTokenReceived) => {
    firstTokenReceived.value = true;
    if (chatList.value.length > 0) {
      const currentAssistantMessage = chatList.value[0];
      // 确保第一条消息是正在生成的助手消息
      if (currentAssistantMessage.role === 'assistant' && loading.value) {
        // 更新第一条消息的 workflowSteps
        currentAssistantMessage.workflowSteps = steps;
        // 输出更详细的日志信息
        console.log('收到工作流步骤:', steps.map(step => `${step.title}(${step.node_type})${step.loading ? '[加载中]' : ''}`));
      }
    }
  };

  return {
    handleReasoningUpdate,
    handleMessageUpdate,
    handleFileEvent,
    handleWorkflowSteps
  };
} 