import React, { useState, useMemo } from 'react';
import { Screen } from '../main.jsx'; // Import Screen component from main
import { WeeklyCalendar } from '../calendar/WeeklyCalendar.jsx';
import { QueueManager } from '../queue/QueueManager.jsx';
import { getTodayAppointments, getNowInRoom, getUpNext } from '../services/queueService.js';
import { getTodayDate } from '../utils/dateUtils.js';

export function DoctorDashboard({ 
  appointments = [], 
  selectedDoctor, 
  selectedClinic, 
  go, 
  update 
}) {
  const [currentDate, setCurrentDate] = useState(getTodayDate());
  const [viewMode, onViewModeChange] = useState('Week');

  // 1. Dynamic Doctor & Clinic Scoping Filtration
  const scopedAppointments = useMemo(() => {
    return appointments.filter(appt => {
      // Scoped to selected clinic
      const matchesClinic = !selectedClinic || appt.clinic_id === selectedClinic._id;
      // Scoped to selected doctor
      const matchesDoctor = !selectedDoctor || appt.vetName === selectedDoctor.name;
      
      return matchesClinic && matchesDoctor;
    });
  }, [appointments, selectedClinic, selectedDoctor]);

  // 2. Queue calculations for TODAY
  const todayAppts = useMemo(() => {
    const doctorName = selectedDoctor?.name || null;
    return getTodayAppointments(appointments, getTodayDate(), doctorName);
  }, [appointments, selectedDoctor]);

  const nowInRoom = useMemo(() => getNowInRoom(todayAppts), [todayAppts]);
  const upNext = useMemo(() => getUpNext(todayAppts), [todayAppts]);

  // 3. Queue progression logic
  const handleCallNext = async () => {
    if (upNext.length === 0) return;
    const nextPatient = upNext[0];

    try {
      // Mark current in room as Completed
      if (nowInRoom) {
        await update('appointments', nowInRoom._id, { status: 'Completed' });
      }
      // Mark next patient as Now (Active Room)
      await update('appointments', nextPatient._id, { status: 'Now' });
    } catch (err) {
      console.error("Queue progression failed:", err);
    }
  };

  const handleComplete = async (appt) => {
    try {
      await update('appointments', appt._id, { status: 'Completed' });
    } catch (err) {
      console.error("Failing to complete appointment:", err);
    }
  };

  const handleStartSoap = (appt) => {
    // Navigate straight to the AI SOAP consultation module
    go('soap');
  };

  return (
    <div className="main-scroll">
      <div className="main-pad" style={{ padding: '20px 24px' }}>
        {/* Main Title Row */}
        <div className="topbar" style={{ marginBottom: '16px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800' }}>
              Appointments Screen
            </h2>
            <div className="sub" style={{ fontSize: '11px', color: 'var(--text-3)' }}>
              {selectedDoctor ? `Viewing working dashboard for ${selectedDoctor.name}` : 'Viewing all clinic schedule grids'}
            </div>
          </div>
        </div>

        {/* Modular Grid Layout */}
        <div style={{
          display: 'flex',
          gap: '20px',
          height: 'calc(100vh - 140px)',
          minHeight: '520px',
          alignItems: 'stretch'
        }}>
          {/* LEFT COLUMN: Queue Manager */}
          <QueueManager 
            nowInRoom={nowInRoom}
            upNext={upNext}
            onCallNext={handleCallNext}
            onComplete={handleComplete}
            onStartSoap={handleStartSoap}
          />

          {/* RIGHT COLUMN: Weekly Calendar */}
          <WeeklyCalendar 
            appointments={scopedAppointments}
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            viewMode={viewMode}
            onViewModeChange={onViewModeChange}
            onStartSoap={handleStartSoap}
          />
        </div>
      </div>
    </div>
  );
}
