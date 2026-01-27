'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { supabase, Contact } from '@/lib/supabase'

type StatusFilter = 'all' | 'hot' | 'sql' | 'mql' | 'nurture'
type AssigneeFilter = 'all' | 'diego' | 'unassigned'

export default function Dashboard() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetchContacts()
  }, [statusFilter, assigneeFilter])

  async function fetchContacts() {
    setLoading(true)

    let query = supabase
      .from('contact_engagement_summary')
      .select('*')
      .order('total_score', { ascending: false })

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    if (assigneeFilter === 'unassigned') {
      query = query.is('assigned_to', null)
    } else if (assigneeFilter !== 'all') {
      query = query.eq('assigned_to', assigneeFilter)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching contacts:', error)
    } else {
      setContacts(data || [])
    }
    setLoading(false)
  }

  async function claimLead(contactId: string, assignee: string) {
    const { error } = await supabase
      .from('linkedin_contacts')
      .update({ assigned_to: assignee })
      .eq('id', contactId)

    if (error) {
      console.error('Error claiming lead:', error)
    } else {
      fetchContacts()
    }
  }

  async function unclaimLead(contactId: string) {
    const { error } = await supabase
      .from('linkedin_contacts')
      .update({ assigned_to: null })
      .eq('id', contactId)

    if (error) {
      console.error('Error unclaiming lead:', error)
    } else {
      fetchContacts()
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'hot': return 'bg-red-100 text-red-800 border-red-200'
      case 'sql': return 'bg-amber-100 text-amber-800 border-amber-200'
      case 'mql': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'nurture': return 'bg-stone-100 text-stone-600 border-stone-200'
      default: return 'bg-stone-100 text-stone-600 border-stone-200'
    }
  }

  function getStatusCardStyle(status: string) {
    switch (status) {
      case 'hot': return 'border-red-200 bg-red-50'
      case 'sql': return 'border-amber-200 bg-amber-50'
      case 'mql': return 'border-yellow-200 bg-yellow-50'
      case 'nurture': return 'border-stone-200 bg-stone-50'
      default: return 'border-stone-200 bg-white'
    }
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Image
              src="/logo.svg"
              alt="Kith AI Lab"
              width={160}
              height={27}
              priority
            />
            <div className="h-6 w-px bg-stone-300" />
            <span className="text-stone-500 font-medium">LinkedIn CRM</span>
          </div>
          <button
            onClick={fetchContacts}
            className="bg-kith-accent text-white px-4 py-2 rounded-lg hover:bg-kith-accent-dark transition-colors font-medium"
          >
            Refresh
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-8">
        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="border border-stone-300 rounded-lg px-3 py-2 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#D4A574] focus:border-transparent"
            >
              <option value="all">All</option>
              <option value="hot">Hot</option>
              <option value="sql">SQL</option>
              <option value="mql">MQL</option>
              <option value="nurture">Nurture</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Assigned To</label>
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value as AssigneeFilter)}
              className="border border-stone-300 rounded-lg px-3 py-2 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#D4A574] focus:border-transparent"
            >
              <option value="all">All</option>
              <option value="diego">Diego</option>
              <option value="unassigned">Unassigned</option>
            </select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {['hot', 'sql', 'mql', 'nurture'].map((status) => {
            const count = contacts.filter(c => c.status === status).length
            return (
              <div key={status} className={`rounded-lg p-4 border ${getStatusCardStyle(status)}`}>
                <div className="text-sm font-medium text-stone-500 uppercase tracking-wide">{status}</div>
                <div className="text-3xl font-bold text-stone-900 mt-1">{count}</div>
              </div>
            )
          })}
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm border border-stone-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-stone-500">Loading...</div>
          ) : contacts.length === 0 ? (
            <div className="p-8 text-center text-stone-500">No contacts found</div>
          ) : (
            <table className="w-full">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-stone-600">Name</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-stone-600">Title</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-stone-600">Company</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-stone-600">Score</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-stone-600">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-stone-600">Assigned</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-stone-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <>
                    <tr
                      key={contact.id}
                      className="border-b border-stone-100 hover:bg-stone-50 cursor-pointer transition-colors"
                      onClick={() => setExpandedId(expandedId === contact.id ? null : contact.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-stone-900">{contact.name}</div>
                      </td>
                      <td className="px-4 py-3 text-stone-600">{contact.title || '-'}</td>
                      <td className="px-4 py-3 text-stone-600">{contact.company_name || '-'}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-stone-900">{contact.total_score}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(contact.status)}`}>
                          {contact.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-stone-600">{contact.assigned_to || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-3" onClick={(e) => e.stopPropagation()}>
                          {contact.linkedin_url && (
                            <a
                              href={contact.linkedin_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#0A66C2] hover:text-[#004182] text-sm font-medium"
                            >
                              LinkedIn
                            </a>
                          )}
                          {!contact.assigned_to ? (
                            <button
                              onClick={() => claimLead(contact.id, 'diego')}
                              className="text-[#D4A574] hover:text-[#b8895a] text-sm font-medium"
                            >
                              Claim
                            </button>
                          ) : (
                            <button
                              onClick={() => unclaimLead(contact.id)}
                              className="text-stone-400 hover:text-stone-600 text-sm font-medium"
                            >
                              Unclaim
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedId === contact.id && (
                      <tr key={`${contact.id}-expanded`} className="bg-stone-50">
                        <td colSpan={7} className="px-4 py-5">
                          <div className="grid grid-cols-3 gap-8">
                            <div>
                              <h4 className="font-semibold text-stone-900 mb-3 flex items-center gap-2">
                                <span className="w-1 h-4 bg-[#D4A574] rounded-full"></span>
                                Score Breakdown
                              </h4>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-stone-600">Firmographic</span>
                                  <span className="font-mono font-medium">{contact.firmographic_score}/40</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-stone-600">Title</span>
                                  <span className="font-mono font-medium">{contact.title_score}/25</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-stone-600">Engagement</span>
                                  <span className="font-mono font-medium">{contact.engagement_score}/35</span>
                                </div>
                                <div className="flex justify-between font-semibold border-t border-stone-200 pt-2 mt-2">
                                  <span className="text-stone-900">Total</span>
                                  <span className="font-mono text-[#D4A574]">{contact.total_score}/100</span>
                                </div>
                              </div>
                            </div>
                            <div>
                              <h4 className="font-semibold text-stone-900 mb-3 flex items-center gap-2">
                                <span className="w-1 h-4 bg-[#D4A574] rounded-full"></span>
                                Company Info
                              </h4>
                              <div className="space-y-2 text-sm">
                                <div><span className="text-stone-500">Employees:</span> <span className="text-stone-900">{contact.employee_count || '-'}</span></div>
                                <div><span className="text-stone-500">Industry:</span> <span className="text-stone-900">{contact.industry || '-'}</span></div>
                                <div><span className="text-stone-500">Product Interest:</span> <span className="text-stone-900">{contact.product_interest || '-'}</span></div>
                              </div>
                            </div>
                            <div>
                              <h4 className="font-semibold text-stone-900 mb-3 flex items-center gap-2">
                                <span className="w-1 h-4 bg-[#D4A574] rounded-full"></span>
                                Notes
                              </h4>
                              <p className="text-sm text-stone-600">{contact.notes || 'No notes yet'}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-stone-400">
          Kith AI Lab &middot; LinkedIn CRM
        </div>
      </main>
    </div>
  )
}
