import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const navByRole = {
  admin: [
    ['Dashboard', 'dashboard', 'home'],
    ['Veterinarians', 'vets', 'vet'],
    ['Clients & Pets', 'clients', 'paw'],
    ['Appointments', 'booking', 'cal'],
    ['Vaccinations', 'vax', 'shot'],
    ['Follow-ups', 'followup', 'loop']
  ],
  doctor: [
    ['Appointments', 'calendar', 'cal'],
    ['AI SOAP Note', 'soap', 'note'],
    ['Weight Records', 'weight', 'scale'],
    ['Follow-ups', 'followup', 'loop']
  ],
  superadmin: [
    ['Dashboard', 'dashboard', 'home']
  ]
};

const tabs = [
  ['Dashboard', 'dashboard'],
  ['Veterinarians', 'vets'],
  ['Clients & Pets', 'clients'],
  ['Pet Profile', 'petprofile'],
  ['Vaccination Tracker', 'vax'],
  ['Book Appointment', 'booking'],
  ['AI SOAP Note', 'soap'],
  ['Weight Tracker', 'weight'],
  ['Follow-up Tracker', 'followup'],
  ['Doctor Calendar', 'calendar']
];

const icons = {
  home: '⌂',
  vet: '+',
  paw: '◆',
  cal: '◫',
  shot: '!',
  loop: '↻',
  note: 'N',
  scale: 'S',
  chart: '▥'
};

