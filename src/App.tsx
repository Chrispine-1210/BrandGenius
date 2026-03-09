import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Upload, 
  Image as ImageIcon, 
  CreditCard, 
  Layout, 
  FileText, 
  RefreshCw, 
  Download,
  CheckCircle2,
  Sparkles,
  Layers,
  Key,
  ExternalLink,
  Undo2,
  Redo2,
  Save,
  Trash2,
  ChevronUp,
  ChevronDown,
  Edit3,
  X,
  AlertCircle,
  History,
  Maximize2,
  Plus,
  Instagram,
  Twitter,
  Linkedin,
  Type,
  Smartphone,
  Globe,
  Monitor,
  Mail,
  Shirt,
  Palette as PaletteIcon,
  Moon,
  Sun
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateBranding, extractPalette, analyzeBrand, GenerationResult, BrandAnalysis } from './services/gemini';

// Extend window interface for AI Studio global methods
declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

interface BrandAsset {
  id: string;
  type: 'icon' | 'variation' | 'business-card' | 'social-banner' | 'letterhead' | 'instagram' | 'twitter' | 'linkedin' | 'website-mockup' | 'email-signature' | 'merchandise-mockup';
  url: string;
  label: string;
  status: 'idle' | 'loading' | 'completed' | 'error';
  error?: string;
  customPrompt?: string;
}

interface BrandState {
  logo: string | null;
  mimeType: string;
  palette: string[];
  assets: BrandAsset[];
}

interface SavedBrand extends BrandState {
  id: string;
  timestamp: number;
  name: string;
}

