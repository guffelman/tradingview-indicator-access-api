const { parse, add } = require('date-fns');
const { addYears, addMonths, addWeeks, addDays } = require('date-fns');

function getAccessExtension(currentExpirationDate, extensionType, extensionLength) {
  let expiration = parse(currentExpirationDate);

  switch (extensionType) {
    case 'Y':
      expiration = addYears(expiration, extensionLength);
      break;
    case 'M':
      expiration = addMonths(expiration, extensionLength);
      break;
    case 'W':
      expiration = addWeeks(expiration, extensionLength);
      break;
    case 'D':
      expiration = addDays(expiration, extensionLength);
      break;
  }

  return expiration.toISOString();
}

module.exports = { getAccessExtension };
