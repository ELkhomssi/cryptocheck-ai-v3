import { buildEmbedUrl, type PaymentLinkParams } from './payment-link.js'
import { injectStyles } from './styles.js'

export type CCAIPayChain = 'solana' | 'ethereum' | 'base'

export type CCAIPayConfig = {
  merchantWallet: string
  chain: CCAIPayChain
  /** Optional partner API key (reserved for merchant webhook attribution). */
  apiKey?: string
  /** CCAI host — defaults to https://www.cryptocheckai.com */
  baseUrl?: string
}

export type CCAIPayButtonOptions = {
  amount?: number
  currency?: 'USD'
  token?: 'SOL' | 'USDC' | 'USDT'
  memo?: string
  onSuccess?: (result: { signature: string; intentId?: string }) => void
  onError?: (error: Error) => void
  /** Called synchronously after risk pre-check, before wallet / iframe checkout. */
  onRiskBlock?: (reason: string) => void
}

const TOKEN_MINTS: Record<NonNullable<CCAIPayButtonOptions['token']>, string> = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
}

const DEFAULT_BASE = 'https://www.cryptocheckai.com'

type PayPostMessage =
  | { type: 'ccai-pay:success'; signature: string; intentId?: string }
  | { type: 'ccai-pay:risk-block'; reason: string }
  | { type: 'ccai-pay:error'; message: string }

type PaymentIntentResponse = {
  id?: string
  status?: string
  riskAssessment?: {
    approved?: boolean
    blockedReason?: string
  }
  error?: string
}

function resolveBaseUrl(baseUrl?: string): string {
  return (baseUrl?.trim() || DEFAULT_BASE).replace(/\/$/, '')
}

function validateWallet(wallet: string): void {
  if (!wallet?.trim() || wallet.trim().length < 32) {
    throw new Error('CCAIPay: merchantWallet must be a valid wallet address')
  }
}

export class CCAIPay {
  private readonly merchantWallet: string
  private readonly chain: CCAIPayChain
  private readonly apiKey?: string
  private readonly baseUrl: string
  private modalEl: HTMLElement | null = null
  private messageHandler: ((event: MessageEvent) => void) | null = null

  constructor(config: CCAIPayConfig) {
    validateWallet(config.merchantWallet)
    this.merchantWallet = config.merchantWallet.trim()
    this.chain = config.chain
    this.apiKey = config.apiKey?.trim() || undefined
    this.baseUrl = resolveBaseUrl(config.baseUrl)
  }

  async createButton(container: HTMLElement, options: CCAIPayButtonOptions = {}): Promise<void> {
    injectStyles(container.ownerDocument)
    container.innerHTML = ''

    const btn = container.ownerDocument.createElement('button')
    btn.type = 'button'
    btn.className = 'ccai-pay-btn'
    btn.innerHTML =
      '<span class="ccai-pay-btn-title">🛡️ Pay with CryptoCheck AI</span>' +
      '<span class="ccai-pay-btn-sub">AI-secured · risk-verified</span>'

    btn.addEventListener('click', () => {
      void this.startCheckout(options, btn)
    })

    container.appendChild(btn)
  }

  async openPaymentModal(options: CCAIPayButtonOptions = {}): Promise<void> {
    await this.startCheckout(options)
  }

  private async startCheckout(options: CCAIPayButtonOptions, triggerBtn?: HTMLButtonElement): Promise<void> {
    if (this.chain !== 'solana') {
      const err = new Error(`CCAIPay: chain "${this.chain}" is not supported yet. Use chain: "solana".`)
      options.onError?.(err)
      return
    }

    if (triggerBtn) {
      triggerBtn.disabled = true
    }

    try {
      const amount = options.amount
      const token = options.token ?? 'USDC'

      if (typeof amount === 'number' && amount > 0) {
        const blocked = await this.preCheckRisk(amount, token, options.memo)
        if (blocked.blocked) {
          const reason = blocked.reason ?? 'Payment blocked by risk policy.'
          options.onRiskBlock?.(reason)
          options.onError?.(new Error(reason))
          return
        }
      }

      this.openHostedCheckout({
        wallet: this.merchantWallet,
        amountUsd: typeof amount === 'number' && amount > 0 ? amount : undefined,
        token,
        memo: options.memo,
        chain: this.chain,
        baseUrl: this.baseUrl,
        onSuccess: options.onSuccess,
        onError: options.onError,
        onRiskBlock: options.onRiskBlock,
      })
    } catch (e) {
      options.onError?.(e instanceof Error ? e : new Error('Payment could not start.'))
    } finally {
      if (triggerBtn) triggerBtn.disabled = false
    }
  }

