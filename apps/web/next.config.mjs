/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@chili/shared', '@chili/db', '@chili/ui', '@chili/scene'],
  images: {
    unoptimized: true, // 原型用外部 picsum，且像素化图片是 dataURL
  },
};

export default nextConfig;