export default function App() {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [originalLogo, setOriginalLogo] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('');
  const [palette, setPalette] = useState<string[]>([]);
  const [isExtractingPalette, setIsExtractingPalette] = useState(false);
  const [brandAnalysis, setBrandAnalysis] = useState<BrandAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showBoard, setShowBoard] = useState(false);
  const [assets, setAssets] = useState<BrandAsset[]>([
    { id: '1', type: 'icon', url: '', label: 'App Icon', status: 'idle' },
    { id: '2', type: 'variation', url: '', label: 'Logo Variation', status: 'idle' },
    { id: '3', type: 'business-card', url: '', label: 'Business Card', status: 'idle' },
    { id: '4', type: 'social-banner', url: '', label: 'Social Banner', status: 'idle' },
    { id: '5', type: 'letterhead', url: '', label: 'Letterhead', status: 'idle' },
  ]);

  const [history, setHistory] = useState<BrandState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [savedBrands, setSavedBrands] = useState<SavedBrand[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingColorIndex, setEditingColorIndex] = useState<number | null>(null);
  const [previewAssetId, setPreviewAssetId] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  useEffect(() => {
    if (brandAnalysis) {
      const fonts = [brandAnalysis.typography.primary, brandAnalysis.typography.secondary];
      const link = document.createElement('link');
      link.href = `https://fonts.googleapis.com/css2?family=${fonts.map(f => f.replace(/\s+/g, '+')).join('&family=')}&display=swap`;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
      return () => {
        document.head.removeChild(link);
      };
    }
  }, [brandAnalysis]);

  // Persistence
  useEffect(() => {
    const saved = localStorage.getItem('brandgenius_saved');
    if (saved) {
      try {
        setSavedBrands(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load saved brands", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('brandgenius_saved', JSON.stringify(savedBrands));
  }, [savedBrands]);

  // Undo/Redo Logic
  const pushToHistory = useCallback((state: BrandState) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      return [...newHistory, state].slice(-20); // Keep last 20
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  const undo = () => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setOriginalLogo(prevState.logo);
      setMimeType(prevState.mimeType);
      setPalette(prevState.palette);
      setAssets(prevState.assets);
      setHistoryIndex(prev => prev - 1);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setOriginalLogo(nextState.logo);
      setMimeType(nextState.mimeType);
      setPalette(nextState.palette);
      setAssets(nextState.assets);
      setHistoryIndex(prev => prev + 1);
    }
  };

  const getCurrentState = (): BrandState => ({
    logo: originalLogo,
    mimeType,
    palette,
    assets
  });

  const saveBrand = () => {
    if (!originalLogo) return;
    const newBrand: SavedBrand = {
      ...getCurrentState(),
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      name: `Brand ${savedBrands.length + 1}`
    };
    setSavedBrands(prev => [newBrand, ...prev]);
  };

  const loadBrand = (brand: SavedBrand) => {
    setOriginalLogo(brand.logo);
    setMimeType(brand.mimeType);
    setPalette(brand.palette);
    setAssets(brand.assets);
    setShowSaved(false);
    pushToHistory(brand);
  };

  const deleteSavedBrand = (id: string) => {
    setSavedBrands(prev => prev.filter(b => b.id !== id));
  };

  const moveAsset = (id: string, direction: 'up' | 'down') => {
    const index = assets.findIndex(a => a.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === assets.length - 1) return;

    const newAssets = [...assets];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newAssets[index], newAssets[targetIndex]] = [newAssets[targetIndex], newAssets[index]];
    setAssets(newAssets);
    pushToHistory({ ...getCurrentState(), assets: newAssets });
  };

  const updateCustomPrompt = (id: string, prompt: string) => {
    const newAssets = assets.map(a => a.id === id ? { ...a, customPrompt: prompt } : a);
    setAssets(newAssets);
    setEditingPromptId(null);
    pushToHistory({ ...getCurrentState(), assets: newAssets });
  };

  const updateAssetName = (id: string, name: string) => {
    const newAssets = assets.map(a => a.id === id ? { ...a, label: name } : a);
    setAssets(newAssets);
    setEditingNameId(null);
    pushToHistory({ ...getCurrentState(), assets: newAssets });
  };

  const addAsset = (type: BrandAsset['type']) => {
    const labels: Record<string, string> = {
      variation: 'Logo Variation',
      instagram: 'Instagram Icon',
      twitter: 'Twitter Icon',
      linkedin: 'LinkedIn Icon',
      'website-mockup': 'Website Mockup',
      'email-signature': 'Email Signature',
      'merchandise-mockup': 'Merchandise Mockup'
    };
    const newAsset: BrandAsset = {
      id: crypto.randomUUID(),
      type,
      url: '',
      label: labels[type] || 'New Asset',
      status: 'idle'
    };
    const newAssets = [...assets, newAsset];
    setAssets(newAssets);
    pushToHistory({ ...getCurrentState(), assets: newAssets });
  };

  const removeAsset = (id: string) => {
    const newAssets = assets.filter(a => a.id !== id);
    setAssets(newAssets);
    pushToHistory({ ...getCurrentState(), assets: newAssets });
  };

  useEffect(() => {
    const checkKey = async () => {
      try {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      } catch (e) {
        console.error("Failed to check API key", e);
        setHasKey(false);
      }
    };
    checkKey();
  }, []);

  const handleOpenKeySelector = async () => {
    await window.aistudio.openSelectKey();
    setHasKey(true); // Assume success as per guidelines
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        setOriginalLogo(base64);
        setMimeType(file.type);
        
        // Extract palette
        setIsExtractingPalette(true);
        setIsAnalyzing(true);
        try {
          const [colors, analysis] = await Promise.all([
            extractPalette(base64, file.type),
            analyzeBrand(base64, file.type)
          ]);
          setPalette(colors);
          setBrandAnalysis(analysis);
          pushToHistory({ 
            ...getCurrentState(), 
            logo: base64, 
            mimeType: file.type, 
            palette: colors,
            // @ts-ignore - adding analysis to history
            analysis 
          });
        } catch (error) {
          console.error("Analysis failed", error);
          pushToHistory({ ...getCurrentState(), logo: base64, mimeType: file.type });
        } finally {
          setIsExtractingPalette(false);
          setIsAnalyzing(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const generateAsset = async (assetId: string) => {
    if (!originalLogo) return;

    const asset = assets.find(a => a.id === assetId);
    if (!asset) return;

    setAssets(prev => prev.map(a => a.id === assetId ? { ...a, status: 'loading', error: undefined } : a));

    try {
      const result = await generateBranding(originalLogo, mimeType, asset.type, asset.customPrompt);
      const newAssets = assets.map(a => a.id === assetId ? { 
        ...a, 
        url: result.imageUrl, 
        status: 'completed' 
      } : a);
      setAssets(newAssets);
      pushToHistory({ ...getCurrentState(), assets: newAssets });
    } catch (error: any) {
      console.error(error);
      const errorMessage = error.message || "Failed to generate asset. Please check your API key and try again.";
      setAssets(prev => prev.map(a => a.id === assetId ? { ...a, status: 'error', error: errorMessage } : a));
    }
  };

  const generateAll = async () => {
    if (!originalLogo) return;
    assets.forEach(asset => {
      if (asset.status !== 'loading') {
        generateAsset(asset.id);
      }
    });
  };

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename.toLowerCase().replace(/\s+/g, '-')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAll = () => {
    assets.forEach(asset => {
      if (asset.status === 'completed') {
        handleDownload(asset.url, asset.label);
      }
    });
  };

  const clearAll = () => {
    setOriginalLogo(null);
    setPalette([]);
    setAssets(prev => prev.map(a => ({ ...a, url: '', status: 'idle' })));
  };

  const copyAllColors = () => {
    navigator.clipboard.writeText(palette.join(', '));
  };

  const exportToCSS = () => {
    const css = palette.map((c, i) => `--brand-color-${i + 1}: ${c};`).join('\n');
    navigator.clipboard.writeText(css);
  };

  const updateColor = (index: number, newColor: string) => {
    const newPalette = [...palette];
    newPalette[index] = newColor;
    setPalette(newPalette);
    setEditingColorIndex(null);
    pushToHistory({ ...getCurrentState(), palette: newPalette });
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'icon': return <ImageIcon className="w-5 h-5" />;
      case 'variation': return <RefreshCw className="w-5 h-5" />;
      case 'business-card': return <CreditCard className="w-5 h-5" />;
      case 'social-banner': return <Layout className="w-5 h-5" />;
      case 'letterhead': return <FileText className="w-5 h-5" />;
      case 'instagram': return <Instagram className="w-5 h-5" />;
      case 'twitter': return <Twitter className="w-5 h-5" />;
      case 'linkedin': return <Linkedin className="w-5 h-5" />;
      case 'website-mockup': return <Monitor className="w-5 h-5" />;
      case 'email-signature': return <Mail className="w-5 h-5" />;
      case 'merchandise-mockup': return <Shirt className="w-5 h-5" />;
      default: return <ImageIcon className="w-5 h-5" />;
    }
  };

  if (hasKey === false) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] text-white flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white/5 border border-white/10 rounded-[32px] p-10 text-center space-y-8 shadow-2xl"
        >
          <div className="w-20 h-20 bg-emerald-500/20 rounded-3xl flex items-center justify-center mx-auto">
            <Key className="w-10 h-10 text-emerald-400" />
          </div>
          <div className="space-y-3">
            <h1 className="text-2xl font-bold tracking-tight">Setup Required</h1>
            <p className="text-white/40 text-sm leading-relaxed">
              To generate ultra-high quality 4K branding assets, you need to select a paid Gemini API key.
            </p>
          </div>
          <div className="space-y-4">
            <button 
              onClick={handleOpenKeySelector}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-2"
            >
              Select API Key
            </button>
            <a 
              href="https://ai.google.dev/gemini-api/docs/billing" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-white/20 hover:text-white transition-colors"
            >
              Billing Documentation
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </motion.div>
      </div>
    );
  }

  if (hasKey === null) return null;

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white font-sans selection:bg-emerald-500/30">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isInstallable && (
              <button 
                onClick={handleInstall}
                className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-full font-bold text-xs transition-all flex items-center gap-2 border border-emerald-500/20"
              >
                <Smartphone className="w-4 h-4" />
                Install App
              </button>
            )}
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)]">
              <Sparkles className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">BrandGenius</h1>
              <p className="text-xs text-white/40 font-medium uppercase tracking-widest">AI Brand Studio</p>
            </div>
          </div>
          
          {originalLogo && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-white/5 rounded-full p-1 border border-white/10 mr-2">
                <button 
                  onClick={undo}
                  disabled={historyIndex <= 0}
                  className="p-2 hover:bg-white/10 rounded-full disabled:opacity-20 transition-all"
                  title="Undo"
                >
                  <Undo2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={redo}
                  disabled={historyIndex >= history.length - 1}
                  className="p-2 hover:bg-white/10 rounded-full disabled:opacity-20 transition-all"
                  title="Redo"
                >
                  <Redo2 className="w-4 h-4" />
                </button>
              </div>

              <button 
                onClick={() => setShowSaved(!showSaved)}
                className="text-white/40 hover:text-white px-4 py-2 rounded-full font-bold text-sm transition-all flex items-center gap-2"
              >
                <History className="w-4 h-4" />
                Saved
              </button>

              <button 
                onClick={clearAll}
                className="text-white/40 hover:text-white px-4 py-2 rounded-full font-bold text-sm transition-all flex items-center gap-2"
              >
                Clear
              </button>

              <button 
                onClick={saveBrand}
                className="bg-white/10 hover:bg-white/20 text-white px-6 py-2.5 rounded-full font-bold text-sm transition-all flex items-center gap-2 border border-white/10 active:scale-95"
              >
                <Save className="w-4 h-4" />
                Save Brand
              </button>

              {assets.some(a => a.status === 'completed') && (
                <button 
                  onClick={() => setShowBoard(true)}
                  className="bg-white/10 hover:bg-white/20 text-white px-6 py-2.5 rounded-full font-bold text-sm transition-all flex items-center gap-2 border border-white/10 active:scale-95"
                >
                  <Layout className="w-4 h-4" />
                  Brand Board
                </button>
              )}
              {assets.some(a => a.status === 'completed') && (
                <button 
                  onClick={downloadAll}
                  className="bg-white/10 hover:bg-white/20 text-white px-6 py-2.5 rounded-full font-bold text-sm transition-all flex items-center gap-2 border border-white/10 active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  Download All
                </button>
              )}
              <button 
                onClick={generateAll}
                className="bg-emerald-500 hover:bg-emerald-400 text-black px-6 py-2.5 rounded-full font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                {assets.some(a => a.status === 'completed') ? 'Regenerate All' : 'Generate Full Identity'}
              </button>
            </div>
          )}
        </div>
      </header>

      <AnimatePresence>
        {showSaved && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="fixed inset-y-0 right-0 w-80 bg-[#0A0A0B] border-l border-white/10 z-[60] shadow-2xl p-6 overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-lg font-bold">Saved Brands</h2>
              <button onClick={() => setShowSaved(false)} className="p-2 hover:bg-white/5 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {savedBrands.length === 0 ? (
                <p className="text-white/20 text-sm text-center py-12">No saved brands yet.</p>
              ) : (
                savedBrands.map(brand => (
                  <div key={brand.id} className="group bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3 hover:border-emerald-500/30 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm">{brand.name}</span>
                      <button onClick={() => deleteSavedBrand(brand.id)} className="p-1 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="aspect-square bg-black/40 rounded-xl flex items-center justify-center p-4">
                      {brand.logo && <img src={brand.logo} className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />}
                    </div>
                    <button 
                      onClick={() => loadBrand(brand)}
                      className="w-full bg-white/5 hover:bg-white/10 py-2 rounded-xl text-xs font-bold transition-all"
                    >
                      Load Brand
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBoard && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-[100] overflow-y-auto p-12"
          >
            <div className="max-w-6xl mx-auto space-y-12">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center">
                    <Sparkles className="text-white w-10 h-10" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight">Brand Identity Board</h2>
                    <p className="text-white/40 uppercase tracking-widest font-bold text-sm">Generated by BrandGenius AI</p>
                  </div>
                </div>
                <button onClick={() => setShowBoard(false)} className="p-4 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-8 h-8" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-1 space-y-8">
                  <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 space-y-6">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-white/40">Primary Identity</h3>
                    <div className="aspect-square bg-black/40 rounded-2xl flex items-center justify-center p-8">
                      {originalLogo && <img src={originalLogo} className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />}
                    </div>
                    {brandAnalysis && (
                      <div className="space-y-4">
                        <p className="text-xl italic text-emerald-400" style={{ fontFamily: brandAnalysis.typography.primary }}>"{brandAnalysis.tagline}"</p>
                        <div className="flex flex-wrap gap-2">
                          {brandAnalysis.personality.map(p => (
                            <span key={p} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest">{p}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 space-y-6">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-white/40">Color Palette</h3>
                    <div className="grid grid-cols-5 gap-2">
                      {palette.map(color => (
                        <div key={color} className="aspect-square rounded-lg border border-white/10" style={{ backgroundColor: color }} />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 grid grid-cols-2 gap-6">
                  {assets.filter(a => a.status === 'completed').map(asset => (
                    <div key={asset.id} className="bg-white/5 border border-white/10 rounded-[32px] overflow-hidden">
                      <div className="p-4 border-b border-white/5 flex items-center gap-3">
                        <div className="w-6 h-6 text-emerald-400">{getIcon(asset.type)}</div>
                        <span className="text-xs font-bold uppercase tracking-widest">{asset.label}</span>
                      </div>
                      <div className="aspect-video">
                        <img src={asset.url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {previewAssetId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-12"
            onClick={() => setPreviewAssetId(null)}
          >
            <button className="absolute top-8 right-8 p-3 hover:bg-white/10 rounded-full transition-colors">
              <X className="w-8 h-8" />
            </button>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="max-w-5xl w-full aspect-video bg-black/40 rounded-[40px] border border-white/10 overflow-hidden flex items-center justify-center relative"
              onClick={(e) => e.stopPropagation()}
            >
              {assets.find(a => a.id === previewAssetId)?.url && (
                <img 
                  src={assets.find(a => a.id === previewAssetId)!.url} 
                  className="w-full h-full object-contain" 
                  referrerPolicy="no-referrer" 
                />
              )}
              <div className="absolute bottom-8 left-8 right-8 flex items-center justify-between bg-black/40 backdrop-blur-md p-6 rounded-3xl border border-white/10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center">
                    {getIcon(assets.find(a => a.id === previewAssetId)!.type)}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{assets.find(a => a.id === previewAssetId)!.label}</h3>
                    <p className="text-sm text-white/40 uppercase tracking-widest font-bold">Generated Identity Asset</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleDownload(assets.find(a => a.id === previewAssetId)!.url, assets.find(a => a.id === previewAssetId)!.label)}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black px-8 py-3 rounded-2xl font-bold transition-all flex items-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Download 4K Asset
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Left Column: Source */}
          <div className="lg:col-span-4 space-y-8">
            <section>
              <h2 className="text-sm font-semibold text-white/40 uppercase tracking-widest mb-6">Source Logo</h2>
              
              {!originalLogo ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-3xl border-2 border-dashed border-white/10 bg-white/5 hover:bg-white/10 hover:border-emerald-500/50 transition-all cursor-pointer flex flex-col items-center justify-center gap-4 group"
                >
                  <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload className="w-8 h-8 text-white/40 group-hover:text-emerald-400" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold">Upload Logo</p>
                    <p className="text-sm text-white/40">PNG, JPG or SVG</p>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    className="hidden" 
                    accept="image/*"
                  />
                </div>
              ) : (
                <div className="relative group">
                  <div className="aspect-square rounded-3xl bg-white/5 border border-white/10 p-8 flex items-center justify-center overflow-hidden">
                    <img 
                      src={originalLogo} 
                      alt="Original Logo" 
                      className="max-w-full max-h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <button 
                    onClick={() => setOriginalLogo(null)}
                    className="absolute -top-3 -right-3 w-8 h-8 bg-white/10 hover:bg-red-500/20 hover:text-red-400 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              )}
            </section>

            <section className="bg-white/5 rounded-3xl border border-white/10 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2 text-sm uppercase tracking-widest text-white/40">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  Brand Palette
                </h3>
                {palette.length > 0 && (
                  <div className="flex gap-2">
                    <button onClick={copyAllColors} className="text-[10px] font-bold uppercase tracking-widest text-white/20 hover:text-white transition-colors">Copy All</button>
                    <button onClick={exportToCSS} className="text-[10px] font-bold uppercase tracking-widest text-white/20 hover:text-white transition-colors">CSS</button>
                  </div>
                )}
              </div>
              
              {isExtractingPalette ? (
                <div className="flex gap-2 animate-pulse">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="w-10 h-10 rounded-xl bg-white/10" />
                  ))}
                </div>
              ) : palette.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {palette.map((color, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: idx * 0.1 }}
                      className="group relative"
                    >
                      <div 
                        className="w-10 h-10 rounded-xl border border-white/10 shadow-lg cursor-pointer transition-transform hover:scale-110 active:scale-95 overflow-hidden"
                        style={{ backgroundColor: color }}
                        onClick={() => setEditingColorIndex(idx)}
                        title={`Edit ${color}`}
                      />
                      {editingColorIndex === idx && (
                        <div className="absolute top-full left-0 mt-2 z-50 bg-[#121214] border border-white/10 rounded-xl p-2 shadow-2xl">
                          <input 
                            type="color" 
                            defaultValue={color}
                            className="w-8 h-8 bg-transparent border-none cursor-pointer"
                            onBlur={(e) => updateColor(idx, e.target.value)}
                            onChange={(e) => updateColor(idx, e.target.value)}
                          />
                        </div>
                      )}
                      <span 
                        className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-mono text-white/20 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap cursor-pointer hover:text-emerald-400"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(color);
                        }}
                      >
                        {color}
                      </span>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-white/20 italic">Upload a logo to extract its unique color DNA.</p>
              )}
            </section>

            <section className="bg-white/5 rounded-3xl border border-white/10 p-6 space-y-6">
              <h3 className="font-bold flex items-center gap-2 text-sm uppercase tracking-widest text-white/40">
                <Layers className="w-4 h-4 text-emerald-400" />
                Brand Personality
              </h3>
              
              {isAnalyzing ? (
                <div className="space-y-4 animate-pulse">
                  <div className="h-4 bg-white/10 rounded w-3/4" />
                  <div className="flex gap-2">
                    {[1, 2, 3].map(i => <div key={i} className="h-6 bg-white/10 rounded-full w-16" />)}
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 bg-white/10 rounded w-full" />
                    <div className="h-3 bg-white/10 rounded w-5/6" />
                  </div>
                </div>
              ) : brandAnalysis ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-white/20">Tagline</p>
                    <p className="text-lg font-serif italic text-white/80 leading-tight">"{brandAnalysis.tagline}"</p>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-white/20">Traits</p>
                    <div className="flex flex-wrap gap-2">
                      {brandAnalysis.personality.map(trait => (
                        <span key={trait} className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                          {trait}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-white/5">
                    <p className="text-xs font-bold uppercase tracking-widest text-white/20">Typography</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-[10px] text-white/40 uppercase">Primary</p>
                        <p className="text-sm font-bold" style={{ fontFamily: brandAnalysis.typography.primary }}>{brandAnalysis.typography.primary}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-white/40 uppercase">Secondary</p>
                        <p className="text-sm font-bold" style={{ fontFamily: brandAnalysis.typography.secondary }}>{brandAnalysis.typography.secondary}</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-white/40 leading-relaxed italic">{brandAnalysis.typography.description}</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-white/20 italic">Upload a logo to define your brand's voice.</p>
              )}
            </section>
          </div>

          {/* Right Column: Assets */}
          <div className="lg:col-span-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-semibold text-white/40 uppercase tracking-widest">Generated Identity Assets</h2>
              {originalLogo && (
                <div className="flex items-center gap-2">
                  <div className="relative group/add">
                    <button className="bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Add Asset
                    </button>
                    <div className="absolute right-0 top-full mt-2 w-48 bg-[#121214] border border-white/10 rounded-2xl shadow-2xl opacity-0 invisible group-hover/add:opacity-100 group-hover/add:visible transition-all z-50 p-2">
                      <button onClick={() => addAsset('variation')} className="w-full text-left px-4 py-2 hover:bg-white/5 rounded-xl text-xs font-medium flex items-center gap-3">
                        <RefreshCw className="w-3 h-3 text-emerald-400" />
                        Logo Variation
                      </button>
                      <button onClick={() => addAsset('instagram')} className="w-full text-left px-4 py-2 hover:bg-white/5 rounded-xl text-xs font-medium flex items-center gap-3">
                        <Instagram className="w-3 h-3 text-pink-400" />
                        Instagram Icon
                      </button>
                      <button onClick={() => addAsset('twitter')} className="w-full text-left px-4 py-2 hover:bg-white/5 rounded-xl text-xs font-medium flex items-center gap-3">
                        <Twitter className="w-3 h-3 text-blue-400" />
                        Twitter Icon
                      </button>
                      <button onClick={() => addAsset('linkedin')} className="w-full text-left px-4 py-2 hover:bg-white/5 rounded-xl text-xs font-medium flex items-center gap-3">
                        <Linkedin className="w-3 h-3 text-blue-600" />
                        LinkedIn Icon
                      </button>
                      <button onClick={() => addAsset('website-mockup')} className="w-full text-left px-4 py-2 hover:bg-white/5 rounded-xl text-xs font-medium flex items-center gap-3">
                        <Globe className="w-3 h-3 text-indigo-400" />
                        Website Mockup
                      </button>
                      <button onClick={() => addAsset('email-signature')} className="w-full text-left px-4 py-2 hover:bg-white/5 rounded-xl text-xs font-medium flex items-center gap-3">
                        <Mail className="w-3 h-3 text-yellow-400" />
                        Email Signature
                      </button>
                      <button onClick={() => addAsset('merchandise-mockup')} className="w-full text-left px-4 py-2 hover:bg-white/5 rounded-xl text-xs font-medium flex items-center gap-3">
                        <Shirt className="w-3 h-3 text-purple-400" />
                        Merchandise
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {!originalLogo ? (
              <div className="h-[600px] rounded-3xl border border-white/5 bg-white/[0.02] flex flex-col items-center justify-center text-center p-12">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
                  <Sparkles className="w-10 h-10 text-white/20" />
                </div>
                <h3 className="text-xl font-bold mb-2">Ready to build your brand?</h3>
                <p className="text-white/40 max-w-md">
                  Upload your logo to start generating icons, variations, and professional branding materials instantly.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <AnimatePresence mode="popLayout">
                  {assets.map((asset) => (
                    <motion.div 
                      key={asset.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group bg-white/5 border border-white/10 rounded-3xl overflow-hidden flex flex-col"
                    >
                      <div className="p-5 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col gap-1 mr-1">
                            <button 
                              onClick={() => moveAsset(asset.id, 'up')}
                              className="p-1 hover:bg-white/10 rounded transition-colors text-white/20 hover:text-white"
                            >
                              <ChevronUp className="w-3 h-3" />
                            </button>
                            <button 
                              onClick={() => moveAsset(asset.id, 'down')}
                              className="p-1 hover:bg-white/10 rounded transition-colors text-white/20 hover:text-white"
                            >
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-emerald-400">
                            {getIcon(asset.type)}
                          </div>
                          <div className="flex flex-col">
                            {editingNameId === asset.id ? (
                              <input 
                                autoFocus
                                defaultValue={asset.label}
                                className="bg-white/10 border border-white/10 rounded px-2 py-1 text-sm font-bold outline-none focus:border-emerald-500/50"
                                onBlur={(e) => updateAssetName(asset.id, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') updateAssetName(asset.id, (e.target as HTMLInputElement).value);
                                  if (e.key === 'Escape') setEditingNameId(null);
                                }}
                              />
                            ) : (
                              <div className="flex items-center gap-2 group/name">
                                <span className="font-bold text-sm tracking-tight">{asset.label}</span>
                                <button 
                                  onClick={() => setEditingNameId(asset.id)}
                                  className="opacity-0 group-hover/name:opacity-100 p-1 hover:bg-white/10 rounded transition-all"
                                >
                                  <Type className="w-3 h-3 text-white/40" />
                                </button>
                              </div>
                            )}
                            {asset.customPrompt && (
                              <span className="text-[10px] text-emerald-400/60 font-medium">Custom Prompt Active</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => removeAsset(asset.id)}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors group/trash"
                            title="Remove Asset"
                          >
                            <Trash2 className="w-4 h-4 text-white/20 group-hover/trash:text-red-400 transition-colors" />
                          </button>
                          <button 
                            onClick={() => setEditingPromptId(asset.id)}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors group/edit"
                            title="Edit Prompt"
                          >
                            <Edit3 className="w-4 h-4 text-white/40 group-hover/edit:text-emerald-400 transition-colors" />
                          </button>
                          {asset.status === 'completed' && (
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => setPreviewAssetId(asset.id)}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors group/preview"
                                title="Full Preview"
                              >
                                <Maximize2 className="w-4 h-4 text-white/40 group-hover/preview:text-emerald-400 transition-colors" />
                              </button>
                              <button 
                                onClick={() => generateAsset(asset.id)}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors group/regen"
                                title="Regenerate"
                              >
                                <RefreshCw className="w-4 h-4 text-white/40 group-hover/regen:text-emerald-400 transition-colors" />
                              </button>
                              <button 
                                onClick={() => handleDownload(asset.url, asset.label)}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors group/dl"
                                title="Download"
                              >
                                <Download className="w-4 h-4 text-white/40 group-hover/dl:text-emerald-400 transition-colors" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <AnimatePresence>
                        {editingPromptId === asset.id && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-white/5 border-b border-white/5 p-4"
                          >
                            <div className="flex flex-col gap-3">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Custom Generation Prompt</label>
                              <textarea 
                                defaultValue={asset.customPrompt}
                                placeholder="Describe how you want this asset to look..."
                                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white/80 focus:border-emerald-500/50 outline-none min-h-[80px]"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && e.metaKey) {
                                    updateCustomPrompt(asset.id, (e.target as HTMLTextAreaElement).value);
                                  }
                                }}
                                id={`prompt-${asset.id}`}
                              />
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-white/20">Press Cmd+Enter to save</span>
                                <div className="flex gap-2">
                                  <button onClick={() => setEditingPromptId(null)} className="text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white">Cancel</button>
                                  <button 
                                    onClick={() => {
                                      const el = document.getElementById(`prompt-${asset.id}`) as HTMLTextAreaElement;
                                      updateCustomPrompt(asset.id, el.value);
                                    }}
                                    className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 hover:text-emerald-300"
                                  >
                                    Save Prompt
                                  </button>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="aspect-video bg-black/40 relative flex items-center justify-center overflow-hidden">
                        {asset.status === 'idle' && (
                          <button 
                            onClick={() => generateAsset(asset.id)}
                            className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full text-xs font-bold transition-all active:scale-95"
                          >
                            Generate
                          </button>
                        )}

                        {asset.status === 'loading' && (
                          <div className="flex flex-col items-center gap-3">
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            >
                              <RefreshCw className="w-8 h-8 text-emerald-500" />
                            </motion.div>
                            <div className="flex flex-col items-center">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 animate-pulse">Designing...</span>
                              <span className="text-[9px] text-white/20 mt-1">Applying brand palette</span>
                            </div>
                          </div>
                        )}

                        {asset.status === 'completed' && (
                          <motion.img 
                            initial={{ opacity: 0, scale: 1.1 }}
                            animate={{ opacity: 1, scale: 1 }}
                            src={asset.url} 
                            alt={asset.label}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        )}

                        {asset.status === 'error' && (
                          <div className="text-center p-6 max-w-[80%]">
                            <AlertCircle className="w-8 h-8 text-red-500/50 mx-auto mb-3" />
                            <p className="text-xs text-red-400 font-bold mb-2">Generation Failed</p>
                            <p className="text-[10px] text-white/30 mb-4 leading-relaxed">{asset.error}</p>
                            <button 
                              onClick={() => generateAsset(asset.id)}
                              className="text-[10px] uppercase font-bold tracking-widest text-white/40 hover:text-white underline underline-offset-4"
                            >
                              Try Again
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 mt-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-white/20 text-xs font-medium uppercase tracking-widest">
          <p>© 2024 BrandGenius Studio</p>
          <div className="flex items-center gap-8">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">API Status</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
