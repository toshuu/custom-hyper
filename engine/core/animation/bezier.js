/**
 * M1 — Cubic Bézier timing functions.
 * Strategy (matches reference behavior): sample table → Newton-Raphson
 * where slope is usable → binary subdivision fallback.
 */
const NEWTON_ITERATIONS = 4;
const NEWTON_MIN_SLOPE = 0.001;
const SUBDIVISION_PRECISION = 0.0000001;
const SUBDIVISION_MAX_ITERATIONS = 10;
const SPLINE_TABLE_SIZE = 11;
const SAMPLE_STEP_SIZE = 1 / (SPLINE_TABLE_SIZE - 1);
const calcBezier = (t, a1, a2) => {
    const a = 1 - 3 * a2 + 3 * a1;
    const b = 3 * a2 - 6 * a1;
    const c = 3 * a1;
    return ((a * t + b) * t + c) * t;
};
const getSlope = (t, a1, a2) => {
    const a = 1 - 3 * a2 + 3 * a1;
    const b = 3 * a2 - 6 * a1;
    const c = 3 * a1;
    return 3 * a * t * t + 2 * b * t + c;
};
const binarySubdivide = (x, a, b, mX1, mX2) => {
    let currentA = a;
    let currentB = b;
    let currentT = 0;
    let i = 0;
    let currentX = 0;
    do {
        currentT = currentA + (currentB - currentA) / 2;
        currentX = calcBezier(currentT, mX1, mX2) - x;
        if (currentX > 0) {
            currentB = currentT;
        }
        else {
            currentA = currentT;
        }
        i += 1;
    } while (Math.abs(currentX) > SUBDIVISION_PRECISION &&
        i < SUBDIVISION_MAX_ITERATIONS);
    return currentT;
};
const newtonRaphsonIterate = (x, guessT, mX1, mX2) => {
    let t = guessT;
    for (let i = 0; i < NEWTON_ITERATIONS; i += 1) {
        const slope = getSlope(t, mX1, mX2);
        if (slope === 0) {
            return t;
        }
        const currentX = calcBezier(t, mX1, mX2) - x;
        t -= currentX / slope;
    }
    return t;
};
/** Cubic Bézier easing: maps x∈[0,1] through the curve to y. */
export const bezier = (mX1, mY1, mX2, mY2) => {
    if (!(mX1 >= 0 && mX1 <= 1 && mX2 >= 0 && mX2 <= 1)) {
        throw new Error('bezier x values must be in [0, 1] range');
    }
    if (mX1 === mY1 && mX2 === mY2) {
        return (x) => x;
    }
    const sampleValues = new Float32Array(SPLINE_TABLE_SIZE);
    for (let i = 0; i < SPLINE_TABLE_SIZE; i += 1) {
        sampleValues[i] = calcBezier(i * SAMPLE_STEP_SIZE, mX1, mX2);
    }
    const getTForX = (aX) => {
        let intervalStart = 0;
        let currentSample = 1;
        const lastSample = SPLINE_TABLE_SIZE - 1;
        for (; currentSample !== lastSample && sampleValues[currentSample] <= aX; currentSample += 1) {
            intervalStart += SAMPLE_STEP_SIZE;
        }
        currentSample -= 1;
        const dist = (aX - sampleValues[currentSample]) /
            (sampleValues[currentSample + 1] - sampleValues[currentSample]);
        const guessForT = intervalStart + dist * SAMPLE_STEP_SIZE;
        const initialSlope = getSlope(guessForT, mX1, mX2);
        if (initialSlope >= NEWTON_MIN_SLOPE) {
            return newtonRaphsonIterate(aX, guessForT, mX1, mX2);
        }
        if (initialSlope === 0) {
            return guessForT;
        }
        return binarySubdivide(aX, intervalStart, intervalStart + SAMPLE_STEP_SIZE, mX1, mX2);
    };
    return (x) => {
        if (x <= 0) {
            return 0;
        }
        if (x >= 1) {
            return 1;
        }
        return calcBezier(getTForX(x), mY1, mY2);
    };
};
//# sourceMappingURL=bezier.js.map