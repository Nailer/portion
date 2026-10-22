/** Original vector artwork: capital connects to productive infrastructure and shared payments. */
export function InfrastructureScene() {
  return <svg className="infrastructure-scene" viewBox="0 0 680 420" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="core-face" x1="200" y1="130" x2="480" y2="350" gradientUnits="userSpaceOnUse"><stop stopColor="#3165f4"/><stop offset="1" stopColor="#101f54"/></linearGradient>
      <linearGradient id="core-top" x1="215" y1="120" x2="430" y2="240" gradientUnits="userSpaceOnUse"><stop stopColor="#8cc6ff"/><stop offset="1" stopColor="#3763da"/></linearGradient>
      <linearGradient id="solar-face"><stop stopColor="#184a98"/><stop offset="1" stopColor="#081a3e"/></linearGradient>
      <radialGradient id="scene-aura"><stop stopColor="#326bff" stopOpacity=".3"/><stop offset="1" stopColor="#326bff" stopOpacity="0"/></radialGradient>
    </defs>
    <ellipse cx="350" cy="245" rx="310" ry="170" fill="url(#scene-aura)"/>
    <g stroke="#80b2ff" strokeOpacity=".12"><path d="m100 285 241-129 242 129-242 129z"/><path d="m140 285 201-107 202 107-202 107z"/><path d="m180 285 161-86 162 86-162 86z"/></g>
    <g className="infrastructure-float">
      <path d="m216 224 125-68 125 68-125 69z" fill="#0e2255" stroke="#4b7bd2"/>
      <path d="m216 224 125 69v60l-125-68z" fill="url(#core-face)"/>
      <path d="m341 293 125-69v61l-125 68z" fill="#142c61"/>
      <path d="m223 218 118-65 118 65-118 65z" fill="url(#core-top)"/>
      <path d="m257 195 84-46 84 46v23l-84 46-84-46z" fill="#153e8a" stroke="#72a8ff" strokeOpacity=".6"/>
      <path d="m257 195 84 46 84-46-84-46z" fill="#3777ed"/>
      <path d="M286 176v-56l55-30 55 30v56l-55 31z" fill="#102757" stroke="#629dff"/>
      <path d="m286 120 55 31 55-31-55-30z" fill="#5795f8"/>
      <path d="m341 151 55-31v56l-55 31z" fill="#1b438f"/>
      <path d="m307 134 22 12v35l-22-12z" fill="#80e9ff" opacity=".9"/>
      <path d="m353 156 29-16v7l-29 16zm0 13 29-16v7l-29 16z" fill="#89bdff" opacity=".7"/>
      <path d="m229 245 95 52m-95-38 95 52" stroke="#8db4ff" strokeOpacity=".5"/>
      <g fill="#86eaff"><circle cx="359" cy="311" r="3"/><circle cx="372" cy="304" r="3"/><circle cx="385" cy="297" r="3"/></g>
    </g>
    <g><path d="m103 209 76-42 76 42-76 42z" fill="#132951" stroke="#4e83d4"/><path d="m103 209 76 42v24l-76-42z" fill="#0c1a35"/><path d="m179 251 76-42v24l-76 42z" fill="#1b3463"/><path d="m117 193 62-34 62 34-62 34z" fill="url(#solar-face)" stroke="#619fef"/><g stroke="#568bc7" strokeWidth="1"><path d="m130 186 62 34m-47-42 62 34m-47-42 62 34m-84 1 62-34m-47 42 62-34m-47 42 62-34"/></g></g>
    <g><path d="m448 208 70-38 70 38-70 38z" fill="#174377" stroke="#78b8f3"/><path d="m448 208 70 38v42l-70-38z" fill="#153765"/><path d="m518 246 70-38v42l-70 38z" fill="#0d224b"/><path d="M482 213v-70l18-10 18 10v70l-18 10z" fill="#2b629a" stroke="#8de8f5"/><path d="m488 153 24-13v26l-24 13z" fill="#76e6fa"/><path d="M518 188c30 0 25 28 38 27" stroke="#85ccf1" strokeWidth="3"/></g>
    <path className="capital-path" d="M57 315h111l49-28M462 286l48 27h106" stroke="#5c95ff" strokeWidth="2" strokeDasharray="5 7"/>
    <circle className="capital-particle" r="4" fill="#a2e9ff"/>
    <g fontFamily="sans-serif" fontSize="10" fill="#a4b9db"><text x="78" y="161">CLEAN ENERGY</text><text x="482" y="119">MOBILITY</text><text x="291" y="388" letterSpacing="3">WORKING ASSETS</text></g>
    <g><circle cx="58" cy="315" r="16" fill="#142847" stroke="#4676ba"/><path d="M52 315h12m-6-6v12" stroke="#a1d5ff"/><circle cx="616" cy="313" r="16" fill="#142847" stroke="#4676ba"/><path d="m610 313 4 4 8-8" stroke="#a1d5ff"/></g>
  </svg>;
}
