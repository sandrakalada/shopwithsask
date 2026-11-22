"use client";

import QRCode from "qrcode";

/** Draws a DOM element to an image. Arabic renders correctly because the browser lays out
 * the text before it is captured. */
export async function elementToImage(el: HTMLElement) {
  const { default: html2canvas } = await import("html2canvas-pro");
  const canvas = await html2canvas(el, { scale: 3, backgroundColor: "#ffffff", useCORS: true, logging: false });
  return { url: canvas.toDataURL("image/jpeg", 0.92), ratio: canvas.height / canvas.width };
}

/** Builds a PDF with one image per page, each page exactly widthMm x heightMm.
 * Repeated images are embedded once (copies of the same sticker reuse it), and the work is done in
 * small steps so the screen never freezes on big batches. */
export async function imagesToPdf(
  images: { url: string; ratio: number }[],
  widthMm: number,
  heightMm?: number,
  onProgress?: (done: number, total: number) => void,
  isCancelled?: () => boolean,
) {
  const { jsPDF } = await import("jspdf");
  let pdf: InstanceType<typeof jsPDF> | null = null;
  const alias = new Map<string, string>();
  for (let n = 0; n < images.length; n++) {
    if (isCancelled?.()) throw new Error("cancelled");
    const img = images[n];
    const h = heightMm ?? img.ratio * widthMm;
    const fmt: [number, number] = [widthMm, h];
    const orientation = widthMm > h ? "landscape" : "portrait";
    if (!pdf) pdf = new jsPDF({ unit: "mm", format: fmt, orientation, compress: true });
    else pdf.addPage(fmt, orientation);
    if (!alias.has(img.url)) alias.set(img.url, `i${alias.size}`);
    const kind = img.url.startsWith("data:image/png") ? "PNG" : "JPEG";
    pdf.addImage(img.url, kind, 0, 0, widthMm, h, alias.get(img.url), "FAST");
    if (n % 8 === 7) {
      onProgress?.(n + 1, images.length);
      await new Promise((r) => setTimeout(r, 0)); // let the screen breathe
    }
  }
  onProgress?.(images.length, images.length);
  return pdf!.output("blob");
}

export async function elementToPdf(el: HTMLElement, widthMm: number, heightMm?: number) {
  return imagesToPdf([await elementToImage(el)], widthMm, heightMm);
}

export const isIOS = () => typeof navigator !== "undefined" && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

/** Puts ready images into a hidden print area sized exactly widthMm x heightMm per page.
 * Call it as soon as the images are ready, then call printNow() straight from the tap:
 * iPhone only opens the print screen if window.print() runs immediately on the tap. */
export function preparePrint(images: string[], widthMm: number, heightMm: number, pdf?: Blob) {
  preparePdfPrint(pdf);
  let root = document.getElementById("print-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "print-root";
    document.body.appendChild(root);
  }
  root.innerHTML = images.map((u) => `<img src="${u}" style="display:block;width:${widthMm}mm;height:${heightMm}mm;page-break-after:always;break-after:page">`).join("");
  let style = document.getElementById("print-style") as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = "print-style";
    document.head.appendChild(style);
  }
  style.textContent = `@page { size: ${widthMm}mm ${heightMm}mm; margin: 0 }
    @media print { body > *:not(#print-root) { display: none !important } #print-root { display: block !important } html, body { margin: 0 !important; padding: 0 !important; background: #fff } }
    @media screen { #print-root { display: none } }`;
}

const isDesktopSafari = () =>
  typeof navigator !== "undefined" && /Safari\//.test(navigator.userAgent) && !/Chrome|Chromium|CriOS|Edg|Firefox|FxiOS/.test(navigator.userAgent);

let pdfFrame: HTMLIFrameElement | null = null;
let pdfUrl: string | null = null;

/** Desktop: loads the exact-size PDF into a hidden frame so Print prints the file itself,
 * with no browser header or footer (date, page title, link, page numbers). */
export function preparePdfPrint(pdf?: Blob) {
  pdfFrame?.remove();
  pdfFrame = null;
  if (pdfUrl) URL.revokeObjectURL(pdfUrl);
  pdfUrl = null;
  if (!pdf || isIOS() || isDesktopSafari()) return;
  pdfUrl = URL.createObjectURL(pdf);
  const f = document.createElement("iframe");
  f.setAttribute("aria-hidden", "true");
  f.tabIndex = -1;
  f.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none";
  f.src = pdfUrl;
  document.body.appendChild(f);
  pdfFrame = f;
}

export function printNow() {
  const w = pdfFrame?.contentWindow;
  if (w) {
    try {
      w.focus();
      w.print();
      return;
    } catch {
      /* fall back to the page print below */
    }
  }
  window.print();
}

/** Prepares and prints in one go (use preparePrint ahead of time for large batches on iPhone). */
export function printImages(images: string[], widthMm: number, heightMm: number) {
  preparePrint(images, widthMm, heightMm);
  printNow();
}

export async function printFile(images: string[], pdf: Blob, filename: string, widthMm: number, heightMm: number) {
  void pdf;
  void filename;
  printImages(images, widthMm, heightMm);
}

export const qrDataUrl = (text: string, size = 300) => QRCode.toDataURL(text, { margin: 0, width: size, errorCorrectionLevel: "M" });

/** Opens the iPhone share sheet with the file (WhatsApp, Phomemo, Files, Print...).
 * Falls back to opening the PDF in a new tab. Call straight from a tap. */
export async function shareFile(blob: Blob, filename: string, text?: string) {
  const file = new File([blob], filename, { type: blob.type || "application/pdf" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text, title: filename });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return "opened";
}

/** Egyptian numbers to WhatsApp international format: 01xxxxxxxxx -> 201xxxxxxxxx */
export function waNumber(phone: string | null | undefined) {
  if (!phone) return null;
  let d = phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
  d = d.replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)));
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0") && d.length === 11) d = "2" + d;
  if (d.length === 10 && d.startsWith("1")) d = "20" + d;
  return d.length >= 10 ? d : null;
}

export function waLink(phone: string | null | undefined, text: string) {
  const n = waNumber(phone);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export const egp = (n: number | null | undefined) => `${Math.round(Number(n ?? 0)).toLocaleString("en-US")} EGP`;

export function addressLines(a: { address1?: string; address2?: string; city?: string; province?: string } | null | undefined) {
  if (!a) return "";
  return [a.address1, a.address2, a.city, a.province].filter(Boolean).join(", ");
}

