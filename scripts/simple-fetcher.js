const https = require('https');
const fs = require('fs');
const path = require('path');

// 确保输出目录存在
const outputDir = path.join(__dirname, '../output');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// 简单的HTTP请求函数
function httpGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { 
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(data);
                }
            });
        }).on('error', reject).on('timeout', () => reject(new Error('Timeout')));
    });
}

async function main() {
    try {
        console.log('🚀 开始获取咪咕视频数据...');
        
        // 1. 测试基本API连通性
        const testUrl = 'https://program-sc.miguvideo.com/live/v2/tv-data/a5f78af9d160418eb679a6dd0429c920';
        console.log('📡 测试API:', testUrl);
        
        const response = await httpGet(testUrl);
        console.log('✅ API响应状态: 成功');
        
        // 2. 检查数据结构
        if (!response.body || !response.body.dataList) {
            throw new Error('API返回数据格式异常');
        }
        
        const channels = response.body.dataList || [];
        console.log(`📺 获取到 ${channels.length} 个频道`);
        
        // 3. 生成M3U文件
        let m3uContent = '#EXTM3U\n';
        let validCount = 0;
        
        for (const channel of channels.slice(0, 50)) { // 限制前50个避免超时
            try {
                const logo = channel.pics?.highResolutionH || '';
                const group = '央视'; // 简化分组
                
                // 生成测试URL（实际使用时需要获取真实播放地址）
                const testUrl = `https://example.com/stream/${channel.pID}.m3u8`;
                
                m3uContent += `#EXTINF:-1 tvg-id="${channel.pID}" tvg-name="${channel.name}" tvg-logo="${logo}" group-title="${group}",${channel.name}\n`;
                m3uContent += `${testUrl}\n`;
                
                validCount++;
                console.log(`✅ 添加频道: ${channel.name}`);
                
            } catch (error) {
                console.log(`⚠️ 跳过频道 ${channel.name}: ${error.message}`);
            }
        }
        
        // 4. 保存文件
        const m3uPath = path.join(outputDir, 'channels.m3u');
        fs.writeFileSync(m3uPath, m3uContent);
        
        // 5. 生成meta信息
        const meta = {
            timestamp: new Date().toISOString(),
            status: 'success',
            channels: {
                total: channels.length,
                generated: validCount
            },
            note: '这是测试版本，播放地址需要进一步获取'
        };
        
        fs.writeFileSync(path.join(outputDir, 'meta.json'), JSON.stringify(meta, null, 2));
        
        console.log(`🎉 任务完成! 生成 ${validCount} 个频道`);
        console.log(`📁 文件位置: ${m3uPath}`);
        
    } catch (error) {
        console.error('❌ 脚本执行失败:', error.message);
        
        // 生成错误报告
        const errorMeta = {
            timestamp: new Date().toISOString(),
            status: 'error',
            error: error.message,
            stack: error.stack
        };
        
        fs.writeFileSync(path.join(outputDir, 'error.json'), JSON.stringify(errorMeta, null, 2));
        process.exit(1);
    }
}

// 执行并处理未捕获异常
process.on('unhandledRejection', (error) => {
    console.error('未处理的Promise拒绝:', error);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error('未捕获的异常:', error);
    process.exit(1);
});

main();
