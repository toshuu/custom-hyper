/**
 * M0 — Timeline contracts.
 *
 * Frame-pure deterministic timing: every visual is a pure function of
 * (VideoPlan, frame, fps, assets, engineVersion). No wall-clock sources.
 *
 * Mirrors Remotion semantics (Composition / Sequence / Series / Loop /
 * Freeze / Still) with a JSON-compatible data model instead of React.
 */
/** Integer frame number. The primary timing unit. */
export type Frame = number;
/** Frames per second for a composition. */
export type Fps = number;
export declare const timeInSeconds: (frame: Frame, fps: Fps) => number;
export declare const frameFromSeconds: (seconds: number, fps: Fps) => Frame;
export interface Composition {
    id: string;
    width: number;
    height: number;
    fps: Fps;
    /** Total length in frames. Still = 1. */
    durationInFrames: number;
}
export interface SequenceNode {
    kind: 'sequence';
    id?: string;
    /** Global start frame (default 0). May be negative (pre-roll). */
    from?: number;
    /** Length in frames (default Infinity). Must be > 0 when set. */
    durationInFrames?: number;
    /** Frames trimmed off the head; shifts local content forward. */
    trimBefore?: number;
    /** Pin content to this local frame instead of advancing. */
    freeze?: number | null;
    /** Visibility without affecting layout/timing of siblings. */
    hidden?: boolean;
    /** Keep mounted outside [from, from+duration) for asset warmup. */
    premountFor?: number;
    postmountFor?: number;
    /** Optional width/height override scoping descendants. */
    width?: number;
    height?: number;
    children?: TimelineNode[];
}
export interface SeriesChild {
    /** Length in frames. Only the LAST child may be Infinity. */
    durationInFrames: number;
    /** Overlap (<0) or gap (>0) in frames. Must be an integer. */
    offset?: number;
    id?: string;
    children?: TimelineNode[];
}
export interface SeriesNode {
    kind: 'series';
    id?: string;
    children: SeriesChild[];
}
export interface LoopNode {
    kind: 'loop';
    id?: string;
    durationInFrames: number;
    /** Repetitions (default Infinity). Clamped by composition length. */
    times?: number;
    children?: TimelineNode[];
}
export interface FreezeNode {
    kind: 'freeze';
    id?: string;
    /** Local frame to pin. */
    frame: number;
    /** false (or fn returning false) disables the pin. */
    active?: boolean | ((frame: number) => boolean);
    children?: TimelineNode[];
}
export interface StillNode {
    kind: 'still';
    id?: string;
    children?: TimelineNode[];
}
export interface LeafNode {
    kind: 'leaf';
    id?: string;
    /** Reference into the scene graph (SceneNode id). */
    ref: string;
}
export type TransitionMode = 'freeze' | 'continue';
export type TransitionEasing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'smooth';
export interface TransitionNode {
    kind: 'transition';
    id?: string;
    /** First global frame of the transition. */
    from: number;
    /** Length in frames (must be finite and > 0). */
    durationInFrames: number;
    /** Blend type (see @x80/effects TRANSITIONS). */
    type: string;
    params?: Record<string, unknown>;
    /** Outgoing scene ref. */
    a: string;
    /** Incoming scene ref. */
    b: string;
    /** 'freeze' pins A (default); 'continue' lets A play through. */
    aMode?: TransitionMode;
    /** Local frame of A in freeze mode (required; typically A's last frame). */
    aFreeze?: number;
    /** Local-frame offset for A in continue mode (default 0). */
    aOffset?: number;
    /** Local-frame offset for B (default 0; B starts at transition start). */
    bOffset?: number;
    easing?: TransitionEasing;
}
export interface TransitionInfo {
    type: string;
    params: Record<string, unknown>;
    /** Eased 0..1. */
    progress: number;
    a: string;
    b: string;
    aFrame: number;
    bFrame: number;
}
export type TimelineNode = SequenceNode | SeriesNode | LoopNode | FreezeNode | StillNode | LeafNode | TransitionNode;
export interface ResolvedTiming {
    /** Global frame at which this node's local frame is 0. */
    absoluteFrom: number;
    /** Sum of ancestor (from - trimBefore) offsets. */
    cumulatedFrom: number;
    /** This node's own (from - trimBefore). */
    relativeFrom: number;
    /** Clipped duration in frames (>= 0). */
    durationInFrames: number;
    /** Local frame for the queried global frame. */
    localFrame: number;
    /** Whether the node is visible at the queried global frame. */
    visible: boolean;
    /** Freeze pin in effect, if any. */
    frozenAt: number | null;
    /** Pre-roll frames elapsed before the first visible frame (media sync). */
    cumulatedNegativeFrom?: number;
    /** Width/height override in scope (Sequence width/height or null). */
    width?: number | null;
    height?: number | null;
}
//# sourceMappingURL=types.d.ts.map