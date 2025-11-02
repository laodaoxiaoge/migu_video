import { dataList } from "./utils/fetchList.js";
import { getAndroidURL720p } from "./utils/androidURL.js";
import { appendFile, writeFile } from "./utils/fileUtil.js";
import { printBlue, printGreen, printRed, printYellow } from "./utils/colorOut.js";

async function fetchURLByAndroid720p() {
  const start = Date.now();
  
  try {
    console.log("🚀 开始获取咪咕视频数据...");
    
    // 获取API数据
    const response = await dataList();
    
    if (!response.body || !response.body.dataList) {
      throw new Error("API返回数据格式异常，缺少dataList");
    }
    
    const categories = response.body.liveList || [];
    const channels = response.body.dataList || [];
    
    console.log(`📊 获取到 ${categories.length} 个分类`);
    console.log(`📺 获取到 ${channels.length} 个频道`);
    
    // 创建M3U文件
    const m3uPath = process.cwd() + '/output/channels.m3u';
    writeFile(m3uPath, '#EXTM3U\n');
    
    // 创建回放文件
    const playbackPath = process.cwd() + '/output/playback.xml';
    writeFile(playbackPath, '<?xml version="1.0" encoding="UTF-8"?>\n<tv>\n');
    
    let successCount = 0;
    let failCount = 0;
    
    // 处理每个频道
    for (let i = 0; i < channels.length; i++) {
      const channel = channels[i];
      
      try {
        printBlue(`处理频道 ${i + 1}/${channels.length}: ${channel.name}`);
        
        // 获取播放地址
        const videoUrl = await getAndroidURL720p(channel.pID);
        
        if (!videoUrl) {
          printRed(`❌ 无法获取播放地址: ${channel.name}`);
          failCount++;
          continue;
        }
        
        // 查找频道所属分类
        const category = categories.find(cat => 
          cat.vomsID === channel.categoryID || cat.name === "央视"
        ) || { name: "其他" };
        
        // 获取频道logo
        const logo = channel.pics?.highResolutionH || 
                    channel.h5pics?.highResolutionH || 
                    channel.pics?.lowResolutionH || '';
        
        // 生成M3U条目
        const m3uEntry = `#EXTINF:-1 tvg-id="${channel.pID}" tvg-name="${channel.name}" tvg-logo="${logo}" group-title="${category.name}",${channel.name}\n${videoUrl}\n`;
        
        // 写入文件
        appendFile(m3uPath, m3uEntry);
        
        // 生成XMLTV条目（简化的回放数据）
        const xmlEntry = `  <channel id="${channel.pID}">\n    <display-name>${channel.name}</display-name>\n    <icon src="${logo}"/>\n  </channel>\n`;
        appendFile(playbackPath, xmlEntry);
        
        successCount++;
        printGreen(`✅ 成功添加: ${channel.name}`);
        
      } catch (error) {
        printRed(`❌ 处理频道失败: ${channel.name} - ${error.message}`);
        failCount++;
      }
      
      // 添加延迟避免请求过快
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // 完成XML文件
    appendFile(playbackPath, '</tv>');
    
    const end = Date.now();
    const duration = (end - start) / 1000;
    
    // 生成meta信息
    const meta = {
      timestamp: new Date().toISOString(),
      workflow: process.env.GITHUB_RUN_ID || 'manual',
      status: 'success',
      statistics: {
        total_channels: channels.length,
        success_count: successCount,
        fail_count: failCount,
        duration_seconds: duration
      },
      files_generated: [
        'channels.m3u',
        'playback.xml',
        'meta.json'
      ]
    };
    
    writeFile(process.cwd() + '/output/meta.json', JSON.stringify(meta, null, 2));
    
    printYellow(`🎉 任务完成! 耗时: ${duration}秒`);
    printYellow(`📊 统计: 成功 ${successCount}/${channels.length}, 失败 ${failCount}`);
    printYellow(`📁 文件: channels.m3u (${successCount}个频道)`);
    
  } catch (error) {
    printRed(`❌ 脚本执行失败: ${error.message}`);
    
    // 生成错误meta
    const errorMeta = {
      timestamp: new Date().toISOString(),
      workflow: process.env.GITHUB_RUN_ID || 'manual',
      status: 'error',
      error: error.message,
      files_generated: ['meta.json']
    };
    
    writeFile(process.cwd() + '/output/meta.json', JSON.stringify(errorMeta, null, 2));
    process.exit(1);
  }
}

// 执行
fetchURLByAndroid720p();
