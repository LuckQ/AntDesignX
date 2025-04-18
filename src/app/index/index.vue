<template>
    <div class="app-container">
        <!-- 侧边栏区域 -->
        <ConversationSidebar v-model:visible="showConversationDrawer" :current-conversation-id="currentConversationId"
            :grouped-conversations="groupedConversations" :has-more-conversations="hasMoreConversations"
            :loading-more-conversations="loadingMoreConversations" :is-loading="conversationListLoading"
            :active-section="activeSection" @select="handleConversationSelect" @new-conversation="handleNewConversation"
            @load-more="loadMoreConversations" @rename-conversation="showRenameDialogFor"
            @pin-conversation="handlePinConversation" @show-knowledge-base="goToDatasetManagement"
            @chat-section="handleChatClick" />

        <!-- 主内容区域 -->
        <div class="main-content"
            :class="{ 'sidebar-open': showConversationDrawer, 'sidebar-closed': !showConversationDrawer }">
            <!-- 顶部导航栏 -->
            <HeaderNav :title="showKnowledgeBase ? '知识库管理' : currentConversationTitle"
                :sidebar-visible="showConversationDrawer" @open-drawer="toggleSidebar"
                @new-conversation="handleNewConversation" @model-changed="handleModelChanged">
            </HeaderNav>

            <!-- 知识库管理区域 -->
            <div v-if="showKnowledgeBase" class="knowledge-base-wrapper">
                <KnowledgeBase 
                    :current-dataset-id="currentDatasetId" 
                    :current-dataset-path="currentDatasetPath"
                    @dataset-detail="goToDatasetDetail" />
            </div>

            <!-- 聊天内容区域 -->
            <div v-else class="chat-wrapper">
                <transition name="fade">
                    <t-chat class="chat-container" ref="chatRef" layout="both" :clear-history="false"
                        @clear="clearConfirm" @scroll="handleScroll">
                        <!-- 1. 内容加载骨架屏 -->
                        <template v-if="historyLoading">
                            <transition name="skeleton-fade" appear>
                                <ChatSkeleton />
                            </transition>
                        </template>

                        <!-- 2. 聊天消息内容列表 -->
                        <template v-else-if="chatList.length > 0">
                            <transition-group name="chat-items" appear>
                                <chat-item v-for="(item, index) in chatList" :key="index" :avatar="item.avatar"
                                    :name="item.name" :role="item.role" :datetime="item.datetime"
                                    :content="item.content" :reasoning="item.reasoning" :is-first-message="index === 0"
                                    :loading="loading" :first-token-received="firstTokenReceived"
                                    :is-stream-load="isStreamLoad" :is-good="isGood" :is-bad="isBad" :files="item.files"
                                    :workflow-steps="item.workflowSteps"
                                    :style="{ '--item-index': chatList.length - index }"
                                    @reasoning-expand-change="(expandValue) => handleChange(expandValue, { index })"
                                    @operation="(type, e) => handleOperation(type, { index, e })" />
                            </transition-group>
                        </template>

                        <!-- 3. 欢迎面板（新会话时显示） -->
                        <template v-else-if="isNewConversation">
                            <transition name="welcome-fade" appear>
                                <WelcomePanel :suggested-questions="defaultSuggestedQuestions"
                                    logoSrc="/static/images/logo.png" @question-click="handleSuggestedQuestion" />
                            </transition>
                        </template>

                        <!-- 底部发送区域 -->
                        <template #footer>
                            <!-- 建议问题标签 -->
                            <transition name="suggestions-slide">
                                <div v-if="suggestedQuestions.length > 0" class="suggested-questions-container">
                                    <div class="suggested-questions">
                                        <t-tag v-for="(question, qIndex) in suggestedQuestions" :key="qIndex"
                                            theme="primary" variant="light" class="question-tag" size="medium"
                                            @click="handleSuggestedQuestion(question)">
                                            {{ question }}
                                        </t-tag>
                                    </div>
                                </div>
                            </transition>
                            <!-- 聊天输入发送组件 -->
                            <chat-sender :loading="loading" @send="inputEnter" @stop="onStop" />
                        </template>
                    </t-chat>
                </transition>
            </div>
        </div>

        <!-- 对话操作弹窗 -->
        <!-- 1. 重命名对话弹窗 -->
        <t-dialog width="35%" v-model:visible="showRenameDialog" header="重命名对话"
            :confirm-btn="{ content: '确定', theme: 'primary' }" :cancel-btn="{ content: '取消', theme: 'default' }"
            @confirm="confirmRename" @close="cancelRename">
            <t-input v-model="renameInput" type="text" :maxlength="100" placeholder="请输入新名称" clearable autofocus
                @enter="confirmRename" />
        </t-dialog>

        <!-- 2. 删除对话确认框 -->
        <t-dialog width="35%" v-model:visible="showDeleteDialog" header="删除对话"
            :confirm-btn="{ content: '确定', theme: 'danger' }" :cancel-btn="{ content: '取消', theme: 'default' }"
            @confirm="confirmDelete" @close="cancelDelete">
            <p class="dialog-content">确定要删除该对话吗？此操作不可恢复。</p>
        </t-dialog>
    </div>
</template>

