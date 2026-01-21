import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// 定义环境变量类型（可选，提升类型提示）
type ViteEnv = {
  VITE_DMXAPI_KEY?: string;
  VITE_APP_TITLE?: string;
  VITE_API_BASE_URL?: string;
};

export default defineConfig(({ mode }) => {
  // 加载环境变量（仅加载 VITE_ 前缀的变量，避免暴露敏感信息）
  const env = loadEnv<ViteEnv>(mode, process.cwd(), 'VITE_');

  return {
    // 项目基础配置
    base: '/', // 部署基础路径（默认 '/'，部署到子路径时需修改）
    root: process.cwd(), // 项目根目录

    // 服务器配置
    server: {
      port: 3000, // 默认端口（可通过环境变量覆盖）
      host: '0.0.0.0', // 允许局域网访问
      open: true, // 启动后自动打开浏览器（与 package.json 脚本配合）
      cors: true, // 允许跨域请求（适配 API 调用）
      strictPort: false, // 端口被占用时自动切换
      // 代理配置（可选，用于本地开发时转发 API 请求）
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL || 'https://www.dmxapi.cn',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },

    // 构建配置
    build: {
      outDir: 'dist', // 构建输出目录
      assetsDir: 'assets', // 静态资源目录
      sourcemap: mode === 'development', // 开发环境生成 sourcemap，生产环境不生成
      minify: mode === 'production' ? 'esbuild' : false, // 生产环境压缩代码
      chunkSizeWarningLimit: 1000, // chunk 大小警告阈值（KB）
      // 优化依赖打包
      rollupOptions: {
        output: {
          // 分割代码，提高缓存命中率
          manualChunks: {
            react: ['react', 'react-dom'],
            lucide: ['lucide-react'],
            docx: ['docx', 'mammoth'],
            supabase: ['@supabase/supabase-js'],
            clerk: ['@clerk/clerk-react'],
          },
        },
      },
    },

    // 插件配置
    plugins: [
      react({
        // 优化 React 插件
        jsxImportSource: 'react', // 明确 JSX 导入源（适配 React 19）
        babel: {
          // 可选：添加 Babel 插件（如装饰器支持）
          plugins: [
            ['@babel/plugin-proposal-decorators', { version: 'legacy' }],
          ],
        },
      }),
    ],

    // 环境变量注入（仅注入需要的变量，避免冗余）
    define: {
      'import.meta.env.VITE_DMXAPI_KEY': JSON.stringify(env.VITE_DMXAPI_KEY),
      'import.meta.env.VITE_APP_TITLE': JSON.stringify(env.VITE_APP_TITLE || 'ANIME ENGINE v3.8'),
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(env.VITE_API_BASE_URL),
      // 兼容旧代码（如果有的话），建议后续迁移到 import.meta.env
      'process.env': JSON.stringify({
        DMXAPI_KEY: env.VITE_DMXAPI_KEY,
        NODE_ENV: mode,
      }),
    },

    // 路径别名配置（适配 tsconfig.json 的 @/* 指向 src/）
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        // 可选：添加更多别名
        '@components': path.resolve(__dirname, 'src/components'),
        '@types': path.resolve(__dirname, 'src/types'),
        '@constants': path.resolve(__dirname, 'src/constants'),
      },
      // 支持的文件后缀（减少导入时的后缀书写）
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.svg', '.png'],
    },

    // CSS 配置
    css: {
      modules: {
        // CSS Modules 配置（如果使用）
        localsConvention: 'camelCaseOnly', // 类名转为小驼峰
      },
      preprocessorOptions: {
        // 可选：添加预处理器配置（如 SCSS）
        scss: {
          additionalData: '@import "@/styles/variables.scss";',
        },
      },
    },

    // 优化依赖预构建
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'lucide-react',
        'docx',
        'mammoth',
        '@clerk/clerk-react',
      ],
      exclude: ['@google/genai'], // 排除不需要预构建的依赖（如果已替换）
    },
  };
});
