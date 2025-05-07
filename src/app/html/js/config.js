/**
 * 配置文件 - 定义全局变量和常量
 */

// API基础URL
const API_BASE_URL = 'http://localhost:8000/base_agent';

// 全局变量
let currentSessionId = null;
let currentSessionFeatures = null; // 存储当前会话的功能设置
let currentUserId = null;
let currentPage = 1;
let sessionPage = 1;
let historyPage = 1;
let totalSessions = 0;
let totalMessages = 0;
let availableModels = []; // 存储可用模型列表
let defaultModelId = ""; // 默认模型ID
let currentTitle = "新对话"; // 添加会话标题变量

// 分页设置
const pageSize = 10;
const historyPageSize = 20;