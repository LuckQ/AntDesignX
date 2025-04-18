<template>
    <t-chat-item :avatar="avatar" :name="name" :role="role" :datetime="datetime" :content="content">
        <template #content cla>

            <t-collapse :expand-icon="null" :borderless="true" :default-expand-all="isWorkflowCompleted"
                class="transparent-collapse" v-if="role === 'assistant' && workflowSteps && workflowSteps.length > 0">
                <t-collapse-panel value="0" :header="getCollapseHeader(workflowSteps)">
                    <t-timeline mode="same" :theme="dot" class="workflow-timeline">
                        <t-timeline-item v-for="(step, stepIndex) in workflowSteps" :key="stepIndex" :content="step.title"
                            :dot="getNodeDot(step.node_type, step.loading)" :dot-color="getNodeColor(step.node_type)">
                            <div v-if="step.loading" class="step-loading">
                                <span>{{ step.title }}</span><span class="loading-dots">{{ getLoadingDots() }}</span>
                            </div>
                            <div v-else-if="step.content">{{ step.content }}</div>
                        </t-timeline-item>
                    </t-timeline>
                </t-collapse-panel>
            </t-collapse>


            <!-- 只有助手消息且有思考内容才显示思考框 -->
            <t-chat-reasoning v-if="reasoning && reasoning.trim() && role === 'assistant' && reasoning !== '思考中...'"
                expand-icon-placement="right"
                @expand-change="(expandValue) => $emit('reasoning-expand-change', expandValue)">
                <template #header>
                    <t-chat-loading v-if="isFirstMessage && loading" text="思考中..." indicator />
                    <div v-else class="reasoning-header">
                        <t-icon name="dart-board"></t-icon>
                        <span>思考过程</span>
                    </div>
                </template>
                <t-chat-content :content="reasoning || ''" />
            </t-chat-reasoning>
            <!-- 显示消息内容，如果没有则显示占位 -->
            <t-chat-content v-if="content && content.trim().length > 0" :content="content" class="zero-margins" />

            <!-- 文件展示 -->
            <div class="message-files" v-if="files && files.length > 0">
                <div class="files-scroll-container">
                    <div class="files-list">
                        <t-tag v-for="(file, index) in files" :key="index" theme="default" variant="light" shape="round"
                            size="small" :class="['file-tag', getFileTypeClass(getFileExtension(file.filename))]">
                            <t-icon :name="getFileIcon(getFileExtension(file.filename))" class="file-icon" />
                            <span class="file-name">{{ formatFileName(file.filename) }}</span>
                        </t-tag>
                    </div>
                </div>
            </div>

        </template>

        <!-- 第一条消息且正在加载时显示加载动画 -->
        <template v-if="isFirstMessage && loading && !firstTokenReceived" #content>
            <div class="loading-space">
                <t-space>
                    <t-chat-loading animation="moving" text="思考中..." />
                </t-space>
            </div>
        </template>


        <!-- 操作按钮，只对助手消息显示 -->
        <template #actions>
            <chat-action class="chat-actions-container" v-if="!isStreamLoad && role === 'assistant'" :is-good="isGood" :is-bad="isBad"
                :content="content || ''" @operation="handleOperation" />    
        </template>
    </t-chat-item>
</template>

<script setup lang="jsx">
import { defineProps, defineEmits, ref, onMounted, onUnmounted, computed } from 'vue';
import ChatAction from './ChatAction.vue';

// 组件属性
const props = defineProps({
    avatar: {
        type: String,
        default: ''
    },
    name: {
        type: String,
        default: ''
    },
    role: {
        type: String,
        default: 'user'
    },
    datetime: {
        type: String,
        default: ''
    },
    content: {
        type: String,
        default: ''
    },
    reasoning: {
        type: String,
        default: ''
    },
    isFirstMessage: {
        type: Boolean,
        default: false
    },
    loading: {
        type: Boolean,
        default: false
    },
    firstTokenReceived: {
        type: Boolean,
        default: false
    },
    isStreamLoad: {
        type: Boolean,
        default: false
    },
    isGood: {
        type: Boolean,
        default: false
    },
    isBad: {
        type: Boolean,
        default: false
    },
    files: {
        type: Array,
        default: () => []
    },
    workflowSteps: {
        type: Array,
        default: () => []
    }
});

// 定义事件
const emit = defineEmits(['reasoning-expand-change', 'operation']);

// 处理操作事件，确保正确传递参数
const handleOperation = (type, options) => {
    emit('operation', type, options);
};

// 默认时间轴样式
const dot = ref('default');

