// app.js
App({
    onLaunch: function () {
        if (!wx.cloud) {
            console.error('请使用 2.2.3 或以上的基础库以使用云能力')
        } else {
            wx.cloud.init({
                env: 'cloudbase-0gdnnqax782f54fa',  // 使用您的云环境ID
                traceUser: true,
            })
        }

        // 获取系统信息
        const systemInfo = wx.getWindowInfo()

        // 检查用户登录状态
        this.checkLoginStatus()

        this.globalData = {
            userInfo: null,
            hasUserInfo: false,
            isLogin: false,
            windowWidth: systemInfo.windowWidth,
            windowHeight: systemInfo.windowHeight,
            favoriteShops: []
        }
    },

    // 检查登录状态
    checkLoginStatus: function () {
        const userInfo = wx.getStorageSync('userInfo')
        if (userInfo) {
            this.globalData.userInfo = userInfo
            this.globalData.hasUserInfo = true
            this.globalData.isLogin = true

            // 获取用户收藏的商家
            this.getFavoriteShops()
        }
    },

    // 获取用户收藏的商家
    getFavoriteShops: function () {
        if (!this.globalData.isLogin) return

        const db = wx.cloud.database()
        db.collection('user_favorites')
            .where({
                _openid: this.globalData.userInfo.openId
            })
            .get()
            .then(res => {
                this.globalData.favoriteShops = res.data.map(item => item.shopId) || []
            })
            .catch(err => {
                console.error('获取收藏商家失败', err)
            })
    },

    // 添加收藏
    addFavorite: function (shopId) {
        if (!this.globalData.isLogin) {
            wx.showToast({
                title: '请先登录',
                icon: 'none'
            })
            return Promise.reject('未登录')
        }

        const db = wx.cloud.database()
        return db.collection('user_favorites')
            .add({
                data: {
                    shopId: shopId,
                    createTime: db.serverDate()
                }
            })
            .then(res => {
                this.globalData.favoriteShops.push(shopId)
                return res
            })
    },

    // 取消收藏
    removeFavorite: function (shopId) {
        if (!this.globalData.isLogin) return Promise.reject('未登录')

        const db = wx.cloud.database()
        return db.collection('user_favorites')
            .where({
                _openid: this.globalData.userInfo.openId,
                shopId: shopId
            })
            .remove()
            .then(res => {
                const index = this.globalData.favoriteShops.indexOf(shopId)
                if (index > -1) {
                    this.globalData.favoriteShops.splice(index, 1)
                }
                return res
            })
    },

    // 检查是否收藏
    isFavorite: function (shopId) {
        return this.globalData.favoriteShops.includes(shopId)
    }
}) 