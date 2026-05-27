export const calculateDueDate = (dobStr, recommendedAgeStr) => {
  if (!dobStr || !recommendedAgeStr) return null;
  
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return null;

  // Extract the first number found in the string (e.g. "12" from "12-16 weeks" or "1" from "1 year")
  const match = recommendedAgeStr.match(/(\d+)/);
  if (!match) return null;
  const value = parseInt(match[1], 10);

  const lowerStr = recommendedAgeStr.toLowerCase();
  
  const dueDate = new Date(dob);
  
  if (lowerStr.includes('week')) {
    dueDate.setDate(dueDate.getDate() + (value * 7));
  } else if (lowerStr.includes('month')) {
    dueDate.setMonth(dueDate.getMonth() + value);
  } else if (lowerStr.includes('year')) {
    dueDate.setFullYear(dueDate.getFullYear() + value);
  } else if (lowerStr.includes('day')) {
    dueDate.setDate(dueDate.getDate() + value);
  } else {
    // Default fallback to weeks if nothing specified
    dueDate.setDate(dueDate.getDate() + (value * 7));
  }

  // Format YYYY-MM-DD
  const yyyy = dueDate.getFullYear();
  const mm = String(dueDate.getMonth() + 1).padStart(2, '0');
  const dd = String(dueDate.getDate()).padStart(2, '0');
  
  return `${yyyy}-${mm}-${dd}`;
};
