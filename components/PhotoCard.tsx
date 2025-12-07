import React, { useState } from 'react';
import { Copy, Trash2, RefreshCw, Check, Loader2, Tag, Download, Layers, AlertTriangle, CheckCircle, Plus, X, ChevronDown, Maximize2, Undo, Redo, ChevronUp } from 'lucide-react';
import { PhotoItem, ProcessingStatus, PhotoMetadata } from '../types';

interface PhotoCardProps {
  item: PhotoItem;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onDownload: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<PhotoMetadata>) => void;
  onUpscale?: (id: string, scale: number, customWidth?: number) => Promise<boolean>;
  onUndo?: (id: string) => void;
  onRedo?: (id: string) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  categories?: string[];
  onAddCategory?: (category: string) => void;
  onRemoveCategory?: (category: string) => void;
}

const PhotoCard: React.FC<PhotoCardProps> = ({ 
  item, 
  onRemove, 
  onRetry, 
  onDownload, 
  onUpdate, 
  onUpscale,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  categories,
  onAddCategory,
  onRemoveCategory
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [newKeyword, setNewKeyword] = useState('');
  const [showUpscaleMenu, setShowUpscaleMenu] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [customWidth, setCustomWidth] = useState('');
  const [showAllIssues, setShowAllIssues] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const copyTags = () => {
    if (item.data?.keywords) {
      copyToClipboard(item.data.keywords.join(', '), 'tags');
    }
  };

  const handleAddKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newKeyword.trim() && item.data && onUpdate) {
      const keywordToAdd = newKeyword.trim();
      // Check for duplicates
      if (!item.data.keywords.includes(keywordToAdd)) {
        onUpdate(item.id, {
          keywords: [...item.data.keywords, keywordToAdd]
        });
        setNewKeyword('');
      } else {
        // Optional: User feedback for duplicate
        const input = document.getElementById(`keyword-input-${item.id}`);
        if(input) {
          input.classList.add('animate-shake');
          setTimeout(() => input.classList.remove('animate-shake'), 500);
        }
      }
    }
  };

  const handleRemoveKeyword = (keywordToRemove: string) => {
    if (item.data && onUpdate) {
      onUpdate(item.id, {
        keywords: item.data.keywords.filter(k => k !== keywordToRemove)
      });
    }
  };

  const handleUpscale = async (scale: number, customW?: number) => {
    if (onUpscale) {
      setIsUpscaling(true);
      await onUpscale(item.id, scale, customW);
      setIsUpscaling(false);
      setShowUpscaleMenu(false);
    }
  };

  const handleAddNewCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCategoryName.trim() && onAddCategory && onUpdate) {
      onAddCategory(newCategoryName.trim());
      onUpdate(item.id, { category: newCategoryName.trim() });
      setNewCategoryName('');
      setIsAddingCategory(false);
    }
  };

  const handleDeleteCategory = (e: React.MouseEvent) => {
     e.preventDefault();
     e.stopPropagation();
     if (item.data && onRemoveCategory && confirm(`Delete "${item.data.category}" from global category list?`)) {
        onRemoveCategory(item.data.category);
     }
  };

  const isLoading = item.status === ProcessingStatus.PROCESSING || item.status === ProcessingStatus.UPLOADING;

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    if (score >= 5) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col md:flex-row h-auto md:h-auto lg:h-[30rem] transition-all hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700">
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-2px); }
          75% { transform: translateX(2px); }
        }
        .animate-shake {
          animation: shake 0.2s ease-in-out;
        }
      `}</style>
      {/* Image Preview Section */}
      <div className="w-full md:w-72 lg:w-80 h-64 md:h-full relative shrink-0 bg-slate-100 dark:bg-slate-800 flex flex-col group">
        <div className="relative flex-grow overflow-hidden">
            <img 
              src={item.previewUrl} 
              alt="Preview" 
              className="w-full h-full object-cover"
            />
            {isLoading && (
              <div className="absolute inset-0 bg-white/60 dark:bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-spin" />
              </div>
            )}
            
            {/* Overlay Buttons (Show on hover or if menu open) */}
            <div className={`absolute top-2 right-2 flex gap-2 transition-opacity duration-200 ${showUpscaleMenu ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
              {item.status === ProcessingStatus.COMPLETED && (
                <>
                  <button 
                    type="button"
                    onClick={() => setShowUpscaleMenu(!showUpscaleMenu)}
                    className={`p-1.5 rounded-full shadow-sm backdrop-blur-sm transition-colors ${showUpscaleMenu ? 'bg-indigo-600 text-white' : 'bg-white/90 dark:bg-slate-800/90 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-700'}`}
                    title="Upscale Image"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                  <button 
                    type="button"
                    onClick={() => onDownload(item.id)}
                    className="p-1.5 bg-white/90 dark:bg-slate-800/90 text-indigo-600 dark:text-indigo-400 rounded-full hover:bg-indigo-50 dark:hover:bg-slate-700 transition-colors shadow-sm backdrop-blur-sm"
                    title="Download with Metadata"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </>
              )}
              <button 
                type="button"
                onClick={() => onRemove(item.id)}
                className="p-1.5 bg-white/90 dark:bg-slate-800/90 text-red-500 dark:text-red-400 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors shadow-sm backdrop-blur-sm"
                title="Remove image"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            
            {/* Upscale Menu Overlay */}
            {showUpscaleMenu && (
              <div className="absolute top-12 right-2 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 p-3 z-20 w-48 animate-in fade-in zoom-in-95 duration-100">
                 {isUpscaling ? (
                    <div className="flex flex-col items-center justify-center py-4 gap-2">
                       <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                       <span className="text-xs text-slate-500">Upscaling...</span>
                    </div>
                 ) : (
                   <>
                    <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Upscale Image</h4>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                       <button onClick={() => handleUpscale(2)} className="bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 py-1.5 rounded text-xs font-medium transition-colors">
                          2x
                       </button>
                       <button onClick={() => handleUpscale(4)} className="bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 py-1.5 rounded text-xs font-medium transition-colors">
                          4x
                       </button>
                    </div>
                    
                    <div className="mb-2">
                       <div className="flex items-center gap-1 mb-1">
                          <span className="text-[10px] text-slate-400">Custom Width (px)</span>
                       </div>
                       <div className="flex gap-1">
                          <input 
                             type="number" 
                             value={customWidth}
                             onChange={(e) => setCustomWidth(e.target.value)}
                             placeholder="Width..."
                             className="w-full text-xs px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded focus:border-indigo-500 outline-none dark:text-white"
                          />
                          <button 
                             type="button"
                             disabled={!customWidth} 
                             onClick={() => handleUpscale(1, parseInt(customWidth))}
                             className="bg-slate-100 dark:bg-slate-700 px-2 rounded hover:bg-indigo-50 text-slate-600 dark:text-slate-300 disabled:opacity-50"
                          >
                             <Check className="w-3 h-3" />
                          </button>
                       </div>
                    </div>
                    <button type="button" onClick={() => setShowUpscaleMenu(false)} className="w-full text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 mt-1">Cancel</button>
                   </>
                 )}
              </div>
            )}

            {/* Category Dropdown (Editable Badge) */}
            {item.data && onUpdate && !showUpscaleMenu && (
              <div className="absolute bottom-2 left-2 right-2 flex gap-1 items-stretch">
                {isAddingCategory ? (
                   <form onSubmit={handleAddNewCategory} className="flex-1 flex gap-1">
                      <input 
                        type="text" 
                        value={newCategoryName} 
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="New Category"
                        autoFocus
                        className="w-full bg-black/80 backdrop-blur-md text-white text-[10px] px-2 py-1.5 rounded outline-none border border-white/30"
                      />
                      <button type="button" onClick={() => setIsAddingCategory(false)} className="bg-black/60 text-white p-1.5 rounded hover:bg-black/80">
                         <X className="w-3 h-3" />
                      </button>
                      <button type="submit" disabled={!newCategoryName.trim()} className="bg-indigo-600 text-white p-1.5 rounded hover:bg-indigo-700">
                         <Check className="w-3 h-3" />
                      </button>
                   </form>
                ) : (
                  <>
                    <div className="relative inline-block flex-1 min-w-0">
                        <select
                            value={item.data.category}
                            onChange={(e) => onUpdate(item.id, { category: e.target.value })}
                            className="appearance-none w-full pl-8 pr-8 py-1.5 bg-black/60 backdrop-blur-md text-white text-[10px] font-semibold uppercase tracking-wider rounded-md outline-none cursor-pointer hover:bg-black/70 transition-colors border border-transparent focus:border-white/30 truncate"
                        >
                            {/* Render dynamic categories */}
                            {categories?.map(cat => (
                                <option key={cat} value={cat} className="text-slate-900 bg-white">{cat}</option>
                            ))}
                            {/* Ensure current category is selectable even if removed from global list */}
                            {categories && !categories.includes(item.data.category) && (
                                <option value={item.data.category} className="text-slate-900 bg-white">{item.data.category}</option>
                            )}
                        </select>
                        <Layers className="w-3 h-3 text-white absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <ChevronDown className="w-3 h-3 text-white/70 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    {onRemoveCategory && (
                        <button 
                          type="button"
                          onClick={handleDeleteCategory}
                          className="px-2 bg-black/60 backdrop-blur-md text-white hover:bg-red-600 rounded-md transition-colors shrink-0"
                          title="Remove current category from list"
                        >
                           <Trash2 className="w-3 h-3" />
                        </button>
                    )}
                    {onAddCategory && (
                      <button 
                        type="button"
                        onClick={() => setIsAddingCategory(true)}
                        className="px-2 bg-black/60 backdrop-blur-md text-white hover:bg-indigo-600 rounded-md transition-colors shrink-0"
                        title="Add new category"
                      >
                         <Plus className="w-3 h-3" />
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
        </div>
        
        {/* Quality Analysis Mini-Section */}
        {item.data?.qualityAnalysis && (
          <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800">
             <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Quality</span>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${getScoreColor(item.data.qualityAnalysis.score)}`}>
                    Score: {item.data.qualityAnalysis.score}/10
                </span>
            </div>
            
            {item.data.qualityAnalysis.issues.length > 0 ? (
                <div className="space-y-1">
                    {(showAllIssues ? item.data.qualityAnalysis.issues : item.data.qualityAnalysis.issues.slice(0, 2)).map((issue, idx) => (
                        <div key={idx} className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-500">
                             <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                             <span className="leading-tight" title={issue}>{issue}</span>
                        </div>
                    ))}
                    {item.data.qualityAnalysis.issues.length > 2 && (
                       <button 
                         type="button"
                         onClick={() => setShowAllIssues(!showAllIssues)}
                         className="flex items-center gap-1 text-[10px] font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 ml-4.5 mt-1"
                       >
                         {showAllIssues ? (
                           <><ChevronUp className="w-3 h-3" /> Show Less</>
                         ) : (
                           <><ChevronDown className="w-3 h-3" /> Show {item.data.qualityAnalysis.issues.length - 2} more issues</>
                         )}
                       </button>
                    )}
                </div>
            ) : (
                <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-500">
                    <CheckCircle className="w-3 h-3" />
                    <span>No artifacts detected</span>
                </div>
            )}
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="flex-1 p-5 overflow-y-auto custom-scrollbar flex flex-col gap-4">
        {item.status === ProcessingStatus.ERROR ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <div className="bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 p-3 rounded-full mb-3">
              <RefreshCw className="w-6 h-6" />
            </div>
            <p className="text-red-600 dark:text-red-400 font-medium mb-2">Generation Failed</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{item.error || "Unknown error occurred"}</p>
            <button 
              type="button"
              onClick={() => onRetry(item.id)}
              className="text-sm bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : !item.data && isLoading ? (
          <div className="h-full flex flex-col justify-center items-center gap-3 text-slate-400 dark:text-slate-500">
            <SparklesLoader />
            <p className="text-sm font-medium animate-pulse">Analyzing visual content & structure...</p>
          </div>
        ) : item.data && onUpdate ? (
          <>
            {/* Toolbar for Content */}
            <div className="flex items-center justify-between mb-2">
               <div className="flex items-center gap-2">
                 {(onUndo && canUndo !== undefined) && (
                   <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                      <button 
                        type="button"
                        onClick={() => onUndo && onUndo(item.id)}
                        disabled={!canUndo}
                        className="p-1.5 rounded-md hover:bg-white dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                        title="Undo"
                      >
                        <Undo className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        type="button"
                        onClick={() => onRedo && onRedo(item.id)}
                        disabled={!canRedo}
                        className="p-1.5 rounded-md hover:bg-white dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                        title="Redo"
                      >
                        <Redo className="w-3.5 h-3.5" />
                      </button>
                   </div>
                 )}
               </div>
            </div>

            {/* Title - Editable */}
            <div className="group relative">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Title</label>
                <button 
                  type="button"
                  onClick={() => copyToClipboard(item.data!.title, 'title')}
                  className={`p-1 rounded transition-colors ${copiedField === 'title' ? 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400'}`}
                >
                  {copiedField === 'title' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <input 
                type="text" 
                value={item.data.title}
                onChange={(e) => onUpdate(item.id, { title: e.target.value })}
                className="w-full text-slate-800 dark:text-slate-100 font-medium leading-tight bg-transparent border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1 -ml-2 transition-all outline-none"
              />
            </div>

            {/* Description - Editable */}
            <div className="group relative">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Description</label>
                <button 
                  type="button"
                  onClick={() => copyToClipboard(item.data!.description, 'desc')}
                  className={`p-1 rounded transition-colors ${copiedField === 'desc' ? 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400'}`}
                >
                  {copiedField === 'desc' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <textarea 
                value={item.data.description}
                onChange={(e) => onUpdate(item.id, { description: e.target.value })}
                rows={3}
                className="w-full text-sm text-slate-600 dark:text-slate-300 leading-relaxed bg-transparent border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1 -ml-2 transition-all outline-none resize-none"
              />
            </div>

            {/* Keywords - Editable */}
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  Keywords <span className="text-indigo-600 dark:text-indigo-400 ml-1 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 rounded-full text-[10px]">{item.data.keywords.length}</span>
                </label>
                <button 
                  type="button"
                  onClick={copyTags}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all
                    ${copiedField === 'tags' 
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                      : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50'
                    }`}
                >
                  {copiedField === 'tags' ? (
                    <>
                      <Check className="w-3 h-3" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" /> Copy All
                    </>
                  )}
                </button>
              </div>
              
              <div className="flex flex-wrap gap-1.5 content-start overflow-y-auto custom-scrollbar pr-2 pb-2">
                {/* Add Keyword Input */}
                <form onSubmit={handleAddKeyword} className="inline-flex">
                   <div className="relative flex items-center">
                        <input 
                            id={`keyword-input-${item.id}`}
                            type="text" 
                            value={newKeyword}
                            onChange={(e) => setNewKeyword(e.target.value)}
                            placeholder="Add..."
                            className="w-20 px-2 py-1 rounded-l bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500 focus:w-32 transition-all dark:text-slate-200"
                        />
                        <button type="submit" disabled={!newKeyword.trim()} className="bg-slate-100 dark:bg-slate-700 border-y border-r border-slate-200 dark:border-slate-600 px-1.5 py-1 rounded-r hover:bg-indigo-50 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-300">
                            <Plus className="w-3 h-3" />
                        </button>
                   </div>
                </form>

                {item.data.keywords.map((keyword, idx) => (
                  <span 
                    key={idx} 
                    className="inline-flex items-center px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors group cursor-default"
                  >
                    {keyword}
                    <button 
                        type="button"
                        onClick={() => handleRemoveKeyword(keyword)}
                        className="ml-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

const SparklesLoader = () => (
  <div className="flex gap-1">
    <div className="w-2 h-2 bg-indigo-400 dark:bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
    <div className="w-2 h-2 bg-indigo-400 dark:bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
    <div className="w-2 h-2 bg-indigo-400 dark:bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
  </div>
);

export default PhotoCard;