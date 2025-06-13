// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID

    // 获取参数
    const { shopId, rating, ratingId, oldRating } = event

    if (!shopId || !rating) {
        return {
            success: false,
            message: '参数不完整'
        }
    }

    try {
        // 开始数据库事务
        const transaction = await db.startTransaction()

        // 1. 更新或创建评分记录
        if (ratingId) {
            // 更新已有评分
            await transaction.collection('shop_ratings').doc(ratingId).update({
                data: {
                    rating: rating,
                    updateTime: db.serverDate()
                }
            })
        } else {
            // 创建新评分
            await transaction.collection('shop_ratings').add({
                data: {
                    shopId: shopId,
                    rating: rating,
                    _openid: openid,
                    createTime: db.serverDate(),
                    updateTime: db.serverDate()
                }
            })
        }

        // 2. 获取商家当前评分数据
        const shopRes = await transaction.collection('shops').doc(shopId).get()
        const shop = shopRes.data

        // 3. 计算新的平均评分
        let avgRating = shop.avgRating || 0
        let ratingCount = shop.ratingCount || 0

        if (ratingId) {
            // 更新评分：从总分中减去旧评分，加上新评分
            const totalRating = avgRating * ratingCount - oldRating + rating
            avgRating = totalRating / ratingCount
        } else {
            // 新增评分：计算新的平均分
            ratingCount += 1
            avgRating = ((avgRating * (ratingCount - 1)) + rating) / ratingCount
        }

        // 4. 更新商家评分数据
        await transaction.collection('shops').doc(shopId).update({
            data: {
                avgRating: avgRating,
                ratingCount: ratingCount,
                updateTime: db.serverDate()
            }
        })

        // 提交事务
        await transaction.commit()

        return {
            success: true,
            message: '评分成功',
            data: {
                avgRating,
                ratingCount
            }
        }

    } catch (err) {
        console.error('评分失败:', err)
        return {
            success: false,
            message: '评分失败',
            error: err
        }
    }
} 