<script setup lang="ts">
/*————————————————————————————————————————————————组件依赖导入————————————————————————————————————————————————*/
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue';
import { chatWithModel, loadSystemPrompt, resetConversation } from '/static/api/model.js'
import ChatAction from './comps/ChatAction.vue';
import ChatSender from './comps/ChatSender.vue';
import HeaderNav from './comps/HeaderNav.vue';
import ConversationSidebar from './comps/ConversationSidebar.vue';
import ChatItem from './comps/ChatItem.vue';
import WelcomePanel from './comps/WelcomePanel.vue'; // 导入欢迎组件
import ChatSkeleton from './comps/ChatSkeleton.vue'; // 导入骨架加载组件
import KnowledgeBase from '../dataset/index.vue'; // 导入知识库管理组件
import { MessagePlugin } from 'tdesign-vue-next';
import {
    getChatHistory,
    saveChatHistory,
    clearChatHistory,
    buildMessageHistory,
    scrollToBottom as scrollChatToBottom,
    createUserMessage,
    createAssistantMessage,
    getServerConversations,
    getServerConversationHistory,
    renameConversation,
    deleteConversation,
    getCurrentConversation,
    autoRenameConversationIfNeeded,
    getSuggestedQuestions
} from '/static/api/chat.js';
import {
    createRequestController,
    createTimeoutProtection,
    handleRequestAbort,
    handleRequestError,
    handleRequestComplete,
    stopStreamResponse
} from '/static/api/request.js';
import { initTheme, setThemeMode, ThemeMode } from '/static/api/theme.js';
import { useMessageHandlers } from '/static/api/messageHandlers.js'; // 导入消息处理工具函数
import {
    getConversationTitle,
    groupConversationsByDate,
    debounce,
    resetConversationState
} from '/static/api/conversationUtils.js'; // 导入会话处理工具函数

/*————————————————————————————————————————————————基础状态变量————————————————————————————————————————————————*/
const fetchCancel = ref(null); // 用于取消请求的AbortController
const loading = ref(false); // 是否正在加载中
const isStreamLoad = ref(false); // 是否正在流式加载
const isGood = ref(false); // 用户是否点击了"好"评价
const isBad = ref(false); // 用户是否点击了"差"评价
const chatRef = ref(null); // 聊天容器的引用
const firstTokenReceived = ref(false); // 是否已收到第一个token
const chatList = ref([]);
const systemPrompt = ref('');
const isScrolling = ref(false); // 是否正在滚动，用于控制自动滚动行为

/*————————————————————————————————————————————————会话列表状态变量————————————————————————————————————————————————*/
const conversationList = ref([]);
const currentConversationId = ref('');
const currentPage = ref(1);
const pageSize = ref(20);
const hasMoreMessages = ref(true);
const loadingMore = ref(false);
const scrollTopThreshold = 50; // 滚动到顶部触发阈值
const conversationListLoading = ref(false); // 新增：会话列表加载状态
const hasMoreConversations = ref(true); // 是否有更多会话可加载
const loadingMoreConversations = ref(false); // 是否正在加载更多会话
const showConversationDrawer = ref(true); // 是否显示对话列表抽屉

/*————————————————————————————————————————————————对话操作状态变量————————————————————————————————————————————————*/
// 重命名对话相关状态
const showRenameDialog = ref(false);
const renameInput = ref('');
const currentEditingId = ref('');

// 删除对话相关状态
const showDeleteDialog = ref(false);
const currentDeletingId = ref('');

/*————————————————————————————————————————————————消息与任务状态变量————————————————————————————————————————————————*/
// 保存当前任务ID
const currentTaskId = ref(null);
// 保存当前消息ID
const currentMessageId = ref('');
// 保存建议问题列表
const suggestedQuestions = ref([]);
// 保存建议问题关联的会话ID
const suggestedQuestionsConversationId = ref('');
// 用于防抖的计时器引用
const switchConversationTimer = ref(null);
// 当前活动的加载请求控制器
const activeLoadController = ref(null);
// 历史消息是否正在加载的状态
const historyLoading = ref(false);
// 是否为新会话的状态
const isNewConversation = ref(true);

/*————————————————————————————————————————————————欢迎界面配置————————————————————————————————————————————————*/
// 欢迎界面的默认建议问题
const defaultSuggestedQuestions = ref([
    "介绍一下金钟集团",
    "金钟集团有哪些产品",
    "金钟集团的优势",
]);

/*————————————————————————————————————————————————知识库与路由状态————————————————————————————————————————————————*/
// 知识库管理状态变量
const showKnowledgeBase = ref(false);
// 当前激活的部分状态
const activeSection = ref('chat'); // 'chat' 或 'knowledge'
// 当前选中的模型ID
const currentModelId = ref('');
// 知识库详情相关状态变量
const currentDatasetId = ref(''); // 当前知识库ID
const currentDatasetPath = ref(''); // 当前知识库路径

/*————————————————————————————————————————————————URL状态管理函数————————————————————————————————————————————————*/
// 区分聊天页面和知识库页面
const updateUrlState = () => {
  // 构建URL参数对象
  const urlParams = new URLSearchParams();
  
  // 根据页面类型添加不同参数
  if (showKnowledgeBase.value) {
    // 知识库页面: 添加page=knowledge参数
    urlParams.set('page', 'knowledge');
    
    // 如果有知识库ID和路径，添加到URL
    if (currentDatasetId.value) {
      urlParams.set('dataset_id', currentDatasetId.value);
    }
    
    if (currentDatasetPath.value) {
      urlParams.set('dataset_path', currentDatasetPath.value);
    }
  } else {
    // 聊天页面: 添加page=chat和conversation参数
    urlParams.set('page', 'chat');
    
    // 添加会话ID（如果存在）
    if (currentConversationId.value) {
      urlParams.set('conversation', currentConversationId.value);
    }
  }
  
  // 添加模型ID（如果存在）- 这是共用的
  if (currentModelId.value) {
    urlParams.set('model', currentModelId.value);
  }
  
  // 构建新的URL路径
  const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
  
  // 更新浏览器历史记录，不重新加载页面
  window.history.replaceState({}, '', newUrl);
  
  console.log('URL状态已更新:', newUrl);
};

