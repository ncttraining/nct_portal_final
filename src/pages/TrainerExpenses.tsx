import { useState, useEffect } from 'react';
import { DollarSign, Plus, X, Save, Eye, Check, XCircle, Clock, FileText, Edit2 } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Notification from '../components/Notification';
import {
  getCurrentTrainer,
  getExpenseClaims,
  getExpenseClaimWithJourneys,
  createExpenseClaim,
  addJourney,
  deleteJourney,
  updateJourney,
  updateExpenseClaim,
  submitExpenseClaim,
  updateClaimStatus,
  formatCurrency,
  formatDate,
  getStatusBadgeColor,
  getEngineSizeLabel,
  calculateMileageRate,
  type ExpenseClaim,
  type Journey,
  type FuelType,
  type EngineSize,
  type ClaimStatus,
  type Trainer
} from '../lib/expenses';

interface TrainerExpensesProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  userRole: string;
  canManageBookings: boolean;
  canManageExpenses?: boolean;
}

type NotificationState = {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
} | null;

export default function TrainerExpenses({ currentPage, onNavigate, userRole, canManageBookings, canManageExpenses = false }: TrainerExpensesProps) {
  const [trainer, setTrainer] = useState<Trainer | null>(null);
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<NotificationState>(null);

  const [showNewClaimModal, setShowNewClaimModal] = useState(false);
  const [showViewClaimModal, setShowViewClaimModal] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<ExpenseClaim | null>(null);
  const [editingClaim, setEditingClaim] = useState(false);
  const [editingJourney, setEditingJourney] = useState<string | null>(null);

  const [newClaimForm, setNewClaimForm] = useState({
    vehicle_registration: '',
    fuel_type: 'petrol' as FuelType,
    engine_size: '1400cc_or_less' as EngineSize
  });

  const [editClaimForm, setEditClaimForm] = useState({
    vehicle_registration: '',
    fuel_type: 'petrol' as FuelType,
    engine_size: '1400cc_or_less' as EngineSize
  });

  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [newJourney, setNewJourney] = useState({
    journey_date: new Date().toISOString().split('T')[0],
    origin: '',
    destination: '',
    miles: '',
    tolls_parking: ''
  });

  const [editJourneyForm, setEditJourneyForm] = useState({
    journey_date: '',
    origin: '',
    destination: '',
    miles: '',
    tolls_parking: ''
  });

  const isAdmin = userRole === 'admin' || canManageBookings;

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const currentTrainer = await getCurrentTrainer();
      setTrainer(currentTrainer);

      if (isAdmin) {
        const claimsData = await getExpenseClaims();
        setClaims(claimsData);
      } else if (currentTrainer) {
        const claimsData = await getExpenseClaims(currentTrainer.id);
        setClaims(claimsData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setNotification({ type: 'error', message: 'Failed to load expense claims' });
    }
    setLoading(false);
  }

  async function handleCreateClaim() {
    if (!trainer) {
      setNotification({ type: 'error', message: 'Trainer information not found' });
      return;
    }

    if (!newClaimForm.vehicle_registration.trim()) {
      setNotification({ type: 'error', message: 'Please enter vehicle registration' });
      return;
    }

    try {
      const claimId = await createExpenseClaim({
        trainer_id: trainer.id,
        trainer_name: trainer.name,
        vehicle_registration: newClaimForm.vehicle_registration.toUpperCase(),
        fuel_type: newClaimForm.fuel_type,
        engine_size: newClaimForm.engine_size
      });

      if (claimId) {
        setNotification({ type: 'success', message: 'Expense claim created successfully' });
        setNewClaimForm({
          vehicle_registration: '',
          fuel_type: 'petrol',
          engine_size: '1400cc_or_less'
        });
        setShowNewClaimModal(false);
        await loadData();

        const claim = await getExpenseClaimWithJourneys(claimId);
        if (claim) {
          setSelectedClaim(claim);
          setJourneys(claim.journeys || []);
          setEditClaimForm({
            vehicle_registration: claim.vehicle_registration,
            fuel_type: claim.fuel_type,
            engine_size: claim.engine_size
          });
          setShowViewClaimModal(true);
        }
      }
    } catch (error) {
      console.error('Error creating claim:', error);
      setNotification({ type: 'error', message: 'Failed to create expense claim' });
    }
  }

  async function handleViewClaim(claim: ExpenseClaim) {
    try {
      const claimWithJourneys = await getExpenseClaimWithJourneys(claim.id);
      if (claimWithJourneys) {
        setSelectedClaim(claimWithJourneys);
        setJourneys(claimWithJourneys.journeys || []);
        setEditClaimForm({
          vehicle_registration: claimWithJourneys.vehicle_registration,
          fuel_type: claimWithJourneys.fuel_type,
          engine_size: claimWithJourneys.engine_size
        });
        setEditingClaim(false);
        setEditingJourney(null);
        setShowViewClaimModal(true);
      }
    } catch (error) {
      console.error('Error loading claim details:', error);
      setNotification({ type: 'error', message: 'Failed to load claim details' });
    }
  }

  async function handleSaveClaimEdit() {
    if (!selectedClaim) return;

    try {
      await updateExpenseClaim(selectedClaim.id, editClaimForm);
      setNotification({ type: 'success', message: 'Claim updated successfully' });
      setEditingClaim(false);

      const updatedClaim = await getExpenseClaimWithJourneys(selectedClaim.id);
      if (updatedClaim) {
        setSelectedClaim(updatedClaim);
      }
      await loadData();
    } catch (error) {
      console.error('Error updating claim:', error);
      setNotification({ type: 'error', message: 'Failed to update claim' });
    }
  }

  function handleStartEditJourney(journey: Journey) {
    setEditingJourney(journey.id);
    setEditJourneyForm({
      journey_date: journey.journey_date,
      origin: journey.origin,
      destination: journey.destination,
      miles: journey.miles.toString(),
      tolls_parking: journey.tolls_parking.toString()
    });
  }

  async function handleSaveJourneyEdit(journeyId: string) {
    if (!editJourneyForm.origin.trim() || !editJourneyForm.destination.trim()) {
      setNotification({ type: 'error', message: 'Please enter origin and destination' });
      return;
    }

    if (!editJourneyForm.miles || parseFloat(editJourneyForm.miles) <= 0) {
      setNotification({ type: 'error', message: 'Please enter valid miles' });
      return;
    }

    try {
      await updateJourney(journeyId, {
        journey_date: editJourneyForm.journey_date,
        origin: editJourneyForm.origin,
        destination: editJourneyForm.destination,
        miles: parseFloat(editJourneyForm.miles),
        tolls_parking: parseFloat(editJourneyForm.tolls_parking) || 0
      });

      setNotification({ type: 'success', message: 'Journey updated successfully' });
      setEditingJourney(null);

      if (selectedClaim) {
        const updatedClaim = await getExpenseClaimWithJourneys(selectedClaim.id);
        if (updatedClaim) {
          setSelectedClaim(updatedClaim);
          setJourneys(updatedClaim.journeys || []);
        }
      }
      await loadData();
    } catch (error) {
      console.error('Error updating journey:', error);
      setNotification({ type: 'error', message: 'Failed to update journey' });
    }
  }

  async function handleAddJourney() {
    if (!selectedClaim) return;

    if (!newJourney.origin.trim() || !newJourney.destination.trim()) {
      setNotification({ type: 'error', message: 'Please enter origin and destination' });
      return;
    }

    if (!newJourney.miles || parseFloat(newJourney.miles) <= 0) {
      setNotification({ type: 'error', message: 'Please enter valid miles' });
      return;
    }

    try {
      await addJourney({
        expense_claim_id: selectedClaim.id,
        journey_date: newJourney.journey_date,
        origin: newJourney.origin,
        destination: newJourney.destination,
        miles: parseFloat(newJourney.miles),
        tolls_parking: parseFloat(newJourney.tolls_parking) || 0
      });

      setNotification({ type: 'success', message: 'Journey added successfully' });
      setNewJourney({
        journey_date: new Date().toISOString().split('T')[0],
        origin: '',
        destination: '',
        miles: '',
        tolls_parking: ''
      });

      const updatedClaim = await getExpenseClaimWithJourneys(selectedClaim.id);
      if (updatedClaim) {
        setSelectedClaim(updatedClaim);
        setJourneys(updatedClaim.journeys || []);
      }
      await loadData();
    } catch (error) {
      console.error('Error adding journey:', error);
      setNotification({ type: 'error', message: 'Failed to add journey' });
    }
  }

  async function handleDeleteJourney(journeyId: string) {
    if (!selectedClaim) return;
    if (!confirm('Are you sure you want to delete this journey?')) return;

    try {
      await deleteJourney(journeyId);
      setNotification({ type: 'success', message: 'Journey deleted successfully' });

      const updatedClaim = await getExpenseClaimWithJourneys(selectedClaim.id);
      if (updatedClaim) {
        setSelectedClaim(updatedClaim);
        setJourneys(updatedClaim.journeys || []);
      }
      await loadData();
    } catch (error) {
      console.error('Error deleting journey:', error);
      setNotification({ type: 'error', message: 'Failed to delete journey' });
    }
  }

  async function handleSubmitClaim() {
    if (!selectedClaim) return;

    if (journeys.length === 0) {
      setNotification({ type: 'error', message: 'Please add at least one journey before submitting' });
      return;
    }

    if (!confirm('Are you sure you want to submit this expense claim?')) return;

    try {
      await submitExpenseClaim(selectedClaim.id);
      setNotification({ type: 'success', message: 'Expense claim submitted successfully' });
      setShowViewClaimModal(false);
      await loadData();
    } catch (error) {
      console.error('Error submitting claim:', error);
      setNotification({ type: 'error', message: 'Failed to submit expense claim' });
    }
  }

  async function handleUpdateStatus(claimId: string, status: ClaimStatus) {
    try {
      await updateClaimStatus(claimId, status);
      setNotification({ type: 'success', message: `Claim ${status} successfully` });
      setShowViewClaimModal(false);
      await loadData();
    } catch (error) {
      console.error('Error updating claim status:', error);
      setNotification({ type: 'error', message: 'Failed to update claim status' });
    }
  }

  const canEditClaim = selectedClaim && selectedClaim.status === 'pending' && !isAdmin;

  if (!canManageExpenses && !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors">
        <PageHeader
          icon={DollarSign}
          title="Travel Expenses"
          description="Manage your travel expense claims"
          currentPage={currentPage}
          onNavigate={onNavigate}
        />
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <p className="text-slate-600 dark:text-slate-400 text-lg mb-2">Access Denied</p>
            <p className="text-slate-500 dark:text-slate-400">You do not have permission to manage expenses.</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors">
        <PageHeader
          icon={DollarSign}
          title="Travel Expenses"
          description="Manage your travel expense claims"
          currentPage={currentPage}
          onNavigate={onNavigate}
        />
        <div className="flex justify-center items-center h-64">
          <div className="text-slate-500 dark:text-slate-400">Loading...</div>
        </div>
      </div>
    );
  }

  if (!trainer && !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors">
        <PageHeader
          icon={DollarSign}
          title="Travel Expenses"
          description="Manage your travel expense claims"
          currentPage={currentPage}
          onNavigate={onNavigate}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
            <p className="text-yellow-800 dark:text-yellow-400">
              No trainer profile found. Please contact an administrator.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors">
      <PageHeader
        icon={DollarSign}
        title="Travel Expenses"
        description={isAdmin ? 'Manage all travel expense claims' : trainer ? `Manage travel expense claims for ${trainer.name}` : 'Manage travel expense claims'}
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Expense Claims</h2>
          {trainer && !isAdmin && (
            <button
              onClick={() => setShowNewClaimModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              New Claim
            </button>
          )}
        </div>

        {claims.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow p-8 text-center">
            <DollarSign className="w-16 h-16 text-slate-400 dark:text-slate-500 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-slate-400 mb-4">No expense claims yet</p>
            {trainer && !isAdmin && (
              <button
                onClick={() => setShowNewClaimModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Your First Claim
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  {isAdmin && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Trainer
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Vehicle
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Miles
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Total Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-700">
                {claims.map((claim) => (
                  <tr key={claim.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                    {isAdmin && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-white">
                        {claim.trainer_name}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-white">
                      {formatDate(claim.submission_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-white">
                      {claim.vehicle_registration}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-white">
                      {claim.total_miles.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">
                      {formatCurrency(claim.total_amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(claim.status)}`}>
                        {claim.status === 'pending' && <Clock className="w-3 h-3" />}
                        {claim.status === 'approved' && <Check className="w-3 h-3" />}
                        {claim.status === 'paid' && <Check className="w-3 h-3" />}
                        {claim.status === 'rejected' && <XCircle className="w-3 h-3" />}
                        {claim.status.charAt(0).toUpperCase() + claim.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleViewClaim(claim)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showNewClaimModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">New Expense Claim</h3>
              <button onClick={() => setShowNewClaimModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Vehicle Registration
                </label>
                <input
                  type="text"
                  value={newClaimForm.vehicle_registration}
                  onChange={(e) => setNewClaimForm({ ...newClaimForm, vehicle_registration: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="AB12 CDE"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Fuel Type
                </label>
                <div className="flex gap-4 text-slate-900 dark:text-white">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={newClaimForm.fuel_type === 'petrol'}
                      onChange={() => setNewClaimForm({ ...newClaimForm, fuel_type: 'petrol' })}
                      className="mr-2"
                    />
                    Petrol
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={newClaimForm.fuel_type === 'diesel'}
                      onChange={() => setNewClaimForm({ ...newClaimForm, fuel_type: 'diesel' })}
                      className="mr-2"
                    />
                    Diesel
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Engine Size
                </label>
                <select
                  value={newClaimForm.engine_size}
                  onChange={(e) => setNewClaimForm({ ...newClaimForm, engine_size: e.target.value as EngineSize })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="1400cc_or_less">1400cc or less</option>
                  <option value="1401cc_to_2000cc">1401cc to 2000cc</option>
                  <option value="over_2000cc">Over 2000cc</option>
                </select>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
                <p className="text-sm text-blue-900 dark:text-blue-400">
                  <strong>Mileage Rate:</strong> {formatCurrency(calculateMileageRate(newClaimForm.fuel_type, newClaimForm.engine_size))} per mile
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowNewClaimModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateClaim}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Claim
              </button>
            </div>
          </div>
        </div>
      )}

      {showViewClaimModal && selectedClaim && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Expense Claim Details</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Submitted {formatDate(selectedClaim.submission_date)}</p>
              </div>
              <button onClick={() => setShowViewClaimModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-lg relative">
                {canEditClaim && !editingClaim && (
                  <button
                    onClick={() => setEditingClaim(true)}
                    className="absolute top-2 right-2 text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 flex items-center gap-1 text-sm"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                )}
                {editingClaim ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Vehicle Registration</label>
                      <input
                        type="text"
                        value={editClaimForm.vehicle_registration}
                        onChange={(e) => setEditClaimForm({ ...editClaimForm, vehicle_registration: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fuel Type</label>
                      <div className="flex gap-4 text-slate-900 dark:text-white">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            checked={editClaimForm.fuel_type === 'petrol'}
                            onChange={() => setEditClaimForm({ ...editClaimForm, fuel_type: 'petrol' })}
                            className="mr-2"
                          />
                          Petrol
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            checked={editClaimForm.fuel_type === 'diesel'}
                            onChange={() => setEditClaimForm({ ...editClaimForm, fuel_type: 'diesel' })}
                            className="mr-2"
                          />
                          Diesel
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Engine Size</label>
                      <select
                        value={editClaimForm.engine_size}
                        onChange={(e) => setEditClaimForm({ ...editClaimForm, engine_size: e.target.value as EngineSize })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="1400cc_or_less">1400cc or less</option>
                        <option value="1401cc_to_2000cc">1401cc to 2000cc</option>
                        <option value="over_2000cc">Over 2000cc</option>
                      </select>
                    </div>
                    <div className="flex items-end gap-2">
                      <button
                        onClick={() => setEditingClaim(false)}
                        className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveClaimEdit}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        <Save className="w-4 h-4" />
                        Save
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="col-span-2 pb-4 border-b border-slate-200 dark:border-slate-700">
                      <p className="text-sm text-slate-500 dark:text-slate-400">Trainer Name</p>
                      <p className="text-lg font-semibold text-slate-900 dark:text-white">{selectedClaim.trainer_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Vehicle Registration</p>
                      <p className="font-medium text-slate-900 dark:text-white">{selectedClaim.vehicle_registration}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Fuel Type</p>
                      <p className="font-medium text-slate-900 dark:text-white capitalize">{selectedClaim.fuel_type}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Engine Size</p>
                      <p className="font-medium text-slate-900 dark:text-white">{getEngineSizeLabel(selectedClaim.engine_size)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Status</p>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(selectedClaim.status)}`}>
                        {selectedClaim.status.charAt(0).toUpperCase() + selectedClaim.status.slice(1)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {selectedClaim.status === 'pending' && !isAdmin && (
                <div className="mb-6">
                  <h4 className="text-md font-semibold text-slate-900 dark:text-white mb-3">Add Journey</h4>
                  <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-lg space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date</label>
                        <input
                          type="date"
                          value={newJourney.journey_date}
                          onChange={(e) => setNewJourney({ ...newJourney, journey_date: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Miles</label>
                        <input
                          type="number"
                          step="0.1"
                          value={newJourney.miles}
                          onChange={(e) => setNewJourney({ ...newJourney, miles: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                          placeholder="0.0"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">From (Origin)</label>
                      <input
                        type="text"
                        value={newJourney.origin}
                        onChange={(e) => setNewJourney({ ...newJourney, origin: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        placeholder="Starting location"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">To (Destination)</label>
                      <input
                        type="text"
                        value={newJourney.destination}
                        onChange={(e) => setNewJourney({ ...newJourney, destination: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        placeholder="Ending location"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tolls/Parking (£)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newJourney.tolls_parking}
                        onChange={(e) => setNewJourney({ ...newJourney, tolls_parking: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    </div>
                    <button
                      onClick={handleAddJourney}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Plus className="w-4 h-4" />
                      Add Journey
                    </button>
                  </div>
                </div>
              )}

              <div className="mb-6">
                <h4 className="text-md font-semibold text-slate-900 dark:text-white mb-3">Journeys</h4>
                {journeys.length === 0 ? (
                  <p className="text-slate-500 dark:text-slate-400 text-center py-4">No journeys added yet</p>
                ) : (
                  <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                      <thead className="bg-slate-50 dark:bg-slate-800">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Date</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">From/To</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Miles</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Tolls/Parking</th>
                          {canEditClaim && (
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-700">
                        {journeys.map((journey) => (
                          <tr key={journey.id}>
                            {editingJourney === journey.id ? (
                              <>
                                <td className="px-4 py-2">
                                  <input
                                    type="date"
                                    value={editJourneyForm.journey_date}
                                    onChange={(e) => setEditJourneyForm({ ...editJourneyForm, journey_date: e.target.value })}
                                    className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  <input
                                    type="text"
                                    value={editJourneyForm.origin}
                                    onChange={(e) => setEditJourneyForm({ ...editJourneyForm, origin: e.target.value })}
                                    className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white mb-1"
                                    placeholder="From"
                                  />
                                  <input
                                    type="text"
                                    value={editJourneyForm.destination}
                                    onChange={(e) => setEditJourneyForm({ ...editJourneyForm, destination: e.target.value })}
                                    className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
                                    placeholder="To"
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={editJourneyForm.miles}
                                    onChange={(e) => setEditJourneyForm({ ...editJourneyForm, miles: e.target.value })}
                                    className="w-20 px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editJourneyForm.tolls_parking}
                                    onChange={(e) => setEditJourneyForm({ ...editJourneyForm, tolls_parking: e.target.value })}
                                    className="w-20 px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleSaveJourneyEdit(journey.id)}
                                      className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300"
                                    >
                                      <Save className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => setEditingJourney(null)}
                                      className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-300"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="px-4 py-2 text-sm text-slate-900 dark:text-white">{formatDate(journey.journey_date)}</td>
                                <td className="px-4 py-2 text-sm text-slate-900 dark:text-white">
                                  <div>{journey.origin}</div>
                                  <div className="text-slate-500 dark:text-slate-400">→ {journey.destination}</div>
                                </td>
                                <td className="px-4 py-2 text-sm text-slate-900 dark:text-white">{journey.miles}</td>
                                <td className="px-4 py-2 text-sm text-slate-900 dark:text-white">{formatCurrency(journey.tolls_parking)}</td>
                                {canEditClaim && (
                                  <td className="px-4 py-2 text-sm">
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleStartEditJourney(journey)}
                                        className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteJourney(journey.id)}
                                        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                )}
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-6">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-blue-700 dark:text-blue-400">Total Miles</p>
                    <p className="text-lg font-semibold text-blue-900 dark:text-blue-300">{selectedClaim.total_miles.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-700 dark:text-blue-400">Tolls & Parking</p>
                    <p className="text-lg font-semibold text-blue-900 dark:text-blue-300">{formatCurrency(selectedClaim.total_tolls_parking)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-700 dark:text-blue-400">Total Amount</p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-300">{formatCurrency(selectedClaim.total_amount)}</p>
                  </div>
                </div>
              </div>

              {selectedClaim.notes && (
                <div className="mb-6">
                  <h4 className="text-md font-semibold text-slate-900 dark:text-white mb-2">Notes</h4>
                  <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-lg">
                    <p className="text-sm text-slate-700 dark:text-slate-300">{selectedClaim.notes}</p>
                  </div>
                </div>
              )}

              {selectedClaim.payment_date && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3 mb-6">
                  <p className="text-sm text-green-900 dark:text-green-400">
                    <strong>Paid on:</strong> {formatDate(selectedClaim.payment_date)}
                  </p>
                </div>
              )}

              <div className="flex gap-3 justify-end">
                {canEditClaim && (
                  <button
                    onClick={handleSubmitClaim}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <Check className="w-4 h-4" />
                    Submit Claim
                  </button>
                )}

                {isAdmin && selectedClaim.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleUpdateStatus(selectedClaim.id, 'approved')}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Check className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedClaim.id, 'rejected')}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                  </>
                )}

                {isAdmin && selectedClaim.status === 'approved' && (
                  <button
                    onClick={() => handleUpdateStatus(selectedClaim.id, 'paid')}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <Check className="w-4 h-4" />
                    Mark as Paid
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
