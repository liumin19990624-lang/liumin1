'use client'

import React, { useState, useEffect, useCallback } from 'react';
import { UserButton, useAuth } from '@clerk/nextjs';
import { AppStage, KBFile } from '../types.ts';
import { ICONS } from '../constants.tsx';
import KBManager from '../components/KBManager.tsx';
import Workspace from '../components/Workspace.tsx';
import { supabase, supabaseHelpers, isSupabaseAvailable } from '../lib/supabase.ts';
import LoadingScreen from '../components/LoadingScreen.tsx';
import { toast } from '../components/ui/toaster.ts'; // 导入 Toast 组件
import { Button } from '../components/ui/button.tsx'; // 导入按钮组件（可选）

// 定义 API 端点常量（便于维护）
const API_ENDPOINTS = {
  KB: '/api/kb',
};

export default function Home() {
  const { userId, isLoaded: isAuthLoaded } = useAuth();
  const [stage, setStage] = useState<AppStage>(AppStage.KB_MANAGEMENT);
  const [files, setFiles] = useState<KBFile[]>([]);
  const [credits, setCredits] = useState<number>(100); // 默认 100 积分，避免 null 处理
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 提取知识库文件（优化错误处理和加载状态）
  const fetchKBFiles = useCallback(async () => {
    if (!userId) return [];

    try {
      const kbRes = await fetch(API_ENDPOINTS.KB, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!kbRes.ok) {
        throw new Error(`知识库加载失败：${kbRes.statusText}`);
      }

      const data = await kbRes.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error("知识库加载错误:", err);
      toast.error("知识库加载失败，请刷新页面重试");
      return [];
    }
  }, [userId]);

  // 提取用户积分（优化 Supabase 交互和错误处理）
  const fetchUserCredits = useCallback(async () => {
    if (!userId || !isSupabaseAvailable) return 100;

    try {
      let { data: profile, error } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', userId)
        .single();

      // 未找到用户档案时创建默认档案（100 积分）
      if (error) {
        if (error.code === 'PGRST116') {
          const { data: newProfile } = await supabase
            .from('profiles')
            .insert({ id: userId, credits: 100, created_at: new Date().toISOString() })
            .select()
            .single();
          toast.success("首次登录，赠送 100 创作积分");
          return newProfile?.credits || 100;
        } else {
          throw error;
        }
      }

      return profile?.credits || 100;
    } catch (err) {
      console.error("积分加载错误:", err);
      toast.error("积分加载失败，将使用默认积分");
      return 100;
    }
  }, [userId]);

  // 初始化加载数据（优化依赖管理和错误处理）
  useEffect(() => {
    const initData = async () => {
      if (!isAuthLoaded) return;

      setIsLoading(true);
      setError(null);

      try {
        // 并行加载知识库和积分（提升性能）
        const [kbFiles, userCredits] = await Promise.all([
          fetchKBFiles(),
          fetchUserCredits(),
        ]);

        setFiles(kbFiles);
        setCredits(userCredits);
      } catch (err) {
        console.error("初始化数据加载错误:", err);
        setError("数据加载失败，请刷新页面重试");
        toast.error("初始化失败，请刷新页面");
      } finally {
        setIsLoading(false);
      }
    };

    initData();
  }, [isAuthLoaded, userId, fetchKBFiles, fetchUserCredits]);

  // 监听积分变化（优化实时订阅）
  useEffect(() => {
    if (!userId || !isSupabaseAvailable) return;

    // 创建实时订阅通道
    const channel = supabase.channel(`profile_${userId}`, {
      config: {
        retry: {
          maxRetries: 5,
          delay: 1000,
        },
      },
    })
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          const newCredits = payload.new.credits as number;
          setCredits(newCredits);

          // 积分过低时给出提示
          if (newCredits < 10 && newCredits > 0) {
            toast.warning(`积分不足 10 点，部分功能可能受限`);
          } else if (newCredits <= 0) {
            toast.error(`积分已耗尽，无法使用创作功能`);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`已订阅积分变化通知`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`积分订阅失败`);
          toast.warning("积分实时同步失败，将定期刷新");
        }
      });

    // 定期刷新积分（作为实时订阅的 fallback）
    const refreshInterval = setInterval(() => {
      fetchUserCredits().then((newCredits) => {
        setCredits(newCredits);
      });
    }, 60000); // 每分钟刷新一次

    return () => {
      supabase.removeChannel(channel);
      clearInterval(refreshInterval);
    };
  }, [userId, fetchUserCredits]);

  // 上传文件（优化批量处理和错误反馈）
  const handleFileUpload = useCallback(async (newFiles: KBFile[]) => {
    if (!newFiles.length) return;

    setIsRefreshing(true);
    const successfulUploads: KBFile[] = [];
    const failedCount = 0;

    try {
      // 批量上传（并行处理提升效率）
      const uploadPromises = newFiles.map(async (file) => {
        const res = await fetch(API_ENDPOINTS.KB, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(file),
        });

        if (!res.ok) {
          throw new Error(`文件 ${file.name} 上传失败`);
        }

        return res.json();
      });

      // 处理上传结果
      const results = await Promise.allSettled(uploadPromises);
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          successfulUploads.push(result.value);
        } else {
          console.error("文件上传失败:", result.reason);
        }
      });

      // 更新文件列表
      setFiles((prev) => [...successfulUploads, ...prev]);

      // 显示上传结果
      if (successfulUploads.length > 0) {
        toast.success(`成功上传 ${successfulUploads.length} 个文件`);
      }

      if (failedCount > 0) {
        toast.error(`有 ${failedCount} 个文件上传失败，请重试`);
      }
    } catch (e) {
      console.error("文件上传批量处理错误:", e);
      toast.error("文件上传失败，请重试");
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // 删除文件（优化错误处理和用户反馈）
  const handleDeleteFile = useCallback(async (id: string) => {
    // 确认删除
    if (!window.confirm("确定要删除这个文件吗？此操作不可恢复！")) {
      return;
    }

    try {
      const res = await fetch(`${API_ENDPOINTS.KB}?id=${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error(`文件删除失败：${res.statusText}`);
      }

      // 更新文件列表
      setFiles((prev) => prev.filter((f) => f.id !== id));
      toast.success("文件已成功删除");
    } catch (e) {
      console.error("文件删除错误:", e);
      toast.error("文件删除失败，请重试");
    }
  }, []);

  // 刷新数据（新增手动刷新功能）
  const handleRefreshData = useCallback(async () => {
    if (isRefreshing || isLoading) return;

    setIsRefreshing(true);
    try {
      const [kbFiles, userCredits] = await Promise.all([
        fetchKBFiles(),
        fetchUserCredits(),
      ]);

      setFiles(kbFiles);
      setCredits(userCredits);
      toast.success("数据已刷新");
    } catch (err) {
      console.error("数据刷新错误:", err);
      toast.error("数据刷新失败，请重试");
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, isLoading, fetchKBFiles, fetchUserCredits]);

  // 积分不足提示（新增）
  const renderCreditWarning = () => {
    if (credits >= 10) return null;

    return (
      <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 mb-4 flex items-center gap-3 animate-pulse">
        <div className="text-rose-400">{ICONS.Warning}</div>
        <div>
          <p className="text-sm font-bold text-rose-300">积分不足</p>
          <p className="text-xs text-rose-500">当前积分：{credits}，部分创作功能可能受限，请及时充值</p>
        </div>
      </div>
    );
  };

  // 错误状态渲染
  if (error) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#0a0a0c] p-4">
        <div className="text-rose-500 mb-4">{ICONS.Error}</div>
        <h3 className="text-xl font-black text-white mb-2">{error}</h3>
        <p className="text-slate-500 mb-6 text-center max-w-md">
          可能是网络问题或服务器暂时不可用，请稍后重试
        </p>
        <Button
          onClick={handleRefreshData}
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl"
        >
          {ICONS.Refresh} 刷新页面
        </Button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#0a0a0c] font-sans text-slate-200">
      {/* 顶部导航栏 */}
      <header className="h-16 px-4 md:px-8 flex items-center justify-between z-[100] border-b border-white/5 bg-black/40 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          {/* 应用图标 */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-2.5 rounded-xl text-white shadow-lg shadow-blue-900/20">
            {ICONS.Library}
          </div>
          {/* 应用标题 */}
          <div>
            <h1 className="text-lg font-black text-white leading-tight tracking-tight italic">
              ANIME <span className="text-blue-500 not-italic">ENGINE</span>
            </h1>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.3em]">
              Directing Intelligence v2.5
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 md:gap-6">
          {/* 积分显示 */}
          <div
            className={`flex items-center gap-2 px-3 md:px-4 py-1.5 rounded-full border transition-all duration-300 ${
              credits < 10
                ? 'bg-rose-500/10 border-rose-500/50 text-rose-400'
                : 'bg-white/5 border-white/10 text-slate-300'
            }`}
          >
            <div
              className={`${
                credits < 10 ? 'animate-bounce text-rose-400' : 'text-blue-500'
              }`}
            >
              {ICONS.Zap}
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-slate-500 uppercase leading-none">
                Compute Power
              </span>
              <span className="text-sm font-black leading-none font-mono">
                {credits.toString().padStart(3, '0')}
              </span>
            </div>
          </div>

          {/* 刷新按钮 */}
          <button
            onClick={handleRefreshData}
            disabled={isRefreshing || isLoading}
            className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-all"
            title="刷新数据"
          >
            {isRefreshing ? (
              <span className="animate-spin">{ICONS.Refresh}</span>
            ) : (
              ICONS.Refresh
            )}
          </button>

          {/* 导航按钮 */}
          <nav className="flex items-center gap-3">
            {stage === AppStage.WORKSPACE ? (
              <button
                onClick={() => setStage(AppStage.KB_MANAGEMENT)}
                className="text-slate-400 hover:text-white font-bold text-xs px-4 py-2 border border-white/10 rounded-xl bg-white/5 transition-all flex items-center gap-2"
                disabled={isLoading || isRefreshing}
              >
                {ICONS.ArrowLeft} 资料库
              </button>
            ) : (
              (files.length > 0 || !userId) && (
                <button
                  onClick={() => setStage(AppStage.WORKSPACE)}
                  className={`px-6 py-2 rounded-xl font-bold text-xs transition-all shadow-lg flex items-center gap-2 ${
                    credits <= 0
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20'
                  }`}
                  disabled={isLoading || isRefreshing || credits <= 0}
                >
                  启动导演台 {ICONS.ChevronRight}
                </button>
              )
            )}
          </nav>

          <div className="w-px h-6 bg-white/10"></div>

          {/* 用户按钮 */}
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              baseTheme: 'dark',
              elements: {
                userButton: {
                  backgroundColor: 'transparent',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '0.75rem',
                  padding: '0.25rem',
                },
                popover: {
                  backgroundColor: '#1e1e1e',
                  borderColor: '#374151',
                  borderRadius: '0.75rem',
                },
              },
            }}
          />
        </div>
      </header>

      {/* 主内容区 */}
      <main className="flex-1 overflow-hidden relative">
        {/* 加载状态 */}
        {isLoading ? (
          <LoadingScreen
            message="正在同步云端神经元..."
            secondaryMessage="Synchronizing Creative Assets"
          />
        ) : (
          <>
            {/* 积分不足提示 */}
            {stage === AppStage.KB_MANAGEMENT && renderCreditWarning()}

            {/* 知识库管理页面 */}
            {stage === AppStage.KB_MANAGEMENT ? (
              <div className="animate-fade-up h-full bg-[#0a0a0c]">
                <KBManager
                  files={files}
                  onUpload={handleFileUpload}
                  onDelete={handleDeleteFile}
                  isRefreshing={isRefreshing}
                  onRefresh={handleRefreshData}
                />
              </div>
            ) : (
              /* 工作区页面 */
              <div className="animate-fade-up h-full">
                <Workspace
                  files={files}
                  onUpdateFiles={handleFileUpload}
                  onDeleteFile={handleDeleteFile}
                />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
