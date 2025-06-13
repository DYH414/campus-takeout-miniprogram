Page({
    data: {
        shopInfo: null,
        isLiked: false,  // 添加点赞状态变量
        comments: [],
        currentPage: 1,
        pageSize: 10,
        hasMore: true
    },

    onLoad(options) {
        if (options.id) {
            this.loadShopInfo(options.id)
            this.loadComments(options.id)
        }
    },

    // 切换点赞状态
    async toggleLike() {
        // 检查用户是否登录
        const app = getApp()
        if (!app.globalData.isLogin) {
            wx.showToast({
                title: '请先登录',
                icon: 'none'
            })
            setTimeout(() => {
                wx.navigateTo({
                    url: '/pages/login/login'
                })
            }, 1000)
            return
        }

        try {
            const db = wx.cloud.database()
            const _ = db.command
            const openid = app.globalData.openid
            const shopId = this.data.shopInfo._id

            // 更新本地状态
            this.setData({
                isLiked: !this.data.isLiked
            })

            // 更新数据库
            if (this.data.isLiked) {
                // 添加点赞
                await db.collection('shops').doc(shopId).update({
                    data: {
                        likeCount: _.inc(1),
                        likeUsers: _.addToSet(openid)
                    }
                })
                wx.showToast({
                    title: '点赞成功',
                    icon: 'success'
                })
            } else {
                // 取消点赞
                await db.collection('shops').doc(shopId).update({
                    data: {
                        likeCount: _.inc(-1),
                        likeUsers: _.pull(openid)
                    }
                })
                wx.showToast({
                    title: '已取消点赞',
                    icon: 'success'
                })
            }
        } catch (err) {
            console.error('点赞操作失败：', err)
            // 恢复原状态
            this.setData({
                isLiked: !this.data.isLiked
            })
            wx.showToast({
                title: '操作失败，请重试',
                icon: 'none'
            })
        }
    },

    // 加载商家信息
    async loadShopInfo(shopId) {
        try {
            const db = wx.cloud.database()
            const app = getApp()
            const openid = app.globalData.openid

            const shopRes = await db.collection('shops').doc(shopId).get()
            const shopInfo = shopRes.data

            // 检查当前用户是否已点赞
            const isLiked = shopInfo.likeUsers && shopInfo.likeUsers.includes(openid)

            this.setData({
                shopInfo,
                isLiked
            })
        } catch (err) {
            console.error('加载商家信息失败：', err)
            wx.showToast({
                title: '加载失败，请重试',
                icon: 'none'
            })
        }
    },

    // 加载评论
    async loadComments(shopId) {
        if (!this.data.hasMore) return

        try {
            const db = wx.cloud.database()
            const _ = db.command
            const skip = (this.data.currentPage - 1) * this.data.pageSize

            const commentsRes = await db.collection('shop_comments')
                .where({
                    shopId: shopId
                })
                .orderBy('createTime', 'desc')
                .skip(skip)
                .limit(this.data.pageSize)
                .get()

            const comments = commentsRes.data.map(comment => ({
                ...comment,
                formattedTime: this.formatTime(comment.createTime)
            }))

            this.setData({
                comments: [...this.data.comments, ...comments],
                currentPage: this.data.currentPage + 1,
                hasMore: comments.length === this.data.pageSize
            })
        } catch (err) {
            console.error('加载评论失败：', err)
            wx.showToast({
                title: '加载失败，请重试',
                icon: 'none'
            })
        }
    },

    // 格式化时间
    formatTime(timestamp) {
        const date = new Date(timestamp)
        const now = new Date()
        const diff = now - date

        // 小于1分钟
        if (diff < 60000) {
            return '刚刚'
        }
        // 小于1小时
        if (diff < 3600000) {
            return Math.floor(diff / 60000) + '分钟前'
        }
        // 小于24小时
        if (diff < 86400000) {
            return Math.floor(diff / 3600000) + '小时前'
        }
        // 小于30天
        if (diff < 2592000000) {
            return Math.floor(diff / 86400000) + '天前'
        }

        // 超过30天显示具体日期
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    },

    // 下拉刷新
    async onPullDownRefresh() {
        this.setData({
            comments: [],
            currentPage: 1,
            hasMore: true
        })
        await this.loadComments(this.data.shopInfo._id)
        wx.stopPullDownRefresh()
    },

    // 上拉加载更多
    onReachBottom() {
        this.loadComments(this.data.shopInfo._id)
    }
}) 