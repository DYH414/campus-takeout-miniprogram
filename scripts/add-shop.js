// 添加新商家脚本
const cloud = require('wx-server-sdk')

// 初始化云环境
cloud.init({
    env: 'cloudbase-0gdnnqax782f54fa'
})

const db = cloud.database()

// 新商家数据
const newShop = {
    name: '百媚鸡猪肘饭',
    description: '文苑3楼',
    appId: 'wxe99bab2e84849fe1',
    category: '快餐',
    logoUrl: 'cloud://cloudbase-0gdnnqax782f54fa.636c-cloudbase-0gdnnqax782f54fa-1363163853/static/images/shop-logos/baimei.jpg',
    deliveryStart: 15, // 起送价格，单位元
    rating: 4.8,      // 评分，满分5分
    monthlySales: 320 // 月销量
}

// 添加商家
async function addShop() {
    try {
        const result = await db.collection('shops').add({
            data: {
                ...newShop,
                createTime: db.serverDate(),
                updateTime: db.serverDate()
            }
        })
        console.log('添加成功，商家ID:', result._id)
        return result
    } catch (err) {
        console.error('添加失败:', err)
        throw err
    }
}

// 执行添加操作
addShop() 