
'use client'

import React, { useState, useEffect } from 'react';
import { UserButton } from '@clerk/nextjs';
import { AppStage, KBFile } from '../types';
import { ICONS } from '../constants';
import KBManager from '../components/KBManager';
import Workspace from '../components/Workspace';
import { supabase } from '../lib/supabase';
import { useAuth } from '@clerk/nextjs';

export default function Home() {
  const { userId } = useAuth();
  const [stage, setStage] = useState<AppStage>(AppStage.KB_MANAGEMENT);
  const [files, setFiles] = useState<KBFile[]>([]);
  const [credits, setCredits] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const fetchData = async () => {
      if (!userId) return;
      setIsLoading(true);
      try {
        const kbRes = await fetch('/api/kb');
        if (kbRes.ok) {
          const data = await kbRes.json();
          setFiles(data);
        }

        let { data: profile, error } = await supabase
          .from('profiles')
          .select('credits')
          .eq('id', userId)
          .single();

        if (error && error.code === 'PGRST116') {
          const { data: newProfile } = await supabase
            .from('profiles')
            .insert({ id: userId, credits: 100 })
            .select()
            .single();
          setCredits(newProfile?.credits || 100);
        } else {
          setCredits(profile?.credits || 0);
        }
      } catch (err) {
        console.error("Data sync error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    const channel = supabase
      .channel(`profile_${userId}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'profiles',
        filter: `id=eq.${userId}`
      }, (payload) => {
        setCredits(payload.new.credits);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const handleFileUpload = (newFiles: KBFile[]) => {
    setFiles(prev => [...newFiles, ...prev]);
  };

  const handleDeleteFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#0a0a0c] font-sans text-slate-200">
      <header className="h-16 px-8 flex items-center justify-between z-[100] border-b border-white/5 bg-black/40 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-2.5 rounded-xl text-white shadow-lg shadow-blue-900/20">
            {ICONS.Library}
          </div>
          <div>
            <h1 className="text-lg font-black text-white leading-tight tracking-tight italic">ANIME <span className="text-blue-500 not-italic">ENGINE</span></h1>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.3em]">Directing Intelligence v2.5</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className={`flex items-center gap-3 px-4 py-1.5 rounded-full border transition-all ${
            credits !== null && credits < 10 ? 'bg-rose-500/10 border-rose-500/50 text-rose-400' : 'bg-white/5 border-white/10 text-slate-300'
          }`}>
            <div className={credits !== null && credits < 10 ? 'animate-bounce' : 'text-blue-500'}>
              {ICONS.Zap}
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-slate-500 uppercase leading-none">Compute Power</span>
              <span className="text-sm font-black leading-none font-mono">
                {credits !== null ? credits.toString().padStart(3, '0') : '---'}
              </span>
            </div>
          </div>

          <nav className="flex items-center gap-3">
            {stage === AppStage.WORKSPACE ? (
              <button 
                onClick={() => setStage(AppStage.KB_MANAGEMENT)}
                className="text-slate-400 hover:text-white font-bold text-xs px-4 py-2 border border-white/10 rounded-xl bg-white/5 transition-all flex items-center gap-2"
              >
                {ICONS.ArrowLeft} 资料库
              </button>
            ) : (
              files.length > 0 && (
                <button 
                  onClick={() => setStage(AppStage.WORKSPACE)}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl font-bold text-xs transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2"
                >
                  启动导演台 {ICONS.ChevronRight}
                </button>
              )
            )}
          </nav>
          
          <div className="w-px h-6 bg-white/10"></div>
          
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        {isLoading ? (
          <div className="absolute inset-0 bg-[#0a0a0c] z-50 flex flex-col items-center justify-center gap-6">
            <div className="relative">
              <div className="w-16 h-16 border-2 border-white/5 border-t-blue-500 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-blue-500">
                {ICONS.Sparkles}
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-black text-white uppercase tracking-[0.2em] mb-1">正在同步云端神经元...</p>
              <p className="text-[10px] font-bold text-slate-600 uppercase">Synchronizing Creative Assets</p>
            </div>
          </div>
        ) : stage === AppStage.KB_MANAGEMENT ? (
          <div className="animate-fade-up h-full bg-[#f8fafc] text-slate-900">
            <KBManager files={files} onUpload={handleFileUpload} onDelete={handleDeleteFile} />
          </div>
        ) : (
          <div className="animate-fade-up h-full">
            <Workspace files={files} />
          </div>
        )}
      </main>
    </div>
  );
}
