

const API_URL = 'http://localhost:5000/api';
let clinicId = null;

async function runTest() {
  console.log("=== Starting End-to-End Booking Flow Test ===");

  console.log("\n2. Fetching Vets...");
  const vetsRes = await fetch(`${API_URL}/vets`);
  const vetsResponse = await vetsRes.json();
  let vets = vetsResponse.data || vetsResponse;
  if (!vets || vets.length === 0) {
    console.log("No vets found. Creating a mock vet...");
    const newVetRes = await fetch(`${API_URL}/vets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-clinic-id': clinicId },
      body: JSON.stringify({
        name: 'Dr. Test Vet',
        email: 'drtest@example.com',
        phone: '9876543210',
        specialization: 'General'
      })
    });
    const newVet = await newVetRes.json();
    vets = [newVet];
  }
  const vet = vets[0];
  console.log(`Using Vet: ${vet.name} (${vet._id})`);

  // 3. Register a Client with a Pet and Custom Pet ID
  console.log("\n3. Registering Client and Pet (with custom Pet ID)...");
  const randomNum = Math.floor(Math.random() * 10000);
  const clientBody = {
    name: `Test Client ${randomNum}`,
    email: `test${randomNum}@example.com`,
    phone: `55500${randomNum.toString().padStart(4, '0')}`,
    pets: [
      {
        name: `Test Pet ${randomNum}`,
        species: 'Dog',
        sex: 'Male',
        spayedNeutered: 'Yes',
        petId: `CUSTOM-PET-${randomNum}`
      }
    ]
  };

  const clientRes = await fetch(`${API_URL}/clients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-clinic-id': clinicId },
    body: JSON.stringify(clientBody)
  });
  
  if (!clientRes.ok) {
    const errorText = await clientRes.text();
    console.error("Failed to register client:", errorText);
    return;
  }
  const client = await clientRes.json();
  console.log(`Client Registered Successfully: ${client.name} (${client._id})`);
  const pet = client.pets[0];
  console.log(`Pet created with ID: ${pet.petId} (Object ID: ${pet._id})`);

  if (pet.petId !== `CUSTOM-PET-${randomNum}`) {
    console.error(`ERROR: Pet ID mismatch! Expected CUSTOM-PET-${randomNum}, got ${pet.petId}`);
  } else {
    console.log("SUCCESS: Custom Pet ID saved correctly!");
  }

  // 4. Book an Appointment
  console.log("\n4. Booking Appointment...");
  const dateStr = new Date().toISOString().split('T')[0]; // Today
  const timeStr = "09:00 AM";

  const appointmentBody = {
    clientId: client._id,
    petId: pet._id,
    vetId: vet._id,
    petName: pet.name,
    ownerName: client.name,
    species: pet.species,
    vetName: vet.name,
    reason: 'Annual Checkup',
    date: dateStr,
    time: timeStr,
    type: 'Checkup',
    status: 'Scheduled'
  };

  const apptRes = await fetch(`${API_URL}/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-clinic-id': clinicId },
    body: JSON.stringify(appointmentBody)
  });

  if (!apptRes.ok) {
    const errorText = await apptRes.text();
    console.error("Failed to book appointment:", errorText);
    return;
  }
  const appt = await apptRes.json();
  console.log(`Appointment booked successfully! ID: ${appt._id}`);
  
  // Verify Relational IDs
  if (appt.clientId === client._id && appt.petId === pet._id) {
    console.log("SUCCESS: Relational IDs stored correctly in appointment!");
  } else {
    console.error("ERROR: Relational IDs missing or mismatched in appointment:", appt);
  }

  // 5. Test Double Booking Conflict
  console.log("\n5. Testing Double-Booking Conflict Prevention...");
  const conflictApptBody = { ...appointmentBody, petName: 'Another Pet', ownerName: 'Another Owner' };
  
  const conflictRes = await fetch(`${API_URL}/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-clinic-id': clinicId },
    body: JSON.stringify(conflictApptBody)
  });

  if (conflictRes.status === 409) {
    const conflictMsg = await conflictRes.json();
    console.log("SUCCESS: Double-booking prevented with 409 Conflict!");
    console.log(`Server responded: ${conflictMsg.message}`);
  } else {
    console.error(`ERROR: Expected 409 Conflict, got ${conflictRes.status}`);
  }

  console.log("\n=== Test Complete ===");
}

runTest().catch(console.error);
