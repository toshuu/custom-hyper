const winOf = (from, dur) => ({
    from,
    end: from + (dur ?? Infinity),
});
const overlaps = (a, b) => a.from < b.end && b.from < a.end;
const collectLeafRefs = (node, out) => {
    if (node.kind === 'leaf') {
        out.add(node.ref);
        return;
    }
    if (node.kind === 'sequence') {
        for (const c of node.children ?? []) {
            collectLeafRefs(c, out);
        }
    }
};
const collectSubtreeIds = (node, out) => {
    out.add(node.id);
    for (const c of node.children ?? []) {
        collectSubtreeIds(c, out);
    }
};
export const validateTimeline = (timeline, root) => {
    if (timeline === undefined) {
        return;
    }
    const scene = new Map();
    const indexScene = (n) => {
        if (!scene.has(n.id)) {
            scene.set(n.id, n);
        }
        for (const c of n.children ?? []) {
            indexScene(c);
        }
    };
    indexScene(root);
    const subtreeOf = (id) => {
        const out = new Set();
        const n = scene.get(id);
        if (n !== undefined) {
            collectSubtreeIds(n, out);
        }
        return out;
    };
    const checkSeq = (seq) => {
        const kids = seq.children ?? [];
        const seqWins = [];
        const trWins = [];
        for (const c of kids) {
            if (c.kind === 'sequence') {
                const s = c;
                seqWins.push({ w: winOf(s.from ?? 0, s.durationInFrames), node: s });
                checkSeq(s);
            }
            else if (c.kind === 'transition') {
                const t = c;
                trWins.push({ w: winOf(t.from, t.durationInFrames), node: t });
            }
        }
        for (const t of trWins) {
            const tr = t.node;
            const painted = new Set([...subtreeOf(tr.a), ...subtreeOf(tr.b)]);
            for (const s of seqWins) {
                if (!overlaps(s.w, t.w)) {
                    continue;
                }
                const refs = new Set();
                collectLeafRefs(s.node, refs);
                for (const r of refs) {
                    if (painted.has(r)) {
                        throw new Error(`Timeline overlap: transition "${tr.type}" blends scene "${r}" while a sequence leaf also draws it (frames ${s.w.from}..${s.w.end} vs transition ${t.w.from}..${t.w.end}) — trim the sequence or move the transition`);
                    }
                }
            }
            if ((tr.aMode ?? 'freeze') === 'freeze') {
                if (tr.aFreeze === undefined) {
                    throw new Error(`Transition "${tr.type}" uses freeze mode but has no aFreeze`);
                }
                let shown = null;
                for (const s of seqWins) {
                    const refs = new Set();
                    collectLeafRefs(s.node, refs);
                    if (refs.has(tr.a)) {
                        const trim = s.node.trimBefore ?? 0;
                        shown = { from: trim, end: trim + (s.node.durationInFrames ?? Infinity) };
                        break;
                    }
                }
                if (shown !== null && (tr.aFreeze < shown.from || tr.aFreeze >= shown.end)) {
                    throw new Error(`Transition "${tr.type}" freezes "${tr.a}" at local ${tr.aFreeze}, outside its shown range [${shown.from}, ${shown.end})`);
                }
            }
        }
    };
    if (timeline.kind === 'sequence') {
        checkSeq(timeline);
    }
};
//# sourceMappingURL=validate.js.map