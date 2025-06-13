const app = getApp()

Page({
    data: {
        shopId: '',
        shop: null,
        comments: [],
        newComment: '',
        isFavorite: false,
        isLoading: false,
        isLogin: false,
        userInfo: null,
        userMap: {} // 存储用户信息的映射
    },

    onLoad: function (options) {
        if (options.id) {
            this.setData({
                shopId: options.id,
                isLogin: app.globalData.isLogin,
                userInfo: app.globalData.userInfo
            })

            this.loadShopDetail()
            this.loadComments()
            this.checkFavoriteStatus()
        } else {
            wx.showToast({
                title: '参数错误',
                icon: 'none'
            })
            setTimeout(() => {
                wx.navigateBack()
            }, 1500)
        }
    },

    // 页面显示时重新加载数据
    onShow: function () {
        // 检查登录状态
        if (!app.globalData.userInfo) {
            wx.showLoading({
                title: '加载中...',
                mask: true
            })
            app.checkLoginStatus().then(() => {
                wx.hideLoading()
                // 登录成功后重新加载数据
                this.loadShopDetail()
                this.loadComments()
            }).catch(err => {
                wx.hideLoading()
                console.error('登录失败', err)
                wx.showToast({
                    title: '登录失败，请重试',
                    icon: 'none'
                })
            })
        } else {
            // 已登录，直接加载数据
            this.loadShopDetail()
            this.loadComments()
        }
    },

    // 加载商家详情
    loadShopDetail: function () {
        const db = wx.cloud.database()

        db.collection('shops')
            .doc(this.data.shopId)
            .get()
            .then(res => {
                this.setData({ shop: res.data })
            })
            .catch(err => {
                console.error('获取商家详情失败', err)
                wx.showToast({
                    title: '获取商家信息失败',
                    icon: 'none'
                })
            })
    },

    // 加载评论列表
    loadComments: function () {
        const db = wx.cloud.database()
        const _ = db.command

        db.collection('shop_comments')
            .where({
                shopId: this.data.shopId
            })
            .orderBy('createTime', 'desc')
            .get()
            .then(res => {
                if (res.data && res.data.length > 0) {
                    const comments = res.data
                    const openids = []

                    // 收集所有评论的用户openid
                    comments.forEach(comment => {
                        if (comment._openid) {
                            openids.push(comment._openid)
                        }
                    })

                    // 获取最新的用户信息
                    this.loadLatestUserInfo([...new Set(openids)], comments)
                } else {
                    this.setData({
                        comments: []
                    })
                }
            })
            .catch(err => {
                console.error('获取评论失败', err)
            })
    },

    // 格式化评论时间
    formatCommentTime: function (dateTime) {
        if (!dateTime) return '刚刚';

        const commentDate = new Date(dateTime);
        const now = new Date();

        // 计算时间差（毫秒）
        const timeDiff = now - commentDate;

        // 转换为秒
        const seconds = Math.floor(timeDiff / 1000);

        // 刚刚发布的评论
        if (seconds < 60) {
            return '刚刚';
        }

        // 分钟前
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) {
            return `${minutes}分钟前`;
        }

        // 小时前
        const hours = Math.floor(minutes / 60);
        if (hours < 24) {
            return `${hours}小时前`;
        }

        // 天前（7天内）
        const days = Math.floor(hours / 24);
        if (days < 7) {
            return `${days}天前`;
        }

        // 超过7天显示具体日期
        const year = commentDate.getFullYear();
        const month = commentDate.getMonth() + 1;
        const day = commentDate.getDate();

        // 如果是今年，只显示月-日
        if (year === now.getFullYear()) {
            return `${month}月${day}日`;
        }

        // 不是今年，显示年-月-日
        return `${year}年${month}月${day}日`;
    },

    // 加载最新的用户信息
    loadLatestUserInfo: function (openids, comments) {
        const db = wx.cloud.database()
        const _ = db.command

        // 查询用户信息
        db.collection('users')
            .where({
                _openid: _.in(openids)
            })
            .get()
            .then(res => {
                // 创建用户信息映射
                const userMap = {}
                res.data.forEach(user => {
                    userMap[user._openid] = {
                        nickName: user.nickName,
                        avatarUrl: user.avatarUrl
                    }
                })

                // 更新评论中的用户信息
                const updatedComments = comments.map(comment => {
                    // 如果有该用户的最新信息，则更新评论中的用户信息
                    if (userMap[comment._openid]) {
                        return {
                            ...comment,
                            userInfo: {
                                nickName: userMap[comment._openid].nickName,
                                avatarUrl: userMap[comment._openid].avatarUrl
                            }
                        }
                    }
                    return comment
                })

                this.setData({
                    comments: updatedComments,
                    userMap: userMap
                })
            })
            .catch(err => {
                console.error('获取用户信息失败', err)
                // 如果获取用户信息失败，仍然显示原始评论
                this.setData({ comments: comments })
            })
    },

    // 检查收藏状态
    checkFavoriteStatus: function () {
        if (!app.globalData.isLogin) return

        const isFavorite = app.isFavorite(this.data.shopId)
        this.setData({ isFavorite })
    },

    // 收藏/取消收藏
    toggleFavorite: function () {
        if (!app.globalData.isLogin) {
            wx.navigateTo({
                url: '/pages/login/login'
            })
            return
        }

        const isFavorite = this.data.isFavorite

        if (isFavorite) {
            // 取消收藏
            app.removeFavorite(this.data.shopId)
                .then(() => {
                    this.setData({ isFavorite: false })
                    wx.showToast({
                        title: '已取消收藏',
                        icon: 'success'
                    })
                })
                .catch(err => {
                    console.error('取消收藏失败', err)
                })
        } else {
            // 添加收藏
            app.addFavorite(this.data.shopId)
                .then(() => {
                    this.setData({ isFavorite: true })
                    wx.showToast({
                        title: '收藏成功',
                        icon: 'success'
                    })
                })
                .catch(err => {
                    console.error('收藏失败', err)
                })
        }
    },

    // 输入评论
    inputComment: function (e) {
        this.setData({
            newComment: e.detail.value
        })
    },

    // 提交评论
    submitComment: function () {
        if (!app.globalData.isLogin) {
            wx.navigateTo({
                url: '/pages/login/login'
            })
            return
        }

        const content = this.data.newComment.trim()
        if (!content) {
            wx.showToast({
                title: '评论内容不能为空',
                icon: 'none'
            })
            return
        }

        this.setData({ isLoading: true })

        const db = wx.cloud.database()

        db.collection('shop_comments')
            .add({
                data: {
                    shopId: this.data.shopId,
                    content: content,
                    userInfo: {
                        nickName: app.globalData.userInfo.nickName,
                        avatarUrl: app.globalData.userInfo.avatarUrl
                    },
                    createTime: db.serverDate(),
                    likeCount: 0,
                    likeUsers: []
                }
            })
            .then(() => {
                wx.showToast({
                    title: '评论成功',
                    icon: 'success'
                })

                this.setData({
                    newComment: '',
                    isLoading: false
                })

                // 重新加载评论列表
                this.loadComments()
            })
            .catch(err => {
                console.error('提交评论失败', err)
                this.setData({ isLoading: false })
                wx.showToast({
                    title: '评论失败，请重试',
                    icon: 'none'
                })
            })
    },

    // 点赞评论
    likeComment: function (e) {
        if (!app.globalData.isLogin) {
            wx.navigateTo({
                url: '/pages/login/login'
            })
            return
        }

        const commentId = e.currentTarget.dataset.id
        const commentIndex = e.currentTarget.dataset.index
        const comment = this.data.comments[commentIndex]

        // 检查是否已点赞
        const openId = app.globalData.userInfo.openId
        console.log('当前用户openId:', openId)
        console.log('评论点赞用户列表:', comment.likeUsers)

        const hasLiked = comment.likeUsers && comment.likeUsers.includes(openId)
        console.log('是否已点赞:', hasLiked)

        const db = wx.cloud.database()
        const _ = db.command

        wx.showLoading({
            title: hasLiked ? '取消点赞...' : '点赞中...'
        })

        if (hasLiked) {
            // 取消点赞
            db.collection('shop_comments')
                .doc(commentId)
                .update({
                    data: {
                        likeCount: _.inc(-1),
                        likeUsers: _.pull(openId)
                    }
                })
                .then((res) => {
                    console.log('取消点赞成功:', res)
                    wx.hideLoading()

                    // 更新本地数据
                    const comments = this.data.comments
                    comments[commentIndex].likeCount -= 1
                    comments[commentIndex].likeUsers = comments[commentIndex].likeUsers.filter(id => id !== openId)

                    this.setData({ comments })

                    wx.showToast({
                        title: '已取消点赞',
                        icon: 'success'
                    })
                })
                .catch(err => {
                    wx.hideLoading()
                    console.error('取消点赞失败', err)
                    wx.showToast({
                        title: '操作失败，请重试',
                        icon: 'none'
                    })
                })
        } else {
            // 添加点赞
            db.collection('shop_comments')
                .doc(commentId)
                .update({
                    data: {
                        likeCount: _.inc(1),
                        likeUsers: _.push(openId)
                    }
                })
                .then((res) => {
                    console.log('点赞成功:', res)
                    wx.hideLoading()

                    // 更新本地数据
                    const comments = this.data.comments
                    comments[commentIndex].likeCount = (comments[commentIndex].likeCount || 0) + 1
                    if (!comments[commentIndex].likeUsers) {
                        comments[commentIndex].likeUsers = []
                    }
                    comments[commentIndex].likeUsers.push(openId)

                    this.setData({ comments })

                    wx.showToast({
                        title: '点赞成功',
                        icon: 'success'
                    })
                })
                .catch(err => {
                    wx.hideLoading()
                    console.error('点赞失败', err)
                    wx.showToast({
                        title: '操作失败，请重试',
                        icon: 'none'
                    })
                })
        }
    },

    // 跳转到商家小程序
    navigateToShop: function () {
        const shop = this.data.shop

        if (!shop.appId) {
            wx.showToast({
                title: '商家appId未配置',
                icon: 'none'
            })
            return
        }

        wx.navigateToMiniProgram({
            appId: shop.appId,
            success(res) {
                console.log('跳转成功')
            },
            fail(err) {
                console.error('跳转失败：', err)
                let errMsg = '跳转失败'
                if (err.errMsg.includes('invalid appid')) {
                    errMsg = '商家小程序ID无效'
                }
                wx.showToast({
                    title: errMsg,
                    icon: 'none'
                })
            }
        })
    }
}) 