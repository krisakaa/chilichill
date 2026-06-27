# ChiliChill MVP 部署说明

## Supabase

1. 在 Supabase SQL editor 执行 `docs/supabase/schema.sql`。
2. 将现有种子站点/留言导入 `stations` 和 `messages` 表。
3. RLS 已允许公开读取站点、公开读取 published 留言、公开插入 pending 留言。
4. 管理员增删改通过 Next API 使用 service role key，不暴露给浏览器。

## Vercel 环境变量

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_PASSWORD=
ADMIN_SESSION_SECRET=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_BASE_URL=
```

`ADMIN_SESSION_SECRET` 使用长随机字符串。没有 Supabase 环境变量时，应用会回退到本地 mock/localStorage，方便本地开发。

## 当前 MVP 约束

- 粉丝用昵称投稿，留言默认进入待审核。
- 管理员昵称为 `admin`，密码来自 `ADMIN_PASSWORD`。
- 留言图片使用 Cloudflare R2 上传；配置步骤见 `docs/R2_UPLOAD_SETUP.md`。
- 地图使用省份高亮 + 城市点位；同城多场合并为一个城市点。

