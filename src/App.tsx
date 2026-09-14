import {
  useEffect,
  useRef,
  useState,
} from 'react'

import type {
  ElementType,
  FormEvent,
  ReactNode,
} from 'react'

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  CloudSun,
  ChevronDown,
  Droplets,
  FileText,
  Gauge,
  Home,
  LoaderCircle,
  MapPin,
  RotateCcw,
  ShieldAlert,
  Send,
  Settings,
  Sparkles,
  Sun,
  Thermometer,
  TrendingUp,
  Wind,
} from 'lucide-react'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import {
  Navigate,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useSearchParams,
} from 'react-router-dom'

import {
  askLina,
  getLinaBootstrap,
} from './lib/linaApi'

import type {
  ClimateForecastRow,
  LinaBootstrapResponse,
  LinaChatHistoryItem,
  LinaEvidence,
  LinaFinding,
  LinaLimitation,
  ProductionSummary,
} from './lib/linaApi'

import './App.css'

/* =========================================================
   TIPOS INTERNOS
   ========================================================= */

interface LinaDataState {
  data: LinaBootstrapResponse | null
  loading: boolean
  error: string | null
}

interface ProductionChartPoint {
  day: string
  value: number
}

interface ThermalChartPoint {
  dataHora: string
  thi: number
  temperaturaC: number | null
  umidadeRelativaPct: number | null
}

interface RiskWindow {
  active: boolean
  first: ClimateForecastRow | null
  last: ClimateForecastRow | null
  max: ClimateForecastRow | null
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  pending?: boolean
  error?: boolean
  evidence?: LinaEvidence[]
  limitations?: LinaLimitation[]
  model?: string
  answerType?: string
  retryQuestion?: string
  retryHistory?: LinaChatHistoryItem[]
}

/* =========================================================
   FALLBACKS
   ========================================================= */

const fallbackProductionData: ProductionChartPoint[] = [
  { day: '1 set', value: 31.0 },
  { day: '2', value: 30.5 },
  { day: '3', value: 30.75 },
  { day: '4', value: 31.15 },
  { day: '5', value: 31.23 },
  { day: '6', value: 31.4 },
  { day: '7', value: 31.5 },
  { day: '8', value: 31.7 },
  { day: '9', value: 31.85 },
  { day: '10', value: 31.8 },
  { day: '11', value: 31.9 },
  { day: '12', value: 31.7 },
  { day: '13 set', value: 31.8 },
]

const fallbackThermalData: ThermalChartPoint[] = [
  {
    dataHora: '2026-09-13T12:00',
    thi: 67,
    temperaturaC: 24.8,
    umidadeRelativaPct: 58,
  },
  {
    dataHora: '2026-09-13T15:00',
    thi: 69,
    temperaturaC: 26.2,
    umidadeRelativaPct: 55,
  },
  {
    dataHora: '2026-09-13T18:00',
    thi: 66,
    temperaturaC: 23.9,
    umidadeRelativaPct: 61,
  },
  {
    dataHora: '2026-09-14T06:00',
    thi: 63,
    temperaturaC: 20.7,
    umidadeRelativaPct: 72,
  },
  {
    dataHora: '2026-09-14T09:00',
    thi: 68,
    temperaturaC: 25.4,
    umidadeRelativaPct: 64,
  },
  {
    dataHora: '2026-09-14T12:00',
    thi: 73,
    temperaturaC: 29.2,
    umidadeRelativaPct: 57,
  },
  {
    dataHora: '2026-09-14T15:00',
    thi: 78,
    temperaturaC: 32.6,
    umidadeRelativaPct: 49,
  },
  {
    dataHora: '2026-09-14T18:00',
    thi: 75,
    temperaturaC: 30.1,
    umidadeRelativaPct: 52,
  },
  {
    dataHora: '2026-09-15T06:00',
    thi: 64,
    temperaturaC: 21.1,
    umidadeRelativaPct: 70,
  },
  {
    dataHora: '2026-09-15T12:00',
    thi: 71,
    temperaturaC: 28.4,
    umidadeRelativaPct: 56,
  },
]

const navItems = [
  {
    to: '/inicio',
    label: 'Início',
    icon: Home,
  },
  {
    to: '/clima',
    label: 'Clima',
    icon: CloudSun,
  },
  {
    to: '/producao',
    label: 'Produção',
    icon: BarChart3,
  },
  {
    to: '/lina',
    label: 'LINA',
    icon: Sparkles,
  },
  {
    to: '/relatorios',
    label: 'Relatórios',
    icon: FileText,
  },
]

const suggestedQuestions = [
  'Qual a previsão para os próximos dias?',
  'Como está a produção esta semana?',
  'Há risco térmico nas próximas 48 horas?',
]

const questionUrl = (question: string) =>
  `/lina?message=${encodeURIComponent(question)}`

/* =========================================================
   FORMATADORES
   ========================================================= */

function formatDecimal(
  value: number | null | undefined,
  decimals = 1,
): string {
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(value)
  ) {
    return '—'
  }

  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

function formatInteger(
  value: number | null | undefined,
): string {
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(value)
  ) {
    return '—'
  }

  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 0,
  }).format(value)
}

function formatSignedPercent(
  value: number | null | undefined,
): string {
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(value)
  ) {
    return '—'
  }

  const prefix = value > 0 ? '+' : ''

  return `${prefix}${formatDecimal(value, 1)}%`
}

function parseLocalDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null
  }

  const candidate = value.includes('T')
    ? value
    : `${value}T12:00:00`

  const date = new Date(candidate)

  return Number.isNaN(date.getTime())
    ? null
    : date
}

function safeDateTimeFormat(
  date: Date,
  options: Intl.DateTimeFormatOptions,
  timezone?: string,
): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      ...options,
      ...(timezone
        ? { timeZone: timezone }
        : {}),
    }).format(date)
  } catch {
    return new Intl.DateTimeFormat('pt-BR', options).format(date)
  }
}

function formatHeaderDate(
  value: string | null | undefined,
  timezone?: string,
): string {
  const date = parseLocalDate(value) ?? new Date()

  return safeDateTimeFormat(
    date,
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    },
    timezone,
  ).replace('.', '')
}

function formatUpdatedAt(
  value: string | null | undefined,
  timezone?: string,
): string {
  const date = parseLocalDate(value)

  if (!date) {
    return 'Atualização indisponível'
  }

  const time = safeDateTimeFormat(
    date,
    {
      hour: '2-digit',
      minute: '2-digit',
    },
    timezone,
  )

  return `Atualizado às ${time}`
}

