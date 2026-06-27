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
```

`ADMIN_SESSION_SECRET` 使用长随机字符串。没有 Supabase 环境变量时，应用会回退到本地 mock/localStorage，方便本地开发。

## 当前 MVP 约束

- 粉丝用昵称投稿，留言默认进入待审核。
- 管理员昵称为 `admin`，密码来自 `ADMIN_PASSWORD`。
- 图片仍是演示占位，不是真实上传。
- 地图使用省份高亮 + 城市点位；同城多场合并为一个城市点。

