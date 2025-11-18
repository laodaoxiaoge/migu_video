import axios from "axios"

// 睡眠
function delay(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

// 获取分类集合
async function cateList() {
  try {
    const resp = await axios.get("https://program-sc.miguvideo.com/live/v2/tv-data/1ff892f2b5ab4a79be6e25b69d2f5d05")
    let liveList = resp.data.body.liveList
    // 热门内容重复
    liveList = liveList.filter((item) => {
      return item.name != "热门"
    })

    // 央视作为首个分类
    liveList.sort((a, b) => {
      if (a.name === "央视") return -1;
      if (b.name === "央视") return 1
      return 0
    })

    return liveList
  } catch (error) {
    throw error
  }
}

// 所有数据
async function dataList() {
  try {
    let cates = await cateList()

    for (let cate in cates) {
      try {
        const resp = await axios.get("https://program-sc.miguvideo.com/live/v2/tv-data/" + cates[cate].vomsID)
        cates[cate].dataList = resp.data.body.dataList
      } catch (error) {
        cates[cate].dataList = [];
      }
    }

    // 去除重复节目
    cates = uniqueData(cates)
    // console.dir(cates, { depth: null })
    // console.log(cates)
    return cates
  } catch (error) {
    throw error
  }
}

// 获取电视链接
async function getUrlInfo(contId) {
  try {
    const resp = await axios.get(`https://webapi.miguvideo.com/gateway/playurl/v2/play/playurlh5?contId=${contId}&rateType=999&clientId=-&startPlay=true&xh265=false&channelId=0131_200300220100002`)
    // console.log(resp.data.body.urlInfo.url)
    // console.log(resp.data)
    if (resp.data?.body?.urlInfo?.url) {
      return resp.data.body.urlInfo.url
    }
    return ""
  } catch (error) {
    throw error
  }
}

// 对data的dataList去重
function uniqueData(liveList) {

  const allItems = []
  // 提取全部dataList
  liveList.forEach(category => {
    category.dataList.forEach(program => {

      allItems.push({
        ...program,
        categoryName: category.name
      })
    })

  })

  // 使用set确保唯一
  const set = new Set()
  // 保存唯一的数据
  const uniqueItem = []

  allItems.forEach(item => {
    // set用来确定已经出现过
    if (!set.has(item.name)) {
      set.add(item.name)
      uniqueItem.push(item)
    }
  })

  const categoryMap = []

  // 清空原dataList内容
  liveList.forEach(live => {
    live.dataList = []
    categoryMap[live.name] = []
  })

  // 去除添加字段，根据分类填充内容
  uniqueItem.forEach(item => {
    const { categoryName, ...program } = item
    categoryMap[categoryName].push(program)
  })

  // liveList赋值
  liveList.forEach(live => {
    live.dataList = categoryMap[live.name]
  })

  return liveList
}

export { cateList, dataList, getUrlInfo, delay }