// 动态省略号状态
const dotsCount = ref(1);
let dotsInterval = null;

// 创建动态省略号动画
onMounted(() => {
    dotsInterval = setInterval(() => {
        dotsCount.value = (dotsCount.value % 6) + 1;
    }, 100);
});

// 清理定时器
onUnmounted(() => {
    if (dotsInterval) {
        clearInterval(dotsInterval);
    }
});

// 计算属性：判断工作流是否已完成
const isWorkflowCompleted = computed(() => {
    return props.workflowSteps && props.workflowSteps.length > 0 && !props.workflowSteps.some(step => step.loading);
});

// 获取文件扩展名
const getFileExtension = (filename) => {
    if (!filename) return '';
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1) return '';
    return filename.slice(lastDotIndex + 1).toLowerCase();
};

// 文件类型映射
const fileTypeMap = {
    'document': 'document',
    'image': 'image',
    'audio': 'audio',
    'video': 'video',
    'txt': 'text',
    'md': 'markdown',
    'mdx': 'markdown',
    'markdown': 'markdown',
    'pdf': 'pdf',
    'html': 'code',
    'htm': 'code',
    'js': 'code',
    'ts': 'code',
    'css': 'code',
    'scss': 'code',
    'less': 'code',
    'json': 'code',
    'py': 'code',
    'java': 'code',
    'c': 'code',
    'cpp': 'code',
    'h': 'code',
    'php': 'code',
    'rb': 'code',
    'go': 'code',
    'rs': 'code',
    'swift': 'code',
    'kt': 'code',
    'dart': 'code',
    'vue': 'code',
    'jsx': 'code',
    'tsx': 'code',
    'xml': 'code',
    'yaml': 'code',
    'yml': 'code',
    'xlsx': 'spreadsheet',
    'xls': 'spreadsheet',
    'csv': 'spreadsheet',
    'docx': 'document',
    'doc': 'document',
    'rtf': 'document',
    'odt': 'document',
    'jpg': 'image',
    'jpeg': 'image',
    'png': 'image',
    'gif': 'image',
    'svg': 'image',
    'bmp': 'image',
    'webp': 'image',
    'mp3': 'audio',
    'wav': 'audio',
    'ogg': 'audio',
    'flac': 'audio',
    'aac': 'audio',
    'm4a': 'audio',
    'mp4': 'video',
    'avi': 'video',
    'mov': 'video',
    'wmv': 'video',
    'mkv': 'video',
    'webm': 'video',
    'custom': 'generic',
    'default': 'generic' // 默认/通用类型
};

// 文件图标映射
const fileIconMap = {
    'text': 'file-text',
    'markdown': 'catalog',
    'pdf': 'file-pdf',
    'code': 'file-code',
    'spreadsheet': 'file-excel',
    'document': 'file-word',
    'image': 'photo',
    'audio': 'play-circle',
    'video': 'play-circle-stroke',
    'generic': 'file' // 默认图标
};

// 获取文件类型
const getFileType = (extension) => {
    return fileTypeMap[extension?.toLowerCase()] || fileTypeMap.default;
};

// 获取文件图标
const getFileIcon = (extension) => {
    const fileType = getFileType(extension);
    return fileIconMap[fileType] || fileIconMap.generic;
};

// 获取文件类型对应的CSS类名
const getFileTypeClass = (extension) => {
    const fileType = getFileType(extension);
    return `file-type-${fileType}`;
};

// 添加：节点类型到图标的映射
const nodeTypeToIcon = {
    'default': 'check-circle-filled', // 默认节点
    'start': 'play-circle-filled',    // 开始节点
    'http': 'link',                   // HTTP请求节点
    'condition': 'swap',              // 条件分支节点
    'time': 'time',                   // 时间相关节点
    'search': 'search',               // 搜索节点
    'extract': 'filter',              // 参数提取节点
    'web': 'internet',                // Web搜索节点
    'file': 'file',                   // 文件节点
    'model': 'root-list',             // 模型节点
    'reply': 'chat',                  // 回复节点
    'error': 'error-circle',          // 错误节点
};

// 添加：节点类型到颜色的映射
const nodeTypeToColor = {
    'default': 'primary',            // 默认节点颜色
    'start': 'primary',              // 开始节点颜色
    'error': 'error',                // 错误节点颜色
    'condition': 'warning',          // 条件分支节点颜色
    'model': 'success',              // 模型节点颜色
    'reply': 'success',              // 回复节点颜色
};

