import React, { useCallback, useRef, useState } from 'react';
import { UploadCloud, Image as ImageIcon, Loader2 } from 'lucide-react';

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  isProcessing: boolean;
  currentFileCount?: number;
}

const MAX_FILE_SIZE_BYTES = 40 * 1024 * 1024; // 40MB
const MAX_BATCH_SIZE = 50;

const UploadZone: React.FC<UploadZoneProps> = ({ onFilesSelected, isProcessing, currentFileCount = 0 }) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndPassFiles = (files: File[]) => {
    // Check Batch Size
    if (currentFileCount + files.length > MAX_BATCH_SIZE) {
      alert(`Limit exceeded. You can only upload up to ${MAX_BATCH_SIZE} photos in total. You currently have ${currentFileCount}.`);
      return;
    }

    const validTypes = files.filter(file => file.type.startsWith('image/'));
    const validSize: File[] = [];
    let oversizedCount = 0;

    validTypes.forEach(file => {
      if (file.size <= MAX_FILE_SIZE_BYTES) {
        validSize.push(file);
      } else {
        oversizedCount++;
      }
    });
    
    if (oversizedCount > 0) {
      alert(`${oversizedCount} file(s) were skipped because they exceed the 40MB limit.`);
    }

    if (validSize.length > 0) {
      onFilesSelected(validSize);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndPassFiles(Array.from(e.dataTransfer.files));
    }
  }, [onFilesSelected, currentFileCount]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndPassFiles(Array.from(e.target.files));
    }
    // Reset value to allow selecting the same file again if needed
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, [onFilesSelected, currentFileCount]);

  const handleClick = () => {
    inputRef.current?.click();
  };

  return (
    <div 
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative group cursor-pointer
        border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 ease-in-out
        ${isDragging 
          ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 scale-[1.01]' 
          : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'
        }
        ${isProcessing ? 'pointer-events-none opacity-60' : ''}
      `}
    >
      <input 
        type="file" 
        ref={inputRef}
        onChange={handleFileInput}
        className="hidden" 
        multiple 
        accept="image/*"
      />
      
      <div className="flex flex-col items-center justify-center gap-4">
        <div className={`
          p-4 rounded-full transition-colors duration-200
          ${isDragging 
            ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' 
            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'}
        `}>
          {isProcessing ? (
            <Loader2 className="w-8 h-8 animate-spin" />
          ) : (
            <UploadCloud className="w-8 h-8" />
          )}
        </div>
        
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {isProcessing ? 'Processing Images...' : 'Upload your photos'}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            Drag & drop images here or click to browse. Supports JPG, PNG, WEBP.
          </p>
        </div>

        {!isProcessing && (
          <div className="flex flex-col items-center gap-1 text-xs font-medium text-slate-400 dark:text-slate-500">
            <div className="flex items-center gap-2 uppercase tracking-wider">
               <ImageIcon className="w-4 h-4" />
               <span>Up to 40MB per file</span>
            </div>
            <span>Max {MAX_BATCH_SIZE} photos per batch</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadZone;