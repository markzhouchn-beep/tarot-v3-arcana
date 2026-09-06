// lib/seo.ts · 动态更新页面 <head> meta / OG / canonical
// v3.0.1

export function setMeta(name: string, content: string) {
  const el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement
    || Object.assign(document.head.appendChild(document.createElement('meta')), { name });
  el.content = content;
}

export function setOg(prop: string, content: string) {
  const el = document.querySelector(`meta[property="${prop}"]`) as HTMLMetaElement
    || Object.assign(document.head.appendChild(document.createElement('meta')), { property: prop });
  el.content = content;
}

export function setLink(rel: string, href: string) {
  const el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement
    || Object.assign(document.head.appendChild(document.createElement('link')), { rel });
  el.href = href;
}
