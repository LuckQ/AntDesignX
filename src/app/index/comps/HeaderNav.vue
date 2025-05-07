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
            <t-dropdown :options="modelOptions" @click="handleModelChange" trigger="click" maxColumnWidth="300px" :loading="loadingModels">
                <t-button variant="text" class="model-select-btn">
                    <template v-if="currentModel">
                        <span class="model-name">{{ currentModel.name }}</span>
                    </template>
                    <template v-else>
                        <span class="model-name">{{ loadingModels ? '加载中...' : (modelOptions.length > 0 ? '选择模型' : '无可用模型') }}</span>
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
import { API_CONFIG, switchModel, fetchAvailableModels } from '/static/api/config.js';

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

// 本地响应式模型列表
const localModels = ref([]);
// 当前选中的模型ID
const currentModelId = ref('');
// 模型加载状态
const loadingModels = ref(true);

// 计算当前选中的模型对象 (基于本地响应式列表)
const currentModel = computed(() => {
    return localModels.value.find(model => model.id === currentModelId.value);
});

// 转换模型数据为下拉选项格式 (基于本地响应式列表)
const modelOptions = computed(() => {
    return localModels.value.map(model => ({
        content: model.name,
        value: model.id,
        // prefixIcon: model.icon, // 新API模型没有icon字段，移除或根据需要调整
    }));
});

// 处理模型切换
const handleModelChange = (data: { value: string }) => {
    const newModelId = data.value;
    if (newModelId !== currentModelId.value) {
        currentModelId.value = newModelId;
        // 调用config.js中的switchModel来更新全局API_CONFIG.currentModel
        const config = switchModel(newModelId);
        if (config) {
            // 从本地响应式列表中找到当前模型对象并emit
            const selectedModelObject = localModels.value.find(m => m.id === newModelId);
            emit('model-changed', {
                modelId: newModelId,
                model: selectedModelObject
            });
        }
    }
};

// 从URL中获取模型ID
const getModelIdFromUrl = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('model');
};

// 初始化模型列表和选定模型
const initModelList = async () => {
    try {
        loadingModels.value = true;
        // 调用API获取模型列表 (fetchAvailableModels内部会更新API_CONFIG.models和API_CONFIG.defaultModel)
        const fetchedModels = await fetchAvailableModels();

        if (fetchedModels && fetchedModels.length > 0) {
            // 将获取到的模型列表赋值给本地响应式ref
            localModels.value = fetchedModels;

            const urlModelId = getModelIdFromUrl();
            let modelIdToSet = '';

            // 决定初始选中的模型ID的逻辑：URL参数 > API默认 > 列表第一个
            if (urlModelId && localModels.value.some(model => model.id === urlModelId)) {
                modelIdToSet = urlModelId;
            } else if (API_CONFIG.defaultModel && localModels.value.some(model => model.id === API_CONFIG.defaultModel)) {
                modelIdToSet = API_CONFIG.defaultModel;
            } else if (localModels.value.length > 0) {
                modelIdToSet = localModels.value[0].id;
            }

            if (modelIdToSet) {
                currentModelId.value = modelIdToSet;
                // 更新全局配置中的当前模型
                const config = switchModel(modelIdToSet);
                if (config) {
                    // Emit事件，让父组件知道模型已更改
                    const selectedModelObject = localModels.value.find(m => m.id === modelIdToSet);
                    emit('model-changed', {
                        modelId: modelIdToSet,
                        model: selectedModelObject
                    });
                }
            } else {
                console.warn('无法确定初始选中的模型ID，模型列表可能为空或不包含默认/URL指定模型。');
            }
        } else {
            console.error('未能获取到模型列表，或模型列表为空。');
            localModels.value = []; // 获取失败则清空本地列表
        }
    } catch (error) {
        console.error('初始化模型列表时发生错误:', error);
        localModels.value = []; // 出错则清空本地列表
    } finally {
        loadingModels.value = false;
    }
};

// 组件挂载时，初始化模型列表
onMounted(() => {
    initModelList();
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
            transform: scale(0);
            max-width: 0;
            min-width: 0;
            padding: 0;
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