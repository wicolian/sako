export const setCustomerCookie = () => {
  // Use a year for max-age: 60 * 60 * 24 * 365 = 31536000
  const maxAge = 31536000;
  // Get the current domain to determine if we should use the top-level domain
  const hostname = window.location.hostname;
  const domain = hostname.includes('trysako.com') ? '.trysako.com' : hostname;

  document.cookie = `sako_customer=true; domain=${domain}; path=/; max-age=${maxAge}; secure; samesite=lax`;
};

export const isCustomer = () => {
  return document.cookie.split(';').some((item) => item.trim().startsWith('sako_customer=true'));
};