  /** Server-side risk gate — must complete before wallet / iframe checkout. */
  private async preCheckRisk(
    amountUsd: number,
    token: NonNullable<CCAIPayButtonOptions['token']>,
    memo?: string
  ): Promise<{ blocked: boolean; reason?: string }> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`

    const res = await fetch(`${this.baseUrl}/api/payments/intent`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        toWallet: this.merchantWallet,
        tokenMint: TOKEN_MINTS[token],
        amountUsd,
        chain: this.chain,
        fromWallet: '',
        memo,
      }),
    })

    const intent = (await res.json().catch(() => ({}))) as PaymentIntentResponse
    if (!res.ok) {
      throw new Error(intent.error || 'Risk pre-check failed.')
    }

    if (intent.status === 'risk_blocked' || intent.riskAssessment?.approved === false) {
      return {
        blocked: true,
        reason: intent.riskAssessment?.blockedReason || 'Payment blocked by risk policy.',
      }
    }

    return { blocked: false }
  }

  private openHostedCheckout(
    params: PaymentLinkParams & {
      baseUrl: string
      onSuccess?: CCAIPayButtonOptions['onSuccess']
      onError?: CCAIPayButtonOptions['onError']
      onRiskBlock?: CCAIPayButtonOptions['onRiskBlock']
    }
  ): void {
    this.closeModal()

    const doc = document
    injectStyles(doc)

    const overlay = doc.createElement('div')
    overlay.className = 'ccai-pay-modal-overlay'
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-modal', 'true')
    overlay.setAttribute('aria-label', 'Pay with CryptoCheck AI')

    const shell = doc.createElement('div')
    shell.className = 'ccai-pay-modal'

    const closeBtn = doc.createElement('button')
    closeBtn.type = 'button'
    closeBtn.className = 'ccai-pay-modal-close'
    closeBtn.setAttribute('aria-label', 'Close')
    closeBtn.textContent = '×'
    closeBtn.addEventListener('click', () => this.closeModal())

    const iframe = doc.createElement('iframe')
    iframe.className = 'ccai-pay-modal-frame'
    iframe.src = buildEmbedUrl(params)
    iframe.title = 'CryptoCheck AI payment'
    iframe.allow = 'clipboard-write'

    shell.appendChild(closeBtn)
    shell.appendChild(iframe)
    overlay.appendChild(shell)

    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) this.closeModal()
    })

    const expectedOrigin = new URL(params.baseUrl).origin

    this.messageHandler = (event: MessageEvent) => {
      if (event.origin !== expectedOrigin) return
      const data = event.data as PayPostMessage | undefined
      if (!data || typeof data !== 'object' || typeof data.type !== 'string') return

      if (data.type === 'ccai-pay:success') {
        params.onSuccess?.({ signature: data.signature, intentId: data.intentId })
        this.closeModal()
        return
      }

      if (data.type === 'ccai-pay:risk-block') {
        params.onRiskBlock?.(data.reason)
        params.onError?.(new Error(data.reason))
        this.closeModal()
        return
      }

      if (data.type === 'ccai-pay:error') {
        params.onError?.(new Error(data.message))
      }
    }

    window.addEventListener('message', this.messageHandler)
    doc.body.appendChild(overlay)
    this.modalEl = overlay
  }

  private closeModal(): void {
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler)
      this.messageHandler = null
    }
    if (this.modalEl?.parentNode) {
      this.modalEl.parentNode.removeChild(this.modalEl)
    }
    this.modalEl = null
  }
}

export default CCAIPay
