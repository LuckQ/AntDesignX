<template>
    <div class="excel-container">
        <h1>Excel文件上传与内容展示</h1>

        <TUpload 
            accept=".xlsx, .xls" 
            :auto-upload="false"
            @change="handleFileChange" 
            theme="file"
            :multiple="false"
            draggable
            :disabled="isProcessing"
        >
            <TButton theme="primary" :loading="isProcessing">
                {{ isProcessing ? '正在处理...' : '点击或拖拽上传Excel文件' }}
            </TButton>
        </TUpload>

        <div v-if="isProcessing" class="processing-info">
            <div class="progress-header">
                <span class="phase-text">{{ processingPhase }}</span>
                <span class="progress-percent">{{ progress }}%</span>
            </div>
            <TProgress :percentage="progress" :color="{ from: '#108ee9', to: '#87d068' }" />
            <div v-if="processingMessage" class="processing-message">{{ processingMessage }}</div>
        </div>

        <div v-if="fileName" class="file-info">
            <div class="basic-info">
                <strong>文件名:</strong> {{ fileName }}
                <span v-if="fileSize" class="file-size">({{ formatFileSize(fileSize) }})</span>
            </div>
            <div class="excel-info">
                <div>已解析 {{ rowCount }} 条数据，共 {{ totalSheets }} 个工作表</div>
                <div v-if="sheetNames.length > 0" class="sheet-list">
                    <strong>工作表:</strong> {{ sheetNames.join(', ') }}
                </div>
            </div>

            <div v-if="blocks.length > 0" class="blocks-info">
                <h3>数据分块信息 ({{ blocks.length }}块)</h3>
                <div class="blocks-summary">
                    每块大小: 约{{ blockSizeInfo.avgBlockSize }}行 
                    (最小: {{ blockSizeInfo.minBlockSize }}行, 
                    最大: {{ blockSizeInfo.maxBlockSize }}行)
                </div>
                <div class="block-list">
                    <div 
                        v-for="(block, index) in blocksPreview" 
                        :key="index" 
                        class="block-item"
                    >
                        <div class="block-header">
                            <strong>块 #{{ block.blockId + 1 }}</strong>
                            <span class="block-size">{{ block.size }}行</span>
                        </div>
                        <div class="block-range">
                            索引范围: {{ block.startIndex }} - {{ block.endIndex }}
                        </div>
                        <div v-if="block.hasOverlapTop || block.hasOverlapBottom" class="block-overlap">
                            <div v-if="block.hasOverlapTop">
                                上方重叠: {{ block.originalStartIndex - block.startIndex }}行
                            </div>
                            <div v-if="block.hasOverlapBottom">
                                下方重叠: {{ block.endIndex - block.originalEndIndex }}行
                            </div>
                        </div>
                    </div>
                    <div v-if="blocks.length > blocksPreview.length" class="more-blocks">
                        ... 还有 {{ blocks.length - blocksPreview.length }} 个数据块 ...
                    </div>
                </div>
            </div>

            <div class="memory-management">
                <TButton theme="default" size="small" @click="clearMemory" :disabled="isProcessing">
                    清理内存
                </TButton>
                <span class="tip">上传大文件后可点击此按钮释放内存</span>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import { message } from 'ant-design-vue';
import { Upload as TUpload, Button as TButton, Progress as TProgress } from 'tdesign-vue-next';
import { parseExcelFile, logExcelData, splitDataIntoBlocks, destroyWorker } from '../../utils/excelHandler';

// 数据统计
const fileName = ref('');
const fileSize = ref(0);
const rowCount = ref(0);
const totalSheets = ref(0);
const sheetNames = ref<string[]>([]);
const blocks = ref<any[]>([]);

// 处理状态
const isProcessing = ref(false);
const progress = ref(0);
const processingPhase = ref('');
const processingMessage = ref('');

// 分块配置
const blockOptions = {
    maxBlocks: 100,        // 最大分块数量
    minBlockSize: 500,    // 最小块大小
    overlapRows: 10        // 重叠行数
};

// 仅在界面上显示前5个数据块
const blocksPreview = computed(() => {
    return blocks.value.slice(0, 5);
});

// 计算数据块大小统计信息
const blockSizeInfo = computed(() => {
    if (blocks.value.length === 0) {
        return { minBlockSize: 0, maxBlockSize: 0, avgBlockSize: 0 };
    }
    
    const sizes = blocks.value.map(block => block.size);
    const minBlockSize = Math.min(...sizes);
    const maxBlockSize = Math.max(...sizes);
    const avgBlockSize = Math.round(sizes.reduce((sum, size) => sum + size, 0) / sizes.length);
    
    return { minBlockSize, maxBlockSize, avgBlockSize };
});

// 格式化文件大小显示
const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// 更新处理进度
const updateProgress = (data: any) => {
    progress.value = data.progress || 0;
    
    switch (data.phase) {
        case 'start':
            processingPhase.value = '开始处理...';
            processingMessage.value = '正在准备读取文件';
            break;
        case 'sheetInfo':
            processingPhase.value = '读取文件结构';
            processingMessage.value = `发现 ${data.totalSheets} 个工作表`;
            break;
        case 'loading':
            processingPhase.value = '加载文件内容';
            processingMessage.value = '正在读取Excel数据';
            break;
        case 'parsing':
            processingPhase.value = '解析Excel数据';
            processingMessage.value = '正在转换为JSON格式';
            break;
        case 'sheetProcessed':
            processingPhase.value = '处理工作表';
            processingMessage.value = `工作表 "${data.sheetName}" 已处理，包含 ${data.totalRows} 行数据，分为 ${data.blockCount} 个数据块`;
            break;
        default:
            processingPhase.value = '处理中...';
            processingMessage.value = '';
    }
};

