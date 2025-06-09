// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()  
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
    const { action, data } = event

    switch (action) {
        case 'add':
            return await addShop(data)
        case 'update':
            return await updateShop(data)
        case 'delete':
            return await deleteShop(data)
        case 'get':
            return await getShop(data)
        case 'list':
            return await listShops(data)
        default:
            return {
                code: -1,
                msg: '未知操作'
            }
    }
}

// 添加商家
async function addShop(data) {
    try {
        const result = await db.collection('shops').add({
            data: {
                ...data,
                createTime: db.serverDate(),
                updateTime: db.serverDate()
            }
        })
        return {
            code: 0,
            msg: '添加成功',
            data: result
        }
    } catch (err) {
        return {
            code: -1,
            msg: '添加失败',
            error: err
        }
    }
}

// 更新商家
async function updateShop(data) {
    const { _id, ...updateData } = data
    try {
        const result = await db.collection('shops').doc(_id).update({
            data: {
                ...updateData,
                updateTime: db.serverDate()
            }
        })
        return {
            code: 0,
            msg: '更新成功',
            data: result
        }
    } catch (err) {
        return {
            code: -1,
            msg: '更新失败',
            error: err
        }
    }
}

// 删除商家
async function deleteShop(data) {
    try {
        const result = await db.collection('shops').doc(data._id).remove()
        return {
            code: 0,
            msg: '删除成功',
            data: result
        }
    } catch (err) {
        return {
            code: -1,
            msg: '删除失败',
            error: err
        }
    }
}

// 获取单个商家
async function getShop(data) {
    try {
        const result = await db.collection('shops').doc(data._id).get()
        return {
            code: 0,
            msg: '获取成功',
            data: result.data
        }
    } catch (err) {
        return {
            code: -1,
            msg: '获取失败',
            error: err
        }
    }
}

// 获取商家列表
async function listShops(data) {
    const { pageNum = 1, pageSize = 20, category, keyword } = data
    const skip = (pageNum - 1) * pageSize

    try {
        let query = {}

        // 分类筛选
        if (category && category !== '全部') {
            query.category = category
        }

        // 关键词搜索
        if (keyword) {
            query.name = db.RegExp({
                regexp: keyword,
                options: 'i'
            })
        }

        const countResult = await db.collection('shops').where(query).count()
        const total = countResult.total

        const listResult = await db.collection('shops')
            .where(query)
            .skip(skip)
            .limit(pageSize)
            .orderBy('createTime', 'desc')
            .get()

        return {
            code: 0,
            msg: '获取成功',
            data: {
                list: listResult.data,
                total,
                pageNum,
                pageSize
            }
        }
    } catch (err) {
        return {
            code: -1,
            msg: '获取失败',
            error: err
        }
    }
} 