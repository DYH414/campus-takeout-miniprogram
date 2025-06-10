Page({
  data: {
    shop: {
      name: '百媚鸡猪肘饭',
      description: '文苑3楼',
      appId: 'wxe99bab2e84849fe1',
      category: '快餐',
      logoUrl: '/static/images/shop-logos/baimei.svg',
      deliveryStart: 15,
      rating: 4.8,
      monthlySales: 320
    },
    isAdding: false
  },

  // 添加商家
  addShop: function () {
    if (this.data.isAdding) return;

    this.setData({ isAdding: true });

    wx.showLoading({
      title: '添加中...'
    });

    wx.cloud.callFunction({
      name: 'shop',
      data: {
        action: 'add',
        data: this.data.shop
      }
    }).then(res => {
      wx.hideLoading();
      this.setData({ isAdding: false });

      if (res.result && res.result.code === 0) {
        wx.showToast({
          title: '添加成功',
          icon: 'success'
        });

        // 保存商家ID
        this.setData({
          'shop._id': res.result.data._id
        });
      } else {
        wx.showToast({
          title: '添加失败',
          icon: 'none'
        });
        console.error('添加失败:', res);
      }
    }).catch(err => {
      wx.hideLoading();
      this.setData({ isAdding: false });

      wx.showToast({
        title: '添加失败',
        icon: 'none'
      });
      console.error('调用云函数失败:', err);
    });
  }
}) 