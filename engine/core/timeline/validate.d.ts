/**
 * Authoring-time validation (loud errors, not silent garbage).
 *
 * The compositor draws every visible leaf: a transition blends A+B while
 * any overlapping sequence leaf would ALSO draw — double-draw ghosting.
 * And a freeze pin outside A's shown range freezes an unseen frame. Both
 * are plan bugs, so they throw here instead of rendering wrong pixels.
 *
 * Scope: direct children of sequences (the montage/kit plan shape).
 * Chrome-style overlays (different refs, e.g. grain/progress leaves that
 * span transition windows) are legal and pass.
 */
import type { SceneNode } from '../scene/types.js';
import type { TimelineNode } from './types.js';
export declare const validateTimeline: (timeline: TimelineNode | undefined, root: SceneNode) => void;
//# sourceMappingURL=validate.d.ts.map