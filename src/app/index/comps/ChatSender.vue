<template>
  <div class="chat-sender">
    <div class="input-container">
      <!-- 隐藏的文件输入框 -->
      <input type="file" ref="fileInput" @change="handleFileSelected" class="file-input"
        accept=".txt,.md,.mdx,.pdf,.html,.xlsx,.xls,.docx,.csv,.htm,.markdown" />
        
      <custom-chat-input
        v-model="query"
        :stop-disabled="loading"
        :loading="loading || isUploading"
        :uploading-file="isUploading"
        :uploaded-files="uploadedFiles"
        :textarea-props="{
          placeholder: '请输入消息...',
          class: 'custom-textarea'
        }"
        @send="handleSend"
        @stop="handleStop"
        @attach-click="triggerFileInput"
        @remove-file="removeFile"
      >
      </custom-chat-input>
      
      <!-- 上传进度显示 -->
      <div v-if="isUploading" class="upload-progress-overlay">
        <t-progress theme="circle" size="40" :percentage="uploadProgress"
          :color="{ from: '#108ee9', to: '#87d068' }" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue';
import { MessagePlugin, DialogPlugin, Progress as TProgress, Tag as TTag, Space as TSpace, Button as TButton } from 'tdesign-vue-next';
import { API_CONFIG } from '/static/api/config.js';
import CustomChatInput from './CustomChatInput.vue';

const props = defineProps({
  loading: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['send', 'stop']);

const query = ref('');
const fileInput = ref<HTMLInputElement | null>(null);
const isUploading = ref(false);
const uploadProgress = ref(0);
const uploadedFiles = ref<Array<{ id: string, name: string, size: number, extension: string, mime_type: string }>>([]);

// 支持的文件类型
const supportedExtensions = ['txt', 'md', 'mdx', 'pdf', 'html', 'xlsx', 'xls', 'docx', 'csv', 'htm', 'markdown'];

// 最大文件大小(字节)
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// 最大文件数量
const MAX_FILES = 10;

// 文件类型映射
const fileTypeMap = {
  // 文档
  'txt': 'document',
  'md': 'document',
  'mdx': 'document',
  'markdown': 'document',
  'pdf': 'document',
  'html': 'document',
  'htm': 'document',
  'xlsx': 'document',
  'xls': 'document',
  'docx': 'document',
  'csv': 'document'
};

// 文件图标映射
const fileIconMap = {
  'document': 'file-excel',
  'default': 'file'
};

const getFileIcon = (extension: string) => {
  const fileType = fileTypeMap[extension.toLowerCase()] || 'default';
  return fileIconMap[fileType] || 'file';
};

const handleSend = (value: string) => {
  if (!value.trim() && uploadedFiles.value.length === 0) return;

  let message = value;
  const files = uploadedFiles.value.map(file => ({
    type: 'document', // 所有支持的类型都是文档类型
    transfer_method: 'local_file',
    upload_file_id: file.id,
    // 使用filename属性以与chat.js一致
    filename: file.name,
    name: file.name,
    extension: file.extension,
    size: file.size
  }));

  emit('send', { message, files });

  // 清空已上传文件列表
  uploadedFiles.value = [];
};

const handleStop = () => {
  emit('stop');
};

const triggerFileInput = () => {
  if (uploadedFiles.value.length >= MAX_FILES) {
    MessagePlugin.warning(`最多只能上传${MAX_FILES}个附件`);
    return;
  }

  if (fileInput.value) {
    fileInput.value.click();
  }
};

const removeFile = (index: number) => {
  uploadedFiles.value = uploadedFiles.value.filter((_, i) => i !== index);
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatFileName = (fileName: string): string => {
  if (fileName.length <= 10) return fileName;
  const extension = fileName.slice(fileName.lastIndexOf('.'));
  const name = fileName.slice(0, fileName.lastIndexOf('.'));
  if (name.length <= 7) return fileName; // 如果名称部分已经很短，保留全名
  return name.slice(0, 7) + '...' + extension;
};

const isFileTypeSupported = (filename: string): boolean => {
  const extension = filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase();
  return supportedExtensions.includes(extension);
};

// 检查文件是否已存在
const isFileDuplicate = (fileName: string): boolean => {
  return uploadedFiles.value.some(file => file.name === fileName);
};

const handleFileSelected = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const files = input.files;

  if (!files || files.length === 0) {
    return;
  }

  const file = files[0];

  // 检查是否已达到最大文件数量
  if (uploadedFiles.value.length >= MAX_FILES) {
    MessagePlugin.warning(`最多只能上传${MAX_FILES}个附件`);
    // 重置文件输入框
    if (fileInput.value) {
      fileInput.value.value = '';
    }
    return;
  }

  // 检查是否重复文件
  if (isFileDuplicate(file.name)) {
    MessagePlugin.warning(`文件"${file.name}"已存在`);
    // 重置文件输入框
    if (fileInput.value) {
      fileInput.value.value = '';
    }
    return;
  }

  // 检查文件类型
  if (!isFileTypeSupported(file.name)) {
    MessagePlugin.warning('暂不支持此类型的文件');
    // 重置文件输入框
    if (fileInput.value) {
      fileInput.value.value = '';
    }
    return;
  }

  // 检查文件大小
  if (file.size > MAX_FILE_SIZE) {
    MessagePlugin.warning(`文件大小不能超过${formatFileSize(MAX_FILE_SIZE)}`);
    // 重置文件输入框
    if (fileInput.value) {
      fileInput.value.value = '';
    }
    return;
  }

  // 设置上传状态
  isUploading.value = true;
  uploadProgress.value = 0;

  try {
    // 准备FormData
    const formData = new FormData();
    formData.append('file', file);
    formData.append('user', localStorage.getItem('dify_user_id') || 'anonymous');

    // 模拟进度
    const progressInterval = setInterval(() => {
      if (uploadProgress.value < 90) {
        uploadProgress.value += 5;
      }
    }, 100);

    // 发送上传请求
    const response = await fetch(`${API_CONFIG.baseURL}/files/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_CONFIG.apiKey}`
      },
      body: formData
    });

    clearInterval(progressInterval);
    uploadProgress.value = 100;

    if (!response.ok) {
      throw new Error(`上传失败: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    // 添加到上传文件列表
    uploadedFiles.value.push({
      id: result.id,
      name: result.name,
      size: result.size,
      extension: result.extension,
      mime_type: result.mime_type
    });

    // 显示成功消息
    MessagePlugin.success(`上传成功`);
  } catch (error: any) {
    console.error('上传文件出错:', error);
    MessagePlugin.error(error.message || '上传文件失败');
  } finally {
    // 重置上传状态
    isUploading.value = false;
    // 重置文件输入框
    if (fileInput.value) {
      fileInput.value.value = '';
    }
  }
};
</script>

<style lang="scss">
@import '/static/styles/variables.scss';

.chat-sender {
  padding: 0 $comp-margin-xs 0;
  display: flex;
  flex-direction: column;
}

.input-container {
  display: flex;
  align-items: center;
  position: relative;
}

.file-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  z-index: -1;
}

.upload-progress-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.7);
  border-radius: 20px;
  z-index: 20;
}
</style>
