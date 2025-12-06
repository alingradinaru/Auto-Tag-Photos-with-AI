import React, { useState, useCallback, useEffect } from 'react';
import { Plus, Download, Trash2, Zap, Loader2, Package, Settings2, X } from 'lucide-react';

import Navbar from './components/Navbar';
import UploadZone from './components/UploadZone';
import PhotoCard from './components/PhotoCard';
import { PhotoItem, ProcessingStatus, PhotoMetadata } from './types';
import { generateImageMetadata, fileToBase64 } from './services/geminiService';
import { createZipWithMetadata, processAndDownloadSingleImage, upscaleImage } from './services/imageService';

const App: React.FC = () => {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [isGlobalProcessing, setIsGlobalProcessing] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  
  // Initialize state from localStorage if available
  const [keepOriginalFilenames, setKeepOriginalFilenames] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('instatag_keep_filenames') === 'true';
    }
    return false;
  });

  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('instatag_dark_mode') === 'true';
    }
    return false;
  });

  // Persist preference to localStorage
  useEffect(() => {
    localStorage.setItem('instatag_keep_filenames', String(keepOriginalFilenames));
  }, [keepOriginalFilenames]);

  // Handle Dark Mode Effect
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('instatag_dark_mode', String(isDarkMode));
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

      // Update state with result
      setPhotos(prev => prev.map(p => 
        p.id === photoId ? { 
          ...p, 
          status: ProcessingStatus.COMPLETED, 
          data: metadata 
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

  const handleUpdatePhoto = (id: string, updates: Partial<PhotoMetadata>) => {
    setPhotos(prev => prev.map(p => {
      if (p.id === id && p.data) {
        return { ...p, data: { ...p.data, ...updates } };
      }
      return p;
    }));
  };

  const handleUpscalePhoto = async (id: string, scale: number, customWidth?: number) => {
    const photo = photos.find(p => p.id === id);
    if (!photo) return;

    try {
      // Temporarily set to processing to show spinner or similar if needed, 
      // but strictly we might just want to show a toast. For now, let's keep it simple.
      // We will rely on the PhotoCard to show loading state if we wanted, 
      // but here we are just swapping the file.
      
      const newFile = await upscaleImage(photo.file, scale, customWidth);
      const newPreviewUrl = URL.createObjectURL(newFile);

      // Revoke old URL to avoid memory leaks
      URL.revokeObjectURL(photo.previewUrl);

      setPhotos(prev => prev.map(p => 
        p.id === id ? { ...p, file: newFile, previewUrl: newPreviewUrl } : p
      ));
      
      return true; // Success
    } catch (error) {
      console.error("Upscale failed", error);
      alert("Failed to upscale image.");
      return false;
    }
  };

  const clearAll = useCallback(() => {
    if (photos.length === 0) return;
    
    // We use a timeout to ensure the UI doesn't block immediately if there's a rendering backlog
    setTimeout(() => {
      if (window.confirm("Are you sure you want to delete all uploaded photos? This action cannot be undone.")) {
        photos.forEach(p => {
          if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
        });
        setPhotos([]);
      }
    }, 10);
  }, [photos]);

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
        const row = [
          `"${p.file.name}"`,
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
      link.setAttribute('download', `instatag_export_${new Date().toISOString().slice(0, 10)}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
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
      link.download = `instatag_photos_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error creating zip:", error);
      alert("Failed to create zip file. See console for details.");
    } finally {
      setIsZipping(false);
    }
  };

  const processingCount = photos.filter(p => p.status === ProcessingStatus.PROCESSING).length;
  const completedCount = photos.filter(p => p.status === ProcessingStatus.COMPLETED).length;
  const isAnyProcessing = processingCount > 0;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <Navbar isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />
      
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
                {photos.length} Photos
              </div>
              {isAnyProcessing && (
                 <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2 whitespace-nowrap">
                   <Loader2 className="w-4 h-4 animate-spin" />
                   Processing {processingCount}...
                 </span>
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-3 justify-end w-full xl:w-auto">
              {/* Settings Toggle */}
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mr-2 cursor-pointer select-none hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500">
                <input 
                  type="checkbox" 
                  checked={keepOriginalFilenames}
                  onChange={(e) => setKeepOriginalFilenames(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer bg-white dark:bg-slate-900"
                />
                Use original filenames
              </label>

              <button 
                type="button"
                onClick={clearAll}
                className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 shadow-sm"
                title="Delete all uploaded photos"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Delete All</span>
              </button>
              
              <button 
                type="button"
                onClick={exportToCSV}
                disabled={completedCount === 0 || isZipping}
                className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>

              <button 
                type="button"
                onClick={downloadAllImages}
                disabled={completedCount === 0 || isZipping}
                className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-indigo-200 dark:shadow-indigo-900/20 active:transform active:scale-95"
              >
                {isZipping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                Download All
              </button>
              
              <label className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors flex items-center gap-2 cursor-pointer shadow-sm hover:shadow active:scale-95 whitespace-nowrap">
                <Plus className="w-4 h-4" />
                Add Photos
                <input 
                  type="file" 
                  className="hidden" 
                  multiple 
                  accept="image/*"
                  onChange={(e) => {
                     if (e.target.files && e.target.files.length > 0) {
                        const files = Array.from(e.target.files);
                        handleFilesSelected(files);
                     }
                  }} 
                />
              </label>
            </div>
          </div>
        )}

        {/* Upload Zone (conditionally smaller if photos exist) */}
        {photos.length === 0 ? (
          <div className="max-w-2xl mx-auto">
            <UploadZone onFilesSelected={handleFilesSelected} isProcessing={isGlobalProcessing} />
            
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
              />
            ))}
          </div>
        )}

      </main>
      
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-8 mt-auto transition-colors">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-500 dark:text-slate-400 text-sm">
          <p>© {new Date().getFullYear()} InstaTag AI. Powered by Google Gemini.</p>
        </div>
      </footer>
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