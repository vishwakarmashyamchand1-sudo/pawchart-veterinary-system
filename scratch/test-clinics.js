const url = 'http://localhost:5000/api/clinics';

async function run() {
  console.log("🚀 Testing Clinic validations & updates...");

  // 1. Test invalid registration (phone too short)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: "Validation Test Clinic",
        registration_number: "VAL-9991",
        address: { street: "123 Test St", city: "Bangalore", state: "Karnataka", postal_code: "560001" },
        contact: { phone: "98765", email: "val@test.com" } // 5 digits only
      })
    });
    console.log("❌ Invalid Phone Registration Status (Expected 400):", res.status);
    const json = await res.json();
    console.log("   Response Message:", json.message);
  } catch (err) {
    console.error("   Error during test 1:", err.message);
  }

  // 2. Test invalid registration (postal code wrong)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: "Validation Test Clinic",
        registration_number: "VAL-9992",
        address: { street: "123 Test St", city: "Bangalore", state: "Karnataka", postal_code: "abc" }, // alpha
        contact: { phone: "9876543210", email: "val@test.com" }
      })
    });
    console.log("❌ Invalid Postal Code Registration Status (Expected 400):", res.status);
    const json = await res.json();
    console.log("   Response Message:", json.message);
  } catch (err) {
    console.error("   Error during test 2:", err.message);
  }

  // 3. Test successful registration
  let createdId = null;
  try {
    const uniqueId = `VAL-${Date.now()}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: "Correct Clinic",
        registration_number: uniqueId,
        address: { street: "123 Test St", city: "Bangalore", state: "Karnataka", postal_code: "560001" }, // exactly 6 digits
        contact: { phone: "9876543210", email: "correct@test.com" } // exactly 10 digits
      })
    });
    console.log("✅ Successful Registration Status (Expected 201):", res.status);
    const json = await res.json();
    if (res.status === 201) {
      createdId = json._id;
      console.log("   Created Clinic ID:", createdId);
    } else {
      console.log("   Registration Error Message:", json.message);
    }
  } catch (err) {
    console.error("   Error during test 3:", err.message);
  }

  // 4. Test patch updates
  if (createdId) {
    try {
      const res = await fetch(`${url}/${createdId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact: { phone: "1122334455", email: "updated@test.com" }
        })
      });
      console.log("✅ Successful PATCH Status (Expected 200):", res.status);
      const json = await res.json();
      console.log("   Updated Phone:", json.contact?.phone);
    } catch (err) {
      console.error("   Error during test 4:", err.message);
    }
  }
}

run();
