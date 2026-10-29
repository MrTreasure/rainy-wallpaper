# 静间 · Rainy Wallpaper

一扇雨窗，一点自然声音，几张随手贴下的便利贴。

沉浸式白噪音壁纸桌面，支持高清 Unsplash 壁纸、实时雨玻璃折射、Markdown 便利贴和待办清单。前端使用 React + Vite，后端使用 Rust，便利贴等个人内容保存在浏览器本机；PostgreSQL 仅保存壁纸查询计数、公共图片缓存与管理配置。

## 在线体验

- **独立站：** [rain.mrtreasure.cc](https://rain.mrtreasure.cc/)
- **QMuse：** [在 QMuse 打开静间](https://render.qmuse.pub/p/muse/2988474587756506/)

独立站支持登录、注册，用于壁纸查询额度。**登录后也不会上传便利贴、收藏、壁纸历史或设置，不支持跨设备同步。** QMuse 版同样使用本地存储；需要登录增加查询额度时，可打开独立站。两个域名的本地内容互相独立。

## 功能

- **窗外降雨**：远、中、近三层连续落雨，带阵风、斜雨和缓慢变化的雨雾；雨势独立调节；底部总暂停、总音量及静音只影响声音，单独关闭声音面板的“雨声”开关才停止降雨与新增水珠，已有水珠保留。
- **雨窗与壁纸**：背景虚化独立调节；水珠折射、方向高光、流淌合并和擦拭；四种玻璃预设与展开细调；玻璃从干燥开始，雨滴逐颗出现并积累，支持将雨滴固定在玻璃上。
- **高清风景**：Unsplash 分类切换，涵盖森林、海边、江南雨巷、荒野等；筛选原生高清图片、优先原生 4K；收藏、取消收藏与原图下载。
- **自然声音**：浏览器 AudioWorklet 实时合成雨、风、雷、溪水和海浪，可独立调节、混音并自然随机变化；小雨、中雨、暴雨、台风四种预设联动声音与画面，支持雷声试听，无需下载音频。
- **拟物便利贴**：Markdown、可勾选任务、预设与自定义纸色、胶带和卷角；编辑时调整宽高；拖动顶部或胶带，允许左右部分超出屏幕，顶部可贴到屏幕顶边；一键按尺寸整理。
- **免登录使用**：IndexedDB 保存当前浏览器的便利贴、待办、收藏、最近 100 张壁纸历史及设置；登录 / 退出不改变这份本机桌面。
- **沉浸体验**：原生全屏、自动隐藏操作条、隐藏便利贴；页面隐藏时暂停雨动画，尊重减少动态效果设置。
- **管理能力**：后端包含应用开关、便利贴配额、声音策略、壁纸分类和屏蔽、查询次数统计与配置审计；不收集个人内容和本机存储占用，不提供正文查看接口；管理员权限由独立身份服务校验。

## 本机存储与隐私

- **仅存本机，不跨设备同步**：便利贴正文、标题、待办、收藏、换图历史及声音 / 雨窗设置不会发送给业务服务器，登录也不例外。
- **清除网站数据后不能自动恢复**：更换设备、浏览器、域名或使用无痕窗口，无法自动取得原来的内容。请在账号或保存面板定期导出 JSON 备份，并妥善保管。
- **登录只影响查询额度**：匿名设备每日 10 次，普通账号每日 50 次，按北京时间零点重置；同一账号在不同设备共用查询额度，但内容仍互不共享。
- 成功取得一张新壁纸计一次查询，即使图片尚未加载完成；失败查询释放额度。已完成的查询不会因之后取消图片加载而退还。重复使用本机历史或收藏不扣查询次数，但首次显示图片仍需要访问图片 CDN。
- 服务端只记录查询所需的账号 / 匿名设备 ID、日期、次数和失败计数；去重回执只含请求 ID、日期与状态，不保存查询主题或个人选图记录。公共 Unsplash 图片元数据缓存、应用策略和管理员配置审计独立于个人内容。
- 设备 ID 为随机登记标识，不使用硬件指纹；设备票据在服务器保存摘要。清除浏览器数据会丢失该标识，单纯设备额度不是防刷的绝对边界，另有来源与短时限流。
- 登录、注册仍由独立身份服务处理账号信息；图片请求及官方来源统计通过 Unsplash。若启用 Cloudflare Web Analytics，仅接入官方页面访问与性能指标，不发送便利贴、账号 / 设备 ID 或查询内容的自定义事件。
- 旧版账号内容同步接口返回 `410 LOCAL_STORAGE_ONLY`，不再接收或返回个人内容。此前已经存在于当前浏览器的账号缓存可在“本机保存”面板手动导入，不会请求远端数据。

## 绘制与性能

- 窗外雨线使用静态 GPU 顶点缓冲，位置在顶点着色器中计算；玻璃水滴高度图在 GPU 帧缓冲中生成并折射，不再每帧由 CPU 绘制整屏高度图并上传。
- 共用一个天气绘制时钟，普通设备最高 30 FPS，较弱设备最高 24 FPS；渲染缓冲按像素预算限制，不直接跟随高 DPR 无限放大。壁纸显示按视口请求清晰尺寸，下载仍保留原图。
- **标签页或窗口失去焦点即暂停动画**，包含切换标签、最小化和切换其他应用；恢复焦点后继续，不补算离开期间的帧。白噪音继续按播放开关运行。减少动态效果设置下保留静态画面。
- 无硬件 WebGL 时使用受限粒子和最高 15 FPS 的 Canvas 回退；静止玻璃不重复绘制。切换壁纸取消旧请求 / 图片加载，组件卸载释放 GPU 资源，输入与拖动合并本机写入。

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

身份服务不是本仓库的一部分。登录与查询额度校验需要实现 `backend/proto/c137/identity/v1/` 的 protobuf 契约，并提供应用范围会话、账号注册和独立管理员校验；身份服务不可用时，后端不会伪造账号或会话。前端的邮箱登录接口契约见 [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md)。

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
node scripts/prepare-pages.mjs
pnpm dlx wrangler pages deploy dist-pages --project-name c137-rainy-wallpaper --branch main
```

在 Pages 中绑定自己的域名，并在 API / 身份服务端添加该域名的精确 Origin。前端静态文件托管在 Pages，Rust 与 PostgreSQL 独立部署。发布前先执行 `node scripts/prepare-pages.mjs` 并发布 `dist-pages`，以保留安全头；页面分析需在确认发布时配置对应站点的公开 beacon token（`VITE_CF_ANALYTICS_TOKEN`），仅在独立站加载。需要 HTTPS 才能使用 AudioWorklet 等浏览器能力。

### QMuse

使用官方 React + Vite 导入方式，并选择外部后端模式：

```sh
qmuse import . --cloud-mode EXTERNAL --title "静间 · 白噪音与雨窗便利贴" --no-open
```

按 CLI 提示提供公开构建地址；不要上传服务端秘密。QMuse 公共预览域名使用本地模式，通过独立站完成登录以增加查询额度，避免依赖第三方 Cookie。发布更新时沿用 CLI 生成的本地应用绑定。

## 项目结构

```text
src/audio/                浏览器白噪音合成
src/components/desktop/  沉浸桌面、雨窗与设置
src/components/PaperNote.tsx
src/hooks/use-board.ts   仅本机保存、合并写入与旧缓存导入
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
