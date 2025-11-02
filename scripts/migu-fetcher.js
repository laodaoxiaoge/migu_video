import axios from 'axios';
import fs from 'fs';
import path from 'path';

// 配置
const CONFIG = {
  outputDir: '../output',
  apiBase: 'https://program-sc.miguvideo.com/live/v2/tv-data',
  mainCategoryId: 'a5f78af9d160418eb679a6dd0429c920'
};

// 工具函数
class Logger {
  static info(msg) { console.log(`ℹ️ ${msg}`); }
  static success(msg) { console.log(`✅ ${msg}`); }
  static error(msg) { console.log(`❌ ${msg}`); }
  static warning(msg) { console.log(`⚠️ ${msg}`); }
}

// 确保目录存在
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// 获取分类列表
async function getCategories() {
  try {
    Logger.info('获取分类列表...');
    const response = await axios.get(`${CONFIG.apiBase}/${CONFIG.mainCategoryId}`);
    
    if (response.data?.body?.liveList) {
      const categories = response.data.body.liveList.filter(cat => cat.name !== '热门');
      
      // 央视置顶
      categories.sort((a, b) => {
        if (a.name === '央视') return -1;
        if (b.name === '央视') return 1;
        return 0;
      });
      
      Logger.success(`获取到 ${categories.length} 个分类`);
      return categories;
    }
    
    throw new Error('API返回数据格式不正确');
  } catch (error) {
    Logger.error(`获取分类失败: ${error.message}`);
    return [];
  }
}

// 获取分类下的频道
async function getCategoryChannels(category) {
  try {
    Logger.info(`获取分类"${category.name}"的频道...`);
    const response = await axios.get(`${CONFIG.apiBase}/${category.vomsID}`);
    
    if (response.data?.body?.dataList) {
      return response.data.body.dataList;
    }
    return [];
  } catch (error) {
    Logger.error(`获取分类${category.name}的频道失败: ${error.message}`);
    return [];
  }
}

// 获取频道播放地址
async function getChannelUrl(channelId) {
  try {
    const response = await axios.get(
      `https://webapi.miguvideo.com/gateway/playurl/v2/play/playurlh5?contId=${channelId}&rateType=999&clientId=-&startPlay=true&xh265=false&channelId=0131_200300220100002`
    );
    
    return response.data?.body?.urlInfo?.url || '';
  } catch (error) {
    Logger.error(`获取频道${channelId}的播放地址失败`);
    return '';
  }
}

// 生成M3U文件
function generateM3UContent(channels) {
  let content = '#EXTM3U x-tvg-url="https://raw.githubusercontent.com/develop202/migu_video/main/output/playback.xml"\n\n';
  
  channels.forEach(channel => {
    if (channel.url) {
      content += `#EXTINF:-1 tvg-id="${channel.id}" tvg-name="${channel.name}" tvg-logo="${channel.logo}" group-title="${channel.category}",${channel.name}\n`;
      content += `${channel.url}\n\n`;
    }
  });
  
  return content;
}

// 生成XMLTV文件
function generateXMLTVContent(channels) {
  let content = `<?xml version="1.0" encoding="UTF-8"?>
<tv generator-info-name="MiguFetcher" generator-info-url="https://github.com/your-repo">
`;

  channels.forEach(channel => {
    content += `  <channel id="${channel.id}">
    <display-name>${channel.name}</display-name>
    <icon src="${channel.logo}" />
  </channel>
`;
  });

  content += '</tv>';
  return content;
}

// 主函数
async function main() {
  try {
    Logger.info('开始抓取咪咕视频频道数据...');
    
    // 确保输出目录存在
    ensureDir(CONFIG.outputDir);
    
    // 获取分类
    const categories = await getCategories();
    if (categories.length === 0) {
      Logger.error('未获取到任何分类，任务终止');
      return;
    }
    
    // 获取所有频道
    const allChannels = [];
    
    for (const category of categories) {
      const channels = await getCategoryChannels(category);
      
      for (const channel of channels) {
        Logger.info(`处理频道: ${channel.name}`);
        const url = await getChannelUrl(channel.pID);
        
        if (url) {
          allChannels.push({
            id: channel.pID,
            name: channel.name,
            logo: channel.pics?.highResolutionH || '',
            category: category.name,
            url: url
          });
          Logger.success(`✓ ${channel.name}`);
        } else {
          Logger.warning(`✗ ${channel.name} (无播放地址)`);
        }
        
        // 短暂延迟避免请求过快
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    Logger.success(`成功获取 ${allChannels.length} 个有效频道`);
    
    if (allChannels.length > 0) {
      // 生成M3U文件
      const m3uContent = generateM3UContent(allChannels);
      fs.writeFileSync(path.join(CONFIG.outputDir, 'channels.m3u'), m3uContent);
      
      // 生成XMLTV文件
      const xmlContent = generateXMLTVContent(allChannels);
      fs.writeFileSync(path.join(CONFIG.outputDir, 'playback.xml'), xmlContent);
      
      Logger.success('频道列表生成完成！');
      Logger.info(`M3U文件: output/channels.m3u (${allChannels.length}个频道)`);
      Logger.info(`XML文件: output/playback.xml`);
    } else {
      Logger.error('未生成任何有效频道数据');
    }
    
  } catch (error) {
    Logger.error(`脚本执行失败: ${error.message}`);
    process.exit(1);
  }
}

// 执行主函数
main();