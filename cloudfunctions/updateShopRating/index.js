// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

// 云函数入口函数
exports.main = async (event, context) => {
    const wxContext = cloud.getWXContext()
    const db = cloud.database()
    const _ = db.command
    const $ = db.command.aggregate

    try {
        const { shopId } = event

        if (!shopId) {
            return {
                success: false,
                message: '缺少商家ID参数'
            }
        }

        // 计算商家的平均评分
        const ratingResult = await db.collection('shop_ratings')
            .aggregate()
            .match({
                shopId: shopId
            })
            .group({
                _id: null,
                avgRating: $.avg('$rating'),
                ratingCount: $.sum(1)
            })
            .end()

        // 如果没有评分记录
        if (!ratingResult.list || ratingResult.list.length === 0) {
            return {
                success: false,
                message: '该商家暂无评分'
            }
        }

        const avgRating = parseFloat(ratingResult.list[0].avgRating.toFixed(1))
        const ratingCount = ratingResult.list[0].ratingCount

        // 更新商家的平均评分
        await db.collection('shops')
            .doc(shopId)
            .update({
                data: {
                    avgRating: avgRating,
                    ratingCount: ratingCount,
                    updateTime: db.serverDate()
                }
            })

        return {
            success: true,
            avgRating: avgRating,
            ratingCount: ratingCount
        }
    } catch (err) {
        console.error('更新商家评分失败', err)
        return {
            success: false,
            message: '更新商家评分失败',
            error: err
        }
    }
} 