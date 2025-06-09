const app = getApp()

Page({
    data: {
        userInfo: null,
        hasUserInfo: false,
        isLogin: false,
        favoriteShops: []
    },

    onLoad: function () {
        this.checkLoginStatus()
    },

    onShow: function () {
        this.checkLoginStatus()
        if (this.data.isLogin) {
            this.loadFavoriteShops()
        }
    },

    // 检查登录状态
    checkLoginStatus: function () {
        const userInfo = app.globalData.userInfo
        const isLogin = app.globalData.isLogin

        this.setData({
            userInfo: userInfo,
            hasUserInfo: app.globalData.hasUserInfo,
            isLogin: isLogin
        })
    },

    // 跳转到登录页
    goToLogin: function () {
        wx.navigateTo({
            url: '/pages/login/login'
        })
    },

    // 加载收藏的商家
    loadFavoriteShops: function () {
        const db = wx.cloud.database()

        db.collection('user_favorites')
            .where({
                _openid: app.globalData.userInfo.openId
            })
            .orderBy('createTime', 'desc')
            .get()
            .then(res => {
                const favoriteIds = res.data.map(item => item.shopId)

                if (favoriteIds.length === 0) {
                    this.setData({ favoriteShops: [] })
                    return
                }

                // 获取商家详情
                db.collection('shops')
                    .where({
                        _id: db.command.in(favoriteIds)
                    })
                    .get()
                    .then(shopRes => {
                        // 按照收藏顺序排序
                        const sortedShops = []
                        favoriteIds.forEach(id => {
                            const shop = shopRes.data.find(s => s._id === id)
                            if (shop) sortedShops.push(shop)
                        })

                        this.setData({ favoriteShops: sortedShops })
                    })
            })
            .catch(err => {
                console.error('获取收藏商家失败', err)
            })
    },

    // 取消收藏
    cancelFavorite: function (e) {
        const shopId = e.currentTarget.dataset.id

        wx.showLoading({ title: '取消中...' })

        app.removeFavorite(shopId)
            .then(() => {
                wx.hideLoading()
                wx.showToast({
                    title: '已取消收藏',
                    icon: 'success'
                })

                // 更新列表
                this.loadFavoriteShops()
            })
            .catch(err => {
                wx.hideLoading()
                console.error('取消收藏失败', err)
                wx.showToast({
                    title: '操作失败，请重试',
                    icon: 'none'
                })
            })
    },

    // 跳转到商家小程序
    navigateToShop: function (e) {
        const shop = e.currentTarget.dataset.shop

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
    },

    // 退出登录
    logout: function () {
        wx.showModal({
            title: '提示',
            content: '确定要退出登录吗？',
            success: (res) => {
                if (res.confirm) {
                    // 清除登录信息
                    app.globalData.userInfo = null
                    app.globalData.hasUserInfo = false
                    app.globalData.isLogin = false
                    app.globalData.favoriteShops = []

                    // 清除本地存储
                    wx.removeStorageSync('userInfo')

                    this.setData({
                        userInfo: null,
                        hasUserInfo: false,
                        isLogin: false,
                        favoriteShops: []
                    })

                    wx.showToast({
                        title: '已退出登录',
                        icon: 'success'
                    })
                }
            }
        })
    }
}) 