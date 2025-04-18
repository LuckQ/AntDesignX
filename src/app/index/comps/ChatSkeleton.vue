<template>
  <div class="chat-skeleton-container">
    <!-- 头像和用户信息骨架 -->
    <div class="message-skeleton user-message" style="--anim-delay: 0.1s;">
      <div class="avatar-skeleton"></div>
      <div class="content-wrapper">
        <div class="header-skeleton">
          <div class="name-skeleton"></div>
          <div class="time-skeleton"></div>
        </div>
        <div class="content-skeleton">
          <div class="line"></div>
          <div class="line short"></div>
        </div>
      </div>
    </div>
    
    <!-- 助手回复骨架 -->
    <div class="message-skeleton assistant-message" style="--anim-delay: 0.2s;">
      <div class="avatar-skeleton assistant"></div>
      <div class="content-wrapper">
        <div class="header-skeleton">
          <div class="name-skeleton"></div>
          <div class="time-skeleton"></div>
        </div>
        <div class="content-skeleton">
          <div class="line"></div>
          <div class="line"></div>
          <div class="line medium"></div>
          <div class="line long"></div>
          <div class="line medium"></div>
        </div>
      </div>
    </div>
    
    <!-- 再添加一组用户和助手骨架 -->
    <div class="message-skeleton user-message" style="--anim-delay: 0.3s;">
      <div class="avatar-skeleton"></div>
      <div class="content-wrapper">
        <div class="header-skeleton">
          <div class="name-skeleton"></div>
          <div class="time-skeleton"></div>
        </div>
        <div class="content-skeleton">
          <div class="line medium"></div>
          <div class="line short"></div>
        </div>
      </div>
    </div>
    
    <div class="message-skeleton assistant-message" style="--anim-delay: 0.4s;">
      <div class="avatar-skeleton assistant"></div>
      <div class="content-wrapper">
        <div class="header-skeleton">
          <div class="name-skeleton"></div>
          <div class="time-skeleton"></div>
        </div>
        <div class="content-skeleton">
          <div class="line"></div>
          <div class="line long"></div>
          <div class="line"></div>
          <div class="line short"></div>
        </div>
      </div>
    </div>
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
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.chat-skeleton-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 16px;
}

.message-skeleton {
  display: flex;
  gap: 12px;
  width: 100%;
  opacity: 0;
  transform: translateY(20px);
  animation: fadeIn 0.5s forwards;
  animation-delay: var(--anim-delay, 0s);
  
  &.user-message {
    align-self: flex-end;
    flex-direction: row-reverse;
    
    .content-skeleton {
      background-color: rgba(var(--td-brand-color-light), 0.1);
    }
    
    .avatar-skeleton {
      background-color: rgba(var(--td-brand-color), 0.2);
    }
  }
  
  &.assistant-message {
    align-self: flex-start;
    
    .content-skeleton {
      background-color: rgba(0, 0, 0, 0.04);
    }
    
    .avatar-skeleton {
      &.assistant {
        background-color: rgba(var(--td-warning-color), 0.2);
      }
    }
  }
}

.avatar-skeleton {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  animation: pulse 1.5s infinite;
}

.content-wrapper {
  flex: 1;
  max-width: 85%;
}

.header-skeleton {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.name-skeleton {
  width: 80px;
  height: 16px;
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.08);
  animation: pulse 1.5s infinite;
}

.time-skeleton {
  width: 120px;
  height: 16px;
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.08);
  animation: pulse 1.5s infinite;
}

.content-skeleton {
  padding: 16px;
  border-radius: 8px;
  
  .line {
    height: 16px;
    border-radius: 4px;
    background-color: rgba(0, 0, 0, 0.08);
    margin-bottom: 12px;
    width: 100%;
    animation: pulse 1.5s infinite;
    
    &:last-child {
      margin-bottom: 0;
    }
    
    &.short {
      width: 40%;
    }
    
    &.medium {
      width: 70%;
    }
    
    &.long {
      width: 90%;
    }
  }
}

/* 适配暗色模式 */
[theme-mode="dark"] {
  .message-skeleton {
    &.user-message {
      .content-skeleton {
        background-color: rgba(var(--td-brand-color), 0.15);
      }
    }
    
    &.assistant-message {
      .content-skeleton {
        background-color: rgba(255, 255, 255, 0.05);
      }
    }
  }
  
  .name-skeleton,
  .time-skeleton,
  .content-skeleton .line {
    background-color: rgba(255, 255, 255, 0.08);
  }
}
</style> 