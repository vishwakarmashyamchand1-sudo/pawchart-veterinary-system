import { Vaccination, VaccineMaster } from '../models.js';
import { calculateDueDate } from './dateCalculator.js';

export async function generateVaccinesForPets(pets, clientName, clinicId) {
  const newVaccinations = [];
  const allMasterVaccines = await VaccineMaster.find({});
  
  for (const pet of pets) {
    if (pet.dateOfBirth && pet.species) {
      const petTokens = pet.species.toLowerCase().split(/[\s/]+/);
      const masterVaccines = allMasterVaccines.filter(mv => {
        if (!mv.species) return false;
        const mvTokens = mv.species.toLowerCase().split(/[\s/]+/);
        return petTokens.some(pt => mvTokens.includes(pt));
      });
      
      for (const mv of masterVaccines) {
        const dueDate = calculateDueDate(pet.dateOfBirth, mv.recommendedAge);
        if (dueDate) {
          newVaccinations.push({
            petName: pet.name,
            ownerName: clientName,
            breed: pet.breed,
            vaccine: mv.name,
            dueDate: dueDate,
            status: 'Pending',
            clinic_id: clinicId
          });
        }
      }
    }
  }
  if (newVaccinations.length > 0) {
    await Vaccination.insertMany(newVaccinations);
  }
}
