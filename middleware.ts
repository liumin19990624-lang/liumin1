
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// 定义公开路由（不需要登录即可访问）
const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)', '/api/public(.*)']);

export default clerkMiddleware((auth, request) => {
  if (!isPublicRoute(request)) {
    auth().protect(); // 强制跳转至登录页
  }
});

export const config = {
  matcher: [
    // 拦截除了静态资源和 Next.js 内部文件外的所有路由
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // 始终拦截 API 和 TRPC 路由
    '/(api|trpc)(.*)',
  ],
};
