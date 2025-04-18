<template>
    <div class="dataset-detail-container">
        <t-breadcrumb class="breadcrumb">
            <t-breadcrumb-item @click="backToList">{{ datasetName }}</t-breadcrumb-item>
            <t-breadcrumb-item>知识库详情</t-breadcrumb-item>
        </t-breadcrumb>

        <t-card title="文档列表" class="document-list-card">
            <template #actions>
                <t-button theme="primary" @click="showUploadDocument">上传文档</t-button>
            </template>

            <t-loading :loading="loading">
                <div v-if="documentList.length > 0" class="debug-info">
                    已加载 {{ documentList.length }} 条记录
                </div>

                <t-table :data="documentList" :columns="columns" :row-key="getRowKey" stripe hover
                    :pagination="pagination" @page-change="onPaginationChange" empty="暂无文档">
                    <template #statusCol="{ row }">
                        <div class="status-wrapper">
                            <t-tag :theme="getStatusTag(row.display_status).theme" :class="{'available-tag': row.display_status === 'available'}">
                                {{ getStatusTag(row.display_status).text }}
                            </t-tag>
                            <t-progress
                                v-if="isProcessingStatus(row.display_status) && processingDocuments[row.id] && processingDocuments[row.id].total_segments > 0"
                                theme="line" size="small" :percentage="calculateProgress(processingDocuments[row.id])"
                                :label="false" class="status-progress" />
                        </div>
                    </template>
                    <template #createdAtCol="{ row }">
                        {{ formatDate(row.created_at) }}
                    </template>
                </t-table>
            </t-loading>
        </t-card>

        <!-- 上传文档弹窗 -->
        <t-dialog header="上传文档" :visible.sync="showUploadDialog" :width="800" :footer="false"
            @close="handleDialogClose" class="upload-dialog" placement="center" :show-overlay-close="false">
            <template v-if="datasetId">
                <div>
                    <DatasetUpload :key="'upload-' + datasetId" :datasetId="String(datasetId)" :isDialog="true"
                        @back="handleUploadComplete" />
                </div>
            </template>
        </t-dialog>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref, onUnmounted, defineProps, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import { getDocumentList, getDocumentIndexingStatus } from '/static/api/dataset.js';
import DatasetUpload from './upload.vue'; // 导入上传组件

// 接收父组件传递的props
const props = defineProps({
    datasetId: {
        type: [String, Number],
        required: true
    }
});

const route = useRoute();
const router = useRouter();
// 优先使用props中的datasetId，如果没有则尝试使用路由参数
const datasetId = ref(props.datasetId || route.params.id);
const datasetName = ref(route.query.name || `知识库${datasetId.value}`); // 获取知识库名称
const loading = ref(true);
const documentList = ref([]);
const pagination = ref({
    current: 1,
    pageSize: 10,
    total: 0
});

// 处理中文档的状态
const processingDocuments = ref({});
const statusCheckInterval = ref(null);
const showUploadDialog = ref(false); // 控制上传弹窗显示

// 定义emit
const emit = defineEmits(['back', 'upload']);

// 格式化日期
const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
};

// 判断是否为处理中状态
const isProcessingStatus = (status) => {
    return ['waiting', 'queuing', 'indexing'].includes(status);
};

// 定义表格列
const columns = [
    { colKey: 'index', title: '序号', width: '30', cell: (h, { rowIndex }) => (pagination.value.current - 1) * pagination.value.pageSize + rowIndex + 1, align: 'center' },
    { colKey: 'name', title: '文档名称' },
    { colKey: 'word_count', title: '字数', width: '80', align: 'center' },
    { colKey: 'created_at', title: '创建时间', cell: 'createdAtCol', width: '180', align: 'center' },
    { colKey: 'display_status', title: '状态', cell: 'statusCol', width: '80', align: 'center' }
];

// 获取文档状态标签
const getStatusTag = (status) => {
    const statusMap = {
        waiting: { text: '等待中', theme: 'warning' },
        indexing: { text: '处理中', theme: 'primary' },
        completed: { text: '已完成', theme: 'success' },
        error: { text: '错误', theme: 'danger' },
        queuing: { text: '排队中', theme: 'warning' },
        available: { text: '可使用', theme: 'success' }
    };

    return statusMap[status] || { text: status, theme: 'default' };
};

// 计算进度百分比
const calculateProgress = (statusData) => {
    if (!statusData || !statusData.total_segments || statusData.total_segments === 0) {
        return 0;
    }
    return Math.floor((statusData.completed_segments / statusData.total_segments) * 100);
};

// 获取行唯一标识
const getRowKey = (row) => {
    // 优先使用id字段，如果没有则使用name或其他可能的唯一字段
    return row.id || row._id || row.name || JSON.stringify(row);
};

