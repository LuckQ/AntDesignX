<template>
  <div class="chat-sender">
    <!-- 上传文件项展示 -->
    <!-- <div class="uploaded-files" v-if="uploadedFiles.length > 0">
      <t-space size="small" break-line>
        <t-tag v-for="(file, index) in uploadedFiles" :key="index" theme="default" variant="light" shape="round"
          size="medium" class="file-tag" @click="handleProcessFile(index)">
          <t-icon name="file-excel" class="file-icon" />
          <span class="file-name">{{ file.name }}</span>
          <span v-if="file.processed" class="status-tag processed">已处理</span>
          <span v-else class="status-tag">点击处理</span>
          <t-button theme="default" variant="text" size="small" class="close-btn" @click.stop="removeFile(index)">
            <t-icon name="close" />
          </t-button>
        </t-tag>
      </t-space>
    </div> -->

    <!-- 文件处理进度 -->
    <!-- <div v-if="processingFile" class="processing-progress">
      <t-progress :percentage="processingProgress" :color="{ from: '#108ee9', to: '#87d068' }" />
      <div class="progress-text">正在处理数据块: {{ processingProgress }}%</div>
    </div> -->

    <div class="input-container">
     <!-- <div class="attach-button-wrapper">
         <input type="file" ref="fileInput" @change="handleFileSelected" class="file-input" accept=".xlsx,.xls" />
        <t-button v-if="!isUploading" theme="default" variant="text" class="attachment-btn" @click="triggerFileInput">
          <template #icon><t-icon name="attach" size="22px" /></template>
        </t-button>
        <div v-else class="loading-container">
          <t-progress theme="circle" size="small" :percentage="uploadProgress"
            :color="{ from: '#108ee9', to: '#87d068' }" />
        </div>
      </div> -->
      <t-chat-input v-model="query" :stop-disabled="loading" :textarea-props="{
        placeholder: '请输入消息...',
        class: 'custom-textarea'
      }" @send="handleSend" @stop="handleStop" autosize>
      </t-chat-input>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue';
import { MessagePlugin, DialogPlugin, Progress as TProgress, Tag as TTag, Space as TSpace, Button as TButton } from 'tdesign-vue-next';
import { parseExcelFile, logExcelData, splitDataIntoBlocks, destroyWorker } from '../../../utils/excelHandler';
import workflowApi from '../../../utils/workflowApi';

// 并发控制
const MAX_CONCURRENT_REQUESTS = 10;

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
const uploadedFiles = ref<Array<{ name: string, size: number, data: any, processed: boolean }>>([]);
const processingFile = ref<boolean>(false);
const processingProgress = ref<number>(0);

// 分块配置
const blockOptions = {
  maxBlocks: 100,        // 最大分块数量
  minBlockSize: 500,    // 最小块大小
  overlapRows: 10        // 重叠行数
};

const handleSend = (value: string) => {
  if (!value.trim()) return;
  emit('send', value);
};

const handleStop = () => {
  emit('stop');
};

const triggerFileInput = () => {
  if (fileInput.value) {
    fileInput.value.click();
  }
};

const removeFile = (index: number) => {
  uploadedFiles.value = uploadedFiles.value.filter((_, i) => i !== index);
};

