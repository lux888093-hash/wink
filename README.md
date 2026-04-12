# 红酒扫码小程序演示版

这是一个本地可跑通的完整演示项目，围绕需求文档里的三条主线实现：

- `扫码专属体验`: 礼盒二维码首扫进入酒庄、酒款与配乐专属页。
- `公共商城交易`: 首页、商城、商品详情、购物袋、下单、微信支付预下单与开发态 mock 支付。
- `会员与后台`: 会员开通、单曲解锁、下载签名、运营后台与码池管理。

当前已经切到 `Express + 原生小程序 + PostgreSQL 兼容存储层` 的可落地架构：

- 默认使用内置的 `embedded-postgres-compatible` 存储层运行，不依赖本机额外安装数据库。
- 配置 `DATABASE_URL` 或 `PGHOST / PGDATABASE / PGUSER` 后，会自动切到真实 `PostgreSQL` 快照持久化。
- 运行时数据会持久化到 `server/data/db-snapshot.json`。
- 仓库里保留 `server/data/store.json` 作为历史兼容种子，但服务启动后不再直接把它当运行时存储。

## 目录

```text
doc/                        项目需求与说明文档
docs/                       调研资料与笔记
miniprogram/                微信小程序前端
server/                     本地接口、数据存储、后台静态页
server/db/                  PostgreSQL 兼容表结构
tools/                      演示资源生成脚本
phone/ phone2/ phone3/      视觉参考稿
```

## 已实现范围

### 小程序前台

- 公共首页 `pages/home/index`
- 商城列表 `pages/store/index`
- 商品详情 `pages/product-detail/index`
- 购物袋 `pages/cart/index`
- 订单确认与微信支付/开发态 mock 支付 `pages/order-confirm/index`
- 会员中心 `pages/member/index`
- 扫码入口 `pages/redeem/index`
- 专属酒庄页 `pages/cellar/index`
- 酒款详情 `pages/detail/index`
- 配乐页 `pages/melody/index`

### 服务端接口

- 扫码消费、会话恢复、酒款体验
- 商城首页、商品列表、商品详情
- 购物袋、订单创建、订单支付
- 微信登录、当前用户态恢复
- 微信支付 JSAPI 下单、支付状态查询、支付回调验签与解密
- 会员开通、单曲解锁、下载签名、下载文件
- 后台登录、看板、酒款、码池、商品、订单、会员、审计列表
- 后台新增、编辑、归档/删除酒款与商品
- 后台新增 SKU、修改订单状态、修改码状态、人工发放会员
- 后台登出、密码修改、健康检查与安全告警

### 商用级基础加固

- 管理员密码已切到 `scrypt` 强哈希，兼容旧快照中的历史哈希并自动升级
- 管理员 session 只存 token 摘要，不再把原始 token 持久化
- 后台写接口增加基础限流，登录接口单独限流
- 服务端增加请求 ID、安全响应头、CORS 白名单和请求体大小限制
- 小程序用户态改为 `Bearer Token`，支持微信 `code2Session` 登录和开发态降级登录
- 订单创建和微信支付预下单都增加了幂等键，重复请求不会重复开单
- 微信支付回调增加 RSA 验签、时间窗校验与 `AEAD_AES_256_GCM` 解密
- `admin/dev/reset` 与单码生成接口已经收口到后台鉴权之内
- `/api/health` 会返回当前环境、持久化模式和运行告警，方便部署巡检

### 后台管理页

- 入口: `http://127.0.0.1:3100/admin/`
- 登录后可查看:
  - 项目概览
  - 酒款内容配置
  - 二维码批次生成
  - 商品与 SKU 价格库存
  - 订单列表
  - 会员与下载权益
  - 操作审计

## 本地启动

### 1. 启动服务端

```powershell
cd D:\AI\hongjiu\server
npm install
npm run dev
```

默认地址:

- API: `http://127.0.0.1:3100/api`
- 后台: `http://127.0.0.1:3100/admin/`
- 健康检查: `http://127.0.0.1:3100/api/health`

### 2. 打开微信开发者工具

1. 导入目录 `D:\AI\hongjiu\miniprogram`
2. 开发阶段建议关闭“request 合法域名校验”
3. 首页默认是 `pages/home/index`
4. 需要走扫码链路时，打开 `pages/redeem/index`

