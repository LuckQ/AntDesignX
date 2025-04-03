/**
 * Excel处理Web Worker
 * 用于在后台线程解析和处理大型Excel文件
 */

// 导入ExcelJS库
import * as ExcelJS from 'exceljs';

// 缓存文件分片大小（2MB）
const CHUNK_SIZE = 2 * 1024 * 1024;

/**
 * 分块读取并解析Excel文件
 */
async function parseExcelInChunks(file, options) {
  try {
    const { maxBlocks = 100, minBlockSize = 1000, overlapRows = 10 } = options || {};
    
    // 发送开始消息
    self.postMessage({ type: 'start', fileName: file.name });
    
    // 创建工作簿
    const workbook = new ExcelJS.Workbook();
    
    // 读取文件
    const buffer = await file.arrayBuffer();
    
    // 发送进度更新
    self.postMessage({ type: 'progress', phase: 'loading', progress: 30 });
    
    // 加载工作簿
    await workbook.xlsx.load(buffer);
    
    // 发送进度更新
    self.postMessage({ type: 'progress', phase: 'parsing', progress: 60 });
    
    // 获取所有工作表名称
    const sheetNames = workbook.worksheets.map(sheet => sheet.name);
    
    // 发送工作表信息
    self.postMessage({ 
      type: 'sheetInfo', 
      sheetNames: sheetNames,
      totalSheets: sheetNames.length
    });
    
    // 处理结果
    const result = {
      fileName: file.name,
      totalSheets: sheetNames.length,
      sheetNames: sheetNames,
      sheets: {},
      totalRows: 0
    };
    
    // 处理每个工作表
    for (let i = 0; i < sheetNames.length; i++) {
      const sheetName = sheetNames[i];
      const worksheet = workbook.getWorksheet(sheetName);
      
      // 将工作表转换为JSON
      const jsonData = worksheetToJson(worksheet);
      
      // 分块处理数据
      const blocks = splitDataIntoBlocks(jsonData, { maxBlocks, minBlockSize, overlapRows });
      
      // 存储工作表数据
      result.sheets[sheetName] = {
        data: jsonData,
        totalRows: jsonData.length,
        blocks: blocks.map(block => ({
          blockId: block.blockId,
          originalStartIndex: block.originalStartIndex,
          originalEndIndex: block.originalEndIndex,
          startIndex: block.startIndex,
          endIndex: block.endIndex,
          size: block.size,
          originalSize: block.originalSize,
          hasOverlapTop: block.hasOverlapTop,
          hasOverlapBottom: block.hasOverlapBottom,
          // 只保留分块统计信息，不包含实际数据
          sampleData: block.data.slice(0, 5)
        }))
      };
      
      // 如果是第一个工作表，添加为默认数据
      if (i === 0) {
        result.data = jsonData;
        result.totalRows = jsonData.length;
        result.columns = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];
        result.blocks = result.sheets[sheetName].blocks;
      }
      
      // 发送单个工作表处理完成通知
      self.postMessage({ 
        type: 'sheetProcessed', 
        sheetName,
        progress: Math.round(70 + (i / sheetNames.length) * 25),
        totalRows: jsonData.length,
        blockCount: blocks.length
      });
    }
    
    // 发送处理完成消息
    self.postMessage({ type: 'complete', result });
    
  } catch (error) {
    // 发送错误消息
    self.postMessage({ 
      type: 'error', 
      message: error.message || '解析Excel文件失败',
      stack: error.stack
    });
  }
}

/**
 * 将ExcelJS工作表转换为JSON对象数组
 * @param {Worksheet} worksheet - ExcelJS工作表
 * @returns {Array} JSON对象数组
 */
