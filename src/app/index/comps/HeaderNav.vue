<template>
    <!-- 固定的头部导航栏 -->
    <div class="fixed-header" :class="{ 'sidebar-open': sidebarVisible, 'sidebar-closed': !sidebarVisible }">
        <!-- 左侧内容插槽 -->
        <slot name="left">
            <!-- 默认内容：菜单图标和新建对话按钮 -->
            <t-button variant="text" class="menu-btn" @click="$emit('open-drawer')"
                :class="{ 'menu-icon-visible': !sidebarVisible, 'menu-icon-hidden': sidebarVisible }">
                <t-icon name="menu" />
            </t-button>

            <t-button variant="text" class="menu-btn" @click="$emit('new-conversation')"
                :class="{ 'menu-icon-visible': !sidebarVisible, 'menu-icon-hidden': sidebarVisible }">
                <t-icon name="chat-add" />
            </t-button>
        </slot>

        <!-- 添加模型选择下拉菜单 -->
        <div class="model-selector">
            <t-dropdown :options="modelOptions" @click="handleModelChange" trigger="click" maxColumnWidth="300px">
                <t-button variant="text" class="model-select-btn">
                    <template v-if="currentModel">
                        <span class="model-name">{{ currentModel.name }}</span>
                    </template>
                    <t-icon name="chevron-down" />
                </t-button>
            </t-dropdown>
        </div>

        <!-- 中间标题 -->
        <!-- <div class="header-title" :class="{'slide-right': sidebarVisible}">
            {{ title }}
        </div>

        <t-button variant="text" class="header-icon" style="visibility: hidden;">
            <t-icon name="add" />
        </t-button> -->
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { API_CONFIG, switchModel } from '/static/api/config.js';

defineProps({
    title: {
        type: String,
        default: '新对话'
    },
    sidebarVisible: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['open-drawer', 'new-conversation', 'model-changed']);

// 当前选中的模型
const currentModelId = ref(API_CONFIG.defaultModel);

// 计算当前模型对象
const currentModel = computed(() => {
    return API_CONFIG.models.find(model => model.id === currentModelId.value);
});

// 转换模型数据为下拉选项格式
const modelOptions = computed(() => {
    return API_CONFIG.models.map(model => ({
        content: model.name,
        value: model.id,
        prefixIcon: model.icon
    }));
});

// 处理模型切换
const handleModelChange = (data: { value: string }) => {
    const newModelId = data.value;
    if (newModelId !== currentModelId.value) {
        currentModelId.value = newModelId;
        // 调用切换模型API
        const config = switchModel(newModelId);
        if (config) {
            // 通知父组件模型已更改
            emit('model-changed', {
                modelId: newModelId,
                model: currentModel.value
            });
        }
    }
};

// 从URL中获取模型ID
const getModelIdFromUrl = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('model');
};

// 组件挂载时，从URL获取模型参数
onMounted(() => {
    // 优先从URL中获取模型ID
    const urlModelId = getModelIdFromUrl();
    
    // 检查URL中的模型是否存在于可用模型列表中
    if (urlModelId && API_CONFIG.models.some(model => model.id === urlModelId)) {
        // URL中的模型ID有效，使用它
        currentModelId.value = urlModelId;
        // 调用切换模型API
        const config = switchModel(urlModelId);
        if (config) {
            // 通知父组件模型已更改
            emit('model-changed', {
                modelId: urlModelId,
                model: API_CONFIG.models.find(model => model.id === urlModelId)
            });
        }
    } else if (API_CONFIG.currentModel) {
        // 如果URL中没有模型ID或无效，但API_CONFIG中已有currentModel，则使用它
        currentModelId.value = API_CONFIG.currentModel;
    } else {
        // 否则使用默认模型并初始化
        switchModel(currentModelId.value);
    }
});
</script>

<style lang="scss">
@import '/static/styles/variables.scss';

.fixed-header {
    width: 100%;
    padding: $comp-paddingTB-m $comp-paddingLR-m;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    transition: transform 0.3s ease, margin-left 0.3s ease;
    will-change: transform, margin-left;

    .t-button {
        transition: all 0.25s ease;

        &:hover {
            transform: translateY(-1px);
        }
    }

    /* 模型选择器 */
    .model-selector {
        margin-right: 16px;

        .model-select-btn {
            display: flex;
            align-items: center;
            padding: 6px 12px;
            border-radius: 4px;
            background-color: transparent;

            &:hover {
                border-color: $brand-color;
                background-color: rgba($brand-color, 0.05);
            }

            .model-icon {
                margin-right: 6px;
                font-size: 16px;
            }

            .model-name {
                margin-right: 8px;
                font-size: $font-size-body-small;
                // max-width: 150px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
        }
    }

    .header-icon {
        color: $text-color-secondary;

        &:hover {
            color: $brand-color;
        }
    }

    .header-placeholder {
        /* 占位元素 */
        width: 32px;
        height: 32px;
        transition: all 0.3s ease, opacity 0.3s ease, visibility 0.3s ease;

        &.placeholder-visible {
            visibility: visible;
            opacity: 1;
        }

        &.placeholder-hidden {
            visibility: hidden;
            opacity: 0;
        }
    }

    .header-title {
        font-size: $font-size-body-medium;
        color: $text-color-primary;
        font-weight: 500;
        text-align: center;
        max-width: 80%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        transition: transform 0.3s ease, margin-left 0.3s ease;

        &.slide-right {
            /* 侧边栏打开时，标题适应推动效果 */
            transform: translateX(0);
        }
    }

    &.sidebar-open {
        /* 侧边栏打开 */
        margin-left: 0;
    }

    &.sidebar-closed {
        /* 侧边栏关闭 */
        margin-left: 0;
    }

    /* 菜单图标显隐动画 */
    .menu-btn {
        padding: 0 8px;
        margin-right: 8px;
        /* 定义过渡属性 */
        transition: opacity 0.3s ease,
            transform 0.3s ease,
            max-width 0.3s ease,
            padding 0.3s ease,
            margin 0.3s ease,
            min-width 0.3s ease;

        &.menu-icon-visible {
            opacity: 1;
            transform: scale(1);
            max-width: 40px;
            min-width: 32px;
            padding: 0 8px;
            margin-right: 8px;
        }

        &.menu-icon-hidden {
            opacity: 0;
            transform: scale(0.8);
            max-width: 0;
            min-width: 0;
            padding-left: 0;
            padding-right: 0;
            margin-right: 0;
            overflow: hidden;
        }
    }
}

:root[theme-mode="light"] {
    .fixed-header {
        // background-color: $gray-color-1 !important;
    }
}

:root[theme-mode="dark"] {
    .fixed-header {
        // background-color: $bg-color-container !important;
    }
}
</style>