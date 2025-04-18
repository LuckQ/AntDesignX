<script setup lang="ts">
</script>

<template>
  <div class="app-container">
    <router-view></router-view>
  </div>
</template>

<style>
/* 全局样式 */
.app-container {
  overflow: hidden;
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
