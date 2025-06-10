<template>
    <div class="shell">
      <!-- 工具栏 -->
      <div class="toolbar">
        <button @click="send">向 B 发送时间戳</button>
        <button @click="toggle">{{ visible ? '隐藏 B' : '显示 B' }}</button>
        <span>{{ status }}</span>
      </div>
  
      <!-- iframe：始终存在，但用 v-show 隐藏，首屏就开始预加载 -->
      <transition name="fade">
        <iframe
          v-show="visible"       
          ref="frameB"
          :src="bUrl"
          class="b-frame"
          loading="eager"         
        ></iframe>
      </transition>
    </div>
  </template>
  
  <script setup>
  import { ref, onMounted } from 'vue'
  
  const bUrl   = 'http://localhost:5173/crm'   // 子应用 URL
  const frameB = ref(null)
  const status = ref('B 未就绪')
  const visible = ref(false)               // **** 初始隐藏 ****
  
  /* ==== MessageChannel 双向通信 ==== */
  const channel = new MessageChannel()
  
  onMounted(() => {
    frameB.value.addEventListener('load', () => {
      // 把 port2 发送过去，建立专属通道
      frameB.value.contentWindow.postMessage({ cmd: 'init-port' }, bUrl, [channel.port2])
    })
  
    channel.port1.onmessage = (e) => {
      if (e.data.cmd === 'b-ready') status.value = 'B 已就绪'
      else if (e.data.cmd === 'reply') console.log('来自 B：', e.data.payload)
    }
  })
  
  function send () {
    channel.port1.postMessage({ cmd: 'data', payload: Date.now() })
  }
  
  function toggle () {
    visible.value = !visible.value
  }
  </script>
  
  <style scoped>
  .shell   { height: 100vh; display: flex; flex-direction: column; }
  .toolbar { padding: 12px; background: #eef; display: flex; gap: 8px; align-items: center; }
  .b-frame { flex: 1; width: 100%; border: none; }
  
  /* 可选淡入淡出动画 */
  .fade-enter-active, .fade-leave-active { transition: opacity .25s ease; }
  .fade-enter-from,  .fade-leave-to      { opacity: 0; }
  </style>
  