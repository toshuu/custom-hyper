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
import { Easing } from '../animation/easing.js';
const rootContext = (compDuration) => ({
    cumulatedFrom: 0,
    relativeFrom: 0,
    absoluteFrom: 0,
    durationInFrames: compDuration,
    cumulatedNegativeFrom: 0,
    firstFrame: 0,
    width: null,
    height: null,
});
const assertNumber = (value, message) => {
    if (typeof value !== 'number') {
        throw new TypeError(message);
    }
};
export const validateSequenceProps = (node) => {
    const { from = 0, trimBefore = 0, durationInFrames = Infinity, freeze } = node;
    assertNumber(durationInFrames, `You passed to durationInFrames an argument of type ${typeof durationInFrames}, but it must be a number.`);
    if (durationInFrames <= 0) {
        throw new TypeError(`durationInFrames must be positive, but got ${durationInFrames}`);
    }
    assertNumber(from, `You passed to the "from" props of your <Sequence> an argument of type ${typeof from}, but it must be a number.`);
    if (!Number.isFinite(from)) {
        throw new TypeError(`The "from" prop of a sequence must be finite, but got ${from}.`);
    }
    assertNumber(trimBefore, `You passed to the "trimBefore" prop of your <Sequence> an argument of type ${typeof trimBefore}, but it must be a number.`);
    if (trimBefore < 0) {
        throw new TypeError(`The "trimBefore" prop of <Sequence /> must be greater than or equal to 0, but got ${trimBefore}.`);
    }
    if (Number.isNaN(trimBefore)) {
        throw new TypeError('The "trimBefore" prop of <Sequence /> must be a real number, but it is NaN.');
    }
    if (!Number.isFinite(trimBefore)) {
        throw new TypeError(`The "trimBefore" prop of <Sequence /> must be finite, but it is ${trimBefore}.`);
    }
    if (typeof freeze !== 'undefined' && freeze !== null) {
        if (typeof freeze !== 'number') {
            throw new TypeError(`The "freeze" prop of <Sequence /> must be a number, but is of type ${typeof freeze}.`);
        }
        if (Number.isNaN(freeze)) {
            throw new TypeError(`The "freeze" prop of <Sequence /> must be a real number, but it is NaN.`);
        }
        if (!Number.isFinite(freeze)) {
            throw new TypeError(`The "freeze" prop of <Sequence /> must be finite, but it is ${freeze}.`);
        }
    }
};
const resolveSequenceLike = (node, frame, ctx, compDuration) => {
    validateSequenceProps(node);
    const from = node.from ?? 0;
    const trimBefore = node.trimBefore ?? 0;
    const durationProp = node.durationInFrames ?? Infinity;
    const rel = from - trimBefore;
    const cum = ctx.cumulatedFrom + ctx.relativeFrom;
    const absoluteFrom = ctx.absoluteFrom + rel;
    const parentDuration = Math.min(ctx.durationInFrames - rel, durationProp);
    const actualDuration = Math.max(0, Math.min(compDuration - from, parentDuration));
    const currentStart = cum + rel;
    const parentStart = cum;
    const parentFirstFrame = ctx.firstFrame;
    const firstFrame = Math.max(0, parentFirstFrame, currentStart);
    const cumulatedNegativeFrom = currentStart - firstFrame;
    const localFrame = frame - (cum + rel);
    const endThreshold = Math.ceil(cum + from + durationProp - 1);
    const inWindow = frame >= cum + from && frame <= endThreshold;
    const visible = inWindow && node.hidden !== true;
    const timing = {
        absoluteFrom,
        cumulatedFrom: cum,
        relativeFrom: rel,
        durationInFrames: actualDuration,
        localFrame,
        visible,
        frozenAt: typeof node.freeze === 'number' ? node.freeze : null,
        cumulatedNegativeFrom,
        width: node.width ?? ctx.width,
        height: node.height ?? ctx.height,
    };
    const childCtx = {
        cumulatedFrom: cum,
        relativeFrom: rel,
        absoluteFrom,
        durationInFrames: actualDuration,
        cumulatedNegativeFrom,
        firstFrame,
        width: timing.width ?? null,
        height: timing.height ?? null,
    };
    return { timing, childCtx, childFrame: frame };
};
const resolveChildren = (children, frame, ctx, compDuration, loop) => (children ?? []).map((child) => resolveNode(child, frame, ctx, compDuration, loop));
function resolveNode(node, frame, ctx, compDuration, loop) {
    switch (node.kind) {
        case 'sequence': {
            const { timing, childCtx, childFrame } = resolveSequenceLike(node, frame, ctx, compDuration);
            if (!timing.visible) {
                return { node, timing, children: [], loop };
            }
            // Sequence-level freeze pins descendants (Freeze frame semantics).
            if (timing.frozenAt !== null) {
                const pinned = timing.frozenAt + timing.relativeFrom;
                const frozenCtx = { ...childCtx, cumulatedFrom: 0 };
                return {
                    node,
                    timing,
                    children: resolveChildren(node.children, pinned, frozenCtx, compDuration, loop),
                    loop,
                };
            }
            return {
                node,
                timing,
                children: resolveChildren(node.children, childFrame, childCtx, compDuration, loop),
                loop,
            };
        }
        case 'series': {
            const kids = node.children;
            const timing = {
                absoluteFrom: ctx.absoluteFrom,
                cumulatedFrom: ctx.cumulatedFrom + ctx.relativeFrom,
                relativeFrom: 0,
                durationInFrames: ctx.durationInFrames,
                localFrame: frame - (ctx.cumulatedFrom + ctx.relativeFrom),
                visible: node.children.length > 0,
                frozenAt: null,
            };
            const out = [];
            let startFrame = 0;
            kids.forEach((child, index) => {
                const isLast = index === kids.length - 1;
                validateSeriesChild(child.durationInFrames, child.offset ?? 0, index, kids.length, isLast);
                const offset = child.offset ?? 0;
                const currentStart = startFrame + offset;
                const asSequence = {
                    kind: 'sequence',
                    id: child.id,
                    from: currentStart,
                    durationInFrames: child.durationInFrames,
                    children: child.children,
                };
                out.push(resolveNode(asSequence, frame, ctx, compDuration, loop));
                startFrame = startFrame + child.durationInFrames + offset;
            });
            return { node, timing, children: out, loop };
        }
        case 'loop': {
            const loopNode = node;
            validateLoopProps(loopNode.durationInFrames, loopNode.times ?? Infinity);
            const duration = loopNode.durationInFrames;
            const times = loopNode.times ?? Infinity;
            const currentFrame = frame - (ctx.cumulatedFrom + ctx.relativeFrom);
            const maxTimes = Math.ceil(compDuration / duration);
            const actualTimes = Math.min(maxTimes, times);
            const maxFrame = duration * (actualTimes - 1);
            const iteration = Math.floor(currentFrame / duration);
            const start = iteration * duration;
            const from = Math.min(start, maxFrame);
            const inner = {
                kind: 'sequence',
                id: loopNode.id,
                from,
                durationInFrames: duration,
                children: loopNode.children,
            };
            const resolved = resolveNode(inner, frame, ctx, compDuration, loop);
            const loopInfo = { iteration, durationInFrames: duration };
            return { ...resolved, loop: loopInfo };
        }
        case 'freeze': {
            const freezeNode = node;
            validateFreezeProps(freezeNode.frame);
            const currentLocal = frame - (ctx.cumulatedFrom + ctx.relativeFrom);
            const active = typeof freezeNode.active === 'function'
                ? freezeNode.active(currentLocal)
                : (freezeNode.active ?? true);
            const timing = {
                absoluteFrom: ctx.absoluteFrom,
                cumulatedFrom: ctx.cumulatedFrom + ctx.relativeFrom,
                relativeFrom: 0,
                durationInFrames: ctx.durationInFrames,
                localFrame: currentLocal,
                visible: true,
                frozenAt: active ? freezeNode.frame : null,
            };
            if (!active) {
                return {
                    node,
                    timing,
                    children: resolveChildren(freezeNode.children, frame, ctx, compDuration, loop),
                    loop,
                };
            }
            const pinned = freezeNode.frame + ctx.relativeFrom;
            const frozenCtx = { ...ctx, cumulatedFrom: 0 };
            return {
                node,
                timing,
                children: resolveChildren(freezeNode.children, pinned, frozenCtx, compDuration, loop),
                loop,
            };
        }
        case 'still': {
            const stillNode = node;
            const asSequence = {
                kind: 'sequence',
                id: stillNode.id,
                from: 0,
                durationInFrames: 1,
                children: stillNode.children,
            };
            // A still only ever exposes local frame 0 to its subtree.
            const { timing, childCtx } = resolveSequenceLike(asSequence, frame, ctx, compDuration);
            const pinned = childCtx.cumulatedFrom + childCtx.relativeFrom;
            return {
                node,
                timing: { ...timing, localFrame: 0 },
                children: resolveChildren(stillNode.children, pinned, childCtx, compDuration, loop),
                loop,
            };
        }
        case 'leaf': {
            const leaf = node;
            const localFrame = frame - (ctx.cumulatedFrom + ctx.relativeFrom);
            const timing = {
                absoluteFrom: ctx.absoluteFrom,
                cumulatedFrom: ctx.cumulatedFrom + ctx.relativeFrom,
                relativeFrom: 0,
                durationInFrames: ctx.durationInFrames,
                localFrame,
                visible: true,
                frozenAt: null,
            };
            return { node, timing, children: [], loop };
        }
        case 'transition': {
            const tr = node;
            validateTransitionProps(tr);
            const local = frame - (ctx.cumulatedFrom + ctx.relativeFrom);
            const base = ctx.cumulatedFrom + ctx.relativeFrom;
            const endThreshold = Math.ceil(base + tr.from + tr.durationInFrames - 1);
            const visible = frame >= base + tr.from && frame <= endThreshold;
            const raw = Math.min(1, Math.max(0, (frame - base - tr.from) / tr.durationInFrames));
            const progress = applyTransitionEasing(raw, tr.easing ?? 'linear');
            const aMode = tr.aMode ?? 'freeze';
            let aFrame;
            if (aMode === 'freeze') {
                if (tr.aFreeze === undefined) {
                    throw new Error(`Transition "${tr.id ?? tr.type}" uses freeze mode but has no aFreeze (pass A's last local frame)`);
                }
                aFrame = tr.aFreeze;
            }
            else {
                aFrame = frame - (ctx.cumulatedFrom + ctx.relativeFrom) - tr.from + (tr.aOffset ?? 0);
            }
            const bFrame = frame - (ctx.cumulatedFrom + ctx.relativeFrom) - tr.from + (tr.bOffset ?? 0);
            const timing = {
                absoluteFrom: ctx.absoluteFrom + tr.from,
                cumulatedFrom: ctx.cumulatedFrom + ctx.relativeFrom,
                relativeFrom: tr.from,
                durationInFrames: tr.durationInFrames,
                localFrame: local - tr.from,
                visible,
                frozenAt: null,
            };
            const transition = {
                type: tr.type,
                params: tr.params ?? {},
                progress,
                a: tr.a,
                b: tr.b,
                aFrame,
                bFrame,
            };
            return { node, timing, children: [], loop, transition };
        }
        default: {
            const unexpected = node;
            throw new Error(`Unknown timeline node kind: ${unexpected.kind}`);
        }
    }
}
const validateTransitionProps = (node) => {
    if (typeof node.from !== 'number' || !Number.isFinite(node.from)) {
        throw new TypeError('Transition "from" must be a finite number');
    }
    if (typeof node.durationInFrames !== 'number' || !(node.durationInFrames > 0) || !Number.isFinite(node.durationInFrames)) {
        throw new TypeError('Transition durationInFrames must be a positive finite number');
    }
    if (typeof node.type !== 'string' || node.type === '') {
        throw new TypeError('Transition needs a non-empty type string');
    }
    if (typeof node.a !== 'string' || typeof node.b !== 'string') {
        throw new TypeError('Transition needs "a" and "b" scene refs');
    }
    if (node.aMode !== undefined && node.aMode !== 'freeze' && node.aMode !== 'continue') {
        throw new TypeError('Transition aMode must be freeze|continue');
    }
};
const applyTransitionEasing = (t, easing) => {
    switch (easing) {
        case 'linear':
            return t;
        case 'ease-in':
            return Easing.quad(t);
        case 'ease-out':
            return Easing.out(Easing.quad)(t);
        case 'ease-in-out':
            return Easing.inOut(Easing.quad)(t);
        case 'smooth':
            return t * t * (3 - 2 * t);
        default:
            throw new TypeError(`Unknown transition easing "${easing}"`);
    }
};
const validateSeriesChild = (durationInFrames, offset, index, childrenLength, isLast) => {
    if (isLast && durationInFrames === Infinity) {
        // Only the last child may be infinite.
    }
    else {
        assertNumber(durationInFrames, 'Series.Sequence durationInFrames must be a number.');
        if (!(durationInFrames > 0) || !Number.isFinite(durationInFrames)) {
            throw new TypeError(`Series.Sequence durationInFrames must be a positive finite number (index = ${index}).`);
        }
    }
    if (Number.isNaN(offset)) {
        throw new TypeError(`The "offset" property of a <Series.Sequence /> must not be NaN, but got NaN (index = ${index}, duration = ${durationInFrames}).`);
    }
    if (!Number.isFinite(offset)) {
        throw new TypeError(`The "offset" property of a <Series.Sequence /> must be finite, but got ${offset} (index = ${index}, duration = ${durationInFrames}).`);
    }
    if (offset % 1 !== 0) {
        throw new TypeError(`The "offset" property of a <Series.Sequence /> must be finite, but got ${offset} (index = ${index}, duration = ${durationInFrames}).`);
    }
};
const validateLoopProps = (durationInFrames, times) => {
    assertNumber(durationInFrames, 'Loop durationInFrames must be a number.');
    if (!(durationInFrames > 0) || !Number.isFinite(durationInFrames)) {
        throw new TypeError('Loop durationInFrames must be a positive finite number.');
    }
    if (typeof times !== 'number') {
        throw new TypeError(`You passed to "times" an argument of type ${typeof times}, but it must be a number.`);
    }
    if (times !== Infinity && times % 1 !== 0) {
        throw new TypeError(`The "times" prop of a loop must be an integer, but got ${times}.`);
    }
    if (times < 0) {
        throw new TypeError(`The "times" prop of a loop must be at least 0, but got ${times}`);
    }
};
const validateFreezeProps = (freezeFrame) => {
    if (typeof freezeFrame === 'undefined') {
        throw new Error(`The <Freeze /> component requires a 'frame' prop, but none was passed.`);
    }
    if (typeof freezeFrame !== 'number') {
        throw new Error(`The 'frame' prop of <Freeze /> must be a number, but is of type ${typeof freezeFrame}`);
    }
    if (Number.isNaN(freezeFrame)) {
        throw new Error(`The 'frame' prop of <Freeze /> must be a real number, but it is NaN.`);
    }
    if (!Number.isFinite(freezeFrame)) {
        throw new Error(`The 'frame' prop of <Freeze /> must be a finite number, but it is ${freezeFrame}.`);
    }
};
export const validateComposition = (comp) => {
    for (const [key, value] of Object.entries({
        width: comp.width,
        height: comp.height,
        fps: comp.fps,
        durationInFrames: comp.durationInFrames,
    })) {
        if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
            throw new TypeError(`Composition "${comp.id}" has invalid ${key}: ${String(value)}`);
        }
    }
};
/** Resolve a timeline tree for one global frame. */
export const resolveTimeline = (root, globalFrame, compDuration) => resolveNode(root, globalFrame, rootContext(compDuration), compDuration);
/** Collect visible leaf refs with their local frames. */
export const collectLeaves = (resolved) => {
    const out = [];
    const walk = (node, ancestorsVisible) => {
        const visible = ancestorsVisible && node.timing.visible;
        if (node.transition !== undefined) {
            if (visible) {
                out.push({
                    ref: node.transition.a,
                    id: typeof node.node === 'object' && 'id' in node.node ? node.node.id : undefined,
                    localFrame: node.timing.localFrame,
                    visible: true,
                    frozenAt: null,
                    ...(node.loop ? { loop: node.loop } : {}),
                    transition: node.transition,
                });
            }
            return;
        }
        if (node.node.kind === 'leaf') {
            if (visible) {
                out.push({
                    ref: node.node.ref,
                    id: node.node.id,
                    localFrame: node.timing.localFrame,
                    visible: true,
                    frozenAt: node.timing.frozenAt,
                    ...(node.loop ? { loop: node.loop } : {}),
                });
            }
            return;
        }
        for (const child of node.children) {
            walk(child, visible);
        }
    };
    walk(resolved, true);
    return out;
};
//# sourceMappingURL=resolve.js.map