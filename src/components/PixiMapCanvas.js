import React, { useEffect, useRef, useState } from 'react';
import { Application, Assets, BlurFilter, Container, Graphics, Sprite, Text, TextStyle, TilingSprite } from 'pixi.js';
import fogTextureUrl from '../assets/visuals/fog-organic-v1.webp';
import heartSvg from '../assets/icons/heart.svg';
import shieldSvg from '../assets/icons/shield.svg';
import swordSvg from '../assets/icons/sword.svg';
import perceptionSvg from '../assets/icons/perception.svg';
import spellSvg from '../assets/icons/spell.svg';
import inventorySvg from '../assets/icons/inventory.svg';
import magicSvg from '../assets/icons/magic.svg';
import conditionsSvg from '../assets/icons/conditions.svg';
import strengthSvg from '../assets/icons/strength.svg';
import dexteritySvg from '../assets/icons/dexterity.svg';
import wisdomSvg from '../assets/icons/wisdom.svg';
import charismaSvg from '../assets/icons/charisma.svg';
import cloakSvg from '../assets/icons/cloak.svg';
import AppIcon from './AppIcon';
import { withLocalTokenArtwork } from '../lib/tacticalTokens';

const TOKEN_SIZES = { 1: 28, 2: 36, 3: 48, 4: 64, 5: 88, 6: 120 };
const SYMBOL_ASSETS = {
  heart: heartSvg, shield: shieldSvg, sword: swordSvg, perception: perceptionSvg,
  spell: spellSvg, inventory: inventorySvg, magic: magicSvg, conditions: conditionsSvg,
  strength: strengthSvg, dexterity: dexteritySvg, wisdom: wisdomSvg,
  charisma: charismaSvg, cloak: cloakSvg,
};

function monogram(label = 'Token') {
  return label.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
}

