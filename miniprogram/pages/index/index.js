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
        // 优先使用缓存数据快速显示
        const shopListCache = wx.getStorageSync('shopList');
        if (shopListCache && Date.now() - shopListCache.time < 5 * 60 * 1000) { // 缓存5分钟
            this.setData({
                shopList: shopListCache.data
            });
        }

        // 然后再从服务器获取最新数据
        this.loadShops();
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
                this.loadShops()
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
            this.loadShops()
            this.loadHotComments()
        }
    },

    // 加载热门评论（优化版 - 关联用户信息）
    loadHotComments: function (shopList) {
        if (!shopList || shopList.length === 0) return;

        const db = wx.cloud.database();
        const _ = db.command;

        // 显示加载指示器
        wx.showLoading({
            title: '加载热门评论...',
            mask: false
        });

        // 为每个商家获取热门评论
        const promises = shopList.map(shop => {
            return db.collection('shop_comments')
                .where({
                    shopId: shop._id
                })
                .orderBy('likeCount', 'desc')
                .limit(1)
                .get()
                .then(res => {
                    if (res.data && res.data.length > 0) {
                        return {
                            shopId: shop._id,
                            comment: res.data[0]
                        };
                    }
                    return null;
                })
                .catch(err => {
                    console.error(`获取商家(${shop._id})热门评论失败`, err);
                    return null;
                });
        });

        // 等待所有请求完成
        Promise.all(promises)
            .then(results => {
                // 过滤掉空结果
                const validResults = results.filter(item => item !== null);

                if (validResults.length === 0) {
                    wx.hideLoading();
                    console.log('没有找到热门评论');
                    return;
                }

                // 收集所有评论的openid
                const openids = validResults.map(item => item.comment._openid).filter(openid => openid);

                if (openids.length === 0) {
                    // 如果没有有效的openid，使用默认值
                    this.updateShopListWithComments(shopList, validResults);
                    wx.hideLoading();
                    return;
                }

                // 获取用户信息
                db.collection('users')
                    .where({
                        _openid: _.in(openids)
                    })
                    .get()
                    .then(userRes => {
                        // 创建用户映射表
                        const userMap = {};
                        if (userRes.data && userRes.data.length > 0) {
                            userRes.data.forEach(user => {
                                userMap[user._openid] = {
                                    nickName: user.nickName || '微信用户',
                                    avatarUrl: user.avatarUrl || '/static/images/default-avatar.png'
                                };
                            });
                        }

                        // 关联评论与用户信息
                        this.updateShopListWithComments(shopList, validResults, userMap);
                        wx.hideLoading();
                    })
                    .catch(err => {
                        console.error('获取用户信息失败', err);
                        // 出错时使用原始数据
                        this.updateShopListWithComments(shopList, validResults);
                        wx.hideLoading();
                    });
            })
            .catch(err => {
                console.error('处理热门评论失败', err);
                wx.hideLoading();
            });
    },

    // 更新商家列表中的评论信息
    updateShopListWithComments: function (shopList, commentResults, userMap = {}) {
        // 创建评论映射
        const commentMap = {};
        commentResults.forEach(item => {
            const comment = item.comment;
            const userInfo = userMap[comment._openid] || {
                nickName: '热心顾客',
                avatarUrl: '/static/images/default-avatar.png'
            };

            commentMap[item.shopId] = {
                content: comment.content || '这家店很不错，推荐给大家！',
                likeCount: comment.likeCount || 0,
                userInfo: userInfo
            };
        });

        // 更新商家列表
        const updatedShopList = shopList.map(shop => {
            if (commentMap[shop._id]) {
                shop.hotComment = commentMap[shop._id];
            } else {
                // 如果没有真实评论，也添加一个默认评论
                shop.hotComment = {
                    content: '这家店很不错，推荐给大家！',
                    likeCount: Math.floor(Math.random() * 10) + 1,
                    userInfo: {
                        nickName: '热心顾客',
                        avatarUrl: '/static/images/default-avatar.png'
                    }
                };
            }
            return shop;
        });

        // 更新UI
        this.setData({
            shopList: updatedShopList
        });

        // 更新缓存
        wx.setStorage({
            key: 'shopList',
            data: {
                time: Date.now(),
                data: updatedShopList
            }
        });
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

    // 加载商家列表（优化版）
    loadShops: function () {
        // 显示加载中
        wx.showLoading({
            title: '加载中...',
            mask: true
        });

        const db = wx.cloud.database();
        const MAX_LIMIT = 20; // 每次最多获取20条数据

        // 使用Promise包装
        return new Promise((resolve, reject) => {
            // 1. 获取商家总数
            db.collection('shops').count()
                .then(res => {
                    const total = res.total;
                    // 计算需要分几次获取
                    const batchTimes = Math.ceil(total / MAX_LIMIT);
                    // 承载所有读操作的promise
                    const tasks = [];

                    // 2. 批量获取数据
                    for (let i = 0; i < batchTimes; i++) {
                        const promise = db.collection('shops')
                            .orderBy('avgRating', 'desc') // 按评分排序
                            .skip(i * MAX_LIMIT)
                            .limit(MAX_LIMIT)
                            .field({ // 只获取需要的字段，减少数据传输量
                                name: true,
                                logoUrl: true,
                                avgRating: true,
                                ratingCount: true,
                                tags: true,
                                address: true,
                                _id: true
                            })
                            .get();
                        tasks.push(promise);
                    }

                    // 3. 等待所有数据加载完成
                    return Promise.all(tasks);
                })
                .then(results => {
                    // 4. 合并结果
                    let shopList = [];
                    results.forEach(res => {
                        shopList = shopList.concat(res.data);
                    });

                    // 5. 设置数据并隐藏加载提示
                    this.setData({ shopList });

                    // 6. 获取热门评论
                    this.loadHotComments(shopList);

                    // 使用setStorage缓存数据，提高下次加载速度
                    wx.setStorage({
                        key: 'shopList',
                        data: {
                            time: Date.now(),
                            data: shopList
                        }
                    });

                    wx.hideLoading();
                    resolve(shopList);
                })
                .catch(err => {
                    console.error('获取商家列表失败', err);
                    wx.hideLoading();
                    wx.showToast({
                        title: '获取商家列表失败',
                        icon: 'none'
                    });
                    reject(err);
                });
        });
    },

    // 切换分类
    switchCategory(e) {
        const category = e.currentTarget.dataset.category
        this.setData({
            currentCategory: category,
            pageNum: 1,
            noMore: false
        })
        this.loadShops()
    },

    // 搜索商家
    onSearch: function (e) {
        this.setData({
            searchKeyword: e.detail.value,
            pageNum: 1,
            noMore: false
        })
        this.loadShops()
    },

    // 加载更多
    loadMore() {
        if (!this.data.noMore) {
            this.setData({
                pageNum: this.data.pageNum + 1
            })
            this.loadShops()
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

    // 前往商家详情页
    goToShopDetail: function (e) {
        const shopId = e.currentTarget.dataset.id;
        wx.navigateTo({
            url: '/pages/shop/detail/detail?id=' + shopId
        });
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

    // 下拉刷新（优化版）
    onPullDownRefresh: function () {
        // 清除缓存，强制重新加载
        wx.removeStorage({
            key: 'shopList'
        });

        // 重新加载商家列表
        this.loadShops().then(() => {
            wx.stopPullDownRefresh();
        }).catch(err => {
            console.error('刷新失败', err);
            wx.stopPullDownRefresh();
            wx.showToast({
                title: '刷新失败',
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