### 3. 需要真实 PostgreSQL / 微信能力时补齐环境变量

- 数据库:
  - `DATABASE_URL`
  - 或 `PGHOST / PGPORT / PGDATABASE / PGUSER / PGPASSWORD / PGSSL`
- 小程序登录:
  - `MINIAPP_SESSION_SECRET`
  - `WECHAT_APPID`
  - `WECHAT_APPSECRET`
- 微信支付:
  - `WECHATPAY_MCHID`
  - `WECHATPAY_MCH_SERIAL_NO`
  - `WECHATPAY_PRIVATE_KEY_PATH`
  - `WECHATPAY_NOTIFY_URL`
  - `WECHATPAY_API_V3_KEY`
  - `WECHATPAY_PLATFORM_PUBLIC_KEY_PATH` 或 `WECHATPAY_PLATFORM_CERT_PATH`

## 后台登录账号

```text
username: curator
password: Curator!2026
```

## 本地演示链路

### 扫码体验

1. 打开小程序 `pages/redeem/index`
2. 点击“生成演示首扫码”
3. 首扫成功后进入专属酒庄页

### 商城下单

1. 进入首页或商城页
2. 选择礼盒加入购物袋
3. 在订单页点击支付
4. 开发环境未配置微信支付时会自动降级为 `mock`
5. 生产环境配置完整证书后会走真实微信支付

### 会员与下载

1. 打开会员中心
2. 选择会员套餐开通，或单独解锁曲目
3. 成功后可播放、签名下载音频

## 数据与接口说明

- 运行时数据快照: `server/data/db-snapshot.json`
- 首次启动会从 `server/data/store.json` 或默认种子迁移到 PostgreSQL 兼容仓库
- 环境变量模板: `server/.env.example`
- 小程序登录接口:

```text
POST /api/auth/wechat/login
GET  /api/auth/me
```

- 微信支付接口:

```text
POST /api/payments/orders/:orderId/jsapi
GET  /api/payments/orders/:orderId/status
POST /api/payments/wechat/callback
```
- 重置数据:

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:3100/api/admin/dev/reset `
  -Headers @{ 'x-admin-token' = '你的后台 token' }
```

- 生成单个扫码码:

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:3100/api/admin/codes `
  -Headers @{ 'x-admin-token' = '你的后台 token' } `
  -ContentType 'application/json' `
  -Body '{"wineId":"soundless-a-quiet-world-2022"}'
```

- 生成批次码:

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:3100/api/admin/code-batches `
  -Headers @{ 'x-admin-token' = '你的后台 token' } `
  -ContentType 'application/json' `
  -Body '{"wineId":"soundless-a-quiet-world-2022","quantity":12}'
```

- 修改后台密码:

```powershell
Invoke-RestMethod -Method Put `
  -Uri http://127.0.0.1:3100/api/admin/account/password `
  -Headers @{ 'x-admin-token' = '你的后台 token' } `
  -ContentType 'application/json' `
  -Body '{"currentPassword":"Curator!2026","nextPassword":"VaultPass!2048"}'
```

- 健康检查会返回当前安全告警:

```powershell
Invoke-RestMethod http://127.0.0.1:3100/api/health
```

## 当前边界

- 当前环境默认仍按演示模式启动:
  - 未配置 `WECHAT_APPID / WECHAT_APPSECRET` 时，登录自动降级为开发态 demo 用户
  - 未配置完整微信支付证书时，支付自动降级为 `mock`
  - 未配置 PostgreSQL 时，持久化自动落到内置 `embedded-postgres-compatible`
- 下载链路是签名 URL 演示版，没有对象存储和 CDN。
- 如果正式商用，建议继续升级:
  - `Redis`
  - `对象存储 + CDN`
  - `细粒度 RBAC + 审计检索 + 风控策略`
  - `发货系统 / ERP / 库存中心对接`
  - `监控告警、备份恢复、发布回滚和自动化测试`

## 官方参考

- 微信支付 JSAPI/小程序下单: https://pay.wechatpay.cn/doc/v3/merchant/4012791897
- 小程序调起支付参数: https://pay.wechatpay.cn/doc/v3/merchant/4012791898
- 微信支付签名说明: https://pay.wechatpay.cn/doc/v3/merchant/4012365341
- 支付回调处理: https://pay.wechatpay.cn/doc/v3/merchant/4013070368
