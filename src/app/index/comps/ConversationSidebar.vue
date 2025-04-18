<template>
  <!-- 左侧对话列表面板，使用transition添加动画 -->
  <transition name="sidebar-slide">
    <div class="sidebar-container" v-show="visible">
      <div class="sidebar-header">
        <t-button variant="text" class="close-icon" @click="$emit('update:visible', false)">
          <t-icon name="menu" />
        </t-button>

        <div @click="handleNewChat" class="conversation-item new-conversation-item"
          :class="{ 'active': currentConversationId === '' && activeSection === 'chat' }">
          <span class="conversation-text">新对话</span>
          <t-icon name="chat-add" class="conversation-icon" />
        </div>

      </div>
      <div class="drawer-container">
        <div class="new-conversation-container">
          <!-- 添加知识库管理入口 -->
          <t-list-item @click="goToDatasetManagement" class="conversation-item feature-item"
            :class="{ 'active': activeSection === 'knowledge' }">
            <t-icon name="folder" class="conversation-icon" />
            <span class="conversation-text">知识库管理</span>
          </t-list-item>
        </div>

        <!-- 可滚动的会话列表 -->
        <div class="conversations-list" ref="conversationsListRef" @scroll="handleScroll">
          <!-- 骨架屏加载状态 -->
          <sidebar-skeleton v-if="isLoading" />

          <!-- 显示实际会话列表 -->
          <t-list v-else>
            <!-- 使用抽取的组件来显示不同组的对话 -->
            <conversation-group v-if="groupedConversations.today.length > 0" title="今日"
              :conversations="groupedConversations.today" :current-conversation-id="currentConversationId"
              :active-section="activeSection"
              @select="(value) => $emit('select', { value })"
              @pin-conversation="(id) => $emit('pin-conversation', { conversationId: id })"
              @rename-conversation="(id) => $emit('rename-conversation', { conversationId: id })"
              @delete-conversation="(id) => $emit('select', { value: `delete-${id}` })"
              @chat-section="() => $emit('chat-section')" />

            <conversation-group v-if="groupedConversations.yesterday.length > 0" title="昨日"
              :conversations="groupedConversations.yesterday" :current-conversation-id="currentConversationId"
              :active-section="activeSection"
              @select="(value) => $emit('select', { value })"
              @pin-conversation="(id) => $emit('pin-conversation', { conversationId: id })"
              @rename-conversation="(id) => $emit('rename-conversation', { conversationId: id })"
              @delete-conversation="(id) => $emit('select', { value: `delete-${id}` })"
              @chat-section="() => $emit('chat-section')" />

            <conversation-group v-if="groupedConversations.lastWeek.length > 0" title="过去7天"
              :conversations="groupedConversations.lastWeek" :current-conversation-id="currentConversationId"
              :active-section="activeSection"
              @select="(value) => $emit('select', { value })"
              @pin-conversation="(id) => $emit('pin-conversation', { conversationId: id })"
              @rename-conversation="(id) => $emit('rename-conversation', { conversationId: id })"
              @delete-conversation="(id) => $emit('select', { value: `delete-${id}` })"
              @chat-section="() => $emit('chat-section')" />

            <conversation-group v-if="groupedConversations.older.length > 0" title="更早"
              :conversations="groupedConversations.older" :current-conversation-id="currentConversationId"
              :active-section="activeSection"
              @select="(value) => $emit('select', { value })"
              @pin-conversation="(id) => $emit('pin-conversation', { conversationId: id })"
              @rename-conversation="(id) => $emit('rename-conversation', { conversationId: id })"
              @delete-conversation="(id) => $emit('select', { value: `delete-${id}` })"
              @chat-section="() => $emit('chat-section')" />

            <!-- 加载中提示 -->
            <div v-if="loadingMoreConversations" class="loading-indicator">
              <t-loading size="small" />
            </div>
          </t-list>
        </div>

        <!-- 固定底部的主题切换按钮 -->
        <div class="theme-toggle-container">
          <t-button variant="text" size="small" class="theme-toggle-btn" @click="toggleTheme">
            <t-icon :name="currentTheme === 'dark' ? 'sunny' : 'moon'" />
            <span class="theme-text">{{ currentTheme === 'dark' ? '切换到亮色模式' : '切换到暗色模式' }}</span>
          </t-button>
        </div>
      </div>
    </div>
  </transition>

  <!-- 添加遮罩层，在移动端显示 -->
  <transition name="fade">
    <div v-if="visible" class="sidebar-overlay" @click="$emit('update:visible', false)"></div>
  </transition>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import ConversationGroup from './ConversationGroup.vue';
import SidebarSkeleton from './SidebarSkeleton.vue';
import { getThemeMode, toggleThemeMode, ThemeMode } from '/static/api/theme.js';

// 获取路由器实例
const router = useRouter();

// 组件属性
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  currentConversationId: {
    type: String,
    default: ''
  },
  groupedConversations: {
    type: Object,
    default: () => ({
      today: [],
      yesterday: [],
      lastWeek: [],
      older: []
    })
  },
  hasMoreConversations: {
    type: Boolean,
    default: false
  },
  loadingMoreConversations: {
    type: Boolean,
    default: false
  },
  isLoading: {
    type: Boolean,
    default: false
  },
  activeSection: {
    type: String,
    default: 'chat' // 'chat' 或 'knowledge'
  }
});

