import { clerkMiddleware, createRouteMatcher, ClerkMiddlewareOptions } from "@clerk/nextjs/server";

// 1. 定义路由匹配规则（精准控制访问权限）
// 公开路由：无需登录即可访问的核心功能页面
const isPublicRoute = createRouteMatcher([
  '/', // 首页（应用入口）
  '/sign-in(.*)', // 登录页
  '/sign-up(.*)', // 注册页
  '/sign-in/error(.*)', // 登录错误页
  '/api/public(.*)', // 公开 API 接口
]);

// 受保护路由：必须登录才能访问的增强功能
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)', // 个人仪表盘（如多设备同步、云存储）
  '/api/pro(.*)', // 付费/增强功能 API
  '/settings(.*)', // 账户设置
  '/backup(.*)', // 数据备份/恢复
]);

// 2. 中间件配置（优化性能与兼容性）
const middlewareOptions: ClerkMiddlewareOptions = {
  // 忽略静态资源，提升加载速度
  ignoredRoutes: [
    '/icons(.*)', // 图标资源
    '/favicon.ico', // 网站图标
    '/robots.txt', // 搜索引擎协议
    '/sitemap.xml', // 站点地图
  ],
};

// 3. 核心中间件逻辑
export default clerkMiddleware(
  (auth, request) => {
    const { userId } = auth();

    // 规则1：受保护路由强制登录（未登录跳转至登录页）
    if (isProtectedRoute(request) && !userId) {
      auth().protect();
    }

    // 规则2：已登录用户访问登录/注册页，自动重定向至首页
    if (userId && (request.nextUrl.pathname.startsWith('/sign-in') || request.nextUrl.pathname.startsWith('/sign-up'))) {
      return Response.redirect(new URL('/', request.url));
    }

    // 规则3：公开路由直接放行（保障核心功能无需登录即可使用）
    if (isPublicRoute(request)) {
      return;
    }

    // 兜底规则：未匹配到的路由默认放行（避免误拦截）
  },
  middlewareOptions
);

// 4. 路由匹配配置（精准拦截，排除不必要资源）
export const config = {
  matcher: [
    // 拦截所有非静态资源、非 Next.js 内部文件的路由
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|pdf)).*)',
    // 强制拦截 API 和 TRPC 路由（保障接口安全）
    '/(api|trpc)(.*)',
  ],
};
