import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ScriptBlock, SceneImage, CharacterAsset, AmbientAtmosphere } from '../types';
import { ICONS } from '../constants';

// 定义镜头类型接口（增强类型提示）
interface ParsedShot {
  id: number;
  visual: string;
  duration: number; // 毫秒
  audio: Array<{
    name: string | undefined;
    text: string;
    characterAsset?: CharacterAsset;
  }>;
  image?: string;
  video?: string;
  videoUrl?: string;
  isGeneratingVideo?: boolean;
  videoError?: string;
}

interface CinematicPreviewProps {
  block: ScriptBlock;
  characterAssets: CharacterAsset[];
  onClose: () => void;
  onUpdateShotDuration?: (shotId: number, duration: number) => void; // 新增：更新镜头时长回调
}

const CinematicPreview: React.FC<CinematicPreviewProps> = ({
  block,
  characterAssets,
  onClose,
  onUpdateShotDuration,
}) => {
  const [currentShotIndex, setCurrentShotIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [atmosphere, setAtmosphere] = useState<AmbientAtmosphere>(
    block.ambientAtmosphere || AmbientAtmosphere.QUIET
  );
  const [shotDurations, setShotDurations] = useState<Record<number, number>>({});
  const [isMuted, setIsMuted] = useState(true); // 默认静音（避免突然播放声音）
  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 解析剧本内容为镜头列表（优化解析逻辑，增强稳定性）
  const shots = useMemo<ParsedShot[]>(() => {
    if (!block.content) return [];

    const lines = block.content.split('\n').filter(line => line.trim());
    const result: ParsedShot[] = [];
    let currentShot: Partial<ParsedShot> | null = null;

    lines.forEach((line, lineIndex) => {
      const trimmedLine = line.trim();

      // 匹配镜头标记 [Shot:XXX] [Duration:X]
      if (trimmedLine.startsWith('[Shot:')) {
        // 保存当前镜头（如果存在）
        if (currentShot) {
          result.push({
            id: currentShot.id || lineIndex,
            visual: currentShot.visual || '',
            duration: (shotDurations[currentShot.id || lineIndex] || 
              currentShot.duration || 3) * 1000,
            audio: currentShot.audio || [],
            image: currentShot.image,
            video: currentShot.video,
            videoUrl: currentShot.videoUrl,
            isGeneratingVideo: currentShot.isGeneratingVideo,
            videoError: currentShot.videoError,
          });
        }

        // 提取镜头信息
        const shotMatch = trimmedLine.match(/\[Shot:(.*?)\]/);
        const durationMatch = trimmedLine.match(/\[Duration:(.*?)\]/);
        const visualContent = shotMatch?.[1]?.trim() || `镜头 ${lineIndex}`;
        const baseDuration = parseInt(durationMatch?.[1] || '3');

        // 匹配对应的场景图片/视频
        const matchingSceneImage = block.sceneImages?.find(img => 
          img.shotDescription.toLowerCase().includes(visualContent.substring(0, 15).toLowerCase())
        );

        // 创建新镜头
        currentShot = {
          id: lineIndex,
          visual: visualContent,
          duration: baseDuration,
          audio: [],
          image: matchingSceneImage?.imageUrl,
          video: matchingSceneImage?.videoUrl,
          videoUrl: matchingSceneImage?.videoUrl,
          isGeneratingVideo: matchingSceneImage?.isGeneratingVideo,
          videoError: matchingSceneImage?.videoError,
        };
      } 
      // 匹配角色台词 [角色:XXX] 台词:XXX
      else if (trimmedLine.startsWith('[角色:') && currentShot) {
        const roleMatch = trimmedLine.match(/\[角色:(.*?)\]/);
        const lineMatch = trimmedLine.match(/台词:(.*?)(?:\]|$)/);
        
        if (roleMatch && lineMatch) {
          const roleName = roleMatch[1].trim();
          const lineText = lineMatch[1].trim();
          
          // 匹配对应的角色资产
          const characterAsset = characterAssets.find(asset => 
            asset.name.toLowerCase() === roleName.toLowerCase()
          );

          currentShot.audio?.push({
            name: roleName,
            text: lineText,
            characterAsset,
          });
        }
      }
    });

    // 添加最后一个镜头
    if (currentShot) {
      result.push({
        id: currentShot.id || lines.length,
        visual: currentShot.visual || '',
        duration: (shotDurations[currentShot.id || lines.length] || 
          currentShot.duration || 3) * 1000,
        audio: currentShot.audio || [],
        image: currentShot.image,
        video: currentShot.video,
        videoUrl: currentShot.videoUrl,
        isGeneratingVideo: currentShot.isGeneratingVideo,
        videoError: currentShot.videoError,
      });
    }

    return result;
  }, [block, characterAssets, shotDurations]);

  // 计算总时长（秒）
  const totalDuration = useMemo(
    () => shots.reduce((acc, shot) => acc + shot.duration / 1000, 0).toFixed(1),
    [shots]
  );

  // 播放控制逻辑（使用 ref 避免闭包问题）
  const playNextShot = useCallback(() => {
    if (currentShotIndex < shots.length - 1) {
      setCurrentShotIndex(prev => prev + 1);
    } else {
      setIsPlaying(false);
      setCurrentShotIndex(0); // 播放完毕后回到第一个镜头
    }
  }, [currentShotIndex, shots.length]);

  // 播放/暂停逻辑
  useEffect(() => {
    if (isPlaying && shots.length > 0) {
      // 清除之前的定时器
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      // 设置当前镜头的定时器
      timerRef.current = setTimeout(() => {
        playNextShot();
      }, shots[currentShotIndex].duration);

      // 自动播放视频（如果有）
      const currentVideoRef = videoRefs.current[currentShotIndex];
      if (currentVideoRef) {
        currentVideoRef.currentTime = 0;
        currentVideoRef.play().catch(err => {
          console.warn('视频播放失败：', err);
        });
      }
    } else if (timerRef.current) {
      // 暂停时清除定时器
      clearTimeout(timerRef.current);
      timerRef.current = null;

      // 暂停所有视频
      Object.values(videoRefs.current).forEach(video => {
        if (video) video.pause();
      });
    }

    // 组件卸载时清除定时器
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isPlaying, currentShotIndex, shots, playNextShot]);

  // 调整镜头时长
  const adjustDuration = useCallback((shotIndex: number, delta: number) => {
    if (shotIndex < 0 || shotIndex >= shots.length) return;

    const shot = shots[shotIndex];
    const currentDuration = shot.duration / 1000;
    const newDuration = Math.max(1, currentDuration + delta); // 最小1秒

    // 更新本地状态
    setShotDurations(prev => ({
      ...prev,
      [shot.id]: newDuration,
    }));

    // 回调通知父组件更新
    onUpdateShotDuration?.(shot.id, newDuration);
  }, [shots, onUpdateShotDuration]);

  // 获取当前镜头
  const currentShot = shots[currentShotIndex];

  // 切换氛围音效（模拟功能，实际需结合音频库）
  const toggleAtmosphere = (newAtmosphere: AmbientAtmosphere) => {
    setAtmosphere(newAtmosphere);
    // 这里可添加实际的音效播放逻辑
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center p-4 md:p-10 select-none">
      {/* 头部信息栏 */}
      <div className="absolute top-6 left-6 right-6 flex flex-wrap items-center justify-between gap-4 z-10">
        <div className="flex flex-col">
          <h2 className="text-white text-lg md:text-xl font-black italic tracking-tighter uppercase">
            Cinematic Pre-viz
          </h2>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">
              总时长: {totalDuration}s
            </span>
            <div className="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              镜头数: {shots.length}
            </span>
            <div className="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              当前镜头: {currentShotIndex + 1}/{shots.length}
            </span>
          </div>
        </div>

        {/* 氛围切换 */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden md:inline">
            氛围:
          </span>
          <select
            value={atmosphere}
            onChange={(e) => toggleAtmosphere(e.target.value as AmbientAtmosphere)}
            className="bg-[#151517] border border-slate-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg"
          >
            {Object.entries(AmbientAtmosphere).map(([key, value]) => (
              <option key={key} value={value}>
                {value}
              </option>
            ))}
          </select>

          {/* 静音切换 */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="bg-[#151517] hover:bg-[#252525] p-2 rounded-full border border-slate-700 transition-all"
            title={isMuted ? "取消静音" : "静音"}
          >
            {isMuted ? ICONS.VolumeX : ICONS.Volume2}
          </button>

          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-all bg-[#151517] hover:bg-rose-900/30 p-3 rounded-full border border-white/10 hover:scale-110 active:scale-90"
            title="关闭预览"
          >
            {ICONS.X}
          </button>
        </div>
      </div>

      {/* 主预览区域 */}
      <div className="w-full max-w-5xl aspect-video bg-[#050508] rounded-[2rem] md:rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(59,130,246,0.15)] relative border-2 md:border-4 border-white/5 flex items-center justify-center">
        {currentShot ? (
          <>
            {/* 视频/图片显示 */}
            <div className="w-full h-full relative">
              {currentShot.video && !currentShot.videoError ? (
                <video
                  ref={(el) => (videoRefs.current[currentShotIndex] = el)}
                  key={`video-${currentShot.id}`}
                  src={currentShot.video}
                  muted={isMuted}
                  loop={!isPlaying} // 播放模式下不循环，暂停模式下循环
                  className="w-full h-full object-cover animate-in fade-in duration-500"
                  poster={currentShot.image}
                />
              ) : currentShot.image ? (
                <img
                  key={`image-${currentShot.id}`}
                  src={currentShot.image}
                  alt={currentShot.visual}
                  className="w-full h-full object-cover animate-in zoom-in-105 fade-in duration-1000"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 text-[10px] font-black uppercase tracking-widest">
                  <ICONS.Image className="w-12 h-12 mb-4 opacity-20" />
                  <span>暂无镜头画面</span>
                  <span className="mt-2 text-[8px]">镜头描述: {currentShot.visual.substring(0, 30)}...</span>
                </div>
              )}

              {/* 视频生成状态提示 */}
              {currentShot.isGeneratingVideo && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4">
                    <span className="animate-spin text-blue-500 text-2xl">{ICONS.Loading}</span>
                    <span className="text-white text-sm font-bold">视频生成中...</span>
                  </div>
                </div>
              )}

              {/* 视频生成错误提示 */}
              {currentShot.videoError && !currentShot.video && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4 text-center p-6">
                    <ICONS.Error className="text-rose-500 text-2xl" />
                    <span className="text-white text-sm font-bold">视频生成失败</span>
                    <span className="text-slate-400 text-xs max-w-xs">{currentShot.videoError}</span>
                  </div>
                </div>
              )}

              {/* 镜头描述叠加层 */}
              <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full">
                {currentShot.visual}
              </div>
            </div>

            {/* 台词区域 */}
            {currentShot.audio.length > 0 && (
              <div className="absolute bottom-6 left-6 right-6 md:bottom-10 md:left-10 md:right-10 space-y-3">
                {currentShot.audio.map((audio, i) => (
                  <div
                    key={i}
                    className="animate-in slide-in-from-bottom fade-in duration-500"
                    style={{ animationDelay: `${i * 150}ms` }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {audio.characterAsset?.image_url && (
                        <img
                          src={audio.characterAsset.image_url}
                          alt={audio.name}
                          className="w-6 h-6 rounded-full object-cover border border-blue-500"
                        />
                      )}
                      <span className="text-blue-400 text-[9px] font-black uppercase tracking-widest">
                        {audio.name || '未知角色'}
                      </span>
                    </div>
                    <p className="text-white text-lg md:text-2xl font-medium tracking-tighter italic leading-tight">
                      “{audio.text}”
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-600 text-[10px] font-black uppercase tracking-widest">
            <ICONS.Film className="w-16 h-16 mb-4 opacity-20" />
            <span>暂无镜头数据</span>
            <span className="mt-2 text-[8px]">请先添加镜头标记和台词</span>
          </div>
        )}
      </div>

      {/* 播放控制栏 */}
      <div className="mt-8 flex items-center gap-8 md:gap-12">
        <button
          onClick={() => setCurrentShotIndex(Math.max(0, currentShotIndex - 1))}
          disabled={shots.length === 0}
          className="text-white/40 hover:text-white transition-all scale-150 md:scale-175 disabled:opacity-20"
          title="上一个镜头"
        >
          {ICONS.ChevronLeft}
        </button>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          disabled={shots.length === 0}
          className={`w-14 h-14 md:w-20 md:h-20 rounded-full flex items-center justify-center transition-all shadow-2xl transform hover:scale-105 active:scale-95 ${
            isPlaying ? 'bg-white text-black' : 'bg-blue-600 text-white hover:bg-blue-500'
          } disabled:bg-slate-800 disabled:shadow-none`}
          title={isPlaying ? "暂停" : "播放"}
        >
          <div className="scale-[1.8] md:scale-[2]">
            {isPlaying ? (
              <div className="flex gap-1.5">
                <div className="w-2 h-6 bg-current"></div>
                <div className="w-2 h-6 bg-current"></div>
              </div>
            ) : (
              ICONS.Play
            )}
          </div>
        </button>
        <button
          onClick={() => setCurrentShotIndex(Math.min(shots.length - 1, currentShotIndex + 1))}
          disabled={shots.length === 0}
          className="text-white/40 hover:text-white transition-all scale-150 md:scale-175 disabled:opacity-20"
          title="下一个镜头"
        >
          {ICONS.ChevronRight}
        </button>
      </div>

      {/* 时间轴编辑器 */}
      {shots.length > 0 && (
        <div className="mt-8 w-full max-w-5xl bg-[#151517] border border-slate-800 rounded-2xl md:rounded-3xl p-4 md:p-6 overflow-hidden flex flex-col gap-4">
          <div className="flex items-center justify-between px-2">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">
              Production Timeline 编辑器
            </span>
            <div className="flex gap-3 md:gap-4 flex-wrap">
              <button
                onClick={() => adjustDuration(currentShotIndex, -0.5)}
                className="text-white/40 hover:text-blue-500 text-[10px] font-black uppercase px-2 py-1"
                title="缩短镜头 0.5 秒"
              >
                缩短 -0.5s
              </button>
              <button
                onClick={() => adjustDuration(currentShotIndex, 0.5)}
                className="text-white/40 hover:text-blue-500 text-[10px] font-black uppercase px-2 py-1"
                title="延长镜头 0.5 秒"
              >
                延长 +0.5s
              </button>
            </div>
          </div>

          {/* 时间轴轨道 */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            {shots.map((shot, i) => (
              <div
                key={shot.id}
                onClick={() => setCurrentShotIndex(i)}
                className={`h-10 md:h-12 rounded-xl transition-all cursor-pointer border flex flex-col items-center justify-center text-[10px] font-mono ${
                  i === currentShotIndex
                    ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/20'
                    : 'bg-[#202022] border-slate-700 text-slate-400 hover:bg-[#2a2a2c]'
                }`}
                style={{
                  minWidth: `${(shot.duration / 1000) * 20}px`, // 每秒对应 20px 宽度
                  flexShrink: 0,
                }}
                title={`镜头 ${i + 1}: ${shot.visual.substring(0, 20)}... (${shot.duration / 1000}s)`}
              >
                <span className="text-xs md:text-[10px]">{shot.duration / 1000}s</span>
                {shot.audio.length > 0 && (
                  <span className="text-[8px] opacity-70 mt-0.5">
                    {shot.audio.length} 句台词
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CinematicPreview;
