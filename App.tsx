
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ImageUpload } from './components/ImageUpload';
import { Button } from './components/Button';
import { ChatInterface } from './components/ChatInterface';
import { ImageCropper } from './components/ImageCropper';
import { generateEditedImage } from './services/geminiService';
import { generateInstantVideo } from './services/clientVideoService';
import { saveHistoryItem, getHistory, deleteHistoryItem, clearHistoryDB } from './services/storageService';
import { DEFAULT_PROMPT, BACKGROUND_PRESETS, QUALITY_MODIFIERS, LIGHTING_STYLES, COLOR_GRADING_STYLES, PROMPT_SUGGESTIONS, LOADING_MESSAGES } from './constants';
import { ProcessingState, AspectRatio, HistoryItem, Language, ChatMessage, SavedPrompt, BackgroundConfig, QualityMode, LightingIntensity, ColorGradingStyle, Theme } from './types';
import { translations } from './translations';

function App() {
  const [language, setLanguage] = useState<Language>('en');
  const [theme, setTheme] = useState<Theme>('dark');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>(DEFAULT_PROMPT);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [quality, setQuality] = useState<QualityMode>('high');
  const [status, setStatus] = useState<ProcessingState>({ isLoading: false, error: null });
  const [isCustomPromptOpen, setIsCustomPromptOpen] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  // Cropper State
  const [isCropping, setIsCropping] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);

  // Loading Message State
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  // New Advanced Settings
  const [skinTexture, setSkinTexture] = useState<boolean>(true);
  const [faceDetail, setFaceDetail] = useState<number>(50); // 0-100
  const [lighting, setLighting] = useState<LightingIntensity>('cinematic');
  const [colorGrading, setColorGrading] = useState<ColorGradingStyle>('none');
  
  // Animation State
  const [isAnimating, setIsAnimating] = useState(false);
  const [videoResult, setVideoResult] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'image' | 'video'>('image');

  // Background State
  const [backgroundConfig, setBackgroundConfig] = useState<BackgroundConfig>({ type: 'preset', value: 'default' });
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Saved Prompts State
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [isNamingPreset, setIsNamingPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  // Logo Data URI (Sobh Omid - Yellow BG, Green Text)
  const LOGO_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23facc15"/><path d="M50 5 C 25 5 5 25 5 50 C 5 75 25 95 50 95 C 75 95 95 75 95 50 C 95 25 75 5 50 5 Z" fill="%23facc15"/><text x="50" y="45" font-family="Tahoma, Arial, sans-serif" font-weight="bold" font-size="30" text-anchor="middle" fill="%2314532d">صبح</text><text x="50" y="78" font-family="Tahoma, Arial, sans-serif" font-weight="bold" font-size="30" text-anchor="middle" fill="%2314532d">امید</text></svg>`;

  const t = translations[language];

  // Apply Theme Class
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Rotate Loading Messages
  useEffect(() => {
    let interval: any;
    if (status.isLoading && !isAnimating) {
      setLoadingMessageIndex(0);
      interval = setInterval(() => {
        setLoadingMessageIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [status.isLoading, isAnimating]);

  // Load saved prompts from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('cinematic_ai_saved_prompts');
    if (saved) {
      try {
        setSavedPrompts(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved prompts", e);
      }
    }
  }, []);

  // Load history from IndexedDB on mount
  useEffect(() => {
    getHistory().then(items => {
      setHistory(items);
    }).catch(err => console.error("Failed to load history", err));
  }, []);

  // Save prompts to local storage whenever they change
  useEffect(() => {
    localStorage.setItem('cinematic_ai_saved_prompts', JSON.stringify(savedPrompts));
  }, [savedPrompts]);

  // Helper to add to history (and storage)
  const addToHistory = async (image: string, p: string, ar: AspectRatio) => {
    const newItem: HistoryItem = {
      id: Date.now().toString() + Math.random().toString(36).substring(2),
      imageUrl: image,
      prompt: p,
      aspectRatio: ar,
      timestamp: Date.now(),
      skinTexture,
      faceDetail,
      lighting,
      colorGrading
    };
    
    // Update State
    setHistory(prev => [newItem, ...prev]);
    
    // Save to DB
    try {
      await saveHistoryItem(newItem);
    } catch (e) {
      console.error("Failed to save history item", e);
    }
  };

  const handleClearHistory = async () => {
    if (window.confirm(language === 'fa' ? 'آیا مطمئن هستید که می‌خواهید تمام تاریخچه را پاک کنید؟' : 'Are you sure you want to clear all history?')) {
      try {
        await clearHistoryDB();
        setHistory([]);
      } catch (e) {
        console.error("Failed to clear history", e);
      }
    }
  };

  const handleDeleteHistoryItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteHistoryItem(id);
      setHistory(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      console.error("Failed to delete item", err);
    }
  };

  // When a new image is selected, reset the result
  const handleImageSelected = useCallback((base64: string) => {
    if (base64) {
      setSelectedImage(base64);
    } else {
      setSelectedImage(null);
    }
    setResultImage(null);
    setVideoResult(null);
    setActiveTab('image');
    setStatus({ isLoading: false, error: null });
    setChatMessages([]); 
  }, []);

  // Crop Logic
  const startCrop = () => {
    if (selectedImage) {
      setImageToCrop(selectedImage);
      setIsCropping(true);
    }
  };

  const handleCropComplete = (croppedBase64: string) => {
    setSelectedImage(croppedBase64);
    setIsCropping(false);
    setImageToCrop(null);
  };

  const handleGenerate = async () => {
    if (!selectedImage) return;

    setStatus({ isLoading: true, error: null });
    setResultImage(null);
    setVideoResult(null);
    setActiveTab('image');
    setChatMessages([]);

    try {
      // Construct final prompt with all settings
      let finalPrompt = prompt;

      // 1. Skin Texture
      if (skinTexture) {
        finalPrompt += ", hyper-realistic skin texture, subtle pores, natural imperfections, authentic skin details";
      }

      // 2. Face Detail Intensity (0-100)
      if (faceDetail > 75) {
         finalPrompt += ", ultra-detailed facial features, sharp focus on eyes and lips, micro-details";
      } else if (faceDetail > 50) {
         finalPrompt += ", detailed facial features, clear focus";
      } else if (faceDetail < 25) {
         finalPrompt += ", soft focus, smooth features";
      }

      // 3. Lighting Style
      finalPrompt += `, ${LIGHTING_STYLES[lighting]}`;

      // 4. Color Grading
      if (colorGrading !== 'none') {
        finalPrompt += `, ${COLOR_GRADING_STYLES[colorGrading]}`;
      }

      // 5. General Quality
      finalPrompt += QUALITY_MODIFIERS[quality];
      
      // 6. Background settings
      if (backgroundConfig.type === 'preset' && backgroundConfig.value !== 'default') {
        const preset = BACKGROUND_PRESETS.find(p => p.id === backgroundConfig.value);
        if (preset) {
           finalPrompt += `, ${preset.prompt}`;
        }
      } else if (backgroundConfig.type === 'custom_color') {
         finalPrompt += `, solid ${backgroundConfig.value} color background`;
      }

      const generatedImageBase64 = await generateEditedImage(selectedImage, finalPrompt, aspectRatio);
      setResultImage(generatedImageBase64);
      await addToHistory(generatedImageBase64, finalPrompt, aspectRatio);
    } catch (error: any) {
      setStatus({ 
        isLoading: false, 
        error: error.message || t.errorGeneric 
      });
    } finally {
      setStatus(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleAnimate = async () => {
    if (!resultImage) return;

    setIsAnimating(true);
    setStatus({ isLoading: true, error: null });
    try {
      // Use client-side generation (Instant, no API Key)
      const videoUrl = await generateInstantVideo(resultImage);
      setVideoResult(videoUrl);
      setActiveTab('video');
    } catch (error: any) {
      console.error("Animation failed", error);
      setStatus({ isLoading: false, error: error.message || "Animation failed" });
    } finally {
      setIsAnimating(false);
      setStatus(prev => prev.error ? prev : { ...prev, isLoading: false });
    }
  };

  const handleChatEdit = async (text: string) => {
    // Determine source image: use result if available, otherwise original
    const sourceImage = resultImage || selectedImage;
    if (!sourceImage) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      timestamp: Date.now()
    };
    setChatMessages(prev => [...prev, userMsg]);
    setStatus({ isLoading: true, error: null });
    setVideoResult(null);
    setActiveTab('image');

    try {
      let editPrompt = text;
      editPrompt += QUALITY_MODIFIERS[quality];
      editPrompt += `, ${LIGHTING_STYLES[lighting]}`;

      const newImage = await generateEditedImage(sourceImage, editPrompt, aspectRatio);
      setResultImage(newImage);
      await addToHistory(newImage, editPrompt, aspectRatio);

      const modelMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: language === 'fa' ? 'تصویر ویرایش شد.' : 'Image updated.',
        timestamp: Date.now()
      };
      setChatMessages(prev => [...prev, modelMsg]);

    } catch (error: any) {
      setStatus({ 
        isLoading: false, 
        error: error.message || t.errorGeneric 
      });
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: language === 'fa' ? 'خطا در ویرایش تصویر.' : 'Failed to edit image.',
        timestamp: Date.now()
      };
      setChatMessages(prev => [...prev, errorMsg]);
    } finally {
      setStatus(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleDownload = async () => {
    if (activeTab === 'video' && videoResult) {
       const link = document.createElement('a');
       link.href = videoResult;
       link.download = `cinematic-video-${Date.now()}.webm`;
       document.body.appendChild(link);
       link.click();
       document.body.removeChild(link);
       return;
    }

    if (resultImage) {
      try {
        const response = await fetch(resultImage);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `cinematic-portrait-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } catch (e) {
        console.error("Download failed", e);
        const link = document.createElement('a');
        link.href = resultImage;
        link.download = `cinematic-portrait-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  };

  const restoreHistoryItem = (item: HistoryItem) => {
    setResultImage(item.imageUrl);
    setPrompt(item.prompt.split(',')[0]);
    setAspectRatio(item.aspectRatio);
    if (item.skinTexture !== undefined) setSkinTexture(item.skinTexture);
    if (item.faceDetail !== undefined) setFaceDetail(item.faceDetail);
    if (item.lighting) setLighting(item.lighting);
    if (item.colorGrading) setColorGrading(item.colorGrading);
    
    setVideoResult(null);
    setActiveTab('image');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setChatMessages([]);
  };

  const handleSavePreset = () => {
    if (!newPresetName.trim()) return;
    const newPreset: SavedPrompt = {
      id: Date.now().toString(),
      name: newPresetName.trim(),
      text: prompt
    };
    setSavedPrompts([...savedPrompts, newPreset]);
    setNewPresetName('');
    setIsNamingPreset(false);
  };

  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedPrompts(savedPrompts.filter(p => p.id !== id));
  };

  const ASPECT_RATIOS: AspectRatio[] = ["AUTO", "1:1", "3:4", "4:3", "9:16", "16:9", "21:9"];

  return (
    <div dir={language === 'fa' ? 'rtl' : 'ltr'} className={`min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100 flex flex-col font-sans transition-colors duration-300`}>
      {/* Cropper Modal */}
      {isCropping && imageToCrop && (
        <ImageCropper
          imageSrc={imageToCrop}
          onCropComplete={handleCropComplete}
          onCancel={() => { setIsCropping(false); setImageToCrop(null); }}
          confirmLabel={t.applyCrop}
          cancelLabel={t.cancelCrop}
          instructions={t.cropInstructions}
        />
      )}

      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 backdrop-blur-lg sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
             {/* Logo */}
             <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-green-700 bg-yellow-400 flex items-center justify-center shrink-0 shadow-md">
                <img
                  src={LOGO_SVG}
                  alt="Sobh Omid Logo"
                  className="w-full h-full object-cover"
                />
             </div>
             
             <div className="flex flex-col">
                <h1 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white leading-tight">
                  {t.instituteName}
                </h1>
                <span className="text-xs md:text-sm text-gray-500 dark:text-gray-400 font-medium">
                   {t.appTitle}
                </span>
             </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <button
               onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
               className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
               title={theme === 'light' ? t.themeDark : t.themeLight}
            >
              {theme === 'light' ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                   <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                </svg>
              )}
            </button>

            <div className="flex items-center border border-gray-300 dark:border-gray-700 rounded-md overflow-hidden">
              <button 
                onClick={() => setLanguage('en')}
                className={`px-3 py-1 text-sm font-medium transition-colors ${language === 'en' ? 'bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white' : 'bg-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
              >
                En
              </button>
              <div className="w-px bg-gray-300 dark:bg-gray-700 h-full"></div>
              <button 
                onClick={() => setLanguage('fa')}
                className={`px-3 py-1 text-sm font-medium transition-colors ${language === 'fa' ? 'bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white' : 'bg-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
              >
                فا
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 items-start mb-16">
          
          {/* Left Column: Input */}
          <section className="flex flex-col gap-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">{t.uploadTitle}</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">{t.uploadDesc}</p>
            </div>

            <div className="relative group">
              <ImageUpload 
                onImageSelected={handleImageSelected} 
                selectedImage={selectedImage}
              />
              {selectedImage && (
                <button
                  onClick={startCrop}
                  className="absolute top-2 left-2 bg-black/60 hover:bg-blue-600/80 text-white p-2 rounded-full backdrop-blur-sm transition-colors z-10"
                  title={t.cropImage}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.875 6.125a1.875 1.875 0 113.75 0 1.875 1.875 0 01-3.75 0zM1.5 8.625v5.875c0 1.036.84 1.875 1.875 1.875 1.875h1.375v3.875A2.25 2.25 0 007 22.5h8a2.25 2.25 0 002.25-2.25v-1.375c1.035 0 1.875-.84 1.875-1.875V8.625A2.25 2.25 0 0016.875 6.375h-1.875A1.875 1.875 0 0113.125 4.5a2.25 2.25 0 00-2.25-2.25h-2.25A2.25 2.25 0 006.375 4.5a1.875 1.875 0 01-1.875 1.875H2.625A1.125 1.125 0 001.5 7.5v1.125z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 2.25L15.75 22.5" />
                  </svg>
                </button>
              )}
            </div>

            {/* Prompt Config Toggle */}
            <div className="bg-white dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
               <button 
                onClick={() => setIsCustomPromptOpen(!isCustomPromptOpen)}
                className="flex items-center justify-between w-full text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
               >
                 <span>{t.settings}</span>
                 <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  strokeWidth={1.5} 
                  stroke="currentColor" 
                  className={`w-4 h-4 transition-transform ${isCustomPromptOpen ? 'rotate-180' : ''}`}
                 >
                   <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                 </svg>
               </button>
               
               {isCustomPromptOpen && (
                 <div className="mt-6 space-y-6 animate-fadeIn border-t border-gray-200 dark:border-gray-700 pt-4">
                   
                   {/* Aspect Ratio Selector */}
                   <div className="space-y-3">
                    <label className="block text-xs uppercase text-gray-500 font-bold tracking-wider">
                      {t.aspectRatio}
                    </label>
                    <div className="grid grid-cols-7 gap-2">
                      {ASPECT_RATIOS.map((ratio) => {
                        const isSelected = aspectRatio === ratio;
                        
                        const getDims = (r: string) => {
                            if (r === 'AUTO') return [20, 20];
                            return r.split(':').map(Number);
                        }
                        const [w, h] = getDims(ratio);

                        const maxSize = 16;
                        const scale = Math.min(maxSize / w, maxSize / h);
                        const width = w * scale;
                        const height = h * scale;

                        return (
                        <button
                          key={ratio}
                          onClick={() => setAspectRatio(ratio)}
                          className={`
                            flex flex-col items-center justify-center gap-2 py-2 px-1 rounded-lg transition-all duration-200 border
                            ${isSelected
                              ? 'bg-blue-50 border-blue-500 text-blue-600 dark:bg-blue-600/10 dark:text-blue-400 shadow-sm' 
                              : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 hover:border-gray-300 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:border-gray-500'}
                          `}
                        >
                          <div className="h-5 flex items-center justify-center">
                             {ratio === 'AUTO' ? (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                                </svg>
                             ) : (
                               <div 
                                 className={`border ${isSelected ? 'border-blue-500 bg-blue-500/20' : 'border-current opacity-50'}`}
                                 style={{ width: `${width}px`, height: `${height}px` }}
                               />
                             )}
                          </div>
                          <span className="text-[9px] font-bold">{ratio === 'AUTO' ? t.ratioAuto : ratio}</span>
                        </button>
                      )})}
                    </div>
                   </div>

                   {/* Skin Texture Toggle & Face Detail */}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs uppercase text-gray-500 font-bold tracking-wider">
                            {t.skinTexture}
                          </label>
                          <button 
                            onClick={() => setSkinTexture(!skinTexture)}
                            className={`w-10 h-5 rounded-full transition-colors relative ${skinTexture ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'}`}
                          >
                             <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-transform ${skinTexture ? 'left-6' : 'left-1'}`}></div>
                          </button>
                        </div>
                        <p className="text-[10px] text-gray-500">{skinTexture ? 'Enabled' : 'Disabled'}</p>
                     </div>
                     
                     <div className="space-y-3">
                        <label className="block text-xs uppercase text-gray-500 font-bold tracking-wider flex justify-between">
                          {t.faceDetail}
                          <span className="text-blue-600 dark:text-blue-400">{faceDetail}%</span>
                        </label>
                        <input 
                          type="range" 
                          min="0" 
                          max="100" 
                          value={faceDetail} 
                          onChange={(e) => setFaceDetail(parseInt(e.target.value))}
                          className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                     </div>
                   </div>

                   {/* Lighting Intensity */}
                   <div className="space-y-3">
                      <label className="block text-xs uppercase text-gray-500 font-bold tracking-wider">
                        {t.lightingIntensity}
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {(['soft', 'cinematic', 'dramatic', 'intense'] as LightingIntensity[]).map((mode) => (
                           <button
                             key={mode}
                             onClick={() => setLighting(mode)}
                             className={`
                               py-2 px-1 text-[10px] font-semibold rounded-lg border transition-all
                               ${lighting === mode 
                                 ? 'bg-yellow-50 border-yellow-500 text-yellow-700 dark:bg-yellow-600/20 dark:text-yellow-500' 
                                 : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-400 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:border-gray-500'}
                             `}
                           >
                              {mode === 'soft' && t.lightSoft}
                              {mode === 'cinematic' && t.lightCinematic}
                              {mode === 'dramatic' && t.lightDramatic}
                              {mode === 'intense' && t.lightIntense}
                           </button>
                        ))}
                      </div>
                   </div>

                   {/* Color Grading */}
                   <div className="space-y-3">
                      <label className="block text-xs uppercase text-gray-500 font-bold tracking-wider">
                        {t.colorGrading}
                      </label>
                      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                         {(['none', 'warm_vintage', 'cool_noir', 'teal_orange', 'classic_bw'] as ColorGradingStyle[]).map((style) => (
                           <button
                             key={style}
                             onClick={() => setColorGrading(style)}
                             className={`
                               shrink-0 px-3 py-1.5 text-[10px] font-semibold rounded-full border transition-all whitespace-nowrap
                               ${colorGrading === style 
                                 ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                                 : 'bg-transparent border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}
                             `}
                           >
                              {style === 'none' && t.gradeNone}
                              {style === 'warm_vintage' && t.gradeVintage}
                              {style === 'cool_noir' && t.gradeNoir}
                              {style === 'teal_orange' && t.gradeTealOrange}
                              {style === 'classic_bw' && t.gradeBW}
                           </button>
                         ))}
                      </div>
                   </div>

                    {/* Background Selection */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs uppercase text-gray-500 font-bold tracking-wider">{t.backgroundStyle}</label>
                        {backgroundConfig.type === 'custom_color' && (
                           <span className="text-[10px] text-gray-400">{backgroundConfig.value}</span>
                        )}
                      </div>
                      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                        {BACKGROUND_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            onClick={() => setBackgroundConfig({ type: 'preset', value: preset.id })}
                            className={`group relative shrink-0 w-10 h-10 rounded-full border-2 transition-all ${backgroundConfig.type === 'preset' && backgroundConfig.value === preset.id ? 'border-blue-500 scale-110 shadow-lg' : 'border-gray-200 dark:border-gray-700 hover:border-gray-400'}`}
                            title={t[preset.labelKey] || preset.labelKey}
                            style={{ background: preset.color }}
                          >
                             {/* Checkmark overlay for selected */}
                             {backgroundConfig.type === 'preset' && backgroundConfig.value === preset.id && (
                               <div className="absolute inset-0 flex items-center justify-center">
                                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white drop-shadow-md">
                                   <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
                                 </svg>
                               </div>
                             )}
                          </button>
                        ))}
                        
                        {/* Custom Color Picker Button */}
                        <div className="relative shrink-0 w-10 h-10 rounded-full border-2 border-dashed border-gray-400 dark:border-gray-600 flex items-center justify-center overflow-hidden hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                           <input 
                             type="color" 
                             className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                             onChange={(e) => setBackgroundConfig({ type: 'custom_color', value: e.target.value })}
                             value={backgroundConfig.type === 'custom_color' ? backgroundConfig.value : '#000000'}
                             title={t.customColor}
                           />
                           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-500">
                             <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.85 6.361a15.996 15.996 0 00-4.647 4.763m0 0a3.001 3.001 0 00-2.25 2.25m3.24-3.375a3 3 0 00-1.425-1.425" />
                           </svg>
                        </div>
                      </div>
                    </div>
                 </div>
               )}
            </div>

            {/* Prompt Input & Suggestions */}
            <div className="space-y-4">
              {/* Suggestions */}
              <div className="space-y-2">
                 <label className="text-xs uppercase text-gray-500 font-bold tracking-wider">{t.suggestions}</label>
                 <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                   {PROMPT_SUGGESTIONS.map(s => (
                     <button
                       key={s.id}
                       onClick={() => setPrompt(s.prompt)}
                       className={`shrink-0 px-3 py-2 rounded-lg text-xs font-medium text-white bg-gradient-to-br ${s.color} hover:opacity-90 transition-opacity shadow-sm`}
                     >
                       {t[s.labelKey] || s.labelKey}
                     </button>
                   ))}
                 </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t.promptInstructions}</label>
                <div className="flex gap-2">
                   {savedPrompts.length > 0 && (
                     <select 
                       className="text-xs border border-gray-300 dark:border-gray-700 rounded px-2 py-1 bg-transparent dark:text-gray-300"
                       onChange={(e) => {
                         if (e.target.value) setPrompt(e.target.value);
                       }}
                       value=""
                     >
                       <option value="" disabled>{t.savedPresets}</option>
                       {savedPrompts.map(p => (
                         <option key={p.id} value={p.text}>{p.name}</option>
                       ))}
                     </select>
                   )}
                   <button 
                    onClick={() => setPrompt(DEFAULT_PROMPT)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                   >
                    {t.resetPrompt}
                   </button>
                </div>
              </div>

              <div className="relative">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full h-32 p-4 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm dark:text-white"
                  placeholder="Describe your desired portrait style..."
                />
                
                {/* Save Preset UI */}
                <div className="absolute bottom-3 right-3 flex gap-2">
                  {isNamingPreset ? (
                    <div className="flex items-center gap-1 bg-white dark:bg-gray-900 shadow-md rounded-lg p-1 border border-gray-200 dark:border-gray-700 animate-fadeIn">
                       <input 
                         type="text" 
                         className="text-xs border-none focus:ring-0 bg-transparent w-24 dark:text-white" 
                         placeholder={t.presetName}
                         value={newPresetName}
                         onChange={(e) => setNewPresetName(e.target.value)}
                         autoFocus
                       />
                       <button onClick={handleSavePreset} className="text-green-600 p-1 hover:bg-green-50 dark:hover:bg-green-900/30 rounded"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg></button>
                       <button onClick={() => setIsNamingPreset(false)} className="text-red-500 p-1 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg></button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setIsNamingPreset(true)}
                      className="text-xs text-gray-500 hover:text-blue-600 bg-gray-100 dark:bg-gray-700/50 px-2 py-1 rounded transition-colors"
                      title={t.savePreset}
                    >
                      {t.save}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <Button 
              onClick={handleGenerate}
              isLoading={status.isLoading}
              disabled={!selectedImage}
              className="w-full text-lg shadow-xl shadow-blue-500/20"
            >
              {status.isLoading ? (isAnimating ? t.animating : t[LOADING_MESSAGES[loadingMessageIndex]] || t.processing) : t.generate}
            </Button>

            {status.error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-800 text-sm animate-fadeIn">
                {status.error}
              </div>
            )}
          </section>

          {/* Right Column: Result */}
          <section className="flex flex-col h-full gap-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">{t.resultTitle}</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">{t.resultDesc}</p>
            </div>

            <div className="flex-1 min-h-[500px] bg-gray-100 dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center relative overflow-hidden group">
              {resultImage ? (
                <div className="w-full h-full flex flex-col">
                  {/* Tabs */}
                  {videoResult && (
                    <div className="flex w-full border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                       <button 
                         onClick={() => setActiveTab('image')}
                         className={`flex-1 py-3 text-sm font-medium ${activeTab === 'image' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                       >
                         {t.viewImage}
                       </button>
                       <button 
                         onClick={() => setActiveTab('video')}
                         className={`flex-1 py-3 text-sm font-medium ${activeTab === 'video' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                       >
                         {t.viewVideo}
                       </button>
                    </div>
                  )}

                  <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
                    {activeTab === 'image' ? (
                       <img 
                        src={resultImage} 
                        alt="Generated Portrait" 
                        className="max-h-full max-w-full object-contain animate-zoomIn shadow-2xl hover:scale-[1.03] transition-transform duration-500 ease-out"
                       />
                    ) : (
                       <video 
                         src={videoResult!} 
                         controls 
                         loop
                         autoPlay
                         muted
                         playsInline
                         className="max-h-full max-w-full object-contain animate-fadeIn"
                       />
                    )}
                  </div>
                  
                  {/* Action Bar */}
                  <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex flex-col md:flex-row gap-3">
                     <Button onClick={handleDownload} variant="primary" className="flex-1">
                       <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                         <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M12 12.75l-6-6M12 12.75l6-6M12 12.75V3" />
                       </svg>
                       {activeTab === 'video' ? t.downloadVideo : t.download}
                     </Button>
                     
                     {!videoResult && (
                       <Button onClick={handleAnimate} variant="secondary" className="flex-1" isLoading={isAnimating}>
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                         </svg>
                         {t.animate}
                       </Button>
                     )}
                  </div>

                  {/* Chat Interface */}
                  <div className="border-t border-gray-200 dark:border-gray-700">
                    <ChatInterface 
                      messages={chatMessages}
                      onSendMessage={handleChatEdit}
                      isLoading={status.isLoading}
                      language={language}
                      disabled={!resultImage || isAnimating}
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center p-8 opacity-50">
                   {status.isLoading ? (
                     <div className="flex flex-col items-center gap-4">
                       <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                       <p className="text-lg font-medium animate-pulse">{t.refining}</p>
                     </div>
                   ) : (
                     <>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-20 h-20 mx-auto mb-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                        </svg>
                        <p className="text-xl font-medium">{t.noResult}</p>
                        <p className="text-sm">{t.noResultDesc}</p>
                     </>
                   )}
                </div>
              )}
            </div>
            
            <div className="text-center">
               <p className="text-xs text-gray-400 font-medium flex items-center justify-center gap-1">
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-blue-500">
                    <path fillRule="evenodd" d="M9.315 7.584C12.195 3.883 16.695 1.5 21.75 1.5a.75.75 0 01.75.75c0 5.056-2.383 9.555-6.084 12.436-3.118 2.424-7.141 3.814-11.416 3.814a.75.75 0 010-1.5c4.275 0 8.298-1.39 11.416-3.814a16.416 16.416 0 00-4.46-4.46c-2.424 3.118-3.814 7.141-3.814 11.416a.75.75 0 01-1.5 0c0-4.275 1.39-8.298 3.814-11.416zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                 </svg>
                 {t.poweredBy}
               </p>
            </div>
          </section>
        </div>

        {/* History Section */}
        {history.length > 0 && (
          <section className="max-w-6xl mx-auto border-t border-gray-200 dark:border-gray-800 pt-8 animate-fadeIn">
             <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                     <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                   </svg>
                   {t.history} 
                   <span className="text-sm font-normal text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full ml-2">{history.length} {t.items}</span>
                </h3>
                <button 
                  onClick={handleClearHistory}
                  className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-lg transition-colors"
                >
                   {t.clearHistory}
                </button>
             </div>
             
             <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
               {history.map((item) => (
                 <div 
                   key={item.id} 
                   onClick={() => restoreHistoryItem(item)}
                   className="group relative aspect-square rounded-xl overflow-hidden cursor-pointer border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg transition-all hover:scale-[1.02]"
                   title={item.prompt} // Tooltip
                 >
                    <img 
                      src={item.imageUrl} 
                      alt="History" 
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                       <span className="text-white text-xs font-semibold px-2 py-1 bg-black/60 rounded-lg backdrop-blur-sm border border-white/20">
                         {t.view}
                       </span>
                    </div>
                    {/* Delete Button */}
                    <button
                      onClick={(e) => handleDeleteHistoryItem(item.id, e)}
                      className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                      title={t.delete}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                      </svg>
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                      <p className="text-[10px] text-gray-300 truncate">{new Date(item.timestamp).toLocaleTimeString()}</p>
                    </div>
                 </div>
               ))}
             </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
