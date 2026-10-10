// Line icons for everything that is not a tab.
//
// Lucide rather than emoji: emoji render in Apple's colour set whatever the
// theme, and they read as a chat app. A line icon takes the theme colour and
// the same stroke weight as the drawn tab icons. The name map keeps the pure
// modules (badges, games) free of React imports — they store a key, this draws it.

import {
  AudioWaveform,
  Bell,
  Bomb,
  BookOpen,
  Bot,
  Brain,
  Check,
  ChessKnight,
  ChevronRight,
  Crown,
  DoorOpen,
  Feather,
  FlaskConical,
  Gamepad2,
  Flame,
  Gem,
  Grid3x3,
  Heart,
  Library,
  ListOrdered,
  Lock,
  Medal,
  Mic,
  MicVocal,
  Mountain,
  Pause,
  Radio,
  Rocket,
  RotateCcw,
  Shield,
  Snowflake,
  Sparkles,
  Sword,
  Timer,
  Trophy,
  Volume2,
  Wind,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react-native";

import type { BadgeIcon } from "../../features/progression/badges";
import { CHROME } from "../../theme";

export type GlyphName =
  | BadgeIcon
  | "bot"
  | "shield"
  | "pause"
  | "bomb"
  | "flask"
  | "lock"
  | "trophy"
  | "snowflake"
  | "check"
  | "x"
  | "chevron"
  | "heart"
  | "replay"
  | "sparkles"
  | "bell"
  | "volume"
  | "timer";

const MAP: Record<GlyphName, LucideIcon> = {
  mic: Mic,
  "mic-vocal": MicVocal,
  medal: Medal,
  waveform: AudioWaveform,
  gem: Gem,
  sword: Sword,
  flame: Flame,
  zap: Zap,
  mountain: Mountain,
  book: BookOpen,
  feather: Feather,
  library: Library,
  knight: ChessKnight,
  door: DoorOpen,
  wind: Wind,
  rocket: Rocket,
  crown: Crown,
  bot: Bot,
  shield: Shield,
  pause: Pause,
  bomb: Bomb,
  flask: FlaskConical,
  lock: Lock,
  trophy: Trophy,
  snowflake: Snowflake,
  check: Check,
  x: X,
  chevron: ChevronRight,
  heart: Heart,
  replay: RotateCcw,
  sparkles: Sparkles,
  bell: Bell,
  volume: Volume2,
  timer: Timer,
  gamepad: Gamepad2,
  brain: Brain,
  grid: Grid3x3,
  "list-ordered": ListOrdered,
  radio: Radio,
};

export function Glyph({
  name,
  size = 22,
  color = CHROME.chalk,
  strokeWidth = 1.9,
  opacity,
}: {
  name: GlyphName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  opacity?: number;
}) {
  const Icon = MAP[name];
  return <Icon size={size} color={color} strokeWidth={strokeWidth} opacity={opacity} />;
}
