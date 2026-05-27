import fs from 'fs';

const controllerPath = 'src/controllers/clientController.js';
let content = fs.readFileSync(controllerPath, 'utf8');

const regex = /client\.pets\.pull\(petId\);\s*await client\.save\(\);\s*res\.json\(client\);/g;

const replacement = `const pet = client.pets.id(petId);
    if (pet) {
        const { default: mongoose } = await import('mongoose');
        const models = mongoose.models;
        const cascadeQuery = { petName: pet.name, ownerName: client.name, clinic_id: client.clinic_id };
        if (models.Appointment) await models.Appointment.deleteMany(cascadeQuery);
        if (models.Vaccination) await models.Vaccination.deleteMany(cascadeQuery);
        if (models.FollowUp) await models.FollowUp.deleteMany(cascadeQuery);
    }

    client.pets.pull(petId);
    await client.save();
    res.json(client);`;

content = content.replace(regex, replacement);

fs.writeFileSync(controllerPath, content);
console.log("Updated clientController.js with regex");