// 解析URL中的知识库相关参数
const parseUrlState = async () => {
  const urlParams = new URLSearchParams(window.location.search);
  
  // 获取页面状态（知识库或聊天）
  const pageState = urlParams.get('page');
  if (pageState === 'knowledge') {
    showKnowledgeBase.value = true;
    activeSection.value = 'knowledge';
    
    // 解析知识库ID和路径
    const datasetId = urlParams.get('dataset_id');
    const datasetPath = urlParams.get('dataset_path');
    
    if (datasetId) {
      currentDatasetId.value = datasetId;
    }
    
    if (datasetPath) {
      currentDatasetPath.value = datasetPath;
    }
    
    console.log('从URL恢复知识库详情:', { datasetId, datasetPath });
  } else {
    showKnowledgeBase.value = false;
    activeSection.value = 'chat';
    
    // 清空知识库相关状态
    currentDatasetId.value = '';
    currentDatasetPath.value = '';
  }
  
  // 获取模型ID
  const modelId = urlParams.get('model');
  if (modelId) {
    currentModelId.value = modelId;
    console.log('从URL恢复模型ID:', modelId);
  }
  
  // 只有在聊天页面时才获取会话ID
  if (pageState !== 'knowledge') {
    const conversationId = urlParams.get('conversation');
    if (conversationId) {
      console.log('从URL恢复会话ID:', conversationId);
      // 确保会话列表已加载
      if (conversationList.value.length === 0) {
        await initChatData();
      }
      
      // 设置当前会话ID并加载历史
      if (conversationId !== currentConversationId.value) {
        currentConversationId.value = conversationId;
        isNewConversation.value = false;
        historyLoading.value = true;
        chatList.value = [];
        await loadConversationHistory(conversationId);
      }
    }
  }
};

/*————————————————————————————————————————————————响应式监听处理————————————————————————————————————————————————*/
// 添加知识库相关状态的监听
watch(() => currentDatasetId.value, (newValue) => {
  updateUrlState();
});

watch(() => currentDatasetPath.value, (newValue) => {
  updateUrlState();
});

// 监听状态变化并更新URL
watch(() => currentConversationId.value, (newValue) => {
  updateUrlState();
});

watch(() => showKnowledgeBase.value, (newValue) => {
  updateUrlState();
});

watch(() => currentModelId.value, (newValue) => {
  updateUrlState();
});

/*————————————————————————————————————————————————生命周期钩子————————————————————————————————————————————————*/
onMounted(async () => {
  // 初始化主题
  initTheme();
  
  // 先解析URL状态，再初始化聊天数据
  await parseUrlState();
  
  // 如果URL中没有会话ID，则正常初始化聊天数据
  // 但需要保留通过URL设置的页面状态
  if (!currentConversationId.value) {
    // 保存当前的页面状态
    const currentPageState = {
      showKnowledgeBase: showKnowledgeBase.value,
      activeSection: activeSection.value
    };
    
    // 初始化聊天数据
    await initChatData();
    
    // 恢复页面状态
    if (currentPageState.showKnowledgeBase) {
      showKnowledgeBase.value = true;
      activeSection.value = 'knowledge';
    }
  }
});

/*————————————————————————————————————————————————模型切换处理————————————————————————————————————————————————*/
// 处理模型切换事件
const handleModelChanged = (payload: { modelId: string; model: object }) => {
  console.log('模型已切换，立即显示加载状态并准备加载新数据:', payload);
  // 更新当前模型ID
  currentModelId.value = payload.modelId;
  
  // 立即设置加载状态并清空列表，以显示骨架屏
  historyLoading.value = true;
  conversationListLoading.value = true; // 同时设置侧边栏加载状态
  chatList.value = [];
  // 清空建议问题
  suggestedQuestions.value = [];
  suggestedQuestionsConversationId.value = '';

  // 切换模型后，重新初始化聊天数据，这会加载会话列表并可能切换到默认会话
  initChatData();
};

/*————————————————————————————————————————————————页面切换处理————————————————————————————————————————————————*/
// 进入知识库管理页面
const goToDatasetManagement = (params = {}) => {
  showKnowledgeBase.value = true;
  activeSection.value = 'knowledge';
  
  // 如果传入了知识库ID和路径，更新状态
  if (params.datasetId) {
    currentDatasetId.value = params.datasetId;
  }
  
  if (params.datasetPath) {
    currentDatasetPath.value = params.datasetPath;
  }
  
  // 更新URL状态
  updateUrlState();
};

// 返回聊天页面
const handleChatClick = () => {
  showKnowledgeBase.value = false;
  activeSection.value = 'chat';
  // 更新URL状态
  updateUrlState();
};

/*————————————————————————————————————————————————会话选择处理————————————————————————————————————————————————*/
// 处理会话选择
const handleConversationSelect = async (option) => {
  const value = option.value;

  // 处理删除选项
  if (typeof value === 'string' && value.startsWith('delete-')) {
    const conversationId = value.substring(7); // 去掉"delete-"前缀

    // 显示删除确认框
    currentDeletingId.value = conversationId;
    showDeleteDialog.value = true;

    return;
  }

  // 处理新对话选项
  if (value === 'new') {
    resetConversationState({
      currentConversationId,
      chatList,
      suggestedQuestions,
      suggestedQuestionsConversationId,
      isNewConversation,
      resetConversationFunc: resetConversation
    });
    // 确保活动部分是聊天
    activeSection.value = 'chat';
    showKnowledgeBase.value = false;
    // 更新URL状态
    updateUrlState();
    return;
  }

  // 处理切换对话
  if (value !== currentConversationId.value) {
    // 先清空建议问题列表，触发动画效果
    suggestedQuestions.value = [];
    suggestedQuestionsConversationId.value = '';

    // 先更新会话ID，保证UI立即响应
    currentConversationId.value = value;
    // 设置加载状态为true
    historyLoading.value = true;
    // 清空当前聊天列表，以便骨架屏显示
    chatList.value = [];
    // 设置为非新会话
    isNewConversation.value = false;
    // 确保活动部分是聊天
    activeSection.value = 'chat';
    showKnowledgeBase.value = false;

    // URL状态会通过监听器自动更新

    // 取消之前的计时器（如果存在）
    if (switchConversationTimer.value) {
      clearTimeout(switchConversationTimer.value);
    }

    // 取消之前的加载请求（如果存在）
    if (activeLoadController.value) {
      try {
        activeLoadController.value.abort();
        console.log('已取消之前的对话加载请求');
      } catch (error) {
        console.error('取消之前的请求失败:', error);
      }
    }

    // 创建新的控制器
    const controller = new AbortController();
    activeLoadController.value = controller;

    // 使用防抖函数加载历史消息
    debouncedLoadHistory(value, controller);
  }
};

