const API_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('Testing specific API endpoints...');

  try {
    // 1. Test Client Search
    let res = await fetch(`${API_URL}/clients/search?q=test`);
    console.log('GET /clients/search -> Status:', res.status);
    let data = await res.json();
    console.log('Response is array:', Array.isArray(data));

    // 2. Test Vets Search
    res = await fetch(`${API_URL}/vets/search?q=vet`);
    console.log('GET /vets/search -> Status:', res.status);
    data = await res.json();
    console.log('Response is array:', Array.isArray(data));

    // 3. Test Due Vaccinations
    res = await fetch(`${API_URL}/vaccinations/due`);
    console.log('GET /vaccinations/due -> Status:', res.status);
    data = await res.json();
    console.log('Response is array:', Array.isArray(data));

    // 4. Test Appointments by Vet
    res = await fetch(`${API_URL}/appointments/vet/Dr.%20Sarah`);
    console.log('GET /appointments/vet/:vetName -> Status:', res.status);
    data = await res.json();
    console.log('Response is array:', Array.isArray(data));

    // 5. Test Standard GET All for Clients
    res = await fetch(`${API_URL}/clients`);
    console.log('GET /clients -> Status:', res.status);
    data = await res.json();
    console.log('Response is array:', Array.isArray(data));

    // 6. Test Standard GET All for Followups (new router)
    res = await fetch(`${API_URL}/followups`);
    console.log('GET /followups -> Status:', res.status);
    data = await res.json();
    console.log('Response is array:', Array.isArray(data));

    console.log('\nAll tests passed successfully!');
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

runTests();
