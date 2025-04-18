<template>
    <div class="dataset-upload-container">
      <t-loading :loading="loading">
        <t-form class="upload-form" label-width="120px">
          <t-form-item label="文档文件" name="file">
            <t-input v-if="selectedFileName" :value="selectedFileName" readonly placeholder="已选择文件" :style="{ marginBottom: '8px' }">
              <template #suffix>
                <t-icon name="close-circle-filled" @click="clearSelectedFile" />
              </template>
            </t-input>
            <t-button v-if="!selectedFileName" @click="openFileSelector">
              选择文件
            </t-button>
            <input type="file" ref="fileInput" style="display: none;" accept=".txt,.md,.mdx,.pdf,.html,.htm,.xlsx,.xls,.docx,.csv" @change="onFileSelected" />
          </t-form-item>
          
          <t-form-item>
            <div class="file-limits">
              支持的文件类型：TXT、MD、MDX、PDF、HTML、XLSX、XLS、DOCX、CSV、HTML，单个文件不超过15MB
            </div>
          </t-form-item>
          
          <t-form-item>
            <t-space>
              <t-button theme="primary" @click="uploadSelectedFile" :loading="loading" :disabled="!selectedFile">上传</t-button>
              <t-button theme="default" @click="backToDetail">取消</t-button>
            </t-space>
          </t-form-item>
        </t-form>
      </t-loading>

      <!-- 仅在非弹窗模式下显示底部按钮 -->
      <div v-if="showBreadcrumb" class="form-actions">
        <t-button theme="default" @click="backToDetail">返回文档列表</t-button>
      </div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, defineProps, defineEmits } from 'vue';
import { useRoute } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import { createDocumentByFile } from '/static/api/dataset.js';

// 定义props和emits
const props = defineProps({
  datasetId: {
    type: [String, Number],
    required: true
  },
  isDialog: { // 添加属性标识是否在弹窗中显示
    type: Boolean,
    default: true
  }
});
const emit = defineEmits(['back']);

const route = useRoute();
const datasetId = ref('');
const loading = ref(false);
const showBreadcrumb = ref(!props.isDialog); // 只在非弹窗模式下显示面包屑

// 监听props中的datasetId变化
watch(() => props.datasetId, (newValue) => {
  if (newValue && (typeof newValue === 'string' || typeof newValue === 'number')) {
    console.log('更新datasetId:', newValue);
    datasetId.value = String(newValue);
  } else {
    console.warn('收到无效的datasetId:', newValue);
  }
}, { immediate: true });

// 文件选择相关
const fileInput = ref(null);
const selectedFile = ref(null);
const selectedFileName = ref('');

// 文件表单默认配置
const fileForm = ref({
  indexing_technique: 'high_quality',
  doc_form: 'hierarchical_model',
  doc_language: 'Chinese',
  embedding_model: 'bge-m3:latest',
  embedding_model_provider: 'langgenius/ollama/ollama',
  retrieval_model: {
    search_method: 'hybrid_search',
    reranking_enable: true,
    reranking_model: {
      reranking_provider_name: 'langgenius/xinference/xinference',
      reranking_model_name: 'bge-reranker-v2-m3'
    },
    top_k: 8,
    score_threshold_enabled: true,
    score_threshold: 0.15,
    reranking_mode: 'reranking_model',
    weights: {
      weight_type: 'customized',
      vector_setting: {
        vector_weight: 0.7,
        embedding_provider_name: '',
        embedding_model_name: ''
      },
      keyword_setting: {
        keyword_weight: 0.3
      }
    }
  },
  process_rule: {
    mode: 'hierarchical',
    rules: {
      pre_processing_rules: [
        { id: 'remove_extra_spaces', enabled: true },
        { id: 'remove_urls_emails', enabled: false }
      ],
      segmentation: {
        separator: '\n\n',
        max_tokens: 500
      },
      parent_mode: 'paragraph',
      subchunk_segmentation: {
        separator: '\n',
        max_tokens: 200
      }
    }
  }
});

// 组件初始化
onMounted(() => {
  // 设置显示模式
  showBreadcrumb.value = !props.isDialog;
  
  // 如果组件挂载时没有datasetId，尝试从路由参数获取
  if (!datasetId.value && route.params.id) {
    datasetId.value = route.params.id;
    console.log('从路由参数获取datasetId:', datasetId.value);
  }
  
  // 打印日志确认ID状态
  console.log('上传组件初始化，datasetId:', datasetId.value, 'props.datasetId:', props.datasetId);
});

// 打开文件选择器
const openFileSelector = () => {
  fileInput.value.click();
};

// 处理文件选择
const onFileSelected = (event) => {
  const files = event.target.files;
  if (files && files.length > 0) {
    selectedFile.value = files[0];
    selectedFileName.value = files[0].name;
  }
};

// 清除已选择文件
const clearSelectedFile = () => {
  selectedFile.value = null;
  selectedFileName.value = '';
  if (fileInput.value) {
    fileInput.value.value = '';
  }
};

// 上传选中的文件
const uploadSelectedFile = async () => {
  if (!selectedFile.value) {
    MessagePlugin.warning('请先选择一个文件');
    return;
  }
  
  // 检查文件大小，限制为15MB
  if (selectedFile.value.size > 15 * 1024 * 1024) {
    MessagePlugin.error('文件大小不能超过15MB');
    return;
  }

  // 检查datasetId是否存在
  if (!datasetId.value) {
    console.error('上传文件时知识库ID为空, props.datasetId:', props.datasetId);
    MessagePlugin.error('知识库ID不能为空，无法上传文件');
    return;
  }
  
  try {
    loading.value = true;
    
    const formData = new FormData();
    
    // 添加文件
    formData.append('file', selectedFile.value);
    
    // 准备数据对象
    const dataObj = {...fileForm.value};
    
    console.log('准备上传文件:', selectedFile.value.name, '配置:', dataObj);
    console.log('使用的知识库ID:', datasetId.value);
    formData.append('data', JSON.stringify(dataObj));
    
    // 上传文件
    const result = await createDocumentByFile(datasetId.value, formData);
    console.log('文件上传成功:', result);
    
    // 直接提示成功并返回
    MessagePlugin.success('文件已上传，正在处理中');
    
    // 直接关闭弹窗并返回到上一页，不再等待处理状态
    emit('back');
  } catch (error) {
    console.error('文件上传失败:', error);
    MessagePlugin.error('文件上传失败: ' + (error.message || '未知错误'));
  } finally {
    loading.value = false;
  }
};

// 返回详情页
const backToDetail = () => {
  emit('back'); // 使用emit事件代替路由跳转
};
</script>

<style lang="scss">
@import '/static/styles/variables.scss';

.dataset-upload-container {
  padding: $comp-paddingTB-l $comp-paddingLR-l;
}

/* 新增：返回按钮和标题的布局 */
.header-wrapper {
  display: flex;
  align-items: center;
  margin-bottom: $comp-margin-m;
  
  .upload-title {
    margin: 0 0 0 8px;
    font-size: 18px;
    font-weight: 500;
  }
}

.upload-form {
  max-width: 800px;
  margin: 0 auto;
}

.file-limits {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.4);
  line-height: 1.5;
}

.form-actions {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}
</style> 