// 创建新会话
const handleNewConversation = () => {
  resetConversationState({
    currentConversationId,
    chatList,
    suggestedQuestions,
    suggestedQuestionsConversationId,
    isNewConversation,
    resetConversationFunc: resetConversation
  });
  // URL状态会通过监听器自动更新
};

/*————————————————————————————————————————————————计算属性————————————————————————————————————————————————*/
// 当前会话标题，优先显示最近一次的用户消息，如果没有则显示会话ID的前8位
const currentConversationTitle = computed(() => {
    const conversation = conversationList.value.find(c => c.id === currentConversationId.value);
    return getConversationTitle(conversation, 15);
});

// 将对话按日期分组：今天、昨天、过去7天、更早
const groupedConversations = computed(() => {
    return groupConversationsByDate(conversationList.value);
});

/*————————————————————————————————————————————————会话初始化与数据加载————————————————————————————————————————————————*/
// 初始化聊天数据
const initChatData = async () => {
  // 检查是否通过URL指定了页面状态
  const urlParams = new URLSearchParams(window.location.search);
  const pageState = urlParams.get('page');
  
  // 只有当URL没有指定knowledge页面时，才重置为聊天页面
  if (pageState !== 'knowledge') {
    activeSection.value = 'chat';
    showKnowledgeBase.value = false;
  }

  // 获取系统提示词
  try {
    systemPrompt.value = await loadSystemPrompt();
  } catch (error) {
    console.error('系统提示词加载失败:', error);
  }
  // 开始加载列表，设置加载状态
  conversationListLoading.value = true;
  // 获取服务器会话列表
  try {
    // 使用新参数调用，每次加载20条对话
    const serverConversations = await getServerConversations({
      limit: 20,
      sort_by: '-updated_at'
    });
    // 确保返回的数据是数组
    if (serverConversations && Array.isArray(serverConversations)) {
      conversationList.value = serverConversations;

      // 判断是否还有更多对话可加载
      hasMoreConversations.value = serverConversations.length >= 20;

      // 只有当不在知识库页面时，才加载会话历史
      if (!showKnowledgeBase.value) {
        // 获取默认会话ID
        const defaultConversationId = await getCurrentConversation();
        if (defaultConversationId) {
          currentConversationId.value = defaultConversationId;
          isNewConversation.value = false;
          await loadConversationHistory(defaultConversationId);
        } else {
          // 如果没有会话，创建新对话
          currentConversationId.value = '';
          chatList.value = [];
          isNewConversation.value = true;
          // 确保重置历史加载状态，以便显示欢迎页面
          historyLoading.value = false;
        }

        // 如果会话列表为空数组，直接显示欢迎页面
        if (serverConversations.length === 0) {
          currentConversationId.value = '';
          chatList.value = [];
          isNewConversation.value = true;
          historyLoading.value = false;
        }
      }
    } else {
      console.error('服务器返回的会话列表数据格式不正确:', serverConversations);
      // 创建新会话
      currentConversationId.value = '';
      chatList.value = [];
      isNewConversation.value = true;
      historyLoading.value = false;
    }
  } catch (error) {
    console.error('获取服务器会话列表失败:', error);
    // 创建新会话
    currentConversationId.value = '';
    chatList.value = [];
    isNewConversation.value = true;
    historyLoading.value = false;
  } finally {
    // 结束加载列表，重置加载状态
    conversationListLoading.value = false;
  }
};

/*————————————————————————————————————————————————历史消息加载处理————————————————————————————————————————————————*/
// 加载特定对话的历史消息
const loadConversationHistory = async (conversationId, resetPage = true, signal = null) => {
    if (!conversationId) {
        console.error('会话ID为空，无法加载历史消息');
        return false;
    }

    try {
        // 显示加载状态
        loadingMore.value = resetPage ? false : true;
        // 设置历史消息加载状态
        if (resetPage) {
            historyLoading.value = true;
        }

        // 切换对话时清空建议问题列表
        if (resetPage) {
            suggestedQuestions.value = [];
        }

        // 重置分页或使用现有分页
        if (resetPage) {
            currentPage.value = 1;
            hasMoreMessages.value = true;
            chatList.value = []; // 清空现有消息
        }

        const options = {
            page: currentPage.value,
            pageSize: pageSize.value,
            signal: signal // 传递signal给API调用
        };

        const historyMessages = await getServerConversationHistory(conversationId, options);

        // 检查是否已中断或会话ID已变更
        if (signal?.aborted || conversationId !== currentConversationId.value) {
            console.log('加载请求已中断或会话已切换，不更新UI');
            return false;
        }

        if (historyMessages.length > 0) {
            // 如果是重置，直接设置为新消息
            if (resetPage) {
                chatList.value = historyMessages;
            } else {
                // 否则追加到现有消息的前面
                chatList.value = [...historyMessages, ...chatList.value];
            }

            // 判断是否还有更多消息
            hasMoreMessages.value = historyMessages.length >= pageSize.value;

            // 获取最后一条AI回复的消息ID，用于获取建议问题
            if (resetPage && historyMessages.length > 0) {
                // 找出最后一条AI回复的消息
                const assistantMessages = historyMessages.filter(msg => msg.role === 'assistant' && msg.id);
                if (assistantMessages.length > 0) {
                    // 获取最后一条AI消息的ID (移除_assistant后缀)
                    const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];
                    const messageId = lastAssistantMessage.id.replace('_assistant', '');

                    // 获取建议问题
                    fetchSuggestedQuestions(messageId);
                }
            }
        } else {
            if (resetPage) {
                chatList.value = []; // 没有消息，清空列表
            }
            hasMoreMessages.value = false;
        }

        // 保存到本地缓存
        if (chatList.value && Array.isArray(chatList.value) && chatList.value.length > 0) {
        }

        return true;
    } catch (error) {
        console.error('加载对话历史消息失败:', error);
        // 出错时重置加载状态
        hasMoreMessages.value = false;
        if (resetPage) {
            chatList.value = []; // 出错时清空列表
        }
        return false;
    } finally {
        // 无论成功失败都重置加载状态
        loadingMore.value = false;
        // 重置历史消息加载状态
        historyLoading.value = false;
    }
};

