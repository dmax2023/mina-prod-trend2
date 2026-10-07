import { useEffect, useState } from "react";
import { PT_EN, PT_EN_PATTERNS } from "@/lib/i18n-dict";

type Lang = "pt" | "en";
const STORAGE = "gd-lang";
const ATTRS = ["placeholder", "title", "aria-label"];

function traduzir(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  let out = PT_EN[t];
  if (!out) {
    for (const [re, rep] of PT_EN_PATTERNS) {
      if (re.test(t)) { out = t.replace(re, rep); break; }
    }
  }
  if (!out) return null;
  return v.replace(t, out);
}

// Originais (PT) e últimas traduções aplicadas, para restaurar e detectar atualizações do React.
const origText = new WeakMap<Node, string>();
const lastText = new WeakMap<Node, string>();
const origAttr = new WeakMap<Element, Record<string, string>>();

function trText(n: Node) {
  const cur = n.nodeValue ?? "";
  if (lastText.get(n) === cur) return;
  const tr = traduzir(cur);
  if (tr == null) { origText.delete(n); return; }
  origText.set(n, cur);
  lastText.set(n, tr);
  n.nodeValue = tr;
}
function trAttrs(el: Element) {
  for (const a of ATTRS) {
    const cur = el.getAttribute(a);
    if (!cur) continue;
    const rec = origAttr.get(el) ?? {};
    if (rec["_" + a] === cur) continue;
    const tr = traduzir(cur);
    if (tr == null) continue;
    rec[a] = cur; rec["_" + a] = tr;
    origAttr.set(el, rec);
    el.setAttribute(a, tr);
  }
}
function walk(root: Node) {
  if (root.nodeType === 3) return trText(root);
  if (root.nodeType !== 1) return;
  const el = root as Element;
  if (el.closest("script,style,[data-no-translate]")) return;
  trAttrs(el);
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n: Node | null;
  while ((n = w.nextNode())) {
    if (n.nodeType === 3) trText(n);
    else trAttrs(n as Element);
  }
}
function restaurar() {
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n: Node | null;
  while ((n = w.nextNode())) {
    if (n.nodeType === 3) {
      const o = origText.get(n);
      if (o != null && lastText.get(n) === n.nodeValue) n.nodeValue = o;
      origText.delete(n); lastText.delete(n);
    } else {
      const rec = origAttr.get(n as Element);
      if (rec) {
        for (const a of ATTRS) if (rec[a] && (n as Element).getAttribute(a) === rec["_" + a]) (n as Element).setAttribute(a, rec[a]);
        origAttr.delete(n as Element);
      }
    }
  }
}

function FlagBR() {
  return (
    <svg viewBox="0 0 28 20" className="h-4 w-6 rounded-sm" aria-hidden>
      <rect width="28" height="20" fill="#009c3b" />
      <path d="M14 3 25 10 14 17 3 10Z" fill="#ffdf00" />
      <circle cx="14" cy="10" r="4" fill="#002776" />
    </svg>
  );
}
function FlagUK() {
  return (
    <svg viewBox="0 0 60 30" className="h-4 w-6 rounded-sm" aria-hidden>
      <rect width="60" height="30" fill="#012169" />
      <path d="M0 0 60 30M60 0 0 30" stroke="#fff" strokeWidth="6" />
      <path d="M0 0 60 30M60 0 0 30" stroke="#C8102E" strokeWidth="2" />
      <path d="M30 0v30M0 15h60" stroke="#fff" strokeWidth="10" />
      <path d="M30 0v30M0 15h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}

export function LanguageSwitch() {
  const [lang, setLang] = useState<Lang>("pt");

  useEffect(() => {
    if (localStorage.getItem(STORAGE) === "en") setLang("en");
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE, lang);
    document.documentElement.lang = lang === "en" ? "en" : "pt-BR";
    if (lang !== "en") { restaurar(); return; }
    walk(document.body);
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === "characterData") trText(m.target);
        else if (m.type === "attributes") trAttrs(m.target as Element);
        else m.addedNodes.forEach(walk);
      }
    });
    obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    return () => obs.disconnect();
  }, [lang]);

  const btn = (l: Lang, label: string, flag: React.ReactNode) => (
    <button
      type="button"
      onClick={() => setLang(l)}
      aria-pressed={lang === l}
      title={label}
      data-no-translate
      className={`rounded-md border p-1.5 transition ${lang === l ? "border-primary ring-2 ring-primary/40" : "border-border opacity-60 hover:opacity-100"}`}
    >
      {flag}
    </button>
  );

  return (
    <div className="panel flex items-center gap-2 px-3 py-3" data-no-translate>
      {btn("pt", "Português (Brasil)", <FlagBR />)}
      {btn("en", "English", <FlagUK />)}
    </div>
  );
}