function formatProductionDate(
  isoDate: string,
): string {
  const parts = isoDate.split('-')

  if (parts.length !== 3) {
    return isoDate
  }

  const day = Number(parts[2])
  const month = Number(parts[1])

  const months = [
    '',
    'jan',
    'fev',
    'mar',
    'abr',
    'mai',
    'jun',
    'jul',
    'ago',
    'set',
    'out',
    'nov',
    'dez',
  ]

  if (
    Number.isNaN(day) ||
    Number.isNaN(month)
  ) {
    return isoDate
  }

  return `${day} ${months[month] ?? ''}`
}

function formatForecastTick(
  value: string,
): string {
  const date = parseLocalDate(value)

  if (!date) {
    return value
  }

  const day = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  }).format(date)

  const hour = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
  })
    .format(date)
    .replace(' h', 'h')

  return `${day} · ${hour}`
}

function formatForecastMoment(
  value: string | null | undefined,
): string {
  const date = parseLocalDate(value)

  if (!date) {
    return 'horário indisponível'
  }

  const day = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  }).format(date)

  const hour = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
  })
    .format(date)
    .replace(' h', 'h')

  return `${day} às ${hour}`
}

function classificationLabel(
  classification: string | null | undefined,
): string {
  switch (classification) {
    case 'conforto':
      return 'Conforto'
    case 'atencao':
      return 'Atenção'
    case 'risco_elevado':
      return 'Risco elevado'
    default:
      return 'Indisponível'
  }
}

function windLabel(
  direction: string | null | undefined,
  speed: number | null | undefined,
): string {
  if (
    speed === null ||
    speed === undefined
  ) {
    return 'Vento indisponível'
  }

  return direction
    ? `${direction} · ${formatDecimal(speed, 1)} km/h`
    : `${formatDecimal(speed, 1)} km/h`
}

/* =========================================================
   CARREGAMENTO DA API
   ========================================================= */

function useLinaData(): LinaDataState {
  const [data, setData] =
    useState<LinaBootstrapResponse | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setError(null)

        const response = await getLinaBootstrap()

        if (!cancelled) {
          setData(response)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Erro ao carregar dados da LINA:', err)

          setError(
            err instanceof Error
              ? err.message
              : 'Não foi possível carregar os dados.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  return {
    data,
    loading,
    error,
  }
}

/* =========================================================
   HELPERS DE DADOS
   ========================================================= */

function getFarmName(lina: LinaDataState): string {
  return String(
    lina.data?.config?.propriedade ||
      'Fazenda Demonstração',
  )
}

function getFarmLocation(lina: LinaDataState): string {
  const parts = [
    lina.data?.config?.cidade,
    lina.data?.config?.estado,
  ].filter(Boolean)

  return parts.length > 0
    ? parts.join(' · ')
    : 'Botucatu · SP'
}

function getTimezone(lina: LinaDataState): string | undefined {
  const timezone = lina.data?.config?.timezone

  return timezone
    ? String(timezone)
    : undefined
}

function getProductionSummary(
  lina: LinaDataState,
): ProductionSummary | null {
  return lina.data?.producao?.resumo ?? null
}

function getProductionChartData(
  lina: LinaDataState,
): ProductionChartPoint[] {
  const rows = lina.data?.producao?.historico

  if (!rows || rows.length === 0) {
    return fallbackProductionData
  }

  const result = rows
    .filter((row) => row.leiteVacaL !== null)
    .map((row) => ({
      day: formatProductionDate(row.data),
      value: row.leiteVacaL ?? 0,
    }))

  return result.length > 0
    ? result
    : fallbackProductionData
}

function getThermalData(
  lina: LinaDataState,
): ThermalChartPoint[] {
  const forecast = lina.data?.clima?.forecast

  if (!forecast || forecast.length === 0) {
    return fallbackThermalData
  }

  const rows = forecast
    .filter((row) => row.thi !== null)
    .map((row) => ({
      dataHora: row.dataHora,
      thi: row.thi ?? 0,
      temperaturaC: row.temperaturaC,
      umidadeRelativaPct: row.umidadeRelativaPct,
    }))

  return rows.length > 0
    ? rows
    : fallbackThermalData
}

function getRiskWindow48h(
  lina: LinaDataState,
): RiskWindow {
  const climate = lina.data?.clima
  const attention =
    climate?.thresholds?.attention ?? 72

  const rows = (climate?.forecast ?? []).slice(0, 48)

  const startIndex = rows.findIndex(
    (row) =>
      row.thi !== null &&
      row.thi >= attention,
  )

  if (startIndex < 0) {
    return {
      active: false,
      first: null,
      last: null,
      max: null,
    }
  }

  const eventRows: ClimateForecastRow[] = []

  for (let index = startIndex; index < rows.length; index += 1) {
    const row = rows[index]

    if (
      row.thi === null ||
      row.thi < attention
    ) {
      break
    }

    eventRows.push(row)
  }

  const max = eventRows.reduce((best, row) =>
    (row.thi ?? -Infinity) >
    (best.thi ?? -Infinity)
      ? row
      : best,
  )

  return {
    active: true,
    first: eventRows[0],
    last: eventRows[eventRows.length - 1],
    max,
  }
}

function getClimateFinding(
  lina: LinaDataState,
): LinaFinding | null {
  const findings = lina.data?.achados ?? []

  return (
    findings.find(
      (item) =>
        item.tipo === 'clima' &&
        item.status === 'ativo' &&
        item.nivel !== 'informativo',
    ) ??
    findings.find(
      (item) =>
        item.tipo === 'clima' &&
        item.status === 'ativo',
    ) ??
    null
  )
}

function formatRiskWindow(window: RiskWindow): string {
  if (
    !window.active ||
    !window.first ||
    !window.last
  ) {
    return 'Sem janela de atenção nas próximas 48 h'
  }

  const first = parseLocalDate(window.first.dataHora)
  const last = parseLocalDate(window.last.dataHora)

  if (!first || !last) {
    return `${formatForecastMoment(
      window.first.dataHora,
    )} – ${formatForecastMoment(
      window.last.dataHora,
    )}`
  }

  const sameDay =
    first.getFullYear() === last.getFullYear() &&
    first.getMonth() === last.getMonth() &&
    first.getDate() === last.getDate()

  if (sameDay) {
    const day = new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    }).format(first)

    const firstHour = new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
    })
      .format(first)
      .replace(' h', 'h')

    const lastHour = new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
    })
      .format(last)
      .replace(' h', 'h')

    return `${day} · ${firstHour}–${lastHour}`
  }

  return `${formatForecastMoment(
    window.first.dataHora,
  )} – ${formatForecastMoment(
    window.last.dataHora,
  )}`
}

