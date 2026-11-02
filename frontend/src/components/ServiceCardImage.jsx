import React from 'react';

export default function ServiceCardImage({ src, alt, className = '' }) {
  const handleError = (event) => {
    const image = event.currentTarget;
    if (image.dataset.fallbackApplied) {
      image.hidden = true;
      return;
    }
    image.dataset.fallbackApplied = 'true';
    image.src = '/service-image-fallback.svg';
  };

  return (
    <div className={`service-card-image-wrap ${className}`}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={handleError}
      />
    </div>
  );
}