/*————————————————————————————————————————————————防抖加载处理————————————————————————————————————————————————*/
// 使用防抖包装的会话历史加载函数
const debouncedLoadHistory = debounce(async (conversationId, controller) => {
    try {
        // 检查ID是否与最后点击的一致
        if (conversationId === currentConversationId.value) {
            await loadConversationHistory(conversationId, true, controller.signal);
        }
    } catch (error) {
        // 如果是取消错误，忽略它
        if (error.name !== 'AbortError') {
            console.error('加载对话内容失败:', error);
        }
        // 重置加载状态
        historyLoading.value = false;
    } finally {
        // 仅当这是最新的请求时清除控制器引用
        if (activeLoadController.value === controller) {
            activeLoadController.value = null;
        }
    }
}, 300); // 300ms的防抖延迟

/*————————————————————————————————————————————————消息交互事件处理————————————————————————————————————————————————*/
// 处理思考内容
const handleChange = (value, { index }) => {
};

// 清空聊天记录
const clearConfirm = async function () {
    // 清除本地存储
    await clearChatHistory();
    // 清空聊天记录并重置状态
    resetConversationState({
        currentConversationId,
        chatList,
        suggestedQuestions,
        suggestedQuestionsConversationId,
        isNewConversation,
        resetConversationFunc: resetConversation
    });
};

// 停止请求
const onStop = async function () {
    try {
        // 防止重复中断
        if (!loading.value && !isStreamLoad.value) {
            console.log('请求已经停止，不再执行中断操作');
            return;
        }

        // 立即重置状态 - 先更新UI再中断请求
        loading.value = false;
        isStreamLoad.value = false;
        firstTokenReceived.value = true; // 设为true防止显示加载动画

        // 获取最后一条助手消息并添加停止标记
        const lastItem = chatList.value[0];

        // 处理中断UI更新
        handleRequestAbort(lastItem, { loading, isStreamLoad });

        // 备份中断函数并立即清空，避免重复调用
        const abortFunction = fetchCancel.value;
        fetchCancel.value = null;

        // 备份任务ID并立即清空
        const taskId = currentTaskId.value;
        currentTaskId.value = null;

        // 如果有任务ID，优先使用新的API停止流式响应
        if (taskId) {
            try {
                const userId = localStorage.getItem('dify_user_id');
                await stopStreamResponse(taskId, userId);
            } catch (stopError) {
                console.error('API停止请求失败:', stopError);
            }
        }

        // 最后尝试使用AbortController中断
        if (abortFunction) {
            try {
                abortFunction();
            } catch (abortError) {
                console.error('中断请求时出错:', abortError);
            }
        }
    } catch (error) {
        console.error('停止请求时发生错误:', error);
        // 出错时也要确保重置状态
        loading.value = false;
        isStreamLoad.value = false;
        fetchCancel.value = null;
        currentTaskId.value = null;
    }
};

// 用户操作
const handleOperation = function (type, options) {
    // 确保options存在并提取index
    const index = options.index;

    if (type === 'good') {
        isGood.value = !isGood.value;
        isBad.value = false;
    } else if (type === 'bad') {
        isBad.value = !isBad.value;
        isGood.value = false;
    } else if (type === 'replay') {
        const userQuery = chatList.value[index + 1].content;
        inputEnter(userQuery);
    }
};

/*————————————————————————————————————————————————消息发送与接收处理————————————————————————————————————————————————*/
// 用户输入
const inputEnter = function (inputValue) {
    if (isStreamLoad.value) {
        return;
    }

    // 处理消息格式，支持包含文件的复合消息
    let messageText = '';
    let files = [];

    if (typeof inputValue === 'string') {
        messageText = inputValue;
    } else if (typeof inputValue === 'object') {
        messageText = inputValue.message || '';
        files = inputValue.files || [];
    }

    if (!messageText && files.length === 0) {
        return;
    }

    // 一旦用户发送消息，就不再是新会话
    isNewConversation.value = false;

    // 添加用户消息
    const userMessage = createUserMessage(messageText, files);
    chatList.value.unshift(userMessage);

    // 添加助手消息（空消息占位）
    // 默认启用推理展示功能，如果API不返回推理内容，也不会显示
    const assistantMessage = createAssistantMessage(true);
    chatList.value.unshift(assistantMessage);

    // 发送请求
    handleModelRequest(messageText, files);
};

