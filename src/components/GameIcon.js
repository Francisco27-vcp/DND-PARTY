// src/components/GameIcon.js — local SVG icons with CSS color filter
import React from 'react';

import heartSvg        from '../assets/icons/heart.svg';
import shieldSvg       from '../assets/icons/shield.svg';
import swordSvg        from '../assets/icons/sword.svg';
import broadswordSvg   from '../assets/icons/broadsword.svg';
import initiativeSvg   from '../assets/icons/initiative.svg';
import speedSvg        from '../assets/icons/speed.svg';
import proficiencySvg  from '../assets/icons/proficiency.svg';
import inspirationSvg  from '../assets/icons/inspiration.svg';
import perceptionSvg   from '../assets/icons/perception.svg';
import diceSvg         from '../assets/icons/dice.svg';
import spellSvg        from '../assets/icons/spell.svg';
import inventorySvg    from '../assets/icons/inventory.svg';
import loreSvg         from '../assets/icons/lore.svg';
import potionSvg       from '../assets/icons/potion.svg';
import magicSvg        from '../assets/icons/magic.svg';
import armorSvg        from '../assets/icons/armor.svg';
import conditionsSvg   from '../assets/icons/conditions.svg';
import strengthSvg     from '../assets/icons/strength.svg';
import dexteritySvg    from '../assets/icons/dexterity.svg';
import constitutionSvg from '../assets/icons/constitution.svg';
import intelligenceSvg from '../assets/icons/intelligence.svg';
import wisdomSvg       from '../assets/icons/wisdom.svg';
import charismaSvg     from '../assets/icons/charisma.svg';
import ringSvg         from '../assets/icons/ring.svg';
import bootsSvg        from '../assets/icons/boots.svg';
import helmetSvg       from '../assets/icons/helmet.svg';
import cloakSvg        from '../assets/icons/cloak.svg';
import levelupSvg      from '../assets/icons/levelup.svg';

// Maps "${author}/${name}" → local SVG asset URL
const ICON_MAP = {
  'lorc/heart-inside':          heartSvg,
  'lorc/shield-reflect':        shieldSvg,
  'lorc/crossed-swords':        swordSvg,
  'lorc/broadsword':            broadswordSvg,
  'lorc/sprint':                initiativeSvg,
  'lorc/run':                   speedSvg,
  'lorc/star-prominences':      proficiencySvg,
  'lorc/bright-explosion':      inspirationSvg,
  'lorc/magnifying-glass':      perceptionSvg,
  'delapouite/dice-six-faces-six': diceSvg,
  'lorc/magic-swirl':           spellSvg,
  'lorc/knapsack':              inventorySvg,
  'lorc/scroll-unfurled':       loreSvg,
  'lorc/potion-ball':           potionSvg,
  'lorc/crystal-wand':          magicSvg,
  'lorc/breastplate':           armorSvg,
  'lorc/skull-crossed-bones':   conditionsSvg,
  'lorc/strong':                strengthSvg,
  'lorc/juggler':               dexteritySvg,
  'lorc/aura':                  constitutionSvg,
  'lorc/brain':                 intelligenceSvg,
  'lorc/meditation':            wisdomSvg,
  'lorc/angel-outfit':          charismaSvg,
  'delapouite/ring':            ringSvg,
  'delapouite/sabatons':        bootsSvg,
  'lorc/barbute':               helmetSvg,
  'lorc/cloak-dagger':          cloakSvg,
  'delapouite/upgrade':         levelupSvg,
};

// CSS filters to colorize white SVGs — key is hex color without #
const COLOR_FILTERS = {
  'c7a242': 'brightness(0) saturate(100%) invert(78%) sepia(45%) saturate(500%) hue-rotate(5deg) brightness(95%)',
  'f7dd78': 'brightness(0) saturate(100%) invert(90%) sepia(60%) saturate(400%) hue-rotate(5deg) brightness(105%)',
  'a6ee81': 'brightness(0) saturate(100%) invert(85%) sepia(30%) saturate(400%) hue-rotate(70deg)',
  '9d9275': 'brightness(0) saturate(30%) invert(60%) sepia(10%) saturate(300%) hue-rotate(20deg)',
  '4a4030': 'brightness(0) saturate(20%) invert(22%) sepia(25%) hue-rotate(5deg)',
  'ffffff': 'brightness(0) invert(1)',
};

const DEFAULT_FILTER = COLOR_FILTERS['c7a242'];

export default function GameIcon({ author, name, size = 24, color = 'c7a242', style = {} }) {
  const src = ICON_MAP[`${author}/${name}`];
  if (!src) return <span style={{ width: size, height: size, display: 'inline-block' }} />;
  const filter = COLOR_FILTERS[color] || DEFAULT_FILTER;
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt={name}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, filter, ...style }}
    />
  );
}
