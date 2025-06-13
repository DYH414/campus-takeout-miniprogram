// 获取应用实例
const app = getApp()

// 添加获取热门评论的函数，放在Page外面
const getHotComments = function (db, shopList) {
    const promises = shopList.map(shop => {
        return db.collection('shop_comments')
            .where({ shopId: shop._id })
            .orderBy('likeCount', 'desc')
            .limit(1)
            .get()
            .then(res => {
                if (res.data && res.data.length > 0) {
                    shop.hotComment = res.data[0];
                }
                return shop;
            })
            .catch(err => {
                console.error('获取热门评论失败', err);
                return shop;
            });
    });

    return Promise.all(promises);
}

Page({
    data: {
        currentCategory: '全部',
        categories: [
            { id: 'all', name: '全部', icon: 'cloud://cloudbase-0gdnnqax782f54fa.636c-cloudbase-0gdnnqax782f54fa-1363163853/static/images/category/all.png' },
            { id: 'milk-tea', name: '奶茶', icon: 'cloud://cloudbase-0gdnnqax782f54fa.636c-cloudbase-0gdnnqax782f54fa-1363163853/static/images/category/milk-tea.png' },
            { id: 'fast-food', name: '快餐', icon: 'cloud://cloudbase-0gdnnqax782f54fa.636c-cloudbase-0gdnnqax782f54fa-1363163853/static/images/category/Kuaican.png' },
            { id: 'takeaway-platform', name: '外卖平台', icon: 'cloud://cloudbase-0gdnnqax782f54fa.636c-cloudbase-0gdnnqax782f54fa-1363163853/static/images/category/Waimai.png' },
            { id: 'hamburger', name: '汉堡', icon: 'cloud://cloudbase-0gdnnqax782f54fa.636c-cloudbase-0gdnnqax782f54fa-1363163853/static/images/category/Hanbao.png' },
            { id: 'dessert', name: '甜点', icon: 'cloud://cloudbase-0gdnnqax782f54fa.636c-cloudbase-0gdnnqax782f54fa-1363163853/static/images/category/all.png' }
        ],
        shopList: [],
        pageSize: 20,
        pageNum: 1,
        isLoading: false,
        noMore: false,
        searchKeyword: '',
        hotComments: {}, // 存储每个商家的热门评论
        userMap: {}, // 存储用户信息的映射
        showPlatformSelector: false,
        currentShop: null
    },

    onLoad: function () {
        this.loadShopList()  // 从数据库加载数据
    },

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
                this.loadShopList()
                this.loadHotComments()
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
            this.loadShopList()
            this.loadHotComments()
        }
    },

    // 加载热门评论
    loadHotComments: function () {
        const db = wx.cloud.database()
        const _ = db.command
        const $ = db.command.aggregate

        // 使用聚合操作获取每个店铺的最新评论
        db.collection('shop_comments')
            .aggregate()
            .group({
                _id: '$shopId',
                comment: $.first('$$ROOT')
            })
            .end()
            .then(res => {
                if (res.list && res.list.length > 0) {
                    const hotComments = {}
                    const openids = []

                    // 收集所有评论的用户openid
                    res.list.forEach(item => {
                        if (item.comment && item.comment._openid) {
                            hotComments[item._id] = item.comment
                            openids.push(item.comment._openid)
                        }
                    })

                    // 获取最新的用户信息
                    this.updateCommentsUserInfo()
                }
            })
            .catch(err => {
                console.error('获取热门评论失败', err)
            })
    },

    // 更新评论中的用户信息
    updateCommentsUserInfo: function () {
        const openids = []
        const hotComments = this.data.hotComments

        // 收集所有评论的用户openid
        Object.values(hotComments).forEach(comment => {
            if (comment && comment._openid) {
                openids.push(comment._openid)
            }
        })

        if (openids.length === 0) return

        // 获取最新的用户信息
        const db = wx.cloud.database()
        const _ = db.command

        db.collection('users')
            .where({
                _openid: _.in([...new Set(openids)])
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
                const updatedHotComments = {}

                Object.entries(hotComments).forEach(([shopId, comment]) => {
                    if (comment && userMap[comment._openid]) {
                        updatedHotComments[shopId] = {
                            ...comment,
                            userInfo: {
                                nickName: userMap[comment._openid].nickName,
                                avatarUrl: userMap[comment._openid].avatarUrl
                            }
                        }
                    } else {
                        updatedHotComments[shopId] = comment
                    }
                })

                this.setData({
                    hotComments: updatedHotComments,
                    userMap: userMap
                })
            })
            .catch(err => {
                console.error('获取用户信息失败', err)
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

    // 图片加载错误处理
    onImageError: function (e) {
        const index = e.currentTarget.dataset.index
        console.error('图片加载失败:', this.data.categories[index].icon)
        // 使用默认图片
        const categories = this.data.categories
        categories[index].icon = '/static/images/category/default.png'
        this.setData({ categories })
    },

    // 加载商家列表
    async loadShopList(refresh = false) {
        if (this.data.isLoading || (!refresh && this.data.noMore)) return

        this.setData({ isLoading: true })

        try {
            const db = wx.cloud.database()
            const _ = db.command

            // 构建查询条件
            let query = {}
            if (this.data.currentCategory !== '全部') {
                query.category = this.data.currentCategory
            }
            if (this.data.searchKeyword) {
                query.name = db.RegExp({
                    regexp: this.data.searchKeyword,
                    options: 'i'
                })
            }

            // 获取数据
            const res = await db.collection('shops')
                .where(query)
                .skip((this.data.pageNum - 1) * this.data.pageSize)
                .limit(this.data.pageSize)
                .get()

            // 更新数据
            const newList = refresh ? res.data : [...this.data.shopList, ...res.data]
            this.setData({
                shopList: newList,
                noMore: res.data.length < this.data.pageSize,
                isLoading: false
            })

            // 获取每个商家点赞最多的评论
            getHotComments(db, this.data.shopList).then(updatedList => {
                this.setData({
                    shopList: updatedList
                });
            }).catch(err => {
                console.error('处理热门评论失败', err);
            });
        } catch (err) {
            console.error('加载商家列表失败：', err)
            wx.showToast({
                title: '加载失败，请重试',
                icon: 'none'
            })
            this.setData({ isLoading: false })
        }
    },

    // 切换分类
    switchCategory(e) {
        const category = e.currentTarget.dataset.category
        this.setData({
            currentCategory: category,
            pageNum: 1,
            noMore: false
        })
        this.loadShopList(true)
    },

    // 搜索商家
    onSearch: function (e) {
        this.setData({
            searchKeyword: e.detail.value,
            pageNum: 1,
            noMore: false
        })
        this.loadShopList(true)
    },

    // 加载更多
    loadMore() {
        if (!this.data.noMore) {
            this.setData({
                pageNum: this.data.pageNum + 1
            })
            this.loadShopList()
        }
    },

    // 跳转到商家
    navigateToShop(e) {
        const shop = e.currentTarget.dataset.shop;
        if (shop.platforms && shop.platforms.length > 1) {
            this.setData({
                showPlatformSelector: true,
                currentShop: shop
            });
        } else if (shop.platforms && shop.platforms.length === 1) {
            const platform = shop.platforms[0];
            if (platform.type === 'miniprogram') {
                wx.navigateToMiniProgram({
                    appId: platform.appId,
                    path: platform.path,
                    fail: (err) => {
                        if (err.errMsg !== 'navigateToMiniProgram:fail cancel') {
                            wx.showToast({
                                title: '跳转失败',
                                icon: 'none'
                            });
                        }
                    }
                });
            } else if (platform.type === 'web') {
                wx.navigateTo({
                    url: `/pages/webview/webview?url=${encodeURIComponent(platform.url)}`,
                    fail: (err) => {
                        if (err.errMsg !== 'navigateTo:fail cancel') {
                            wx.showToast({
                                title: '跳转失败',
                                icon: 'none'
                            });
                        }
                    }
                });
            }
        }
    },

    // 跳转到指定平台
    navigateToPlatform(e) {
        const platform = e.currentTarget.dataset.platform;
        if (platform.type === 'miniprogram') {
            wx.navigateToMiniProgram({
                appId: platform.appId,
                path: platform.path,
                fail: (err) => {
                    if (err.errMsg !== 'navigateToMiniProgram:fail cancel') {
                        wx.showToast({
                            title: '跳转失败',
                            icon: 'none'
                        });
                    }
                }
            });
        } else if (platform.type === 'web') {
            wx.navigateTo({
                url: `/pages/webview/webview?url=${encodeURIComponent(platform.url)}`,
                fail: (err) => {
                    if (err.errMsg !== 'navigateTo:fail cancel') {
                        wx.showToast({
                            title: '跳转失败',
                            icon: 'none'
                        });
                    }
                }
            });
        }
        this.closePlatformSelector();
    },

    // 关闭平台选择器
    closePlatformSelector: function () {
        this.setData({
            showPlatformSelector: false,
            currentShop: null
        })
    },

    // 跳转到商家详情页
    goToShopDetail(e) {
        const shopId = e.currentTarget.dataset.id
        wx.navigateTo({
            url: `/pages/shop/detail/detail?id=${shopId}`
        })
    },

    // 商家图片加载错误处理
    onShopImageError(e) {
        const index = e.currentTarget.dataset.index
        console.error('商家图片加载失败:', this.data.shopList[index].logoUrl)

        // 创建新数组，避免直接修改状态
        const shopList = [...this.data.shopList]
        // 使用默认图片
        shopList[index].logoUrl = '/static/images/shops/default.png'
        this.setData({ shopList })
    },

    // 用户点击星星进行评分
    rateShop: function (e) {
        // 阻止事件冒泡，避免触发商家卡片的点击事件
        if (e && e.stopPropagation) {
            e.stopPropagation();
        }

        // 获取商家ID和用户点击的星级
        const shopId = e.currentTarget.dataset.shopId;
        const rating = parseInt(e.currentTarget.dataset.rating);

        console.log('用户评分:', shopId, rating);

        // 判断用户是否登录
        if (!app.globalData.isLogin) {
            wx.showToast({
                title: '请先登录',
                icon: 'none'
            });
            return;
        }

        // 显示加载提示
        wx.showLoading({
            title: '提交中...',
            mask: true
        });

        const db = wx.cloud.database();

        // 检查用户是否已经评分过
        db.collection('shop_ratings')
            .where({
                shopId: shopId,
                _openid: app.globalData.userInfo.openId
            })
            .get()
            .then(res => {
                if (res.data && res.data.length > 0) {
                    // 更新已有评分
                    return db.collection('shop_ratings').doc(res.data[0]._id).update({
                        data: {
                            rating: rating,
                            updateTime: db.serverDate()
                        }
                    });
                } else {
                    // 添加新评分
                    return db.collection('shop_ratings').add({
                        data: {
                            shopId: shopId,
                            rating: rating,
                            createTime: db.serverDate()
                        }
                    });
                }
            })
            .then(() => {
                // 更新商家的平均评分
                return wx.cloud.callFunction({
                    name: 'updateShopRating',
                    data: {
                        shopId: shopId
                    }
                });
            })
            .then(res => {
                wx.hideLoading();
                wx.showToast({
                    title: '评分成功',
                    icon: 'success'
                });

                // 更新本地数据
                if (res.result && res.result.success) {
                    const shopList = this.data.shopList.map(shop => {
                        if (shop._id === shopId) {
                            shop.avgRating = res.result.avgRating;
                            shop.ratingCount = res.result.ratingCount;
                        }
                        return shop;
                    });

                    this.setData({
                        shopList: shopList
                    });
                }
            })
            .catch(err => {
                wx.hideLoading();
                console.error('评分失败', err);
                wx.showToast({
                    title: '评分失败，请重试',
                    icon: 'none'
                });
            });
    },

    // 空函数，用于阻止事件冒泡
    noop: function (e) {
        // 阻止事件冒泡
        if (e && e.stopPropagation) {
            e.stopPropagation();
        }
    },
}) 