/*————————————————————————————————————————————————AI模型请求处理————————————————————————————————————————————————*/
// 处理模型请求
const handleModelRequest = async (inputValue, files = []) => {
    loading.value = true;
    isStreamLoad.value = true;
    firstTokenReceived.value = false;
    currentTaskId.value = null; // 重置任务ID
    currentMessageId.value = null; // 重置消息ID
    const lastItem = chatList.value[0];

    // 初始化消息处理函数
    const {
        handleReasoningUpdate,
        handleMessageUpdate,
        handleFileEvent,
        handleWorkflowSteps
    } = useMessageHandlers();

    // 构建消息历史，确保使用正确的当前消息
    const currentUserMessage = chatList.value[1]?.role === 'user' ? chatList.value[1].content : inputValue;

    const messages = buildMessageHistory(chatList.value, currentUserMessage, systemPrompt.value);

    // 创建请求控制器和超时保护
    const { controller, signal, abortRequest } = createRequestController();
    fetchCancel.value = abortRequest;

    try {
        // 准备请求选项，如果有当前会话ID则使用，否则创建新会话
        const requestOptions = {
            signal: signal,
            conversation_id: currentConversationId.value || '',
            files: files.length > 0 ? files : undefined
        };

        await chatWithModel(
            messages,
            {
                // 思考内容
                onReasoning: (reasoningText) => {
                    // 检查是否已中断 - 通过检查loading状态替代直接检查signal
                    if (!loading.value || !isStreamLoad.value) {
                        return;
                    }

                    // 使用提取的处理函数
                    handleReasoningUpdate(lastItem, reasoningText, firstTokenReceived);
                },

                // 回复内容
                onMessage: (text) => {
                    // 检查是否已中断
                    if (!loading.value || !isStreamLoad.value) {
                        return;
                    }

                    // 使用提取的处理函数
                    handleMessageUpdate(
                        lastItem,
                        text,
                        firstTokenReceived,
                        isScrolling,
                        scrollChatToBottom,
                        chatRef
                    );
                },

                // 文件事件处理
                onFileEvent: (fileData) => {
                    // 检查是否已中断
                    if (!loading.value || !isStreamLoad.value) {
                        return;
                    }

                    // 使用提取的处理函数
                    handleFileEvent(lastItem, fileData);
                },

                // 错误处理
                onError: (errorMessage) => {
                    console.error('API请求出错:', errorMessage);
                    MessagePlugin.error(errorMessage || '请求出错');

                    // 更新UI状态
                    loading.value = false;
                    isStreamLoad.value = false;
                    lastItem.loading = false;
                    lastItem.isStreamLoad = false;
                    lastItem.content = `请求失败: ${errorMessage}`;
                },

                // 完成事件
                onComplete: (success, message) => {
                    console.log('请求完成, 成功:', success, message);

                    // 更新UI状态
                    loading.value = false;
                    isStreamLoad.value = false;

                    if (lastItem) {
                        lastItem.loading = false;
                        lastItem.isStreamLoad = false;
                    }

                    if (!success) {
                        console.warn('请求未成功完成:', message);
                        if (lastItem) {
                            if (!lastItem.content) {
                                lastItem.content = `请求未完成: ${message || '未知原因'}`;
                            }
                        }
                    } else {
                        // 请求成功完成，考虑自动重命名对话
                        // 只有当有会话ID时才尝试重命名
                        if (currentConversationId.value) {
                            // 使用改进的自动重命名函数，带上当前消息列表
                            autoRenameConversationIfNeeded(currentConversationId.value, {
                                messages: chatList.value,
                                onComplete: (newTitle) => {
                                    if (!newTitle) {
                                        console.log('自动重命名完成，但未返回标题');
                                        return;
                                    }

                                    console.log('自动重命名完成，新标题:', newTitle);

                                    // 更新本地会话列表中的名称
                                    conversationList.value = conversationList.value.map(conversation => {
                                        if (conversation.id === currentConversationId.value) {
                                            return {
                                                ...conversation,
                                                name: newTitle
                                            };
                                        }
                                        return conversation;
                                    });
                                }
                            }).catch(error => {
                                console.error('自动重命名过程出错:', error);
                            });
                        }
                    }

                    // 刷新UI
                    nextTick(() => {
                        if (chatRef.value) {
                            scrollChatToBottom(chatRef.value, true);
                        }
                    });
                },

                // 会话ID变更
                onConversationIdChange: (id) => {
                    console.log('会话ID更新:', id);
                    if (id && id !== currentConversationId.value) {
                        currentConversationId.value = id;
                        // 确保会话列表是最新的
                        loadConversationListDebounce();
                    }
                },

                // 消息ID变更
                onMessageIdChange: (id) => {
                    currentMessageId.value = id;
                    // 在消息完成后获取建议问题
                    if (id && lastItem && lastItem.role === 'assistant') {
                        getSuggestedQuestionsDebounce(id);
                    }
                },

                // 任务ID变更
                onTaskIdChange: (id) => {
                    currentTaskId.value = id;
                },

                // 添处理工作流步骤的回调
                onWorkflowSteps: (steps) => {
                    // 使用提取的处理函数
                    handleWorkflowSteps(steps, chatList, loading, firstTokenReceived);
                }
            },
            requestOptions
        );
    } catch (err) {
        console.error('聊天请求失败:', err);
        loading.value = false;
        isStreamLoad.value = false;

        // 更新最后一条消息为错误信息
        if (lastItem) {
            lastItem.loading = false;
            lastItem.isStreamLoad = false;
            lastItem.content = `聊天请求失败: ${err.message || '未知错误'}`;
        }

        // 显示错误提示
        MessagePlugin.error('聊天请求失败: ' + (err.message || '未知错误'));
    }
};

/*————————————————————————————————————————————————会话列表管理————————————————————————————————————————————————*/
// 加载更多会话
const loadMoreConversations = async () => {
    if (!hasMoreConversations.value || loadingMoreConversations.value) return;

    try {
        loadingMoreConversations.value = true;

        // 获取最后一个会话的ID作为last_id
        const lastId = conversationList.value.length > 0
            ? conversationList.value[conversationList.value.length - 1].id
            : null;

        if (!lastId) {
            hasMoreConversations.value = false;
            return;
        }

        // 获取更多会话，每次固定加载20条
        const moreConversations = await getServerConversations({
            last_id: lastId,
            limit: 20,
            sort_by: '-updated_at'
        });

        if (moreConversations && Array.isArray(moreConversations) && moreConversations.length > 0) {
            // 合并会话列表
            conversationList.value = [...conversationList.value, ...moreConversations];

            // 判断是否还有更多对话可加载
            hasMoreConversations.value = moreConversations.length >= 20;
        } else {
            hasMoreConversations.value = false;
        }
    } catch (error) {
        console.error('加载更多会话失败:', error);
    } finally {
        loadingMoreConversations.value = false;
    }
};

