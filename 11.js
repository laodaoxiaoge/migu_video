import { dataList } from "./utils/fetchList.js"
import { getAndroidURL720p } from "./utils/androidURL.js"
import { appendFile, appendFileSync, renameFileSync, writeFile } from "./utils/fileUtil.js"
import { updatePlaybackData } from "./utils/playback.js"
import { printBlue, printGreen, printMagenta, printRed, printYellow } from "./utils/colorOut.js"

// 添加路径处理
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function fetchURLByAndroid720p() {
  try {
    const start = Date.now()

    // 使用绝对路径
    const interfacePath = join(__dirname, 'interface.txt.bak')
    const playbackPath = join(__dirname, 'playback.xml.bak')

    console.log('📁 工作目录:', __dirname)
    console.log('📄 输出文件:', interfacePath)

    // 创建空文件（添加错误处理）
    try {
      writeFile(interfacePath, "")
      writeFile(playbackPath, 
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<tv generator-info-name="Tak" generator-info-url="https://github.com/develop202/migu_video/">\n`)
    } catch (fileError) {
      console.error('❌ 文件创建失败:', fileError)
      throw fileError
    }

    // 写入M3U头
    appendFile(interfacePath, `#EXTM3U x-tvg-url="https://develop202.github.io/migu_video/playback.xml,https://raw.githubusercontent.com/develop202/migu_video/refs/heads/main/playback.xml,https://gh-proxy.com/https://raw.githubusercontent.com/develop202/migu_video/refs/heads/main/playback.xml" catchup="append" catchup-source="&playbackbegin=\${(b)yyyyMMddHHmmss}&playbackend=\${(e)yyyyMMddHHmmss}"\n`)

    // 获取数据（添加错误处理）
    let datas
    try {
      datas = await dataList()
      console.log(`✅ 获取到 ${datas.length} 个分类`)
    } catch (dataError) {
      console.error('❌ 获取数据失败:', dataError)
      throw dataError
    }

    // 处理每个分类
    for (let i = 0; i < datas.length; i++) {
      printBlue(`分类 ${i+1}/${datas.length}: ${datas[i].name}`)

      const data = datas[i].dataList
      
      // 处理每个节目
      for (let j = 0; j < data.length; j++) {
        printMagenta(`节目 ${j+1}/${data.length}: ${data[j].name}`)
        
        try {
          // 更新回放数据
          const playbackSuccess = await updatePlaybackData(data[j], playbackPath)
          if (playbackSuccess) {
            printGreen('    节目单更新成功')
          } else {
            printRed('    节目单更新失败')
            continue // 跳过这个节目
          }

          // 获取视频链接（添加超时处理）
          const resObj = await Promise.race([
            getAndroidURL720p(data[j].pID),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('获取链接超时')), 30000)
            )
          ])
          
          if (!resObj.url) {
            printRed('    节目调整，暂不提供服务')
            continue
          }

          // 写入节目信息
          appendFile(interfacePath, 
            `#EXTINF:-1 svg-id="${data[j].name}" svg-name="${data[j].name}" tvg-logo="${data[j].pics.highResolutionH}" group-title="${datas[i].name}",${data[j].name}\n${resObj.url}\n`)
          printGreen('    节目链接更新成功')
          
        } catch (programError) {
          console.error(`❌ 处理节目失败 [${data[j].name}]:`, programError)
          // 继续处理下一个节目，不中断整个流程
          continue
        }
      }
    }

    // 完成回放文件
    appendFileSync(playbackPath, `</tv>\n`)

    // 重命名文件（最终输出）
    renameFileSync(playbackPath, playbackPath.replace(".bak", ""))
    renameFileSync(interfacePath, interfacePath.replace(".bak", ""))
    
    const end = Date.now()
    printYellow(`✅ 任务完成! 耗时: ${(end - start) / 1000} 秒`)
    
  } catch (error) {
    console.error('❌ 脚本执行失败:', error)
    process.exit(1) // 非零退出码表示失败
  }
}

// 添加未处理的Promise拒绝处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未处理的Promise拒绝:', reason)
  process.exit(1)
})

process.on('uncaughtException', (error) => {
  console.error('❌ 未捕获的异常:', error)
  process.exit(1)
})

fetchURLByAndroid720p()
