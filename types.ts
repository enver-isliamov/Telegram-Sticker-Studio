
import React from 'react'; // Ensure React is imported for SVGProps and module augmentation

export interface ProcessedSticker {
  dataUrl: string;
  blob: Blob;
  filename: string;
}

export interface Sticker {
  id: string;
  originalName: string;
  suggestedName: string; // This will now always include the extension and be unique
  dataUrl: string;
  blob: Blob;
  // isAiNamePending?: boolean; // Removed - AI naming is disabled
}

/* // Removed - AI Naming Queue is disabled
export interface QueuedStickerTask {
  stickerId: string; 
  originalFileName: string; 
  assignedPrefix: string; 
  baseNameForAi: string; 
  originalExtension: string;
}
*/


// Augment React's InputHTMLAttributes to include non-standard directory selection properties
declare module 'react' {
  interface InputHTMLAttributes<T> {
    webkitdirectory?: string;
    directory?: string;
  }
}

declare global {
  interface Window {
    LucideIcons?: {
      AlertTriangle: React.FC<React.SVGProps<SVGSVGElement>>;
      CheckCircle: React.FC<React.SVGProps<SVGSVGElement>>;
      Image: React.FC<React.SVGProps<SVGSVGElement>>;
      Sparkles: React.FC<React.SVGProps<SVGSVGElement>>;
      FolderOpen: React.FC<React.SVGProps<SVGSVGElement>>;
      Download: React.FC<React.SVGProps<SVGSVGElement>>;
      Edit2: React.FC<React.SVGProps<SVGSVGElement>>;
      Save: React.FC<React.SVGProps<SVGSVGElement>>;
      Archive: React.FC<React.SVGProps<SVGSVGElement>>; 
      Layers: React.FC<React.SVGProps<SVGSVGElement>>; 
      FileText: React.FC<React.SVGProps<SVGSVGElement>>;
      WifiOff: React.FC<React.SVGProps<SVGSVGElement>>;
      Clock: React.FC<React.SVGProps<SVGSVGElement>>; // Keep for now, might be used elsewhere or in future
    };
  }
}
