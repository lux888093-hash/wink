# 红酒扫码小程序 Demo

这是一个可直接继续开发的微信小程序原型，包含两部分：

- `miniprogram/`: 原生微信小程序前端，UI 按你当前目录里的 `phone`、`phone2`、`phone3` 三套参考稿做了“酒窖策展”风格重构。
- `server/`: 本地 Node/Express 示例服务，负责一次性二维码 token、扫码销毁、会话恢复，以及真实微信小程序码生成的接入点。

## 已实现

- 一次性扫码入口：二维码本身只承载 `scene`，真正的一次性校验在服务端完成。
- 红酒详情页：酒款介绍、风味结构、产区故事、技术参数。
- 音乐页：内置本地生成的 4 段氛围音乐，可直接播放。
- 酒窖页：延续第三张参考稿的收藏卡片式列表。
- 本地演示模式：没有真实微信 `appid/appsecret` 也能点按钮直接走完整流程。

## 目录

```text
docs/                       官方文档摘录与实现说明
miniprogram/                微信小程序源码
server/                     本地接口与一次性码服务
tools/                      本地生成演示音频的脚本
phone/ phone2/ phone3/      你的视觉参考稿
```

## 本地启动

### 1. 启动服务端

```powershell
cd D:\AI\hongjiu\server
npm install
npm run dev
```

默认监听 `http://127.0.0.1:3100`。

### 2. 打开微信开发者工具

1. 导入目录 `D:\AI\hongjiu\miniprogram`
2. 开发阶段建议先关闭“request 合法域名校验”
3. 直接打开 `pages/redeem/index`
4. 点页面里的“使用本地演示码”即可进入完整体验

## 接入真实微信二维码

在 `server/.env.example` 基础上新增 `.env`：

```env
PORT=3100
MINIPROGRAM_BASE_URL=http://127.0.0.1:3100
WECHAT_APPID=你的小程序AppID
WECHAT_APPSECRET=你的小程序AppSecret
WECHAT_ENV_VERSION=release
```

然后调用：

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:3100/api/admin/codes `
  -ContentType 'application/json' `
  -Body '{"wineId":"saint-emilion-2018"}'
```

服务端会：

1. 生成唯一 token
2. 以 token 作为 `scene`
3. 调用微信 `getwxacodeunlimit`
4. 把返回的小程序码图片落到 `server/public/qrcodes/`

## 注意

- 当前 `api/admin/*` 接口是为了本地演示，未做鉴权，正式上线前必须加后台权限控制。
- 小程序前端默认指向 `http://127.0.0.1:3100`，上线前要替换为你自己的 HTTPS 域名。
- 真实生产里建议把一次性码和会话放进数据库，不要继续用 JSON 文件存储。

