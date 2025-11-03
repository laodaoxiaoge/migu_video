const axios = require('axios');
const fs = require('fs');
const https = require('https');

// 创建不验证SSL的axios实例（避免证书问题）
const axiosInstance = axios.create({
    httpsAgent: new https.Agent({  
        rejectUnauthorized: false
    }),
    timeout: 15000
});

async function getRealPlayUrl(channelId) {
    try {
        console.log(`🔗 获取频道 ${channelId} 的播放地址...`);
        
        // 咪咕视频播放地址API
        const playApiUrl = `https://webapi.miguvideo.com/gateway/playurl/v2/play/playurlh5?contId=${channelId}&rateType=3`;
        
        const response = await axiosInstance.get(playApiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.miguvideo.com/',
                'Origin': 'https://www.miguvideo.com'
            }
        });
        
        // 解析播放地址
        if (response.data?.body?.urlInfo?.url) {
            return response.data.body.urlInfo.url;
        }
        
        return null;
    } catch (error) {
        console.log(`❌ 获取播放地址失败: ${error.message}`);
        return null;
    }
}

async function fetchRealChannels() {
    try {
        console.log('🚀 开始获取真实可播放的频道列表...');
        
        // 1. 获取频道数据
        const apiUrl = 'https://program-sc.miguvideo.com/live/v2/tv-data/a5f78af9d160418eb679a6dd0429c920';
        const response = await axiosInstance.get(apiUrl);
        
        if (!response.data.body?.dataList) {
            throw new Error('API返回数据格式错误');
        }
        
        const channels = response.data.body.dataList;
        console.log(`📺 获取到 ${channels.length} 个频道`);
        
        // 2. 生成M3U文件头
        let m3uContent = `#EXTM3U
# Generated: ${new Date().toISOString()}
# Total Channels: ${channels.length}\n\n`;
        
        let successCount = 0;
        
        // 3. 为每个频道获取真实播放地址（限制数量避免超时）
        for (let i = 0; i < Math.min(channels.length, 20); i++) {
            const channel = channels[i];
            console.log(`🔄 处理频道 ${i+1}/${Math.min(channels.length, 20)}: ${channel.name}`);
            
            const playUrl = await getRealPlayUrl(channel.pID);
            
            if (playUrl && playUrl.includes('.m3u8')) {
                const logo = channel.pics?.highResolutionH || '';
                const category = '直播频道';
                
                m3uContent += `#EXTINF:-1 tvg-id="${channel.pID}" tvg-name="${channel.name}" tvg-logo="${logo}" group-title="${category}",${channel.name}\n`;
                m3uContent += `${playUrl}\n\n`;
                
                successCount++;
                console.log(`✅ 成功获取: ${channel.name}`);
            } else {
                console.log(`❌ 跳过: ${channel.name} (无有效播放地址)`);
            }
            
            // 避免请求过快
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // 4. 保存文件
        if (!fs.existsSync('output')) {
            fs.mkdirSync('output');
        }
        
        fs.writeFileSync('output/channels.m3u', m3uContent);
        
        // 5. 生成统计信息
        const stats = {
            timestamp: new Date().toISOString(),
            total_channels: channels.length,
            success_channels: successCount,
            file: 'channels.m3u'
        };
        
        fs.writeFileSync('output/meta.json', JSON.stringify(stats, null, 2));
        
        console.log(`🎉 完成! 生成 ${successCount} 个可播放频道`);
        console.log('📁 文件: output/channels.m3u');
        
    } catch (error) {
        console.error('❌ 脚本执行失败:', error.message);
        process.exit(1);
    }
}

// 执行
fetchRealChannels();