// 滚动相关
const conversationsListRef = ref<HTMLElement | null>(null);
const scrollThreshold = 100; // 滚动触发阈值（距离底部多少像素时触发）
const loadingMore = ref(false); // 防止重复触发

// 计算属性：检查会话列表是否已加载
const hasLoadedConversations = computed(() => {
  const hasToday = props.groupedConversations.today.length > 0;
  const hasYesterday = props.groupedConversations.yesterday.length > 0;
  const hasLastWeek = props.groupedConversations.lastWeek.length > 0;
  const hasOlder = props.groupedConversations.older.length > 0;

  // 如果任一组有数据，或者没有更多会话需要加载，则认为已加载
  return hasToday || hasYesterday || hasLastWeek || hasOlder || !props.hasMoreConversations;
});

// 处理滚动事件
const handleScroll = () => {
  if (!conversationsListRef.value || !props.hasMoreConversations || loadingMore.value || props.loadingMoreConversations) {
    return;
  }

  const element = conversationsListRef.value;
  const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight;

  // 当滚动到接近底部时，触发加载更多
  if (distanceToBottom < scrollThreshold) {
    loadingMore.value = true;
    emit('load-more');

    // 防止短时间内重复触发
    setTimeout(() => {
      loadingMore.value = false;
    }, 1000);
  }
};

// 添加主题相关状态
const currentTheme = ref(getThemeMode());

// 主题切换方法
const toggleTheme = () => {
  toggleThemeMode();
  currentTheme.value = getThemeMode();
};

// 前往知识库管理页面
const goToDatasetManagement = () => {
  // 改为触发事件，让父组件处理显示知识库管理
  emit('show-knowledge-base');
  // 不再关闭侧边栏
};

// 处理新建聊天
const handleNewChat = () => {
  emit('new-conversation');
  // 确保切换到聊天部分
  emit('chat-section');
};

// 在组件挂载时获取当前主题
onMounted(() => {
  currentTheme.value = getThemeMode();
});

// 定义事件
const emit = defineEmits(['update:visible', 'select', 'new-conversation', 'load-more', 'rename-conversation', 'pin-conversation', 'show-knowledge-base', 'chat-section']);
</script>

<style lang="scss" scoped>
@import '/static/styles/variables.scss';

/* 侧边栏动画 */
.sidebar-slide-enter-active,
.sidebar-slide-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.sidebar-slide-enter-from,
.sidebar-slide-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

/* 遮罩层动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 遮罩层样式 */
.sidebar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 999;
  display: none;
}

.sidebar-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 280px;
  height: 100%;
  box-sizing: border-box;
  background-color: $bg-color-container;
  display: flex;
  flex-direction: column;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  padding: $comp-paddingTB-m $comp-paddingLR-m $comp-paddingTB-m;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0 $comp-paddingTB-m;
}

.sidebar-title {
  font-size: $font-size-body-medium;
  font-weight: bold;
  color: $text-color-primary;
}

.close-icon {
  color: $text-color-secondary;
  font-size: 20px;

  &:hover {
    color: $text-color-primary;
  }
}

.drawer-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
}

.new-conversation-container {
  position: sticky;
  top: 0;
  z-index: 10;
  background-color: $bg-color-container;
  padding-bottom: $comp-paddingTB-xs;
}

.feature-item {
  margin-top: 8px;
  padding-top: 8px;
}

.conversations-list {
  &::-webkit-scrollbar {
    width: 0;
    height: 0;
    display: none;
  }

  flex: 1;
  overflow-y: auto;
  padding-bottom: 20px;
}

.conversation-item {
  padding: $comp-paddingTB-s $comp-paddingLR-m;
  display: flex;
  align-items: center;
  flex: 1;
  border-radius: 5px;
  transition: all 0.3s ease;
  position: relative;

  &:hover {
    background-color: $bg-color-container-hover;
  }

  &.active {
    background-color: $brand-color-light;
    color: $brand-color;

    .conversation-icon {
      font-size: 15px;
      color: $brand-color;
    }
  }

  .conversation-icon {
    font-size: 15px;
    margin-right: $size-3;
    color: $text-color-secondary;
  }

  .conversation-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
    color: $text-color-primary;
    transition: color 0.3s ease;
  }
}

.new-conversation-item {
  border: 1px solid;

  :root[theme-mode="dark"] & {
    border-color: var(--td-gray-color-10);
  }

  :root[theme-mode="light"] & {
    border-color: var(--td-gray-color-3);
  }

  &:hover {
    border-color: var(--td-gray-color-5);
  }

  &.active {
    border-color: var(--td-brand-color-3);
    background-color: $brand-color-light;
    color: $brand-color;
  }
}


.loading-indicator {
  display: flex;
  justify-content: center;
  padding: $comp-paddingTB-s 0;
  margin-top: $comp-margin-s;
}

.theme-toggle-container {
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  padding: $comp-paddingTB-s 0;
  background-color: $bg-color-container;
  z-index: 10;
}

.theme-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  color: $text-color-secondary;
  transition: color 0.3s ease;

  &:hover {
    color: $brand-color;
  }

  .t-icon {
    margin-right: $size-3;
    font-size: 16px;
  }

  .theme-text {
    font-size: $font-size-body-small;
    line-height: 1.2;
  }
}
</style>