export const seedData = {
  vets: [
    { name: 'Dr. Sarah Chen', email: 'sarah.chen@riverside.vet', phone: '(555) 110-2030', specialization: 'General Practice', license: 'RV-10245', experienceYears: 9, consultationFee: 75, status: 'Available', room: 'Room 2' },
    { name: 'Dr. Raj Patel', email: 'raj.patel@riverside.vet', phone: '(555) 110-2031', specialization: 'Surgery', license: 'RV-10246', experienceYears: 12, consultationFee: 95, status: 'Available', room: 'Surgery' },
    { name: 'Dr. Maya Osei', email: 'maya.osei@riverside.vet', phone: '(555) 110-2032', specialization: 'Dermatology', license: 'RV-10247', experienceYears: 7, consultationFee: 85, status: 'In Consultation', room: 'Room 4' },
    { name: 'Dr. Tom Reed', email: 'tom.reed@riverside.vet', phone: '(555) 110-2033', specialization: 'Exotics', license: 'RV-10248', experienceYears: 6, consultationFee: 80, status: 'Available', room: 'Room 1' }
  ],
  clients: [
    { name: 'James Martinez', email: 'james.m@email.com', phone: '(555) 824-3901', address: '118 Maple Ave', pets: [
      { name: 'Buddy', species: 'Dog', breed: 'Golden Retriever', emoji: 'Dog', age: '4 yrs', sex: 'Male', color: 'Golden', microchip: '985112003456789', weightRange: '29-34 lbs', alerts: ['Rabies booster needed', 'Follow-up in 14 days'], petId: 'PET-2024-0042', dateOfBirth: 'Mar 15, 2022', insurance: 'Nationwide Pet', primaryVet: 'Dr. Sarah Chen', bloodType: 'B+', spayedNeutered: 'Yes' },
      { name: 'Max', species: 'Dog', breed: 'Labrador', emoji: 'Dog', age: '7 yrs', sex: 'Male', color: 'Yellow', microchip: '982000411223345', weightRange: '65-75 lbs', alerts: [], petId: 'PET-2023-0105', dateOfBirth: 'Sep 20, 2023', insurance: 'None', primaryVet: 'Dr. Sarah Chen', bloodType: 'A-', spayedNeutered: 'Yes' }
    ] },
    { name: 'Sarah Kim', email: 'sarah.k@email.com', phone: '(555) 291-4822', address: '45 Cedar St', pets: [
      { name: 'Mochi', species: 'Cat', breed: 'Siamese Cat', emoji: 'Cat', age: '2 yrs', sex: 'Female', color: 'Cream', microchip: '982000411223346', weightRange: '8-12 lbs', alerts: ['FVRCP overdue'], petId: 'PET-2024-0312', dateOfBirth: 'Jan 05, 2024', insurance: 'ASPCA Pet', primaryVet: 'Dr. Raj Patel', bloodType: 'Universal', spayedNeutered: 'Yes' }
    ] },
    { name: 'Amy Liu', email: 'amy.liu@email.com', phone: '(555) 673-9012', address: '908 Pine Rd', pets: [
      { name: 'Cinnamon', species: 'Rabbit', breed: 'Mini Rex', emoji: 'Rabbit', age: '1 yr', sex: 'Female', color: 'Brown', microchip: '982000411223347', weightRange: '3-5 lbs', alerts: [], petId: 'PET-2025-0902', dateOfBirth: 'Feb 10, 2025', insurance: 'None', primaryVet: 'Dr. Sarah Chen', bloodType: 'Universal', spayedNeutered: 'Yes' },
      { name: 'Whiskers', species: 'Cat', breed: 'Domestic Shorthair', emoji: 'Cat', age: '5 yrs', sex: 'Male', color: 'Gray', microchip: '982000411223348', weightRange: '9-13 lbs', alerts: [], petId: 'PET-2021-0422', dateOfBirth: 'Jul 15, 2021', insurance: 'ASPCA Pet', primaryVet: 'Dr. Sarah Chen', bloodType: 'B+', spayedNeutered: 'Yes' }
    ] },
    { name: 'Tom Wilson', email: 't.wilson@email.com', phone: '(555) 441-2930', address: '77 Oak Blvd', pets: [
      { name: 'Kiwi', species: 'Bird', breed: 'Parrot', emoji: 'Bird', age: '6 yrs', sex: 'Female', color: 'Green', microchip: '', weightRange: '0.8-1.2 lbs', alerts: [], petId: 'PET-2020-1121', dateOfBirth: 'Dec 01, 2020', insurance: 'None', primaryVet: 'Dr. Tom Reed', bloodType: 'Universal', spayedNeutered: 'No' }
    ] },
    { name: 'Maria Garcia', email: 'm.garcia@email.com', phone: '(555) 882-1144', address: '322 River Ln', pets: [
      { name: 'Luna', species: 'Dog', breed: 'French Bulldog', emoji: 'Dog', age: '5 yrs', sex: 'Female', color: 'Fawn', microchip: '982000411223349', weightRange: '18-28 lbs', alerts: ['Post-op follow-up today'], petId: 'PET-2021-0892', dateOfBirth: 'May 10, 2021', insurance: 'Pumpkin', primaryVet: 'Dr. Sarah Chen', bloodType: 'A-', spayedNeutered: 'Yes' }
    ] }
  ],
  appointments: [
    { petName: 'Buddy', ownerName: 'James Martinez', species: 'Dog', breed: 'Golden Retriever', vetName: 'Dr. Sarah Chen', reason: 'Annual Wellness', date: '2026-05-22', time: '10:00', type: 'Checkup', status: 'Now' },
    { petName: 'Mochi', ownerName: 'Sarah Kim', species: 'Cat', breed: 'Siamese Cat', vetName: 'Dr. Raj Patel', reason: 'Vaccination', date: '2026-05-22', time: '10:30', type: 'Vaccination', status: 'Scheduled' },
    { petName: 'Cinnamon', ownerName: 'Amy Liu', species: 'Rabbit', breed: 'Mini Rex', vetName: 'Dr. Sarah Chen', reason: 'Dental exam', date: '2026-05-23', time: '11:00', type: 'Checkup', status: 'Scheduled' },
    { petName: 'Kiwi', ownerName: 'Tom Wilson', species: 'Bird', breed: 'Parrot', vetName: 'Dr. Tom Reed', reason: 'Wing check', date: '2026-05-22', time: '11:30', type: 'Checkup', status: 'Scheduled' },
    { petName: 'Luna', ownerName: 'Maria Garcia', species: 'Dog', breed: 'French Bulldog', vetName: 'Dr. Sarah Chen', reason: 'Post-op follow-up', date: '2026-05-22', time: '14:00', type: 'Follow-up', status: 'Scheduled' }
  ],
  vaccinations: [
    { petName: 'Buddy', ownerName: 'James Martinez', breed: 'Golden Retriever', vaccine: 'Rabies', lastDate: '2025-05-18', dueDate: '2026-05-18', status: 'Overdue', reminderStatus: 'Not sent' },
    { petName: 'Buddy', ownerName: 'James Martinez', breed: 'Golden Retriever', vaccine: 'Leptospirosis', lastDate: '2025-06-02', dueDate: '2026-06-02', status: 'Due soon', reminderStatus: 'Sent May 19' },
    { petName: 'Mochi', ownerName: 'Sarah Kim', breed: 'Siamese Cat', vaccine: 'FVRCP', lastDate: '2025-04-28', dueDate: '2026-04-28', status: 'Overdue', reminderStatus: 'Not sent' },
    { petName: 'Luna', ownerName: 'Maria Garcia', breed: 'French Bulldog', vaccine: 'DHPP', lastDate: '2025-05-21', dueDate: '2026-05-21', status: 'Up to date', reminderStatus: 'Auto-sent Apr 21' }
  ],
  followUps: [
    { petName: 'Buddy', ownerName: 'James Martinez', vetName: 'Dr. Chen', purpose: 'Ear recheck', planDate: '2026-04-29', confirmedDate: '2026-04-30', time: '11:00 AM', priority: 'Routine', status: 'Scheduled', monitoring: false },
    { petName: 'Luna', ownerName: 'Maria Garcia', vetName: 'Dr. Chen', purpose: 'Post-op check', planDate: '2026-04-29', confirmedDate: '', time: '', priority: 'Routine', status: 'Pending', monitoring: true },
    { petName: 'Mochi', ownerName: 'Sarah Kim', vetName: 'Dr. Patel', purpose: 'Vaccine follow-up', planDate: '2026-04-29', confirmedDate: '2026-04-28', time: '2:00 PM', priority: 'Routine', status: 'Scheduled', monitoring: false }
  ],
  weights: [
    // Buddy (Golden Retriever) - Exact reference history
    { petName: 'Buddy', ownerName: 'James Martinez', value: 30.0, unit: 'lbs', date: '2025-06-08', note: 'Initial checkup' },
    { petName: 'Buddy', ownerName: 'James Martinez', value: 30.4, unit: 'lbs', date: '2025-11-12', note: 'Routine review' },
    { petName: 'Buddy', ownerName: 'James Martinez', value: 31.0, unit: 'lbs', date: '2026-01-05', note: 'Diet adjustment' },
    { petName: 'Buddy', ownerName: 'James Martinez', value: 31.6, unit: 'lbs', date: '2026-03-12', note: 'Routine check' },
    { petName: 'Buddy', ownerName: 'James Martinez', value: 32.4, unit: 'lbs', date: '2026-05-21', note: 'Wellness visit' },
    
    // Mochi (Siamese Cat)
    { petName: 'Mochi', ownerName: 'Sarah Kim', value: 8.2, unit: 'lbs', date: '2025-08-15', note: 'Initial check' },
    { petName: 'Mochi', ownerName: 'Sarah Kim', value: 8.8, unit: 'lbs', date: '2025-11-10', note: 'Weight review' },
    { petName: 'Mochi', ownerName: 'Sarah Kim', value: 9.1, unit: 'lbs', date: '2026-02-14', note: 'Routine check' },
    { petName: 'Mochi', ownerName: 'Sarah Kim', value: 9.4, unit: 'lbs', date: '2026-05-22', note: 'Vaccine visit' },
    
    // Luna (French Bulldog)
    { petName: 'Luna', ownerName: 'Maria Garcia', value: 20.1, unit: 'lbs', date: '2025-07-20', note: 'Initial check' },
    { petName: 'Luna', ownerName: 'Maria Garcia', value: 21.3, unit: 'lbs', date: '2025-10-15', note: 'Post-op baseline' },
    { petName: 'Luna', ownerName: 'Maria Garcia', value: 22.5, unit: 'lbs', date: '2026-01-12', note: 'Routine check' },
    { petName: 'Luna', ownerName: 'Maria Garcia', value: 24.0, unit: 'lbs', date: '2026-05-22', note: 'Post-op review' }
  ],
  soapNotes: [
    {
      petName: 'Buddy',
      ownerName: 'James Martinez',
      vetName: 'Dr. Sarah Chen',
      subjective: 'Owner reports Buddy has been shaking his head and scratching his left ear persistently for 3 days. A dark discharge and strong odor are present.',
      objective: 'Left ear canal is erythematous, stenotic with abundant waxy brown exudate. Tympanic membrane is intact. Right ear is clear. Weight is 32.4 lbs.',
      assessment: 'Otitis Externa (Ear Infection). Rabies booster is overdue.',
      plan: 'Thorough clean, apply Otomax ear drops twice daily for 7 days. Recheck in 14 days and administer rabies booster.',
      tags: ['Rabies booster needed', 'Follow-up in 14 days'],
      createdAt: new Date('2026-05-19T10:00:00.000Z')
    },
    {
      petName: 'Buddy',
      ownerName: 'James Martinez',
      vetName: 'Dr. Sarah Chen',
      subjective: 'Owner reports Buddy vomited twice last night and has soft diarrhea. He scavenged grass and soil yesterday.',
      objective: 'Dog is bright, alert, and responsive. Hydration is normal. Abdomen soft, non-painful on palpation. Weight is 31.8 lbs.',
      assessment: 'Gastrointestinal Upset',
      plan: 'Fast for 12 hours, then bland diet of chicken and rice for 3 days. Metronidazole 250mg twice daily for 5 days.',
      tags: ['Metronidazole 250mg', 'Resolved ✓'],
      createdAt: new Date('2025-11-12T14:30:00.000Z')
    },
    {
      petName: 'Buddy',
      ownerName: 'James Martinez',
      vetName: 'Dr. Sarah Chen',
      subjective: 'Routine annual checkup and vaccinations due.',
      objective: 'Vaccines administered DHPP + Bordetella. No adverse reactions. Weight 31.6 lbs.',
      assessment: 'Annual Vaccinations',
      plan: 'DHPP and Bordetella administered successfully.',
      tags: ['DHPP ✓', 'Bordetella ✓'],
      createdAt: new Date('2025-06-08T09:00:00.000Z')
    }
  ]
};
