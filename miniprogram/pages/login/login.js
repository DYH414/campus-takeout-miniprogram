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

                // 合并用户信息
                const user = {
                    ...userInfo,
                    openId: openId,
                    loginTime: new Date().getTime()
                }

                // 保存到全局数据
                app.globalData.userInfo = user
                app.globalData.hasUserInfo = true
                app.globalData.isLogin = true

                // 保存到本地存储
                wx.setStorageSync('userInfo', user)

                // 更新或创建用户记录
                this.updateUserInfo(user)

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

    // 更新用户信息到数据库
    updateUserInfo: function (user) {
        const db = wx.cloud.database()

        // 查询用户是否已存在
        db.collection('users')
            .where({
                _openid: user.openId
            })
            .get()
            .then(res => {
                if (res.data.length > 0) {
                    // 更新用户信息
                    return db.collection('users').doc(res.data[0]._id).update({
                        data: {
                            nickName: user.nickName,
                            avatarUrl: user.avatarUrl,
                            updateTime: db.serverDate()
                        }
                    })
                } else {
                    // 创建新用户
                    return db.collection('users').add({
                        data: {
                            nickName: user.nickName,
                            avatarUrl: user.avatarUrl,
                            gender: user.gender,
                            country: user.country,
                            province: user.province,
                            city: user.city,
                            createTime: db.serverDate(),
                            updateTime: db.serverDate()
                        }
                    })
                }
            })
            .catch(err => {
                console.error('更新用户信息失败', err)
            })
    }
}) 