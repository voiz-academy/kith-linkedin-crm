'use client'

import React, { useEffect, useState, useMemo } from 'react'
import Image from 'next/image'
import { supabase, Contact, OutreachStatus, OUTREACH_STATUS_LABELS } from '@/lib/supabase'

type StatusFilter = 'all' | 'hot' | 'sql' | 'mql' | 'nurture'
type AssigneeFilter = 'all' | 'diego' | 'unassigned'
type OutreachFilter = 'all' | 'not_contacted' | 'request_sent' | 'connected' | 'replied' | 'meeting_scheduled'
type SizeFilter = 'all' | 'small' | 'medium' | 'large' | 'enterprise'
type SortField = 'name' | 'company_name' | 'employee_count' | 'total_score' | 'title'
type SortDirection = 'asc' | 'desc'

const STATUS_LABELS: Record<string, { label: string; description: string }> = {
  hot: { label: 'Ready Now', description: 'High score, reach out immediately' },
  sql: { label: 'Strong Fit', description: 'Good match, worth pursuing' },
  mql: { label: 'Worth Watching', description: 'Some signals, nurture first' },
  nurture: { label: 'Early Stage', description: 'Low score, keep on radar' },
}

const PAGE_SIZE = 50

export default function Dashboard() {
  const [allContacts, setAllContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [outreachFilter, setOutreachFilter] = useState<OutreachFilter>('all')
  const [sizeFilter, setSizeFilter] = useState<SizeFilter>('all')
  const [industryFilter, setIndustryFilter] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('total_score')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  // Get unique industries for filter dropdown
  const uniqueIndustries = useMemo(() => {
    const industries = new Set<string>()
    allContacts.forEach(c => {
      if (c.industry) industries.add(c.industry)
    })
    return Array.from(industries).sort()
  }, [allContacts])

  // Stats counts from all contacts (unfiltered)
  const statsCounts = useMemo(() => ({
    hot: allContacts.filter(c => c.status === 'hot').length,
    sql: allContacts.filter(c => c.status === 'sql').length,
    mql: allContacts.filter(c => c.status === 'mql').length,
    nurture: allContacts.filter(c => c.status === 'nurture').length,
  }), [allContacts])

  // Filtered and sorted contacts
  const filteredContacts = useMemo(() => {
    let result = allContacts

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(c => c.status === statusFilter)
    }

    // Assignee filter
    if (assigneeFilter === 'unassigned') {
      result = result.filter(c => !c.assigned_to)
    } else if (assigneeFilter !== 'all') {
      result = result.filter(c => c.assigned_to === assigneeFilter)
    }

    // Outreach status filter
    if (outreachFilter !== 'all') {
      result = result.filter(c => (c.outreach_status || 'not_contacted') === outreachFilter)
    }

    // Company size filter
    if (sizeFilter !== 'all') {
      result = result.filter(c => {
        const count = c.employee_count || 0
        switch (sizeFilter) {
          case 'small': return count < 500
          case 'medium': return count >= 500 && count < 5000
          case 'large': return count >= 5000 && count < 50000
          case 'enterprise': return count >= 50000
          default: return true
        }
      })
    }

    // Industry filter
    if (industryFilter !== 'all') {
      result = result.filter(c => c.industry === industryFilter)
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(c =>
        c.name.toLowerCase().includes(query) ||
        (c.company_name?.toLowerCase().includes(query)) ||
        (c.title?.toLowerCase().includes(query))
      )
    }

    // Sorting
    result = [...result].sort((a, b) => {
      let aVal: string | number | null = null
      let bVal: string | number | null = null

      switch (sortField) {
        case 'name':
          aVal = a.name.toLowerCase()
          bVal = b.name.toLowerCase()
          break
        case 'company_name':
          aVal = (a.company_name || '').toLowerCase()
          bVal = (b.company_name || '').toLowerCase()
          break
        case 'employee_count':
          aVal = a.employee_count || 0
          bVal = b.employee_count || 0
          break
        case 'total_score':
          aVal = a.total_score
          bVal = b.total_score
          break
        case 'title':
          aVal = (a.title || '').toLowerCase()
          bVal = (b.title || '').toLowerCase()
          break
      }

      if (aVal === null || bVal === null) return 0
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return result
  }, [allContacts, statusFilter, assigneeFilter, outreachFilter, sizeFilter, industryFilter, searchQuery, sortField, sortDirection])

  // Paginated contacts
  const totalPages = Math.ceil(filteredContacts.length / PAGE_SIZE)
  const paginatedContacts = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredContacts.slice(start, start + PAGE_SIZE)
  }, [filteredContacts, currentPage])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
    setSelectedIds(new Set())
  }, [statusFilter, assigneeFilter, outreachFilter, sizeFilter, industryFilter, searchQuery, sortField, sortDirection])

  useEffect(() => {
    fetchContacts()
  }, [])

  async function fetchContacts() {
    setLoading(true)

    const { data, error } = await supabase
      .from('contact_engagement_summary')
      .select('*')
      .order('total_score', { ascending: false })

    if (error) {
      console.error('Error fetching contacts:', error)
    } else {
      setAllContacts(data || [])
    }
    setLoading(false)
  }

  async function claimLead(contactId: string, assignee: string) {
    const { error } = await supabase
      .from('linkedin_contacts')
      .update({ assigned_to: assignee })
      .eq('id', contactId)

    if (!error) {
      setAllContacts(prev => prev.map(c =>
        c.id === contactId ? { ...c, assigned_to: assignee } : c
      ))
    }
  }

  async function unclaimLead(contactId: string) {
    const { error } = await supabase
      .from('linkedin_contacts')
      .update({ assigned_to: null })
      .eq('id', contactId)

    if (!error) {
      setAllContacts(prev => prev.map(c =>
        c.id === contactId ? { ...c, assigned_to: null } : c
      ))
    }
  }

  async function updateOutreachStatus(contactId: string, status: OutreachStatus) {
    const updates: Record<string, unknown> = { outreach_status: status }
    if (status === 'request_sent') {
      updates.last_contact_date = new Date().toISOString().split('T')[0]
    }

    const { error } = await supabase
      .from('linkedin_contacts')
      .update(updates)
      .eq('id', contactId)

    if (!error) {
      setAllContacts(prev => prev.map(c =>
        c.id === contactId ? { ...c, outreach_status: status, ...(status === 'request_sent' ? { last_contact_date: new Date().toISOString().split('T')[0] } : {}) } : c
      ))
    }
  }

  async function updateNotes(contactId: string, notes: string) {
    const { error } = await supabase
      .from('linkedin_contacts')
      .update({ notes })
      .eq('id', contactId)

    if (!error) {
      setAllContacts(prev => prev.map(c =>
        c.id === contactId ? { ...c, notes } : c
      ))
    }
  }

  // Bulk actions
  async function bulkClaim(assignee: string) {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return

    const { error } = await supabase
      .from('linkedin_contacts')
      .update({ assigned_to: assignee })
      .in('id', ids)

    if (!error) {
      setAllContacts(prev => prev.map(c =>
        selectedIds.has(c.id) ? { ...c, assigned_to: assignee } : c
      ))
      setSelectedIds(new Set())
    }
  }

  function exportSelected() {
    const contacts = selectedIds.size > 0
      ? filteredContacts.filter(c => selectedIds.has(c.id))
      : filteredContacts

    const csv = [
      ['Name', 'Title', 'Company', 'Industry', 'Employees', 'Score', 'Status', 'LinkedIn URL', 'Email'].join(','),
      ...contacts.map(c => [
        `"${c.name}"`,
        `"${c.title || ''}"`,
        `"${c.company_name || ''}"`,
        `"${c.industry || ''}"`,
        c.employee_count || '',
        c.total_score,
        c.status,
        c.linkedin_url || '',
        c.email || ''
      ].join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leads-export-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function toggleSelectAll() {
    if (selectedIds.size === paginatedContacts.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(paginatedContacts.map(c => c.id)))
    }
  }

  function toggleSelect(id: string) {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)
  }

  function generateNoteContext(contact: Contact): string {
    const parts = [
      `Name: ${contact.name}`,
      `Title: ${contact.title || 'Unknown'}`,
      `Company: ${contact.company_name || 'Unknown'}`,
      `Industry: ${contact.industry || 'Unknown'}`,
      `Employees: ${contact.employee_count || 'Unknown'}`,
    ]

    if (contact.engaged_with_authors?.length) {
      parts.push(`Engaged with posts by: ${contact.engaged_with_authors.join(', ')}`)
    }

    if (contact.notes) {
      parts.push(`Notes: ${contact.notes}`)
    }

    return parts.join('\n')
  }

  async function copyNoteContext(contact: Contact) {
    const context = generateNoteContext(contact)
    await navigator.clipboard.writeText(context)
    setCopiedId(contact.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  function getStatusStyle(status: string) {
    switch (status) {
      case 'hot': return 'bg-[#D4A574] text-[#1a1d21]'
      case 'sql': return 'bg-[rgba(212,165,116,0.3)] text-[#E8B888]'
      case 'mql': return 'bg-[rgba(232,230,227,0.1)] text-[rgba(232,230,227,0.7)]'
      case 'nurture': return 'bg-[rgba(232,230,227,0.05)] text-[rgba(232,230,227,0.4)]'
      default: return 'bg-[rgba(232,230,227,0.05)] text-[rgba(232,230,227,0.4)]'
    }
  }

  function getOutreachStyle(status: OutreachStatus) {
    switch (status) {
      case 'meeting_scheduled': return 'text-[#D4A574]'
      case 'replied': return 'text-[#E8B888]'
      case 'connected': return 'text-[rgba(232,230,227,0.7)]'
      case 'request_sent': return 'text-[rgba(232,230,227,0.5)]'
      default: return 'text-[rgba(232,230,227,0.35)]'
    }
  }

  function formatEmployeeCount(count: number | undefined): string {
    if (!count) return '-'
    if (count >= 1000) return `${Math.round(count / 1000)}k`
    return count.toString()
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection(field === 'total_score' || field === 'employee_count' ? 'desc' : 'asc')
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) {
      return <span className="ml-1 text-[rgba(232,230,227,0.15)]">↕</span>
    }
    return <span className="ml-1 text-[#D4A574]">{sortDirection === 'asc' ? '↑' : '↓'}</span>
  }

  function clearAllFilters() {
    setStatusFilter('all')
    setAssigneeFilter('all')
    setOutreachFilter('all')
    setSizeFilter('all')
    setIndustryFilter('all')
    setSearchQuery('')
    setSortField('total_score')
    setSortDirection('desc')
  }

  const hasActiveFilters = statusFilter !== 'all' || assigneeFilter !== 'all' || outreachFilter !== 'all' || sizeFilter !== 'all' || industryFilter !== 'all' || searchQuery.trim() !== ''

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-[rgba(232,230,227,0.06)]">
        <div className="max-w-[1400px] mx-auto px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Image
              src="/logo.svg"
              alt="Kith AI Lab"
              width={140}
              height={24}
              priority
            />
            <div className="h-5 w-px bg-[rgba(232,230,227,0.1)]" />
            <span className="text-[rgba(232,230,227,0.4)] text-sm font-medium tracking-wide">LINKEDIN CRM</span>
          </div>
          <div className="flex items-center gap-3">
            {selectedIds.size > 0 && (
              <>
                <span className="text-[rgba(232,230,227,0.5)] text-sm">{selectedIds.size} selected</span>
                <button
                  onClick={() => bulkClaim('diego')}
                  className="bg-[rgba(232,230,227,0.05)] border border-[rgba(232,230,227,0.1)] text-[rgba(232,230,227,0.7)] px-4 py-2 rounded-md text-sm font-medium hover:bg-[rgba(232,230,227,0.08)] transition-all"
                >
                  Claim Selected
                </button>
              </>
            )}
            <button
              onClick={exportSelected}
              className="bg-[rgba(232,230,227,0.05)] border border-[rgba(232,230,227,0.1)] text-[rgba(232,230,227,0.7)] px-4 py-2 rounded-md text-sm font-medium hover:bg-[rgba(232,230,227,0.08)] transition-all"
            >
              Export {selectedIds.size > 0 ? 'Selected' : 'All'}
            </button>
            <button
              onClick={fetchContacts}
              className="bg-[#D4A574] text-[#1a1d21] px-5 py-2 rounded-md font-medium text-sm hover:shadow-[0_0_20px_rgba(212,165,116,0.3)] transition-all duration-300"
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto p-8">
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6 items-end">
          <div>
            <label className="block text-[11px] font-medium text-[rgba(232,230,227,0.25)] uppercase tracking-[0.1em] mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="bg-[#232629] border border-[rgba(232,230,227,0.06)] rounded-md px-3 py-2 text-[#e8e6e3] text-sm focus:outline-none focus:border-[rgba(212,165,116,0.25)] transition-colors"
            >
              <option value="all">All Status</option>
              <option value="hot">Ready Now</option>
              <option value="sql">Strong Fit</option>
              <option value="mql">Worth Watching</option>
              <option value="nurture">Early Stage</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[rgba(232,230,227,0.25)] uppercase tracking-[0.1em] mb-2">Outreach</label>
            <select
              value={outreachFilter}
              onChange={(e) => setOutreachFilter(e.target.value as OutreachFilter)}
              className="bg-[#232629] border border-[rgba(232,230,227,0.06)] rounded-md px-3 py-2 text-[#e8e6e3] text-sm focus:outline-none focus:border-[rgba(212,165,116,0.25)] transition-colors"
            >
              <option value="all">All Outreach</option>
              <option value="not_contacted">Not Contacted</option>
              <option value="request_sent">Request Sent</option>
              <option value="connected">Connected</option>
              <option value="replied">Replied</option>
              <option value="meeting_scheduled">Meeting Scheduled</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[rgba(232,230,227,0.25)] uppercase tracking-[0.1em] mb-2">Company Size</label>
            <select
              value={sizeFilter}
              onChange={(e) => setSizeFilter(e.target.value as SizeFilter)}
              className="bg-[#232629] border border-[rgba(232,230,227,0.06)] rounded-md px-3 py-2 text-[#e8e6e3] text-sm focus:outline-none focus:border-[rgba(212,165,116,0.25)] transition-colors"
            >
              <option value="all">All Sizes</option>
              <option value="small">&lt; 500</option>
              <option value="medium">500 - 5k</option>
              <option value="large">5k - 50k</option>
              <option value="enterprise">50k+</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[rgba(232,230,227,0.25)] uppercase tracking-[0.1em] mb-2">Industry</label>
            <select
              value={industryFilter}
              onChange={(e) => setIndustryFilter(e.target.value)}
              className="bg-[#232629] border border-[rgba(232,230,227,0.06)] rounded-md px-3 py-2 text-[#e8e6e3] text-sm focus:outline-none focus:border-[rgba(212,165,116,0.25)] transition-colors max-w-[180px]"
            >
              <option value="all">All Industries</option>
              {uniqueIndustries.map(industry => (
                <option key={industry} value={industry}>{industry}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[rgba(232,230,227,0.25)] uppercase tracking-[0.1em] mb-2">Assigned To</label>
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value as AssigneeFilter)}
              className="bg-[#232629] border border-[rgba(232,230,227,0.06)] rounded-md px-3 py-2 text-[#e8e6e3] text-sm focus:outline-none focus:border-[rgba(212,165,116,0.25)] transition-colors"
            >
              <option value="all">All Assignees</option>
              <option value="diego">Diego</option>
              <option value="unassigned">Unassigned</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[11px] font-medium text-[rgba(232,230,227,0.25)] uppercase tracking-[0.1em] mb-2">Search</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, company, title..."
              className="w-full bg-[#232629] border border-[rgba(232,230,227,0.06)] rounded-md px-3 py-2 text-[#e8e6e3] text-sm placeholder-[rgba(232,230,227,0.25)] focus:outline-none focus:border-[rgba(212,165,116,0.25)] transition-colors"
            />
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-[rgba(232,230,227,0.5)] hover:text-[#D4A574] text-sm font-medium transition-colors pb-2"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Active filters indicator */}
        {hasActiveFilters && (
          <div className="mb-6 text-sm text-[rgba(232,230,227,0.4)]">
            Showing {filteredContacts.length} of {allContacts.length} contacts
          </div>
        )}

        {/* Stats - Always show full counts */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {(['hot', 'sql', 'mql', 'nurture'] as const).map((status) => {
            const count = statsCounts[status]
            const isActive = status === 'hot' && count > 0
            const isFiltered = statusFilter === status
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
                className={`
                  rounded-lg p-5 border transition-all duration-300 text-left
                  ${status === 'hot'
                    ? 'bg-[linear-gradient(135deg,rgba(212,165,116,0.08)_0%,rgba(212,165,116,0.03)_100%)] border-[rgba(212,165,116,0.15)]'
                    : 'bg-[linear-gradient(135deg,rgba(232,230,227,0.03)_0%,rgba(232,230,227,0.01)_100%)] border-[rgba(232,230,227,0.06)]'
                  }
                  ${isFiltered ? 'ring-2 ring-[#D4A574] ring-opacity-50' : ''}
                  hover:border-[rgba(212,165,116,0.3)]
                `}
              >
                <div className="flex items-center gap-2 mb-1">
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D4A574] shadow-[0_0_8px_rgba(212,165,116,0.4)] animate-pulse" />
                  )}
                  <span className="text-[11px] font-medium text-[rgba(232,230,227,0.25)] uppercase tracking-[0.1em]">
                    {STATUS_LABELS[status].label}
                  </span>
                </div>
                <div className={`text-3xl font-semibold ${status === 'hot' ? 'text-[#D4A574]' : 'text-[#e8e6e3]'}`}>
                  {count}
                </div>
              </button>
            )
          })}
        </div>

        {/* Table */}
        <div className="bg-[#232629] rounded-lg border border-[rgba(232,230,227,0.06)] overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-[rgba(232,230,227,0.35)]">Loading...</div>
          ) : filteredContacts.length === 0 ? (
            <div className="p-12 text-center text-[rgba(232,230,227,0.35)]">No contacts found</div>
          ) : (
            <>
              <table className="w-full">
                <thead className="border-b border-[rgba(232,230,227,0.06)]">
                  <tr>
                    <th className="w-10 px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === paginatedContacts.length && paginatedContacts.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-[rgba(232,230,227,0.2)] bg-transparent text-[#D4A574] focus:ring-[#D4A574] focus:ring-offset-0"
                      />
                    </th>
                    <th
                      className="text-left px-4 py-4 text-[11px] font-medium text-[rgba(232,230,227,0.25)] uppercase tracking-[0.1em] cursor-pointer hover:text-[rgba(232,230,227,0.5)] transition-colors select-none"
                      onClick={() => toggleSort('name')}
                    >
                      Name<SortIcon field="name" />
                    </th>
                    <th
                      className="text-left px-4 py-4 text-[11px] font-medium text-[rgba(232,230,227,0.25)] uppercase tracking-[0.1em] cursor-pointer hover:text-[rgba(232,230,227,0.5)] transition-colors select-none"
                      onClick={() => toggleSort('title')}
                    >
                      Title<SortIcon field="title" />
                    </th>
                    <th
                      className="text-left px-4 py-4 text-[11px] font-medium text-[rgba(232,230,227,0.25)] uppercase tracking-[0.1em] cursor-pointer hover:text-[rgba(232,230,227,0.5)] transition-colors select-none"
                      onClick={() => toggleSort('company_name')}
                    >
                      Company<SortIcon field="company_name" />
                    </th>
                    <th
                      className="text-left px-4 py-4 text-[11px] font-medium text-[rgba(232,230,227,0.25)] uppercase tracking-[0.1em] w-20 cursor-pointer hover:text-[rgba(232,230,227,0.5)] transition-colors select-none"
                      onClick={() => toggleSort('employee_count')}
                    >
                      Size<SortIcon field="employee_count" />
                    </th>
                    <th
                      className="text-left px-4 py-4 text-[11px] font-medium text-[rgba(232,230,227,0.25)] uppercase tracking-[0.1em] w-16 cursor-pointer hover:text-[rgba(232,230,227,0.5)] transition-colors select-none"
                      onClick={() => toggleSort('total_score')}
                    >
                      Score<SortIcon field="total_score" />
                    </th>
                    <th className="text-left px-4 py-4 text-[11px] font-medium text-[rgba(232,230,227,0.25)] uppercase tracking-[0.1em] w-28">Fit</th>
                    <th className="text-left px-4 py-4 text-[11px] font-medium text-[rgba(232,230,227,0.25)] uppercase tracking-[0.1em] w-36">Outreach</th>
                    <th className="text-left px-4 py-4 text-[11px] font-medium text-[rgba(232,230,227,0.25)] uppercase tracking-[0.1em] w-32">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedContacts.map((contact) => (
                    <React.Fragment key={contact.id}>
                      <tr
                        className={`border-b border-[rgba(232,230,227,0.04)] hover:bg-[rgba(232,230,227,0.02)] cursor-pointer transition-colors duration-300 ${selectedIds.has(contact.id) ? 'bg-[rgba(212,165,116,0.05)]' : ''}`}
                        onClick={() => setExpandedId(expandedId === contact.id ? null : contact.id)}
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(contact.id)}
                            onChange={() => toggleSelect(contact.id)}
                            className="rounded border-[rgba(232,230,227,0.2)] bg-transparent text-[#D4A574] focus:ring-[#D4A574] focus:ring-offset-0"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-[#e8e6e3]">{contact.name}</div>
                          {contact.assigned_to && (
                            <div className="text-[10px] text-[rgba(232,230,227,0.35)] mt-0.5">{contact.assigned_to}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[rgba(232,230,227,0.5)] text-sm max-w-[200px] truncate" title={contact.title || ''}>
                          {contact.title || '-'}
                        </td>
                        <td className="px-4 py-3 text-[rgba(232,230,227,0.5)] text-sm">{contact.company_name || '-'}</td>
                        <td className="px-4 py-3 text-[rgba(232,230,227,0.4)] text-sm font-mono">
                          {formatEmployeeCount(contact.employee_count)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono font-semibold text-[#e8e6e3]">{contact.total_score}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded text-xs font-medium ${getStatusStyle(contact.status)}`}>
                            {STATUS_LABELS[contact.status]?.label || contact.status}
                          </span>
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={contact.outreach_status || 'not_contacted'}
                            onChange={(e) => updateOutreachStatus(contact.id, e.target.value as OutreachStatus)}
                            className={`bg-transparent border-none text-sm focus:outline-none cursor-pointer ${getOutreachStyle(contact.outreach_status || 'not_contacted')}`}
                          >
                            {Object.entries(OUTREACH_STATUS_LABELS).map(([value, label]) => (
                              <option key={value} value={value} className="bg-[#232629] text-[#e8e6e3]">{label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-3" onClick={(e) => e.stopPropagation()}>
                            {contact.linkedin_url && (
                              <a
                                href={contact.linkedin_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#D4A574] hover:text-[#E8B888] text-sm font-medium transition-colors"
                              >
                                LinkedIn
                              </a>
                            )}
                            {!contact.assigned_to ? (
                              <button
                                onClick={() => claimLead(contact.id, 'diego')}
                                className="text-[rgba(232,230,227,0.5)] hover:text-[#D4A574] text-sm font-medium transition-colors"
                              >
                                Claim
                              </button>
                            ) : (
                              <button
                                onClick={() => unclaimLead(contact.id)}
                                className="text-[rgba(232,230,227,0.35)] hover:text-[rgba(232,230,227,0.5)] text-sm font-medium transition-colors"
                              >
                                Release
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expandedId === contact.id && (
                        <tr className="bg-[rgba(232,230,227,0.02)]">
                          <td colSpan={9} className="px-5 py-6">
                            <div className="grid grid-cols-4 gap-8">
                              {/* Score Breakdown */}
                              <div>
                                <h4 className="text-[11px] font-medium text-[rgba(232,230,227,0.25)] uppercase tracking-[0.1em] mb-4">
                                  Score Breakdown
                                </h4>
                                <div className="space-y-3 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-[rgba(232,230,227,0.5)]">Firmographic</span>
                                    <span className="font-mono text-[#e8e6e3]">{contact.firmographic_score}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-[rgba(232,230,227,0.5)]">Title</span>
                                    <span className="font-mono text-[#e8e6e3]">{contact.title_score}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-[rgba(232,230,227,0.5)]">Engagement</span>
                                    <span className="font-mono text-[#e8e6e3]">{contact.engagement_score}</span>
                                  </div>
                                  <div className="flex justify-between pt-3 border-t border-[rgba(232,230,227,0.06)]">
                                    <span className="text-[#e8e6e3] font-medium">Total</span>
                                    <span className="font-mono font-semibold text-[#D4A574]">{contact.total_score}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Company & Engagement */}
                              <div>
                                <h4 className="text-[11px] font-medium text-[rgba(232,230,227,0.25)] uppercase tracking-[0.1em] mb-4">
                                  Context
                                </h4>
                                <div className="space-y-2 text-sm">
                                  <div>
                                    <span className="text-[rgba(232,230,227,0.35)]">Industry: </span>
                                    <span className="text-[#e8e6e3]">{contact.industry || '-'}</span>
                                  </div>
                                  <div>
                                    <span className="text-[rgba(232,230,227,0.35)]">Employees: </span>
                                    <span className="text-[#e8e6e3]">{contact.employee_count?.toLocaleString() || '-'}</span>
                                  </div>
                                  <div>
                                    <span className="text-[rgba(232,230,227,0.35)]">Product: </span>
                                    <span className="text-[#e8e6e3]">{contact.product_interest || '-'}</span>
                                  </div>
                                  {contact.engaged_with_authors?.length ? (
                                    <div className="pt-2">
                                      <span className="text-[rgba(232,230,227,0.35)]">Engaged with: </span>
                                      <span className="text-[#D4A574]">{contact.engaged_with_authors.join(', ')}</span>
                                    </div>
                                  ) : null}
                                  {contact.last_engagement && (
                                    <div>
                                      <span className="text-[rgba(232,230,227,0.35)]">Last engagement: </span>
                                      <span className="text-[#e8e6e3]">{new Date(contact.last_engagement).toLocaleDateString()}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Notes */}
                              <div>
                                <h4 className="text-[11px] font-medium text-[rgba(232,230,227,0.25)] uppercase tracking-[0.1em] mb-4">
                                  Notes
                                </h4>
                                <textarea
                                  className="w-full h-24 bg-[#1a1d21] border border-[rgba(232,230,227,0.06)] rounded-md p-3 text-sm text-[#e8e6e3] placeholder-[rgba(232,230,227,0.25)] focus:outline-none focus:border-[rgba(212,165,116,0.25)] transition-colors resize-none"
                                  placeholder="Add notes..."
                                  defaultValue={contact.notes || ''}
                                  onBlur={(e) => {
                                    if (e.target.value !== (contact.notes || '')) {
                                      updateNotes(contact.id, e.target.value)
                                    }
                                  }}
                                />
                              </div>

                              {/* Actions */}
                              <div>
                                <h4 className="text-[11px] font-medium text-[rgba(232,230,227,0.25)] uppercase tracking-[0.1em] mb-4">
                                  Quick Actions
                                </h4>
                                <div className="space-y-3">
                                  {/* Generate Note Button */}
                                  <button
                                    onClick={() => copyNoteContext(contact)}
                                    className="w-full bg-[rgba(212,165,116,0.1)] border border-[rgba(212,165,116,0.2)] text-[#D4A574] px-4 py-2.5 rounded-md text-sm font-medium hover:bg-[rgba(212,165,116,0.15)] hover:border-[rgba(212,165,116,0.3)] transition-all"
                                  >
                                    {copiedId === contact.id ? 'Copied to Clipboard' : 'Copy Context for Note'}
                                  </button>

                                  {/* Quick Mark Sent */}
                                  {(contact.outreach_status === 'not_contacted' || !contact.outreach_status) && (
                                    <button
                                      onClick={() => updateOutreachStatus(contact.id, 'request_sent')}
                                      className="w-full bg-[rgba(232,230,227,0.05)] border border-[rgba(232,230,227,0.06)] text-[rgba(232,230,227,0.5)] px-4 py-2.5 rounded-md text-sm font-medium hover:bg-[rgba(232,230,227,0.08)] hover:text-[rgba(232,230,227,0.7)] transition-all"
                                    >
                                      Mark Request Sent
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-4 border-t border-[rgba(232,230,227,0.06)]">
                  <div className="text-sm text-[rgba(232,230,227,0.4)]">
                    Showing {((currentPage - 1) * PAGE_SIZE) + 1}-{Math.min(currentPage * PAGE_SIZE, filteredContacts.length)} of {filteredContacts.length}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded text-sm bg-[rgba(232,230,227,0.05)] text-[rgba(232,230,227,0.5)] hover:bg-[rgba(232,230,227,0.1)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number
                        if (totalPages <= 5) {
                          pageNum = i + 1
                        } else if (currentPage <= 3) {
                          pageNum = i + 1
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i
                        } else {
                          pageNum = currentPage - 2 + i
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`w-8 h-8 rounded text-sm transition-colors ${
                              currentPage === pageNum
                                ? 'bg-[#D4A574] text-[#1a1d21] font-medium'
                                : 'bg-[rgba(232,230,227,0.05)] text-[rgba(232,230,227,0.5)] hover:bg-[rgba(232,230,227,0.1)]'
                            }`}
                          >
                            {pageNum}
                          </button>
                        )
                      })}
                    </div>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 rounded text-sm bg-[rgba(232,230,227,0.05)] text-[rgba(232,230,227,0.5)] hover:bg-[rgba(232,230,227,0.1)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="mt-10 text-center text-[11px] text-[rgba(232,230,227,0.25)] uppercase tracking-[0.1em]">
          Kith AI Lab
        </div>
      </main>
    </div>
  )
}
