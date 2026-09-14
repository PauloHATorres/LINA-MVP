export interface LinaConfig {
  propriedade?: string
  cidade?: string
  estado?: string
  latitude?: string | number
  longitude?: string | number
  timezone?: string
  thi_atencao?: string | number
  thi_risco_elevado?: string | number
}

export interface ProductionRow {
  data: string
  vacasLactacao: number | null
  leiteTotalL: number | null
  leiteVacaL: number | null
}

export interface ProductionSummary {
  registros: number
  dataAtual: string | null
  vacasLactacao: number | null
  leiteTotalL: number | null
  leiteVacaL: number | null
  variacao7dPct: number | null
}

export type ThermalClassification =
  | 'conforto'
  | 'atencao'
  | 'risco_elevado'
  | 'indisponivel'

export interface ClimateCurrent {
  dataHora: string | null
  temperaturaC: number | null
  umidadeRelativaPct: number | null
  thi: number | null
  classificacao: ThermalClassification
  ventoKmh: number | null
  ventoDirecaoGraus: number | null
  ventoDirecao: string | null
  fonte: string
  atualizadoEm: string
}

export interface ClimateForecastRow {
  dataHora: string
  temperaturaC: number | null
  umidadeRelativaPct: number | null
  thi: number | null
  ventoKmh: number | null
  ventoDirecaoGraus: number | null
  fonte: string
  atualizadoEm: string
}

export interface ClimateThresholds {
  attention: number
  high: number
}

export interface ClimateSummary {
  forecastHours: number
  hasThermalAttention: boolean
  maxThi: number | null
  maxThiTime: string | null
  firstAttentionTime: string | null
  lastAttentionTime: string | null
}

export interface ClimateBundle {
  status: string
  source: string
  attribution: string
  observedEnvironment: string
  current: ClimateCurrent | null
  thresholds: ClimateThresholds
  summary: ClimateSummary
  forecast: ClimateForecastRow[]
}

export interface LinaFinding {
  id: string
  tipo: string
  origem: string
  inicio: string
  fim: string
  nivel: string
  titulo: string
  descricao: string
  status: string
  criadoEm: string
}

export interface LinaBootstrapResponse {
  ok: boolean
  version: string
  contextVersion?: string
  generatedAt: string
  config: LinaConfig
  producao: {
    resumo: ProductionSummary
    historico: ProductionRow[]
  }
  clima: ClimateBundle
  achados: LinaFinding[]
}

export interface LinaChatHistoryItem {
  role: 'user' | 'assistant'
  text: string
}

export interface LinaEvidence {
  id: string
  source: string
  label: string
  dataClass: string
  date?: string | null
  updatedAt?: string | null
}

export interface LinaLimitation {
  code: string
  severity: string
  text: string
}

export interface LinaUsage {
  inputTokens: number | null
  outputTokens: number | null
  thoughtTokens: number | null
  totalTokens: number | null
}

export interface LinaProviderAttempt {
  model: string
  attempt: number
  status: number
  ok: boolean
  retryable: boolean
}

export interface LinaAskResponse {
  ok: true
  version: string
  model: string
  pergunta: string
  resposta: string
  answerType: string
  needsClarification: boolean
  evidence: LinaEvidence[]
  limitations: LinaLimitation[]
  contextVersion: string | null
  generatedAt: string
  usage: LinaUsage | null
  providerAttempts: LinaProviderAttempt[]
}

interface LinaErrorResponse {
  ok: false
  error?: string
}

export type LinaApiErrorCode =
  | 'aborted'
  | 'timeout'
  | 'network'
  | 'http'
  | 'api'

export class LinaApiError extends Error {
  readonly code: LinaApiErrorCode
  readonly status?: number

  constructor(
    code: LinaApiErrorCode,
    message: string,
    status?: number,
  ) {
    super(message)
    this.name = 'LinaApiError'
    this.code = code
    this.status = status
  }
}

export interface AskLinaOptions {
  signal?: AbortSignal
  timeoutMs?: number
}

