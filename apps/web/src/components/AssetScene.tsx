/** Original SVG illustration: a solar charging kiosk, built as a responsive UI asset. */
export function AssetScene() {
  return (
    <svg className="asset-scene" viewBox="0 0 640 480" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="panel" x1="210" y1="95" x2="440" y2="265" gradientUnits="userSpaceOnUse"><stop stopColor="#345b64"/><stop offset="1" stopColor="#132e35"/></linearGradient>
        <linearGradient id="wall" x1="280" y1="230" x2="410" y2="380" gradientUnits="userSpaceOnUse"><stop stopColor="#f0f1dc"/><stop offset="1" stopColor="#9cad93"/></linearGradient>
        <radialGradient id="glow"><stop stopColor="#d6f77b" stopOpacity=".2"/><stop offset="1" stopColor="#d6f77b" stopOpacity="0"/></radialGradient>
      </defs>
      <ellipse cx="330" cy="275" rx="265" ry="200" fill="url(#glow)"/>
      <g className="scene-orbit" stroke="#b8d58b" strokeOpacity=".16"><ellipse cx="324" cy="340" rx="262" ry="108"/><ellipse cx="324" cy="340" rx="220" ry="83"/><path d="M40 340h566M324 222v224"/></g>
      <path d="m124 338 206-112 202 111-207 117z" fill="#1f3930" stroke="#54704b"/>
      <path d="m124 338 201 109 207-110v13L325 463 124 351z" fill="#122b22"/>
      <ellipse cx="332" cy="365" rx="142" ry="42" fill="#071b15" opacity=".5"/>
      <g className="scene-kiosk">
        <path d="m210 240 118-65 119 65-120 67z" fill="#f8f5dc"/>
        <path d="M210 240v103l117 65V307z" fill="url(#wall)"/>
        <path d="m327 307 120-67v104l-120 64z" fill="#657c63"/>
        <path d="m230 273 69 39v66l-69-38z" fill="#193e31"/>
        <path d="m238 285 53 30v39l-53-30z" fill="#345c44"/>
        <path d="m226 329 77 43v11l-77-43z" fill="#cce88b"/>
        <path d="m360 305 51-28v76l-51 28z" fill="#213e30"/>
        <path d="m367 309 36-20v50l-36 20z" fill="#b8cf95"/>
        <path d="m206 242 121 68 125-70v-14l-125 69-121-68z" fill="#d5ee83"/>
        <path d="m195 184 133-73 143 79-134 75z" fill="#729e8d"/>
        <path d="m204 182 124-67 133 74-124 69z" fill="url(#panel)" stroke="#84b7ad" strokeWidth="2"/>
        <g stroke="#79a7ac" strokeOpacity=".65"><path d="m229 169 132 74m-107-88 132 74m-108-88 133 74m-108-88 133 74M237 201l124-68m-97 83 124-68m-98 83 124-68m-97 82 124-68"/></g>
        <path d="m195 184 142 81v9l-142-80zm142 81 134-75v10l-134 74z" fill="#b5d2b6"/>
        <g className="scene-charge"><path d="m263 301-8 12 7 4-3 11 13-14-8-4 5-7z" fill="#d8f58a"/></g>
        <path d="M222 246v14m92 40v14" stroke="#436445" strokeWidth="3"/>
        <path d="m230 253 76 43" stroke="#142d22" strokeWidth="5"/>
      </g>
      <g><path d="M475 308v67" stroke="#7e9a63" strokeWidth="5"/><path d="M475 326c-34 1-43-25-32-31 18-7 33 15 32 31Z" fill="#6d9857"/><path d="M475 344c30-1 41-26 28-31-17-5-30 13-28 31Z" fill="#abd06c"/><path d="m455 367 20 11 20-11v24l-20 11-20-11z" fill="#ba9973"/></g>
      <g className="scene-power" stroke="#d8f58a" strokeWidth="2" strokeLinecap="round"><path d="M164 249v-18m-9 9h18M456 125v-18m-9 9h18M505 241v-12m-6 6h12"/></g>
      <circle cx="161" cy="340" r="4" fill="#d8f58a"/><circle cx="500" cy="340" r="4" fill="#d8f58a"/>
    </svg>
  );
}
