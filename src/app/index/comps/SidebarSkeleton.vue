<template>
  <div class="sidebar-skeleton-container">
    <!-- 侧边栏头部骨架 -->
    <div class="sidebar-header-skeleton">
      <div class="icon-skeleton"></div>
      <div class="new-chat-skeleton"></div>
    </div>
    
    <!-- 会话项骨架，循环生成多个 -->
    <template v-for="(_, index) in 2" :key="index">
      <div class="conversation-skeleton" style="--anim-delay: calc(0.1s * (index + 2))">
        <div class="icon-skeleton small"></div>
        <div class="content-skeleton">
          <div class="title-skeleton"></div>
          <div class="subtitle-skeleton"></div>
        </div>
      </div>
    </template>

    <!-- 第二个分组 -->
    <div class="group-title-skeleton" style="--anim-delay: 0.7s;">
      <div class="title-line"></div>
    </div>
    
    <!-- 第二组会话项 -->
    <template v-for="(_, index) in 1" :key="`second-${index}`">
      <div class="conversation-skeleton" style="--anim-delay: calc(0.7s + 0.1s * (index + 1))">
        <div class="icon-skeleton small"></div>
        <div class="content-skeleton">
          <div class="title-skeleton"></div>
          <div class="subtitle-skeleton"></div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
// 骨架屏组件无需额外逻辑
</script>

<style lang="scss" scoped>
// 骨架屏动画
@keyframes pulse {
  0% {
    opacity: 0.6;
  }
  50% {
    opacity: 0.3;
  }
  100% {
    opacity: 0.6;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.sidebar-skeleton-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 12px;
}

.sidebar-header-skeleton {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding: 8px 0;
}

.icon-skeleton {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.08);
  animation: pulse 1.5s infinite;
  
  &.small {
    width: 20px;
    height: 20px;
    border-radius: 50%;
  }
}

.new-chat-skeleton {
  width: 80%;
  height: 36px;
  border-radius: 6px;
  background-color: rgba(0, 0, 0, 0.05);
  animation: pulse 1.5s infinite;
}

.group-title-skeleton {
  opacity: 0;
  transform: translateY(8px);
  animation: fadeIn 0.3s forwards;
  animation-delay: var(--anim-delay, 0s);
  margin-top: 8px;
  padding: 8px 4px;
  
  .title-line {
    width: 100px;
    height: 16px;
    border-radius: 4px;
    background-color: rgba(0, 0, 0, 0.08);
    animation: pulse 1.5s infinite;
  }
}

.conversation-skeleton {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 6px;
  background-color: rgba(0, 0, 0, 0.03);
  opacity: 0;
  transform: translateY(8px);
  animation: fadeIn 0.3s forwards;
  animation-delay: var(--anim-delay, 0s);
  margin-bottom: 8px;
  width: 100%;
  
  .content-skeleton {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    
    .title-skeleton {
      height: 16px;
      border-radius: 4px;
      background-color: rgba(0, 0, 0, 0.08);
      animation: pulse 1.5s infinite;
      width: 70%;
    }
    
    .subtitle-skeleton {
      height: 12px;
      border-radius: 4px;
      background-color: rgba(0, 0, 0, 0.06);
      animation: pulse 1.5s infinite;
      width: 40%;
    }
  }
}

/* 适配暗色模式 */
[theme-mode="dark"] {
  .icon-skeleton,
  .title-line,
  .title-skeleton,
  .subtitle-skeleton {
    background-color: rgba(255, 255, 255, 0.08);
  }
  
  .new-chat-skeleton {
    background-color: rgba(255, 255, 255, 0.05);
  }
  
  .conversation-skeleton {
    background-color: rgba(255, 255, 255, 0.03);
  }
}
</style> 