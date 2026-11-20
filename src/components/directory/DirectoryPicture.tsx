import React, { useState, useEffect } from 'react';
import { Camera } from 'lucide-react';

interface DirectoryPictureProps {
  src?: string;
  alt: string;
  fallback: React.ReactNode;
  containerClassName?: string;
  imageClassName?: string;
  canEdit?: boolean;
  onEditClick?: () => void;
  editLabel?: string;
}

export const DirectoryPicture: React.FC<DirectoryPictureProps> = ({
  src,
  alt,
  fallback,
  containerClassName = 'w-12 h-12 rounded-2xl',
  imageClassName = 'w-full h-full object-cover',
  canEdit = false,
  onEditClick,
  editLabel = 'Ubah gambar',
}) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const showImage = Boolean(src && !hasError);

  const innerContent = (
    <div
      className={`relative overflow-hidden shrink-0 flex items-center justify-center bg-slate-100 border border-slate-200/90 ${containerClassName}`}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setHasError(true)}
          className={imageClassName}
        />
      ) : (
        fallback
      )}

      {canEdit && (
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-slate-950/0 group-hover/pic:bg-slate-950/45 transition-colors flex items-center justify-center"
        >
          <span className="opacity-0 group-hover/pic:opacity-100 group-focus-visible/pic:opacity-100 transition-opacity p-1.5 rounded-full bg-white/95 text-slate-800 shadow-sm">
            <Camera className="w-3.5 h-3.5" />
          </span>
        </span>
      )}
    </div>
  );

  if (canEdit && onEditClick) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEditClick();
        }}
        title={editLabel}
        aria-label={editLabel}
        className="group/pic relative shrink-0 rounded-2xl cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
      >
        {innerContent}
        <span
          aria-hidden="true"
          className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-indigo-600 text-white border-2 border-white flex items-center justify-center shadow-xs group-hover/pic:bg-indigo-700 transition-colors"
        >
          <Camera className="w-2.5 h-2.5" />
        </span>
      </button>
    );
  }

  return innerContent;
};
