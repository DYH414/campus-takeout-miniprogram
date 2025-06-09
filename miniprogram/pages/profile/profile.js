const app = getApp()

Page({
    data: {
        userInfo: null,
        hasUserInfo: false,
        isLogin: false,
        favoriteShops: [],
        isEditingName: false,
        newNickname: ''
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
            isLogin: isLogin,
            newNickname: userInfo ? userInfo.nickName : ''
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
    },

    // 上传头像
    uploadAvatar: function () {
        if (!this.data.isLogin) {
            wx.showToast({
                title: '请先登录',
                icon: 'none'
            })
            return
        }

        wx.chooseMedia({
            count: 1,
            mediaType: ['image'],
            sourceType: ['album', 'camera'],
            camera: 'back',
            success: (res) => {
                const tempFilePath = res.tempFiles[0].tempFilePath

                wx.showLoading({
                    title: '上传中...'
                })

                // 上传图片到云存储
                const cloudPath = `avatars/${app.globalData.userInfo.openId}_${new Date().getTime()}.${tempFilePath.match(/\.(\w+)$/)[1]}`

                wx.cloud.uploadFile({
                    cloudPath: cloudPath,
                    filePath: tempFilePath,
                    success: (res) => {
                        const fileID = res.fileID

                        // 更新用户头像
                        this.updateUserAvatar(fileID)
                    },
                    fail: (err) => {
                        wx.hideLoading()
                        console.error('上传头像失败', err)
                        wx.showToast({
                            title: '上传失败，请重试',
                            icon: 'none'
                        })
                    }
                })
            }
        })
    },

    // 更新用户头像
    updateUserAvatar: function (fileID) {
        const db = wx.cloud.database()

        // 更新数据库中的用户头像
        db.collection('users')
            .where({
                _openid: app.globalData.userInfo.openId
            })
            .update({
                data: {
                    avatarUrl: fileID,
                    updateTime: db.serverDate()
                }
            })
            .then(() => {
                // 更新全局数据和本地存储
                app.globalData.userInfo.avatarUrl = fileID
                wx.setStorageSync('userInfo', app.globalData.userInfo)

                this.setData({
                    'userInfo.avatarUrl': fileID
                })

                wx.hideLoading()
                wx.showToast({
                    title: '头像更新成功',
                    icon: 'success'
                })
            })
            .catch(err => {
                wx.hideLoading()
                console.error('更新头像失败', err)
                wx.showToast({
                    title: '更新失败，请重试',
                    icon: 'none'
                })
            })
    },

    // 显示昵称编辑框
    showEditName: function () {
        this.setData({
            isEditingName: true
        })
    },

    // 输入新昵称
    inputNewName: function (e) {
        this.setData({
            newNickname: e.detail.value
        })
    },

    // 取消编辑昵称
    cancelEditName: function () {
        this.setData({
            isEditingName: false,
            newNickname: this.data.userInfo.nickName
        })
    },

    // 保存新昵称
    saveNewName: function () {
        const newNickname = this.data.newNickname.trim()

        if (!newNickname) {
            wx.showToast({
                title: '昵称不能为空',
                icon: 'none'
            })
            return
        }

        wx.showLoading({
            title: '保存中...'
        })

        const db = wx.cloud.database()

        // 更新数据库中的用户昵称
        db.collection('users')
            .where({
                _openid: app.globalData.userInfo.openId
            })
            .update({
                data: {
                    nickName: newNickname,
                    updateTime: db.serverDate()
                }
            })
            .then(() => {
                // 更新全局数据和本地存储
                app.globalData.userInfo.nickName = newNickname
                wx.setStorageSync('userInfo', app.globalData.userInfo)

                this.setData({
                    'userInfo.nickName': newNickname,
                    isEditingName: false
                })

                wx.hideLoading()
                wx.showToast({
                    title: '昵称更新成功',
                    icon: 'success'
                })
            })
            .catch(err => {
                wx.hideLoading()
                console.error('更新昵称失败', err)
                wx.showToast({
                    title: '更新失败，请重试',
                    icon: 'none'
                })
            })
    }
}) 