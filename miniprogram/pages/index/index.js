// 获取应用实例
const app = getApp()

Page({
    data: {
        currentCategory: '全部',
        categories: [
            { id: 'all', name: '全部', icon: 'cloud://cloudbase-0gdnnqax782f54fa.636c-cloudbase-0gdnnqax782f54fa-1363163853/static/images/category/all.png' },
            { id: 'milk-tea', name: '奶茶', icon: 'cloud://cloudbase-0gdnnqax782f54fa.636c-cloudbase-0gdnnqax782f54fa-1363163853/static/images/category/milk-tea.png' },
            { id: 'fast-food', name: '快餐', icon: 'cloud://cloudbase-0gdnnqax782f54fa.636c-cloudbase-0gdnnqax782f54fa-1363163853/static/images/category/all.png' },
            { id: 'snack', name: '小吃', icon: 'cloud://cloudbase-0gdnnqax782f54fa.636c-cloudbase-0gdnnqax782f54fa-1363163853/static/images/category/all.png' },
            { id: 'dessert', name: '甜点', icon: 'cloud://cloudbase-0gdnnqax782f54fa.636c-cloudbase-0gdnnqax782f54fa-1363163853/static/images/category/all.png' }
        ],
        shopList: [],
        pageSize: 20,
        pageNum: 1,
        isLoading: false,
        noMore: false,
        searchKeyword: '',
        hotComments: {} // 存储每个商家的热门评论
    },

    onLoad: function () {
        this.loadShopList()  // 从数据库加载数据
    },

    onShow: function () {
        // 检查登录状态变化
        if (app.globalData.isLogin) {
            this.setData({
                isLogin: true,
                userInfo: app.globalData.userInfo
            })
        }
    },

    // 图片加载错误处理
    onImageError: function (e) {
        const index = e.currentTarget.dataset.index
        console.error('图片加载失败:', this.data.categories[index].icon)
        // 可以设置一个默认图片
        const categories = this.data.categories
        categories[index].icon = 'cloud://cloudbase-0gdnnqax782f54fa.636c-cloudbase-0gdnnqax782f54fa-1363163853/static/images/category/all.png'
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

            // 获取每个商家的热门评论
            this.loadHotComments(newList.map(shop => shop._id))
        } catch (err) {
            console.error('加载商家列表失败：', err)
            wx.showToast({
                title: '加载失败，请重试',
                icon: 'none'
            })
            this.setData({ isLoading: false })
        }
    },

    // 加载热门评论
    loadHotComments: function (shopIds) {
        if (!shopIds || shopIds.length === 0) return

        const db = wx.cloud.database()
        const _ = db.command
        const $ = db.command.aggregate

        // 为每个商家获取点赞数最高的评论
        shopIds.forEach(shopId => {
            db.collection('shop_comments')
                .where({
                    shopId: shopId
                })
                .orderBy('likeCount', 'desc')
                .limit(1)
                .get()
                .then(res => {
                    if (res.data && res.data.length > 0) {
                        // 更新热门评论
                        this.setData({
                            [`hotComments.${shopId}`]: res.data[0]
                        })
                    }
                })
                .catch(err => {
                    console.error('获取热门评论失败', err)
                })
        })
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

    // 跳转到商家小程序
    navigateToShop(e) {
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
        // 使用分类默认图标作为替代
        shopList[index].logoUrl = 'cloud://cloudbase-0gdnnqax782f54fa.636c-cloudbase-0gdnnqax782f54fa-1363163853/static/images/category/all.png'
        this.setData({ shopList })
    }
}) 