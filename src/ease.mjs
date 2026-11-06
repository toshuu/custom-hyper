
import { Easing } from '../../x80-video-engine/packages/core/dist/index.js';

const make = (name) => {
  switch (name) {
    case 'linear': return Easing.linear;
    case 'smooth': return Easing.bezier(0.4, 0, 0.2, 1);
    case 'in': return Easing.in(Easing.quad);
    case 'out': return Easing.out(Easing.quad);
    case 'inOut': return Easing.inOut(Easing.quad);
    case 'power1.in': return Easing.in(Easing.quad);
    case 'power1.out': return Easing.out(Easing.quad);
    case 'power1.inOut': return Easing.inOut(Easing.quad);
    case 'power2.in': return Easing.in(Easing.cubic);
    case 'power2.out': return Easing.out(Easing.cubic);
    case 'power2.inOut': return Easing.inOut(Easing.cubic);
    case 'power3.in': return Easing.in(Easing.poly(4));
    case 'power3.out': return Easing.out(Easing.poly(4));
    case 'power3.inOut': return Easing.inOut(Easing.poly(4));
    case 'expo.out': return Easing.out(Easing.exp);
    case 'expo.inOut': return Easing.inOut(Easing.exp);
    case 'back.out': return Easing.out(Easing.back(1.7));
    case 'back.inOut': return Easing.inOut(Easing.back(1.7));
    case 'elastic.out': return Easing.out(Easing.elastic(1));
    case 'bounce.out': return Easing.out(Easing.bounce);
    case 'circ.out': return Easing.out(Easing.circle);
    default: throw new Error(`Unknown easing "${name}"`);
  }
};

const cache = new Map();

export const easeFn = (name = 'power2.out') => {
  if (typeof name === 'function') return name;
  if (!cache.has(name)) cache.set(name, make(name));
  return cache.get(name);
};
