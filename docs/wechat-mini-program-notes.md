# 微信小程序实现要点

整理日期：2026-04-08

## 1. 一次性二维码的实现方式

微信官方提供的是“小程序码生成能力”，不是“扫码即失效能力”。因此一次性逻辑需要自己在服务端完成：

1. 服务端先生成唯一 token
2. 用 token 作为 `scene`
3. 通过 `getwxacodeunlimit` 生成小程序码
4. 用户扫码进入后，小程序拿到 `query.scene`
5. 服务端首次校验成功后把该 token 标记为 `used`

这次 Demo 采用的就是这个方案。

## 2. 官方文档里这次实现用到的关键约束

### 获取不限制的小程序码

官方文档：
https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/qrcode-link/qr-code/api_getunlimitedqrcode.html

关键点：

- `scene` 最大 32 个可见字符
- `page` 不能带参数，参数应放到 `scene`
- `check_path` 默认是 `true`
- `scene` 会作为 query 参数传给小程序页面
- 文档示例明确提示要对 `query.scene` 做 `decodeURIComponent`
- 文档还提到接口调用频率受限，适合大批量业务时建议预生成

### 获取启动参数

官方文档：
https://developers.weixin.qq.com/miniprogram/dev/api/base/app/life-cycle/wx.getLaunchOptionsSync.html

关键点：

- 小程序启动参数里包含 `path`、`scene`、`query`
- `query` 可以拿到扫码带入的参数

### 音频播放

官方文档：
https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/wx.createInnerAudioContext.html

关键点：

- 使用 `wx.createInnerAudioContext()` 创建播放器
- 不再使用时要调用 `destroy()` 释放资源
- 长音频不建议盲目开启 `useWebAudioImplement`

## 3. 对当前项目的直接影响

- 二维码页面固定为 `pages/redeem/index`
- 一次性 token 放在 `scene`
- 小程序页面用 `decodeURIComponent(query.scene)` 读取
- 首次消费后不再依赖二维码，而是切换到服务端下发的 session
- 音乐资源使用本地 wav 文件，避免网络白名单阻碍本地演示

