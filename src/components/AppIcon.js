import React from 'react';
import {
  BookOpen, CalendarDays, CirclePause, CirclePlay, Crosshair, Crown,
  DoorOpen, Eye, Globe2, Hammer, LayoutDashboard, LockKeyhole, LogOut,
  Map, MapPinned, MessageCircle, Minus, MoonStar, NotebookPen, Plus, Radio,
  FlaskConical, Redo2, RotateCcw, ScrollText, Shield, Sparkles, Sword, Swords, Undo2, UserRound, WandSparkles,
  Wrench, EyeOff, Grid3X3, Scissors, Trash2, X,
} from 'lucide-react';

const ICONS = {
  book: BookOpen,
  calendar: CalendarDays,
  crosshair: Crosshair,
  crown: Crown,
  dm: Wrench,
  door: DoorOpen,
  eye: Eye,
  eyeOff: EyeOff,
  globe: Globe2,
  hammer: Hammer,
  history: Map,
  lock: LockKeyhole,
  logout: LogOut,
  map: MapPinned,
  grid: Grid3X3,
  message: MessageCircle,
  minus: Minus,
  moon: MoonStar,
  notes: NotebookPen,
  overview: LayoutDashboard,
  pause: CirclePause,
  play: CirclePlay,
  plus: Plus,
  radio: Radio,
  reset: RotateCcw,
  redo: Redo2,
  scroll: ScrollText,
  scissors: Scissors,
  sword: Sword,
  shield: Shield,
  potion: FlaskConical,
  magic: WandSparkles,
  sparkles: Sparkles,
  swords: Swords,
  undo: Undo2,
  user: UserRound,
  wand: WandSparkles,
  trash: Trash2,
  close: X,
};

export default function AppIcon({ name, size = 18, strokeWidth = 1.6, ...props }) {
  const Icon = ICONS[name] || Sparkles;
  return <Icon aria-hidden="true" size={size} strokeWidth={strokeWidth} {...props} />;
}
