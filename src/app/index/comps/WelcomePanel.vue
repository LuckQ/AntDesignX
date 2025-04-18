<template>
  <div class="welcome-panel animate-fade-in">
    <div class="welcome-header">
      <div class="logo-container">
        <img src="/static/files/favicon.png" alt="Logo" class="welcome-logo" />
      </div>
      <h1 class="welcome-title">DeepSeek-R1-671B（百年金钟，智启未来）</h1>
      <p class="welcome-subtitle">有什么我能帮您的吗？</p>
    </div>
    <!-- <div class="example-questions">
      <t-tag v-for="(question, index) in suggestedQuestions" 
             :key="index" 
             theme="primary" 
             variant="light" 
             class="question-tag" 
             size="medium"
             @click="handleQuestionClick(question)">
        {{ question }}
      </t-tag>
    </div> -->
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

// 定义组件属性
const props = defineProps({
  // 接收外部传入的建议问题
  suggestedQuestions: {
    type: Array,
    default: () => [
      "解释一下量子计算的基本原理",
      "帮我生成一个简单的Vue组件",
      "总结一下最新的AI技术发展",
      "如何优化前端性能？",
      "推荐几本机器学习的入门书籍"
    ]
  },
  // 添加Logo图片路径属性
  logoSrc: {
    type: String,
    default: "/static/files/favicon.png"
  }
});

// 定义向父组件发送的事件
const emit = defineEmits(['question-click']);

// 处理问题点击事件
const handleQuestionClick = (question) => {
  emit('question-click', question);
};
</script>

<style lang="scss" scoped>
// 添加渐变显示动画
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

.animate-fade-in {
  animation: fadeIn 0.8s ease-out forwards;
}

.welcome-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 20px 20px;
  height: 100%;
  max-width: 700px;
  margin: 0 auto;
  
  .welcome-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 40px;
    text-align: center;
    
    .logo-container {
      width: 80px;
      height: 80px;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      
      .welcome-logo {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      
      .logo-fallback {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: var(--td-brand-color-light);
        color: var(--td-brand-color);
        font-size: 32px;
        font-weight: 600;
        border-radius: 50%;
      }
    }
    
    .welcome-title {
      font-size: 28px;
      font-weight: 600;
      color: var(--td-text-color-primary);
      margin-bottom: 16px;
      line-height: 1.4;
    }
    
    .welcome-subtitle {
      font-size: 16px;
      color: var(--td-text-color-secondary);
      margin-bottom: 16px;
    }
  }
  
  .welcome-tips {
    width: 100%;
    text-align: center;
    margin-bottom: 40px;
    
    .tips-title {
      font-size: 18px;
      font-weight: 500;
      color: var(--td-text-color-primary);
      margin-bottom: 8px;
    }
    
    .tips-subtitle {
      font-size: 16px;
      color: var(--td-text-color-secondary);
    }
  }
  
  // .example-questions {
  //   display: flex;
  //   flex-wrap: wrap;
  //   justify-content: center;
  //   gap: 12px;
  //   margin-top: 20px;
    
  //   .question-tag {
  //     padding: 12px 20px;
  //     font-size: 14px;
  //     border-radius: 8px;
  //     transition: all 0.3s ease;
  //     background-color: #f0f0f0;
  //     color: #333;
  //     border: 1px solid #e0e0e0;
      
  //     &:hover {
  //       transform: translateY(-3px);
  //       box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  //     }
  //   }
  // }
}

/* 适配暗黑模式 */
[theme-mode="dark"] {
  .welcome-panel {
    .welcome-header {
      .logo-container {
        .logo-fallback {
          background-color: rgba(var(--td-brand-color-rgb), 0.2);
          color: var(--td-brand-color-light);
        }
      }
      
      .welcome-title {
        color: var(--td-text-color-primary);
      }
      
      .welcome-subtitle {
        color: var(--td-text-color-secondary);
      }
    }
    
    .welcome-tips {
      .tips-title, .tips-subtitle {
        color: var(--td-text-color-secondary);
      }
    }
    
    .example-questions {
      .question-tag:hover {
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
      }
    }
  }
}
</style> 