# 自建身份与部署边界

本仓库提供完整前端、Rust 业务 API、PostgreSQL 表结构和身份 gRPC 客户端。官方站点的身份、邮件与管理员系统独立运行，不随业务仓库分发。

## 浏览器身份接口

`VITE_IDENTITY_BASE_URL` 指向身份服务的公开 HTTPS 路径：

- `POST /email/login`：JSON `{email,password,applicationId:"rainy-wallpaper"}`；成功返回 `{user}`，并设置 HttpOnly / Secure 会话 Cookie。
- `DELETE /session`：清除并撤销当前应用会话。
- 用户字段采用 camelCase：`id`、`email`、`displayName`、`avatarUrl`、`isSuperAdmin`。

浏览器请求携带凭据，服务端必须精确允许自己的 Origin。自建实例应将前端、业务 API 与身份 API 放在同站点域名下，或通过受控 HTTPS 网关实现同源访问。不要为共享预览域名开放私人笔记的凭据跨域权限。

## Rust 与身份服务

内部仅使用原生 gRPC / HTTP2，数据结构见 `backend/proto`：

- `IdentityService.ValidateSession`：应用或独立管理员会话的新鲜校验，含应用成员资格与封禁。
- `RegistrationService.RequestEmailCode` / `RegisterEmail`：应用范围邮箱验证码和注册。
- `authorization` metadata 使用每个调用方独立的服务凭据；会话校验 deadline 为 3 秒，注册为 25 秒；复用连接。

管理员接口还要求独立的管理员会话与来源域名，不能通过浏览器字段声明自己为管理员。官方管理页面目前面向 Orbit，若部署自己的管理平台，应同步调整精确管理员域名、会话名与前端路由。

当前应用 ID 为 `rainy-wallpaper`。官方注册响应 Cookie 作用域为 `.mrtreasure.cc`，独立管理员域名为 `orbit.mrtreasure.cc`；自建注册/管理服务必须修改 `backend/src/registration.rs` 和 `backend/src/main.rs` 中相应值，并让自己的身份服务使用一致设置。修改后重新构建后端。

## PostgreSQL 与密钥

为应用创建独立数据库与非超级用户角色，授予表结构初始化所需权限，使用专用私网连接。SQL 结构在 `backend/schema.sql`，版本冲突返回 409，不会静默覆盖多设备修改。

Unsplash Key、数据库密码和 gRPC 凭据只放在服务端。前端公开配置只含 HTTPS 地址。无需为本机便利贴与白噪音配置任何账号或密钥。
