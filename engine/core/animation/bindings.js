/**
 * M3 — Declarative animation bindings (JSON-compatible).
 * Lets scene-graph numeric props vary with the node's LOCAL frame while
 * staying plain data (no functions), so plans remain serializable for the
 * future AI planner. Evaluated by the compositor via resolveAnimNumber().
 */
import { interpolateColors } from './colors.js';
import { interpolate } from './interpolate.js';
import { spring } from './spring.js';
export const isAnimBinding = (value) => typeof value !== 'number';
export const isColorBinding = (value) => typeof value === 'object' &&
    value !== null &&
    'binding' in value &&
    value.binding === 'color';
/** Pure in (value, frame, fps) → CSS color string. */
export const resolveAnimColor = (value, frame) => {
    if (typeof value === 'string') {
        return value;
    }
    if (isColorBinding(value)) {
        return interpolateColors(frame, value.inputRange, value.colorStops, value.options);
    }
    const { r, g, b, a } = value;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
};
/** Pure in (value, frame, fps). Frame is the node's LOCAL frame. */
export const resolveAnimNumber = (value, frame, fps) => {
    if (value === undefined || value === null) {
        throw new Error(`resolveAnimNumber: received undefined/null value (frame ${frame}). Check node props for missing width/height/radius/scale/opacity.`);
    }
    if (typeof value === 'number') {
        return value;
    }
    if (value.binding === 'interpolate') {
        return interpolate(frame, value.inputRange, value.outputRange, value.options);
    }
    if (value.binding === 'keyframes') {
        if (!Array.isArray(value.frames) || !Array.isArray(value.values) || value.frames.length !== value.values.length || value.frames.length === 0) {
            throw new Error('keyframes binding needs non-empty frames[] and values[] of equal length');
        }
        return interpolate(frame, [...value.frames], [...value.values], value.options);
    }
    if (value.binding === 'path' || value.binding === 'stagger') {
        throw new Error(`motion '${value.binding}' bindings compile away in @x80/reelspec (compileFreeNode) — the core only resolves interpolate/keyframes/spring/color`);
    }
    return spring({
        frame,
        fps,
        config: value.config,
        from: value.from,
        to: value.to,
        durationInFrames: value.durationInFrames,
        durationRestThreshold: value.durationRestThreshold,
        delay: value.delay,
        reverse: value.reverse,
    });
};
//# sourceMappingURL=bindings.js.map