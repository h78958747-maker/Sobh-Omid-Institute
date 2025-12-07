
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ImageUpload } from './components/ImageUpload';
import { Button } from './components/Button';
import { ChatInterface } from './components/ChatInterface';
import { ImageCropper } from './components/ImageCropper';
import { LivingBackground } from './components/LivingBackground';
import { generateEditedImage } from './services/geminiService';
import { generateInstantVideo } from './services/clientVideoService';
import { saveHistoryItem, getHistory, deleteHistoryItem, clearHistoryDB } from './services/storageService';
import { DEFAULT_PROMPT, BACKGROUND_PRESETS, QUALITY_MODIFIERS, LIGHTING_STYLES, COLOR_GRADING_STYLES, PROMPT_SUGGESTIONS, LOADING_MESSAGES } from './constants';
import { ProcessingState, AspectRatio, HistoryItem, Language, ChatMessage, SavedPrompt, BackgroundConfig, QualityMode, LightingIntensity, ColorGradingStyle, Theme, BatchItem } from './types';
import { translations } from './translations';

function App() {
  const [language, setLanguage] = useState<Language>('en');
  // Locked to dark for the specific futuristic design
  const theme: Theme = 'dark';
  
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>(DEFAULT_PROMPT);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [quality, setQuality] = useState<QualityMode>('high');
  const [status, setStatus] = useState<ProcessingState>({ isLoading: false, error: null });
  const [isCustomPromptOpen, setIsCustomPromptOpen] = useState(true);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  // Cropper State
  const [isCropping, setIsCropping] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);

  // Loading Message State
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  // Settings
  const [skinTexture, setSkinTexture] = useState<boolean>(true);
  const [faceDetail, setFaceDetail] = useState<number>(50); 
  const [lighting, setLighting] = useState<LightingIntensity>('dramatic');
  const [colorGrading, setColorGrading] = useState<ColorGradingStyle>('teal_orange');
  
  // Animation State
  const [isAnimating, setIsAnimating] = useState(false);
  const [videoResult, setVideoResult] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'image' | 'video'>('image');

  // Background
  const [backgroundConfig, setBackgroundConfig] = useState<BackgroundConfig>({ type: 'preset', value: 'default' });
  
  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Batch
  const [batchQueue, setBatchQueue] = useState<BatchItem[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  // Logo Data URI (Sobh Omid - Yellow BG, Green Text)
  const LOGO_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23facc15"/><path d="M50 5 C 25 5 5 25 5 50 C 5 75 25 95 50 95 C 75 95 95 75 95 50 C 95 25 75 5 50 5 Z" fill="%23facc15"/><text x="50" y="45" font-family="Tahoma, Arial, sans-serif" font-weight="bold" font-size="30" text-anchor="middle" fill="%2314532d">صبح</text><text x="50" y="78" font-family="Tahoma, Arial, sans-serif" font-weight="bold" font-size="30" text-anchor="middle" fill="%2314532d">امید</text></svg>`;

  const t = translations[language];

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  useEffect(() => {
    let interval: any;
    if (status.isLoading && !isAnimating) {
      setLoadingMessageIndex(0);
      interval = setInterval(() => {
        setLoadingMessageIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [status.isLoading, isAnimating]);

  useEffect(() => {
    getHistory().then(setHistory).catch(err => console.error(err));
  }, []);

  const addToHistory = async (image: string, p: string, ar: AspectRatio) => {
    const newItem: HistoryItem = {
      id: Date.now().toString() + Math.random().toString(36).substring(2),
      imageUrl: image,
      prompt: p,
      aspectRatio: ar,
      timestamp: Date.now(),
      skinTexture, faceDetail, lighting, colorGrading
    };
    setHistory(prev => [newItem, ...prev]);
    saveHistoryItem(newItem).catch(console.error);
  };

  const handleImageSelected = useCallback((base64: string | string[]) => {
    if (Array.isArray(base64)) {
       const newItems: BatchItem[] = base64.map((b, i) => ({
         id: `batch-${Date.now()}-${i}`,
         original: b,
         status: 'pending'
       }));
       setBatchQueue(newItems);
       setSelectedImage(base64[0]); 
    } else {
       setSelectedImage(base64 || null);
       setBatchQueue([]);
    }
    setResultImage(null);
    setVideoResult(null);
    setActiveTab('image');
    setStatus({ isLoading: false, error: null });
  }, []);

  const constructPrompt = () => {
    let finalPrompt = prompt;
    // Uses safer keywords to avoid IMAGE_OTHER
    if (skinTexture) finalPrompt += ", high fidelity texture, professional retouching";
    if (faceDetail > 75) finalPrompt += ", sharp focus, high definition details";
    finalPrompt += `, ${LIGHTING_STYLES[lighting]}`;
    if (colorGrading !== 'none') finalPrompt += `, ${COLOR_GRADING_STYLES[colorGrading]}`;
    finalPrompt += QUALITY_MODIFIERS[quality];
    if (backgroundConfig.type === 'preset' && backgroundConfig.value !== 'default') {
      const preset = BACKGROUND_PRESETS.find(p => p.id === backgroundConfig.value);
      if (preset) finalPrompt += `, ${preset.prompt}`;
    } else if (backgroundConfig.type === 'custom_color') {
       finalPrompt += `, solid ${backgroundConfig.value} color background`;
    }
    return finalPrompt;
  };

  const handleGenerate = async () => {
    if (!selectedImage) return;
    if (batchQueue.length > 0) { handleBatchGenerate(); return; }

    setStatus({ isLoading: true, error: null });
    setResultImage(null);
    try {
      const finalPrompt = constructPrompt();
      const img = await generateEditedImage(selectedImage, finalPrompt, aspectRatio);
      setResultImage(img);
      await addToHistory(img, finalPrompt, aspectRatio);
    } catch (error: any) {
      setStatus({ isLoading: false, error: error.message || t.errorGeneric });
    } finally {
      setStatus(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleBatchGenerate = async () => {
    setIsBatchProcessing(true);
    const finalPrompt = constructPrompt();
    for (let i = 0; i < batchQueue.length; i++) {
      const item = batchQueue[i];
      setBatchQueue(prev => prev.map(p => p.id === item.id ? { ...p, status: 'processing' } : p));
      try {
        const result = await generateEditedImage(item.original, finalPrompt, aspectRatio);
        setBatchQueue(prev => prev.map(p => p.id === item.id ? { ...p, status: 'done', result } : p));
        await addToHistory(result, finalPrompt, aspectRatio);
      } catch (err) {
        setBatchQueue(prev => prev.map(p => p.id === item.id ? { ...p, status: 'error' } : p));
      }
    }
    setIsBatchProcessing(false);
  };

  const handleAnimate = async () => {
    if (!resultImage) return;
    setIsAnimating(true);
    setStatus({ isLoading: true, error: null });
    try {
      const videoUrl = await generateInstantVideo(resultImage);
      setVideoResult(videoUrl);
      setActiveTab('video');
    } catch (error: any) {
      setStatus({ isLoading: false, error: error.message });
    } finally {
      setIsAnimating(false);
      setStatus(prev => ({ ...prev, isLoading: false }));
    }
  };

  const ASPECT_RATIOS: AspectRatio[] = ["AUTO", "1:1", "3:4", "4:3", "9:16", "16:9", "21:9"];

  return (
    <div dir={language === 'fa' ? 'rtl' : 'ltr'} className="min-h-screen bg-transparent text-white font-sans overflow-x-hidden relative selection:bg-studio-neon/30">
      
      {/* GLOBAL AMBIENT MOTION & BACKGROUND */}
      <LivingBackground />

      {/* Cropper */}
      {isCropping && imageToCrop && (
        <ImageCropper
          imageSrc={imageToCrop}
          onCropComplete={(cropped) => { setSelectedImage(cropped); setIsCropping(false); setImageToCrop(null); }}
          onCancel={() => { setIsCropping(false); setImageToCrop(null); }}
          confirmLabel={t.applyCrop} cancelLabel={t.cancelCrop} instructions={t.cropInstructions}
        />
      )}

      {/* MAIN LAYOUT */}
      <div className="relative z-10 flex flex-col min-h-screen max-w-[1600px] mx-auto p-6 md:p-8 gap-8">
        
        {/* HEADER */}
        <header className="flex items-center justify-between animate-stagger-1">
           <div className="flex items-center gap-4 group">
              <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-studio-gold bg-studio-gold shadow-[0_0_30px_rgba(255,215,0,0.4)] transition-transform duration-500 hover:scale-110 hover:rotate-3">
                 <img src={LOGO_SVG} alt="Logo" className="w-full h-full object-cover" />
              </div>
              <div>
                 <h1 className="text-2xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-400 drop-shadow-sm">{t.instituteName}</h1>
                 <p className="text-xs font-bold tracking-[0.3em] text-studio-neon uppercase opacity-80 group-hover:opacity-100 transition-opacity">{t.appTitle}</p>
              </div>
           </div>

           <div className="flex items-center gap-4 bg-white/5 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-glass hover:shadow-neon-blue/20 transition-all duration-300">
              <div className="flex gap-1">
                 <button onClick={() => setLanguage('en')} className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${language === 'en' ? 'bg-white text-black shadow-lg scale-105' : 'text-gray-400 hover:text-white'}`}>EN</button>
                 <button onClick={() => setLanguage('fa')} className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${language === 'fa' ? 'bg-white text-black shadow-lg scale-105' : 'text-gray-400 hover:text-white'}`}>FA</button>
              </div>
           </div>
        </header>

        {/* WORKSPACE GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
           
           {/* LEFT COLUMN: CONTROLS */}
           <div className="lg:col-span-4 flex flex-col gap-6 animate-stagger-2">
              
              {/* Glass Card */}
              <div className="bg-black/40 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white/10 shadow-glass relative overflow-hidden group hover:border-studio-neon/30 transition-all duration-500">
                 {/* Decorative Top Line */}
                 <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-studio-neon/50 to-transparent opacity-20 group-hover:opacity-100 transition-opacity"></div>

                 <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-studio-neon rounded-full animate-pulse shadow-[0_0_10px_#00f0ff]"></span>
                    {t.uploadTitle}
                 </h2>
                 
                 <div className="mb-8">
                   <ImageUpload onImageSelected={handleImageSelected} selectedImage={selectedImage} />
                   {selectedImage && batchQueue.length === 0 && (
                      <button onClick={() => { setImageToCrop(selectedImage); setIsCropping(true); }} className="absolute top-24 right-10 bg-black/60 text-white p-2 rounded-full hover:bg-studio-neon transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                   )}
                 </div>

                 {/* Settings Accordion */}
                 <div className="space-y-6">
                    <div className="flex items-center justify-between cursor-pointer group/settings" onClick={() => setIsCustomPromptOpen(!isCustomPromptOpen)}>
                       <h3 className="text-lg font-bold text-white group-hover/settings:text-studio-neon transition-colors">{t.settings}</h3>
                       <div className={`transition-transform duration-500 ${isCustomPromptOpen ? 'rotate-180 text-studio-neon' : 'text-gray-500'}`}>▼</div>
                    </div>
                    
                    <div className={`overflow-hidden transition-all duration-700 ease-cinematic ${isCustomPromptOpen ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0'}`}>
                       <div className="space-y-8 pt-2">
                          
                          {/* Aspect Ratio */}
                          <div className="space-y-3">
                             <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{t.aspectRatio}</label>
                             <div className="grid grid-cols-7 gap-2">
                                {ASPECT_RATIOS.map((r, i) => (
                                   <button 
                                     key={r} 
                                     onClick={() => setAspectRatio(r)}
                                     title={r === 'AUTO' ? t.ratioAutoTooltip : r}
                                     style={{ animationDelay: `${i * 50}ms` }}
                                     className={`aspect-square rounded-lg flex items-center justify-center border transition-all duration-300 animate-fade-in-up ${aspectRatio === r ? 'bg-studio-neon border-studio-neon text-black shadow-[0_0_15px_rgba(0,240,255,0.5)] scale-110' : 'bg-white/5 border-white/5 text-gray-500 hover:bg-white/10 hover:border-white/20'}`}
                                   >
                                      {r === 'AUTO' ? 'A' : <div style={{ width: '40%', height: `${(parseInt(r.split(':')[1])/parseInt(r.split(':')[0]))*40}%`, border: '1px solid currentColor' }}></div>}
                                   </button>
                                ))}
                             </div>
                          </div>

                          {/* Sliders & Toggles */}
                          <div className="grid grid-cols-1 gap-6">
                             <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                <span className="text-xs font-bold text-gray-300">{t.skinTexture}</span>
                                <button onClick={() => setSkinTexture(!skinTexture)} className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${skinTexture ? 'bg-studio-neon shadow-[0_0_10px_rgba(0,240,255,0.4)]' : 'bg-gray-700'}`}>
                                   <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${skinTexture ? 'left-7 scale-110' : 'left-1'}`}></div>
                                </button>
                             </div>
                             
                             <div className="space-y-3">
                                <div className="flex justify-between text-xs font-bold text-gray-400"><span>{t.faceDetail}</span> <span className="text-studio-neon">{faceDetail}%</span></div>
                                <input type="range" min="0" max="100" value={faceDetail} onChange={(e) => setFaceDetail(Number(e.target.value))} className="w-full" />
                             </div>
                          </div>

                          {/* Lighting Mode */}
                          <div className="space-y-3">
                             <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{t.lightingIntensity}</label>
                             <div className="grid grid-cols-4 gap-2">
                                {(['soft', 'cinematic', 'dramatic', 'intense'] as LightingIntensity[]).map(m => (
                                   <button key={m} onClick={() => setLighting(m)} className={`py-2 text-[10px] uppercase font-bold rounded-md border transition-all ${lighting === m ? 'border-studio-gold text-studio-gold bg-studio-gold/10 shadow-[0_0_15px_rgba(255,215,0,0.2)]' : 'border-white/5 text-gray-500 hover:bg-white/5'}`}>{t[`light${m.charAt(0).toUpperCase() + m.slice(1)}` as any]}</button>
                                ))}
                             </div>
                          </div>

                          {/* Prompt Input */}
                          <div className="relative group/input">
                             <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className="w-full h-32 bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-gray-300 focus:border-studio-neon/50 focus:ring-1 focus:ring-studio-neon/50 transition-all resize-none shadow-inner" placeholder="Describe style..." />
                             {/* Suggestions */}
                             <div className="absolute top-full mt-2 w-full overflow-x-auto flex gap-2 pb-2 scrollbar-hide mask-fade-sides">
                                {PROMPT_SUGGESTIONS.map(s => (
                                   <button key={s.id} onClick={() => setPrompt(s.prompt)} className={`whitespace-nowrap px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-gradient-to-r ${s.color} text-white opacity-60 hover:opacity-100 hover:scale-105 transition-all shadow-lg`}>
                                      {t[s.labelKey] || s.labelKey}
                                   </button>
                                ))}
                             </div>
                          </div>

                          <Button onClick={handleGenerate} isLoading={status.isLoading || isBatchProcessing} disabled={!selectedImage && batchQueue.length === 0} className="w-full py-4 text-sm uppercase tracking-widest border-studio-neon/30 hover:border-studio-neon/60 shadow-neon-blue">
                             {isBatchProcessing ? t.batchProcessing : (status.isLoading ? t[LOADING_MESSAGES[loadingMessageIndex]] : t.generate)}
                          </Button>
                       </div>
                    </div>
                 </div>
              </div>
           </div>

           {/* RIGHT COLUMN: VIEWPORT */}
           <div className="lg:col-span-8 h-full flex flex-col gap-6 animate-stagger-3">
              
              <div className="flex-1 bg-black/40 backdrop-blur-xl rounded-[2.5rem] border border-white/10 relative overflow-hidden shadow-2xl group hover:shadow-[0_0_50px_rgba(170,0,255,0.1)] transition-shadow duration-700">
                 
                 {/* Grid Overlay */}
                 <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>

                 {batchQueue.length > 0 && !resultImage ? (
                    <div className="p-8 h-[700px] overflow-y-auto scrollbar-hide">
                       <div className="flex items-center gap-3 mb-6">
                          <h3 className="text-xl font-bold text-white">{t.batchTitle}</h3>
                          <span className="bg-studio-neon/20 text-studio-neon text-xs font-bold px-2 py-1 rounded">{batchQueue.length}</span>
                       </div>
                       <p className="text-gray-400 text-sm mb-8 max-w-2xl leading-relaxed bg-white/5 p-4 rounded-xl border border-white/5">{t.batchDescription}</p>
                       <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {batchQueue.map((item, i) => (
                             <div key={item.id} style={{ animationDelay: `${i * 100}ms` }} className="relative aspect-square rounded-xl overflow-hidden bg-white/5 border border-white/10 animate-fade-in-up group/item">
                                <img src={item.result || item.original} className={`w-full h-full object-cover transition-all duration-500 ${item.status === 'processing' ? 'scale-110 blur-sm opacity-50' : 'scale-100'}`} />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                   {item.status === 'processing' && <div className="w-8 h-8 border-2 border-studio-neon border-t-transparent rounded-full animate-spin"></div>}
                                   {item.status === 'done' && <div className="bg-green-500/20 p-2 rounded-full border border-green-500/50 animate-elastic"><svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></div>}
                                </div>
                             </div>
                          ))}
                       </div>
                    </div>
                 ) : resultImage ? (
                    <div className="w-full h-[750px] flex items-center justify-center p-8 relative">
                       {/* Floating Tabs */}
                       <div className="absolute top-6 z-20 bg-black/60 backdrop-blur-xl border border-white/10 rounded-full p-1 flex gap-1">
                          <button onClick={() => setActiveTab('image')} className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'image' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}>{t.viewImage}</button>
                          <button onClick={() => setActiveTab('video')} className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'video' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}>{t.viewVideo}</button>
                       </div>

                       {activeTab === 'image' ? (
                          <img src={resultImage} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-zoom-in hover:scale-[1.01] transition-transform duration-700" />
                       ) : (
                          <video src={videoResult!} autoPlay loop muted playsInline controls className="max-w-full max-h-full rounded-lg shadow-2xl animate-fade-in" />
                       )}

                       {/* Action Bar */}
                       <div className="absolute bottom-8 flex gap-4">
                          {!videoResult && <Button variant="secondary" onClick={handleAnimate} isLoading={isAnimating} className="rounded-full px-6">{t.animate}</Button>}
                          <Button onClick={() => { /* Download Logic */ }} className="rounded-full px-8 shadow-neon-blue">{t.download}</Button>
                       </div>
                    </div>
                 ) : (
                    <div className="w-full h-[700px] flex flex-col items-center justify-center text-gray-600">
                       <div className="w-20 h-20 rounded-full border-2 border-white/5 flex items-center justify-center mb-4 animate-pulse">
                          <svg className="w-8 h-8 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                       </div>
                       <p className="text-sm uppercase tracking-widest opacity-50">{t.noResult}</p>
                    </div>
                 )}
              </div>

              {/* Chat Interface */}
              {resultImage && (
                 <div className="animate-slide-in-right">
                    <ChatInterface messages={chatMessages} onSendMessage={async (txt) => { /* logic */ }} isLoading={status.isLoading} language={language} disabled={isAnimating} />
                 </div>
              )}
           </div>
        </div>
        
        {/* History Reel */}
        {history.length > 0 && (
           <div className="pb-12 animate-stagger-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-6 pl-2">{t.history}</h3>
              <div className="flex gap-4 overflow-x-auto pb-8 scrollbar-hide px-2">
                 {history.map((h, i) => (
                    <div key={h.id} style={{ animationDelay: `${i * 50}ms` }} onClick={() => {/* Restore */}} className="shrink-0 w-32 h-32 rounded-2xl overflow-hidden border border-white/10 hover:border-studio-neon/50 hover:scale-110 hover:-translate-y-2 transition-all duration-300 animate-fade-in-up cursor-pointer group shadow-lg">
                       <img src={h.imageUrl} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
                    </div>
                 ))}
              </div>
           </div>
        )}
      </div>
    </div>
  );
}

export default App;
