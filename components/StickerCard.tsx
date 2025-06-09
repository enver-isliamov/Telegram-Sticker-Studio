

import React, { useState, useEffect } from 'react';
import { Sticker } from '../types';
import { useLanguage } from '../i18n.js'; // Изменено на .js

// Dynamically load Lucide icons if available
const LucideDownload = window.LucideIcons?.Download || (({ className, width, height }) => React.createElement('span', { className, style: { width, height, display: 'inline-block' } }, '⬇️'));
const LucideEdit2 = window.LucideIcons?.Edit2 || (({ className, width, height }) => React.createElement('span', { className, style: { width, height, display: 'inline-block' } }, '✏️'));
const LucideSave = window.LucideIcons?.Save || (({ className, width, height }) => React.createElement('span', { className, style: { width, height, display: 'inline-block' } }, '💾'));
// const LucideClock = window.LucideIcons?.Clock || (({ className, width, height }) => React.createElement('span', { className, style: { width, height, display: 'inline-block' } }, '⏰')); // AI Pending UI removed


interface StickerCardProps {
  sticker: Sticker;
  onNameChange: (id: string, newNameWithExt: string) => void;
  disabled?: boolean; 
  // isAiNamePending?: boolean; // Removed
}

export const StickerCard: React.FC<StickerCardProps> = ({ sticker, onNameChange, disabled }) => {
  const { t } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const [currentName, setCurrentName] = useState(sticker.suggestedName);

  useEffect(() => {
    setCurrentName(sticker.suggestedName); 
  }, [sticker.suggestedName]);

  const actualDisabled = disabled;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = sticker.dataUrl;
    link.download = sticker.suggestedName; 
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleNameSave = () => {
    if (actualDisabled) return; 
    const trimmedName = currentName.trim();
    const namePart = trimmedName.substring(0, trimmedName.lastIndexOf('.'));
    const extensionPart = trimmedName.substring(trimmedName.lastIndexOf('.'));

    if (namePart && (extensionPart === '.png' || extensionPart === '.webp')) {
        onNameChange(sticker.id, trimmedName);
    } else {
        // If validation fails (e.g. no extension, or wrong extension), revert to original suggested name
        // Consider providing user feedback here
        setCurrentName(sticker.suggestedName); 
    }
    setIsEditing(false);
  };
  
  const handleInputKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleNameSave();
    }
    if (e.key === 'Escape') {
      setCurrentName(sticker.suggestedName);
      setIsEditing(false);
    }
  };

  return (
    <div className={`bg-slate-700 bg-opacity-50 rounded-lg shadow-lg p-4 flex flex-col items-center transition-all duration-300 ${!actualDisabled ? 'hover:shadow-sky-500/30 hover:scale-105' : ''}`}>
      <div className="relative w-32 h-32 mb-4 flex items-center justify-center bg-slate-800 rounded overflow-hidden border border-slate-600">
        <img 
            src={sticker.dataUrl} 
            alt={sticker.suggestedName} 
            className="max-w-full max-h-full object-contain" 
        />
      </div>
      
      {isEditing && !actualDisabled ? (
        <div className="w-full flex items-center mb-2">
          <input
            type="text"
            value={currentName} 
            onChange={(e) => setCurrentName(e.target.value)}
            onKeyPress={handleInputKeyPress}
            onBlur={handleNameSave} 
            className="flex-grow bg-slate-600 text-slate-100 text-sm p-2 rounded-l-md focus:ring-2 focus:ring-sky-500 outline-none"
            maxLength={60} 
            autoFocus
          />
          <button 
            onClick={handleNameSave}
            className="p-2 bg-sky-600 hover:bg-sky-700 text-white rounded-r-md transition-colors"
            title={t('stickerCardSaveNameTooltip')}
          >
            <LucideSave width={18} height={18} />
          </button>
        </div>
      ) : (
        <div 
            className={`w-full flex items-center justify-between mb-2 group ${!actualDisabled ? 'cursor-pointer' : 'cursor-default'}`}
            onClick={() => !actualDisabled && setIsEditing(true)}
            title={!actualDisabled ? t('stickerCardEditNameTooltip') : ''} 
        >
            <p className={`text-sm text-slate-200 truncate break-all ${!actualDisabled ? 'group-hover:text-sky-400' : ''} transition-colors`} style={{maxWidth: 'calc(100% - 28px)'}}>
              {sticker.suggestedName}
            </p>
            {!actualDisabled && (
              <LucideEdit2 width={16} height={16} className="text-slate-400 group-hover:text-sky-400 transition-colors ml-1 flex-shrink-0" />
            )}
        </div>
      )}
      
      <p className="text-xs text-slate-400 mb-3 w-full truncate" title={sticker.originalName}>
        {t('stickerCardOriginalNameLabel')}: {sticker.originalName}
      </p>

      <button
        onClick={handleDownload}
        className="w-full mt-auto bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md text-sm flex items-center justify-center transition-colors shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-75"
      >
        <LucideDownload width={16} height={16} className="mr-2" />
        {t('stickerCardDownloadButton')}
      </button>
    </div>
  );
};