// 发送单个数据块的请求
const sendBlockRequest = async (block: any, blockIndex: number, totalBlocks: number, fileName: string) => {
  try {
    console.log(`[Excel请求] 正在发送数据块 ${blockIndex + 1}/${totalBlocks}`);

    // 准备数据块信息
    const blockData = {
      blockIndex,
      totalBlocks,
      fileName,
      size: block.size || block.data?.length || 0,
      startIndex: block.startIndex,
      endIndex: block.endIndex,
      hasOverlapTop: block.hasOverlapTop || false,
      hasOverlapBottom: block.hasOverlapBottom || false,
      data: block.data // 数据内容
    };

    // 节点状态更新回调函数
    const onNodeUpdate = (updateInfo: any) => {
      // 根据不同节点类型执行不同操作
      switch (updateInfo.type) {
        case 'workflow_started':
          console.log(`[数据块#${blockIndex + 1}] 工作流开始执行`, {
            workflowId: updateInfo.data.id,
            taskId: updateInfo.taskId,
            createdAt: new Date(updateInfo.data.created_at * 1000).toLocaleString()
          });
          break;

        case 'node_started':
          console.log(`[数据块#${blockIndex + 1}] 节点开始执行`, {
            nodeId: updateInfo.data.node_id,
            nodeName: updateInfo.data.title,
            nodeType: updateInfo.data.node_type,
            index: updateInfo.data.index
          });
          break;

        case 'node_finished':
          console.log(`[数据块#${blockIndex + 1}] 节点执行完成`, {
            nodeId: updateInfo.data.node_id,
            status: updateInfo.data.status,
            elapsedTime: updateInfo.data.elapsed_time,
            error: updateInfo.data.error
          });
          break;

        case 'workflow_finished':
          console.log(`[数据块#${blockIndex + 1}] 工作流执行完成`, {
            status: updateInfo.data.status,
            elapsedTime: updateInfo.data.elapsed_time,
            outputs: updateInfo.data.outputs,
            totalTokens: updateInfo.data.total_tokens,
            error: updateInfo.data.error
          });
          break;
      }
    };

    // 使用工作流API处理Excel数据块，启用流式输出和节点更新回调
    const response = await workflowApi.processExcelBlock(blockData, localStorage.getItem('dify_user_id') || 'user123', onNodeUpdate);

    // 返回结果
    return {
      blockIndex,
      success: true,
      data: response,
      message: `数据块 ${blockIndex + 1}/${totalBlocks} 处理成功`,
      workflowInfo: response.workflowInfo,
      nodeInfos: response.nodeInfos,
      finalResult: response.finalResult,
      taskId: response.taskId
    };
  } catch (error: any) {
    console.error(`[Excel请求] 数据块 ${blockIndex + 1}/${totalBlocks} 处理失败:`, error);
    return {
      blockIndex,
      success: false,
      error: error.message || '请求失败',
      message: `数据块 ${blockIndex + 1}/${totalBlocks} 处理失败: ${error.message || '未知错误'}`
    };
  }
};

// 使用Promise.all并控制并发量的工具函数
const promiseAllWithConcurrency = async (tasks: (() => Promise<any>)[], maxConcurrent: number) => {
  const results: any[] = [];
  const executing: Promise<any>[] = [];
  let completedCount = 0;

  for (const task of tasks) {
    // 创建任务并添加到正在执行的列表中
    const p = task().then(result => {
      // 当任务完成后，从executing数组中移除
      executing.splice(executing.indexOf(p), 1);
      completedCount++;

      // 更新进度
      processingProgress.value = Math.round((completedCount / tasks.length) * 100);

      return result;
    });

    executing.push(p);
    results.push(p);

    // 如果达到最大并发数，等待其中一个完成
    if (executing.length >= maxConcurrent) {
      await Promise.race(executing);
    }
  }

  // 等待所有任务完成
  return Promise.all(results);
};