// 添加：获取节点图标函数 - 使用JSX方式
const getNodeIcon = (nodeType) => {
    const iconName = nodeTypeToIcon[nodeType] || nodeTypeToIcon.default;
    return iconName;
};

// 添加：获取节点颜色函数
const getNodeColor = (nodeType) => {
    return nodeTypeToColor[nodeType] || 'primary';
};

// 使用JSX创建自定义dot
const getNodeDot = (nodeType, isLoading) => {
    const color = `var(--td-${getNodeColor(nodeType)}-color)`;
    const iconName = getNodeIcon(nodeType);

    return () => (
        <t-icon name={iconName} size="medium" color={color} />
    );
};

// 添加：获取动态省略号函数
const getLoadingDots = () => {
    const fullDots = '......'; // 6个点
    return fullDots.substring(0, dotsCount.value);
};

// 格式化文件名
const formatFileName = (fileName) => {
    if (!fileName) return '';
    if (fileName.length <= 8) return fileName;
    
    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex === -1) return fileName.slice(0, 5) + '...';
    
    const extension = fileName.slice(lastDotIndex);
    const name = fileName.slice(0, lastDotIndex);
    if (name.length <= 5) return fileName; // 如果名称部分已经很短，保留全名
    return name.slice(0, 5) + '...' + extension;
};

// 添加：获取折叠面板标题函数
const getCollapseHeader = (steps) => {
    const lastStep = steps[steps.length - 1];
    // 检查是否所有步骤都已完成（没有正在加载的步骤）
    const isCompleted = !steps.some(step => step.loading);

    if (isCompleted) {
        // 流程完成后显示"执行过程"
        return (
            <div class="workflow-header">
                <t-icon name={getNodeIcon(lastStep.node_type)} color={`var(--td-${getNodeColor(lastStep.node_type)}-color)`} />
                <span>执行过程</span>
            </div>
        );
    } else {
        // 流程未完成，显示最后一步的标题和加载动画
        return (
            <div class="workflow-header">
                <t-icon name={getNodeIcon(lastStep.node_type)} color={`var(--td-${getNodeColor(lastStep.node_type)}-color)`} />
                <span>{lastStep.title + getLoadingDots()}</span>
            </div>
        );
    }
};
</script>

<style lang="scss">
@import '/static/styles/variables.scss';

/* 添加基础过渡效果 */
.t-chat-item {
    transition: all 0.3s ease, width 0.3s ease, max-width 0.3s ease, transform 0.3s ease;
}

/* 消息内容容器 */
:deep(.t-chat__bubble) {
    transition: all 0.3s ease, width 0.3s ease, max-width 0.3s ease;
}

/* 透明折叠面板 */
.transparent-collapse {
    background-color: transparent;
    transition: all 0.3s ease;

    :deep(.t-collapse-panel__header) {
        background-color: transparent;
        transition: all 0.3s ease;
    }

    :deep(.t-collapse-panel__content) {
        background-color: transparent;
        transition: all 0.3s ease;
    }
}

/* 工作流时间线 */
.workflow-timeline {
    width: 100%;
    margin-top: 8px;
    transition: all 0.3s ease;

    .t-timeline-item {
        transition: all 0.3s ease;
    }
}

/* 思考框样式 */
:deep(.t-chat-reasoning) {
    transition: all 0.3s ease, max-width 0.3s ease, width 0.3s ease;
    
    .t-chat-reasoning__header, 
    .t-chat-reasoning__content {
        transition: all 0.3s ease;
    }
}

/* 思考框头部样式 */
.reasoning-header {
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.3s ease;

    .t-icon {
        font-size: 16px;
        color: var(--td-brand-color);
    }
}

/* 消息内容无边距 */
.zero-margins {
    margin: 0 !important;
    transition: all 0.3s ease;
}

/* 文件展示区域 */
.message-files {
    margin-top: 12px;
    transition: all 0.3s ease;
}

/* 文件滚动容器 */
.files-scroll-container {
    display: flex;
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
    transition: all 0.3s ease;

    &::-webkit-scrollbar {
        display: none;
    }

    .files-list {
        display: flex;
        align-items: center;
        padding-left: 4px;
        overflow: visible;
    }
}

