const getDateKey = (dateInput = new Date()) => {
  const date = new Date(dateInput);

  const month = String(date.getMonth() + 1).padStart(2, '0'); // months are 0-indexed
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();

  return `${month}/${day}/${year}`;
}

module.exports = getDateKey;