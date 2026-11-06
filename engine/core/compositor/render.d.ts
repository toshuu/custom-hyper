/**
 * M3 — Frame compositor (backend-agnostic).
 *
 * Pipeline: VideoPlan timeline → resolveTimeline → visible leaves →
 * scene-node lookup → declarative bindings evaluated at leaf localFrame →
 * Renderer interface calls. No backend imports here: Pixi/Vello/GPU backends
 * can reuse this file unchanged.
 */
import type { TextMeasurer } from '../text/types.js';
import type { Renderer, Surface } from '../renderer/types.js';
import type { VideoPlan } from '../scene/types.js';
/** Sync lookup of a preloaded backend-native asset handle (image, svg, …). */
export type AssetResolver = (src: string) => unknown;
/** Sync lookup of a predecoded video frame handle by source frame index. */
export type VideoFrameResolver = (src: string, mediaFrameIndex: number) => unknown;
export interface AssetInfo {
    width: number;
    height: number;
    durationSec?: number;
    fps?: number;
}
/**
 * Sync lookup of intrinsic asset metadata (decode-once at preload).
 * width/height MUST describe the resolved handle's actual pixels (e.g. a
 * 540x960 proxy decodes to 540x960 handles — never report container dims):
 * the compositor builds its source-crop rect from these numbers.
 */
export type AssetInfoResolver = (src: string) => AssetInfo | undefined;
export interface FrameContext {
    frame: number;
    fps: number;
    /** Composition size (effect temp surfaces + bounds). */
    width: number;
    height: number;
}
export interface FrameStats {
    resolveMs: number;
    drawMs: number;
    leaves: number;
}
export interface TransitionSpec {
    type: string;
    params: Record<string, unknown>;
    /** Eased 0..1. */
    progress: number;
}
/** Blend two pre-rendered scene surfaces. Implemented per backend. */
export type TransitionApplier = (target: Surface, a: Surface, b: Surface, spec: TransitionSpec) => void;
/**
 * Resolve AnimNumber bindings inside effect params (recursively through
 * plain objects/arrays) against the node's local frame. Lets blur amount,
 * glow intensity, etc. animate with the same engine.
 */
export declare const resolveEffectParams: (params: Record<string, unknown> | undefined, frame: number, fps: number) => Record<string, unknown>;
/**
 * Shape -> SVG path in local 0,0,w,h box (frame-pure, deterministic).
 * star/polygon inscribed in the box, arrow pointing right, ellipse via
 * arcs, line as diagonal stroke. All coords rounded to 0.1 for stable bytes.
 */
export declare const shapeToPath: (n: Record<string, unknown>, frame: number, fps: number) => string;
export interface RenderFrameOptions {
    resolveAsset?: AssetResolver;
    /** Backend text measurer; enables wrap/align/justify layout. */
    measureText?: TextMeasurer;
    /** Predecoded video frames by source frame index. */
    resolveVideoFrame?: VideoFrameResolver;
    /** Intrinsic asset metadata (decode-once at preload). */
    assetInfo?: AssetInfoResolver;
    /** Backend transition blender (required when a transition leaf is hit). */
    transitionApplier?: TransitionApplier;
}
/**
 * Render one frame: (plan, frame, fps) → pixels on surface.
 * Deterministic: same inputs → same draw calls in the same order.
 */
export declare const renderFrame: (renderer: Renderer, surface: Surface, plan: VideoPlan, frame: number, options?: RenderFrameOptions) => FrameStats;
//# sourceMappingURL=render.d.ts.map