function worksheetToJson(worksheet) {
  // 获取表头（第一行）
  const headerRow = worksheet.getRow(1);
  const headers = [];
  
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber - 1] = cell.value?.toString() || `Column${colNumber}`;
  });
  
  // 初始化结果数组
  const jsonData = [];
  
  // 从第二行开始遍历数据行
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    // 跳过表头
    if (rowNumber === 1) return;
    
    const rowData = {};
    
    // 处理每个单元格
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber - 1] || `Column${colNumber}`;
      
      // 根据单元格类型处理值
      let value = null;
      
      if (cell.value !== null && cell.value !== undefined) {
        if (cell.value.text) { // 富文本
          value = cell.value.text;
        } else if (cell.value.formula) { // 公式
          value = cell.value.result;
        } else if (cell.type === ExcelJS.ValueType.Date) { // 日期
          value = cell.value.toISOString();
        } else {
          value = cell.value;
        }
      }
      
      rowData[header] = value;
    });
    
    // 添加到结果数组
    jsonData.push(rowData);
  });
  
  return jsonData;
}

/**
 * 获取特定工作表和数据块的内容
 */
function getSheetBlockData(result, sheetName, blockId) {
  if (!result || !result.sheets || !result.sheets[sheetName]) {
    throw new Error(`工作表 "${sheetName}" 不存在`);
  }
  
  const sheet = result.sheets[sheetName];
  const blocks = splitDataIntoBlocks(sheet.data, {
    maxBlocks: 100,
    minBlockSize: 500,
    overlapRows: 10
  });
  
  if (blockId < 0 || blockId >= blocks.length) {
    throw new Error(`数据块 #${blockId} 不存在`);
  }
  
  return blocks[blockId];
}

/**
 * 将数据分块处理
 */
function splitDataIntoBlocks(data, options = {}) {
  if (!data || !Array.isArray(data)) {
    return [];
  }
  
  const totalRows = data.length;
  const maxBlocks = options.maxBlocks || 100;
  const minBlockSize = options.minBlockSize || 500;
  const overlapRows = options.overlapRows || 10;
  
  // 计算理想块大小
  const idealBlockSize = Math.max(minBlockSize, Math.ceil(totalRows / maxBlocks));
  
  // 计算实际块数
  const actualBlockCount = Math.min(maxBlocks, Math.ceil(totalRows / idealBlockSize));
  
  // 计算每块实际大小（不含重叠部分）
  const actualBlockSize = Math.ceil(totalRows / actualBlockCount);
  
  const blocks = [];
  
  // 生成数据块
  for (let i = 0; i < actualBlockCount; i++) {
    // 计算块的原始起止索引（不含重叠区域）
    const originalStartIndex = i * actualBlockSize;
    const originalEndIndex = Math.min(totalRows - 1, (i + 1) * actualBlockSize - 1);
    
    // 计算块的实际起止索引（含重叠区域）
    const startIndex = Math.max(0, originalStartIndex - (i > 0 ? overlapRows : 0));
    const endIndex = Math.min(totalRows - 1, originalEndIndex + (i < actualBlockCount - 1 ? overlapRows : 0));
    
    // 提取数据块
    const blockData = data.slice(startIndex, endIndex + 1);
    
    // 创建块信息
    blocks.push({
      blockId: i,
      originalStartIndex,
      originalEndIndex,
      startIndex,
      endIndex,
      size: blockData.length,
      originalSize: originalEndIndex - originalStartIndex + 1,
      hasOverlapTop: i > 0,
      hasOverlapBottom: i < actualBlockCount - 1,
      data: blockData
    });
  }
  
  return blocks;
}

// 监听主线程消息
self.addEventListener('message', function(e) {
  const { action, file, options, sheetName, blockId, result } = e.data;
  
  switch (action) {
    case 'parse':
      parseExcelInChunks(file, options);
      break;
    case 'getBlockData':
      try {
        const blockData = getSheetBlockData(result, sheetName, blockId);
        self.postMessage({ 
          type: 'blockData', 
          blockId,
          sheetName,
          data: blockData
        });
      } catch (error) {
        self.postMessage({ 
          type: 'error', 
          message: error.message,
          blockId,
          sheetName
        });
      }
      break;
    default:
      self.postMessage({ 
        type: 'error', 
        message: `未知操作: ${action}`
      });
  }
}); 