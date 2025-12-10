import { useState, useEffect } from 'react';
import { Building2, Search, Plus, Edit2, Trash2, Users, Award, Eye, X, Save, Merge, CheckSquare, Square, AlertTriangle } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Notification from '../components/Notification';
import { useAuth } from '../contexts/AuthContext';
import {
  getOpenCourseCompanies,
  createOpenCourseCompany,
  updateOpenCourseCompany,
  deleteOpenCourseCompany,
  getMergePreview,
  mergeCompanies,
  OpenCourseCompanyWithStats,
  MergePreview,
} from '../lib/open-course-companies';

interface OpenCourseCompaniesListProps {
  currentPage: string;
  onNavigate: (page: string, data?: any) => void;
}

type NotificationState = {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
} | null;

type SortField = 'name' | 'delegates' | 'certificates';
type SortDirection = 'asc' | 'desc';

export default function OpenCourseCompaniesList({ currentPage, onNavigate }: OpenCourseCompaniesListProps) {
  const { profile } = useAuth();
  const [companies, setCompanies] = useState<OpenCourseCompanyWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<NotificationState>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  // Sorting
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<OpenCourseCompanyWithStats | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    contact_name: '',
    email: '',
    telephone: '',
    address1: '',
    address2: '',
    town: '',
    postcode: '',
    notes: '',
    active: true,
  });
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingCompany, setDeletingCompany] = useState<OpenCourseCompanyWithStats | null>(null);

  // Multi-select and merge
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set());
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergePreview, setMergePreview] = useState<MergePreview | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string>('');
  const [mergeFieldSelections, setMergeFieldSelections] = useState<Record<string, string>>({});
  const [merging, setMerging] = useState(false);
  const [loadingMergePreview, setLoadingMergePreview] = useState(false);

  // Check if user can merge (admin or super admin)
  const canMerge = profile?.role === 'admin' || profile?.super_admin;

  useEffect(() => {
    loadCompanies();
  }, [showInactive]);

  async function loadCompanies() {
    setLoading(true);
    try {
      const data = await getOpenCourseCompanies({
        activeOnly: !showInactive,
      });
      setCompanies(data);
    } catch (error) {
      console.error('Error loading companies:', error);
      setNotification({ type: 'error', message: 'Failed to load companies' });
    } finally {
      setLoading(false);
    }
  }

  function handleAddCompany() {
    setEditingCompany(null);
    setFormData({
      name: '',
      contact_name: '',
      email: '',
      telephone: '',
      address1: '',
      address2: '',
      town: '',
      postcode: '',
      notes: '',
      active: true,
    });
    setShowModal(true);
  }

  function handleEditCompany(company: OpenCourseCompanyWithStats) {
    setEditingCompany(company);
    setFormData({
      name: company.name,
      contact_name: company.contact_name || '',
      email: company.email || '',
      telephone: company.telephone || '',
      address1: company.address1 || '',
      address2: company.address2 || '',
      town: company.town || '',
      postcode: company.postcode || '',
      notes: company.notes || '',
      active: company.active,
    });
    setShowModal(true);
  }

  async function handleSaveCompany() {
    if (!formData.name.trim()) {
      setNotification({ type: 'warning', message: 'Company name is required' });
      return;
    }

    setSaving(true);

    try {
      const companyData = {
        name: formData.name.trim(),
        contact_name: formData.contact_name.trim() || null,
        email: formData.email.trim() || null,
        telephone: formData.telephone.trim() || null,
        address1: formData.address1.trim() || null,
        address2: formData.address2.trim() || null,
        town: formData.town.trim() || null,
        postcode: formData.postcode.trim() || null,
        notes: formData.notes.trim() || null,
        active: formData.active,
      };

      if (editingCompany) {
        await updateOpenCourseCompany(editingCompany.id, companyData);
        setNotification({ type: 'success', message: 'Company updated successfully' });
      } else {
        await createOpenCourseCompany(companyData);
        setNotification({ type: 'success', message: 'Company created successfully' });
      }

      setShowModal(false);
      loadCompanies();
    } catch (error) {
      console.error('Error saving company:', error);
      setNotification({ type: 'error', message: 'Failed to save company' });
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteClick(company: OpenCourseCompanyWithStats) {
    setDeletingCompany(company);
    setShowDeleteConfirm(true);
  }

  async function handleConfirmDelete() {
    if (!deletingCompany) return;

    try {
      await deleteOpenCourseCompany(deletingCompany.id);
      setNotification({ type: 'success', message: 'Company deleted successfully' });
      setShowDeleteConfirm(false);
      setDeletingCompany(null);
      loadCompanies();
    } catch (error) {
      console.error('Error deleting company:', error);
      setNotification({ type: 'error', message: 'Failed to delete company' });
    }
  }

  function handleViewCompany(company: OpenCourseCompanyWithStats) {
    onNavigate('open-courses-company-details', { companyId: company.id });
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

  // Multi-select handlers
  function toggleCompanySelection(companyId: string) {
    setSelectedCompanyIds(prev => {
      const next = new Set(prev);
      if (next.has(companyId)) {
        next.delete(companyId);
      } else {
        next.add(companyId);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    const filteredIds = filteredCompanies.map(c => c.id);
    const allSelected = filteredIds.every(id => selectedCompanyIds.has(id));

    if (allSelected) {
      setSelectedCompanyIds(new Set());
    } else {
      setSelectedCompanyIds(new Set(filteredIds));
    }
  }

  function clearSelection() {
    setSelectedCompanyIds(new Set());
  }

  // Merge handlers
  async function handleStartMerge() {
    if (selectedCompanyIds.size < 2) {
      setNotification({ type: 'warning', message: 'Select at least 2 companies to merge' });
      return;
    }

    setLoadingMergePreview(true);

    try {
      const preview = await getMergePreview(Array.from(selectedCompanyIds));

      if (!preview) {
        setNotification({ type: 'error', message: 'Failed to generate merge preview' });
        return;
      }

      setMergePreview(preview);
      setMergeTargetId(preview.targetCompany.id);

      // Initialize field selections with target company values
      const initialSelections: Record<string, string> = {};
      for (const conflict of preview.conflictingFields) {
        // Default to target company's value if it has one, otherwise first non-null value
        const targetValue = conflict.values.find(v => v.companyId === preview.targetCompany.id);
        if (targetValue) {
          initialSelections[conflict.field] = preview.targetCompany.id;
        } else {
          initialSelections[conflict.field] = conflict.values[0].companyId;
        }
      }
      setMergeFieldSelections(initialSelections);

      setShowMergeModal(true);
    } catch (error) {
      console.error('Error generating merge preview:', error);
      setNotification({ type: 'error', message: 'Failed to generate merge preview' });
    } finally {
      setLoadingMergePreview(false);
    }
  }

  async function handleConfirmMerge() {
    if (!mergePreview || !mergeTargetId) return;

    setMerging(true);

    try {
      const sourceCompanyIds = Array.from(selectedCompanyIds).filter(id => id !== mergeTargetId);

      await mergeCompanies({
        targetCompanyId: mergeTargetId,
        sourceCompanyIds,
        fieldSelections: mergeFieldSelections,
      });

      setNotification({
        type: 'success',
        message: `Successfully merged ${sourceCompanyIds.length + 1} companies into "${mergePreview.targetCompany.name}"`,
      });

      setShowMergeModal(false);
      setMergePreview(null);
      setSelectedCompanyIds(new Set());
      loadCompanies();
    } catch (error) {
      console.error('Error merging companies:', error);
      setNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to merge companies',
      });
    } finally {
      setMerging(false);
    }
  }

  function handleMergeTargetChange(newTargetId: string) {
    if (!mergePreview) return;

    setMergeTargetId(newTargetId);

    // Re-evaluate field selections when target changes
    const newSelections: Record<string, string> = {};
    for (const conflict of mergePreview.conflictingFields) {
      const currentSelection = mergeFieldSelections[conflict.field];
      // Keep current selection if still valid, otherwise default to new target or first value
      if (conflict.values.some(v => v.companyId === currentSelection)) {
        newSelections[conflict.field] = currentSelection;
      } else {
        const targetValue = conflict.values.find(v => v.companyId === newTargetId);
        newSelections[conflict.field] = targetValue ? newTargetId : conflict.values[0].companyId;
      }
    }
    setMergeFieldSelections(newSelections);
  }

  function getFilteredAndSortedCompanies() {
    let filtered = companies;

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(term) ||
        c.contact_name?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term)
      );
    }

    // Sort
    return [...filtered].sort((a, b) => {
      let aVal: any, bVal: any;

      switch (sortField) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'delegates':
          aVal = a.delegate_count;
          bVal = b.delegate_count;
          break;
        case 'certificates':
          aVal = a.certificates_issued;
          bVal = b.certificates_issued;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const filteredCompanies = getFilteredAndSortedCompanies();

  return (
    <div className="min-h-screen bg-slate-950">
      <PageHeader
        title="Open Course Companies"
        icon={Building2}
        currentPage={currentPage}
        onNavigate={onNavigate}
      />

      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header Actions */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search companies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-80 bg-slate-900 border border-slate-700 rounded text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-400">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"
              />
              Show Inactive
            </label>
          </div>

          <button
            onClick={handleAddCompany}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Company
          </button>
        </div>

        {/* Selection Bar */}
        {selectedCompanyIds.size > 0 && (
          <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/30 rounded-lg px-4 py-3 mb-6">
            <div className="flex items-center gap-4">
              <span className="text-blue-400 font-medium">
                {selectedCompanyIds.size} company{selectedCompanyIds.size !== 1 ? 'ies' : ''} selected
              </span>
              <button
                onClick={clearSelection}
                className="text-sm text-slate-400 hover:text-white transition-colors"
              >
                Clear selection
              </button>
            </div>
            <div className="flex items-center gap-3">
              {canMerge && selectedCompanyIds.size >= 2 && (
                <button
                  onClick={handleStartMerge}
                  disabled={loadingMergePreview}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
                >
                  <Merge className="w-4 h-4" />
                  {loadingMergePreview ? 'Loading...' : 'Merge Companies'}
                </button>
              )}
              {!canMerge && selectedCompanyIds.size >= 2 && (
                <span className="text-sm text-slate-500">
                  Admin access required to merge
                </span>
              )}
            </div>
          </div>
        )}

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded">
                <Building2 className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <div className="text-2xl font-semibold text-white">{filteredCompanies.length}</div>
                <div className="text-sm text-slate-400">Companies</div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded">
                <Users className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <div className="text-2xl font-semibold text-white">
                  {filteredCompanies.reduce((sum, c) => sum + c.delegate_count, 0)}
                </div>
                <div className="text-sm text-slate-400">Total Delegates</div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded">
                <Award className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <div className="text-2xl font-semibold text-white">
                  {filteredCompanies.reduce((sum, c) => sum + c.certificates_issued, 0)}
                </div>
                <div className="text-sm text-slate-400">Certificates Issued</div>
              </div>
            </div>
          </div>
        </div>

        {/* Companies Table */}
        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading companies...</div>
        ) : filteredCompanies.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Building2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>No companies found</p>
            <button
              onClick={handleAddCompany}
              className="mt-4 text-blue-400 hover:text-blue-300"
            >
              Add your first company
            </button>
          </div>
        ) : (
          <div className="bg-slate-900/50 rounded-lg border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-900 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3 w-12">
                      <button
                        onClick={toggleSelectAll}
                        className="text-slate-400 hover:text-white transition-colors"
                        title={filteredCompanies.every(c => selectedCompanyIds.has(c.id)) ? 'Deselect all' : 'Select all'}
                      >
                        {filteredCompanies.length > 0 && filteredCompanies.every(c => selectedCompanyIds.has(c.id)) ? (
                          <CheckSquare className="w-5 h-5 text-blue-400" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white"
                      onClick={() => handleSort('name')}
                    >
                      Company Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Contact
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white"
                      onClick={() => handleSort('delegates')}
                    >
                      Delegates {sortField === 'delegates' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Courses
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white"
                      onClick={() => handleSort('certificates')}
                    >
                      Certificates {sortField === 'certificates' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredCompanies.map((company) => (
                    <tr
                      key={company.id}
                      className={`hover:bg-slate-800/50 cursor-pointer ${selectedCompanyIds.has(company.id) ? 'bg-blue-500/10' : ''}`}
                      onClick={() => handleViewCompany(company)}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => toggleCompanySelection(company.id)}
                          className="text-slate-400 hover:text-white transition-colors"
                        >
                          {selectedCompanyIds.has(company.id) ? (
                            <CheckSquare className="w-5 h-5 text-blue-400" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-white font-medium">{company.name}</div>
                        {company.town && (
                          <div className="text-sm text-slate-400">{company.town}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-sm">
                        {company.contact_name && (
                          <div>{company.contact_name}</div>
                        )}
                        {company.email && (
                          <div className="text-slate-400">{company.email}</div>
                        )}
                        {!company.contact_name && !company.email && (
                          <span className="text-slate-500">No contact info</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded">
                          <Users className="w-3 h-3" />
                          {company.delegate_count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-sm">
                        {company.courses_completed}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-green-500/20 text-green-400 border border-green-500/30 rounded">
                          <Award className="w-3 h-3" />
                          {company.certificates_issued}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded ${
                          company.active
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                        }`}>
                          {company.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleViewCompany(company)}
                            className="p-2 hover:bg-blue-500/20 text-blue-400 rounded transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEditCompany(company)}
                            className="p-2 hover:bg-slate-700 text-slate-400 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(company)}
                            className="p-2 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-lg border border-slate-800 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h2 className="text-xl font-semibold text-white">
                {editingCompany ? 'Edit Company' : 'Add Company'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-slate-800 rounded transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Company Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
                  placeholder="Company name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Contact Name</label>
                  <input
                    type="text"
                    value={formData.contact_name}
                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
                    placeholder="Contact name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Telephone</label>
                  <input
                    type="tel"
                    value={formData.telephone}
                    onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
                    placeholder="Phone number"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
                  placeholder="email@company.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Address Line 1</label>
                <input
                  type="text"
                  value={formData.address1}
                  onChange={(e) => setFormData({ ...formData, address1: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
                  placeholder="Address line 1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Address Line 2</label>
                <input
                  type="text"
                  value={formData.address2}
                  onChange={(e) => setFormData({ ...formData, address2: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
                  placeholder="Address line 2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Town/City</label>
                  <input
                    type="text"
                    value={formData.town}
                    onChange={(e) => setFormData({ ...formData, town: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
                    placeholder="Town or city"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Postcode</label>
                  <input
                    type="text"
                    value={formData.postcode}
                    onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
                    placeholder="Postcode"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
                  placeholder="Additional notes..."
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm text-slate-400">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"
                  />
                  Active
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSaveCompany}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Company'}
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deletingCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-lg border border-slate-800 max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Delete Company</h2>
              <p className="text-slate-300 mb-2">
                Are you sure you want to delete <strong>{deletingCompany.name}</strong>?
              </p>
              {deletingCompany.delegate_count > 0 && (
                <p className="text-yellow-400 text-sm mb-4">
                  This company has {deletingCompany.delegate_count} delegate(s). They will be unlinked from this company.
                </p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={handleConfirmDelete}
                  className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                >
                  Delete
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletingCompany(null);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Merge Companies Modal */}
      {showMergeModal && mergePreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-lg border border-slate-800 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded">
                  <Merge className="w-5 h-5 text-purple-400" />
                </div>
                <h2 className="text-xl font-semibold text-white">Merge Companies</h2>
              </div>
              <button
                onClick={() => {
                  setShowMergeModal(false);
                  setMergePreview(null);
                }}
                className="p-2 hover:bg-slate-800 rounded transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Warning Banner */}
              <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-yellow-400 font-medium">This action cannot be undone</p>
                  <p className="text-sm text-slate-400 mt-1">
                    Merging will move all delegates to the target company and permanently delete the other companies.
                  </p>
                </div>
              </div>

              {/* Delegate Impact Summary */}
              <div className="bg-slate-800/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
                  Delegates Affected
                </h3>
                <div className="text-3xl font-bold text-white mb-2">
                  {mergePreview.totalDelegatesAffected}
                </div>
                <p className="text-sm text-slate-400">
                  delegates will be assigned to the merged company
                </p>
              </div>

              {/* Target Company Selection */}
              <div>
                <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
                  Select Target Company
                </h3>
                <p className="text-sm text-slate-500 mb-3">
                  All delegates will be moved to this company. Other companies will be deleted.
                </p>
                <div className="space-y-2">
                  {[mergePreview.targetCompany, ...mergePreview.sourceCompanies].map(company => (
                    <label
                      key={company.id}
                      className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${
                        mergeTargetId === company.id
                          ? 'bg-purple-500/20 border-purple-500/50'
                          : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="mergeTarget"
                          checked={mergeTargetId === company.id}
                          onChange={() => handleMergeTargetChange(company.id)}
                          className="text-purple-500 focus:ring-purple-500"
                        />
                        <div>
                          <div className="text-white font-medium">{company.name}</div>
                          {company.town && (
                            <div className="text-sm text-slate-400">{company.town}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-blue-400">
                          <Users className="w-4 h-4 inline mr-1" />
                          {company.delegate_count}
                        </span>
                        <span className="text-green-400">
                          <Award className="w-4 h-4 inline mr-1" />
                          {company.certificates_issued}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Conflicting Fields Resolution */}
              {mergePreview.conflictingFields.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
                    Resolve Conflicting Information
                  </h3>
                  <p className="text-sm text-slate-500 mb-3">
                    These fields have different values across the selected companies. Choose which value to keep.
                  </p>
                  <div className="space-y-4">
                    {mergePreview.conflictingFields.map(conflict => (
                      <div key={conflict.field} className="bg-slate-800/50 rounded-lg p-4">
                        <label className="block text-sm font-medium text-white mb-2">
                          {conflict.label}
                        </label>
                        <div className="space-y-2">
                          {conflict.values.map(value => (
                            <label
                              key={value.companyId}
                              className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${
                                mergeFieldSelections[conflict.field] === value.companyId
                                  ? 'bg-blue-500/20 border-blue-500/50'
                                  : 'bg-slate-900/50 border-slate-700 hover:border-slate-600'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`field-${conflict.field}`}
                                checked={mergeFieldSelections[conflict.field] === value.companyId}
                                onChange={() => setMergeFieldSelections(prev => ({
                                  ...prev,
                                  [conflict.field]: value.companyId,
                                }))}
                                className="text-blue-500 focus:ring-blue-500"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-white truncate">{value.value}</div>
                                <div className="text-xs text-slate-500">from {value.companyName}</div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="bg-slate-800/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
                  Summary
                </h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2 text-slate-300">
                    <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                    Keep: <strong className="text-white">
                      {[mergePreview.targetCompany, ...mergePreview.sourceCompanies].find(c => c.id === mergeTargetId)?.name}
                    </strong>
                  </li>
                  <li className="flex items-center gap-2 text-slate-300">
                    <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                    Delete: <strong className="text-white">
                      {[mergePreview.targetCompany, ...mergePreview.sourceCompanies]
                        .filter(c => c.id !== mergeTargetId)
                        .map(c => c.name)
                        .join(', ')}
                    </strong>
                  </li>
                  <li className="flex items-center gap-2 text-slate-300">
                    <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                    Move: <strong className="text-white">{mergePreview.totalDelegatesAffected} delegates</strong>
                  </li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-slate-800">
                <button
                  onClick={handleConfirmMerge}
                  disabled={merging}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
                >
                  <Merge className="w-4 h-4" />
                  {merging ? 'Merging...' : 'Confirm Merge'}
                </button>
                <button
                  onClick={() => {
                    setShowMergeModal(false);
                    setMergePreview(null);
                  }}
                  disabled={merging}
                  className="px-4 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