/*————————————————————————————————————————————————会话编辑操作————————————————————————————————————————————————*/
// 处理对话重命名
const handleRenameConversation = async ({ conversationId, name }) => {
    try {
        // 调用重命名API
        const result = await renameConversation(conversationId, { name });

        // 更新本地会话列表中的名称
        conversationList.value = conversationList.value.map(conversation => {
            if (conversation.id === conversationId) {
                return {
                    ...conversation,
                    name: result.name || name
                };
            }
            return conversation;
        });

    } catch (error) {
        console.error('重命名对话失败:', error);
        // 显示错误消息
    }
};

// 处理对话置顶
const handlePinConversation = ({ conversationId }) => {
    // 查找要置顶的对话
    const conversation = conversationList.value.find(c => c.id === conversationId);
    if (!conversation) return;

    // 从列表中移除
    conversationList.value = conversationList.value.filter(c => c.id !== conversationId);

    // 添加到列表开头
    conversationList.value.unshift(conversation);
};

// 显示重命名对话框
const showRenameDialogFor = ({ conversationId }) => {
    currentEditingId.value = conversationId;

    // 找到当前对话
    const conversation = conversationList.value.find(c => c.id === conversationId);
    if (conversation) {
        renameInput.value = conversation.name || getConversationTitle(conversation, 100);
    }

    showRenameDialog.value = true;
};

// 确认重命名
const confirmRename = () => {
    if (currentEditingId.value && renameInput.value.trim()) {
        handleRenameConversation({
            conversationId: currentEditingId.value,
            name: renameInput.value.trim()
        });
    }
    showRenameDialog.value = false;
    renameInput.value = '';
    currentEditingId.value = '';
};

// 取消重命名
const cancelRename = () => {
    showRenameDialog.value = false;
    renameInput.value = '';
    currentEditingId.value = '';
};

// 确认删除对话
const confirmDelete = async () => {
    if (!currentDeletingId.value) {
        showDeleteDialog.value = false;
        return;
    }

    try {
        // 调用API删除对话
        const result = await deleteConversation(currentDeletingId.value);

        // 从本地列表中移除
        conversationList.value = conversationList.value.filter(c => c.id !== currentDeletingId.value);

        // 如果删除的是当前对话，切换到新对话
        if (currentConversationId.value === currentDeletingId.value) {
            resetConversationState({
                currentConversationId,
                chatList,
                suggestedQuestions,
                suggestedQuestionsConversationId,
                isNewConversation,
                resetConversationFunc: resetConversation
            });
        }
    } catch (error) {
        console.error('删除对话失败:', error);
        // 可以在这里添加错误提示
    } finally {
        // 关闭对话框并清除状态
        showDeleteDialog.value = false;
        currentDeletingId.value = '';
    }
};

// 取消删除对话
const cancelDelete = () => {
    showDeleteDialog.value = false;
    currentDeletingId.value = '';
};

/*————————————————————————————————————————————————建议问题处理————————————————————————————————————————————————*/
// 处理点击建议问题
const handleSuggestedQuestion = (question) => {
    // 使用选择的建议问题
    inputEnter(question);
    // 清空建议问题列表，动画效果通过v-if和transition实现
    suggestedQuestions.value = [];
    suggestedQuestionsConversationId.value = '';
};

// 获取AI建议问题
const fetchSuggestedQuestions = async (messageId) => {
    if (!messageId) return;

    try {
        const questions = await getSuggestedQuestions(messageId);
        if (questions && Array.isArray(questions) && questions.length > 0) {
            suggestedQuestions.value = questions;
            suggestedQuestionsConversationId.value = currentConversationId.value;
        } else {
            suggestedQuestions.value = [];
        }
    } catch (error) {
        console.error('获取建议问题失败:', error);
        suggestedQuestions.value = [];
    }
};

// 创建防抖函数
const getSuggestedQuestionsDebounce = debounce((messageId) => {
    fetchSuggestedQuestions(messageId);
}, 300);

/*————————————————————————————————————————————————防抖函数与工具方法————————————————————————————————————————————————*/
// 用于会话列表加载的防抖函数
const loadConversationListDebounce = debounce(async () => {
    try {
        const conversations = await getServerConversations({
            limit: 20,
            sort_by: '-updated_at'
        });
        if (conversations && Array.isArray(conversations)) {
            conversationList.value = conversations;
            hasMoreConversations.value = conversations.length >= 20;
        }
    } catch (error) {
        console.error('刷新会话列表失败:', error);
    }
}, 500);

// 切换侧边栏显示状态
const toggleSidebar = () => {
    showConversationDrawer.value = !showConversationDrawer.value;
};

/*————————————————————————————————————————————————生命周期清理————————————————————————————————————————————————*/
// 组件卸载时的清理函数
onUnmounted(() => {
    // 清理定时器
    if (switchConversationTimer.value) {
        clearTimeout(switchConversationTimer.value);
    }

    // 取消进行中的请求
    if (activeLoadController.value) {
        activeLoadController.value.abort();
    }
});

/*————————————————————————————————————————————————知识库详情处理————————————————————————————————————————————————*/
// 处理知识库详情的方法
const goToDatasetDetail = (datasetId, datasetPath) => {
  showKnowledgeBase.value = true;
  activeSection.value = 'knowledge';
  currentDatasetId.value = datasetId;
  currentDatasetPath.value = datasetPath;
  
  // 更新URL状态
  updateUrlState();
};
</script>

<style lang="scss">
@use '/static/styles/index.scss';
@use '/static/styles/animations.scss';
@use '/static/styles/responsive.scss' as responsive;
@import '/static/styles/variables.scss';

.app-container {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 100%;
    transition: all 0.3s ease;
    display: flex;
    flex-direction: row;
    background-color: var(--td-bg-color-container);
}

/* 主内容区域，包含header和聊天区域 */
.main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: margin-left 0.3s ease;
    width: 100%;

    &.sidebar-open {
        margin-left: 280px;

        @include responsive.breakpoint-down("sm") {
            margin-left: 0;
        }
    }

    &.sidebar-closed {
        margin-left: 0;
    }
}