// 处理文件的所有数据块
const processFileBlocks = async (fileData: any) => {
  if (!fileData || !fileData.blocks || fileData.blocks.length === 0) {
    console.warn('[Excel处理] 没有找到数据块');
    return;
  }
  
  const { blocks, fileName } = fileData;
  const totalBlocks = blocks.length;
  
  console.group(`===== 开始处理Excel文件 "${fileName}" 的${totalBlocks}个数据块 =====`);
  
  processingFile.value = true;
  processingProgress.value = 0;
  
  try {
    // 创建请求任务
    const tasks = blocks.map((block: any, index: number) => {
      return () => sendBlockRequest(block, index, totalBlocks, fileName);
    });
    
    // 开始处理，控制并发数量
    const results = await promiseAllWithConcurrency(tasks, MAX_CONCURRENT_REQUESTS);
    
    // 输出结果到控制台
    console.group(`===== Excel文件 "${fileName}" 数据块处理结果 =====`);
    console.log(`总共处理了 ${results.length} 个数据块，最大并发量: ${MAX_CONCURRENT_REQUESTS}`);
    
    // 成功和失败的数量
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;
    
    console.log(`成功: ${successful} 块, 失败: ${failed} 块`);
    
    // 汇总工作流节点信息
    const allWorkflowNodes = results
      .filter(r => r.success && r.nodeInfos)
      .flatMap(r => r.nodeInfos);
    
    if (allWorkflowNodes.length > 0) {
      console.group('工作流节点状态汇总:');
      // 按节点类型分组
      const nodesByType = {};
      allWorkflowNodes.forEach(node => {
        const type = node.node_type || '未知类型';
        if (!nodesByType[type]) nodesByType[type] = [];
        nodesByType[type].push(node);
      });
      
      // 显示各类型节点统计
      Object.entries(nodesByType).forEach(([type, nodes]) => {
        const nodeList = nodes as any[];
        const completed = nodeList.filter(n => n.status === 'succeeded').length;
        const failed = nodeList.filter(n => n.status === 'failed').length;
        const totalTime = nodeList.reduce((sum, n) => sum + (n.elapsed_time || 0), 0);
        
        console.log(`节点类型: ${type}`, {
          总数: nodeList.length,
          成功: completed,
          失败: failed,
          总耗时: `${totalTime.toFixed(2)}秒`,
          平均耗时: `${(totalTime / nodeList.length).toFixed(2)}秒`
        });
      });
      console.groupEnd();
    }
    
    // 汇总总体处理时间和令牌使用
    const totalTokens = results
      .filter(r => r.success && r.finalResult && r.finalResult.total_tokens)
      .reduce((sum, r) => sum + (r.finalResult.total_tokens || 0), 0);
    
    const totalElapsedTime = results
      .filter(r => r.success && r.finalResult && r.finalResult.elapsed_time)
      .reduce((sum, r) => sum + (r.finalResult.elapsed_time || 0), 0);
    
    console.log('总体处理统计:', {
      总令牌使用: totalTokens,
      总处理时间: `${totalElapsedTime.toFixed(2)}秒`,
      平均每块处理时间: successful > 0 ? `${(totalElapsedTime / successful).toFixed(2)}秒` : '0秒'
    });
    
    // 详细结果
    if (successful > 0) {
      console.group('成功的请求:');
      results.filter(r => r.success).forEach(result => {
        console.log(`数据块 #${result.blockIndex + 1}: ${result.message}`);
        if (result.finalResult) {
          console.log(`  状态: ${result.finalResult.status}, 耗时: ${result.finalResult.elapsed_time}秒`);
        }
      });
      console.groupEnd();
    }
    
    if (failed > 0) {
      console.group('失败的请求:');
      results.filter(r => !r.success).forEach(result => {
        console.error(`数据块 #${result.blockIndex + 1}: ${result.message}`);
      });
      console.groupEnd();
    }
    
    console.groupEnd();
    
    // 更新文件处理状态
    const fileIndex = uploadedFiles.value.findIndex(f => f.name === fileName);
    if (fileIndex !== -1) {
      uploadedFiles.value[fileIndex].processed = true;
    }
    
    return { 
      success: true, 
      totalBlocks, 
      successful, 
      failed, 
      totalTokens, 
      totalElapsedTime 
    };
  } catch (error: any) {
    console.error('[Excel处理] 处理数据块时出错:', error);
    return { success: false, error: error.message };
  } finally {
    processingFile.value = false;
    processingProgress.value = 100;
    console.groupEnd();
  }
};

