import "../layout.js";
import { $ } from "../lib/ui.js";

// Three-schema architecture (Figure 2.2), drawn with the site's colour tokens so it follows the theme.
$("#three-schema").innerHTML = `
<figure class="er small" style="max-width:640px">
<svg viewBox="0 0 560 330" role="img" aria-label="Üç-şema mimarisi">
  <style>
    .ts-box{fill:var(--surface);stroke:var(--text);stroke-width:1.3}
    .ts-lvl{fill:var(--muted);font-size:11px;font-weight:700;letter-spacing:.06em;text-anchor:start}
    .ts-t{fill:var(--text);font-size:12px;text-anchor:middle;dominant-baseline:middle}
    .ts-m{fill:var(--text-2);font-size:10.5px;font-style:italic;text-anchor:start;dominant-baseline:middle}
    .ts-a{stroke:var(--text-2);stroke-width:1.2;fill:none;marker-end:url(#ts-arr);marker-start:url(#ts-arr)}
    .ts-band{fill:var(--surface-2)}
  </style>
  <defs><marker id="ts-arr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="var(--text-2)"/></marker></defs>
  <rect class="ts-band" x="0" y="0" width="560" height="78" rx="8"/>
  <text class="ts-lvl" x="10" y="16">EXTERNAL LEVEL</text>
  <rect class="ts-box" x="120" y="12" width="110" height="34" rx="4"/><text class="ts-t" x="175" y="29">External view 1</text>
  <rect class="ts-box" x="250" y="12" width="110" height="34" rx="4"/><text class="ts-t" x="305" y="29">External view 2</text>
  <text class="ts-t" x="395" y="29">…</text>
  <rect class="ts-box" x="430" y="12" width="110" height="34" rx="4"/><text class="ts-t" x="485" y="29">External view n</text>
  <text class="ts-t" x="330" y="64" style="font-size:10.5px;fill:var(--text-2)">son kullanıcılar ve programlar</text>
  <path class="ts-a" d="M175,50 L300,124"/><path class="ts-a" d="M305,50 L320,124"/><path class="ts-a" d="M485,50 L340,124"/>
  <text class="ts-m" x="408" y="100">external/conceptual mapping</text>
  <rect class="ts-band" x="0" y="118" width="560" height="60" rx="8"/>
  <text class="ts-lvl" x="10" y="134">CONCEPTUAL LEVEL</text>
  <rect class="ts-box" x="230" y="128" width="180" height="38" rx="4"/><text class="ts-t" x="320" y="147">Conceptual schema</text>
  <path class="ts-a" d="M320,170 L320,224"/>
  <text class="ts-m" x="330" y="197">conceptual/internal mapping</text>
  <rect class="ts-band" x="0" y="218" width="560" height="60" rx="8"/>
  <text class="ts-lvl" x="10" y="234">INTERNAL LEVEL</text>
  <rect class="ts-box" x="230" y="228" width="180" height="38" rx="4"/><text class="ts-t" x="320" y="247">Internal schema</text>
  <path class="ts-a" d="M320,270 L320,296"/>
  <path d="M270,298 h100 v18 a50,8 0 0 1 -100,0z" class="ts-box"/><ellipse cx="320" cy="298" rx="50" ry="7" class="ts-box"/>
  <text class="ts-t" x="320" y="314" style="font-size:10.5px">Stored database</text>
</svg>
<figcaption>Üç-şema mimarisi (Figure 2.2). Oklar düzeyler arası mapping'lerdir.</figcaption>
</figure>`;

$("#tiers").innerHTML = `
<figure class="er small" style="margin:0">
<svg viewBox="0 0 300 250" role="img" aria-label="Üç katmanlı mimari">
  <style>
    .t-box{fill:var(--accent-wash);stroke:var(--text);stroke-width:1.3}
    .t-t{fill:var(--text);font-size:12px;font-weight:650;text-anchor:middle;dominant-baseline:middle}
    .t-s{fill:var(--text-2);font-size:10px;text-anchor:middle;dominant-baseline:middle}
    .t-a{stroke:var(--text-2);stroke-width:1.2;marker-end:url(#t-arr);marker-start:url(#t-arr)}
  </style>
  <defs><marker id="t-arr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="var(--text-2)"/></marker></defs>
  <rect class="t-box" x="40" y="8" width="220" height="48" rx="6"/><text class="t-t" x="150" y="26">Client</text><text class="t-s" x="150" y="42">GUI, web tarayıcı</text>
  <line class="t-a" x1="150" y1="60" x2="150" y2="94"/>
  <rect class="t-box" x="40" y="98" width="220" height="48" rx="6"/><text class="t-t" x="150" y="116">Application / web server</text><text class="t-s" x="150" y="132">iş kuralları, uygulama programları</text>
  <line class="t-a" x1="150" y1="150" x2="150" y2="184"/>
  <rect class="t-box" x="40" y="188" width="220" height="48" rx="6"/><text class="t-t" x="150" y="206">Database server</text><text class="t-s" x="150" y="222">sorgu ve transaction işleme, DBMS</text>
</svg>
<figcaption>Üç katmanlı (three-tier) mimari. İki katmanlıda ortadaki katman yoktur: uygulama istemcide çalışır.</figcaption>
</figure>`;