/* 聊天容器的包装器，用于水平居中 */
.chat-wrapper {
    display: flex;
    justify-content: center;
    width: 100%;
    flex: 1;
    overflow: auto;
    transition: width 0.3s ease;
}

.chat-container {
    flex: 1;
    @include responsive.container-width;
    height: auto;
    padding: 0 $size-2 $comp-margin-l;
    transition: all 0.3s ease, padding 0.3s ease, width 0.3s ease;
    overflow-x: hidden;
    overflow-y: auto;

    @include responsive.breakpoint-down("sm") {
        padding: 0 $size-1 $comp-margin-m;
    }

    .t-space {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .t-chat-item {
        transition: transform 0.2s ease, box-shadow 0.3s ease;
        border-radius: $radius-medium;
        max-width: 92%;
        margin: 8px 0;

        @include responsive.breakpoint-down("xs") {
            max-width: 98%;
        }

        &:hover {
            transform: translateY(-$size-1);
            box-shadow: $shadow-2;
        }
    }

    /* 确保Markdown标题样式正确 */
    :deep(.t-chat-content),
    :deep(.t-chat__content) {

        h1,
        h2,
        h3,
        h4,
        h5,
        h6 {
            margin-top: 0 !important;
            margin-bottom: 8px !important;
            padding: 0 !important;
            line-height: 1.2 !important;
        }

        /* 优化代码块显示 */
        pre {
            border-radius: 8px;
            overflow-x: auto;
            margin: 10px 0;
            background-color: rgba(0, 0, 0, 0.05);
            padding: 12px;

            /* 暗色模式适配 */
            [theme-mode="dark"] & {
                background-color: rgba(255, 255, 255, 0.05);
            }

            code {
                font-family: 'Menlo', 'Monaco', 'Consolas', 'Courier New', monospace;
                font-size: 13px;
            }
        }

        /* 优化图片显示 */
        img {
            max-width: 100%;
            border-radius: 6px;
            margin: 8px 0;
        }

        /* 优化表格样式 */
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 10px 0;

            th,
            td {
                border: 1px solid #eee;
                padding: 8px 12px;

                @include responsive.breakpoint-down("xs") {
                    padding: 6px 8px;
                }

                /* 暗色模式适配 */
                [theme-mode="dark"] & {
                    border-color: #333;
                }
            }

            th {
                background-color: rgba(0, 0, 0, 0.03);

                /* 暗色模式适配 */
                [theme-mode="dark"] & {
                    background-color: rgba(255, 255, 255, 0.05);
                }
            }
        }
    }
}

.dialog-content {
    font-size: $font-size-body-medium;
}

/* 聊天输入框样式优化 */
.t-chat-input {
    @include responsive.responsive-spacing('margin-top', 10px);
    padding: 0 16px 16px;
    @include animations.smooth-transition;

    @include responsive.breakpoint-down("sm") {
        padding: 0 10px 10px;
    }

    .t-textarea__inner {
        min-height: 40px !important;
        height: 40px !important;
        line-height: 20px !important;
        padding: 10px 12px;
        border-radius: 20px;
        @include animations.smooth-transition;

        &:focus {
            box-shadow: 0 0 0 2px rgba(var(--td-brand-color), 0.2);
        }
    }

    /* 输入框按钮样式优化 */
    .t-textarea__suffix {
        .t-button {
            border-radius: 50%;
            min-width: 36px;
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;

            .t-icon {
                font-size: 18px;
            }
        }
    }
}

.loading-space {
    margin-top: $size-3;
    margin-left: $size-4;
    @include animations.smooth-transition;
}

/* 建议问题样式优化 */
.suggested-questions-container {
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    margin-bottom: $comp-margin-xs;
    padding: 0 $comp-margin-s;
    scrollbar-width: none;
    -ms-overflow-style: none;
    @include animations.smooth-transition;

    &::-webkit-scrollbar {
        display: none;
    }
}

.suggested-questions {
    display: flex;
    flex-wrap: nowrap;
    padding: $comp-margin-xs 0;
    gap: $comp-margin-s;
    justify-content: flex-start;
    white-space: nowrap;
    width: max-content;
    @include animations.smooth-transition;
}

.question-tag {
    cursor: pointer;
    margin-bottom: 0;
    @include animations.hover-lift;
    padding: 6px 12px;
    font-size: 14px;
    border-radius: 16px;

    @include responsive.breakpoint-down("xs") {
        padding: 4px 8px;
        font-size: 13px;
    }
}

/* 对话框样式优化 */
.t-dialog {
    border-radius: 12px;
    overflow: hidden;

    @include responsive.breakpoint-down("sm") {
        width: 90% !important;
    }

    .t-dialog__header {
        padding: 20px 24px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.05);

        @include responsive.breakpoint-down("sm") {
            padding: 16px 20px;
        }
    }

    .t-dialog__body {
        padding: 24px;

        @include responsive.breakpoint-down("sm") {
            padding: 16px;
        }
    }

    .t-dialog__footer {
        padding: 16px 24px;
        border-top: 1px solid rgba(0, 0, 0, 0.05);

        @include responsive.breakpoint-down("sm") {
            padding: 12px 16px;
        }
    }

    .t-button {
        border-radius: 8px;
        padding: 0 16px;
    }
}

/* 适应黑暗主题 */
[theme-mode="dark"] {
    .app-container {
        background-color: var(--td-bg-color-container);
    }

    .t-chat-item {
        &:hover {
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
        }
    }

    .dialog-content {
        color: var(--td-text-color-primary);
    }

    .t-dialog {
        .t-dialog__header {
            border-bottom-color: rgba(255, 255, 255, 0.05);
        }

        .t-dialog__footer {
            border-top-color: rgba(255, 255, 255, 0.05);
        }
    }
}

/* 知识库管理区域样式 */
.knowledge-base-wrapper {
    flex: 1;
    width: 100%;
    display: flex;
    flex-direction: column;
    overflow: auto;
    background-color: var(--td-bg-color-container);
    border-radius: $radius-medium;
    transition: all 0.3s ease;
}

</style>