const isExcelFile = (file: File): boolean => {
  const excelExtensions = ['.xlsx', '.xls'];
  const fileName = file.name.toLowerCase();
  return excelExtensions.some(ext => fileName.endsWith(ext));
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const updateProgress = (data: any) => {
  uploadProgress.value = data.progress || 0;

  // 控制台输出处理进度
  switch (data.phase) {
    case 'start':
      console.log('开始处理Excel文件...');
      break;
    case 'sheetInfo':
      console.log(`发现 ${data.totalSheets} 个工作表:`, data.sheetNames);
      break;
    case 'loading':
      console.log(`加载Excel数据: ${uploadProgress.value}%`);
      break;
    case 'parsing':
      console.log(`解析Excel数据: ${uploadProgress.value}%`);
      break;
    case 'sheetProcessed':
      console.log(`工作表 "${data.sheetName}" 已处理: ${data.totalRows} 行, ${data.blockCount} 数据块`);
      break;
  }
};

const handleFileSelected = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const files = input.files;

  if (!files || files.length === 0) {
    return;
  }

  const file = files[0];

  // 检查是否为Excel文件
  if (!isExcelFile(file)) {
    MessagePlugin.info('附件上传功能暂未实现，仅支持Excel文件(.xlsx, .xls)');
    // 重置文件输入框
    if (fileInput.value) {
      fileInput.value.value = '';
    }
    return;
  }

  // 检查文件大小
  if (file.size > 100 * 1024 * 1024) { // 大于100MB给予警告
    let shouldContinue = false;

    DialogPlugin.confirm({
      header: '文件过大',
      body: `文件大小为 ${formatFileSize(file.size)}，处理可能需要较长时间，确定继续吗？`,
      confirmBtn: { theme: 'primary', content: '继续' },
      cancelBtn: { theme: 'default', content: '取消' },
    }).then((result) => {
      if (result) {
        // 继续处理文件
        processFile();
      } else {
        // 用户取消，重置文件输入框
        if (fileInput.value) {
          fileInput.value.value = '';
        }
      }
    });

    return; // 中断后续处理，等待对话框结果
  }

  // 如果文件不大，直接处理
  processFile();

  // 文件处理函数
  async function processFile() {
    // 设置上传状态
    isUploading.value = true;
    uploadProgress.value = 0;

    try {
      console.log(`开始处理Excel文件: "${file.name}" (${formatFileSize(file.size)})`);

      // 使用excelHandler解析Excel文件
      const excelData = await parseExcelFile(file, updateProgress);

      // 获取分块信息
      let blocks = [];
      if (excelData.blocks) {
        // 直接使用Worker返回的分块信息
        blocks = excelData.blocks;
      } else if (excelData.data && excelData.data.length > 0) {
        // 执行数据分块
        blocks = splitDataIntoBlocks(excelData.data, blockOptions);
      }

      // 填充块数据 (如果Worker返回的blocks不包含完整数据)
      for (let i = 0; i < blocks.length; i++) {
        if (!blocks[i].data && excelData.data) {
          const start = blocks[i].startIndex;
          const end = blocks[i].endIndex;
          blocks[i].data = excelData.data.slice(start, end + 1);
        }
      }

      // 仅输出到控制台，不在页面显示
      console.group(`===== Excel文件 "${file.name}" 解析结果 =====`);
      console.log(`文件大小: ${formatFileSize(file.size)}`);
      console.log(`工作表数量: ${excelData.totalSheets}`);
      console.log(`工作表列表: ${excelData.sheetNames.join(', ')}`);
      console.log(`总行数: ${excelData.totalRows}`);
      console.log(`数据块数量: ${blocks.length}`);
      console.groupEnd();

      // 创建用于保存的文件对象
      const fileObj = {
        name: file.name,
        size: file.size,
        data: {
          ...excelData,
          blocks,
          fileName: file.name
        },
        processed: false
      };

      // 添加到上传文件列表
      uploadedFiles.value.push(fileObj);

      // 显示成功消息
      MessagePlugin.success(`Excel文件 "${file.name}" 已成功解析为 ${blocks.length} 个数据块，准备发送请求`);

      // 询问是否立即处理文件
      DialogPlugin.confirm({
        header: '文件已解析完成',
        body: `是否立即处理文件 "${file.name}" 并发送 ${blocks.length} 个数据块请求？`,
        confirmBtn: { theme: 'primary', content: '处理' },
        cancelBtn: { theme: 'default', content: '稍后处理' },
      }).then((result) => {
        if (result) {
          processFileBlocks(fileObj.data);
        }
      });

      // 大文件处理完成后释放Worker资源
      if (file.size > 50 * 1024 * 1024) {
        setTimeout(() => {
          destroyWorker();
          console.log('已释放Worker资源');
        }, 3000);
      }
    } catch (error: any) {
      console.error('处理Excel文件出错:', error);
      MessagePlugin.error(error.message || '处理Excel文件失败');
    } finally {
      // 重置上传状态
      isUploading.value = false;
      // 重置文件输入框
      if (fileInput.value) {
        fileInput.value.value = '';
      }
    }
  }
};

