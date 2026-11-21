"use client";

import { useId, useState, type ChangeEvent, type ClipboardEvent } from "react";
import { ChevronDown } from "lucide-react";
import { AsYouType, getCountries, getCountryCallingCode, type CountryCode } from "libphonenumber-js/min";
import { normalizePhone, parsePhone, phoneDigits } from "./phone";

const regionNames = new Intl.DisplayNames("pt-BR", { type: "region" });
const countries = getCountries().map((id) => ({
  id,
  name: regionNames.of(id) || id,
  code: getCountryCallingCode(id),
})).sort((a, b) => a.id === "BR" ? -1 : b.id === "BR" ? 1 : a.name.localeCompare(b.name, "pt-BR"));

function flag(country: CountryCode) {
  return String.fromCodePoint(...[...country].map((character) => character.charCodeAt(0) + 127397));
}

export function PhoneField({ initial = "", onChange }: { initial?: string; onChange?: (value: string) => void }) {
  const id = useId();
  const [country, setCountry] = useState<CountryCode>(() => parsePhone(initial)?.country || "BR");
  const [national, setNational] = useState(() => parsePhone(initial)?.nationalNumber || phoneDigits(initial));
  const [untouched, markUntouched] = useState(true);
  const code = getCountryCallingCode(country);
  const value = national ? "+" + code + national : "";
  function update(nextCountry: CountryCode, nextNumber: string) {
    setCountry(nextCountry);
    setNational(nextNumber);
    markUntouched(false);
    onChange?.(nextNumber ? "+" + getCountryCallingCode(nextCountry) + nextNumber : "");
  }
  function international(raw: string) {
    const parsed = parsePhone(raw, country);
    if (!parsed?.isPossible() || parsed.ext) return false;
    const nextCountry = parsed.country || countries.find((entry) => entry.code === parsed.countryCallingCode)?.id;
    if (!nextCountry) return false;
    update(nextCountry, parsed.nationalNumber);
    return true;
  }
  function paste(event: ClipboardEvent<HTMLInputElement>) {
    const raw = event.clipboardData.getData("text").trim();
    if (/^(\+|00)/.test(raw) || (country === "BR" && /^55\d{10,11}$/.test(phoneDigits(raw)))) {
      if (international(raw)) { event.currentTarget.setCustomValidity(""); event.preventDefault(); }
    } else if (event.currentTarget.selectionStart === 0 && event.currentTarget.selectionEnd === event.currentTarget.value.length && international(raw)) {
      event.currentTarget.setCustomValidity("");
      event.preventDefault();
    }
  }
  function type(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const raw = input.value;
    if (/^(\+|00)/.test(raw) && international(raw)) return;
    let next = phoneDigits(raw).slice(0, 15 - code.length);
    const formatter = new AsYouType(country);
    const current = formatter.input(national);
    const toEnd = input.selectionStart === raw.length;
    const edit = event.nativeEvent as InputEvent;
    if (toEnd && edit.inputType === "deleteContentBackward" && raw.length < current.length && next === national)
      next = next.slice(0, -1);
    const position = phoneDigits(raw.slice(0, input.selectionStart ?? raw.length)).length;
    input.setCustomValidity("");
    update(country, next);
    if (!toEnd) requestAnimationFrame(() => {
      let index = 0;
      while (index < input.value.length && phoneDigits(input.value.slice(0, index)).length < position) index++;
      input.setSelectionRange(index, index);
    });
  }
  return <div className="operation-phone-field">
    <label htmlFor={id}>Telefone</label>
    <div className="operation-phone">
      <div className="operation-ddi">
        <span aria-hidden="true">{flag(country)} +{code} <ChevronDown size={12} /></span>
        <select aria-label="País e DDI do telefone" value={country} onChange={(event) => {
          update(event.target.value as CountryCode, national);
          const input = document.getElementById(id) as HTMLInputElement | null;
          input?.setCustomValidity("");
        }}>
          {countries.map(({ id, name, code }) => <option key={id} value={id}>{name} +{code}</option>)}
        </select>
      </div>
      <input id={id} type="tel" inputMode="tel" autoComplete="tel-national" placeholder={country === "BR" ? "(00) 00000-0000" : "Número local"}
        value={new AsYouType(country).input(national)} onChange={type} onPaste={paste}
        onBlur={(event) => event.currentTarget.setCustomValidity(!untouched && value && !normalizePhone(value) ? "Confira o telefone e o DDI selecionado." : "")} />
      <input type="hidden" name="phone" value={untouched && initial ? initial : value} />
    </div>
  </div>;
}
