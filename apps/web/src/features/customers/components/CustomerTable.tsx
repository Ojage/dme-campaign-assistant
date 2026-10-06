import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table'
import { ChevronDown, ChevronUp, Search, UserPlus, Upload, Users } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/common/Button'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorMessage } from '@/components/common/ErrorMessage'
import { CustomerTableSkeleton } from '@/features/customers/components/CustomerTableSkeleton'
import { AddCustomerDialog } from '@/features/customers/components/AddCustomerDialog'
import { ImportCustomersDialog } from '@/features/customers/components/ImportCustomersDialog'
import { useCustomers, PAGE_SIZE_OPTIONS } from '@/features/customers/hooks/useCustomers'
import { useCustomerKPIs } from '@/features/customers/hooks/useCustomerKPIs'
import { CustomerStatus, type Customer } from '@/features/customers/types/customer.types'
import { formatDate, formatNumber, formatXaf } from '@/utils/formatters'
import { getCountries } from '@/features/customers/api/customersApi'
import { useFocusFlash } from '@/features/search/hooks/useFocusFlash'
import { cn } from '@/lib/utils'

const STATUS_BADGE_CLASSES: Record<CustomerStatus, string> = {
  [CustomerStatus.ACTIVE]: 'bg-success/15 text-success',
  [CustomerStatus.INACTIVE]: 'bg-warning/15 text-warning',
  [CustomerStatus.CHURNED]: 'bg-destructive/15 text-destructive',
}

const columnHelper = createColumnHelper<Customer>()

