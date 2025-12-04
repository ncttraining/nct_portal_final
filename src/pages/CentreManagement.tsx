import { useState, useEffect } from 'react';
import { Building, Plus, Edit2, Trash2, GripVertical, Save, X, AlertCircle } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { supabase } from '../lib/supabase';
import { getTrainingCentres, getRoomsForCentre, TrainingCentre, TrainingCentreRoom } from '../lib/training-centres';
import Notification from '../components/Notification';

interface CentreManagementProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function CentreManagement({ currentPage, onNavigate }: CentreManagementProps) {
  const [centres, setCentres] = useState<TrainingCentre[]>([]);
  const [selectedCentre, setSelectedCentre] = useState<TrainingCentre | null>(null);
  const [rooms, setRooms] = useState<TrainingCentreRoom[]>([]);
  const [showCentreModal, setShowCentreModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [editingCentre, setEditingCentre] = useState<TrainingCentre | null>(null);
  const [editingRoom, setEditingRoom] = useState<TrainingCentreRoom | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCentres();
  }, []);

  useEffect(() => {
    if (selectedCentre) {
      loadRooms(selectedCentre.id);
    } else {
      setRooms([]);
    }
  }, [selectedCentre]);

  async function loadCentres() {
    setLoading(true);
    try {
      const data = await getTrainingCentres();
      setCentres(data);

      // If a centre was selected, refresh it
      if (selectedCentre) {
        const updatedCentre = data.find(c => c.id === selectedCentre.id);
        setSelectedCentre(updatedCentre || null);
      }
    } catch (error) {
      console.error('Error loading centres:', error);
      setNotification({ message: 'Failed to load training centres', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function loadRooms(centreId: string) {
    try {
      const data = await getRoomsForCentre(centreId);
      setRooms(data);
    } catch (error) {
      console.error('Error loading rooms:', error);
      setNotification({ message: 'Failed to load rooms', type: 'error' });
    }
  }

  function openCentreModal(centre: TrainingCentre | null = null) {
    setEditingCentre(centre);
    setShowCentreModal(true);
  }

  function openRoomModal(room: TrainingCentreRoom | null = null) {
    setEditingRoom(room);
    setShowRoomModal(true);
  }

  async function deleteCentre(centreId: string) {
    if (!confirm('Are you sure you want to delete this training centre? This will also delete all associated rooms.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('training_centres')
        .delete()
        .eq('id', centreId);

      if (error) throw error;

      setNotification({ message: 'Training centre deleted successfully', type: 'success' });

      if (selectedCentre?.id === centreId) {
        setSelectedCentre(null);
      }

      await loadCentres();
    } catch (error: any) {
      console.error('Error deleting centre:', error);
      if (error.code === '23503') {
        setNotification({
          message: 'Cannot delete centre - it has bookings assigned to it',
          type: 'error'
        });
      } else {
        setNotification({ message: 'Failed to delete training centre', type: 'error' });
      }
    }
  }

  async function deleteRoom(roomId: string) {
    if (!confirm('Are you sure you want to delete this room?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('training_centre_rooms')
        .delete()
        .eq('id', roomId);

      if (error) throw error;

      setNotification({ message: 'Room deleted successfully', type: 'success' });

      if (selectedCentre) {
        await loadRooms(selectedCentre.id);
      }
    } catch (error: any) {
      console.error('Error deleting room:', error);
      if (error.code === '23503') {
        setNotification({
          message: 'Cannot delete room - it has bookings assigned to it',
          type: 'error'
        });
      } else {
        setNotification({ message: 'Failed to delete room', type: 'error' });
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <PageHeader currentPage={currentPage} onNavigate={onNavigate} />

      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold mb-2">Training Centre Management</h2>
          <p className="text-slate-400">
            Manage in-centre training locations and rooms for course bookings
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Training Centres Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Training Centres</h3>
              <button
                onClick={() => openCentreModal()}
                className="px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 rounded transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Centre
              </button>
            </div>

            <div className="p-4 space-y-2 max-h-[600px] overflow-y-auto">
              {centres.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Building className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No training centres yet</p>
                  <p className="text-sm mt-1">Click "Add Centre" to create one</p>
                </div>
              ) : (
                centres.map((centre) => (
                  <div
                    key={centre.id}
                    onClick={() => setSelectedCentre(centre)}
                    className={`p-4 border rounded cursor-pointer transition-all ${
                      selectedCentre?.id === centre.id
                        ? 'border-blue-500 bg-slate-800'
                        : 'border-slate-700 hover:border-slate-600 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-white truncate">{centre.name}</h4>
                          {!centre.is_active && (
                            <span className="px-2 py-0.5 text-xs bg-slate-700 text-slate-400 rounded">
                              Inactive
                            </span>
                          )}
                        </div>
                        {centre.town && (
                          <p className="text-sm text-slate-400">{centre.town}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded">
                            {rooms.filter(r => r.centre_id === centre.id).length} rooms
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openCentreModal(centre);
                          }}
                          className="p-1.5 text-slate-400 hover:text-blue-400 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteCentre(centre.id);
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Rooms Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {selectedCentre ? `Rooms - ${selectedCentre.name}` : 'Rooms'}
              </h3>
              {selectedCentre && (
                <button
                  onClick={() => openRoomModal()}
                  className="px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 rounded transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Room
                </button>
              )}
            </div>

            <div className="p-4 space-y-2 max-h-[600px] overflow-y-auto">
              {!selectedCentre ? (
                <div className="text-center py-12 text-slate-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Select a training centre to view its rooms</p>
                </div>
              ) : rooms.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Building className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No rooms yet for this centre</p>
                  <p className="text-sm mt-1">Click "Add Room" to create one</p>
                </div>
              ) : (
                rooms.map((room) => (
                  <div
                    key={room.id}
                    className="p-4 border border-slate-700 rounded hover:border-slate-600 hover:bg-slate-800/50 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-white">{room.room_name}</h4>
                          {!room.is_active && (
                            <span className="px-2 py-0.5 text-xs bg-slate-700 text-slate-400 rounded">
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="space-y-1 text-sm text-slate-400">
                          <p>Capacity: {room.capacity} people</p>
                          {room.equipment && (
                            <p className="truncate">Equipment: {room.equipment}</p>
                          )}
                          {room.notes && (
                            <p className="text-xs text-slate-500 truncate">{room.notes}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openRoomModal(room)}
                          className="p-1.5 text-slate-400 hover:text-blue-400 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteRoom(room.id)}
                          className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Centre Modal */}
      {showCentreModal && (
        <CentreModal
          centre={editingCentre}
          onClose={() => {
            setShowCentreModal(false);
            setEditingCentre(null);
          }}
          onSave={() => {
            setShowCentreModal(false);
            setEditingCentre(null);
            loadCentres();
            setNotification({
              message: editingCentre ? 'Centre updated successfully' : 'Centre created successfully',
              type: 'success'
            });
          }}
        />
      )}

      {/* Room Modal */}
      {showRoomModal && selectedCentre && (
        <RoomModal
          room={editingRoom}
          centreId={selectedCentre.id}
          onClose={() => {
            setShowRoomModal(false);
            setEditingRoom(null);
          }}
          onSave={() => {
            setShowRoomModal(false);
            setEditingRoom(null);
            loadRooms(selectedCentre.id);
            setNotification({
              message: editingRoom ? 'Room updated successfully' : 'Room created successfully',
              type: 'success'
            });
          }}
        />
      )}
    </div>
  );
}

// Centre Modal Component
interface CentreModalProps {
  centre: TrainingCentre | null;
  onClose: () => void;
  onSave: () => void;
}

function CentreModal({ centre, onClose, onSave }: CentreModalProps) {
  const [formData, setFormData] = useState({
    name: centre?.name || '',
    address1: centre?.address1 || '',
    address2: centre?.address2 || '',
    town: centre?.town || '',
    postcode: centre?.postcode || '',
    contact_name: centre?.contact_name || '',
    contact_email: centre?.contact_email || '',
    contact_telephone: centre?.contact_telephone || '',
    notes: centre?.notes || '',
    is_active: centre?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      if (centre) {
        const { error } = await supabase
          .from('training_centres')
          .update(formData)
          .eq('id', centre.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('training_centres')
          .insert([formData]);

        if (error) throw error;
      }

      onSave();
    } catch (error) {
      console.error('Error saving centre:', error);
      alert('Failed to save training centre');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-950/90 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {centre ? 'Edit Training Centre' : 'Add Training Centre'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">
              Centre Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. NCT Training Centre - Main Building"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm focus:border-blue-500 outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">
                Address Line 1
              </label>
              <input
                type="text"
                value={formData.address1}
                onChange={(e) => setFormData({ ...formData, address1: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">
                Address Line 2
              </label>
              <input
                type="text"
                value={formData.address2}
                onChange={(e) => setFormData({ ...formData, address2: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">
                Town/City
              </label>
              <input
                type="text"
                value={formData.town}
                onChange={(e) => setFormData({ ...formData, town: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">
                Postcode
              </label>
              <input
                type="text"
                value={formData.postcode}
                onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">
                Contact Name
              </label>
              <input
                type="text"
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">
                Contact Email
              </label>
              <input
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">
                Contact Telephone
              </label>
              <input
                type="tel"
                value={formData.contact_telephone}
                onChange={(e) => setFormData({ ...formData, contact_telephone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm focus:border-blue-500 outline-none resize-none"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-slate-400">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded"
              />
              Active (available for bookings)
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-slate-700 hover:border-slate-600 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Centre'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Room Modal Component
interface RoomModalProps {
  room: TrainingCentreRoom | null;
  centreId: string;
  onClose: () => void;
  onSave: () => void;
}

function RoomModal({ room, centreId, onClose, onSave }: RoomModalProps) {
  const [formData, setFormData] = useState({
    room_name: room?.room_name || '',
    capacity: room?.capacity || 0,
    equipment: room?.equipment || '',
    notes: room?.notes || '',
    is_active: room?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      if (room) {
        const { error } = await supabase
          .from('training_centre_rooms')
          .update(formData)
          .eq('id', room.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('training_centre_rooms')
          .insert([{ ...formData, centre_id: centreId }]);

        if (error) throw error;
      }

      onSave();
    } catch (error) {
      console.error('Error saving room:', error);
      alert('Failed to save room');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-950/90 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-2xl">
        <div className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {room ? 'Edit Room' : 'Add Room'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">
                Room Name *
              </label>
              <input
                type="text"
                value={formData.room_name}
                onChange={(e) => setFormData({ ...formData, room_name: e.target.value })}
                placeholder="e.g. Room A, Conference Room"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm focus:border-blue-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">
                Capacity (Max People) *
              </label>
              <input
                type="number"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 0 })}
                min="0"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm focus:border-blue-500 outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">
              Available Equipment
            </label>
            <textarea
              value={formData.equipment}
              onChange={(e) => setFormData({ ...formData, equipment: e.target.value })}
              placeholder="e.g. Projector, Whiteboard, Audio System"
              rows={2}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm focus:border-blue-500 outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">
              Notes / Special Instructions
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm focus:border-blue-500 outline-none resize-none"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-slate-400">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded"
              />
              Active (available for bookings)
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-slate-700 hover:border-slate-600 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