/* =========================================================
   BRAND
   ========================================================= */

function Brand({ inverse = false }: { inverse?: boolean }) {
  const asset = inverse
    ? 'brand/leite-no-azul-symbol-white.svg'
    : 'brand/leite-no-azul-symbol.svg'

  return (
    <div className={`brand${inverse ? ' inverse' : ''}`}>
      <img
        className="brand-symbol"
        src={`${import.meta.env.BASE_URL}${asset}`}
        alt=""
        aria-hidden="true"
      />

      <div className="brand-copy">
        <strong>
          Leite <span>no</span> Azul
        </strong>

        <small>
          LINA · apoio à decisão na pecuária leiteira
        </small>
      </div>
    </div>
  )
}

/* =========================================================
   SIDEBAR / MOBILE
   ========================================================= */

function Sidebar({ lina }: { lina: LinaDataState }) {
  return (
    <aside className="sidebar">
      <Brand inverse />

      <nav
        className="sidebar-nav"
        aria-label="Navegação principal"
      >
        {navItems.map(
          ({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `nav-item${isActive ? ' active' : ''}`
              }
            >
              <Icon size={20} strokeWidth={1.7} />
              <span>{label}</span>
            </NavLink>
          ),
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="farm-card">
          <div className="farm-icon">
            <MapPin size={19} />
          </div>

          <div>
            <strong>{getFarmName(lina)}</strong>
            <span>{getFarmLocation(lina)}</span>
          </div>
        </div>

        <button
          className="settings-button"
          type="button"
          disabled
          title="Disponível em uma próxima versão"
        >
          <Settings size={18} />
          Configurações
          <small>Em breve</small>
        </button>
      </div>
    </aside>
  )
}

function MobileHeader({ lina }: { lina: LinaDataState }) {
  return (
    <header className="mobile-header">
      <Brand />

      <div className="mobile-header-actions">
        <span className="mobile-sync">
          {lina.loading
            ? 'Sincronizando'
            : lina.error
              ? 'Modo local'
              : 'Conectada'}
        </span>

        <span
          className="icon-button"
          aria-label="Sem novas notificações"
        >
          <Bell size={20} />
        </span>
      </div>
    </header>
  )
}

function MobileNav() {
  return (
    <nav
      className="mobile-nav"
      aria-label="Navegação mobile"
    >
      {navItems.slice(0, 4).map(
        ({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `mobile-nav-item${isActive ? ' active' : ''}`
            }
          >
            <Icon size={20} strokeWidth={1.8} />
            <span>{label}</span>
          </NavLink>
        ),
      )}
    </nav>
  )
}

function PageShell({
  children,
  lina,
  home = false,
}: {
  children: ReactNode
  lina: LinaDataState
  home?: boolean
}) {
  return (
    <div className={`app-shell${home ? ' home-shell' : ''}`}>
      <Sidebar lina={lina} />
      <MobileHeader lina={lina} />

      <main
        id="main-content"
        className={`main-content${home ? ' home-content' : ''}`}
      >
        {children}
      </main>

      <MobileNav />
    </div>
  )
}

/* =========================================================
   HEADERS / HERO
   ========================================================= */

function PageHeader({
  title,
  subtitle,
  lina,
}: {
  title: string
  subtitle: string
  lina: LinaDataState
}) {
  const timezone = getTimezone(lina)
  const updateSource =
    lina.data?.clima?.current?.atualizadoEm ??
    lina.data?.generatedAt

  return (
    <div className="page-header">
      <div>
        <p className="eyebrow">LEITE NO AZUL · LINA</p>
        <h1>{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>

      <div className="header-meta">
        <div className="meta-date">
          {formatHeaderDate(updateSource, timezone)}
        </div>
        <div className="meta-update">
          {lina.loading
            ? 'Sincronizando dados...'
            : lina.error
              ? 'Modo local · API indisponível'
              : formatUpdatedAt(updateSource, timezone)}
        </div>
      </div>
    </div>
  )
}

function HomeHero({ lina }: { lina: LinaDataState }) {
  const timezone = getTimezone(lina)
  const updateSource =
    lina.data?.clima?.current?.atualizadoEm ??
    lina.data?.generatedAt

  return (
    <section
      className="home-hero"
      aria-labelledby="home-title"
    >
      <img
        className="hero-image"
        src={`${import.meta.env.BASE_URL}cows-hero.jpg`}
        alt="Bovinos na propriedade"
        fetchPriority="high"
      />

      <div className="hero-scrim" />

      <div className="hero-copy">
        <p className="eyebrow">LEITE NO AZUL · VISÃO GERAL</p>
        <h1 id="home-title">Bom dia!</h1>
        <p className="hero-subtitle">
          Aqui está o panorama da sua propriedade.
        </p>

        <span className="hero-farm">
          <MapPin size={13} />
          {getFarmName(lina)}
          <span>· {getFarmLocation(lina)}</span>
        </span>
      </div>

      <div className="hero-top-right">
        <div className="hero-date">
          <strong>
            {formatHeaderDate(updateSource, timezone)}
          </strong>
          <span>
            {lina.loading
              ? 'Carregando dados'
              : lina.error
                ? 'API indisponível'
                : formatUpdatedAt(updateSource, timezone)}
          </span>
        </div>

        <div className="hero-avatar" aria-label="Perfil PH">
          PH
        </div>
      </div>
    </section>
  )
}

/* =========================================================
   KPI
   ========================================================= */

function KpiCard({
  icon: Icon,
  iconSrc,
  iconAlt = '',
  label,
  value,
  unit,
  footer,
  tone = 'default',
  narrative = false,
}: {
  icon: ElementType
  iconSrc?: string
  iconAlt?: string
  label: string
  value: string
  unit?: string
  footer: ReactNode
  tone?: 'default' | 'warning' | 'danger' | 'brand'
  narrative?: boolean
}) {
  return (
    <article
      className={`kpi-card ${tone}${narrative ? ' narrative' : ''}`}
    >
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>

        <div className={`kpi-icon${iconSrc ? ' image-icon' : ''}`}>
          {iconSrc ? (
            <img src={iconSrc} alt={iconAlt} aria-hidden={iconAlt ? undefined : true} />
          ) : (
            <Icon size={20} strokeWidth={1.7} />
          )}
        </div>
      </div>

      <div className="kpi-main">
        <strong>{value}</strong>
        {unit && <span>{unit}</span>}
      </div>

      <div className="kpi-footer">{footer}</div>
    </article>
  )
}

/* =========================================================
   THERMAL CHART
   ========================================================= */

function ThermalChart({
  lina,
  compact = false,
}: {
  lina: LinaDataState
  compact?: boolean
}) {
  const data = getThermalData(lina)

  const attention =
    lina.data?.clima?.thresholds?.attention ?? 72

  const high =
    lina.data?.clima?.thresholds?.high ?? 78

  const validData = data.filter(
    (row) => Number.isFinite(Number(row.thi)),
  )

  if (validData.length === 0) {
    return (
      <div
        className={`thermal-chart${compact ? ' compact' : ''}`}
        role="img"
        aria-label="Previsão de THI indisponível."
      >
        <div className="thermal-chart-empty">
          Previsão térmica indisponível.
        </div>
      </div>
    )
  }

  const normalizedData = validData.map((row) => ({
    ...row,
    thi: Number(row.thi),
    temperaturaC:
      row.temperaturaC === null
        ? null
        : Number(row.temperaturaC),
  }))

  const thiValues = normalizedData.map((row) => row.thi)
  const minThi = Math.min(...thiValues)
  const maxThi = Math.max(...thiValues)

  const lowerBound = Math.min(50, Math.floor(minThi - 2))
  const upperBound = Math.max(high + 4, Math.ceil(maxThi + 2))

  const maxPoint = normalizedData.reduce((best, row) =>
    row.thi > best.thi ? row : best,
  )

  return (
    <div
      className={`thermal-chart${compact ? ' compact' : ''}`}
      role="img"
      aria-label={`Previsão de THI. Máximo previsto de ${formatDecimal(
        maxPoint.thi,
        1,
      )} em ${formatForecastMoment(maxPoint.dataHora)}.`}
    >
      {!compact && (
        <div className="thermal-chart-peak-card" aria-hidden="true">
          <strong>THI máximo: {formatDecimal(maxPoint.thi, 1)}</strong>
          <span>{formatForecastMoment(maxPoint.dataHora)}</span>
        </div>
      )}

      <div className="thermal-chart-canvas">
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          minHeight={0}
        >
          <LineChart
            data={normalizedData}
            margin={{
              top: compact ? 8 : 60,
              right: compact ? 10 : 20,
              left: compact ? -20 : -8,
              bottom: 0,
            }}
          >
            <ReferenceArea
              y1={lowerBound}
              y2={attention}
              fill="#EEF6FB"
              fillOpacity={1}
              ifOverflow="extendDomain"
            />

            <ReferenceArea
              y1={attention}
              y2={high}
              fill="#FFF4E8"
              fillOpacity={1}
              ifOverflow="extendDomain"
            />

            <ReferenceArea
              y1={high}
              y2={upperBound}
              fill="#FDECEC"
              fillOpacity={1}
              ifOverflow="extendDomain"
            />

            <CartesianGrid
              stroke="#DCE6EF"
              strokeDasharray="2 5"
              vertical={false}
            />

            <XAxis
              dataKey="dataHora"
              interval="preserveStartEnd"
              minTickGap={compact ? 34 : 58}
              tickFormatter={formatForecastTick}
              tick={{
                fill: '#617483',
                fontSize: compact ? 8 : 10,
              }}
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              height={32}
            />

            <YAxis
              domain={[lowerBound, upperBound]}
              hide={compact}
              tickCount={5}
              allowDecimals={false}
              tick={{
                fill: '#617483',
                fontSize: 10,
              }}
              tickLine={false}
              axisLine={false}
              width={42}
            />

            <Tooltip
              cursor={{
                stroke: '#9FC7E5',
                strokeWidth: 1,
                strokeDasharray: '3 4',
              }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <div className="chart-tooltip">
                    <span>
                      {formatForecastMoment(
                        String(payload[0].payload.dataHora),
                      )}
                    </span>
                    <strong>
                      THI {formatDecimal(Number(payload[0].value), 1)}
                    </strong>
                    <small>
                      {payload[0].payload.temperaturaC !== null
                        ? `${formatDecimal(
                            Number(payload[0].payload.temperaturaC),
                            1,
                          )} °C`
                        : 'Temperatura indisponível'}
                    </small>
                  </div>
                ) : null
              }
            />

            <ReferenceLine
              y={attention}
              stroke="#E78332"
              strokeWidth={1.4}
              strokeDasharray="5 5"
            />

            <Line
              type="monotone"
              dataKey="thi"
              stroke="#0B63B6"
              strokeWidth={2.8}
              dot={false}
              connectNulls
              activeDot={{
                r: 4,
                stroke: '#fff',
                strokeWidth: 2,
                fill: '#0B63B6',
              }}
              isAnimationActive={false}
            />

            <ReferenceDot
              x={maxPoint.dataHora}
              y={maxPoint.thi}
              r={5}
              fill="#E78332"
              stroke="#fff"
              strokeWidth={2.5}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/* =========================================================
   ACHADOS
   ========================================================= */

function FindingCard({
  variant,
  title,
  tag,
  children,
  to,
}: {
  variant: 'warning' | 'positive' | 'danger'
  title: string
  tag: string
  children: ReactNode
  to: string
}) {
  return (
    <article className={`finding-card ${variant}`}>
      <div className="finding-icon">
        {variant === 'warning' || variant === 'danger' ? (
          <AlertTriangle size={20} />
        ) : (
          <TrendingUp size={20} />
        )}
      </div>

      <div className="finding-body">
        <div className="finding-header">
          <h3>{title}</h3>
          <span className="tag">{tag}</span>
        </div>

        <p>{children}</p>

        <NavLink className="text-button" to={to}>
          Ver detalhes
          <ArrowRight size={14} />
        </NavLink>
      </div>
    </article>
  )
}

/* =========================================================
   ASK LINA
   ========================================================= */

function AskLinaBar() {
  const navigate = useNavigate()
  const [message, setMessage] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const clean = message.trim()

    if (clean) {
      navigate(questionUrl(clean))
    }
  }

  return (
    <section
      className="ask-lina"
      aria-label="Pergunte para a LINA"
    >
      <form className="ask-lina-form" onSubmit={handleSubmit}>
        <div className="ask-lina-icon">
          <Sparkles size={22} />
        </div>

        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Pergunte para a LINA..."
          aria-label="Pergunte para a LINA"
        />

        <button
          type="submit"
          className="ask-lina-send"
          aria-label="Enviar pergunta"
          disabled={!message.trim()}
        >
          <Send size={20} />
        </button>
      </form>

      <div className="ask-lina-chips">
        {suggestedQuestions.map((question) => (
          <button
            key={question}
            type="button"
            onClick={() => navigate(questionUrl(question))}
          >
            {question}
          </button>
        ))}
      </div>
    </section>
  )
}

/* =========================================================
   HOME
   ========================================================= */

function HomePage({ lina }: { lina: LinaDataState }) {
  const summary = getProductionSummary(lina)
  const current = lina.data?.clima?.current
  const climateFinding = getClimateFinding(lina)
  const risk48 = getRiskWindow48h(lina)

  const production = summary?.leiteVacaL ?? 31.8
  const variation = summary?.variacao7dPct

  const currentThi = current?.thi
  const currentClass = classificationLabel(
    current?.classificacao,
  )

  const riskTitle = risk48.active
    ? 'Possível estresse térmico'
    : 'Sem indicação de estresse térmico'

  const riskValue = risk48.active
    ? 'Possível estresse térmico'
    : 'Sem indicação de estresse térmico'

  return (
    <PageShell home lina={lina}>
      <div className="home-layout">
        <HomeHero lina={lina} />

        <section
          className="home-kpis"
          aria-label="Indicadores da propriedade"
        >
          <KpiCard
            icon={Droplets}
            iconSrc={`${import.meta.env.BASE_URL}kpi-icons/production.png`}
            label="Produção hoje"
            value={formatDecimal(production, 1)}
            unit="L/vaca/dia"
            footer={
              variation !== null && variation !== undefined ? (
                <>
                  <span className="delta">
                    {formatSignedPercent(variation)}
                  </span>
                  <span> vs. 7 dias atrás</span>
                </>
              ) : (
                'Último registro disponível'
              )
            }
            tone="brand"
          />

          <KpiCard
            icon={Thermometer}
            iconSrc={`${import.meta.env.BASE_URL}kpi-icons/thermal.png`}
            label="Condição térmica atual"
            value={formatDecimal(currentThi, 1)}
            unit="THI"
            footer={
              <span className={`status status-${current?.classificacao ?? 'indisponivel'}`}>
                <i />
                {currentClass}
              </span>
            }
            tone="brand"
          />

          <KpiCard
            icon={Sun}
            iconSrc={`${import.meta.env.BASE_URL}kpi-icons/forecast.png`}
            label="Próximas 48 horas"
            value={riskValue}
            unit={risk48.active ? 'atenção térmica' : undefined}
            footer={formatRiskWindow(risk48)}
            tone={risk48.active ? 'warning' : 'brand'}
            narrative
          />

          <KpiCard
            icon={TrendingUp}
            iconSrc={`${import.meta.env.BASE_URL}kpi-icons/variation.png`}
            label="Variação em 7 dias"
            value={
              variation !== null && variation !== undefined
                ? formatSignedPercent(variation)
                : '—'
            }
            footer="Comparação com o registro de 7 dias atrás"
            tone="brand"
            narrative
          />
        </section>

        <section
          className="home-main-grid"
          aria-label="Previsão e achados"
        >
          <article className="panel thermal-panel">
            <div className="panel-header">
              <div>
                <h2>Risco de estresse térmico</h2>
                <p>
                  Próximas 72 horas · previsão meteorológica externa
                </p>
              </div>

              <span className="source-chip">
                Open-Meteo
              </span>
            </div>

            <ThermalChart lina={lina} />

            <div className="chart-legend">
              <span>
                <i className="legend-dot blue" />
                Abaixo do limiar
              </span>

              <span>
                <i className="legend-dot orange" />
                Atenção
              </span>

              <span>
                <i className="legend-dot red" />
                Risco elevado
              </span>

              <span className="threshold-legend">
                <i />
                Limiar de atenção:{' '}
                {formatDecimal(
                  lina.data?.clima?.thresholds?.attention ?? 72,
                  0,
                )}
              </span>
            </div>
          </article>

          <section
            className="findings-panel"
            aria-labelledby="findings-title"
          >
            <div className="findings-panel-header">
              <h2 id="findings-title">Achados da LINA</h2>

              <NavLink
                to={questionUrl('Quais são os achados da propriedade?')}
                className="text-button"
              >
                Explorar
                <ArrowRight size={14} />
              </NavLink>
            </div>

            <FindingCard
              variant={
                climateFinding?.nivel === 'elevado'
                  ? 'danger'
                  : climateFinding?.nivel === 'atencao'
                    ? 'warning'
                    : 'positive'
              }
              title={climateFinding?.titulo ?? riskTitle}
              tag="Open-Meteo"
              to="/clima"
            >
              {climateFinding?.descricao ??
                (risk48.active
                  ? `A previsão externa indica uma janela de atenção entre ${formatRiskWindow(
                      risk48,
                    )}.`
                  : 'A previsão externa não ultrapassa o limiar de atenção nas próximas 48 horas.')}
            </FindingCard>

            <FindingCard
              variant="positive"
              title="Produção atualizada"
              tag="Google Sheets"
              to="/producao"
            >
              O último registro disponível indica{' '}
              {formatDecimal(production, 1)} L/vaca/dia
              {variation !== null && variation !== undefined
                ? `, com variação de ${formatSignedPercent(
                    variation,
                  )} em relação a 7 dias atrás.`
                : '.'}
            </FindingCard>
          </section>
        </section>

        <AskLinaBar />
      </div>
    </PageShell>
  )
}

/* =========================================================
   CLIMA
   ========================================================= */

function ClimatePage({ lina }: { lina: LinaDataState }) {
  const current = lina.data?.clima?.current
  const forecast = lina.data?.clima?.forecast ?? []

  return (
    <PageShell lina={lina}>
      <PageHeader
        lina={lina}
        title="Clima"
        subtitle="Condições meteorológicas externas e previsão térmica da propriedade."
      />

      <section className="standard-grid grid-4">
        <KpiCard
          icon={Thermometer}
          label="Temperatura atual"
          value={formatDecimal(current?.temperaturaC, 1)}
          unit="°C"
          footer="Open-Meteo · 2 m"
          tone="brand"
        />

        <KpiCard
          icon={Droplets}
          label="Umidade relativa"
          value={formatDecimal(current?.umidadeRelativaPct, 0)}
          unit="%"
          footer="Open-Meteo · 2 m"
          tone="brand"
        />

        <KpiCard
          icon={Gauge}
          label="THI atual"
          value={formatDecimal(current?.thi, 1)}
          footer={classificationLabel(current?.classificacao)}
          tone={
            current?.classificacao === 'risco_elevado'
              ? 'danger'
              : current?.classificacao === 'atencao'
                ? 'warning'
                : 'brand'
          }
        />

        <KpiCard
          icon={Wind}
          label="Vento"
          value={formatDecimal(current?.ventoKmh, 1)}
          unit="km/h"
          footer={windLabel(
            current?.ventoDirecao,
            current?.ventoKmh,
          )}
          tone="brand"
        />
      </section>

      <article className="panel standard-panel">
        <div className="panel-header">
          <div>
            <h2>Condição térmica prevista</h2>
            <p>Próximas 72 horas · THI calculado pela LINA</p>
          </div>

          <span className="source-chip">Open-Meteo</span>
        </div>

        <div className="standard-chart-wrap">
          <ThermalChart lina={lina} />
        </div>
      </article>

      <div className="weather-strip">
        {(forecast.length > 0
          ? forecast.slice(0, 7)
          : []
        ).map((item) => (
          <div className="weather-hour" key={item.dataHora}>
            <span>{formatForecastMoment(item.dataHora)}</span>
            <Sun size={18} />
            <strong>{formatDecimal(item.temperaturaC, 1)}°</strong>
            <small>THI {formatDecimal(item.thi, 1)}</small>
          </div>
        ))}

        {forecast.length === 0 && (
          <div className="weather-empty">
            Previsão horária ainda não disponível.
          </div>
        )}
      </div>

      <p className="source-note">
        Dados meteorológicos externos por Open-Meteo. Em propriedades confinadas,
        estes dados não substituem medições de microclima dentro das instalações.
      </p>
    </PageShell>
  )
}

/* =========================================================
   PRODUÇÃO
   ========================================================= */

function ProductionPage({ lina }: { lina: LinaDataState }) {
  const summary = getProductionSummary(lina)
  const productionData = getProductionChartData(lina)

  const production = summary?.leiteVacaL ?? 31.8
  const cows = summary?.vacasLactacao ?? 180
  const totalMilk = summary?.leiteTotalL ?? 5724
  const variation = summary?.variacao7dPct

  const values = productionData.map((item) => item.value)

  const minimum =
    values.length > 0
      ? Math.floor(Math.min(...values) - 1)
      : 28

  const maximum =
    values.length > 0
      ? Math.ceil(Math.max(...values) + 1)
      : 34

  return (
    <PageShell lina={lina}>
      <PageHeader
        lina={lina}
        title="Produção"
        subtitle={
          lina.loading
            ? 'Sincronizando os dados produtivos da propriedade.'
            : lina.error
              ? 'Não foi possível sincronizar; exibindo dados locais de segurança.'
              : 'Dados produtivos sincronizados com o Google Sheets.'
        }
      />

      <section className="standard-grid grid-3">
        <KpiCard
          icon={Droplets}
          label="Produção média"
          value={formatDecimal(production, 1)}
          unit="L/vaca/dia"
          footer={
            variation !== null && variation !== undefined
              ? `${formatSignedPercent(variation)} em 7 dias`
              : 'Último registro disponível'
          }
          tone="brand"
        />

        <KpiCard
          icon={Activity}
          label="Vacas em lactação"
          value={formatInteger(cows)}
          unit="animais"
          footer="Último registro disponível"
          tone="brand"
        />

        <KpiCard
          icon={TrendingUp}
          label="Leite total"
          value={formatInteger(totalMilk)}
          unit="L/dia"
          footer="Último registro disponível"
          tone="brand"
        />
      </section>

      <article className="panel standard-panel">
        <div className="panel-header">
          <div>
            <h2>Produção diária</h2>
            <p>Histórico disponível no Google Sheets</p>
          </div>

          <span className="source-chip">
            {lina.error ? 'Dados locais' : 'Google Sheets'}
          </span>
        </div>

        <div className="production-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={productionData}
              margin={{
                top: 20,
                right: 10,
                left: -10,
                bottom: 0,
              }}
            >
              <CartesianGrid stroke="#DCE6EF" vertical={false} />

              <XAxis
                dataKey="day"
                tick={{
                  fill: '#617483',
                  fontSize: 10,
                }}
                tickLine={false}
                axisLine={false}
              />

              <YAxis
                domain={[minimum, maximum]}
                tick={{
                  fill: '#617483',
                  fontSize: 10,
                }}
                tickLine={false}
                axisLine={false}
              />

              <Tooltip
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div className="chart-tooltip">
                      <span>{label}</span>
                      <strong>
                        {Number(payload[0].value).toLocaleString('pt-BR', {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 2,
                        })}{' '}
                        L/vaca/dia
                      </strong>
                    </div>
                  ) : null
                }
              />

              <Bar
                dataKey="value"
                fill="#0B63B6"
                radius={[5, 5, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>
    </PageShell>
  )
}

/* =========================================================
   LINA CONECTADA AO GEMINI
   ========================================================= */

function createChatMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function getChatHistory(messages: ChatMessage[]): LinaChatHistoryItem[] {
  return messages
    .filter(
      (message) =>
        message.id !== 'welcome' &&
        !message.pending &&
        !message.error &&
        message.text.trim().length > 0,
    )
    .map((message) => ({
      role: message.role,
      text: message.text,
    }))
}

function evidenceClassLabel(dataClass: string): string {
  switch (dataClass) {
    case 'observed':
      return 'Dado observado'
    case 'external_weather':
      return 'Previsão externa'
    case 'calculated':
      return 'Calculado pela LINA'
    case 'derived_finding':
      return 'Achado do sistema'
    case 'configuration':
      return 'Configuração'
    default:
      return 'Fonte de dados'
  }
}

function renderMessageEvidence(message: ChatMessage) {
  const evidence = message.evidence ?? []
  const limitations = message.limitations ?? []

  if (evidence.length === 0 && limitations.length === 0) {
    return null
  }

  const sourceLabel = `${evidence.length} ${
    evidence.length === 1 ? 'fonte' : 'fontes'
  }`

  const limitationLabel = `${limitations.length} ${
    limitations.length === 1 ? 'limitação' : 'limitações'
  }`

  return (
    <details className="traceability-block">
      <summary className="traceability-summary">
        <span className="traceability-summary-icon">
          <FileText size={14} />
        </span>

        <span className="traceability-summary-copy">
          <strong>Fontes e limitações</strong>
          <small>
            {sourceLabel}
            {limitations.length > 0 ? ` · ${limitationLabel}` : ''}
          </small>
        </span>

        <ChevronDown
          className="traceability-chevron"
          size={16}
          aria-hidden="true"
        />
      </summary>

      <div className="traceability-content">
        {evidence.length > 0 && (
          <section className="traceability-section" aria-label="Fontes desta resposta">
            <div className="traceability-section-title">
              <FileText size={13} />
              <span>Fontes desta resposta</span>
            </div>

            <div className="traceability-source-list">
              {evidence.map((item) => (
                <div className="traceability-source" key={item.id}>
                  <div className="traceability-source-main">
                    <strong>{item.source}</strong>
                    <span>{item.label}</span>
                  </div>

                  <span className="traceability-source-type">
                    {evidenceClassLabel(item.dataClass)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {limitations.length > 0 && (
          <section
            className="traceability-section traceability-limitations"
            aria-label="Limitações relevantes"
          >
            <div className="traceability-section-title">
              <ShieldAlert size={13} />
              <span>
                {limitations.length === 1
                  ? 'Limitação relevante'
                  : 'Limitações relevantes'}
              </span>
            </div>

            <div className="traceability-limitation-list">
              {limitations.map((item) => (
                <div className="traceability-limitation" key={item.code}>
                  <span className="traceability-limitation-dot" />
                  <p>{item.text}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </details>
  )
}

function LinaPage({ lina }: { lina: LinaDataState }) {
  const [searchParams] = useSearchParams()

  const initialQuestion = searchParams.get('message')?.trim() ?? ''

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const activeRequestRef = useRef<AbortController | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    })
  }, [messages, sending])

  useEffect(() => {
    return () => {
      activeRequestRef.current?.abort()
    }
  }, [])

  function getFriendlyErrorMessage(error: unknown): string {
    const detail =
      error instanceof Error
        ? error.message
        : 'Não foi possível concluir a consulta.'

    if (/cancelad/i.test(detail)) {
      return 'A consulta foi cancelada.'
    }

    if (/demorou|tempo limite|timeout/i.test(detail)) {
      return 'A LINA demorou mais que o esperado para responder. Seus dados continuam disponíveis normalmente.'
    }

    if (/conectar|rede|failed to fetch|network/i.test(detail)) {
      return 'Não consegui conectar ao serviço da LINA agora. Verifique a conexão e tente novamente.'
    }

    if (/limite|429|demanda|temporariamente|500|502|503|504/i.test(detail)) {
      return 'O serviço de IA está temporariamente indisponível ou sobrecarregado. Tente novamente em alguns instantes.'
    }

    return 'Não consegui processar a pergunta agora. Tente novamente em alguns instantes.'
  }

  function updateAssistantWithSuccess(
    assistantId: string,
    response: Awaited<ReturnType<typeof askLina>>,
  ) {
    setMessages((current) =>
      current.map((message) =>
        message.id === assistantId
          ? {
              ...message,
              text: response.resposta,
              pending: false,
              error: false,
              evidence: response.evidence,
              limitations: response.limitations,
              model: response.model,
              answerType: response.answerType,
              retryQuestion: undefined,
              retryHistory: undefined,
            }
          : message,
      ),
    )
  }

  function updateAssistantWithError(
    assistantId: string,
    error: unknown,
    question: string,
    history: LinaChatHistoryItem[],
  ) {
    setMessages((current) =>
      current.map((message) =>
        message.id === assistantId
          ? {
              ...message,
              text: getFriendlyErrorMessage(error),
              pending: false,
              error: true,
              evidence: undefined,
              limitations: undefined,
              model: undefined,
              answerType: undefined,
              retryQuestion: question,
              retryHistory: history,
            }
          : message,
      ),
    )
  }

  async function executeChatRequest(
    assistantId: string,
    question: string,
    history: LinaChatHistoryItem[],
    controller: AbortController,
  ) {
    try {
      const response = await askLina(question, history, {
        signal: controller.signal,
        timeoutMs: 60000,
      })

      if (controller.signal.aborted) {
        return
      }

      updateAssistantWithSuccess(assistantId, response)
    } catch (error) {
      if (controller.signal.aborted) {
        return
      }

      updateAssistantWithError(
        assistantId,
        error,
        question,
        history,
      )
    } finally {
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null
        setSending(false)
      }
    }
  }

  useEffect(() => {
    activeRequestRef.current?.abort()

    if (!initialQuestion) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          text:
            'Olá! Sou a LINA. Posso analisar os dados disponíveis de produção, clima, THI e achados da propriedade. Também deixo explícito quando uma informação não está disponível ou quando os dados não permitem concluir algo.',
        },
      ])
      setSending(false)
      return
    }

    const userId = createChatMessageId('user')
    const assistantId = createChatMessageId('assistant')
    const controller = new AbortController()

    activeRequestRef.current = controller

    setMessages([
      {
        id: userId,
        role: 'user',
        text: initialQuestion,
      },
      {
        id: assistantId,
        role: 'assistant',
        text: '',
        pending: true,
      },
    ])

    setSending(true)

    void executeChatRequest(
      assistantId,
      initialQuestion,
      [],
      controller,
    )

    return () => {
      controller.abort()
    }
  }, [initialQuestion])

  async function handleChatSubmit(event: FormEvent) {
    event.preventDefault()

    const clean = input.trim()

    if (!clean || sending) {
      return
    }

    const history = getChatHistory(messages)
    const userId = createChatMessageId('user')
    const assistantId = createChatMessageId('assistant')
    const controller = new AbortController()

    const userMessage: ChatMessage = {
      id: userId,
      role: 'user',
      text: clean,
    }

    const pendingMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      text: '',
      pending: true,
    }

    activeRequestRef.current = controller

    setMessages((current) => [
      ...current,
      userMessage,
      pendingMessage,
    ])

    setInput('')
    setSending(true)

    await executeChatRequest(
      assistantId,
      clean,
      history,
      controller,
    )
  }

  async function handleRetry(message: ChatMessage) {
    if (
      sending ||
      !message.error ||
      !message.retryQuestion
    ) {
      return
    }

    const history = message.retryHistory ?? []
    const controller = new AbortController()

    activeRequestRef.current = controller
    setSending(true)

    setMessages((current) =>
      current.map((item) =>
        item.id === message.id
          ? {
              ...item,
              text: '',
              pending: true,
              error: false,
            }
          : item,
      ),
    )

    await executeChatRequest(
      message.id,
      message.retryQuestion,
      history,
      controller,
    )
  }

  return (
    <PageShell lina={lina}>
      <PageHeader
        lina={lina}
        title="LINA"
        subtitle="Converse sobre os dados disponíveis da propriedade e explore os achados."
      />

      <div className="chat-layout">
        <section className="chat-card">
          <div className="chat-header">
            <div className="assistant-avatar">
              <Sparkles size={19} />
            </div>

            <div>
              <strong>LINA</strong>
              <span>Gemini · contexto estruturado da propriedade</span>
            </div>

            <span className={`online-pill${sending ? ' busy' : ''}`}>
              {sending ? 'Analisando' : 'IA ativa'}
            </span>
          </div>

          <div className="messages" aria-live="polite" aria-busy={sending}>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`message ${
                  message.role === 'user'
                    ? 'user-message'
                    : 'assistant-message'
                }${message.error ? ' message-error' : ''}`}
              >
                {message.role === 'assistant' && (
                  <div className="assistant-label">
                    <Sparkles size={14} />
                    LINA
                    {message.pending ? ' · analisando' : ''}
                  </div>
                )}

                {message.pending ? (
                  <div className="thinking-state" role="status">
                    <LoaderCircle
                      className="thinking-spinner"
                      size={16}
                      aria-hidden="true"
                    />
                    <span>Analisando os dados da propriedade</span>
                    <span className="thinking-dots" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                  </div>
                ) : (
                  <p>{message.text}</p>
                )}

                {message.error && !message.pending && (
                  <div className="chat-error-actions">
                    <button
                      type="button"
                      className="retry-button"
                      onClick={() => void handleRetry(message)}
                      disabled={sending}
                    >
                      <RotateCcw size={14} />
                      Tentar novamente
                    </button>
                  </div>
                )}

                {message.role === 'assistant' &&
                  !message.pending &&
                  !message.error &&
                  /THI|térmic|previsão/i.test(message.text) && (
                    <div className="mini-chart">
                      <ThermalChart lina={lina} compact />
                    </div>
                  )}

                {message.role === 'assistant' &&
                  !message.pending &&
                  !message.error &&
                  renderMessageEvidence(message)}
              </div>
            ))}

            <div ref={messagesEndRef} className="messages-end" />
          </div>

          <form
            className={`chat-input${sending ? ' is-busy' : ''}`}
            onSubmit={handleChatSubmit}
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={
                sending
                  ? 'A LINA está analisando os dados...'
                  : 'Pergunte sobre clima, produção ou achados...'
              }
              aria-label="Sua mensagem para a LINA"
              disabled={sending}
            />

            <button
              type="submit"
              aria-label={sending ? 'A LINA está analisando' : 'Enviar'}
              disabled={sending || !input.trim()}
            >
              {sending ? (
                <LoaderCircle className="send-spinner" size={17} />
              ) : (
                <Send size={18} />
              )}
            </button>
          </form>
        </section>

        <aside className="context-card">
          <span className="eyebrow">CONTEXTO ATUAL</span>
          <h3>Fontes desta versão</h3>

          <div className="context-row">
            <CloudSun size={18} />
            <div>
              <strong>Previsão meteorológica</strong>
              <span>Open-Meteo · ambiente externo</span>
            </div>
          </div>

          <div className="context-row">
            <Gauge size={18} />
            <div>
              <strong>Indicador térmico</strong>
              <span>THI calculado pelo backend da LINA</span>
            </div>
          </div>

          <div className="context-row">
            <Activity size={18} />
            <div>
              <strong>Produção</strong>
              <span>
                {lina.error
                  ? 'API de dados indisponível'
                  : 'Google Sheets · sincronizado'}
              </span>
            </div>
          </div>

          <div className="context-row">
            <Sparkles size={18} />
            <div>
              <strong>Camada conversacional</strong>
              <span>Gemini · interpretação do contexto estruturado</span>
            </div>
          </div>

          <div className="context-note">
            A LINA apresenta dados, contexto e achados para apoiar decisões.
            THI, janelas térmicas e achados são calculados pelo backend; o
            Gemini atua como camada de linguagem e não prescreve manejo.
          </div>
        </aside>
      </div>
    </PageShell>
  )
}

