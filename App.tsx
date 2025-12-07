import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Plus, Download, Zap, Loader2, Package, X, MessageSquare, Maximize2, FileText, ChevronDown } from 'lucide-react';

import Navbar from './components/Navbar';
import UploadZone from './components/UploadZone';
import PhotoCard from './components/PhotoCard';
import { PhotoItem, ProcessingStatus, PhotoMetadata, INITIAL_CATEGORIES } from './types';
import { generateImageMetadata, fileToBase64 } from './services/geminiService';
import { createZipWithMetadata, processAndDownloadSingleImage, upscaleImage, constructFileName } from './services/imageService';

const MAX_FILE_SIZE_BYTES = 40 * 1024 * 1024; // 40MB
const MAX_BATCH_SIZE = 50; // Max photos allowed

const App: React.FC = () => {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [isGlobalProcessing, setIsGlobalProcessing] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [showUpscaleAllModal, setShowUpscaleAllModal] = useState(false);
  const [upscaleAllScale, setUpscaleAllScale] = useState<number>(2);
  const [isUpscalingAll, setIsUpscalingAll] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  
  // Dynamic Categories State
  const [categories, setCategories] = useState<string[]>(INITIAL_CATEGORIES);
  
  // Settings State
  const [keepOriginalFilenames, setKeepOriginalFilenames] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('photagg_keep_filenames') === 'true';
    }
    return false;
  });

  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('photagg_dark_mode') === 'true';
    }
    return false;
  });

  // Persist preferences
  useEffect(() => {
    localStorage.setItem('photagg_keep_filenames', String(keepOriginalFilenames));
  }, [keepOriginalFilenames]);

  // Handle Dark Mode Effect
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('photagg_dark_mode', String(isDarkMode));
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  // Prevent accidental refresh/close when photos exist
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (photos.length > 0) {
        e.preventDefault();
        e.returnValue = ''; // Required for Chrome
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [photos.length]);

  const processingCount = photos.filter(p => p.status === ProcessingStatus.PROCESSING).length;
  
  // Helper to generate simple ID
  const generateId = () => Math.random().toString(36).substring(2, 9);

  const processPhoto = async (photoId: string, file: File) => {
    try {
      // Set status to processing
      setPhotos(prev => prev.map(p => 
        p.id === photoId ? { ...p, status: ProcessingStatus.PROCESSING } : p
      ));

      // Convert to base64
      const base64 = await fileToBase64(file);
      
      // Call Gemini API
      const metadata = await generateImageMetadata(base64, file.type);

      // Update state with result and initialize history
      setPhotos(prev => prev.map(p => 
        p.id === photoId ? { 
          ...p, 
          status: ProcessingStatus.COMPLETED, 
          data: metadata,
          history: [metadata],
          historyIndex: 0
        } : p
      ));
    } catch (error: any) {
      console.error(`Error processing photo ${photoId}:`, error);
      setPhotos(prev => prev.map(p => 
        p.id === photoId ? { 
          ...p, 
          status: ProcessingStatus.ERROR, 
          error: error.message || "Failed to generate metadata" 
        } : p
      ));
    }
  };

  const validateFiles = (files: File[], currentCount: number): File[] => {
    if (currentCount + files.length > MAX_BATCH_SIZE) {
      alert(`Limit exceeded. You can only upload up to ${MAX_BATCH_SIZE} photos in a batch.`);
      return [];
    }

    const validFiles: File[] = [];
    let oversizedCount = 0;

    files.forEach(file => {
      if (file.size <= MAX_FILE_SIZE_BYTES) {
        validFiles.push(file);
      } else {
        oversizedCount++;
      }
    });

    if (oversizedCount > 0) {
      alert(`${oversizedCount} file(s) were skipped because they exceed the 40MB limit.`);
    }

    return validFiles;
  };

  const handleFilesSelected = useCallback(async (files: File[]) => {
    const newPhotos: PhotoItem[] = files.map(file => ({
      id: generateId(),
      file,
      previewUrl: URL.createObjectURL(file),
      status: ProcessingStatus.IDLE
    }));

    setPhotos(prev => [...newPhotos, ...prev]);

    // Automatically start processing
    newPhotos.forEach(photo => {
        processPhoto(photo.id, photo.file);
    });

  }, []);

  const handleAddPhotosInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const rawFiles = Array.from(e.target.files) as File[];
      const validFiles = validateFiles(rawFiles, photos.length);
      
      if (validFiles.length > 0) {
        handleFilesSelected(validFiles);
      }
    }
    // Reset input
    e.target.value = '';
  };

  const handleRemovePhoto = (id: string) => {
    setPhotos(prev => {
      const photoToRemove = prev.find(p => p.id === id);
      if (photoToRemove) {
        URL.revokeObjectURL(photoToRemove.previewUrl);
      }
      return prev.filter(p => p.id !== id);
    });
  };

  const handleRetry = (id: string) => {
    const photo = photos.find(p => p.id === id);
    if (photo) {
      processPhoto(id, photo.file);
    }
  };

  // Undo/Redo logic
  const handleUpdatePhoto = (id: string, updates: Partial<PhotoMetadata>) => {
    setPhotos(prev => prev.map(p => {
      if (p.id === id && p.data) {
        const newData = { ...p.data, ...updates };
        const currentHistory = p.history || [p.data];
        const currentIndex = p.historyIndex ?? 0;
        
        // Truncate future history if we are in the middle and making a new change
        const newHistory = currentHistory.slice(0, currentIndex + 1);
        newHistory.push(newData);
        
        return { 
          ...p, 
          data: newData,
          history: newHistory,
          historyIndex: newHistory.length - 1
        };
      }
      return p;
    }));
  };

  const handleUndo = (id: string) => {
    setPhotos(prev => prev.map(p => {
      if (p.id === id && p.history && p.historyIndex !== undefined && p.historyIndex > 0) {
        const newIndex = p.historyIndex - 1;
        return {
          ...p,
          data: p.history[newIndex],
          historyIndex: newIndex
        };
      }
      return p;
    }));
  };

  const handleRedo = (id: string) => {
    setPhotos(prev => prev.map(p => {
      if (p.id === id && p.history && p.historyIndex !== undefined && p.historyIndex < p.history.length - 1) {
        const newIndex = p.historyIndex + 1;
        return {
          ...p,
          data: p.history[newIndex],
          historyIndex: newIndex
        };
      }
      return p;
    }));
  };

  const handleAddCategory = (newCategory: string) => {
    if (!categories.includes(newCategory)) {
      setCategories(prev => [...prev, newCategory]);
    }
  };

  const handleRemoveCategory = (categoryToRemove: string) => {
    setCategories(prev => prev.filter(c => c !== categoryToRemove));
  };

  const handleUpscalePhoto = async (id: string, scale: number, customWidth?: number) => {
    const photo = photos.find(p => p.id === id);
    if (!photo) return false;

    try {
      const newFile = await upscaleImage(photo.file, scale, customWidth);
      const newPreviewUrl = URL.createObjectURL(newFile);

      URL.revokeObjectURL(photo.previewUrl);

      setPhotos(prev => prev.map(p => 
        p.id === id ? { ...p, file: newFile, previewUrl: newPreviewUrl } : p
      ));
      
      return true;
    } catch (error) {
      console.error("Upscale failed", error);
      alert("Failed to upscale image.");
      return false;
    }
  };

  const handleUpscaleAll = async () => {
    if (photos.length === 0) return;
    
    setIsUpscalingAll(true);
    // Process strictly sequentially to avoid browser hanging
    for (const photo of photos) {
      if (photo.status === ProcessingStatus.COMPLETED) {
        await handleUpscalePhoto(photo.id, upscaleAllScale);
      }
    }
    
    setIsUpscalingAll(false);
    setShowUpscaleAllModal(false);
  };

  const handleDownloadSingle = async (id: string) => {
    const photo = photos.find(p => p.id === id);
    if (!photo || !photo.data) return;
    
    try {
      await processAndDownloadSingleImage(photo, keepOriginalFilenames);
    } catch (error) {
      console.error("Error downloading image:", error);
      alert("Failed to download image. See console for details.");
    }
  };

  const exportToCSV = () => {
    const completedPhotos = photos.filter(p => p.status === ProcessingStatus.COMPLETED && p.data);
    if (completedPhotos.length === 0) return;

    const headers = ['Filename', 'Title', 'Description', 'Category', 'Keywords'];
    const csvContent = [
      headers.join(','),
      ...completedPhotos.map(p => {
        const finalFilename = constructFileName(p, keepOriginalFilenames);
        const row = [
          `"${finalFilename}"`,
          `"${p.data?.title?.replace(/"/g, '""') || ''}"`,
          `"${p.data?.description?.replace(/"/g, '""') || ''}"`,
          `"${p.data?.category?.replace(/"/g, '""') || ''}"`,
          `"${p.data?.keywords?.join('; ').replace(/"/g, '""') || ''}"`
        ];
        return row.join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `photagg_export_${new Date().toISOString().slice(0, 10)}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    setShowDownloadMenu(false);
  };

  const downloadAllImages = async () => {
    const completedPhotos = photos.filter(p => p.status === ProcessingStatus.COMPLETED && p.data);
    if (completedPhotos.length === 0) return;

    setIsZipping(true);
    try {
      const blob = await createZipWithMetadata(completedPhotos, keepOriginalFilenames);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `photagg_photos_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error creating zip:", error);
      alert("Failed to create zip file. See console for details.");
    } finally {
      setIsZipping(false);
      setShowDownloadMenu(false);
    }
  };

  const handleFeedbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const mailtoLink = `mailto:studio27ideas@gmail.com?subject=Photagg AI Feedback&body=${encodeURIComponent(feedbackText)}`;
    window.location.href = mailtoLink;
    setShowFeedbackModal(false);
    setFeedbackText('');
  };

  const completedCount = photos.filter(p => p.status === ProcessingStatus.COMPLETED).length;
  const isAnyProcessing = processingCount > 0;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <Navbar isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} onFeedbackClick={() => setShowFeedbackModal(true)} />
      
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Hero Section (only show if no photos) */}
        {photos.length === 0 && (
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
              Metadata for your photos <br />
              <span className="text-indigo-600 dark:text-indigo-400">Generated by AI</span>
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">
              Upload your stock photos and let Gemini Vision AI generate optimized titles, descriptions, and keywords. Download them ready for stock sites.
            </p>
          </div>
        )}

        {/* Action Bar */}
        {photos.length > 0 && (
          <div className="flex flex-col xl:flex-row justify-between items-center mb-6 gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 sticky top-20 z-40 transition-colors">
            <div className="flex items-center gap-3 w-full xl:w-auto">
              <div className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-full text-sm font-semibold whitespace-nowrap">
                {photos.length} / {MAX_BATCH_SIZE} Photos
              </div>
              {isAnyProcessing && (
                 <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2 whitespace-nowrap">
                   <Loader2 className="w-4 h-4 animate-spin" />
                   Processing {processingCount}...
                 </span>
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-3 justify-end w-full xl:w-auto">
              
              {/* Filename Toggle */}
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 transition-colors">
                <input 
                  type="checkbox" 
                  checked={keepOriginalFilenames}
                  onChange={(e) => setKeepOriginalFilenames(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer bg-white dark:bg-slate-900"
                />
                Keep filenames
              </label>

              <button 
                type="button"
                onClick={() => setShowUpscaleAllModal(true)}
                disabled={completedCount === 0 || isUpscalingAll}
                className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-200 dark:hover:border-indigo-800 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                <Maximize2 className="w-4 h-4" />
                <span className="hidden sm:inline">Upscale All</span>
              </button>

              {/* Download Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                  disabled={completedCount === 0 || isZipping}
                  className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-indigo-200 dark:shadow-indigo-900/20 active:transform active:scale-95"
                >
                  {isZipping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Download
                  <ChevronDown className="w-3 h-3 ml-1" />
                </button>
                
                {showDownloadMenu && (
                  <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowDownloadMenu(false)}></div>
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    <button 
                      onClick={downloadAllImages}
                      className="w-full text-left px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                    >
                      <Package className="w-4 h-4 text-indigo-500" />
                      Download All (ZIP)
                    </button>
                    <button 
                      onClick={exportToCSV}
                      className="w-full text-left px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 border-t border-slate-100 dark:border-slate-700"
                    >
                      <FileText className="w-4 h-4 text-green-500" />
                      Export CSV
                    </button>
                  </div>
                  </>
                )}
              </div>
              
              <label className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors flex items-center gap-2 cursor-pointer shadow-sm hover:shadow active:scale-95 whitespace-nowrap">
                <Plus className="w-4 h-4" />
                Add Photos
                <input 
                  type="file" 
                  className="hidden" 
                  multiple 
                  accept="image/*"
                  onChange={handleAddPhotosInput}
                />
              </label>
            </div>
          </div>
        )}

        {/* Upload Zone (conditionally smaller if photos exist) */}
        {photos.length === 0 ? (
          <div className="max-w-2xl mx-auto">
            <UploadZone 
              onFilesSelected={handleFilesSelected} 
              isProcessing={isGlobalProcessing} 
              currentFileCount={photos.length}
            />
            
            {/* Feature Grid for Empty State */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
               <FeatureItem 
                 icon={<Zap className="w-6 h-6 text-amber-500" />}
                 title="Instant Analysis"
                 desc="Gemini Flash 2.5 analyzes content, mood, and objects in milliseconds."
               />
               <FeatureItem 
                 icon={<Package className="w-6 h-6 text-indigo-500" />}
                 title="Embedded Metadata"
                 desc="Download photos with Titles, Descriptions, and Keywords embedded in the file."
               />
               <FeatureItem 
                 icon={<Download className="w-6 h-6 text-green-500" />}
                 title="Bulk Export"
                 desc="Process hundreds of photos and download them all in a single ZIP file."
               />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {photos.map(photo => (
              <PhotoCard 
                key={photo.id} 
                item={photo} 
                onRemove={handleRemovePhoto}
                onRetry={handleRetry}
                onDownload={handleDownloadSingle}
                onUpdate={handleUpdatePhoto}
                onUpscale={handleUpscalePhoto}
                onUndo={handleUndo}
                onRedo={handleRedo}
                canUndo={photo.history && photo.historyIndex !== undefined ? photo.historyIndex > 0 : false}
                canRedo={photo.history && photo.historyIndex !== undefined ? photo.historyIndex < photo.history.length - 1 : false}
                categories={categories}
                onAddCategory={handleAddCategory}
                onRemoveCategory={handleRemoveCategory}
              />
            ))}
          </div>
        )}

      </main>
      
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-8 mt-auto transition-colors">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-500 dark:text-slate-400 text-sm">
          <p>© {new Date().getFullYear()} Photagg AI. Powered by Google Gemini.</p>
        </div>
      </footer>

      {/* Upscale All Modal */}
      {showUpscaleAllModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-sm w-full p-6 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            {isUpscalingAll ? (
              <div className="text-center py-6">
                 <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-4" />
                 <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Upscaling Images...</h3>
                 <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Please wait while we process all images.</p>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Upscale All Images</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                   Choose a scale factor. This will resize all {photos.length} images.
                </p>
                
                <div className="grid grid-cols-2 gap-3 mb-6">
                   <button 
                     onClick={() => setUpscaleAllScale(2)}
                     className={`py-2 px-4 rounded-lg border text-sm font-medium transition-colors ${upscaleAllScale === 2 ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-500' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                   >
                      2x Scale
                   </button>
                   <button 
                     onClick={() => setUpscaleAllScale(4)}
                     className={`py-2 px-4 rounded-lg border text-sm font-medium transition-colors ${upscaleAllScale === 4 ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-500' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                   >
                      4x Scale
                   </button>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowUpscaleAllModal(false)}
                    className="flex-1 py-2 px-4 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleUpscaleAll}
                    className="flex-1 py-2 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
                  >
                    Start Upscaling
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
           <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200 relative">
              <button 
                onClick={() => setShowFeedbackModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
              
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Send Feedback</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Found a bug? Have a suggestion? This will open your email client.
                <br/>
                <span className="text-indigo-600 dark:text-indigo-400 block mt-1">studio27ideas@gmail.com</span>
              </p>
              <form onSubmit={handleFeedbackSubmit}>
                <textarea 
                    required
                    className="w-full h-32 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white resize-none mb-4 text-sm"
                    placeholder="Tell us what you think..."
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                ></textarea>
                <div className="flex justify-end gap-3">
                    <button 
                        type="button"
                        onClick={() => setShowFeedbackModal(false)}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        type="submit"
                        className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
                    >
                        <MessageSquare className="w-4 h-4" />
                        Send Email
                    </button>
                </div>
              </form>
           </div>
        </div>
      )}

    </div>
  );
};

const FeatureItem: React.FC<{ icon: React.ReactNode, title: string, desc: string }> = ({ icon, title, desc }) => (
  <div className="flex flex-col items-center text-center p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
    <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-full mb-4">
      {icon}
    </div>
    <h3 className="font-semibold text-slate-900 dark:text-white mb-2">{title}</h3>
    <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">{desc}</p>
  </div>
);

export default App;