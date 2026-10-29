# 自建身份与部署边界

本仓库提供完整前端、Rust 业务 API、PostgreSQL 表结构和身份 gRPC 客户端。官方站点的身份、邮件与管理员系统独立运行，不随业务仓库分发。

## 浏览器身份接口

`VITE_IDENTITY_BASE_URL` 指向身份服务的公开 HTTPS 路径：

- `POST /email/login`：JSON `{email,password,applicationId:"rainy-wallpaper"}`；成功返回 `{user}`，并设置 HttpOnly / Secure 会话 Cookie。
- `DELETE /session`：清除并撤销当前应用会话。
- 用户字段采用 camelCase：`id`、`email`、`displayName`、`avatarUrl`、`isSuperAdmin`。

浏览器请求携带凭据，服务端必须精确允许自己的 Origin。自建实例应将前端、业务 API 与身份 API 放在同站点域名下，或通过受控 HTTPS 网关实现同源访问。共享预览域名不开放账号凭据跨域权限；便利贴、收藏和设置没有远端读写接口。

## Rust 与身份服务

内部仅使用原生 gRPC / HTTP2，数据结构见 `backend/proto`：

- `IdentityService.ValidateSession`：应用或独立管理员会话的新鲜校验，含应用成员资格与封禁。
- `RegistrationService.RequestEmailCode` / `RegisterEmail`：应用范围邮箱验证码和注册。
- `authorization` metadata 使用每个调用方独立的服务凭据；会话校验 deadline 为 3 秒，注册为 25 秒；复用连接。

管理员接口还要求独立的管理员会话与来源域名，不能通过浏览器字段声明自己为管理员。官方管理页面目前面向 Orbit，若部署自己的管理平台，应同步调整精确管理员域名、会话名与前端路由。

当前应用 ID 为 `rainy-wallpaper`。官方注册响应 Cookie 作用域为 `.mrtreasure.cc`，独立管理员域名为 `orbit.mrtreasure.cc`；自建注册/管理服务必须修改 `backend/src/registration.rs` 和 `backend/src/main.rs` 中相应值，并让自己的身份服务使用一致设置。修改后重新构建后端。

## PostgreSQL 与密钥

为应用创建独立数据库与非超级用户角色，授予表结构初始化所需权限，使用专用私网连接。SQL 结构在 `backend/schema.sql`，仅包含公共壁纸缓存、账号 / 匿名设备每日查询计数、去重回执、设备票据摘要、管理配置和配置审计。便利贴、收藏、历史和桌面设置只存在于浏览器 IndexedDB，不跨设备同步。旧版内容接口全部返回 410，旧客户端也不能继续上传。配置版本冲突仍返回 409。

Unsplash Key、数据库密码和 gRPC 凭据只放在服务端。前端公开配置只含 HTTPS 地址。无需为本机便利贴与白噪音配置任何账号或密钥。

## 查询额度与统计

- `POST /device` 登记随机设备并返回设备票据。前端保存于当前浏览器，服务端仅保存 SHA-256 摘要。
- `/quota` 与 `/wallpapers` 携带 `X-Device-Id`、`X-Device-Ticket`；查询额外携带 UUID `X-Request-Id`。登录用户由真实身份会话校验，不能通过这些头声明账号或权限。
- 匿名设备每日 10 次，普通账号每日 50 次，超级管理员不受每日额度限制；该规则只在服务端执行，公开登录文案仅展示匿名与普通额度。
- 每日额度按 `Asia/Shanghai` 计算，PostgreSQL 事务锁保证并发安全；查询失败释放预占，重复请求 ID 不重复扣费；中断未结算回执在该主体下次查询时回收，无额外定时任务。
- 服务器缓存命中也计一次成功查询；本机历史和收藏重用不调用查询接口、不扣额度。浏览器取消已完成查询不会退还该次额度。
- 管理台仅展示查询总数、每日查询与账号 / 设备计数，不显示便利贴、收藏、用户选图轨迹或本机存储占用。
- `X-Real-IP` 必须由可信入口覆盖，不能直接信任公网客户端提供的值。设备登记和下载另有短时限流；业务 API 不应绕过入口公开。

## 页面分析与本机数据

可选 `VITE_CF_ANALYTICS_TOKEN` 是 Cloudflare Web Analytics 的公开站点 beacon 标识，不是 Cloudflare API token。仅在 `https://rain.mrtreasure.cc` 加载官方脚本，并去重；自建站点需要修改相应精确 Origin。不要向页面分析发送个人内容或账号标识。此接入不自动创建 Cloudflare 站点或修改平台配置。

业务服务器没有个人内容的恢复副本。清除网站数据或更换设备后不能自动恢复，请提示用户主动导出备份。已有部署升级时，先核查旧版远端表是否存在真实内容并安排导出；本次源码不会自动删除旧表数据。
