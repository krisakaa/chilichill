# Cloudflare R2 留言图片上传配置

本项目使用 Cloudflare R2 保存粉丝留言图片。浏览器会先向 Next API 获取 R2 预签名上传地址，再把图片直接 PUT 到 R2；留言只保存图片公开 URL。

## 1. 创建 R2 Bucket

1. 登录 Cloudflare Dashboard。
2. 进入 `R2 Object Storage`。
3. 点击 `Create bucket`。
4. Bucket 名建议使用：`chilichill-diary`。
5. 创建后进入 bucket 详情。

## 2. 开启 r2.dev 公开访问

1. 在 bucket 详情页打开 `Settings`。
2. 找到 `Public access`。
3. 启用 `Allow Access` / `Public Development URL`。
4. 复制公开访问域名，形如：

```text
https://pub-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.r2.dev
```

这个值后面填到 Vercel 的 `R2_PUBLIC_BASE_URL`。

## 3. 创建 R2 API Token

1. 在 Cloudflare Dashboard 进入 `R2 Object Storage`。
2. 找到 `Manage R2 API Tokens`。
3. 点击 `Create API token`。
4. 权限选择 `Object Read & Write`。
5. Bucket 范围选择刚创建的 `chilichill-diary`。
6. 创建后保存：

```text
Access Key ID
Secret Access Key
Account ID
```

注意：`Secret Access Key` 只显示一次。

## 4. 配置 R2 CORS

在 bucket 的 `Settings` 中找到 `CORS policy`，添加：

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3003",
      "http://localhost:3000",
      "https://chilichill-web.vercel.app"
    ],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "ExposeHeaders": ["etag"],
    "MaxAgeSeconds": 3600
  }
]
```

如果以后绑定自定义域名，也把新域名加入 `AllowedOrigins`。

## 5. 配置 Vercel 环境变量

进入 Vercel 项目：`Settings -> Environment Variables`，添加：

```text
R2_ACCOUNT_ID=你的 Cloudflare Account ID
R2_ACCESS_KEY_ID=你的 R2 Access Key ID
R2_SECRET_ACCESS_KEY=你的 R2 Secret Access Key
R2_BUCKET=chilichill-diary
R2_PUBLIC_BASE_URL=https://pub-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.r2.dev
```

保存后重新部署 Vercel。

## 6. 更新 Supabase 数据表

在 Supabase SQL Editor 执行 `docs/supabase/schema.sql` 中的新增 `message_images` 相关 SQL，或直接执行下面这段：

```sql
create table if not exists public.message_images (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  url text not null,
  sort_order integer not null default 0 check (sort_order between 0 and 5),
  created_at timestamptz not null default now()
);

create index if not exists message_images_message_id_sort_idx
  on public.message_images (message_id, sort_order);

alter table public.message_images enable row level security;

drop policy if exists "Public published message image read" on public.message_images;
create policy "Public published message image read" on public.message_images for select using (
  exists (
    select 1 from public.messages
    where messages.id = message_images.message_id
      and messages.status = 'published'
  )
);
```

管理员接口使用 Supabase service role 写入 `message_images`，不需要公开 insert policy。

## 7. 本地测试

本地开发要在 `apps/web/.env.local` 添加同样的 R2 变量和 Supabase 变量。然后运行：

```powershell
pnpm --filter web dev
```

测试流程：

1. 登录普通用户。
2. 进入某个站点留言墙。
3. 点击 `+ WRITE`。
4. 选择 1-6 张 JPG/PNG/WebP/GIF 图片，每张不超过 10MB。
5. 发布留言。
6. 管理员后台通过该留言。
7. 回到留言墙确认图片显示，点击图片确认 lightbox 正常打开。

## 8. 常见问题

- `Missing R2_*`：Vercel 或本地 `.env.local` 缺少 R2 环境变量。
- `图片上传失败，请检查 R2 CORS 配置`：bucket CORS 没有允许当前站点 Origin，或 `AllowedHeaders` 没有包含 `content-type`。
- 留言能发布但图片不显示：检查 `R2_PUBLIC_BASE_URL` 是否是公开 r2.dev 域名，且 bucket 已开启公开访问。
- 图片上传成功但留言发布失败：R2 可能留下孤儿图片。v1 接受少量孤儿对象，后续可用 lifecycle 或清理脚本处理。