function useApi(selectedClinicId) {
  const [data, setData] = useState({
    dashboard: null,
    vets: [],
    clients: [],
    appointments: [],
    vaccinations: [],
    followups: [],
    weights: [],
    soapnotes: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const names = ['dashboard', 'vets', 'clients', 'appointments', 'vaccinations', 'followups', 'weights', 'soapnotes'];
      const headers = selectedClinicId ? { 'x-clinic-id': selectedClinicId } : {};
      const results = await Promise.all(names.map((name) => fetch(`${API_URL}/${name}`, { headers }).then((res) => {
        if (!res.ok) throw new Error(`API request failed: ${name}`);
        return res.json();
      })));
      setData(Object.fromEntries(names.map((name, index) => [name, results[index]])));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function create(resource, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (selectedClinicId) {
      headers['x-clinic-id'] = selectedClinicId;
    }
    const res = await fetch(`${API_URL}/${resource}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`Could not create ${resource}`);
    const createdObj = await res.json();
    await load();
    return createdObj;
  }

  async function update(resource, id, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (selectedClinicId) {
      headers['x-clinic-id'] = selectedClinicId;
    }
    const res = await fetch(`${API_URL}/${resource}/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`Could not update ${resource}`);
    await load();
  }

  async function remove(resource, id) {
    const headers = {};
    if (selectedClinicId) {
      headers['x-clinic-id'] = selectedClinicId;
    }
    const res = await fetch(`${API_URL}/${resource}/${id}`, {
      method: 'DELETE',
      headers
    });
    if (!res.ok) throw new Error(`Could not delete ${resource}`);
    await load();
  }

  useEffect(() => {
    load();
  }, [selectedClinicId]);

  return { data, loading, error, create, update, remove, reload: load };
}

function ClinicSelector({ clinics, onSelect, onCreate, onEdit, onDelete }) {
  const [name, setName] = useState('');
  const [regNum, setRegNum] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [specialties, setSpecialties] = useState('');
  const [openForm, setOpenForm] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(phone)) {
      alert("Phone number must be exactly 10 digits (numeric only)!");
      return;
    }
    if (!/^\d{6}$/.test(zip)) {
      alert("Postal code must be exactly 6 digits (numeric only)!");
      return;
    }
    onCreate({
      name,
      registration_number: regNum,
      address: { street, city, state, postal_code: zip },
      contact: { phone, email },
      specialties: specialties || 'General Practice, Vaccines, Surgery'
    }).then(() => {
      setName('');
      setRegNum('');
      setStreet('');
      setCity('');
      setState('');
      setZip('');
      setPhone('');
      setEmail('');
      setSpecialties('');
      setOpenForm(false);
    });
  };

  return (
    <div className="main-scroll">
      <div className="main-pad">
        <div className="topbar">
          <div>
            <h2>Clinics</h2>
            <div className="sub">Enterprise administration and database switcher panel</div>
          </div>
          <button className="btn btn-primary" onClick={() => setOpenForm(true)}>+ Create Clinic</button>
        </div>

        <section className="panel no-pad" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '12px', marginTop: '10px' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ paddingLeft: '18px' }}>Name</th>
                <th>City</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Specialties</th>
                <th style={{ textAlign: 'right', paddingRight: '24px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {clinics.length > 0 ? (
                clinics.map(c => (
                  <tr key={c._id}>
                    <td style={{ paddingLeft: '18px' }}>
                      <button 
                        className="btn btn-sm btn-outline" 
                        style={{ border: 0, padding: 0, background: 'transparent', fontWeight: '700', color: 'var(--text)', textAlign: 'left', fontSize: '13.5px' }}
                        onClick={() => onSelect(c)}
                        title="Click to launch clinic dashboard"
                      >
                        {c.name}
                      </button>
                    </td>
                    <td style={{ color: 'var(--text-2)' }}>{c.address?.city || 'N/A'}</td>
                    <td style={{ color: 'var(--text-2)' }}>{c.contact?.phone || 'N/A'}</td>
                    <td>
                      <span className={`badge b-${c.status === 'inactive' ? 'red' : 'green'}`} style={{ textTransform: 'capitalize', fontSize: '11px', padding: '2px 8px' }}>
                        {c.status || 'active'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-2)', fontSize: '13px' }}>{c.specialties || 'General Practice, Vaccines, Surgery'}</td>
                    <td style={{ textAlign: 'right', paddingRight: '24px' }}>
                      <div style={{ display: 'inline-flex', gap: '8px', justifyContent: 'flex-end', width: '100%', alignItems: 'center' }}>
                        <button 
                          className="btn btn-outline" 
                          style={{ padding: '6px 8px', color: 'var(--text-3)', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          onClick={() => onEdit(c)}
                          title="Edit Clinic Details"
                        >
                          ✏️
                        </button>
                        <button 
                          className="btn btn-outline" 
                          style={{ padding: '6px 8px', color: 'var(--red)', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          onClick={() => onDelete(c)}
                          title="Delete Clinic"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-3)' }}>
                    No active clinics onboarded yet. Click Create Clinic to add one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>

      {openForm && (
        <Modal title="Create New Veterinary Clinic" onClose={() => setOpenForm(false)}>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              <label className="field-label">Clinic Name<input className="input" required value={name} onChange={e => setName(e.target.value)} /></label>
              <label className="field-label">Registration ID<input className="input" required value={regNum} onChange={e => setRegNum(e.target.value)} /></label>
              <label className="field-label">Street Address<input className="input" required value={street} onChange={e => setStreet(e.target.value)} /></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <label className="field-label">City<input className="input" required value={city} onChange={e => setCity(e.target.value)} /></label>
                <label className="field-label">State<input className="input" required value={state} onChange={e => setState(e.target.value)} /></label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <label className="field-label">Postal Code<input className="input" required value={zip} onChange={e => setZip(e.target.value)} placeholder="6 digits" pattern="\d{6}" title="Postal code must be exactly 6 digits (numeric only)" /></label>
                <label className="field-label">Phone<input className="input" required value={phone} onChange={e => setPhone(e.target.value)} placeholder="10 digits" pattern="\d{10}" title="Phone number must be exactly 10 digits (numeric only)" /></label>
              </div>
              <label className="field-label">Specialties / Services<input className="input" value={specialties} onChange={e => setSpecialties(e.target.value)} placeholder="e.g. Surgery, Dentistry, General Practice" /></label>
              <label className="field-label">Email<input className="input" required type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-outline" onClick={() => setOpenForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save & Onboard</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function ClinicEditModal({ clinic, onClose, onSave }) {
  const [name, setName] = useState(clinic.name || '');
  const [regNum, setRegNum] = useState(clinic.registration_number || '');
  const [street, setStreet] = useState(clinic.address?.street || '');
  const [city, setCity] = useState(clinic.address?.city || '');
  const [state, setState] = useState(clinic.address?.state || '');
  const [zip, setZip] = useState(clinic.address?.postal_code || '');
  const [phone, setPhone] = useState(clinic.contact?.phone || '');
  const [email, setEmail] = useState(clinic.contact?.email || '');
  const [specialties, setSpecialties] = useState(clinic.specialties || 'General Practice, Vaccines, Surgery');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(phone)) {
      alert("Phone number must be exactly 10 digits (numeric only)!");
      return;
    }
    if (!/^\d{6}$/.test(zip)) {
      alert("Postal code must be exactly 6 digits (numeric only)!");
      return;
    }
    onSave({
      name,
      registration_number: regNum,
      address: { street, city, state, postal_code: zip },
      contact: { phone, email },
      specialties
    });
  };

  return (
    <Modal title={`Edit Clinic - ${clinic.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          <label className="field-label">Clinic Name<input className="input" required value={name} onChange={e => setName(e.target.value)} /></label>
          <label className="field-label">Registration ID<input className="input" required disabled value={regNum} /></label>
          <label className="field-label">Street Address<input className="input" required value={street} onChange={e => setStreet(e.target.value)} /></label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <label className="field-label">City<input className="input" required value={city} onChange={e => setCity(e.target.value)} /></label>
            <label className="field-label">State<input className="input" required value={state} onChange={e => setState(e.target.value)} /></label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <label className="field-label">Postal Code<input className="input" required value={zip} onChange={e => setZip(e.target.value)} placeholder="6 digits" pattern="\d{6}" title="Postal code must be exactly 6 digits (numeric only)" /></label>
            <label className="field-label">Phone<input className="input" required value={phone} onChange={e => setPhone(e.target.value)} placeholder="10 digits" pattern="\d{10}" title="Phone number must be exactly 10 digits (numeric only)" /></label>
          </div>
          <label className="field-label">Specialties / Services<input className="input" value={specialties} onChange={e => setSpecialties(e.target.value)} placeholder="e.g. Surgery, Dentistry, General Practice" /></label>
          <label className="field-label">Email<input className="input" required type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">Save Changes</button>
        </div>
      </form>
    </Modal>
  );
}

function App() {
  const [clinics, setClinics] = useState([]);
  const [selectedClinic, setSelectedClinic] = useState(() => {
    const saved = localStorage.getItem('pawchart_clinic');
    return saved ? JSON.parse(saved) : null;
  });
  const [editingClinic, setEditingClinic] = useState(null);
  const [selectedPet, setSelectedPet] = useState(null);
  const [bookingClient, setBookingClient] = useState(null);
  const [bookingPet, setBookingPet] = useState(null);
  const [selectedDoctor, setSelectedDoctor] = useState(null);

  const { data, loading, error, create, update, remove, reload } = useApi(selectedClinic?._id);
  const [screen, setScreen] = useState('dashboard');
  const [role, setRole] = useState('admin');

  async function loadClinics() {
    try {
      const res = await fetch(`${API_URL}/clinics`);
      if (res.ok) {
        const list = await res.json();
        setClinics(list);
        
        // Auto-assign first clinic to non-superadmin users if no clinic selected yet
        if (role !== 'superadmin' && list.length > 0 && !selectedClinic) {
          selectClinic(list[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load clinics:', err);
    }
  }

  useEffect(() => {
    loadClinics();
  }, [role]);

  const selectClinic = (clinic) => {
    setSelectedClinic(clinic);
    if (clinic) {
      localStorage.setItem('pawchart_clinic', JSON.stringify(clinic));
    } else {
      localStorage.removeItem('pawchart_clinic');
    }
  };

  async function handleCreateClinic(clinicForm) {
    try {
      const res = await fetch(`${API_URL}/clinics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clinicForm)
      });
      if (res.ok) {
        alert('Clinic successfully onboarded! You can now manually select it from the list.');
        await loadClinics();
        // Do NOT selectClinic or auto-switch context. Keep currently selected clinic active.
      } else {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to onboard clinic');
      }
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleUpdateClinic(updatedFields) {
    try {
      const res = await fetch(`${API_URL}/clinics/${editingClinic._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFields)
      });
      if (res.ok) {
        const updated = await res.json();
        alert('Clinic details updated successfully!');
        await loadClinics();
        if (selectedClinic && selectedClinic._id === updated._id) {
          setSelectedClinic(updated);
          localStorage.setItem('pawchart_clinic', JSON.stringify(updated));
        }
        setEditingClinic(null);
      } else {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to update clinic');
      }
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleDeleteClinic(clinic) {
    if (!confirm(`Are you sure you want to permanently delete "${clinic.name}"? All associated vets, appointments, and client records under this clinic will no longer be accessible.`)) {
      return;
    }
    try {
      const res = await fetch(`${API_URL}/clinics/${clinic._id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        alert('Clinic successfully deleted!');
        await loadClinics();
        if (selectedClinic && selectedClinic._id === clinic._id) {
          selectClinic(null);
        }
      } else {
        throw new Error('Failed to delete clinic');
      }
    } catch (err) {
      alert(err.message);
    }
  }

  const activePet = useMemo(() => {
    if (!data?.clients) return null;
    const allPets = data.clients.flatMap((client) => (client.pets || []).map((pet) => ({
      ...pet,
      ownerId: client._id,
      ownerName: client.name,
      email: client.email,
      phone: client.phone
    })));
    if (selectedPet) {
      const found = allPets.find(p => p._id === selectedPet._id || p.name === selectedPet.name);
      if (found) return found;
    }
    return allPets.find((pet) => pet.name === 'Buddy') || allPets[0] || null;
  }, [data?.clients, selectedPet]);

  function switchRole(nextRole) {
    setRole(nextRole);
    setScreen(nextRole === 'doctor' ? 'calendar' : 'dashboard');
    if (nextRole !== 'superadmin' && clinics.length > 0) {
      selectClinic(clinics[0]);
    } else if (nextRole === 'superadmin') {
      selectClinic(null); // Force Super Admin selector to trigger first
    }
  }

  return (
    <div className="proto-shell">
      <header className="proto-header">
        <h1>PawChart MERN</h1>
        <p>Clinic operations, patient records, bookings, reminders, and SOAP notes backed by MongoDB.</p>
      </header>

      <div className="screen-tabs">
        {tabs.map(([label, id]) => <button key={id} className={`stab ${screen === id ? 'active' : ''}`} onClick={() => setScreen(id)}>{label}</button>)}
      </div>

      <div className="app-frame">
        <aside className="sidebar">
          <div className="sb-top">
            <div className="sb-brand"><span className="paw-mark">◆</span> Paw<span>Chart</span></div>
            <label className="sb-field-label">Role</label>
            <select className="sb-select" value={role} onChange={(event) => switchRole(event.target.value)}>
              <option value="superadmin">Super Admin</option>
              <option value="admin">Clinic Admin</option>
              <option value="doctor">Doctor</option>
            </select>
            
            {role === 'doctor' && (
              <>
                <label className="sb-field-label" style={{ marginTop: '16px' }}>Clinic</label>
                <select 
                  className="sb-select"
                  value={selectedClinic?._id || ''}
                  onChange={(e) => {
                    const c = clinics.find(item => item._id === e.target.value);
                    selectClinic(c);
                    setSelectedDoctor(null);
                  }}
                >
                  <option value="" disabled>Select clinic...</option>
                  {clinics.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>

                <label className="sb-field-label" style={{ marginTop: '16px' }}>Doctor</label>
                <select 
                  className="sb-select"
                  value={selectedDoctor?._id || ''}
                  onChange={(e) => {
                    const d = data.vets?.find(item => item._id === e.target.value);
                    setSelectedDoctor(d || null);
                  }}
                  disabled={!selectedClinic || !data.vets?.length}
                >
                  <option value="" disabled>{!selectedClinic ? 'Select clinic first...' : 'Select doctor...'}</option>
                  {data.vets?.map(v => <option key={v._id} value={v._id}>{v.name}</option>)}
                </select>
              </>
            )}
          </div>
          
          {role === 'admin' && clinics.length > 0 ? (
            <div style={{ padding: '9px 16px', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', gap: '6px' }}>
              <select 
                className="sb-select"
                style={{ flex: 1 }}
                value={selectedClinic?._id || ''}
                onChange={(e) => {
                  const c = clinics.find(item => item._id === e.target.value);
                  selectClinic(c);
                }}
              >
                <option value="" disabled>Switch Clinic</option>
                {clinics.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
          ) : (
            role !== 'doctor' && selectedClinic && (
              <div className="sb-clinic" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', color: '#cbd5e1', padding: '9px 16px', borderBottom: '1px solid rgba(255,255,255,.06)', fontSize: '11px', fontWeight: '600' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedClinic.name}
                </span>
                {role === 'superadmin' && (
                  <button
                    className="btn btn-outline"
                    style={{ padding: '3px 6px', fontSize: '9px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', color: '#fff', height: 'auto', display: 'inline-flex', alignItems: 'center', borderRadius: '4px' }}
                    onClick={() => selectClinic(null)}
                    title="Return to Clinics Panel"
                  >
                    ◀ Exit
                  </button>
                )}
              </div>
            )
          )}

          <nav className="sb-nav">
            {navByRole[role].map(([label, id, icon]) => (
              <button key={`${role}-${label}`} className={`nav-item ${screen === id ? 'active' : ''}`} onClick={() => setScreen(id)}>
                <span className="ni">{icons[icon]}</span>{label}
                {label === 'Vaccinations' && <span className="nav-badge">{data.dashboard?.stats?.vaccinesDue ?? 0}</span>}
                {label === 'Follow-ups' && <span className="nav-badge">{data.dashboard?.stats?.followUpsPending ?? 0}</span>}
              </button>
            ))}
          </nav>
          <div className="sb-footer">
            <div className="pulse-row"><span className="pulse-dot" />Monitoring {data.dashboard?.monitoring?.length ?? 0} follow-ups</div>
            <div className="fp-sub">System watching for earlier slots</div>
          </div>
        </aside>

        <main className="main">
          {loading && <Status message="Loading clinic data..." />}
          {error && <Status message={`${error}. Start the API and seed MongoDB.`} tone="error" action={reload} />}
          {!loading && !error && (
            role === 'superadmin' && !selectedClinic ? (
              <ClinicSelector clinics={clinics} onSelect={selectClinic} onCreate={handleCreateClinic} onEdit={setEditingClinic} onDelete={handleDeleteClinic} />
            ) : (
              <>
                {screen === 'dashboard' && <Dashboard data={data.dashboard} go={setScreen} />}
                {screen === 'vets' && <Vets vets={data.vets} create={create} update={update} onDelete={remove} />}
                {screen === 'clients' && <Clients clients={data.clients} create={create} appointments={data.appointments} vaccinations={data.vaccinations} go={setScreen} onSelectPet={setSelectedPet} />}
                {screen === 'petprofile' && <PetProfile pet={activePet} clients={data.clients} appointments={data.appointments} vaccinations={data.vaccinations} soapnotes={data.soapnotes} weights={data.weights} go={setScreen} onSetBookingClient={setBookingClient} onSetBookingPet={setBookingPet} />}
                {screen === 'vax' && <Vaccinations rows={data.vaccinations} update={update} />}
                {screen === 'booking' && <Booking vets={data.vets} clients={data.clients} appointments={data.appointments} create={create} bookingClient={bookingClient} setBookingClient={setBookingClient} bookingPet={bookingPet} setBookingPet={setBookingPet} go={setScreen} />}
                {screen === 'soap' && <Soap note={data.soapnotes[0]} create={create} />}
                {screen === 'weight' && <Weights weights={data.weights} create={create} />}
                {screen === 'followup' && <FollowUps rows={data.followups} />}
                {screen === 'calendar' && <Calendar appointments={selectedDoctor ? data.appointments.filter(a => a.vetName === selectedDoctor.name) : data.appointments} go={setScreen} />}
              </>
            )
          )}
        </main>
      </div>

      {editingClinic && (
        <ClinicEditModal 
          clinic={editingClinic} 
          onClose={() => setEditingClinic(null)} 
          onSave={handleUpdateClinic} 
        />
      )}
    </div>
  );
}

function Status({ message, tone = 'info', action }) {
  return <div className="status"><div className={`status-box ${tone}`}>{message}{action && <button className="btn btn-primary" onClick={action}>Retry</button>}</div></div>;
}

function AlertCard({ type, petName, title, sub }) {
  const colors = {
    amber: { bg: '#fef3c7', border: '#fcd34d', text: '#b45309', subText: '#b45309' },
    purple: { bg: '#ede9fe', border: '#c084fc', text: '#6d28d9', subText: '#6d28d9' },
    red: { bg: '#fee2e2', border: '#fca5a5', text: '#b91c1c', subText: '#b91c1c' }
  };
  const color = colors[type] || colors.amber;
  return (
    <div style={{
      background: color.bg,
      border: `1px solid ${color.border}`,
      borderRadius: '8px',
      padding: '12px 14px',
      marginBottom: '10px',
      cursor: 'pointer'
    }}>
      <div style={{ fontWeight: '700', fontSize: '13px', color: color.text }}>
        <strong>{petName}</strong> — {title}
      </div>
      <div style={{ fontSize: '11px', color: color.subText, marginTop: '2px', opacity: 0.8 }}>
        {sub}
      </div>
    </div>
  );
}

function MonitoringBox({ count = 3 }) {
  return (
    <div style={{
      background: '#0b1329',
      border: '1px solid #1e293b',
      borderRadius: '12px',
      padding: '16px',
      color: '#fff',
      marginTop: '12px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#60a5fa', fontWeight: '700' }}>
        <span className="pulse-dot" style={{ background: '#3b82f6' }} /> Background Monitoring
      </div>
      <div style={{ fontWeight: '700', fontSize: '14px', marginTop: '6px', color: '#fff' }}>
        Watching for earlier slots
      </div>
      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', lineHeight: '1.4' }}>
        {count} follow-up patients on watch. Owner is notified the moment an earlier slot opens.
      </div>
    </div>
  );
}

function Dashboard({ data, go }) {
  const stats = data?.stats || {};
  return (
    <Screen 
      title="Dashboard" 
      sub="Friday, May 22, 2026 · live clinic dashboard" 
      action={<button className="btn btn-primary" onClick={() => go('booking')}>+ New Appointment</button>}
    >
      <div className="stat-grid">
        <Stat label="TODAY'S APPOINTMENTS" value={stats.appointmentsToday ?? 14} hint={stats.appointmentsTodayHint || "2 more than yesterday"} primary />
        <Stat label="ACTIVE PATIENTS" value={stats.activePatients ?? 247} hint={stats.activePatientsHint || "8 new this month"} />
        <Stat label="VACCINES DUE" value={stats.vaccinesDue ?? 5} hint={stats.vaccinesDueHint || "2 overdue"} danger />
        <Stat label="FOLLOW-UPS PENDING" value={stats.followUpsPending ?? 3} hint={stats.followUpsPendingHint || "1 from yesterday"} />
      </div>
      
      <div className="grid-two">
        <section className="panel no-pad" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '12px' }}>
          <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <strong style={{ fontSize: '15px' }}>Today's Appointments</strong>
            <span className="badge b-blue" style={{ fontSize: '11px', padding: '2px 8px' }}>{stats.appointmentsToday ?? 14} total</span>
          </div>
          <AppointmentList rows={data?.appointments || []} />
        </section>
        
        <section className="panel" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
          <div className="card-label" style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '.07em', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '12px' }}>
            ALERTS & REMINDERS
          </div>
          
          <AlertCard 
            type="amber" 
            petName="Buddy" 
            title="Rabies overdue" 
            sub="Overdue 3 days · Click to open vaccination tracker" 
          />
          <AlertCard 
            type="purple" 
            petName="Luna" 
            title="Follow-up pending" 
            sub="Planned May 19 · Click to open follow-up tracker" 
          />
          <AlertCard 
            type="red" 
            petName="Max" 
            title="Weight concern" 
            sub="+2.4 lbs in 6 weeks · Click to view weight chart" 
          />
          
          <MonitoringBox count={stats.followUpsPending ?? 3} />
        </section>
      </div>
    </Screen>
  );
}

function Stat({ label, value, hint, primary, danger }) {
  return <div className={`stat-card ${primary ? 'primary' : ''}`}>
    <div className="stat-label">{label}</div>
    <div className="stat-num">{value}</div>
    <div className={`stat-change ${danger ? 'danger' : ''}`}>{hint}</div>
  </div>;
}

function Vets({ vets, create, update, onDelete }) {
  const [openOnboard, setOpenOnboard] = useState(false);
  const [editingVet, setEditingVet] = useState(null);

  return (
    <Screen 
      title="Veterinarians" 
      sub={`Riverside Veterinary Clinic · ${vets.length} vets on staff`} 
      action={<button className="btn btn-primary" onClick={() => setOpenOnboard(true)}>+ Onboard Vet</button>}
    >
      <section className="panel no-pad" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '12px' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ paddingLeft: '18px' }}>NAME</th>
              <th>SPECIALIZATION</th>
              <th>EXPERIENCE</th>
              <th>CONSULTATION FEE</th>
              <th>STATUS</th>
              <th style={{ textAlign: 'right', paddingRight: '24px' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {vets.length > 0 ? (
              vets.map((vet) => (
                <tr key={vet._id}>
                  <td style={{ paddingLeft: '18px' }}>
                    <div className="td-name">{vet.name}</div>
                    <div className="td-sub">{vet.email}</div>
                  </td>
                  <td>{vet.specialization || 'General Practice'}</td>
                  <td>{vet.experienceYears ? `${vet.experienceYears} yrs` : 'N/A'}</td>
                  <td>{vet.consultationFee ? `$${vet.consultationFee}` : 'N/A'}</td>
                  <td>
                    <Badge value={vet.status || 'Available'} />
                  </td>
                  <td style={{ textAlign: 'right', paddingRight: '24px' }}>
                    <div style={{ display: 'inline-flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                      <button 
                        className="btn btn-outline" 
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                        onClick={() => setEditingVet(vet)}
                      >
                        Edit
                      </button>
                      <button 
                        className="btn btn-outline" 
                        style={{ padding: '6px 8px', color: 'var(--red)', border: '1px solid #cbd5e1' }}
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete Dr. ${vet.name}?`)) {
                            onDelete('vets', vet._id);
                          }
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-3)' }}>
                  No veterinarians onboarded. Click Onboard Vet to add one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <div style={{
        marginTop: '16px',
        background: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: '8px',
        padding: '12px 16px',
        color: '#1e40af',
        fontSize: '12.5px',
        lineHeight: '1.5'
      }}>
        💡 <strong>Note:</strong> Most US vet clinics have 2–8 vets. This screen works the same as CareFlow's Doctors screen — same onboard modal, same table. Only label changes: "Doctor" → "Veterinarian", specializations are vet-specific.
      </div>

      {openOnboard && (
        <VetModal 
          onClose={() => setOpenOnboard(false)} 
          onSave={(body) => create('vets', body).then(() => setOpenOnboard(false))} 
        />
      )}

      {editingVet && (
        <VetModal 
          vet={editingVet} 
          onClose={() => setEditingVet(null)} 
          onSave={(body) => update('vets', editingVet._id, body).then(() => setEditingVet(null))} 
        />
      )}
    </Screen>
  );
}

function Clients({ clients, create, appointments, vaccinations, go, onSelectPet }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(c => {
      const matchOwner = c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q)) || (c.email && c.email.toLowerCase().includes(q));
      const matchPet = (c.pets || []).some(p => p.name.toLowerCase().includes(q) || (p.breed && p.breed.toLowerCase().includes(q)));
      return matchOwner || matchPet;
    });
  }, [clients, search]);

  const petEmoji = (species = '') => {
    const s = species.toLowerCase();
    if (s.includes('dog')) return '🐶';
    if (s.includes('cat')) return '🐱';
    if (s.includes('rabbit') || s.includes('lop')) return '🐰';
    if (s.includes('parrot') || s.includes('bird')) return '🦜';
    return '🐾';
  };

  const getVaccinesBadgeForClient = (clientPets, vaccinations) => {
    let overdue = 0;
    let dueSoon = 0;
    (clientPets || []).forEach(p => {
      const petVaxes = vaccinations.filter(v => v.petName === p.name);
      petVaxes.forEach(v => {
        const s = String(v.status).toLowerCase();
        if (s.includes('overdue')) overdue++;
        else if (s.includes('due') || s.includes('soon')) dueSoon++;
      });
    });

    if (overdue > 0) return <span className="badge b-red">{overdue} overdue</span>;
    if (dueSoon > 0) return <span className="badge b-amber">{dueSoon} due soon</span>;
    return <span className="badge b-green">Up to date</span>;
  };

  const getNextAppointmentBadge = (clientPets, appointments) => {
    const petNames = (clientPets || []).map(p => p.name.toLowerCase());
    const clientAppts = appointments.filter(a => petNames.includes(a.petName.toLowerCase()) && a.status !== 'Completed' && a.status !== 'Cancelled');
    
    if (clientAppts.length === 0) return <span style={{ color: 'var(--text-3)' }}>None</span>;

    clientAppts.sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));
    const next = clientAppts[0];
    
    let timeStr = next.time;
    try {
      const [h, m] = next.time.split(':');
      const hr = parseInt(h);
      const ampm = hr >= 12 ? 'PM' : 'AM';
      const hr12 = hr % 12 || 12;
      timeStr = `${hr12}:${m} ${ampm}`;
    } catch (e) {}

    const todayStr = new Date().toISOString().split('T')[0];
    let prefix = next.date === todayStr ? 'Today ' : `${new Date(next.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} `;
    
    let badgeColor = 'blue';
    if (next.petName === 'Luna') {
      prefix = 'Follow-up ';
      badgeColor = 'purple';
    } else if (next.date !== todayStr) {
      badgeColor = 'amber';
    }

    return <span className={`badge b-${badgeColor}`}>{prefix}{timeStr}</span>;
  };

  const getLastVisitDate = (clientPets, appointments, clientCreatedAt) => {
    const petNames = (clientPets || []).map(p => p.name.toLowerCase());
    const pastAppts = appointments.filter(a => petNames.includes(a.petName.toLowerCase()) && (a.status === 'Completed' || new Date(a.date) < new Date()));
    if (pastAppts.length > 0) {
      pastAppts.sort((a, b) => new Date(b.date) - new Date(a.date));
      return new Date(pastAppts[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    const date = clientCreatedAt ? new Date(clientCreatedAt) : new Date();
    date.setDate(date.getDate() - 4);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Screen 
      title="Clients & Pets" 
      sub={`${clients.reduce((sum, c) => sum + (c.pets || []).length, 0)} pets across ${clients.length} client accounts · Owner is the account, each pet is a separate patient`} 
      action={<button className="btn btn-primary" onClick={() => setOpen(true)}>+ Register New Client</button>}
    >
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
        marginBottom: '16px',
        background: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: '8px',
        padding: '12px'
      }}>
        <div style={{ fontSize: '12px', color: '#1e40af', lineHeight: '1.4' }}>
          💡 <strong>"Register New Client"</strong> → Creates a new owner account + registers their pets for the first time
        </div>
        <div style={{ fontSize: '12px', color: '#1e40af', lineHeight: '1.4' }}>
          📅 <strong>"New Appointment"</strong> (on dashboard) → Books a slot for an existing client's pet
        </div>
      </div>

      <div className="search-row">
        <input 
          className="search-box" 
          placeholder="Search by owner name, pet name, phone, or Pet ID..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button className="btn btn-outline">Search</button>
      </div>

      <section className="panel no-pad" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '12px' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ paddingLeft: '18px' }}>OWNER / CLIENT</th>
              <th>PETS</th>
              <th>LAST VISIT</th>
              <th>NEXT APPOINTMENT</th>
              <th>VACCINES</th>
              <th style={{ textAlign: 'right', paddingRight: '24px' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? (
              filtered.map((client) => (
                <tr key={client._id}>
                  <td style={{ paddingLeft: '18px' }}>
                    <div className="td-name">{client.name}</div>
                    <div className="td-sub">{client.email} · {client.phone}</div>
                  </td>
                  <td>
                    <div className="chips">
                      {(client.pets || []).map((pet) => (
                        <span 
                          className="pet-chip" 
                          key={pet._id || pet.name}
                          style={{ cursor: 'pointer' }}
                          onClick={() => {
                            onSelectPet(pet);
                            go('petprofile');
                          }}
                        >
                          {petEmoji(pet.species)} {pet.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>{getLastVisitDate(client.pets, appointments, client.createdAt)}</td>
                  <td>{getNextAppointmentBadge(client.pets, appointments)}</td>
                  <td>{getVaccinesBadgeForClient(client.pets, vaccinations)}</td>
                  <td style={{ textAlign: 'right', paddingRight: '24px' }}>
                    <button 
                      className="btn btn-outline" 
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                      onClick={() => {
                        if (client.pets && client.pets.length > 0) {
                          onSelectPet(client.pets[0]);
                        }
                        go('petprofile');
                      }}
                    >
                      View →
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-3)' }}>
                  No clients or pets matching your search criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {open && (
        <ClientModal 
          onClose={() => setOpen(false)} 
          onSave={(body) => create('clients', body).then(() => setOpen(false))} 
        />
      )}
    </Screen>
  );
}

function PetProfile({ pet, clients, appointments, vaccinations, soapnotes, weights, go, onSetBookingClient, onSetBookingPet }) {
  const [activeTab, setActiveTab] = useState('visits');
  const [weightVal, setWeightVal] = useState('32.4');

  if (!pet) return <Status message="Select a pet to view profile." />;

  const owner = clients.find(c => (c.pets || []).some(p => p.name.toLowerCase() === pet.name.toLowerCase()));
  const ownerName = owner ? owner.name : (pet.ownerName || 'James Martinez');
  const ownerEmail = owner ? owner.email : (pet.email || 'james.m@email.com');
  const ownerPhone = owner ? owner.phone : (pet.phone || '(555) 824-3901');

  // Latest weight check
  const petWeights = weights.filter(w => w.petName.toLowerCase() === pet.name.toLowerCase());
  const currentWeight = petWeights.length > 0 ? `${petWeights[0].value} ${petWeights[0].unit || 'lbs'}` : '32.4 lbs';

  // dynamic timeline records (visits) from SoapNotes
  const petVisits = soapnotes.filter(s => s.petName.toLowerCase() === pet.name.toLowerCase());
  
  // dynamic vaccinations
  const petVax = vaccinations.filter(v => v.petName.toLowerCase() === pet.name.toLowerCase());

  const handleBookAppointment = () => {
    onSetBookingClient(owner);
    onSetBookingPet(pet);
    go('booking');
  };

  const breadcrumbs = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-3)' }}>
      <span style={{ cursor: 'pointer', color: 'var(--brand)', textDecoration: 'none' }} onClick={() => go('clients')}>Clients & Pets</span>
      <span>›</span>
      <span style={{ color: 'var(--text-2)' }}>{ownerName}</span>
      <span>›</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '700', color: 'var(--text)' }}>
        🐕 {pet.name}
      </span>
    </div>
  );

  const actionButtons = (
    <div style={{ display: 'flex', gap: '8px' }}>
      <button className="btn btn-outline" style={{ background: '#fff' }} onClick={handleBookAppointment}>+ Book Appointment</button>
      <button className="btn btn-primary" onClick={() => go('soap')}>Start Consultation</button>
    </div>
  );

  const petDetailsList = [
    { label: 'Pet ID', value: pet.petId || 'PET-2024-0042' },
    { label: 'Date of Birth', value: pet.dateOfBirth || 'Mar 15, 2022' },
    { label: 'Microchip', value: pet.microchip || '985112003456789' },
    { label: 'Insurance', value: pet.insurance || 'Nationwide Pet' },
    { label: 'Primary Vet', value: pet.primaryVet || 'Dr. Sarah Chen' },
    { label: 'Owner', value: ownerName, isLink: true }
  ];

  return (
    <Screen title={breadcrumbs} sub="" action={actionButtons}>
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px', alignItems: 'start' }}>
        
        {/* LEFT COLUMN: PET CARDS & DETAILS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* BLUE HERO CARD */}
          <div style={{
            background: 'var(--brand)',
            borderRadius: '16px',
            padding: '24px 16px',
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(37,99,235,0.15)'
          }}>
            <div style={{ fontSize: '48px', lineHeight: '1' }}>🐕</div>
            <h2 style={{ fontSize: '26px', margin: '12px 0 2px 0', fontWeight: '800', color: '#fff' }}>{pet.name}</h2>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', fontWeight: '500' }}>
              {pet.breed || 'Golden Retriever'} - {pet.sex || 'Male'} - {pet.spayedNeutered || 'Neutered'}
            </div>
            
            <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', padding: '4px 12px', borderRadius: '999px', background: 'rgba(255,255,255,0.18)' }}>
                Age {pet.age || '4'}
              </span>
              <span style={{ fontSize: '12px', fontWeight: '700', padding: '4px 12px', borderRadius: '999px', background: 'rgba(255,255,255,0.18)' }}>
                {currentWeight}
              </span>
              <span style={{ fontSize: '12px', fontWeight: '700', padding: '4px 12px', borderRadius: '999px', background: 'rgba(255,255,255,0.18)' }}>
                {pet.bloodType || 'B+'}
              </span>
            </div>
          </div>

          {/* PET DETAILS PANEL */}
          <section className="panel" style={{ padding: '16px 18px', borderRadius: '12px', background: '#fff' }}>
            <div className="card-label" style={{ fontSize: '10px', color: 'var(--text-3)', fontWeight: '800', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: '14px' }}>
              PET DETAILS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {petDetailsList.map((item) => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-3)' }}>{item.label}</span>
                  {item.isLink ? (
                    <span 
                      style={{ color: 'var(--brand)', fontWeight: '700', cursor: 'pointer' }}
                      onClick={() => go('clients')}
                    >
                      {item.value}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text)', fontWeight: '700' }}>{item.value}</span>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* VACCINATION STATUS SUMMARY */}
          <section className="panel" style={{ padding: '16px 18px', borderRadius: '12px', background: '#fff' }}>
            <div className="card-label" style={{ fontSize: '10px', color: 'var(--text-3)', fontWeight: '800', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: '14px' }}>
              VACCINATION STATUS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {petVax.length > 0 ? (
                petVax.map(v => (
                  <div key={v._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: v.status === 'Overdue' ? 'var(--red)' : v.status === 'Due soon' ? 'var(--amber)' : 'var(--green)', fontSize: '14px' }}>●</span>
                      <strong style={{ color: 'var(--text)' }}>{v.vaccine}</strong>
                    </div>
                    <span style={{ color: 'var(--text-3)', fontSize: '12px' }}>{new Date(v.dueDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>No vaccination records found</div>
              )}
            </div>
          </section>

        </div>

        {/* RIGHT COLUMN: TABS & TIMELINE CONTENT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* TAB HEADERS */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: '24px', paddingBottom: '4px' }}>
            {[
              ['Visit History', 'visits'],
              ['Weight Chart', 'weight'],
              ['Vaccinations', 'vaccines'],
              ['Prescriptions', 'prescriptions']
            ].map(([label, id]) => (
              <button 
                key={id} 
                style={{
                  border: 0,
                  borderBottom: activeTab === id ? '2px solid var(--brand)' : '2px solid transparent',
                  background: 'transparent',
                  padding: '6px 0 10px 0',
                  fontSize: '14px',
                  fontWeight: activeTab === id ? '700' : '500',
                  color: activeTab === id ? 'var(--brand)' : 'var(--text-3)',
                  cursor: 'pointer'
                }}
                onClick={() => setActiveTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* TAB CONTENT PANEL */}
          <div style={{ minHeight: '400px' }}>
            
            {/* VISIT HISTORY TIMELINE */}
            {activeTab === 'visits' && (
              <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', paddingLeft: '24px' }}>
                {/* Timeline vertical bar */}
                <div style={{
                  position: 'absolute',
                  left: '8px',
                  top: '12px',
                  bottom: '12px',
                  width: '2px',
                  background: 'var(--border)',
                  zIndex: '1'
                }} />
                
                {petVisits.length > 0 ? (
                  petVisits.map((visit, index) => {
                    const visitType = visit.assessment.includes('Vaccinations') ? 'Vaccination' : visit.assessment.includes('Gastro') ? 'Sick visit' : 'Annual Wellness';
                    const icon = visitType === 'Vaccination' ? '💉' : visitType === 'Sick visit' ? '💊' : '🩺';
                    const formattedDate = visit.createdAt ? new Date(visit.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'May 19, 2026';
                    
                    return (
                      <div key={visit._id} style={{ display: 'flex', gap: '16px', marginBottom: '20px', position: 'relative' }}>
                        {/* Timeline node */}
                        <div style={{
                          position: 'absolute',
                          left: '-26px',
                          top: '6px',
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          background: '#fff',
                          border: '2px solid var(--brand)',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: '11px',
                          zIndex: '2'
                        }}>
                          {icon}
                        </div>
                        
                        {/* Timeline Card */}
                        <div className="panel" style={{ flex: 1, padding: '14px 18px', background: '#fff', borderRadius: '12px', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '4px' }}>
                            {formattedDate} · {visit.vetName || 'Dr. Sarah Chen'} · {visitType}
                          </div>
                          <h4 style={{ fontSize: '15px', margin: '0 0 8px 0', fontWeight: '800', color: 'var(--text)' }}>
                            {visit.assessment.split('.')[0]}
                          </h4>
                          <p style={{ fontSize: '13px', color: 'var(--text-2)', margin: '0 0 12px 0', lineHeight: '1.4' }}>
                            {visit.subjective} {visit.objective} {visit.plan}
                          </p>
                          {visit.tags && visit.tags.length > 0 && (
                            <div className="chips">
                              {visit.tags.map(t => (
                                <span 
                                  className={`badge b-${t.includes('✓') || t.includes('Resolved') ? 'green' : t.includes('booster') || t.includes('needed') ? 'amber' : 'blue'}`} 
                                  key={t}
                                  style={{ fontSize: '11px', padding: '2px 8px' }}
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-3)' }}>No visit history found. Click Start Consultation to log one.</div>
                )}
              </div>
            )}

            {/* WEIGHT CHART TABS */}
            {activeTab === 'weight' && (
              <div className="panel" style={{ background: '#fff', borderRadius: '12px', padding: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div className="card-label" style={{ margin: 0 }}>Buddy Weight Log History</div>
                  <div style={{ display: 'inline-flex', gap: '8px' }}>
                    <input 
                      className="input" 
                      style={{ width: '80px', padding: '4px 8px', height: '30px' }} 
                      type="number" 
                      step="0.1" 
                      value={weightVal} 
                      onChange={(event) => setWeightVal(event.target.value)} 
                    />
                    <button 
                      className="btn btn-primary btn-sm" 
                      style={{ padding: '4px 10px' }}
                      onClick={() => {
                        if (!weightVal) return;
                        create('weights', { 
                          petName: pet.name, 
                          ownerName: ownerName, 
                          value: Number(weightVal), 
                          unit: 'lbs', 
                          date: new Date().toISOString().slice(0, 10), 
                          note: 'Routine check' 
                        }).then(() => {
                          alert('Weight log saved successfully!');
                        });
                      }}
                    >
                      Log
                    </button>
                  </div>
                </div>

                <div className="grid-two" style={{ gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div className="chart-bars" style={{ height: '140px' }}>
                      {petWeights.map((row) => (
                        <div key={row._id} style={{ height: `${Math.min(100, row.value * 2.8)}px` }} title={`${row.value} lbs`} />
                      ))}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-3)', textAlign: 'center' }}>
                      Chronological weight values (lbs)
                    </div>
                  </div>
                  <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                    {petWeights.map((row) => (
                      <div className="log-row" key={row._id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', padding: '6px 0', fontSize: '12px' }}>
                        <strong>{row.value} {row.unit || 'lbs'}</strong>
                        <span style={{ color: 'var(--text-3)' }}>{row.date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* VACCINATIONS TAB */}
            {activeTab === 'vaccines' && (
              <section className="panel no-pad" style={{ background: '#fff', borderRadius: '12px' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: '14px' }}>Vaccine</th>
                      <th>Last Administered</th>
                      <th>Next Due Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {petVax.length > 0 ? (
                      petVax.map(v => (
                        <tr key={v._id}>
                          <td style={{ paddingLeft: '14px', fontWeight: '700', color: 'var(--text)' }}>{v.vaccine}</td>
                          <td>{v.lastDate || 'N/A'}</td>
                          <td>{v.dueDate}</td>
                          <td><Badge value={v.status} /></td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-3)' }}>
                          No vaccination logs available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
            )}

            {/* PRESCRIPTIONS TAB */}
            {activeTab === 'prescriptions' && (
              <section className="panel no-pad" style={{ background: '#fff', borderRadius: '12px' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: '14px' }}>Prescription / Drug</th>
                      <th>Instructions</th>
                      <th>Visit Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {petVisits.flatMap(v => {
                      const list = [];
                      if (v.plan.includes('Otomax')) {
                        list.push({ id: v._id + '1', drug: 'Otomax ear drops', instruction: 'Apply Otomax ointment twice daily for 7 days', date: v.createdAt ? new Date(v.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'May 19, 2026', status: 'Active' });
                      }
                      if (v.plan.includes('Metronidazole')) {
                        list.push({ id: v._id + '2', drug: 'Metronidazole 250mg', instruction: 'Take twice daily for 5 days', date: v.createdAt ? new Date(v.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Nov 12, 2025', status: 'Completed' });
                      }
                      return list;
                    }).length > 0 ? (
                      petVisits.flatMap(v => {
                        const list = [];
                        if (v.plan.includes('Otomax')) {
                          list.push({ id: v._id + '1', drug: 'Otomax ear drops', instruction: 'Apply Otomax ointment twice daily for 7 days', date: v.createdAt ? new Date(v.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'May 19, 2026', status: 'Active' });
                        }
                        if (v.plan.includes('Metronidazole')) {
                          list.push({ id: v._id + '2', drug: 'Metronidazole 250mg', instruction: 'Take twice daily for 5 days', date: v.createdAt ? new Date(v.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Nov 12, 2025', status: 'Completed' });
                        }
                        return list;
                      }).map(p => (
                        <tr key={p.id}>
                          <td style={{ paddingLeft: '14px', fontWeight: '700', color: 'var(--text)' }}>{p.drug}</td>
                          <td>{p.instruction}</td>
                          <td>{p.date}</td>
                          <td>
                            <span className={`badge b-${p.status === 'Active' ? 'blue' : 'green'}`}>{p.status}</span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-3)' }}>
                          No active or completed prescriptions logged
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
            )}

          </div>

        </div>

      </div>
    </Screen>
  );
}

function Vaccinations({ rows, update }) {
  return <Screen title="Vaccination Tracker" sub="Clinic-wide · Auto-reminders enabled" action={<button className="btn btn-accent">Send Reminder Batch</button>}>
    <Table headers={['Pet', 'Owner', 'Vaccine', 'Due Date', 'Status', 'Reminder', 'Action']}>
      {rows.map((row) => <tr key={row._id}><td><Name title={row.petName} sub={row.breed} /></td><td>{row.ownerName}</td><td>{row.vaccine}</td><td>{row.dueDate}</td><td><Badge value={row.status} /></td><td>{row.reminderStatus}</td><td><button className="btn btn-outline btn-sm" onClick={() => update('vaccinations', row._id, { reminderStatus: 'Sent just now' })}>Notify Owner</button></td></tr>)}
    </Table>
  </Screen>;
}

function Booking({ vets, clients, appointments, create, bookingClient, setBookingClient, bookingPet, setBookingPet, go }) {
  const [isBookingFlow, setIsBookingFlow] = useState(() => {
    return !!bookingClient;
  });
  const [openRegisterModal, setOpenRegisterModal] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('today');

  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [selectedVet, setSelectedVet] = useState(vets[0] || null);
  const [visitType, setVisitType] = useState('Annual Wellness Exam');
  const [selectedTime, setSelectedTime] = useState(null);
  const [isBookedSuccess, setIsBookedSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!selectedVet && vets.length > 0) {
      setSelectedVet(vets[0]);
    }
  }, [vets, selectedVet]);

  useEffect(() => {
    if (bookingClient && (!bookingPet || !bookingClient.pets.some(p => p.name === bookingPet.name))) {
      setBookingPet(bookingClient.pets[0] || null);
    }
  }, [bookingClient, bookingPet, setBookingPet]);

  useEffect(() => {
    setIsBookedSuccess(false);
  }, [bookingClient, bookingPet, selectedDate, selectedVet, visitType, selectedTime]);

  const clientsFiltered = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const q = searchQuery.toLowerCase();
    return clients.filter(c => c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q)) || (c.email && c.email.toLowerCase().includes(q)));
  }, [clients, searchQuery]);

  const allPossibleSlots = ['09:00', '09:15', '09:30', '09:45', '10:00', '10:15', '10:30', '10:45', '11:00', '11:15', '11:30', '11:45' ,'12:00' , '21:00'];

  const getSlotStatus = (slotTime) => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (selectedDate === todayStr) {
      const now = new Date();
      const [sh, sm] = slotTime.split(':');
      const slotDateTime = new Date();
      slotDateTime.setHours(parseInt(sh), parseInt(sm), 0, 0);
      if (slotDateTime <= now) {
        return 'past';
      }
    }

    const normalizedTime = slotTime;
    const isBooked = appointments.some(appt => {
      if (appt.date !== selectedDate) return false;
      if (selectedVet && appt.vetName !== selectedVet.name) return false;
      const apptTime = appt.time.replace(/\s*[AP]M\s*$/i, '');
      return apptTime === normalizedTime && appt.status !== 'Cancelled';
    });

    if (isBooked) return 'booked';
    if (selectedTime === slotTime) return 'selected';

    return 'available';
  };

  const handleConfirm = () => {
    if (!bookingClient || !bookingPet || !selectedVet || !selectedTime) {
      alert('Please select client, pet, vet, and time slot!');
      return;
    }

    const appointmentBody = {
      petName: bookingPet.name,
      petSpecies: bookingPet.species,
      petBreed: bookingPet.breed || '',
      ownerName: bookingClient.name,
      vetName: selectedVet.name,
      reason: visitType,
      date: selectedDate,
      time: selectedTime,
      type: visitType.includes('Vaccin') ? 'Vaccination' : visitType.includes('Follow') ? 'Follow-up' : 'Checkup',
      status: 'Scheduled'
    };

    create('appointments', appointmentBody).then(() => {
      setIsBookedSuccess(true);
      alert(`Appointment successfully booked for ${bookingPet.name} with ${selectedVet.name} at ${selectedTime}!`);
      setBookingClient(null);
      setBookingPet(null);
      setSelectedTime(null);
      setIsBookingFlow(false);
    }).catch(err => {
      alert('Failed to book appointment: ' + err.message);
    });
  };

  const format12h = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hr = parseInt(h);
    const ampm = hr >= 12 ? 'PM' : 'AM';
    const hr12 = hr % 12 || 12;
    return `${hr12}:${m} ${ampm}`;
  };

  const petEmoji = (species = '') => {
    const s = species.toLowerCase();
    if (s.includes('dog')) return '🐶';
    if (s.includes('cat')) return '🐱';
    if (s.includes('rabbit') || s.includes('lop')) return '🐰';
    if (s.includes('parrot') || s.includes('bird')) return '🦜';
    return '🐾';
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const getFilteredAppointments = () => {
    if (activeSubTab === 'today') {
      return appointments.filter(a => a.date === todayStr);
    }
    if (activeSubTab === 'week') {
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      startOfWeek.setHours(0,0,0,0);
      const endOfWeek = new Date(today);
      endOfWeek.setDate(today.getDate() - today.getDay() + 6);
      endOfWeek.setHours(23,59,59,999);
      
      return appointments.filter(a => {
        const d = new Date(a.date);
        return d >= startOfWeek && d <= endOfWeek;
      });
    }
    if (activeSubTab === 'upcoming') {
      return appointments.filter(a => a.date > todayStr);
    }
    return appointments;
  };

  const filteredAppts = getFilteredAppointments();

  if (!isBookingFlow) {
    return (
      <Screen 
        title="Appointments" 
        sub="Manage clinic appointments and schedule slots" 
        action={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-outline" style={{ background: '#fff' }} onClick={() => setOpenRegisterModal(true)}>
              + Register New Client
            </button>
            <button className="btn btn-primary" onClick={() => { setIsBookingFlow(true); setBookingClient(null); setBookingPet(null); setSelectedTime(null); }}>
              + Book Appointment
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: '24px', paddingBottom: '4px', marginBottom: '16px' }}>
          {[
            ['today', "Today's Appointments"],
            ['week', 'This Week'],
            ['upcoming', 'Upcoming'],
            ['all', 'All Appointments']
          ].map(([id, label]) => (
            <button 
              key={id} 
              style={{
                border: 0,
                borderBottom: activeSubTab === id ? '2px solid var(--brand)' : '2px solid transparent',
                background: 'transparent',
                padding: '6px 0 10px 0',
                fontSize: '14px',
                fontWeight: activeSubTab === id ? '700' : '500',
                color: activeSubTab === id ? 'var(--brand)' : 'var(--text-3)',
                cursor: 'pointer'
              }}
              onClick={() => setActiveSubTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <section className="panel no-pad" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '12px' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ paddingLeft: '18px' }}>PET / CLIENT</th>
                <th>VETERINARIAN</th>
                <th>REASON / TYPE</th>
                <th>DATE</th>
                <th>TIME</th>
                <th>STATUS</th>
                <th style={{ textAlign: 'right', paddingRight: '24px' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredAppts.length > 0 ? (
                filteredAppts.map((appt) => (
                  <tr key={appt._id}>
                    <td style={{ paddingLeft: '18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '18px' }}>{petEmoji(appt.petSpecies || appt.species || appt.petBreed)}</span>
                        <div>
                          <strong style={{ fontSize: '14px', color: 'var(--text)' }}>{appt.petName}</strong>
                          <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>{appt.ownerName}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-2)', fontWeight: '500' }}>{appt.vetName || 'Dr. Sarah Chen'}</td>
                    <td>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>{appt.reason}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{appt.type || 'Checkup'}</div>
                    </td>
                    <td style={{ color: 'var(--text-2)' }}>{new Date(appt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td style={{ color: 'var(--text)', fontWeight: '700' }}>{format12h(appt.time)}</td>
                    <td>
                      <Badge value={appt.status || 'Scheduled'} />
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: '24px' }}>
                      <button 
                        className="btn btn-outline btn-sm" 
                        style={{ padding: '6px 10px', fontSize: '12px' }}
                        onClick={() => go('soap')}
                      >
                        Start Consultation
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-3)' }}>
                    No appointments scheduled under this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {openRegisterModal && (
          <ClientModal 
            onClose={() => setOpenRegisterModal(false)} 
            onSave={(body) => create('clients', body).then((createdClient) => {
              setBookingClient(createdClient);
              if (createdClient.pets && createdClient.pets.length > 0) {
                setBookingPet(createdClient.pets[0]);
              }
              setIsBookingFlow(true);
              setOpenRegisterModal(false);
            })} 
          />
        )}
      </Screen>
    );
  }

  if (!bookingClient) {
    return (
      <Screen 
        title="Book Appointment — Step 1 of 3" 
        sub="Find and select a client account to begin"
        action={
          <button className="btn btn-outline" style={{ background: '#fff' }} onClick={() => setIsBookingFlow(false)}>
            ◀ Back to Appointments
          </button>
        }
      >
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="search-row">
            <input 
              className="search-box" 
              placeholder="Search client by owner name, email, or phone..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <section className="panel no-pad" style={{ background: '#fff', borderRadius: '12px', maxHeight: '420px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: '18px' }}>Owner</th>
                  <th>Contact</th>
                  <th style={{ textAlign: 'right', paddingRight: '18px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {clientsFiltered.length > 0 ? (
                  clientsFiltered.map(c => (
                    <tr key={c._id}>
                      <td style={{ paddingLeft: '18px', fontWeight: '700', color: 'var(--text)' }}>{c.name}</td>
                      <td>{c.email} · {c.phone}</td>
                      <td style={{ textAlign: 'right', paddingRight: '18px' }}>
                        <button className="btn btn-primary btn-sm" onClick={() => setBookingClient(c)}>Select</button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-3)' }}>
                      No clients found matching your query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
          
          <button 
            type="button" 
            className="btn btn-outline" 
            style={{
              border: '1px dashed var(--brand)',
              color: 'var(--brand)',
              background: '#f0f9ff',
              width: '100%',
              padding: '12px',
              justifyContent: 'center',
              fontWeight: '700',
              marginTop: '8px'
            }}
            onClick={() => setOpenRegisterModal(true)}
          >
            ➕ Register New Client
          </button>
        </div>

        {openRegisterModal && (
          <ClientModal 
            onClose={() => setOpenRegisterModal(false)} 
            onSave={(body) => create('clients', body).then((createdClient) => {
              setBookingClient(createdClient);
              if (createdClient.pets && createdClient.pets.length > 0) {
                setBookingPet(createdClient.pets[0]);
              }
              setIsBookingFlow(true);
              setOpenRegisterModal(false);
            })} 
          />
        )}
      </Screen>
    );
  }

  return (
    <Screen 
      title="Book Appointment" 
      sub="Step 3 of 3 — Select time slot & confirm"
    >
      <div className="steps" style={{ marginBottom: '20px' }}>
        <span className="step done" style={{ cursor: 'pointer', background: 'var(--brand)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setBookingClient(null)}>
          ✓
        </span>
        <span style={{ background: 'var(--brand)' }} />
        <span className="step done" style={{ background: 'var(--brand)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ✓
        </span>
        <span style={{ background: 'var(--brand)' }} />
        <span className="step current" style={{ background: 'var(--brand)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 4px var(--brand-light)' }}>
          3
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '14px 18px', borderRadius: '12px' }}>
            <div>
              <div className="sb-field-label" style={{ color: 'var(--text-3)', fontSize: '10px' }}>Selected client</div>
              <strong style={{ fontSize: '15px', color: 'var(--text)' }}>
                {bookingClient.name} · <span style={{ fontWeight: '500', color: 'var(--text-2)' }}>{bookingClient.email}</span>
              </strong>
            </div>
            <button 
              className="btn btn-outline btn-sm" 
              style={{ color: 'var(--brand)', borderColor: 'var(--brand)' }} 
              onClick={() => {
                setBookingClient(null);
                setBookingPet(null);
                setSelectedTime(null);
              }}
            >
              Change
            </button>
          </div>

          <div className="panel" style={{ background: '#fff', padding: '16px 18px', borderRadius: '12px' }}>
            <div className="card-label" style={{ fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '12px' }}>
              Select pet ({bookingClient.name} has {(bookingClient.pets || []).length} pets)
            </div>
            
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {(bookingClient.pets || []).map((pet) => {
                const isSelected = bookingPet && bookingPet.name === pet.name;
                return (
                  <div 
                    key={pet._id || pet.name}
                    style={{
                      border: isSelected ? '2px solid var(--brand)' : '1px solid var(--border)',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      width: '210px',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(37,99,235,0.03)' : '#fff',
                      position: 'relative'
                    }}
                    onClick={() => {
                      setBookingPet(pet);
                      setSelectedTime(null);
                    }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text)' }}>
                      {petEmoji(pet.species)} {pet.name}
                      {isSelected && (
                        <span className="badge b-blue" style={{ fontSize: '9px', padding: '1px 6px', marginLeft: 'auto' }}>
                          Selected ✓
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '4px' }}>
                      {pet.breed || 'Golden Retriever'} · {pet.age || '4 yrs'}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-3)', marginTop: '12px' }}>
              💡 If bringing multiple pets, book separate consecutive slots — each pet needs its own SOAP note
            </div>
          </div>

          <div className="panel" style={{ background: '#fff', padding: '16px 18px', borderRadius: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <label className="field-label">
                Booking Date *
                <input 
                  className="input" 
                  type="date" 
                  value={selectedDate} 
                  onChange={e => {
                    setSelectedDate(e.target.value);
                    setSelectedTime(null);
                  }} 
                />
              </label>

              <label className="field-label">
                Veterinarian *
                <select 
                  className="input" 
                  value={selectedVet ? selectedVet.name : ''} 
                  onChange={e => {
                    const found = vets.find(v => v.name === e.target.value);
                    setSelectedVet(found || null);
                    setSelectedTime(null);
                  }}
                >
                  {vets.map(v => <option key={v._id} value={v.name}>{v.name}</option>)}
                </select>
              </label>

              <label className="field-label">
                Visit type *
                <select 
                  className="input" 
                  value={visitType} 
                  onChange={e => setVisitType(e.target.value)}
                >
                  <option value="Annual Wellness Exam">Annual Wellness Exam</option>
                  <option value="Sick Visit / Diagnostics">Sick Visit / Diagnostics</option>
                  <option value="Vaccination Appointment">Vaccination Appointment</option>
                  <option value="Follow-up Checkup">Follow-up Checkup</option>
                  <option value="Dental Scaling & Cleaning">Dental Scaling & Cleaning</option>
                </select>
              </label>
            </div>
          </div>

          <div className="panel" style={{ background: '#fff', padding: '16px 18px', borderRadius: '12px' }}>
            <div className="card-label" style={{ fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Available slots — {new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '14px' }}>
              Green = available · Grey = booked/disabled · Blue = selected
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px' }}>
              {allPossibleSlots.map((slot) => {
                const status = getSlotStatus(slot);
                const formattedTime = format12h(slot);
                
                let btnStyle = {
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  color: 'var(--text-2)',
                  cursor: 'pointer',
                  borderRadius: '6px',
                  padding: '10px 4px',
                  fontSize: '12px',
                  fontWeight: '700',
                  textAlign: 'center',
                  transition: 'all 0.15s ease'
                };

                if (status === 'past' || status === 'booked') {
                  btnStyle.background = '#f1f5f9';
                  btnStyle.color = '#cbd5e1';
                  btnStyle.borderColor = '#e2e8f0';
                  btnStyle.cursor = 'not-allowed';
                  btnStyle.fontWeight = '500';
                } else if (status === 'selected') {
                  btnStyle.background = 'var(--brand)';
                  btnStyle.color = '#fff';
                  btnStyle.borderColor = 'var(--brand)';
                } else {
                  btnStyle.background = '#f0fdf4';
                  btnStyle.color = 'var(--green)';
                  btnStyle.borderColor = '#bbf7d0';
                }

                const handleClickSlot = () => {
                  if (status === 'past' || status === 'booked') return;
                  setSelectedTime(slot);
                };

                return (
                  <button 
                    key={slot} 
                    type="button"
                    style={btnStyle}
                    onClick={handleClickSlot}
                    disabled={status === 'past' || status === 'booked'}
                  >
                    {formattedTime.replace(' AM', '').replace(' PM', '')}
                    {status === 'selected' ? ' ✓' : ''}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{
          background: '#0b1329',
          border: '1px solid #1e293b',
          borderRadius: '16px',
          padding: '24px 20px',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)'
        }}>
          <h3 style={{ fontSize: '17px', fontWeight: '800', margin: '0 0 16px 0', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px', color: '#fff' }}>
            Appointment Summary
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: '#94a3b8' }}>Pet</span>
              <strong style={{ color: '#fff' }}>{bookingPet ? `${petEmoji(bookingPet.species)} ${bookingPet.name}` : 'Not selected'}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: '#94a3b8' }}>Owner</span>
              <strong style={{ color: '#fff' }}>{bookingClient.name}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: '#94a3b8' }}>Vet</span>
              <strong style={{ color: '#fff' }}>{selectedVet ? selectedVet.name : 'Not selected'}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: '#94a3b8' }}>Visit type</span>
              <strong style={{ color: '#fff' }}>{visitType.split(' / ')[0]}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: '#94a3b8' }}>Date</span>
              <strong style={{ color: '#fff' }}>{new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: '#94a3b8' }}>Time</span>
              <strong style={{ color: '#fff' }}>{selectedTime ? format12h(selectedTime) : 'Select a slot'}</strong>
            </div>
          </div>

          <button 
            type="button"
            className="btn btn-primary" 
            style={{ width: '100%', padding: '12px', justifyContent: 'center', fontSize: '14px', background: 'var(--brand)', color: '#fff' }}
            onClick={handleConfirm}
            disabled={isBookedSuccess}
          >
            Confirm Appointment
          </button>

          {isBookedSuccess && (
            <div style={{ fontSize: '11px', color: '#60a5fa', textAlign: 'center', marginTop: '12px', fontWeight: '500' }}>
              Confirmation email sent to {bookingClient.email}
            </div>
          )}
        </div>
      </div>
      
      {openRegisterModal && (
        <ClientModal 
          onClose={() => setOpenRegisterModal(false)} 
          onSave={(body) => create('clients', body).then((createdClient) => {
            setBookingClient(createdClient);
            if (createdClient.pets && createdClient.pets.length > 0) {
              setBookingPet(createdClient.pets[0]);
            }
            setIsBookingFlow(true);
            setOpenRegisterModal(false);
          })} 
        />
      )}
    </Screen>
  );
}

function Soap({ note, create }) {
  const [draft, setDraft] = useState(note || { subjective: '', objective: '', assessment: '', plan: '' });
  const [transcript, setTranscript] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorInfo, setErrorInfo] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordTimer, setRecordTimer] = useState(0);
  const [recordingIntervalId, setRecordingIntervalId] = useState(null);

  const presets = {
    ears: {
      label: "Buddy - Ear scratching (Dog)",
      text: "Owner states Buddy has been shaking his head and scratching his right ear persistently for 3 days. A dark discharge and strong odor are present. Doctor examined ears: Right ear canal is erythematous, stenotic with abundant waxy brown exudate. Tympanic membrane is intact. Left ear is clear. Diagnosed Otitis Externa. Treatment: Thorough clean, apply Otomax ointment twice daily for 7 days. Follow up in 7 days."
    },
    cold: {
      label: "Luna - Sneezing & Nasal discharge (Cat)",
      text: "Owner reports Luna has been sneezing, has clear nasal discharge, and has been slightly lethargic for 2 days. Appetite is reduced. Temp is 101.8 F. Clear lung fields, normal respiratory effort. Serous ocular and nasal discharge, mildly congested. Assessment: Upper Respiratory Infection (URI). Plan: Supplement with L-Lysine, keep warm and hydrated, soft food. Follow up if she stops eating."
    },
    tummy: {
      label: "Rocky - Acute Gastroenteritis (Dog)",
      text: "Owner noted Rocky vomited twice last night and has soft diarrhea. He scavenged grass and soil yesterday. Weight is 28.5kg. Dog is bright, alert, and responsive. Hydration is normal. Abdomen soft, non-painful on palpation. Diagnosis: Acute Gastroenteritis. Plan: Fast for 12 hours, then bland diet of chicken and rice for 3 days. Metronidazole 250mg twice daily for 5 days. Monitor hydration closely."
    }
  };

  const startRecording = () => {
    setIsRecording(true);
    setRecordTimer(0);
    const interval = setInterval(() => {
      setRecordTimer(prev => prev + 1);
    }, 1000);
    setRecordingIntervalId(interval);
  };

  const stopRecording = () => {
    if (recordingIntervalId) {
      clearInterval(recordingIntervalId);
      setRecordingIntervalId(null);
    }
    setIsRecording(false);
    // Auto-populate with ears template if transcript is empty
    if (!transcript) {
      setTranscript(presets.ears.text);
    }
  };

  const handlePresetChange = (key) => {
    if (presets[key]) {
      setTranscript(presets[key].text);
    }
  };

  const handleAIAssist = async () => {
    if (!transcript.trim()) {
      alert("Please enter a transcript or select a template first!");
      return;
    }
    setIsGenerating(true);
    setErrorInfo('');
    try {
      const res = await fetch(`${API_URL}/ai/process-transcript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          appointment_id: note?.appointment_id || undefined,
          duration_seconds: recordTimer || 45
        })
      });
      if (!res.ok) throw new Error("Claude AI processed using simulation fallback.");
      const result = await res.json();
      if (result.success && result.preview) {
        setDraft({
          subjective: result.preview.subjective,
          objective: result.preview.objective,
          assessment: result.preview.assessment,
          plan: result.preview.plan
        });
      }
    } catch (err) {
      console.warn(err.message);
      // Seamless mock fallback executed immediately on failure
      const simulatedText = transcript.toLowerCase();
      let subjective = `Owner reports: ${transcript}`;
      let objective = "Vital signs stable, clear chest, normal abdominal palpation.";
      let assessment = "Observation needed.";
      let plan = "Monitor at home.";

      if (simulatedText.includes("ear") || simulatedText.includes("scratch")) {
        assessment = "Otitis Externa (Ear Infection)";
        plan = "Clean ears, apply Otomax ointment twice daily for 7 days. Recheck in 1 week.";
      } else if (simulatedText.includes("sneeze") || simulatedText.includes("cold")) {
        assessment = "Feline Upper Respiratory Infection (URI)";
        plan = "L-Lysine supplements, keep hydrated, soft food. Monitor appetite.";
      } else if (simulatedText.includes("vomit") || simulatedText.includes("diarrhea")) {
        assessment = "Acute Gastroenteritis";
        plan = "Bland diet (chicken & rice) for 3 days. Metronidazole 250mg twice daily for 5 days.";
      }

      setDraft({
        subjective,
        objective,
        assessment,
        plan
      });
      setErrorInfo('Claude AI offline: Seamlessly resolved with local veterinary clinical fallback.');
    } finally {
      setIsGenerating(false);
    }
  };

  return <Screen title="Veterinary AI SOAP Note" sub="Intelligent audio transcription & SOAP consultation modules">
    <div className="grid-two" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)', gap: '20px' }}>
      
      {/* AI AUDIO & TRANSCRIPT PANEL */}
      <section className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div className="card-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>AI Audio Recorder & Transcript</span>
          {isRecording && <span className="badge b-red" style={{ animation: 'pulse 1.2s infinite' }}>● RECORDING ({recordTimer}s)</span>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label className="sb-field-label" style={{ color: 'var(--text-2)' }}>Select Demo Preset Template</label>
          <select className="sb-select" style={{ background: '#fff', border: '1px solid #cbd5e1', color: 'var(--text)' }} onChange={(e) => handlePresetChange(e.target.value)}>
            <option value="">-- Choose consultation scenario --</option>
            {Object.entries(presets).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
          <label className="sb-field-label" style={{ color: 'var(--text-2)' }}>Raw Dialogue / Audio Transcript</label>
          <textarea 
            className="input" 
            style={{ flex: 1, minHeight: '160px', resize: 'vertical', fontFamily: 'inherit', fontSize: '13px', lineHeight: '1.5' }} 
            placeholder="Type or paste doctor-owner dialogue here, or click Record to simulate audio transcript..." 
            value={transcript} 
            onChange={(e) => setTranscript(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {!isRecording ? (
            <button className="btn btn-outline" style={{ flex: 1, color: 'var(--red)', borderColor: 'var(--red)', background: '#fef2f2' }} onClick={startRecording}>
              🎙 Simulate Audio Record
            </button>
          ) : (
            <button className="btn btn-primary" style={{ flex: 1, background: 'var(--red)' }} onClick={stopRecording}>
              ⏹ Stop & Auto-Transcribe
            </button>
          )}

          <button className="btn btn-accent" style={{ flex: 1 }} onClick={handleAIAssist} disabled={isGenerating}>
            {isGenerating ? "⚡ Parsing..." : "✨ Claude AI Assist"}
          </button>
        </div>

        {errorInfo && (
          <div className="badge b-amber" style={{ padding: '8px 12px', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '2px', borderRadius: '8px' }}>
            <strong>💡 Fallback Active:</strong>
            <span>{errorInfo}</span>
          </div>
        )}
      </section>

      {/* SOAP NOTE EDITOR */}
      <section className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div className="card-label">SOAP Medical Documentation</div>

        <div className="soap-grid" style={{ gridTemplateColumns: '1fr', gap: '10px' }}>
          {['subjective', 'objective', 'assessment', 'plan'].map((field) => (
            <label className="soap-card" key={field} style={{ padding: '10px 12px' }}>
              <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--brand)', textTransform: 'uppercase' }}>
                {field[0].toUpperCase()} · {field}
              </span>
              <textarea 
                style={{ width: '100%', minHeight: '60px', height: '65px', fontSize: '13px', padding: '4px 0', border: 0, resize: 'vertical' }} 
                placeholder={`Enter clinical ${field} data...`}
                value={draft[field] || ''} 
                onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} 
              />
            </label>
          ))}
        </div>

        <button 
          className="btn btn-primary" 
          style={{ width: '100%', padding: '10px', justifyContent: 'center' }} 
          onClick={() => {
            const { _id, createdAt, updatedAt, __v, clinic_id, ...rest } = draft;
            create('soapnotes', { 
              ...rest, 
              petName: rest.petName || 'Buddy', 
              ownerName: rest.ownerName || 'James Martinez', 
              vetName: rest.vetName || 'Dr. Sarah Chen' 
            }).then(() => {
              alert("SOAP Medical Note saved successfully!");
            });
          }}
        >
          💾 Save SOAP Consultation Note
        </button>
      </section>

    </div>
  </Screen>;
}

function Weights({ weights, create }) {
  const [value, setValue] = useState('32.4');
  const buddy = weights.filter((row) => row.petName === 'Buddy');
  return <Screen title="Weight Tracker · Buddy" sub="Golden Retriever · healthy range: 29-34 lbs" action={<button className="btn btn-primary btn-sm" onClick={() => create('weights', { petName: 'Buddy', ownerName: 'James Martinez', value: Number(value), unit: 'lbs', date: new Date().toISOString().slice(0, 10), note: 'Manual entry' })}>+ Log Weight</button>}>
    <div className="grid-two">
      <section className="panel"><div className="chart-bars">{buddy.map((row) => <div key={row._id} style={{ height: `${row.value * 4}px` }} title={`${row.value} lbs`} />)}</div><input className="input" value={value} onChange={(event) => setValue(event.target.value)} /></section>
      <section className="panel">{buddy.map((row) => <div className="log-row" key={row._id}><strong>{row.value} {row.unit}</strong><span>{row.date}</span><span>{row.note}</span></div>)}</section>
    </div>
  </Screen>;
}

function FollowUps({ rows }) {
  return <Screen title="Follow-up Tracker" sub="Planned vs confirmed dates">
    <Table headers={['Pet / Owner', 'Vet', 'Purpose', 'Plan Date', 'Confirmed Date', 'Priority', 'Status']}>
      {rows.map((row) => <tr key={row._id}><td><Name title={row.petName} sub={row.ownerName} /></td><td>{row.vetName}</td><td>{row.purpose}</td><td>{row.planDate}</td><td>{row.confirmedDate || 'Not confirmed'}</td><td>{row.priority}</td><td><Badge value={row.monitoring ? 'Watching' : row.status} /></td></tr>)}
    </Table>
  </Screen>;
}

function Calendar({ appointments, go }) {
  return <Screen title="Doctor Calendar" sub="Pet, owner, and reason visible in every slot">
    <div className="calendar-layout">
      <aside className="queue"><div className="card-label">Today's Queue</div>{appointments.slice(0, 4).map((appt) => <button key={appt._id} onClick={() => go('soap')}><strong>{appt.petName}</strong><span>{appt.ownerName} · {appt.reason}</span><small>{appt.time}</small></button>)}</aside>
      <section className="week-grid">{appointments.map((appt) => <button className={`cal-ev ${appt.status === 'Now' ? 'now' : ''}`} key={appt._id} onClick={() => go('soap')}><strong>{appt.time} · {appt.petName}</strong><span>{appt.ownerName}</span><small>{appt.reason}</small></button>)}</section>
    </div>
  </Screen>;
}

function Screen({ title, sub, action, children }) {
  return <div className="main-scroll"><div className="main-pad"><div className="topbar"><div><h2>{title}</h2><div className="sub">{sub}</div></div>{action}</div>{children}</div></div>;
}

function Table({ headers, children }) {
  return <section className="panel no-pad"><table className="data-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></section>;
}

function AppointmentList({ rows }) {
  const getPetMeta = (species = '', breed = '') => {
    const s = species.toLowerCase();
    const b = breed.toLowerCase();
    if (s.includes('dog') || b.includes('retriever') || b.includes('bulldog')) return { emoji: '🐶', bg: '#eff6ff', color: '#1d4ed8' };
    if (s.includes('cat') || b.includes('siamese')) return { emoji: '🐱', bg: '#fce7f3', color: '#db2777' };
    if (s.includes('rabbit') || b.includes('lop')) return { emoji: '🐰', bg: '#fef3c7', color: '#d97706' };
    if (s.includes('parrot') || s.includes('bird') || b.includes('grey')) return { emoji: '🦜', bg: '#dcfce7', color: '#16a34a' };
    return { emoji: '🐾', bg: '#f1f5f9', color: '#475569' };
  };

  return (
    <div className="appointment-list">
      {rows.length > 0 ? (
        rows.map((row) => {
          const { emoji, bg } = getPetMeta(row.petSpecies || '', row.petBreed || row.breed || '');
          let badgeVal = '';
          if (row.petName === 'Buddy') badgeVal = 'Now';
          else if (row.petName === 'Luna') badgeVal = 'Follow-up';

          return (
            <div className="appt" key={row._id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: bg, display: 'grid', placeItems: 'center', fontSize: '20px', flexShrink: 0 }}>
                {emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <strong style={{ fontSize: '14px', color: 'var(--text)' }}>{row.petName}</strong>
                  <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>· {row.petBreed || row.breed || 'Golden Retriever'}</span>
                </div>
                <span style={{ display: 'block', color: 'var(--text-2)', fontSize: '12px', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.ownerName} · {row.reason} · {row.vetName || 'Dr. Sarah Chen'}
                </span>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <strong style={{ display: 'block', fontSize: '14px', color: 'var(--text)' }}>{row.time}</strong>
                {badgeVal && (
                  <span className={`badge b-${badgeVal === 'Now' ? 'blue' : 'purple'}`} style={{ marginTop: '4px', fontSize: '10px', padding: '1px 6px' }}>
                    {badgeVal}
                  </span>
                )}
              </div>
            </div>
          );
        })
      ) : (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-3)' }}>No appointments scheduled for today</div>
      )}
    </div>
  );
}

function Alert({ title, meta }) {
  return <div className="alert-row"><strong>{title}</strong><span>{meta}</span></div>;
}

function Name({ title, sub }) {
  return <div><div className="td-name">{title}</div><div className="td-sub">{sub}</div></div>;
}

function Badge({ value, tone }) {
  const isOverdue = String(value).includes('Overdue') || String(value).includes('alert') || String(value).includes('overdue');
  const isAvailable = String(value).includes('Available') || String(value).includes('Up to date') || String(value).includes('active');
  const isPending = String(value).includes('Pending') || String(value).includes('Due') || String(value).includes('soon') || String(value).includes('Consultation');
  
  const color = tone || (isOverdue ? 'red' : isAvailable ? 'green' : isPending ? 'amber' : 'blue');
  return <span className={`badge b-${color}`}>{value}</span>;
}

function Input({ label, value, onChange, type = 'text' }) {
  return <label className="field-label">{label}<input className="input" type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Select({ label, value, onChange, options }) {
  return <label className="field-label">{label}<select className="input" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function VetModal({ vet, onClose, onSave }) {
  const [name, setName] = useState(vet?.name || '');
  const [email, setEmail] = useState(vet?.email || '');
  const [phone, setPhone] = useState(vet?.phone || '');
  const [specialization, setSpecialization] = useState(vet?.specialization || 'General Practice');
  const [license, setLicense] = useState(vet?.license || '');
  const [experienceYears, setExperienceYears] = useState(vet?.experienceYears || '');
  const [consultationFee, setConsultationFee] = useState(vet?.consultationFee || '');
  const [status, setStatus] = useState(vet?.status || 'Available');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !email || !phone) {
      alert("Please fill in all required fields!");
      return;
    }
    if (!/^\d{10}$/.test(phone)) {
      alert("Phone number must be exactly 10 digits (numeric only)!");
      return;
    }
    
    onSave({
      name,
      email,
      phone,
      specialization,
      license,
      experienceYears: experienceYears ? Number(experienceYears) : undefined,
      consultationFee: consultationFee ? Number(consultationFee) : undefined,
      status
    });
  };

  const specs = [
    'General Practice',
    'Surgery & Dentistry',
    'Exotic Animals',
    'Dermatology & Oncology',
    'Cardiology',
    'Neurology'
  ];

  return (
    <Modal title={vet ? "Edit Veterinarian Details" : "Onboard Veterinarian"} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
          <label className="field-label">
            Full Name *
            <input 
              className="input" 
              required 
              placeholder="e.g. Dr. Sarah Chen" 
              value={name} 
              onChange={e => setName(e.target.value)} 
            />
          </label>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <label className="field-label">
              Email *
              <input 
                className="input" 
                required 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
              />
            </label>
            <label className="field-label">
              Phone *
              <input 
                className="input" 
                required 
                placeholder="10 digits" 
                pattern="\d{10}" 
                title="Phone number must be exactly 10 digits (numeric only)"
                value={phone} 
                onChange={e => setPhone(e.target.value)} 
              />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <label className="field-label">
              Specialization *
              <select 
                className="input" 
                value={specialization} 
                onChange={e => setSpecialization(e.target.value)}
              >
                {specs.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="field-label">
              License Number
              <input 
                className="input" 
                value={license} 
                onChange={e => setLicense(e.target.value)} 
              />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <label className="field-label">
              Experience (years)
              <input 
                className="input" 
                type="number" 
                value={experienceYears} 
                onChange={e => setExperienceYears(e.target.value)} 
              />
            </label>
            <label className="field-label">
              Consultation Fee ($)
              <input 
                className="input" 
                type="number" 
                value={consultationFee} 
                onChange={e => setConsultationFee(e.target.value)} 
              />
            </label>
          </div>

          {vet && (
            <label className="field-label">
              Status
              <select 
                className="input" 
                value={status} 
                onChange={e => setStatus(e.target.value)}
              >
                <option value="Available">Available</option>
                <option value="In Consultation">In Consultation</option>
                <option value="On Leave">On Leave</option>
              </select>
            </label>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">{vet ? "Save Changes" : "Onboard"}</button>
        </div>
      </form>
    </Modal>
  );
}

function ClientModal({ onClose, onSave }) {
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  
  const [pets, setPets] = useState([
    { name: '', species: 'Dog', breed: '', dob: '', sex: 'Male', microchip: '', spayedNeutered: 'Yes' }
  ]);

  const addAnotherPet = () => {
    setPets([
      ...pets,
      { name: '', species: 'Dog', breed: '', dob: '', sex: 'Male', microchip: '', spayedNeutered: 'Yes' }
    ]);
  };

  const removePetForm = (index) => {
    if (pets.length === 1) return;
    setPets(pets.filter((_, idx) => idx !== index));
  };

  const handleUpdatePetField = (index, field, value) => {
    setPets(
      pets.map((p, idx) => (idx === index ? { ...p, [field]: value } : p))
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!ownerName || !email || !phone) {
      alert("Please fill in all required fields for the owner!");
      return;
    }
    if (!/^\d{10}$/.test(phone)) {
      alert("Owner phone number must be exactly 10 digits (numeric only)!");
      return;
    }

    for (let i = 0; i < pets.length; i++) {
      if (!pets[i].name.trim()) {
        alert(`Please specify a name for Pet #${i + 1}!`);
        return;
      }
    }

    const savedPets = pets.map(p => ({
      name: p.name,
      species: p.species,
      breed: p.breed || undefined,
      dateOfBirth: p.dob || undefined,
      sex: p.sex,
      microchip: p.microchip || undefined,
      spayedNeutered: p.spayedNeutered,
      petId: `PET-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      alerts: []
    }));

    onSave({
      name: ownerName,
      email,
      phone,
      pets: savedPets
    });
  };

  const speciesOptions = ['Dog', 'Cat', 'Rabbit', 'Parrot/Bird', 'Other'];
  const sexOptions = ['Male', 'Female'];
  const spayedOptions = ['Yes', 'No'];

  return (
    <Modal title="Register New Client & Pets" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '18px', maxHeight: '520px', overflowY: 'auto', paddingRight: '6px' }}>
          
          <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-3)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>
            Step 1 — Owner details
          </div>
          
          <label className="field-label">
            Owner Full Name *
            <input 
              className="input" 
              required 
              placeholder="e.g. James Martinez" 
              value={ownerName} 
              onChange={e => setOwnerName(e.target.value)} 
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <label className="field-label">
              Email *
              <input 
                className="input" 
                required 
                type="email" 
                placeholder="e.g. james.m@email.com"
                value={email} 
                onChange={e => setEmail(e.target.value)} 
              />
            </label>
            <label className="field-label">
              Phone *
              <input 
                className="input" 
                required 
                placeholder="10 digits" 
                pattern="\d{10}" 
                title="Phone number must be exactly 10 digits (numeric only)"
                value={phone} 
                onChange={e => setPhone(e.target.value)} 
              />
            </label>
          </div>

          <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-3)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', paddingBottom: '4px', marginTop: '8px' }}>
            Step 2 — Pet details (can register multiple pets)
          </div>

          {pets.map((pet, index) => (
            <div key={index} style={{
              border: '1px dashed #cbd5e1',
              borderRadius: '8px',
              padding: '14px',
              marginBottom: '10px',
              background: '#f8fafc',
              position: 'relative'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <strong style={{ fontSize: '12px', color: 'var(--brand)' }}>Pet #{index + 1}</strong>
                {pets.length > 1 && (
                  <button 
                    type="button" 
                    style={{
                      border: 0,
                      background: 'transparent',
                      color: 'var(--red)',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                    onClick={() => removePetForm(index)}
                  >
                    ✕ Remove Pet
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <label className="field-label">
                    Pet Name *
                    <input 
                      className="input" 
                      required 
                      placeholder="e.g. Buddy" 
                      value={pet.name} 
                      onChange={e => handleUpdatePetField(index, 'name', e.target.value)} 
                    />
                  </label>
                  <label className="field-label">
                    Species *
                    <select 
                      className="input" 
                      value={pet.species} 
                      onChange={e => handleUpdatePetField(index, 'species', e.target.value)}
                    >
                      {speciesOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '12px' }}>
                  <label className="field-label">
                    Breed
                    <input 
                      className="input" 
                      placeholder="e.g. Golden Retriever" 
                      value={pet.breed} 
                      onChange={e => handleUpdatePetField(index, 'breed', e.target.value)} 
                    />
                  </label>
                  <label className="field-label">
                    Date of Birth
                    <input 
                      className="input" 
                      type="date" 
                      value={pet.dob} 
                      onChange={e => handleUpdatePetField(index, 'dob', e.target.value)} 
                    />
                  </label>
                  <label className="field-label">
                    Sex
                    <select 
                      className="input" 
                      value={pet.sex} 
                      onChange={e => handleUpdatePetField(index, 'sex', e.target.value)}
                    >
                      {sexOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <label className="field-label">
                    Microchip #
                    <input 
                      className="input" 
                      placeholder="Optional" 
                      value={pet.microchip} 
                      onChange={e => handleUpdatePetField(index, 'microchip', e.target.value)} 
                    />
                  </label>
                  <label className="field-label">
                    Spayed / Neutered
                    <select 
                      className="input" 
                      value={pet.spayedNeutered} 
                      onChange={e => handleUpdatePetField(index, 'spayedNeutered', e.target.value)}
                    >
                      {spayedOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                </div>
              </div>
            </div>
          ))}

          <button 
            type="button" 
            className="btn btn-outline" 
            style={{
              border: '1px dashed var(--brand)',
              color: 'var(--brand)',
              background: '#f0f9ff',
              width: '100%',
              padding: '10px',
              justifyContent: 'center',
              fontWeight: '700'
            }}
            onClick={addAnotherPet}
          >
            ➕ Add Another Pet
          </button>

        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">Create & Continue</button>
        </div>
      </form>
    </Modal>
  );
}

function ModalForm({ form, setForm, fields }) {
  return <div className="form-grid">{fields.map((field) => <Input key={field} label={field} value={form[field] || ''} onChange={(value) => setForm({ ...form, [field]: value })} />)}</div>;
}

function Modal({ title, onClose, children }) {
  return <div className="modal-wrap"><section className="modal"><div className="modal-hd"><h3>{title}</h3><button className="modal-x" onClick={onClose}>×</button></div>{children}</section></div>;
}

createRoot(document.getElementById('root')).render(<App />);