/* =========================================================
   RELATÓRIOS
   ========================================================= */

function ReportsPage({ lina }: { lina: LinaDataState }) {
  return (
    <PageShell lina={lina}>
      <PageHeader
        lina={lina}
        title="Relatórios"
        subtitle="Sínteses estruturadas da propriedade entrarão nas próximas versões do MVP."
      />

      <div className="empty-state">
        <FileText size={34} />
        <h2>Relatórios ainda não entram nesta versão</h2>
        <p>
          O MVP atual prioriza produção, clima, THI, achados e a interface conversacional da LINA.
        </p>
      </div>
    </PageShell>
  )
}

/* =========================================================
   APP
   ========================================================= */

export default function App() {
  const lina = useLinaData()

  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to="/inicio" replace />}
      />

      <Route
        path="/inicio"
        element={<HomePage lina={lina} />}
      />

      <Route
        path="/clima"
        element={<ClimatePage lina={lina} />}
      />

      <Route
        path="/producao"
        element={<ProductionPage lina={lina} />}
      />

      <Route
        path="/lina"
        element={<LinaPage lina={lina} />}
      />

      <Route
        path="/relatorios"
        element={<ReportsPage lina={lina} />}
      />

      <Route
        path="*"
        element={<Navigate to="/inicio" replace />}
      />
    </Routes>
  )
}
