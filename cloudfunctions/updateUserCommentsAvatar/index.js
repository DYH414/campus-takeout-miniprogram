// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

// 云函数入口函数
exports.main = async (event, context) => {
    const wxContext = cloud.getWXContext()
    const db = cloud.database()
    const _ = db.command
    const $ = db.command.aggregate

    const { avatarUrl } = event
    const openid = wxContext.OPENID

    console.log('更新评论头像，参数：', { avatarUrl, openid })

    if (!avatarUrl) {
        console.error('缺少头像URL参数')
        return {
            success: false,
            message: '缺少头像URL参数'
        }
    }

    try {
        console.log('开始更新shop_comments集合中的头像')
        // 更新用户发表的所有评论中的头像
        const updateCommentResult = await db.collection('shop_comments')
            .where({
                _openid: openid
            })
            .update({
                data: {
                    'userInfo.avatarUrl': avatarUrl,
                    updateTime: db.serverDate()
                }
            })
        console.log('shop_comments更新结果：', updateCommentResult)

        console.log('开始更新hot_comments集合中的头像')
        // 更新热门评论中的头像
        const updateHotCommentResult = await db.collection('hot_comments')
            .where({
                _openid: openid
            })
            .update({
                data: {
                    'userInfo.avatarUrl': avatarUrl,
                    updateTime: db.serverDate()
                }
            })
        console.log('hot_comments更新结果：', updateHotCommentResult)

        // 检查是否有更新成功
        const totalUpdated =
            (updateCommentResult.stats ? updateCommentResult.stats.updated : 0) +
            (updateHotCommentResult.stats ? updateHotCommentResult.stats.updated : 0);

        if (totalUpdated === 0) {
            console.log('没有找到需要更新的评论')
        }

        return {
            success: true,
            message: '头像更新成功',
            updated: {
                comments: updateCommentResult.stats ? updateCommentResult.stats.updated : 0,
                hotComments: updateHotCommentResult.stats ? updateHotCommentResult.stats.updated : 0
            }
        }
    } catch (err) {
        console.error('更新评论头像失败', err)
        return {
            success: false,
            message: '更新评论头像失败',
            error: err.message || err.toString()
        }
    }
} 