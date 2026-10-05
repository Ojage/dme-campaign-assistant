/**
 * Monthly spend series rendered by the dashboard trend chart.
 *
 * No endpoint produces this yet, so it is a fixed series kept beside the component
 * that draws it. When a real endpoint lands, this file is replaced by a query and
 * the hook is the only other thing that changes.
 */
export interface RevenueTrendPoint {
  month: string
  revenue: number
  activeCustomers: number
}

export const REVENUE_TREND: RevenueTrendPoint[] = [
  { month: 'Feb', revenue: 4_120_000, activeCustomers: 38 },
  { month: 'Mar', revenue: 4_780_000, activeCustomers: 41 },
  { month: 'Apr', revenue: 5_340_000, activeCustomers: 45 },
  { month: 'May', revenue: 4_960_000, activeCustomers: 43 },
  { month: 'Jun', revenue: 6_110_000, activeCustomers: 52 },
  { month: 'Jul', revenue: 7_240_000, activeCustomers: 58 },
]