function safeColor(value, fallback = 0xf7dd78) {
  const parsed = Number.parseInt(String(value || '').replace('#', ''), 16);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function addPortraitOrSymbol(container, token, size, rounded = true) {
  const assetUrl = token.imageUrl || SYMBOL_ASSETS[token.symbolKey];
  if (assetUrl) {
    try {
      const texture = await Assets.load(assetUrl);
      const art = new Sprite(texture);
      art.anchor.set(0.5);
      art.width = size;
      art.height = size;
      const mask = new Graphics();
      if (rounded) mask.circle(0, 0, size / 2).fill(0xffffff);
      else mask.roundRect(-size / 2, -size / 2, size, size, Math.max(4, size * 0.12)).fill(0xffffff);
      container.addChild(art, mask);
      art.mask = mask;
      return;
    } catch (error) {
      console.warn('No se pudo cargar el arte de una ficha:', error);
    }
  }
  const fallback = new Text({
    text: monogram(token.label),
    style: new TextStyle({
      fontFamily: 'Cinzel, serif', fontSize: Math.round(size * 0.34), fontWeight: '700',
      fill: safeColor(token.color), align: 'center', letterSpacing: 1,
      stroke: { color: 0x010201, width: 3 },
    }),
  });
  fallback.anchor.set(0.5);
  container.addChild(fallback);
}

function legacyFog(viewport = {}, width, height) {
  const { t = 0, r = 0, b = 0, l = 0 } = viewport;
  return [
    t > 0 && [0, 0, width, height * t / 100],
    b > 0 && [0, height * (1 - b / 100), width, height * b / 100],
    l > 0 && [0, height * t / 100, width * l / 100, height * (100 - t - b) / 100],
    r > 0 && [width * (1 - r / 100), height * t / 100, width * r / 100, height * (100 - t - b) / 100],
  ].filter(Boolean);
}

export default function PixiMapCanvas({ map, dmView = false, compact = false }) {
  const mountRef = useRef(null);
  const appRef = useRef(null);
  const worldRef = useRef(null);
  const baseScaleRef = useRef(1);
  const zoomRef = useRef(1);
  const refreshTokensRef = useRef(() => {});
  const [status, setStatus] = useState('loading');
  const [engineError, setEngineError] = useState('');

  useEffect(() => {
    let disposed = false;
    let resizeObserver;
    const mount = mountRef.current;
    if (!mount || !map?.imageUrl) return undefined;

    const initialize = async () => {
      setStatus('loading');
      setEngineError('');

      try {
        const app = new Application();
        const compactViewport = compact || window.matchMedia('(max-width: 720px)').matches;
        const deviceMemory = Number(window.navigator.deviceMemory || 8);
        const resolutionCap = compactViewport || deviceMemory <= 4 ? 1.35 : 1.75;
        await app.init({
          resizeTo: mount,
          background: '#020403',
          antialias: true,
          autoDensity: true,
          resolution: Math.min(window.devicePixelRatio || 1, resolutionCap),
          preference: 'webgl',
        });

        if (disposed) {
          app.destroy(true);
          return;
        }

        appRef.current = app;
        app.canvas.className = 'pixi-map-canvas';
        app.canvas.setAttribute('role', 'img');
        mount.appendChild(app.canvas);

        const visibleTokens = (map.tokens || []).map(withLocalTokenArtwork).filter((token) => dmView || token.visibleToParty !== false);
        const tokenSummary = visibleTokens.map(token => token.label || 'Ficha').join(', ');
        app.canvas.setAttribute('aria-label', `${map.title || 'Mapa táctico'}. ${visibleTokens.length} fichas visibles${tokenSummary ? `: ${tokenSummary}` : ''}. Usá los controles de zoom para acercar o alejar.`);

        const [texture, fogTexture] = await Promise.all([
          Assets.load(map.imageUrl),
          Assets.load(fogTextureUrl),
        ]);
        if (disposed) return;

        const world = new Container();
        worldRef.current = world;
        app.stage.addChild(world);

        const mapSprite = new Sprite(texture);
        const worldWidth = Math.max(texture.width, 1);
        const worldHeight = Math.max(texture.height, 1);
        world.addChild(mapSprite);

        const grid = new Graphics();
        const gridCols = map.fog?.cols || 24;
        const gridRows = map.fog?.rows || 16;
        for (let x = 1; x < gridCols; x += 1) {
          grid.moveTo(worldWidth * x / gridCols, 0).lineTo(worldWidth * x / gridCols, worldHeight);
        }
        for (let y = 1; y < gridRows; y += 1) {
          grid.moveTo(0, worldHeight * y / gridRows).lineTo(worldWidth, worldHeight * y / gridRows);
        }
        grid.stroke({ color: 0xf7dd78, alpha: dmView ? 0.085 : 0.025, width: 1 });
        world.addChild(grid);

        const fogLayer = new Container();
        const fog = map.fog || {};
        const fogRects = [];
        if (fog.enabled) {
          const cellWidth = worldWidth / gridCols;
          const cellHeight = worldHeight / gridRows;
          (fog.hidden || []).forEach((key) => {
            const [x, y] = key.split(':').map(Number);
            fogRects.push([x * cellWidth - 1, y * cellHeight - 1, cellWidth + 2, cellHeight + 2]);
          });
        } else {
          fogRects.push(...legacyFog(map.viewport, worldWidth, worldHeight));
        }

        if (fogRects.length) {
          const shadowShape = new Graphics();
          fogRects.forEach(([x, y, width, height]) => shadowShape.rect(x, y, width, height));
          shadowShape.fill({ color: 0x010302, alpha: dmView ? 0.48 : 0.98 });
          shadowShape.filters = [new BlurFilter({ strength: dmView ? 7 : 10, quality: 2 })];
          fogLayer.addChild(shadowShape);

          const organicMask = new Graphics();
          fogRects.forEach(([x, y, width, height]) => organicMask.rect(x, y, width, height));
          organicMask.fill(0xffffff);

          const fogSurface = new TilingSprite({
            texture: fogTexture,
            width: worldWidth,
            height: worldHeight,
            tileScale: { x: 0.46, y: 0.46 },
          });
          fogSurface.alpha = dmView ? 0.26 : 0.72;
          fogSurface.mask = organicMask;
          fogLayer.addChild(fogSurface, organicMask);

          if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            app.ticker.add((ticker) => {
              if (document.hidden) return;
              fogSurface.tilePosition.x += 0.018 * ticker.deltaTime;
              fogSurface.tilePosition.y += 0.008 * ticker.deltaTime;
            });
          }
        }
        world.addChild(fogLayer);

        const tokenViews = [];
        await Promise.all(visibleTokens.map(async (token) => {
          const group = new Container();
          const compactView = new Container();
          const expandedView = new Container();
          const size = TOKEN_SIZES[token.size] || 48;
          const color = safeColor(token.color);
          const isCharacter = token.entityKind === 'character';
          const hasPortraitCard = isCharacter || Boolean(token.imageUrl);
          let selected = false;
          group.x = worldWidth * (token.x || 0) / 100;
          group.y = worldHeight * (token.y || 0) / 100;
          group.alpha = token.visibleToParty === false ? 0.5 : 1;
          group.eventMode = 'static';
          group.cursor = 'pointer';

          const tokenShadow = new Graphics()
            .ellipse(2, size * 0.18, size * 0.62, size * 0.46)
            .fill({ color: 0x000000, alpha: 0.72 });
          tokenShadow.filters = [new BlurFilter({ strength: Math.max(3, size * 0.08), quality: 2 })];
          const frame = new Graphics()
            .circle(0, 0, size * 0.6).fill({ color, alpha: 0.11 })
            .circle(0, 0, size * 0.53).fill({ color: 0x070a07, alpha: 0.98 })
            .circle(0, 0, size * 0.53).stroke({ color: 0x17170f, alpha: 1, width: Math.max(5, size * 0.1) })
            .circle(0, 0, size * 0.51).stroke({ color, alpha: 0.96, width: Math.max(2, size * 0.038) })
            .circle(0, 0, size * 0.455).stroke({ color: 0xf7e8ab, alpha: 0.34, width: 1 });
          if (hasPortraitCard) {
            const hpPct = Math.max(0, Math.min(1, Number(token.hp) / Math.max(1, Number(token.hpMax))));
            const createPortraitCard = async (container, cardWidth, cardHeight, fontScale = 1) => {
              const card = new Graphics()
                .roundRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 9)
                .fill({ color: 0x080a08, alpha: 0.97 })
                .roundRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 9)
                .stroke({ color, alpha: 0.84, width: 1.5 })
                .roundRect(-cardWidth / 2 + 3, -cardHeight / 2 + 3, cardWidth - 6, cardHeight - 6, 7)
                .stroke({ color: 0xf7dd78, alpha: 0.13, width: 1 });
              const portraitSize = cardHeight - 12;
              const portrait = new Container();
              portrait.x = -cardWidth / 2 + portraitSize / 2 + 6;
              await addPortraitOrSymbol(portrait, token, portraitSize, false);
              const textX = -cardWidth / 2 + portraitSize + 14;
              const name = new Text({ text: token.label || 'Aventurero', style: new TextStyle({ fontFamily: 'Cinzel, serif', fontSize: 10 * fontScale, fontWeight: '700', fill: 0xf5e9ba }) });
              name.x = textX;
              name.y = -cardHeight / 2 + 8;
              const meta = new Text({ text: isCharacter ? `${token.className || 'Aventurero'} · N${token.level || 1}` : (token.cat === 'monstruo' ? 'Criatura' : 'Encuentro'), style: new TextStyle({ fontFamily: 'Inter, sans-serif', fontSize: 8 * fontScale, fontWeight: '600', fill: 0xb4aa8f }) });
              meta.x = textX;
              meta.y = name.y + 15 * fontScale;
              if (isCharacter) {
                const hpWidth = cardWidth - portraitSize - 24;
                const healthY = cardHeight / 2 - 13;
                const health = new Graphics()
                  .roundRect(textX, healthY, hpWidth, 5, 3).fill({ color: 0x240d0a, alpha: 1 })
                  .roundRect(textX, healthY, hpWidth * hpPct, 5, 3).fill({ color: hpPct < 0.3 ? 0xc44338 : 0xd8784f, alpha: 1 });
                const hpLabel = new Text({ text: `${token.hp || 0}/${token.hpMax || 0} PG${dmView && token.armorClass ? ` · CA ${token.armorClass}` : ''}`, style: new TextStyle({ fontFamily: 'Inter, sans-serif', fontSize: 7 * fontScale, fontWeight: '700', fill: 0xe8d9b0 }) });
                hpLabel.x = textX;
                hpLabel.y = healthY - 11 * fontScale;
                container.addChild(card, portrait, name, meta, health, hpLabel);
              } else container.addChild(card, portrait, name, meta);
            };
            await createPortraitCard(compactView, 138, 54, 1);
            await createPortraitCard(expandedView, 190, 70, 1.08);
          } else {
            compactView.addChild(tokenShadow, frame);
            await addPortraitOrSymbol(compactView, token, size * 0.88, true);
            expandedView.visible = false;
          }

          const updateMode = () => {
            const expand = hasPortraitCard && (selected || zoomRef.current >= (dmView ? 1.18 : 1.35));
            compactView.visible = !expand;
            expandedView.visible = expand;
          };
          group.on('pointertap', event => {
            selected = !selected;
            updateMode();
            event.stopPropagation();
          });
          group.addChild(compactView, expandedView);
          tokenViews.push(updateMode);
          updateMode();
          world.addChild(group);
        }));
        refreshTokensRef.current = () => tokenViews.forEach(refresh => refresh());

        const fitWorld = () => {
          if (!app.renderer || !worldRef.current) return;
          const viewWidth = app.renderer.width / app.renderer.resolution;
          const viewHeight = app.renderer.height / app.renderer.resolution;
          const fit = Math.min(viewWidth / worldWidth, viewHeight / worldHeight);
          baseScaleRef.current = fit;
          world.scale.set(fit * zoomRef.current);
          world.x = (viewWidth - worldWidth * world.scale.x) / 2;
          world.y = (viewHeight - worldHeight * world.scale.y) / 2;
        };

        resizeObserver = new ResizeObserver(() => {
          app.resize();
          fitWorld();
        });
        resizeObserver.observe(mount);
        fitWorld();

        const pointers = new Map();
        let lastPoint = null;
        let pinchDistance = 0;
        let pinchWorldPoint = null;
        app.stage.eventMode = 'static';
        app.stage.hitArea = app.screen;
        app.stage.on('pointerdown', (event) => {
          pointers.set(event.pointerId, event.global.clone());
          lastPoint = event.global.clone();
          app.canvas.classList.add('is-dragging');
          if (pointers.size === 2) {
            const [first, second] = [...pointers.values()];
            pinchDistance = Math.hypot(second.x - first.x, second.y - first.y);
            const center = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
            pinchWorldPoint = {
              x: (center.x - world.x) / world.scale.x,
              y: (center.y - world.y) / world.scale.y,
            };
          }
        });
        app.stage.on('globalpointermove', (event) => {
          const next = event.global;
          if (!pointers.has(event.pointerId)) return;
          pointers.set(event.pointerId, next.clone());
          if (pointers.size >= 2) {
            const [first, second] = [...pointers.values()];
            const distance = Math.hypot(second.x - first.x, second.y - first.y);
            const center = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
            if (pinchDistance > 0 && pinchWorldPoint) {
              const ratio = distance / pinchDistance;
              zoomRef.current = Math.min(3.2, Math.max(0.65, zoomRef.current * ratio));
              world.scale.set(baseScaleRef.current * zoomRef.current);
              refreshTokensRef.current();
              world.x = center.x - pinchWorldPoint.x * world.scale.x;
              world.y = center.y - pinchWorldPoint.y * world.scale.y;
            }
            pinchDistance = distance;
            pinchWorldPoint = {
              x: (center.x - world.x) / world.scale.x,
              y: (center.y - world.y) / world.scale.y,
            };
          } else if (lastPoint) {
            world.x += next.x - lastPoint.x;
            world.y += next.y - lastPoint.y;
            lastPoint = next.clone();
          }
        });
        const endDrag = (event) => {
          pointers.delete(event.pointerId);
          pinchDistance = 0;
          pinchWorldPoint = null;
          lastPoint = pointers.size === 1 ? [...pointers.values()][0].clone() : null;
          if (pointers.size === 0) app.canvas.classList.remove('is-dragging');
        };
        app.stage.on('pointerup', endDrag);
        app.stage.on('pointerupoutside', endDrag);
        app.stage.on('pointercancel', endDrag);

        app.canvas.addEventListener('wheel', (event) => {
          event.preventDefault();
          const nextZoom = Math.min(3.2, Math.max(0.65, zoomRef.current * (event.deltaY > 0 ? 0.9 : 1.1)));
          const rect = app.canvas.getBoundingClientRect();
          const pointerX = event.clientX - rect.left;
          const pointerY = event.clientY - rect.top;
          const worldPointX = (pointerX - world.x) / world.scale.x;
          const worldPointY = (pointerY - world.y) / world.scale.y;
          zoomRef.current = nextZoom;
          world.scale.set(baseScaleRef.current * nextZoom);
          refreshTokensRef.current();
          world.x = pointerX - worldPointX * world.scale.x;
          world.y = pointerY - worldPointY * world.scale.y;
        }, { passive: false });

        setStatus('ready');
      } catch (error) {
        console.error('No se pudo iniciar PixiJS:', error);
        setEngineError('El motor gráfico no pudo iniciarse en este dispositivo.');
        setStatus('error');
      }
    };

    initialize();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      worldRef.current = null;
      refreshTokensRef.current = () => {};
      if (appRef.current) {
        appRef.current.destroy(true, { children: true, texture: false, textureSource: false });
        appRef.current = null;
      }
      if (mount) mount.replaceChildren();
    };
  }, [map, dmView]);

  const updateZoom = (factor) => {
    const app = appRef.current;
    const world = worldRef.current;
    if (!app || !world) return;
    zoomRef.current = Math.min(3.2, Math.max(0.65, zoomRef.current * factor));
    world.scale.set(baseScaleRef.current * zoomRef.current);
    refreshTokensRef.current();
  };

  const resetView = () => {
    const app = appRef.current;
    const world = worldRef.current;
    if (!app || !world) return;
    zoomRef.current = 1;
    refreshTokensRef.current();
    const width = app.renderer.width / app.renderer.resolution;
    const height = app.renderer.height / app.renderer.resolution;
    world.scale.set(baseScaleRef.current);
    world.x = (width - world.width) / 2;
    world.y = (height - world.height) / 2;
  };

  return (
    <div className={`pixi-map-stage${compact ? ' pixi-map-stage--compact' : ''}`}>
      <div ref={mountRef} className="pixi-map-mount" />
      {status === 'loading' && <div className="pixi-map-loading"><span>✦</span>Cargando escena táctica</div>}
      {status === 'error' && (
        <div className="pixi-map-fallback">
          <img src={map.imageUrl} alt={map.title || 'Mapa activo'} />
          <span>{engineError}</span>
        </div>
      )}
      {status === 'ready' && (
        <div className="pixi-map-tools" aria-label="Controles del mapa">
          <button type="button" onClick={() => updateZoom(1.18)} aria-label="Acercar"><AppIcon name="plus" size={17} /></button>
          <button type="button" onClick={() => updateZoom(0.84)} aria-label="Alejar"><AppIcon name="minus" size={17} /></button>
          <button type="button" onClick={resetView} aria-label="Centrar mapa"><AppIcon name="crosshair" size={17} /></button>
        </div>
      )}
      <div className="pixi-engine-badge"><i /> PixiJS · Tiempo real</div>
    </div>
  );
}
