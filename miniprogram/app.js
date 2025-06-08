// app.js
App({
    onLaunch: function () {
        if (!wx.cloud) {
            console.error('请使用 2.2.3 或以上的基础库以使用云能力')
        } else {
            wx.cloud.init({
                env: 'cloudbase-0gdnnqax782f54fa', // 你的云环境ID
                traceUser: true,
            })
        }

        // 获取系统信息
        const systemInfo = wx.getWindowInfo()
        this.globalData = {
            userInfo: null,
            windowWidth: systemInfo.windowWidth,
            windowHeight: systemInfo.windowHeight
        }
    }
}) 