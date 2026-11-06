/**
 * M2 — Timeline resolver: global frame → per-node local frames.
 *
 * Pure functions of (tree, globalFrame, compDuration). No React.
 * Semantics mirror the reference (verified against its Sequence/Series/
 * Loop/Freeze sources 2026-09-22):
 *   localFrame = frame - (cumulatedFrom + relativeFrom)
 *   visible  = [cumulatedFrom + from, ceil(cumulatedFrom + from + durationProp - 1)]
 * Series expands to back-to-back Sequences; Loop desugars to a remapped
 * Sequence; Freeze pins the effective frame; Still pins local frame to 0.
 */
import type { Composition, Frame, ResolvedTiming, SequenceNode, TimelineNode, TransitionInfo } from './types.js';
export interface ResolveContext {
    /** Sum of ancestor effectiveRelativeFrom (excludes parent? includes — see below). */
    cumulatedFrom: number;
    /** Enclosing sequence's own effectiveRelativeFrom. */
    relativeFrom: number;
    absoluteFrom: number;
    /** Remaining duration budget from the parent (Infinity at root). */
    durationInFrames: number;
    cumulatedNegativeFrom: number;
    firstFrame: number;
    width: number | null;
    height: number | null;
}
export interface ResolvedNode {
    node: TimelineNode;
    timing: ResolvedTiming;
    children: ResolvedNode[];
    loop?: {
        iteration: number;
        durationInFrames: number;
    };
    transition?: TransitionInfo;
}
export interface LeafQuery {
    ref: string;
    id?: string;
    localFrame: number;
    visible: boolean;
    frozenAt: number | null;
    loop?: {
        iteration: number;
        durationInFrames: number;
    };
    transition?: TransitionInfo;
}
export declare const validateSequenceProps: (node: SequenceNode) => void;
export declare const validateComposition: (comp: Composition) => void;
/** Resolve a timeline tree for one global frame. */
export declare const resolveTimeline: (root: TimelineNode, globalFrame: Frame, compDuration: number) => ResolvedNode;
/** Collect visible leaf refs with their local frames. */
export declare const collectLeaves: (resolved: ResolvedNode) => LeafQuery[];
//# sourceMappingURL=resolve.d.ts.map