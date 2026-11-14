"use client";

/**
 * Copies text via Clipboard API with a hidden textarea fallback when
 * permissions or non-HTTPS origins reject navigator.clipboard.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text || typeof document === "undefined") return false;
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to legacy selection-based copy
  }

  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