/* 文件标签 */
.file-tag {
    position: relative;
    margin-left: -70px;
    padding: 5px 6px 5px 8px;
    max-width: 130px;
    min-width: 100px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    border-radius: 12px;
    transition: transform 0.2s ease, margin-left 0.2s ease, z-index 0s linear 0s, border-color 0.2s ease, background-color 0.2s ease;
    cursor: pointer;
    box-sizing: border-box;

    &:first-child {
        margin-left: 0;
    }

    &:hover {
        z-index: 10;
        transform: scale(1.05);
        border-color: var(--td-brand-color, $brand-color);
    }

    /* 文件图标 */
    .file-icon {
        font-size: 14px;
        margin-right: 4px;
        color: var(--td-text-color-secondary, $gray-color-7);
        flex-shrink: 0;
    }

    /* 文件名称 */
    .file-name {
        font-size: 12px;
        color: var(--td-text-color-primary, #000);
        flex-grow: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        margin-right: 4px;
    }

    /* 通用文件 - 灰色 */
    &.file-type-generic {
        background-color: var(--td-gray-color-1, #f3f3f3);
        border: 1px solid var(--td-gray-color-3, #dcdcdc);

        .file-icon {
            color: var(--td-text-color-secondary, $gray-color-7);
        }
    }

    /* 文本文档 (txt) - 保持蓝色 */
    &.file-type-text {
        background-color: var(--td-brand-color-light, rgba($brand-color, 0.1));
        border: 1px solid var(--td-brand-color-2, rgba($brand-color, 0.3));

        .file-icon {
            color: var(--td-brand-color, $brand-color);
        }
    }

    /* Markdown 文档 - 改为灰色 */
    &.file-type-markdown {
        background-color: var(--td-gray-color-1, #f3f3f3);
        border: 1px solid var(--td-gray-color-3, #dcdcdc);

        .file-icon {
            color: var(--td-text-color-secondary, $gray-color-7);
        }
    }

    /* PDF 文档 - 红色 */
    &.file-type-pdf {
        background-color: var(--td-error-color-1, rgba($error-color, 0.1));
        border: 1px solid var(--td-error-color-2, rgba($error-color, 0.3));

        .file-icon {
            color: var(--td-error-color, $error-color);
        }
    }

    /* 代码文件 - 橙色 */
    &.file-type-code {
        background-color: var(--td-warning-color-1, rgba($warning-color, 0.1));
        border: 1px solid var(--td-warning-color-2, rgba($warning-color, 0.3));

        .file-icon {
            color: var(--td-warning-color, $warning-color);
        }
    }

    /* 电子表格 - 绿色 */
    &.file-type-spreadsheet {
        background-color: var(--td-success-color-1, rgba($success-color, 0.1));
        border: 1px solid var(--td-success-color-2, rgba($success-color, 0.3));

        .file-icon {
            color: var(--td-success-color, $success-color);
        }
    }

    /* Word文档 - 蓝色 */
    &.file-type-document {
        background-color: var(--td-brand-color-light, rgba($brand-color, 0.1));
        border: 1px solid var(--td-brand-color-2, rgba($brand-color, 0.3));

        .file-icon {
            color: var(--td-brand-color, $brand-color);
        }
    }

    /* 图片 - 紫色 */
    &.file-type-image {
        background-color: var(--td-purple-color-1, rgba(#722ed1, 0.1));
        border: 1px solid var(--td-purple-color-3, rgba(#722ed1, 0.3));

        .file-icon {
            color: var(--td-purple-color, #722ed1);
        }
    }

    /* 音频 - 青色 */
    &.file-type-audio {
        background-color: var(--td-cyan-color-1, rgba(#13c2c2, 0.1));
        border: 1px solid var(--td-cyan-color-3, rgba(#13c2c2, 0.3));

        .file-icon {
            color: var(--td-cyan-color, #13c2c2);
        }
    }

    /* 视频 - 品红 */
    &.file-type-video {
        background-color: var(--td-magenta-color-1, rgba(#eb2f96, 0.1));
        border: 1px solid var(--td-magenta-color-3, rgba(#eb2f96, 0.3));

        .file-icon {
            color: var(--td-magenta-color, #eb2f96);
        }
    }
}

.t-tag.t-size-s{
    padding: 11px 6px 12px 8px;
}

/* 步骤加载中 */
.step-loading {
    display: flex;
    align-items: center;
    gap: 4px;
    transition: all 0.3s ease;
}

/* 加载点动画 */
.loading-dots {
    width: 24px;
    display: inline-block;
    transition: all 0.3s ease;
}

/* 加载空间 */
.loading-space {
    transition: all 0.3s ease;
    width: 100%;
}

/* 头像相关样式 */
:deep(.t-tag .t-icon) {
    width: 14px;
    height: 14px;
}

/* 工作流标题 */
.workflow-header {
    display: flex;
    align-items: center;
    gap: 6px;
    
    .t-icon {
        font-size: 16px;
    }
}
</style>