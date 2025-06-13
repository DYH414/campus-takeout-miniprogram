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
        const { shopIds } = event

        if (!shopIds || !Array.isArray(shopIds) || shopIds.length === 0) {
            return {
                success: false,
                message: '缺少商家ID参数'
            }
        }

        // 获取每个商家点赞数最高的评论
        const tasks = shopIds.map(async shopId => {
            // 使用聚合操作查找点赞数最高的评论
            const result = await db.collection('comments')
                .aggregate()
                .match({
                    shopId: shopId,
                    status: 'approved' // 只获取已审核通过的评论
                })
                .sort({
                    likeCount: -1,
                    createTime: -1
                })
                .limit(1)
                .lookup({
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'userInfo'
                })
                .end()

            if (result.list && result.list.length > 0) {
                const comment = result.list[0]
                // 处理用户信息
                if (comment.userInfo && comment.userInfo.length > 0) {
                    comment.userInfo = {
                        nickName: comment.userInfo[0].nickName,
                        avatarUrl: comment.userInfo[0].avatarUrl
                    }
                } else {
                    comment.userInfo = {
                        nickName: '匿名用户',
                        avatarUrl: '/static/images/default-avatar.png'
                    }
                }
                return comment
            }
            return null
        })

        // 等待所有查询完成
        const results = await Promise.all(tasks)

        // 过滤掉没有热门评论的商家
        const hotComments = results.filter(comment => comment !== null)

        return {
            success: true,
            data: hotComments
        }
    } catch (err) {
        console.error('获取热门评论失败', err)
        return {
            success: false,
            message: '获取热门评论失败',
            error: err
        }
    }
} 