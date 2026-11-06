/**
 * M0 — Scene graph contracts (JSON-compatible declarative model).
 * The central runtime representation. No React in the compositor path.
 *
 * M3: transform/opacity props accept AnimNumber — plain-data animation
 * bindings evaluated against the node's local frame (still JSON-serializable).
 */
import type { AnimNumber, ColorBinding } from '../animation/bindings.js';
import type { Caption, CaptionHighlightMode, CaptionReveal } from '../captions/types.js';
import type { FillInput } from '../renderer/types.js';
/** Paint for shape/text fills: flat, gradient, or keyframed color. */
export type Fill = FillInput | ColorBinding;
export interface Vec2 {
    x: number;
    y: number;
}
/** Independent transform props (never one opaque string). */
export interface Transform {
    translateX?: number;
    translateY?: number;
    scaleX?: number;
    scaleY?: number;
    /** Degrees, clockwise. */
    rotation?: number;
    /** Anchor / origin in local units, default depends on node. */
    anchorX?: number;
    anchorY?: number;
}
export type BlendMode = 'source-over' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity';
export interface ClipRect {
    x: number;
    y: number;
    width: number;
    height: number;
    /** Rounded clipping (CSS overflow:hidden + border-radius equivalent). */
    radius?: number | [number, number, number, number];
}
/**
 * Declarative filter stack (CSS `filter` essentials).
 * Applied natively by the backend (no pixel loops): blur in px, the rest
 * as unitless factors. Every field accepts a plain number or an
 * AnimNumber binding — focus pulls, grade shifts, and blur reveals are
 * frame-pure. All resolved values must be finite and non-negative.
 */
export interface NodeFilter {
    blur?: AnimNumber;
    brightness?: AnimNumber;
    contrast?: AnimNumber;
    saturate?: AnimNumber;
    grayscale?: AnimNumber;
}
/** Effect invocation in the compositing pipeline (composable, ordered). */
export interface Effect {
    type: string;
    params?: Record<string, unknown>;
    disabled?: boolean;
}
export interface BaseNode {
    id: string;
    x?: AnimNumber;
    y?: AnimNumber;
    scaleX?: AnimNumber;
    scaleY?: AnimNumber;
    rotation?: AnimNumber;
    /** 2.5D tilt in degrees (shear). Frame-pure; composes as T·A·R·Sk·S·A⁻¹. */
    skewX?: AnimNumber;
    skewY?: AnimNumber;
    anchorX?: number;
    anchorY?: number;
    opacity?: AnimNumber;
    visible?: boolean;
    blendMode?: BlendMode;
    crop?: ClipRect;
    clip?: ClipRect;
    /** Declarative GPU-style filter (blur/grades); every field animatable. */
    filter?: NodeFilter;
    /**
     * CSS `backdrop-filter: blur()` equivalent: blurs already-painted pixels
     * inside the node's own axis-aligned bbox BEFORE the node paints.
     * Radius in px (surface units); accepts an AnimNumber for blur reveals.
     * Supported on rect/rrect/circle with resolvable geometry; every other
     * type throws. Ancestors must be translation-only (opacity is fine) —
     * scale/rotation above would misplace the blurred region.
     */
    backdropBlur?: AnimNumber;
    /** Reference to a mask node id. */
    mask?: string;
    effects?: Effect[];
    children?: SceneNode[];
}
export interface ContainerNode extends BaseNode {
    type: 'container';
}
export interface GroupNode extends BaseNode {
    type: 'group';
}
export interface RectangleNode extends BaseNode {
    type: 'rect';
    /** Kinetic geometry: grows, shrinks, and wipes frame-pure. */
    width: AnimNumber;
    height: AnimNumber;
    fill?: Fill;
    stroke?: string;
    strokeWidth?: number;
    /** Drop shadow (CSS box-shadow approximation, no spread/inset). */
    shadow?: TextShadow;
}
export interface RoundedRectangleNode extends BaseNode {
    type: 'rrect';
    /** Kinetic geometry (see RectangleNode). Tuple radii stay static. */
    width: AnimNumber;
    height: AnimNumber;
    radius: AnimNumber | [number, number, number, number];
    fill?: Fill;
    stroke?: string;
    strokeWidth?: number;
    /** Drop shadow (CSS box-shadow approximation, no spread/inset). */
    shadow?: TextShadow;
}
export interface CircleNode extends BaseNode {
    type: 'circle';
    /** Kinetic radius: pulses and blooms frame-pure. */
    radius: AnimNumber;
    fill?: Fill;
    stroke?: string;
    strokeWidth?: number;
    /** Drop shadow (CSS box-shadow approximation, no spread/inset). */
    shadow?: TextShadow;
}
export interface PathNode extends BaseNode {
    type: 'path';
    /** SVG path data. */
    d: string;
    /**
     * Baked morph frames (see `bakeMorph`): per-local-frame `d` values,
     * indexed by clamped local frame. Overrides `d` when non-empty.
     */
    frames?: string[];
    fill?: Fill;
    stroke?: string;
    strokeWidth?: number;
}
export interface SvgNode extends BaseNode {
    type: 'svg';
    /** Raw SVG markup or asset id (see assets/types). */
    svg: string;
    width?: AnimNumber;
    height?: AnimNumber;
}
export interface TextNode extends BaseNode {
    type: 'text';
    text: string;
    fontFamily: string;
    /** Kinetic type: grows/shrinks with the local frame (re-laid-out per frame). */
    fontSize: AnimNumber;
    fontWeight?: number | string;
    fontStyle?: 'normal' | 'italic' | 'oblique';
    /** Multiplier of fontSize (default 1.2). */
    lineHeight?: number;
    /** Kinetic tracking: animatable like fontSize. */
    letterSpacing?: AnimNumber;
    textAlign?: 'left' | 'center' | 'right' | 'justify';
    textTransform?: 'none' | 'uppercase' | 'lowercase';
    fill?: Fill;
    stroke?: string;
    strokeWidth?: number;
    shadow?: TextShadow;
    maxWidth?: number;
}
export interface TextShadow {
    color: string;
    blur?: number;
    offsetX?: number;
    offsetY?: number;
}
/**
 * M8 — Caption node: timed word captions rendered TikTok-style.
 * Pure data: the compositor derives pages (combineMs), lines
 * (maxCharsPerLine), highlight and reveal from (localFrame, fps).
 */
