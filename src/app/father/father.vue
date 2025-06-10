<template>
    <div class="iframe-container">
        <iframe :src="iframeUrl" frameborder="0" width="100%" height="100%"></iframe>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

// 创建响应式的 iframe URL
const iframeUrl = ref('');

// 生成带有 token 的 URL
const generateUrl = () => {
    // 使用当前时间戳作为 token
    const token = new Date().getTime().toString();
    // 构建完整的 URL，包含 token 参数
    return `http://localhost:5173/?token=${token}`;
};

// 组件挂载时生成 URL
onMounted(() => {
    iframeUrl.value = generateUrl();
    
    // 可选：定时更新 token（如果需要）
    // setInterval(() => {
    //     iframeUrl.value = generateUrl();
    // }, 60000); // 每分钟更新一次
});
</script>

<style scoped lang="scss">
.iframe-container {
    width: 100%;
    height: 100vh; // 使用视口高度，让 iframe 填满整个页面
    overflow: hidden;
    position: relative;
    
    iframe {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        border: none;
    }
}
</style>

