const app = getApp()

Page({
    data: {
        canIUseGetUserProfile: false
    },

    onLoad: function () {
        if (wx.getUserProfile) {
            this.setData({
                canIUseGetUserProfile: true
            })
        }
    },

    // 使用微信授权登录
    getUserProfile: function () {
        wx.getUserProfile({
            desc: '用于完善用户资料',
            success: (res) => {
                this.login(res.userInfo)
            },
            fail: (err) => {
                console.error('获取用户信息失败', err)
                wx.showToast({
                    title: '授权失败',
                    icon: 'none'
                })
            }
        })
    },

    // 登录处理
    login: function (userInfo) {
        wx.showLoading({
            title: '登录中...'
        })

        // 调用云函数登录
        wx.cloud.callFunction({
            name: 'login',
            success: res => {
                // 获取openid
                const openId = res.result.openid

                // 先检查数据库中是否已有该用户的信息
                this.checkExistingUser(openId, userInfo)
            },
            fail: err => {
                console.error('云函数调用失败', err)
                wx.hideLoading()
                wx.showToast({
                    title: '登录失败，请重试',
                    icon: 'none'
                })
            }
        })
    },

    // 检查用户是否已存在
    checkExistingUser: function (openId, wxUserInfo) {
        const db = wx.cloud.database()

        db.collection('users')
            .where({
                _openid: openId
            })
            .get()
            .then(res => {
                let userInfo = {
                    ...wxUserInfo,
                    openId: openId,
                    loginTime: new Date().getTime()
                }

                if (res.data.length > 0) {
                    // 用户已存在，使用数据库中的信息
                    const dbUser = res.data[0]

                    // 合并用户信息，优先使用数据库中的信息
                    userInfo = {
                        ...userInfo,
                        nickName: dbUser.nickName || userInfo.nickName,
                        avatarUrl: dbUser.avatarUrl || userInfo.avatarUrl
                    }

                    // 更新数据库中的登录时间
                    this.updateUserLoginTime(dbUser._id)
                } else {
                    // 创建新用户
                    this.createNewUser(userInfo)
                }

                // 保存到全局数据
                app.globalData.userInfo = userInfo
                app.globalData.hasUserInfo = true
                app.globalData.isLogin = true

                // 保存到本地存储
                wx.setStorageSync('userInfo', userInfo)

                wx.hideLoading()

                // 获取用户收藏的商家
                app.getFavoriteShops()

                // 返回上一页或首页
                const pages = getCurrentPages()
                if (pages.length > 1) {
                    wx.navigateBack()
                } else {
                    wx.switchTab({
                        url: '/pages/index/index'
                    })
                }
            })
            .catch(err => {
                console.error('检查用户信息失败', err)
                wx.hideLoading()
                wx.showToast({
                    title: '登录失败，请重试',
                    icon: 'none'
                })
            })
    },

    // 更新用户登录时间
    updateUserLoginTime: function (userId) {
        const db = wx.cloud.database()

        db.collection('users')
            .doc(userId)
            .update({
                data: {
                    lastLoginTime: db.serverDate()
                }
            })
            .catch(err => {
                console.error('更新登录时间失败', err)
            })
    },

    // 创建新用户
    createNewUser: function (userInfo) {
        const db = wx.cloud.database()

        db.collection('users').add({
            data: {
                nickName: userInfo.nickName,
                avatarUrl: userInfo.avatarUrl,
                gender: userInfo.gender,
                country: userInfo.country,
                province: userInfo.province,
                city: userInfo.city,
                createTime: db.serverDate(),
                updateTime: db.serverDate(),
                lastLoginTime: db.serverDate()
            }
        })
            .catch(err => {
                console.error('创建用户失败', err)
            })
    }
}) 