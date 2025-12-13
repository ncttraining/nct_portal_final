import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, MapPin, Save, X } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { supabase } from '../lib/supabase';

interface Client {
  id: string;
  name: string;
  contact_name: string;
  email: string;
  telephone: string;
}

interface ClientLocation {
  id: string;
  client_id: string;
  location_name: string;
  address1: string;
  address2: string;
  town: string;
  postcode: string;
  contact_name: string;
  contact_email: string;
  contact_telephone: string;
  is_default: boolean;
}

interface ClientManagementProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function ClientManagement({ currentPage, onNavigate }: ClientManagementProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientLocations, setClientLocations] = useState<ClientLocation[]>([]);
  const [editingLocation, setEditingLocation] = useState<ClientLocation | null>(null);
  const [isNewLocation, setIsNewLocation] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'client' | 'location', id: string, name: string } | null>(null);

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (selectedClient) {
      loadClientLocations(selectedClient.id);
    }
  }, [selectedClient]);

  async function loadClients() {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error loading clients:', error);
      return;
    }

    setClients(data || []);
    setLoading(false);
  }

  async function loadClientLocations(clientId: string) {
    const { data, error } = await supabase
      .from('client_locations')
      .select('*')
      .eq('client_id', clientId)
      .order('is_default', { ascending: false })
      .order('location_name');

    if (error) {
      console.error('Error loading locations:', error);
      return;
    }

    setClientLocations(data || []);
  }

  async function saveClient() {
    if (!editingClient?.name.trim()) {
      alert('Client name is required');
      return;
    }

    if (editingClient.id) {
      const { error } = await supabase
        .from('clients')
        .update({
          name: editingClient.name,
          contact_name: editingClient.contact_name,
          email: editingClient.email,
          telephone: editingClient.telephone
        })
        .eq('id', editingClient.id);

      if (error) {
        console.error('Error updating client:', error);
        alert('Failed to update client');
        return;
      }
    } else {
      const { data, error } = await supabase
        .from('clients')
        .insert([{
          name: editingClient.name,
          contact_name: editingClient.contact_name,
          email: editingClient.email,
          telephone: editingClient.telephone
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating client:', error);
        alert('Failed to create client');
        return;
      }

      setSelectedClient(data);
    }

    await loadClients();
    setEditingClient(null);
  }

  async function confirmDeleteClient() {
    if (!deleteConfirm || deleteConfirm.type !== 'client') return;

    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', deleteConfirm.id);

    if (error) {
      console.error('Error deleting client:', error);
      alert('Failed to delete client');
      setDeleteConfirm(null);
      return;
    }

    await loadClients();
    if (selectedClient?.id === deleteConfirm.id) {
      setSelectedClient(null);
    }
    setDeleteConfirm(null);
  }

  async function saveLocation() {
    if (!editingLocation?.location_name.trim()) {
      alert('Location name is required');
      return;
    }

    if (!selectedClient) return;

    if (editingLocation.id && !isNewLocation) {
      const { error } = await supabase
        .from('client_locations')
        .update({
          location_name: editingLocation.location_name,
          address1: editingLocation.address1,
          address2: editingLocation.address2,
          town: editingLocation.town,
          postcode: editingLocation.postcode,
          contact_name: editingLocation.contact_name,
          contact_email: editingLocation.contact_email,
          contact_telephone: editingLocation.contact_telephone,
          is_default: editingLocation.is_default
        })
        .eq('id', editingLocation.id);

      if (error) {
        console.error('Error updating location:', error);
        alert('Failed to update location');
        return;
      }
    } else {
      const { error } = await supabase
        .from('client_locations')
        .insert([{
          client_id: selectedClient.id,
          location_name: editingLocation.location_name,
          address1: editingLocation.address1,
          address2: editingLocation.address2,
          town: editingLocation.town,
          postcode: editingLocation.postcode,
          contact_name: editingLocation.contact_name,
          contact_email: editingLocation.contact_email,
          contact_telephone: editingLocation.contact_telephone,
          is_default: editingLocation.is_default
        }]);

      if (error) {
        console.error('Error creating location:', error);
        alert('Failed to create location');
        return;
      }
    }

    await loadClientLocations(selectedClient.id);
    setEditingLocation(null);
    setIsNewLocation(false);
  }

  async function confirmDeleteLocation() {
    if (!deleteConfirm || deleteConfirm.type !== 'location') return;

    const { error } = await supabase
      .from('client_locations')
      .delete()
      .eq('id', deleteConfirm.id);

    if (error) {
      console.error('Error deleting location:', error);
      alert('Failed to delete location');
      setDeleteConfirm(null);
      return;
    }

    if (selectedClient) {
      await loadClientLocations(selectedClient.id);
    }
    setDeleteConfirm(null);
  }

  function startNewLocation() {
    setEditingLocation({
      id: crypto.randomUUID(),
      client_id: selectedClient!.id,
      location_name: '',
      address1: '',
      address2: '',
      town: '',
      postcode: '',
      contact_name: '',
      contact_email: '',
      contact_telephone: '',
      is_default: false
    });
    setIsNewLocation(true);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors flex items-center justify-center">
        <div className="text-slate-500 dark:text-slate-400">Loading clients...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors">
      <PageHeader currentPage={currentPage} onNavigate={onNavigate} />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Clients List */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
            <div className="border-b border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Clients</h2>
              <button
                onClick={() => setEditingClient({ id: '', name: '', contact_name: '', email: '', telephone: '' })}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Client
              </button>
            </div>
            <div className="p-4 space-y-2 max-h-[600px] overflow-y-auto">
              {clients.map(client => (
                <div
                  key={client.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedClient?.id === client.id
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
                  }`}
                  onClick={() => setSelectedClient(client)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900 dark:text-white">{client.name}</h3>
                      {client.contact_name && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{client.contact_name}</p>
                      )}
                      {client.email && (
                        <p className="text-sm text-slate-500 dark:text-slate-400">{client.email}</p>
                      )}
                      {client.telephone && (
                        <p className="text-sm text-slate-500 dark:text-slate-400">{client.telephone}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingClient(client);
                        }}
                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
                      >
                        <Edit className="w-4 h-4 text-blue-400" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirm({ type: 'client', id: client.id, name: client.name });
                        }}
                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Client Details & Locations */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
            {selectedClient ? (
              <>
                <div className="border-b border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{selectedClient.name}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Locations</p>
                  </div>
                  <button
                    onClick={startNewLocation}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Location
                  </button>
                </div>
                <div className="p-4 space-y-2 max-h-[600px] overflow-y-auto">
                  {clientLocations.length === 0 ? (
                    <div className="text-center text-slate-500 dark:text-slate-400 py-8">
                      <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No locations added yet</p>
                    </div>
                  ) : (
                    clientLocations.map(location => (
                      <div
                        key={location.id}
                        className="p-4 border border-slate-300 dark:border-slate-700 rounded-lg hover:border-slate-400 dark:hover:border-slate-600 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-slate-900 dark:text-white">{location.location_name}</h3>
                              {location.is_default && (
                                <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded">
                                  Default
                                </span>
                              )}
                            </div>
                            {location.address1 && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{location.address1}</p>}
                            {location.address2 && <p className="text-sm text-slate-500 dark:text-slate-400">{location.address2}</p>}
                            {location.town && <p className="text-sm text-slate-500 dark:text-slate-400">{location.town}</p>}
                            {location.postcode && <p className="text-sm text-slate-500 dark:text-slate-400">{location.postcode}</p>}
                            {location.contact_name && (
                              <p className="text-sm text-slate-600 dark:text-slate-500 mt-2">Contact: {location.contact_name}</p>
                            )}
                            {location.contact_email && <p className="text-sm text-slate-600 dark:text-slate-500">{location.contact_email}</p>}
                            {location.contact_telephone && <p className="text-sm text-slate-600 dark:text-slate-500">{location.contact_telephone}</p>}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingLocation(location);
                                setIsNewLocation(false);
                              }}
                              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
                            >
                              <Edit className="w-4 h-4 text-blue-400" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm({ type: 'location', id: location.id, name: location.location_name })}
                              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400 p-8 text-center">
                <div>
                  <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Select a client to view and manage their locations</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Edit Client Modal */}
      {editingClient && (
        <div className="fixed inset-0 bg-slate-100/90 dark:bg-slate-950/90 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg w-full max-w-lg">
            <div className="border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {editingClient.id ? 'Edit Client' : 'Add Client'}
              </h3>
              <button
                onClick={() => setEditingClient(null)}
                className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">Client Name *</label>
                <input
                  type="text"
                  value={editingClient.name}
                  onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm focus:border-blue-500 outline-none text-slate-900 dark:text-white"
                  placeholder="e.g. Acme Corporation"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">Contact Name</label>
                <input
                  type="text"
                  value={editingClient.contact_name}
                  onChange={(e) => setEditingClient({ ...editingClient, contact_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm focus:border-blue-500 outline-none text-slate-900 dark:text-white"
                  placeholder="e.g. John Smith"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">Email</label>
                <input
                  type="email"
                  value={editingClient.email}
                  onChange={(e) => setEditingClient({ ...editingClient, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm focus:border-blue-500 outline-none text-slate-900 dark:text-white"
                  placeholder="e.g. john@acme.com"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">Telephone</label>
                <input
                  type="tel"
                  value={editingClient.telephone}
                  onChange={(e) => setEditingClient({ ...editingClient, telephone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm focus:border-blue-500 outline-none text-slate-900 dark:text-white"
                  placeholder="e.g. 01234 567890"
                />
              </div>
            </div>
            <div className="border-t border-slate-200 dark:border-slate-800 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setEditingClient(null)}
                className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveClient}
                className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save Client
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Location Modal */}
      {editingLocation && (
        <div className="fixed inset-0 bg-slate-100/90 dark:bg-slate-950/90 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900">
              <h3 className="text-lg font-semibold">
                {isNewLocation ? 'Add Location' : 'Edit Location'}
              </h3>
              <button
                onClick={() => {
                  setEditingLocation(null);
                  setIsNewLocation(false);
                }}
                className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">Location Name *</label>
                <input
                  type="text"
                  value={editingLocation.location_name}
                  onChange={(e) => setEditingLocation({ ...editingLocation, location_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm focus:border-blue-500 outline-none text-slate-900 dark:text-white"
                  placeholder="e.g. Head Office"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">Address Line 1</label>
                  <input
                    type="text"
                    value={editingLocation.address1}
                    onChange={(e) => setEditingLocation({ ...editingLocation, address1: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm focus:border-blue-500 outline-none text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">Address Line 2</label>
                  <input
                    type="text"
                    value={editingLocation.address2}
                    onChange={(e) => setEditingLocation({ ...editingLocation, address2: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm focus:border-blue-500 outline-none text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">Town/City</label>
                  <input
                    type="text"
                    value={editingLocation.town}
                    onChange={(e) => setEditingLocation({ ...editingLocation, town: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm focus:border-blue-500 outline-none text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">Postcode</label>
                  <input
                    type="text"
                    value={editingLocation.postcode}
                    onChange={(e) => setEditingLocation({ ...editingLocation, postcode: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm focus:border-blue-500 outline-none text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
                <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">Location Contact</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">Contact Name</label>
                    <input
                      type="text"
                      value={editingLocation.contact_name}
                      onChange={(e) => setEditingLocation({ ...editingLocation, contact_name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm focus:border-blue-500 outline-none text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">Contact Email</label>
                      <input
                        type="email"
                        value={editingLocation.contact_email}
                        onChange={(e) => setEditingLocation({ ...editingLocation, contact_email: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm focus:border-blue-500 outline-none text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">Contact Telephone</label>
                      <input
                        type="tel"
                        value={editingLocation.contact_telephone}
                        onChange={(e) => setEditingLocation({ ...editingLocation, contact_telephone: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm focus:border-blue-500 outline-none text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={editingLocation.is_default}
                  onChange={(e) => setEditingLocation({ ...editingLocation, is_default: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="is_default" className="text-sm text-slate-500 dark:text-slate-400">
                  Set as default location for this client
                </label>
              </div>
            </div>
            <div className="border-t border-slate-200 dark:border-slate-800 px-6 py-4 flex justify-end gap-3 sticky bottom-0 bg-white dark:bg-slate-900">
              <button
                onClick={() => {
                  setEditingLocation(null);
                  setIsNewLocation(false);
                }}
                className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveLocation}
                className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save Location
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-100/90 dark:bg-slate-950/90 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg w-full max-w-md">
            <div className="border-b border-slate-200 dark:border-slate-800 px-6 py-4">
              <h3 className="text-lg font-semibold text-red-400">Confirm Delete</h3>
            </div>
            <div className="p-6">
              <p className="text-slate-600 dark:text-slate-300">
                {deleteConfirm.type === 'client'
                  ? `Are you sure you want to delete "${deleteConfirm.name}"? This will also delete all their locations.`
                  : `Are you sure you want to delete the location "${deleteConfirm.name}"?`
                }
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-500 mt-2">This action cannot be undone.</p>
            </div>
            <div className="border-t border-slate-200 dark:border-slate-800 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteConfirm.type === 'client' ? confirmDeleteClient : confirmDeleteLocation}
                className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete {deleteConfirm.type === 'client' ? 'Client' : 'Location'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