export function CustomerTable() {
  const { t } = useTranslation('customers')
  const { t: tCommon } = useTranslation('common')
  const { flashId, flashTarget, flashClass } = useFocusFlash('customers')
  const {
    customers,
    total,
    filters,
    isLoading,
    isFetching,
    error,
    retry,
    handleSearchChange,
    handleStatusChange,
    handleCountryChange,
    handlePageChange,
    handlePageSizeChange,
  } = useCustomers()
  const { kpis } = useCustomerKPIs()

  // Per-status headcounts enrich the status filter and tell an empty table apart
  // from an empty base.
  const statusCounts = kpis?.statusCounts
  const hasAnyCustomers = (kpis?.totalCustomers ?? 0) > 0

  const [countries, setCountries] = useState<string[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([])

  useEffect(() => {
    void getCountries().then(setCountries)
  }, [])

  const statusLabels: Record<CustomerStatus, string> = {
    [CustomerStatus.ACTIVE]: tCommon('status.active'),
    [CustomerStatus.INACTIVE]: tCommon('status.inactive'),
    [CustomerStatus.CHURNED]: tCommon('status.churned'),
  }

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: t('columns.customer'),
        enableSorting: true,
        cell: (info) => (
          <div>
            <p className="text-sm font-semibold text-foreground">{info.getValue()}</p>
            <p className="text-xs text-muted-foreground">{info.row.original.email}</p>
          </div>
        ),
      }),
      columnHelper.accessor('country', {
        header: t('columns.country'),
        enableSorting: true,
        cell: (info) => <span className="text-sm text-foreground">{info.getValue()}</span>,
      }),
      columnHelper.accessor('status', {
        header: t('columns.status'),
        enableSorting: false,
        cell: (info) => (
          <span
            className={cn(
              'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
              STATUS_BADGE_CLASSES[info.getValue()],
            )}
          >
            {statusLabels[info.getValue()]}
          </span>
        ),
      }),
      columnHelper.accessor('totalTransactions', {
        header: t('columns.transactions'),
        enableSorting: true,
        cell: (info) => <span className="text-sm tabular-nums text-foreground">{info.getValue()}</span>,
      }),
      columnHelper.accessor('totalAmountSpent', {
        header: t('columns.totalSpent'),
        enableSorting: true,
        cell: (info) => (
          <span className="text-sm font-semibold tabular-nums text-foreground">{formatXaf(info.getValue())}</span>
        ),
      }),
      columnHelper.accessor('lastActivityDate', {
        header: t('columns.lastActivity'),
        enableSorting: true,
        cell: (info) => <span className="text-sm text-muted-foreground">{formatDate(info.getValue())}</span>,
      }),
    ],
    [t, statusLabels],
  )

  const table = useReactTable({
    data: customers,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
  })

  const totalPages = Math.max(1, Math.ceil(total / filters.limit))

  if (error) return <ErrorMessage message={error} onRetry={retry} />

  return (
    <div
          data-focus-section="customers"
          className={cn('flex flex-col gap-4 rounded-xl', flashTarget === 'section' && flashClass)}
        >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full min-w-0 flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="pl-9"
          />
        </div>
        <Select value={filters.status} onValueChange={(v) => handleStatusChange(v as CustomerStatus | 'all')}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder={tCommon('status.all')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {statusCounts ? `${tCommon('status.all')} (${formatNumber(kpis?.totalCustomers ?? 0)})` : tCommon('status.all')}
            </SelectItem>
            {Object.values(CustomerStatus).map((status) => (
              <SelectItem key={status} value={status}>
                {statusCounts ? `${statusLabels[status]} (${formatNumber(statusCounts[status])})` : statusLabels[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.country} onValueChange={handleCountryChange}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder={t('allCountries')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allCountries')}</SelectItem>
            {countries.map((country) => (
              <SelectItem key={country} value={country}>
                {country}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <span className={cn('text-xs text-muted-foreground transition-opacity', isFetching ? 'opacity-100' : 'opacity-0')}>
            {tCommon('actions.refreshing')}
          </span>
          <Button variant="outline" size="sm" leftIcon={<Upload className="h-4 w-4" />} onClick={() => setImportOpen(true)}>
            {t('actions.importCsv')}
          </Button>
          <Button size="sm" leftIcon={<UserPlus className="h-4 w-4" />} onClick={() => setAddOpen(true)}>
            {t('actions.addCustomer')}
          </Button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <CustomerTableSkeleton rows={filters.limit > 10 ? 10 : 8} />
      ) : customers.length === 0 ? (
        hasAnyCustomers ? (
          <EmptyState
            icon={Search}
            title={t('empty.title')}
            description={t('empty.description')}
          />
        ) : (
          <EmptyState
            icon={Users}
            title={t('empty.noCustomers.title')}
            description={t('empty.noCustomers.description')}
            action={<Button size="sm" onClick={() => setImportOpen(true)}>{t('empty.noCustomers.import')}</Button>}
          />
        )
      ) : (
        // Border lives here; the horizontal scrollport is Table's own wrapper, so
        // this container must not scroll again — nested scrollports stack two bars.
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => {
                    const sortable = header.column.id !== 'status'
                    const sorted = header.column.getIsSorted()
                    return (
                      <TableHead
                        key={header.id}
                        onClick={sortable ? header.column.getToggleSortingHandler() : undefined}
                        className={cn('whitespace-nowrap', sortable && 'cursor-pointer select-none')}
                      >
                        <span className="inline-flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : null}
                          {sorted === 'desc' ? <ChevronDown className="h-3.5 w-3.5" /> : null}
                        </span>
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => {
                const customerId = row.original.id
                return (
                  <TableRow
                    key={row.id}
                    data-focus-id={customerId}
                    className={cn('transition-colors', customerId === flashId && flashTarget === 'row' && flashClass)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{t('showing', { shown: customers.length, total })}</p>
        <div className="flex items-center gap-3">
          <Select value={String(filters.limit)} onValueChange={(v) => handlePageSizeChange(Number(v))}>
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {t('perPage', { n: size })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">{t('pageOf', { page: filters.page, total: totalPages })}</span>
          <Button variant="outline" size="sm" disabled={filters.page <= 1} onClick={() => handlePageChange(filters.page - 1)}>
            {tCommon('actions.previous')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={filters.page >= totalPages}
            onClick={() => handlePageChange(filters.page + 1)}
          >
            {tCommon('actions.next')}
          </Button>
        </div>
      </div>

      <AddCustomerDialog open={addOpen} onOpenChange={setAddOpen} countries={countries} />
      <ImportCustomersDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}
