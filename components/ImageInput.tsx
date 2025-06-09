import React, { ChangeEvent, RefObject } from 'react';
import { useLanguage } from '../i18n';

// Dynamically load Lucide icons if available
const LucideFolderOpen = window.LucideIcons?.FolderOpen || (({ className }) => React.createElement('span', { className }, '📁'));

interface ImageInputProps {
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}

export const ImageInput: React.FC<ImageInputProps> = ({ onChange, disabled }) => {
  const { t } = useLanguage();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  return (
    <div className="mb-6 p-6 border-2 border-dashed border-slate-600 hover:border-sky-500 transition-colors rounded-lg text-center">
      <input
        ref={inputRef as RefObject<HTMLInputElement>} 
        type="file"
        webkitdirectory="" 
        directory="" 
        multiple 
        onChange={onChange}
        disabled={disabled}
        className="hidden" 
        accept="image/png, image/jpeg, image/gif, image/webp"
      />
      <button
        onClick={handleClick}
        disabled={disabled}
        className={`w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-opacity-75 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <LucideFolderOpen className="w-6 h-6 mr-3" />
        {t('selectImageFolderButton')}
      </button>
      <p className="text-sm text-slate-400 mt-3">
        {t('selectImageFolderHint')}
      </p>
       <p className="text-xs text-slate-500 mt-1">
        {t('selectImageFolderNote')}
      </p>
    </div>
  );
};
