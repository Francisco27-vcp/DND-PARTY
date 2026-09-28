import React, { lazy, Suspense } from 'react';

const PixiMapCanvas = lazy(() => import('./PixiMapCanvas'));

export default function LiveMapCanvas({ map, dmView = false, compact = false }) {
  if (!map) {
    return (
      <div className="live-map-empty">
        <span>✦</span>
        <strong>Esperando una escena</strong>
      </div>
    );
  }

  return (
    <Suspense fallback={
      <div className={`pixi-map-stage${compact ? ' pixi-map-stage--compact' : ''}`}>
        <img className="live-map-image" src={map.imageUrl} alt={map.title || 'Mapa activo'} draggable={false} />
        <div className="pixi-map-loading"><span>✦</span>Preparando motor gráfico</div>
      </div>
    }>
      <PixiMapCanvas map={map} dmView={dmView} compact={compact} />
    </Suspense>
  );
}
