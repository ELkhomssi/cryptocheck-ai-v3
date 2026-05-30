/** Injected once per page — no external CSS dependency. */
export const CCAI_PAY_STYLE_ID = 'ccai-pay-styles'

export const CCAI_PAY_CSS = `
.ccai-pay-btn {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 220px;
  padding: 14px 20px;
  border: 1px solid rgba(0, 212, 170, 0.35);
  border-radius: 14px;
  background: linear-gradient(180deg, #0f172a 0%, #020617 100%);
  color: #f8fafc;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}
.ccai-pay-btn:hover:not(:disabled) {
  border-color: rgba(0, 212, 170, 0.65);
  box-shadow: 0 10px 28px rgba(0, 212, 170, 0.12);
}
.ccai-pay-btn:active:not(:disabled) { transform: scale(0.985); }
.ccai-pay-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.ccai-pay-btn-title { display: flex; align-items: center; gap: 8px; }
.ccai-pay-btn-sub {
  font-size: 11px;
  font-weight: 500;
  color: #94a3b8;
  letter-spacing: 0.02em;
}
.ccai-pay-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(2, 6, 23, 0.72);
  backdrop-filter: blur(4px);
}
.ccai-pay-modal {
  position: relative;
  width: min(360px, 100%);
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);
}
.ccai-pay-modal-close {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.85);
  color: #cbd5e1;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}
.ccai-pay-modal-frame {
  display: block;
  width: 100%;
  height: 460px;
  border: 0;
  background: transparent;
}
`.trim()

export function injectStyles(doc: Document = document): void {
  if (doc.getElementById(CCAI_PAY_STYLE_ID)) return
  const style = doc.createElement('style')
  style.id = CCAI_PAY_STYLE_ID
  style.textContent = CCAI_PAY_CSS
  doc.head.appendChild(style)
}
