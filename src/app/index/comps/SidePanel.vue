<!-- 
  侧边面板组件 - 对话列表
  不使用t-drawer组件，而是自定义实现可收缩的侧边栏
-->
<template>
  <div class="side-panel" :class="{ 'collapsed': !visible }">
    <div class="drawer-container">
      <!-- 固定顶部的新对话按钮 -->
      <div class="new-conversation-container">
        <t-list-item @click="$emit('new-conversation')" class="conversation-item"
          :class="{ 'active': currentConversationId === '' }">
          <t-icon name="add" class="conversation-icon" />
          <span class="conversation-text">新对话</span>
        </t-list-item>
                
        <!-- 添加知识库管理入口 -->
        <t-list-item @click="goToDatasetManagement" class="conversation-item feature-item">
          <t-icon name="folder" class="conversation-icon" />
          <span class="conversation-text">知识库管理</span>
        </t-list-item>
      </div>

      <!-- 可滚动的会话列表 -->
      <div class="conversations-list">
        <t-list>
          <!-- 使用抽取的组件来显示不同组的对话 -->
          <conversation-group 
            v-if="groupedConversations.today.length > 0"
            title="今日"
            :conversations="groupedConversations.today"
            :current-conversation-id="currentConversationId"
            @select="(value) => $emit('select', { value })"
            @pin-conversation="(id) => $emit('pin-conversation', { conversationId: id })"
            @rename-conversation="(id) => $emit('rename-conversation', { conversationId: id })"
            @delete-conversation="(id) => $emit('select', { value: `delete-${id}` })"
          />
                    
          <conversation-group 
            v-if="groupedConversations.yesterday.length > 0"
            title="昨日"
            :conversations="groupedConversations.yesterday"
            :current-conversation-id="currentConversationId"
            @select="(value) => $emit('select', { value })"
            @pin-conversation="(id) => $emit('pin-conversation', { conversationId: id })"
            @rename-conversation="(id) => $emit('rename-conversation', { conversationId: id })"
            @delete-conversation="(id) => $emit('select', { value: `delete-${id}` })"
          />
                    
          <conversation-group 
            v-if="groupedConversations.lastWeek.length > 0"
            title="过去7天"
            :conversations="groupedConversations.lastWeek"
            :current-conversation-id="currentConversationId"
            @select="(value) => $emit('select', { value })"
            @pin-conversation="(id) => $emit('pin-conversation', { conversationId: id })"
            @rename-conversation="(id) => $emit('rename-conversation', { conversationId: id })"
            @delete-conversation="(id) => $emit('select', { value: `delete-${id}` })"
          />
                    
          <conversation-group 
            v-if="groupedConversations.older.length > 0"
            title="更早"
            :conversations="groupedConversations.older"
            :current-conversation-id="currentConversationId"
            @select="(value) => $emit('select', { value })"
            @pin-conversation="(id) => $emit('pin-conversation', { conversationId: id })"
            @rename-conversation="(id) => $emit('rename-conversation', { conversationId: id })"
            @delete-conversation="(id) => $emit('select', { value: `delete-${id}` })"
          />

          <!-- 加载更多选项 -->
          <div v-if="hasMoreConversations" class="load-more-container">
            <t-button size="small" variant="text" :loading="loadingMoreConversations" @click="$emit('load-more')">
              加载更多会话
            </t-button>
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
    
    <!-- 收缩按钮 -->
    <div class="collapse-btn" @click="$emit('update:visible', !visible)">
      <t-icon :name="visible ? 'chevron-left' : 'chevron-right'" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import ConversationGroup from './ConversationGroup.vue';
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
  }
});

// 添加主题相关状态
const currentTheme = ref(getThemeMode());

// 主题切换方法
const toggleTheme = () => {
  toggleThemeMode();
  currentTheme.value = getThemeMode();
};

// 前往知识库管理页面
const goToDatasetManagement = () => {
  router.push('/app/dataset');
  // 关闭侧边栏
  emit('update:visible', false);
};

// 在组件挂载时获取当前主题
onMounted(() => {
  currentTheme.value = getThemeMode();
});

// 定义事件
const emit = defineEmits(['update:visible', 'select', 'new-conversation', 'load-more', 'rename-conversation', 'pin-conversation']);
</script>

<style lang="scss" scoped>
@import '/static/styles/variables.scss';

.side-panel {
  display: flex;
  position: relative;
  height: 100%;
  width: 300px;
  min-width: 300px;
  transition: all 0.3s ease;
  background-color: $bg-color-container;
  border-right: 1px solid $component-stroke;
  overflow: hidden;
  
  /* 侧边栏收起状态 */
  &.collapsed {
    width: 0;
    min-width: 0;
    
    .collapse-btn {
      right: 0;
    }
  }
}

.drawer-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  position: relative;
}

.new-conversation-container {
  position: sticky;
  top: 0;
  z-index: 10;
  background-color: $bg-color-container;
  padding-bottom: $comp-paddingTB-xs;
  border-bottom: 1px solid $component-stroke;
}

.feature-item {
  border-top: 1px dashed $component-stroke;
  margin-top: 8px;
  padding-top: 8px;
}

.conversations-list {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 50px; /* 给底部主题切换按钮留出空间 */
}

.conversation-item {
  display: flex;
  align-items: center;
  padding: $comp-paddingTB-s $comp-paddingLR-m;
  margin-bottom: $size-1;
  border-radius: $radius-default;
  transition: all 0.3s ease;
  position: relative;

  &:hover {
    background-color: $bg-color-container-hover;
  }

  &.active {
    background-color: $brand-color-light;
    color: $brand-color;

    .conversation-icon {
      color: $brand-color;
    }
  }

  .conversation-icon {
    margin-right: $size-2;
    color: $text-color-secondary;
  }

  .conversation-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.load-more-container {
  display: flex;
  justify-content: center;
  padding: $comp-paddingTB-s 0;
  margin-top: $comp-margin-s;
  border-top: 1px solid $component-stroke;
}

.theme-toggle-container {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  padding: $comp-paddingTB-s 0;
  background-color: $bg-color-container;
  border-top: 1px solid $component-stroke;
  z-index: 10;
  height: 50px;
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
  
  .theme-text {
    margin-left: $size-2;
  }
}

/* 收缩按钮样式 */
.collapse-btn {
  position: absolute;
  right: -16px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: $brand-color;
  color: white;
  border-radius: 0 4px 4px 0;
  z-index: 100;
  transition: right 0.3s ease;
  
  &:hover {
    background-color: darken($brand-color, 10%);
  }
}
</style> 