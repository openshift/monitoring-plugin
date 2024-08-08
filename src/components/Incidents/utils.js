import moment from 'moment';

export function processIncidentsTimestamps(data) {
  return data.map((alert) => {
    // Process each value
    const processedValues = alert.values.map((value) => {
      const timestamp = value[0];
      const status = value[1];

      // Convert timestamp to date
      const date = new Date(timestamp * 1000);
      const hours = String(date.getHours()).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = String(date.getFullYear()).slice(-2);

      // Format date as HH/DD/MM/YY
      const formattedDate = `${hours}/${day}/${month}/${year}`;
      return [formattedDate, status];
    });

    return {
      ...alert,
      values: processedValues,
    };
  });
}

const today = moment().startOf('day');
const threeDaysAgo = moment().subtract(3, 'days');
const sevenDaysAgo = moment().subtract(7, 'days');
const fifteenDaysAgo = moment().subtract(15, 'days');
