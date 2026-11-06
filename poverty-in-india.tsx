import {
  AbsoluteFill, Composition, Sequence, interpolate, registerRoot, useCurrentFrame,
} from "raea";

const W = 1920;
const H = 1080;
const C = {
  ink: "#101923", deep: "#111c29", blue: "#243b4d", mist: "#dce5e2",
  cream: "#f1eadb", sand: "#d5b98d", rust: "#bd694a", gold: "#e8b96e",
  green: "#657c60", pale: "#a9b9ad", white: "#fffaf0", muted: "#9aabae",
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rise = (f: number, start = 0, end = 26, distance = 52) =>
  interpolate(f, [start, end], [distance, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
const reveal = (f: number, start = 0, end = 22) =>
  interpolate(f, [start, end], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
const fade = (f: number, duration = 144) =>
  Math.min(reveal(f, 0, 18), 1 - reveal(f, duration - 18, duration));

function Grain({ opacity = 0.08 }: { opacity?: number }) {
  return <AbsoluteFill style={{ opacity, pointerEvents: "none", backgroundImage: "repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(255,255,255,.16) 4px)", mixBlendMode: "soft-light" }} />;
}

function Kicker({ children, color = C.gold }: { children: string; color?: string }) {
  return <div style={{ fontFamily: "Arial, sans-serif", fontSize: 22, fontWeight: 700, letterSpacing: 7, color, textTransform: "uppercase" }}>{children}</div>;
}

function IndiaMark() {
  return <svg viewBox="0 0 420 500" width="420" height="500">
    <path d="M132 16 L183 35 214 68 258 76 279 112 315 137 303 176 331 211 302 248 285 284 266 317 249 364 219 403 193 462 164 425 150 385 126 350 109 310 78 278 87 244 63 208 86 178 76 142 105 115 101 78 132 57Z" fill="#d9b889" opacity=".14" stroke="#e8b96e" strokeWidth="3"/>
    <path d="M110 140 C175 100 240 135 292 182 M87 230 C154 195 225 225 300 250 M130 320 C180 290 230 310 270 340" fill="none" stroke="#e8b96e" strokeWidth="2" opacity=".48"/>
    <circle cx="198" cy="225" r="7" fill="#e8b96e"/><circle cx="198" cy="225" r="23" fill="none" stroke="#e8b96e" opacity=".35"/>
  </svg>;
}

function Opening() {
  const f = useCurrentFrame();
  const op = fade(f);
  const scan = interpolate(f, [0, 120], [-100, 620], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ background: C.ink, color: C.white, opacity: op, overflow: "hidden", fontFamily: "Arial, sans-serif" }}>
    <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 72% 48%, #304354 0%, #172431 38%, #101923 76%)" }} />
    <div style={{ position: "absolute", right: 120, top: 150, opacity: reveal(f, 12, 48), transform: "scale(" + (0.92 + reveal(f, 0, 80) * 0.08) + ")" }}><IndiaMark /></div>
    <div style={{ position: "absolute", left: 150, top: 210, width: 900 }}>
      <Kicker>AN INDIA DOCUMENTARY · 2026</Kicker>
      <div style={{ marginTop: 38, fontSize: 112, lineHeight: .94, fontWeight: 900, letterSpacing: -5, opacity: reveal(f, 12, 42), transform: "translateY(" + rise(f, 12, 42) + "px)" }}>THE OTHER<br/><span style={{ color: C.gold }}>SIDE OF</span><br/>GROWTH.</div>
      <div style={{ width: interpolate(f, [25, 65], [0, 530], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), height: 4, background: C.rust, marginTop: 38 }} />
      <div style={{ marginTop: 28, fontSize: 27, color: C.muted, letterSpacing: 2, opacity: reveal(f, 54, 80) }}>POVERTY IN INDIA</div>
    </div>
    <div style={{ position: "absolute", left: 0, right: 0, top: scan, height: 2, background: "linear-gradient(90deg, transparent, rgba(232,185,110,.55), transparent)" }} />
    <div style={{ position: "absolute", bottom: 60, left: 150, right: 150, display: "flex", justifyContent: "space-between", color: "#7e9098", fontSize: 17, letterSpacing: 4 }}>
      <span>PEOPLE · OPPORTUNITY · DIGNITY</span><span>01 / 06</span>
    </div>
    <Grain />
  </AbsoluteFill>;
}

function Skyline({ y = 390 }: { y?: number }) {
  const buildings = [150, 230, 180, 310, 205, 270, 165, 240, 190, 330, 215, 285];
  return <g>
    {buildings.map((h, i) => <g key={i}>
      <rect x={i * 170 - 30} y={y - h} width="140" height={h} fill={i % 2 ? "#344958" : "#293d4c"} />
      {Array.from({ length: Math.floor(h / 42) }, (_, j) => <rect key={j} x={i * 170 - 5} y={y - h + 24 + j * 42} width="14" height="18" fill="#d6b47c" opacity=".24" />)}
    </g>)}
  </g>;
}

function Person({ x, y, scale = 1, color = "#27323a" }: { x: number; y: number; scale?: number; color?: string }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <circle cx="0" cy="-62" r="17" fill={color}/>
    <path d="M-20 -40 Q0 -52 20 -40 L27 18 L12 18 L9 70 L-9 70 L-12 18 L-27 18Z" fill={color}/>
    <path d="M-15 -28 L-35 15 M15 -28 L34 14" stroke={color} strokeWidth="12" strokeLinecap="round"/>
  </g>;
}

function City() {
  const f = useCurrentFrame();
  const op = fade(f);
  const drift = interpolate(f, [0, 144], [0, -45], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ background: "#d5d0c3", opacity: op, overflow: "hidden", fontFamily: "Arial, sans-serif" }}>
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,#c7d1cd 0%,#e2d8c4 62%,#a77d5c 100%)" }} />
    <svg viewBox="0 0 1920 1080" style={{ position: "absolute", width: "100%", height: "100%" }}>
      <g transform={`translate(${drift} 0)`}><Skyline y={570}/></g>
      <path d="M0 690 L1920 610 L1920 1080 L0 1080Z" fill="#8e7058"/>
      {Array.from({ length: 7 }, (_, i) => <g key={i} transform={`translate(${i * 300 - 40} 0)`}>
        <path d="M0 700 L140 590 L285 700Z" fill={i % 2 ? "#8e4e3c" : "#a65f45"}/>
        <rect x="20" y="700" width="245" height="230" fill={i % 2 ? "#b77a55" : "#9e634a"}/>
        <path d="M15 715 L135 625 L275 715" stroke="#e1bd8d" strokeWidth="12" fill="none"/>
        <rect x="65" y="760" width="52" height="95" fill="#4a4039"/>
        <rect x="170" y="755" width="48" height="42" fill="#d8b17a" opacity=".55"/>
      </g>)}
      <path d="M0 930 Q450 850 900 930 T1920 910 L1920 1080 L0 1080Z" fill="#725b49"/>
      <Person x={400} y={930} scale={1.25} color="#302d2a"/>
      <Person x={690} y={965} scale={.9} color="#45362e"/>
      <Person x={1200} y={940} scale={1.1} color="#302d2a"/>
      <Person x={1530} y={955} scale={.8} color="#45362e"/>
    </svg>
    <div style={{ position: "absolute", left: 130, top: 105, width: 760 }}>
      <Kicker color="#9b533e">01 — THE INVISIBLE CITY</Kicker>
      <div style={{ marginTop: 30, fontSize: 76, fontWeight: 900, lineHeight: 1.02, color: "#17232a", letterSpacing: -3, opacity: reveal(f, 10, 38), transform: "translateY(" + rise(f, 10, 38) + "px)" }}>A city can rise.<br/>Not everyone rises<br/>with it.</div>
      <div style={{ marginTop: 28, width: 580, fontSize: 25, lineHeight: 1.5, color: "#34434a", opacity: reveal(f, 40, 65) }}>Behind the glass towers, millions build a life with limited space, unstable work and fragile access to basic services.</div>
    </div>
    <div style={{ position: "absolute", right: 110, bottom: 65, color: "#f1eadb", fontSize: 18, letterSpacing: 4 }}>02 / 06</div>
    <Grain opacity={.06}/>
  </AbsoluteFill>;
}

function Rural() {
  const f = useCurrentFrame();
  const op = fade(f);
  const sunY = interpolate(f, [0, 120], [230, 190], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const water = interpolate(f, [0, 144], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ background: "#d6c59d", opacity: op, overflow: "hidden", fontFamily: "Arial, sans-serif" }}>
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,#d7c79f 0%,#e8d7ae 50%,#8b9167 100%)" }}/>
    <svg viewBox="0 0 1920 1080" style={{ position: "absolute", width: "100%", height: "100%" }}>
      <circle cx="1460" cy={sunY} r="104" fill="#e8a96c" opacity=".85"/>
      <path d="M0 600 Q420 420 850 620 T1920 560 L1920 1080 L0 1080Z" fill="#8b9167"/>
      <path d="M0 720 Q460 540 900 760 T1920 700" stroke="#c0a66f" strokeWidth="10" fill="none"/>
      <path d="M0 820 Q450 660 900 860 T1920 820" stroke="#6d805b" strokeWidth="8" fill="none"/>
      {Array.from({length: 22},(_,i)=><path key={i} d={`M${i*100-40} 1080 Q${i*100+40} 900 ${i*100+95} 810`} stroke="#b9a16b" strokeWidth="4" fill="none" opacity=".65"/>)}
      <path d="M220 690 L390 560 L560 690Z" fill="#87573e"/>
      <rect x="260" y="690" width="260" height="200" fill="#b27c50"/>
      <rect x="355" y="755" width="65" height="135" fill="#463b31"/>
      <path d="M1030 770 Q1210 700 1390 790 T1750 790" stroke="#c3b07a" strokeWidth="30" fill="none" opacity={.7 + water*.1}/>
      <Person x={780} y={900} scale={1.15} color="#3e4032"/>
      <Person x={900} y={920} scale={.8} color="#4a4334"/>
      <path d="M740 840 L780 790 L820 840" stroke="#3e4032" strokeWidth="10" fill="none"/>
    </svg>
    <div style={{ position: "absolute", left: 125, top: 90, width: 800 }}>
      <Kicker color="#7d5a39">02 — THE DISTANCE</Kicker>
      <div style={{ marginTop: 28, fontSize: 75, lineHeight: 1.03, fontWeight: 900, letterSpacing: -3, color: "#202a28", opacity: reveal(f, 12, 40), transform: "translateY(" + rise(f, 12, 40) + "px)" }}>Where opportunity<br/>is miles away.</div>
      <div style={{ marginTop: 25, fontSize: 25, lineHeight: 1.5, width: 690, color: "#354139", opacity: reveal(f, 42, 67) }}>For many rural families, distance can mean a missed classroom, a delayed treatment or a market that is too far to reach.</div>
    </div>
    <div style={{ position: "absolute", right: 110, bottom: 65, color: "#f8eed9", fontSize: 18, letterSpacing: 4 }}>03 / 06</div>
    <Grain opacity={.06}/>
  </AbsoluteFill>;
}

function Access() {
  const f = useCurrentFrame();
  const op = fade(f);
  const school = reveal(f, 12, 50);
  const clinic = reveal(f, 35, 72);
  return <AbsoluteFill style={{ background: "#182630", color: C.white, opacity: op, overflow: "hidden", fontFamily: "Arial, sans-serif" }}>
    <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 100%, #3a4c4a, #182630 65%)" }}/>
    <div style={{ position: "absolute", left: 125, top: 100 }}>
      <Kicker>03 — THE EVERYDAY BARRIERS</Kicker>
      <div style={{ marginTop: 25, fontSize: 70, fontWeight: 900, lineHeight: 1.04, letterSpacing: -3 }}>Poverty is also<br/><span style={{ color: C.gold }}>what you cannot reach.</span></div>
    </div>
    <div style={{ position: "absolute", left: 125, top: 420, width: 760, height: 390, border: "1px solid #63747a", background: "rgba(255,255,255,.055)", opacity: school, transform: "translateY(" + rise(f, 12, 50) + "px)" }}>
      <svg viewBox="0 0 760 390" width="760" height="390">
        <path d="M80 190 L250 70 L420 190Z" fill="#d5b98d"/>
        <rect x="110" y="190" width="280" height="135" fill="#8c9c8b"/>
        <rect x="225" y="240" width="60" height="85" fill="#31434a"/>
        <rect x="145" y="220" width="45" height="45" fill="#e8d9b6"/>
        <rect x="320" y="220" width="45" height="45" fill="#e8d9b6"/>
        <path d="M90 335 H430" stroke="#e8b96e" strokeWidth="6"/>
        <path d="M500 115 V310 M545 115 V310 M590 115 V310" stroke="#d8b98c" strokeWidth="10"/>
        <path d="M480 115 H615" stroke="#d8b98c" strokeWidth="10"/>
      </svg>
      <div style={{ position: "absolute", left: 40, bottom: 26, fontSize: 30, fontWeight: 800 }}>EDUCATION</div>
      <div style={{ position: "absolute", right: 38, bottom: 30, fontSize: 17, color: C.muted, letterSpacing: 2 }}>ACCESS IS UNEVEN</div>
    </div>
    <div style={{ position: "absolute", right: 125, top: 420, width: 760, height: 390, border: "1px solid #63747a", background: "rgba(255,255,255,.055)", opacity: clinic, transform: "translateY(" + rise(f, 35, 72) + "px)" }}>
      <svg viewBox="0 0 760 390" width="760" height="390">
        <rect x="180" y="110" width="360" height="220" fill="#78928d"/>
        <path d="M160 110 H560" stroke="#e8b96e" strokeWidth="16"/>
        <rect x="330" y="155" width="60" height="140" fill="#e8eadf"/>
        <rect x="290" y="195" width="140" height="60" fill="#e8eadf"/>
        <rect x="215" y="155" width="55" height="55" fill="#d7c9a9"/>
        <rect x="450" y="155" width="55" height="55" fill="#d7c9a9"/>
        <path d="M145 335 H575" stroke="#e8b96e" strokeWidth="6"/>
      </svg>
      <div style={{ position: "absolute", left: 40, bottom: 26, fontSize: 30, fontWeight: 800 }}>HEALTHCARE</div>
      <div style={{ position: "absolute", right: 38, bottom: 30, fontSize: 17, color: C.muted, letterSpacing: 2 }}>CARE MUST BE REACHABLE</div>
    </div>
    <div style={{ position: "absolute", bottom: 62, left: 125, color: C.muted, fontSize: 18, letterSpacing: 4 }}>04 / 06</div>
    <Grain/>
  </AbsoluteFill>;
}

function Divide() {
  const f = useCurrentFrame();
  const op = fade(f);
  const heights = [110, 170, 245, 335, 430];
  return <AbsoluteFill style={{ background: "#101923", color: C.white, opacity: op, overflow: "hidden", fontFamily: "Arial, sans-serif" }}>
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(105deg,#101923 0%,#1e303b 58%,#3a332c 100%)" }}/>
    <div style={{ position: "absolute", left: 125, top: 90, zIndex: 5 }}>
      <Kicker>04 — THE DIVIDE</Kicker>
      <div style={{ marginTop: 26, fontSize: 72, lineHeight: 1.02, fontWeight: 900, letterSpacing: -3 }}>One country.<br/><span style={{ color: C.gold }}>Unequal starting lines.</span></div>
    </div>
    <svg viewBox="0 0 1920 1080" style={{ position: "absolute", width: "100%", height: "100%" }}>
      <path d="M0 900 L1920 900" stroke="#a8a99a" strokeWidth="2" opacity=".4"/>
      {heights.map((h,i)=><g key={i}>
        <rect x={990+i*160} y={900-h*reveal(f,25+i*8,65+i*8)} width="112" height={h*reveal(f,25+i*8,65+i*8)} fill={i===4?"#e8b96e":"#70857e"}/>
        {Array.from({length:Math.floor(h/40)},(_,j)=><rect key={j} x={1007+i*160} y={900-h*reveal(f,25+i*8,65+i*8)+18+j*40} width="18" height="12" fill="#e9d9b6" opacity=".4"/>)}
      </g>)}
      <path d="M0 810 L260 690 L520 810Z" fill="#8f5842"/>
      <rect x="45" y="810" width="430" height="120" fill="#9d6d50"/>
      <path d="M0 930 H1920" stroke="#d5b98d" strokeWidth="3"/>
      <Person x={540} y={910} scale={1.15} color="#1a2228"/>
      <Person x={710} y={910} scale={.95} color="#1a2228"/>
    </svg>
    <div style={{ position: "absolute", left: 125, top: 430, width: 650, fontSize: 27, lineHeight: 1.55, color: "#b7c3c0", opacity: reveal(f, 28, 58) }}>Where you are born can shape the quality of your school, the security of your work and the choices available to your family.</div>
    <div style={{ position: "absolute", left: 125, bottom: 115, fontSize: 18, letterSpacing: 4, color: C.muted }}>POVERTY IS NOT A LACK OF AMBITION.</div>
    <div style={{ position: "absolute", right: 110, bottom: 65, color: C.muted, fontSize: 18, letterSpacing: 4 }}>05 / 06</div>
    <Grain/>
  </AbsoluteFill>;
}

function Closing() {
  const f = useCurrentFrame();
  const op = fade(f);
  const sun = interpolate(f, [0, 120], [1, 1.16], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ background: "#1a2a32", color: C.white, opacity: op, overflow: "hidden", fontFamily: "Arial, sans-serif" }}>
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,#1a2a32 0%,#725b50 55%,#d09a68 100%)" }}/>
    <div style={{ position: "absolute", left: 760, top: 270, width: 400, height: 400, borderRadius: "50%", background: "#e8b96e", transform: "scale(" + sun + ")", opacity: .8, boxShadow: "0 0 140px rgba(232,185,110,.25)" }}/>
    <svg viewBox="0 0 1920 1080" style={{ position: "absolute", width: "100%", height: "100%" }}>
      <path d="M0 780 Q500 650 980 780 T1920 760 L1920 1080 L0 1080Z" fill="#25343a"/>
      <path d="M0 900 Q520 820 960 900 T1920 880 L1920 1080 L0 1080Z" fill="#17232a"/>
      <Person x={650} y={910} scale={1.45} color="#101a20"/>
      <Person x={800} y={930} scale={1.1} color="#101a20"/>
      <Person x={1160} y={920} scale={1.2} color="#101a20"/>
      <Person x={1300} y={930} scale={1.05} color="#101a20"/>
    </svg>
    <div style={{ position: "absolute", left: 0, right: 0, top: 115, textAlign: "center" }}>
      <Kicker>05 — BEYOND THE NUMBERS</Kicker>
      <div style={{ margin: "35px auto 0", fontSize: 79, lineHeight: 1.04, fontWeight: 900, letterSpacing: -3, maxWidth: 1250, opacity: reveal(f, 10, 40), transform: "translateY(" + rise(f, 10, 40) + "px)" }}>A fairer future begins<br/>when <span style={{ color: C.gold }}>dignity is not a privilege.</span></div>
      <div style={{ margin: "28px auto 0", fontSize: 25, color: "#e2d6c5", letterSpacing: 1.5, opacity: reveal(f, 45, 70) }}>Opportunity should not depend on the pin code you are born into.</div>
    </div>
    <div style={{ position: "absolute", bottom: 68, left: 0, right: 0, textAlign: "center", fontSize: 17, letterSpacing: 5, color: "#e8d4b7", opacity: reveal(f, 80, 108) }}>INDIA · PEOPLE FIRST</div>
    <Grain opacity={.06}/>
  </AbsoluteFill>;
}

function Film() {
  return <AbsoluteFill style={{ background: C.ink }}>
    <Sequence from={0} durationInFrames={144}><Opening /></Sequence>
    <Sequence from={144} durationInFrames={144}><City /></Sequence>
    <Sequence from={288} durationInFrames={144}><Rural /></Sequence>
    <Sequence from={432} durationInFrames={144}><Access /></Sequence>
    <Sequence from={576} durationInFrames={144}><Divide /></Sequence>
    <Sequence from={720} durationInFrames={144}><Closing /></Sequence>
  </AbsoluteFill>;
}

registerRoot(() => (
  <Composition id="poverty-in-india" component={Film} width={W} height={H} fps={24} durationInFrames={864} />
));
