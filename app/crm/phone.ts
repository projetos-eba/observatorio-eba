import { getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min";

export function phoneDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function parsePhone(value: string, country: CountryCode = "BR") {
  const raw = value.trim();
  if (!raw) return undefined;
  const options = { defaultCountry: country, extract: false } as const;
  if (raw.startsWith("+") || raw.startsWith("00")) {
    return parsePhoneNumberFromString(raw.startsWith("00") ? "+" + raw.slice(2) : raw, options);
  }
  const digits = phoneDigits(raw);
  const code = getCountryCallingCode(country);
  if (country === "BR" && /^55\d{10,11}$/.test(digits)) {
    return parsePhoneNumberFromString("+" + digits, options);
  }
  const local = parsePhoneNumberFromString(raw, options);
  if (local?.isPossible() || !digits.startsWith(code)) return local;
  return parsePhoneNumberFromString("+" + digits, options) || local;
}

export function normalizePhone(value: string): string | null {
  if (!value.trim()) return "";
  const parsed = parsePhone(value);
  return parsed?.isPossible() && !parsed.ext ? parsed.number : null;
}

export function matchingPhones(phone: string) {
  const national = phone.startsWith("+55") ? phone.slice(3) : phone.slice(1);
  return [phone, phone.slice(1), national];
}
