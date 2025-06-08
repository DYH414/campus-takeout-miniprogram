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
        searchKeyword: ''
    },

    onLoad: function () {
        // 测试数据示例
        const testShops = [
            {
                _id: '1',
                name: '小阿哥煲仔饭',
                description: '正宗煲仔饭，粤式快餐',
                logoUrl: 'cloud://cloudbase-0gdnnqax782f54fa.636c-cloudbase-0gdnnqax782f54fa-1363163853/static/images/category/all.png',
                appId: 'wxdd01bfc7fb8cb134',  // 小阿哥煲仔饭小程序
                category: '快餐',
                deliveryStart: 20,
                isOpen: true
            }
        ]

        // 使用测试数据
        this.setData({ shopList: testShops })

        // this.loadShopList()  // 暂时注释掉从数据库加载的代码，使用测试数据
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

    // 跳转到商家小程序
    navigateToShop(e) {
        const shop = e.currentTarget.dataset.shop
        if (!shop.isOpen) {
            wx.showToast({
                title: '该商家休息中',
                icon: 'none'
            })
            return
        }

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