/**
 * 会话和对话处理相关工具函数
 */

/**
 * 获取对话显示标题
 * @param {Object} conversation - 会话对象
 * @param {number} maxLength - 最大显示长度
 * @returns {string} 格式化后的会话标题
 */
export const getConversationTitle = (conversation, maxLength = 20) => {
  if (!conversation) return '新对话';

  // 优先使用name字段
  if (conversation.name) {
    return conversation.name.length > maxLength ? conversation.name.substring(0, maxLength) + '...' : conversation.name;
  }

  // 其次尝试使用最近的用户消息作为标题
  if (conversation.last_message && conversation.last_message.trim()) {
    return conversation.last_message.length > maxLength ? conversation.last_message.substring(0, maxLength) + '...' : conversation.last_message;
  }

  // 如果没有名称和最近消息，使用ID的一部分
  return `对话 ${conversation.id.substring(0, 8)}...`;
};

/**
 * 按时间分组对话列表
 * @param {Array} conversationList - 会话列表
 * @returns {Object} 分组后的会话对象
 */
export const groupConversationsByDate = conversationList => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const lastWeekStart = new Date(today);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  // 初始化分组
  const groups = {
    today: [],
    yesterday: [],
    lastWeek: [],
    older: [],
  };

  // 分类每个对话
  conversationList.forEach(conversation => {
    // 解析更新时间 - 服务器返回的是Unix时间戳（秒级）
    let updateTime;
    if (conversation.updated_at) {
      // 将秒级时间戳转换为毫秒级
      updateTime = new Date(conversation.updated_at * 1000);
    } else {
      updateTime = new Date(); // 如果没有更新时间，默认为当前时间
    }

    // 只比较日期，不比较时间
    const updateDate = new Date(updateTime);
    updateDate.setHours(0, 0, 0, 0);

    if (updateDate.getTime() === today.getTime()) {
      groups.today.push(conversation);
    } else if (updateDate.getTime() === yesterday.getTime()) {
      groups.yesterday.push(conversation);
    } else if (updateDate.getTime() >= lastWeekStart.getTime()) {
      groups.lastWeek.push(conversation);
    } else {
      groups.older.push(conversation);
    }
  });

  return groups;
};

/**
 * 创建防抖函数
 * @param {Function} fn - 要执行的函数
 * @param {number} delay - 延迟时间
 * @returns {Function} 防抖处理后的函数
 */
export const debounce = (fn, delay) => {
  let timer = null;

  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(null, args);
      timer = null;
    }, delay);
  };
};

/**
 * 重置会话状态
 * @param {Object} options - 会话相关的状态和函数对象
 * @param {Object} options.currentConversationId - 当前会话ID的引用
 * @param {Object} options.chatList - 聊天列表的引用
 * @param {Object} options.suggestedQuestions - 建议问题列表的引用
 * @param {Object} options.suggestedQuestionsConversationId - 建议问题相关会话ID的引用
 * @param {Object} options.isNewConversation - 标识是否为新会话的引用
 * @param {Function} options.resetConversationFunc - 重置会话的函数
 */
export const resetConversationState = ({
  currentConversationId,
  chatList,
  suggestedQuestions,
  suggestedQuestionsConversationId,
  isNewConversation,
  resetConversationFunc,
}) => {
  // 重置会话状态
  resetConversationFunc();
  currentConversationId.value = '';
  chatList.value = [];
  // 清空建议问题列表
  suggestedQuestions.value = [];
  suggestedQuestionsConversationId.value = '';
  // 设置为新会话
  if (isNewConversation) {
    isNewConversation.value = true;
  }
};