const API_URL = import.meta.env.VITE_LINA_API_URL
const DEFAULT_ASK_TIMEOUT_MS = 60000

function getApiUrl(): string {
  if (!API_URL) {
    throw new LinaApiError(
      'api',
      'VITE_LINA_API_URL não foi configurada.',
    )
  }

  return API_URL
}

function buildActionUrl(action?: string): string {
  const baseUrl = getApiUrl()

  if (!action) {
    return baseUrl
  }

  const separator = baseUrl.includes('?') ? '&' : '?'

  return `${baseUrl}${separator}action=${encodeURIComponent(action)}`
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text()

  if (!text) {
    throw new LinaApiError(
      'api',
      'A API da LINA retornou uma resposta vazia.',
    )
  }

  try {
    return JSON.parse(text) as T
  } catch {
    throw new LinaApiError(
      'api',
      'A API da LINA retornou uma resposta inválida.',
    )
  }
}

async function getRequest<T>(action?: string): Promise<T> {
  let response: Response

  try {
    response = await fetch(buildActionUrl(action), {
      method: 'GET',
      cache: 'no-store',
      redirect: 'follow',
    })
  } catch {
    throw new LinaApiError(
      'network',
      'Não foi possível conectar à API da LINA.',
    )
  }

  if (!response.ok) {
    throw new LinaApiError(
      'http',
      `A API da LINA respondeu HTTP ${response.status}.`,
      response.status,
    )
  }

  return parseJsonResponse<T>(response)
}

export async function getLinaBootstrap(): Promise<LinaBootstrapResponse> {
  const data = await getRequest<LinaBootstrapResponse>('bootstrap')

  if (!data.ok) {
    throw new LinaApiError(
      'api',
      'A API da LINA retornou erro.',
    )
  }

  return data
}

export async function askLina(
  pergunta: string,
  historico: LinaChatHistoryItem[] = [],
  options: AskLinaOptions = {},
): Promise<LinaAskResponse> {
  const cleanQuestion = pergunta.trim()

  if (!cleanQuestion) {
    throw new LinaApiError('api', 'A pergunta está vazia.')
  }

  const controller = new AbortController()
  const timeoutMs = options.timeoutMs ?? DEFAULT_ASK_TIMEOUT_MS
  let timedOut = false

  const handleExternalAbort = () => {
    controller.abort()
  }

  if (options.signal?.aborted) {
    throw new LinaApiError('aborted', 'A consulta foi cancelada.')
  }

  options.signal?.addEventListener('abort', handleExternalAbort, {
    once: true,
  })

  const timeoutId = window.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  try {
    let response: Response

    try {
      response = await fetch(buildActionUrl('perguntar'), {
        method: 'POST',
        cache: 'no-store',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          pergunta: cleanQuestion,
          historico,
        }),
      })
    } catch (error) {
      if (timedOut) {
        throw new LinaApiError(
          'timeout',
          'A LINA demorou mais que o esperado para responder.',
        )
      }

      if (options.signal?.aborted || controller.signal.aborted) {
        throw new LinaApiError('aborted', 'A consulta foi cancelada.')
      }

      throw new LinaApiError(
        'network',
        'Não foi possível conectar ao serviço da LINA.',
      )
    }

    if (!response.ok) {
      throw new LinaApiError(
        'http',
        `O serviço da LINA respondeu HTTP ${response.status}.`,
        response.status,
      )
    }

    const data = await parseJsonResponse<LinaAskResponse | LinaErrorResponse>(
      response,
    )

    if (!data.ok) {
      const errorData = data as LinaErrorResponse

      throw new LinaApiError(
        'api',
        errorData.error || 'A LINA não conseguiu processar a pergunta.',
      )
    }

    return data
  } finally {
    window.clearTimeout(timeoutId)
    options.signal?.removeEventListener('abort', handleExternalAbort)
  }
}

export async function checkLinaApi(): Promise<boolean> {
  try {
    const data = await getRequest<{ ok: boolean }>('health')
    return data.ok === true
  } catch {
    return false
  }
}