// 手动处理文件(添加到文件标签点击事件)
const handleProcessFile = async (index: number) => {
  const file = uploadedFiles.value[index];
  if (!file || file.processed) return;

  await processFileBlocks(file.data);
};

// 组件卸载时清理资源
onUnmounted(() => {
  destroyWorker();
});
</script>

<style lang="scss">
@import '/static/app/styles/variables.scss';

.chat-sender {
  padding: 0 $comp-margin-xs;
  display: flex;
  flex-direction: column;
}

.uploaded-files {
  margin-bottom: 8px;
  padding: 4px 8px;
}

.processing-progress {
  margin: 8px 0;
  padding: 0 12px;

  .progress-text {
    margin-top: 4px;
    text-align: center;
    font-size: 12px;
    color: var(--td-text-color-secondary, $font-gray-3);
  }
}

.file-tag {
  align-items: center;
  margin: 4px;
  padding: 2px 6px 2px 10px;
  background-color: var(--td-bg-color-container, $gray-color-1);
  border-color: var(--td-component-border, $gray-color-3);
  cursor: pointer;

  &:hover {
    background-color: var(--td-bg-color-container-hover, rgba($brand-color-1, 0.1));
  }

  .file-icon {
    color: $success-color-7;
    font-size: 16px;
    margin-right: 6px;
    display: flex;
    align-items: center;
  }

  .file-name {
    color: var(--td-text-color-primary, $font-gray-1);
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    line-height: 1;
  }

  .status-tag {
    font-size: 12px;
    margin-left: 6px;
    color: var(--td-text-color-secondary, $font-gray-3);

    &.processed {
      color: $success-color-7;
    }
  }

  .close-btn {
    width: 16px;
    height: 16px;
    margin-left: 8px;
    padding: 0;
    line-height: 1;
    color: var(--td-text-color-secondary, $font-gray-3);
    display: inline-flex;
    align-items: center;
    justify-content: center;

    .t-icon {
      font-size: 14px;
    }

    &:hover {
      color: $error-color-6;
      background: none;
    }
  }
}

.input-container {
  display: flex;
  align-items: center;
  position: relative;
}

.attach-button-wrapper {
  position: absolute;
  left: 15px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  z-index: -1;
}

.attachment-btn {
  color: var(--td-text-color-placeholder, $font-gray-4);
  font-size: 22px;
  padding: 2px 4px;

  &:hover {
    color: $brand-color-6;
  }
}

.loading-container {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn {
  color: var(--td-text-color-placeholder, $font-gray-4);
  border: none;

  &:hover {
    color: $brand-color-6;
    border: none;
    background: none;
  }
}

.t-chat__footer .t-chat__footer__content {
  margin-top: 0 !important;
}

/* 增加左侧内边距，为附件按钮腾出空间 */
.t-textarea__inner {
  // padding-left: 55px !important;
}
</style>
