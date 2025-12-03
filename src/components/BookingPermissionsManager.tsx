import { useState, useEffect } from 'react';
import { Bell, BellOff, ChevronDown, ChevronUp, Save, X, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  getUserTrainerPermissions,
  getUserTrainerTypePermissions,
  saveUserTrainerPermissions,
  saveUserTrainerTypePermissions
} from '../lib/bookings-permissions';

interface Trainer {
  id: string;
  name: string;
  trainer_type_id: string | null;
}

interface TrainerType {
  id: string;
  name: string;
}

interface BookingPermissionsManagerProps {
  userId: string;
  onClose: () => void;
  onSave: () => void;
}

export default function BookingPermissionsManager({ userId, onClose, onSave }: BookingPermissionsManagerProps) {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [trainerTypes, setTrainerTypes] = useState<TrainerType[]>([]);
  const [selectedTrainers, setSelectedTrainers] = useState<Record<string, boolean>>({});
  const [trainerNotifications, setTrainerNotifications] = useState<Record<string, boolean>>({});
  const [selectedTypes, setSelectedTypes] = useState<Record<string, boolean>>({});
  const [typeNotifications, setTypeNotifications] = useState<Record<string, boolean>>({});
  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, [userId]);

  async function loadData() {
    setLoading(true);
    try {
      const [trainersRes, typesRes, trainerPerms, typePerms] = await Promise.all([
        supabase.from('trainers').select('*').eq('suspended', false).order('name'),
        supabase.from('trainer_types').select('*').order('name'),
        getUserTrainerPermissions(userId),
        getUserTrainerTypePermissions(userId)
      ]);

      if (trainersRes.data) setTrainers(trainersRes.data);
      if (typesRes.data) setTrainerTypes(typesRes.data);

      const selectedTrainersMap: Record<string, boolean> = {};
      const trainerNotifsMap: Record<string, boolean> = {};
      trainerPerms.forEach(p => {
        selectedTrainersMap[p.trainer_id] = true;
        trainerNotifsMap[p.trainer_id] = p.can_receive_notifications;
      });
      setSelectedTrainers(selectedTrainersMap);
      setTrainerNotifications(trainerNotifsMap);

      const selectedTypesMap: Record<string, boolean> = {};
      const typeNotifsMap: Record<string, boolean> = {};
      typePerms.forEach(p => {
        selectedTypesMap[p.trainer_type_id] = true;
        typeNotifsMap[p.trainer_type_id] = p.can_receive_notifications;
      });
      setSelectedTypes(selectedTypesMap);
      setTypeNotifications(typeNotifsMap);
    } catch (error) {
      console.error('Error loading permissions:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const trainerPerms = Object.keys(selectedTrainers)
        .filter(id => selectedTrainers[id])
        .map(trainer_id => ({
          trainer_id,
          can_receive_notifications: trainerNotifications[trainer_id] || false
        }));

      const typePerms = Object.keys(selectedTypes)
        .filter(id => selectedTypes[id])
        .map(trainer_type_id => ({
          trainer_type_id,
          can_receive_notifications: typeNotifications[trainer_type_id] || false
        }));

      await Promise.all([
        saveUserTrainerPermissions(userId, trainerPerms),
        saveUserTrainerTypePermissions(userId, typePerms)
      ]);

      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving permissions:', error);
    } finally {
      setSaving(false);
    }
  }

  function toggleTrainer(trainerId: string) {
    setSelectedTrainers(prev => ({
      ...prev,
      [trainerId]: !prev[trainerId]
    }));
  }

  function toggleTrainerNotification(trainerId: string) {
    setTrainerNotifications(prev => ({
      ...prev,
      [trainerId]: !prev[trainerId]
    }));
  }

  function toggleType(typeId: string) {
    setSelectedTypes(prev => ({
      ...prev,
      [typeId]: !prev[typeId]
    }));
  }

  function toggleTypeNotification(typeId: string) {
    setTypeNotifications(prev => ({
      ...prev,
      [typeId]: !prev[typeId]
    }));
  }

  function toggleExpandType(typeId: string) {
    setExpandedTypes(prev => ({
      ...prev,
      [typeId]: !prev[typeId]
    }));
  }

  const trainersByType = trainers.reduce((acc, trainer) => {
    const typeId = trainer.trainer_type_id || 'unassigned';
    if (!acc[typeId]) acc[typeId] = [];
    acc[typeId].push(trainer);
    return acc;
  }, {} as Record<string, Trainer[]>);

  const filteredTrainers = searchTerm
    ? trainers.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : trainers;

  const totalSelected = Object.values(selectedTrainers).filter(Boolean).length +
    trainerTypes.filter(type => selectedTypes[type.id])
      .reduce((sum, type) => sum + (trainersByType[type.id]?.length || 0), 0);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <p className="text-slate-400">Loading permissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="border-b border-slate-800 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Eye className="w-5 h-5 text-blue-400" />
              <h3 className="text-xl font-semibold">Configure Booking View Permissions</h3>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-slate-400 mb-4">
            Select which trainers this user can view bookings for, and optionally enable notifications.
          </p>
          <div className="flex items-center gap-4">
            <input
              type="text"
              placeholder="Search trainers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded focus:outline-none focus:border-blue-500"
            />
            <div className="text-sm text-slate-400">
              {totalSelected} trainer{totalSelected !== 1 ? 's' : ''} accessible
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-300 mb-3">
              By Trainer Type (All trainers of this type)
            </h4>
            <div className="space-y-2">
              {trainerTypes.map(type => {
                const typeTrainers = trainersByType[type.id] || [];
                return (
                  <div key={type.id} className="bg-slate-800/50 border border-slate-700 rounded-lg">
                    <div className="flex items-center gap-3 p-3">
                      <input
                        type="checkbox"
                        checked={selectedTypes[type.id] || false}
                        onChange={() => toggleType(type.id)}
                        className="w-4 h-4"
                      />
                      <button
                        onClick={() => toggleExpandType(type.id)}
                        className="flex-1 flex items-center justify-between text-left"
                      >
                        <span className="text-sm font-medium">
                          {type.name} ({typeTrainers.length} trainer{typeTrainers.length !== 1 ? 's' : ''})
                        </span>
                        {expandedTypes[type.id] ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                      <button
                        onClick={() => toggleTypeNotification(type.id)}
                        className={`p-1.5 rounded transition-colors ${
                          typeNotifications[type.id]
                            ? 'text-blue-400 hover:text-blue-300'
                            : 'text-slate-500 hover:text-slate-400'
                        }`}
                        title={typeNotifications[type.id] ? 'Notifications enabled' : 'Notifications disabled'}
                      >
                        {typeNotifications[type.id] ? (
                          <Bell className="w-4 h-4" />
                        ) : (
                          <BellOff className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {expandedTypes[type.id] && typeTrainers.length > 0 && (
                      <div className="border-t border-slate-700 p-3 space-y-1">
                        {typeTrainers.map(trainer => (
                          <div key={trainer.id} className="text-xs text-slate-400 pl-7">
                            {trainer.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-300 mb-3">
              Individual Trainers
            </h4>
            <div className="space-y-1">
              {filteredTrainers.map(trainer => (
                <div
                  key={trainer.id}
                  className="flex items-center gap-3 p-2 hover:bg-slate-800/50 rounded transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedTrainers[trainer.id] || false}
                    onChange={() => toggleTrainer(trainer.id)}
                    className="w-4 h-4"
                  />
                  <span className="flex-1 text-sm">{trainer.name}</span>
                  <button
                    onClick={() => toggleTrainerNotification(trainer.id)}
                    className={`p-1.5 rounded transition-colors ${
                      trainerNotifications[trainer.id]
                        ? 'text-blue-400 hover:text-blue-300'
                        : 'text-slate-500 hover:text-slate-400'
                    }`}
                    title={trainerNotifications[trainer.id] ? 'Notifications enabled' : 'Notifications disabled'}
                  >
                    {trainerNotifications[trainer.id] ? (
                      <Bell className="w-4 h-4" />
                    ) : (
                      <BellOff className="w-4 h-4" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 p-6 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            Bell icon = Receive email notifications when bookings are assigned
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-700 hover:border-slate-600 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 rounded transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Permissions'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