// 处理文件变更
const handleFileChange = async (files: any) => {
    if (!files || !files.length || !files[0]) {
        return;
    }

    const file = files[0].raw || files[0];
    
    if (!file || !(file instanceof File)) {
        message.error('无法获取有效的文件对象');
        return;
    }
    
    // 记录文件大小
    fileSize.value = file.size;
    
    // 检查文件大小
    if (file.size > 100 * 1024 * 1024) { // 大于100MB给予警告
        const confirm = window.confirm(`文件大小为 ${formatFileSize(file.size)}，处理可能需要较长时间，确定继续吗？`);
        if (!confirm) return;
    }
    
    // 设置处理状态
    isProcessing.value = true;
    progress.value = 0;
    processingPhase.value = '准备处理...';
    processingMessage.value = '';
    
    try {
        // 使用excelHandler解析Excel文件
        const excelData = await parseExcelFile(file, updateProgress);
        
        // 更新组件状态
        fileName.value = excelData.fileName;
        rowCount.value = excelData.totalRows;
        totalSheets.value = excelData.totalSheets;
        sheetNames.value = excelData.sheetNames;
        
        // 获取分块信息
        if (excelData.blocks) {
            // 直接使用Worker返回的分块信息
            blocks.value = excelData.blocks;
        } else if (excelData.data && excelData.data.length > 0) {
            // 执行数据分块
            blocks.value = splitDataIntoBlocks(excelData.data, blockOptions);
        } else {
            blocks.value = [];
        }
        
        // 输出到控制台
        logExcelData(excelData, { 
            showAllSheets: true,
            useBlocks: true,
            blockOptions
        });
        
        message.success(`文件 "${file.name}" 已成功解析，共 ${excelData.totalRows} 条数据，分为 ${blocks.value.length} 个数据块`);
        
        // 大文件处理完成后提示用户可以释放内存
        if (file.size > 50 * 1024 * 1024) {
            setTimeout(() => {
                message.info('提示：处理完成后，您可以点击"清理内存"按钮释放资源');
            }, 2000);
        }
    } catch (error) {
        message.error(error.message || '解析Excel文件失败');
        console.error('解析Excel文件出错:', error);
    } finally {
        // 重置处理状态
        isProcessing.value = false;
    }
};

// 清理内存
const clearMemory = () => {
    try {
        // 清空大型数据引用
        blocks.value = [];
        
        // 销毁Worker
        destroyWorker();
        
        // 强制垃圾回收（如果浏览器支持）
        if (window.gc) window.gc();
        
        message.success('内存已清理');
    } catch (error) {
        message.error('内存清理失败');
        console.error('内存清理错误:', error);
    }
};

// 组件卸载时清理资源
onUnmounted(() => {
    destroyWorker();
});
</script>

<style scoped>
.excel-container {
    padding: 20px;
    max-width: 1200px;
    margin: 0 auto;
}

.processing-info {
    margin: 16px 0;
    padding: 10px;
    border-radius: 4px;
    background-color: #f9f9f9;
}

.progress-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
}

.phase-text {
    font-weight: bold;
    color: #333;
}

.progress-percent {
    color: #108ee9;
}

.processing-message {
    margin-top: 8px;
    font-size: 12px;
    color: #888;
}

.file-info {
    margin: 16px 0;
    font-size: 14px;
    color: #666;
}

.file-size {
    margin-left: 6px;
    color: #999;
    font-size: 12px;
}

.basic-info {
    margin-bottom: 8px;
}

.excel-info {
    margin-top: 8px;
    color: #1890ff;
    font-weight: bold;
}

.sheet-list {
    margin-top: 4px;
    font-size: 12px;
    color: #666;
    font-weight: normal;
}

.blocks-info {
    margin-top: 24px;
    padding: 16px;
    border: 1px solid #f0f0f0;
    border-radius: 4px;
    background-color: #fafafa;
}

.blocks-info h3 {
    margin: 0 0 12px 0;
    font-size: 16px;
    color: #444;
}

.blocks-summary {
    margin-bottom: 16px;
    color: #666;
    font-size: 13px;
}

.block-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
}

.block-item {
    padding: 10px;
    background-color: #fff;
    border: 1px solid #e8e8e8;
    border-radius: 4px;
    font-size: 12px;
}

.block-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
    font-size: 13px;
}

.block-size {
    color: #1890ff;
    font-weight: bold;
}

.block-range {
    color: #666;
    margin-bottom: 4px;
}

.block-overlap {
    color: #999;
    font-size: 11px;
    margin-top: 6px;
}

.more-blocks {
    grid-column: 1 / -1;
    text-align: center;
    padding: 10px;
    color: #999;
    font-style: italic;
}

.memory-management {
    margin-top: 20px;
    padding: 10px;
    background-color: #f0f9ff;
    border: 1px dashed #d9f2ff;
    border-radius: 4px;
    display: flex;
    align-items: center;
}

.tip {
    margin-left: 12px;
    font-size: 12px;
    color: #888;
}

h1 {
    margin-bottom: 24px;
    color: #1890ff;
}
</style>