export interface CaptionNode extends BaseNode {
    type: 'caption';
    /** Word-timed captions (Whisper-style JSON, no transcription inside). */
    captions: Caption[];
    /** TikTok pagination window (ms of speech per page). */
    combineMs: number;
    /** Silence gap (ms) that forces a page break. */
    breakSilenceMs?: number;
    /** Hard line length (chars); pages split into lines via segments. */
    maxCharsPerLine?: number;
    /** Spoken vs upcoming coloring. */
    highlight?: CaptionHighlightMode;
    /** Future-hiding behavior. */
    reveal?: CaptionReveal;
    fontFamily: string;
    fontSize: number;
    fontWeight?: number | string;
    fontStyle?: 'normal' | 'italic' | 'oblique';
    letterSpacing?: number;
    lineHeight?: number;
    textAlign?: 'left' | 'center' | 'right' | 'justify';
    textTransform?: 'none' | 'uppercase' | 'lowercase';
    /** Upcoming-word fill (base). */
    fill?: string;
    /** Spoken/active-word fill. */
    highlightFill?: string;
    /** Box behind every visible word (subtitle background). */
    background?: string;
    /** Box behind spoken/active words (karaoke wash). Overrides background. */
    activeBackground?: string;
    backgroundPadding?: number;
    backgroundRadius?: number | [number, number, number, number];
    stroke?: string;
    strokeWidth?: number;
    shadow?: TextShadow;
    maxWidth?: number;
    /** Per-token fade-in after its start (ms, 0 = instant). */
    enterFadeMs?: number;
    /** Page fade-out before its end (ms, 0 = hard cut). */
    exitFadeMs?: number;
}
export interface ImageNode extends BaseNode {
    type: 'image';
    /** Asset id (preferred) or inline src. */
    src: string;
    width?: AnimNumber;
    height?: AnimNumber;
    /** CSS-like fit inside width/height box. */
    fit?: 'cover' | 'contain' | 'fill' | 'none';
}
export interface VideoNode extends BaseNode {
    type: 'video';
    src: string;
    /** Offset into the source timeline, in seconds. */
    startFrom?: number;
    /** Seconds of (offset) media skipped before the first local frame. */
    trimBefore?: number;
    /** Media-time end (seconds) for trim/loop window. */
    trimAfter?: number;
    volume?: number;
    playbackRate?: number;
    /** true = wrap; 'pingpong' = forward-backward (short clips stay alive). */
    loop?: boolean | 'pingpong';
    fit?: 'cover' | 'contain' | 'fill' | 'none';
    width?: AnimNumber;
    height?: AnimNumber;
}
export interface ShapeNode extends BaseNode {
    type: 'shape';
    shape: 'star' | 'polygon' | 'arrow' | 'ellipse' | 'line';
    /** Kinetic geometry (resolved per frame like rect dims). */
    width: AnimNumber;
    height: AnimNumber;
    points?: number;
    fill?: Fill;
    stroke?: string;
    strokeWidth?: number;
    shadow?: TextShadow;
}
export interface MaskNode extends BaseNode {
    type: 'mask';
    /** Optional cutout rect (local 0,0,w,h clip); without dims, pass-through group. */
    width?: number;
    height?: number;
}
export interface EffectLayerNode extends BaseNode {
    type: 'effectLayer';
    /** Full-node effect applied to everything beneath in paint order. */
    effect: Effect;
}
export type SceneNode = ContainerNode | GroupNode | RectangleNode | RoundedRectangleNode | CircleNode | PathNode | SvgNode | TextNode | CaptionNode | ImageNode | VideoNode | ShapeNode | MaskNode | EffectLayerNode;
export interface VideoComposition {
    id: string;
    width: number;
    height: number;
    fps: number;
    durationInFrames: number;
    root: SceneNode;
}
/** Top-level plan: composition + timeline binding + assets. */
export interface VideoPlan {
    composition: VideoComposition;
    /** Timeline overlay (sequences/series/loops) bound to scene refs. */
    timeline?: import('../timeline/types.js').TimelineNode;
    assets?: import('../assets/types.js').AssetRef[];
    /** Mixed at encode time (see @x80/media); compositor ignores audio. */
    audio?: import('../assets/types.js').AudioMixRequest[];
}
//# sourceMappingURL=types.d.ts.map