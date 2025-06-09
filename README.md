# 校园外卖小程序聚合平台

## 项目介绍
本项目是一个校园外卖小程序聚合平台，旨在为校内学生提供一个统一的外卖小程序入口，方便学生查找和跳转到各个商家的小程序进行点餐。

## 技术栈
- 微信小程序原生开发
- 微信云开发
  - 云数据库：存储商家信息、用户数据、评论等
  - 云函数：处理登录、数据操作等
  - 云存储：存储商家logo等图片资源

## 功能特性
- 商家列表展示
- 分类筛选
- 关键词搜索
- 商家小程序跳转
- 微信授权登录
- 个人中心
- 商家收藏功能
- 商家评论与点赞
- 热门评论展示
- 分页加载

## 项目结构
```
├── cloudfunctions        // 云函数
│   ├── login            // 微信登录
│   └── shop             // 商家数据操作
├── miniprogram          // 小程序代码
│   ├── pages           // 页面文件
│   │   ├── index      // 首页
│   │   ├── login      // 登录页
│   │   ├── profile    // 个人中心
│   │   └── shop       // 商家相关
│   │       └── detail // 商家详情
│   ├── static         // 静态资源
│   │   └── images     // 图片资源
│   ├── app.js         // 小程序入口
│   ├── app.json       // 小程序配置
│   └── app.wxss       // 全局样式
└── README.md           // 项目说明
```

## 开发说明

### 环境准备
1. 安装微信开发者工具
2. 注册微信小程序账号
3. 开通云开发

### 本地开发
1. 克隆项目到本地
2. 使用微信开发者工具打开项目
3. 在project.config.json中替换为自己的appid
4. 在云开发控制台创建数据库集合：shops, users, user_favorites, shop_comments
5. 上传并部署云函数

### 数据库设计
#### shops集合字段说明：
- _id: 商家ID（自动生成）
- name: 商家名称
- logoUrl: 商家logo图片地址
- appId: 商家小程序appId
- category: 商家类别
- deliveryStart: 起送价
- description: 商家简介
- createTime: 创建时间
- updateTime: 更新时间

#### users集合字段说明：
- _id: 用户ID（自动生成）
- _openid: 用户openid（自动关联）
- nickName: 用户昵称
- avatarUrl: 用户头像
- gender: 性别
- country: 国家
- province: 省份
- city: 城市
- createTime: 创建时间
- updateTime: 更新时间

#### user_favorites集合字段说明：
- _id: 记录ID（自动生成）
- _openid: 用户openid（自动关联）
- shopId: 商家ID
- createTime: 收藏时间

#### shop_comments集合字段说明：
- _id: 评论ID（自动生成）
- _openid: 用户openid（自动关联）
- shopId: 商家ID
- content: 评论内容
- userInfo: 用户信息（包含nickName和avatarUrl）
- likeCount: 点赞数
- likeUsers: 点赞用户openid数组
- createTime: 评论时间

## 使用说明
1. 打开小程序，首页展示所有商家列表和热门评论
2. 可通过顶部分类标签筛选不同类别的商家
3. 可通过搜索框搜索商家名称
4. 点击商家卡片可直接跳转到对应的外卖小程序
5. 点击"查看详情"可进入商家详情页
6. 在商家详情页可收藏商家、查看和发表评论、点赞评论
7. 在"我的"页面可查看个人信息和收藏的商家

## 注意事项
1. 跳转其他小程序需要在小程序管理后台配置跳转白名单
2. 商家logo图片建议统一尺寸，推荐160*160
3. 请确保商家小程序的appId正确
4. 首次使用需要微信授权登录才能使用收藏、评论等功能

## 作者
丁宇涵

## 开源协议
MIT 