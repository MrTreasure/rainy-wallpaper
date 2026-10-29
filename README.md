# 静间 · Rainy Wallpaper

一扇雨窗，一点自然声音，几张随手贴下的便利贴。

沉浸式白噪音壁纸桌面，支持高清 Unsplash 壁纸、实时雨玻璃折射、Markdown 便利贴和待办清单。前端使用 React + Vite，后端使用 Rust，数据存储使用 PostgreSQL。

## 在线体验

- **独立站：** [rain.mrtreasure.cc](https://rain.mrtreasure.cc/)
- **QMuse：** [在 QMuse 打开静间](https://render.qmuse.pub/p/muse/2988474587756506/)

独立站支持登录、注册与远端同步。QMuse 版支持本地便利贴、壁纸和声音；需要账号同步时，从账号面板打开独立站。两个域名的浏览器本地存储互相独立，不会自动合并。

## 功能

- **雨窗与壁纸**：背景虚化独立调节；水珠折射、方向高光、流淌合并和擦拭；四种预设与展开细调；支持将雨滴固定在玻璃上。
- **高清风景**：Unsplash 分类切换，涵盖森林、海边、江南雨巷、荒野等；筛选原生高清图片、优先原生 4K；收藏、取消收藏与原图下载。
- **自然声音**：浏览器 AudioWorklet 实时合成雨、风、雷、溪水和海浪，可独立调节、混音并自然随机变化，无需下载音频。
- **拟物便利贴**：Markdown、可勾选任务、预设与自定义纸色、胶带和卷角；编辑时调整宽高；拖动顶部或胶带，允许左右部分超出屏幕；一键按尺寸整理。
- **免登录使用**：IndexedDB 持久保存本机内容；登录后同步，账号之间独立缓存，冲突由用户选择保留版本。
- **沉浸体验**：原生全屏、自动隐藏操作条、隐藏便利贴；页面隐藏时暂停雨动画，尊重减少动态效果设置。
- **管理能力**：后端包含应用开关、便利贴配额、声音策略、壁纸分类和屏蔽、统计与审计接口；管理员权限由独立身份服务校验。

快捷键：`空格` 播放 / 暂停，`N` 新建便利贴，`F` 全屏，`H` 隐藏 / 显示便利贴。背景按住拖动可擦拭玻璃。

## 本地运行

需要 Node.js 22+ 与项目声明的 pnpm 版本。

```sh
git clone https://github.com/MrTreasure/rainy-wallpaper.git
cd rainy-wallpaper
pnpm install --frozen-lockfile
pnpm dev
```

纯前端也可以使用本地便利贴与合成声音。代码中的默认公开 API 地址用于官方站点；自建部署请设置自己的公开端点：

```sh
VITE_API_BASE_URL=https://api.example.com/v1/rainy-wallpaper \
VITE_IDENTITY_BASE_URL=https://api.example.com/v1/auth \
VITE_CANONICAL_SITE=https://rain.example.com/ \
pnpm run build:site
```

这些 `VITE_` 值会公开在浏览器中，只能包含公开地址，不能放密码、Token 或 Unsplash 密钥。

## 自建后端

```sh
cargo build --release --locked --manifest-path backend/Cargo.toml
# 配置下列服务端环境变量后运行：
./backend/target/release/rainy-wallpaper
```

| 变量 | 用途 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 连接串；需要专用数据库与业务账号 |
| `IDENTITY_RPC_URL` | 私有身份服务 gRPC 地址，默认 `http://c137-identity-rpc:50051` |
| `IDENTITY_RPC_TOKEN` | 独立服务调用凭据，仅留在服务端 |
| `UNSPLASH_ACCESS_KEY` | 服务端 Unsplash API Key；未配置则无法获取新壁纸 |
| `PUBLIC_ORIGINS` | 额外受信任的前端 Origin，逗号分隔；填写自己的 HTTPS 站点 |

服务监听 `8080`，`/healthz` 检查 PostgreSQL 就绪状态。启动时执行幂等表结构初始化。生产环境通过 HTTPS 反向代理，只对公网开放必要的浏览器 API，数据库和 gRPC 保留在私有网络。

身份服务不是本仓库的一部分。远端登录同步需要实现 `backend/proto/c137/identity/v1/` 的 protobuf 契约，并提供应用范围会话、账号注册和独立管理员校验；身份服务不可用时，后端不会伪造账号或会话。前端的邮箱登录接口契约见 [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md)。

源码构建容器：

```sh
docker build -f backend/Dockerfile.source -t rainy-wallpaper-api .
```

服务端秘密通过部署平台注入。不要提交环境文件、数据库备份、会话或平台绑定。

## 部署前端

### Cloudflare Pages

```sh
pnpm run check
pnpm run build:site
pnpm dlx wrangler pages deploy dist --project-name c137-rainy-wallpaper --branch main
```

在 Pages 中绑定自己的域名，并在 API / 身份服务端添加该域名的精确 Origin。前端静态文件托管在 Pages，Rust 与 PostgreSQL 独立部署。需要 HTTPS 才能使用 AudioWorklet 等浏览器能力。

### QMuse

使用官方 React + Vite 导入方式，并选择外部后端模式：

```sh
qmuse import . --cloud-mode EXTERNAL --title "静间 · 白噪音与雨窗便利贴" --no-open
```

按 CLI 提示提供公开构建地址；不要上传服务端秘密。QMuse 公共预览域名使用本地模式，通过独立站完成登录和同步，避免依赖第三方 Cookie。发布更新时沿用 CLI 生成的本地应用绑定。

## 项目结构

```text
src/audio/                浏览器白噪音合成
src/components/desktop/  沉浸桌面、雨窗与设置
src/components/PaperNote.tsx
src/hooks/use-board.ts   本地保存、登录后同步与冲突处理
backend/src/             Rust API
backend/proto/           gRPC / protobuf 接口快照
contracts/manifest.json  接口版本摘要
scripts/check-contracts.mjs
```

## 检查

```sh
pnpm run check
pnpm run build
cargo check --locked --manifest-path backend/Cargo.toml
```

接口摘要检查可在独立克隆中执行；若处于包含统一契约仓库的工作区，还会运行该工作区的全局一致性检查。

## 说明与许可

- 图片使用 Unsplash 官方热链，保留摄影师署名及下载统计；默认关闭自动轮换。自建实例需遵守 Unsplash API 的适用范围与使用条款。
- 各站点的 IndexedDB 数据按浏览器 Origin 隔离；可从账号面板导出本机 JSON 备份。
- 页面保留“本应用通过QMuseVibeCoding平台搭建”署名与邀请链接。
- [MIT License](LICENSE)。