// 获取文档列表
const fetchDocumentList = async () => {
    // 检查datasetId是否存在
    if (!datasetId.value) {
        console.error('知识库ID不能为空');
        MessagePlugin.error('知识库ID不能为空');
        return;
    }

    loading.value = true;
    try {
        console.log('正在获取文档列表，datasetId:', datasetId.value);
        const response = await getDocumentList(datasetId.value, {
            page: pagination.value.current,
            limit: pagination.value.pageSize
        });

        console.log('获取文档列表原始响应:', response);

        // 处理响应数据
        let documents = [];
        if (response.data && Array.isArray(response.data)) {
            documents = response.data;
        } else if (response.data) {
            // 如果data不是数组但存在，则转为数组
            documents = [response.data];
        } else if (Array.isArray(response)) {
            // 如果整个响应就是数组
            documents = response;
        } else if (response.items && Array.isArray(response.items)) {
            // 有些API返回格式可能是items字段
            documents = response.items;
        } else {
            documents = [];
        }

        // 检查并补全每条记录的必要字段
        documentList.value = documents.map(doc => {
            // 确保每个记录都有display_status和created_at字段
            return {
                ...doc,
                display_status: doc.display_status || doc.status || 'completed',
                created_at: doc.created_at || doc.createdAt || Math.floor(Date.now() / 1000)
            };
        });

        // 设置分页总数
        if (response.total !== undefined) {
            pagination.value.total = response.total;
        } else if (response.meta && response.meta.total !== undefined) {
            pagination.value.total = response.meta.total;
        }

        console.log('处理后的文档列表:', documentList.value);

        // 检查处理中的文档
        checkProcessingDocuments();
    } catch (error) {
        console.error('获取文档列表失败:', error);
        MessagePlugin.error('获取文档列表失败');
        documentList.value = [];
    } finally {
        loading.value = false;
    }
};

// 检查处理中的文档
const checkProcessingDocuments = () => {
    // 清理之前的状态检查
    if (statusCheckInterval.value) {
        clearInterval(statusCheckInterval.value);
    }

    // 筛选出处理中的文档
    const processingDocs = documentList.value.filter(doc => isProcessingStatus(doc.display_status));

    if (processingDocs.length > 0) {
        // 立即检查一次
        processingDocs.forEach(doc => {
            if (doc.batch) {
                checkDocumentStatus(doc.id, doc.batch);
            }
        });

        // 设置定时检查
        statusCheckInterval.value = setInterval(() => {
            let hasProcessing = false;

            documentList.value.forEach(doc => {
                if (isProcessingStatus(doc.display_status) && doc.batch) {
                    checkDocumentStatus(doc.id, doc.batch);
                    hasProcessing = true;
                }
            });

            // 如果没有正在处理的文档，停止检查
            if (!hasProcessing) {
                clearInterval(statusCheckInterval.value);
            }
        }, 500); // 更新间隔为0.5秒
    }
};

// 检查单个文档状态
const checkDocumentStatus = async (docId, batch) => {
    try {
        const response = await getDocumentIndexingStatus(datasetId.value, batch);
        if (response && response.data && response.data.length > 0) {
            const status = response.data[0];

            // 更新处理状态
            processingDocuments.value[docId] = status;

            // 如果状态已变化，刷新列表
            if (status.indexing_status === 'completed' || status.indexing_status === 'error') {
                // 给状态变化一点延迟，确保后端状态已更新
                setTimeout(() => {
                    fetchDocumentList();
                }, 1000);
            }
        }
    } catch (error) {
        console.error('获取文档处理状态失败:', error);
    }
};

// 监听props变化，更新datasetId - 移到fetchDocumentList定义之后
watch(() => props.datasetId, (newId) => {
    if (newId) {
        datasetId.value = newId;
        // 重置分页并重新获取文档列表
        pagination.value.current = 1;
        fetchDocumentList();
    }
}, { immediate: true });

// 分页变化
const onPaginationChange = (pageInfo) => {
    pagination.value.current = pageInfo.current;
    pagination.value.pageSize = pageInfo.pageSize;
    fetchDocumentList();
};

// 上传文档 - 使用弹窗而不是路由导航
const showUploadDocument = () => {
    if (datasetId.value) {
        showUploadDialog.value = true; // 显示上传弹窗
    } else {
        MessagePlugin.error('知识库ID不能为空');
    }
};

// 返回列表
const backToList = () => {
    // 使用路由导航返回列表页
    router.push('/app/dataset');
};

// 初始化加载
onMounted(() => {
    if (datasetId.value) {
        fetchDocumentList();
    } else {
        console.error('初始化时知识库ID为空');
        MessagePlugin.error('知识库ID不能为空');
    }
});

// 组件卸载时清理
onUnmounted(() => {
    if (statusCheckInterval.value) {
        clearInterval(statusCheckInterval.value);
    }
});

// 处理上传完成后关闭弹窗并刷新列表
const handleUploadComplete = () => {
    showUploadDialog.value = false;
    // 刷新文档列表
    fetchDocumentList();
};

// 处理弹窗关闭事件
const handleDialogClose = () => {
    showUploadDialog.value = false;
};
</script>

<style lang="scss">
@import '/static/styles/variables.scss';

.dataset-detail-container {
    padding: $comp-paddingTB-l $comp-paddingLR-l;
    display: flex;
    flex-direction: column;
    height: 100%;
}

.breadcrumb {
    margin-bottom: $comp-margin-m;
}

.document-list-card {
    margin-bottom: $comp-margin-m;
}

.debug-info {
    margin-bottom: 10px;
    color: #999;
    font-size: 12px;
}

.status-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-width: 150px; // 确保有足够空间显示进度条

    .t-tag {
        flex-shrink: 0; // 防止标签被压缩
    }

    .status-progress {
        flex-grow: 1; // 让进度条填充剩余空间
    }
    
    .available-tag {
        background-color: #e1f7e1 !important;
        color: #006400 !important;
        border: 1px solid #52c41a !important;
        font-weight: bold;
    }
}

/* 上传弹窗样式 */
.upload-dialog {
    :deep(.t-dialog__body) {
        padding: 0;
    }

    :deep(.dataset-upload-container) {
        padding: 0;
    }

    :deep(.form-actions) {
        display: none;
        /* 隐藏弹窗中的底部返回按钮 */
    }

    :deep(.breadcrumb) {
        display: none;
        /* 隐藏弹窗中的面包屑导航 */
    }
}
</style>