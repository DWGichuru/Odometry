import { CurrencyCode } from "@/lib/currency";

export type DistanceUnit = "KM" | "MI"

export interface CountryPreset {
    code: string;
    name: string;
    currency: CurrencyCode,
    distanceUnit: DistanceUnit
}

export const COUNTRIES: CountryPreset[] = [
    { code: "US", name: "United States", currency: "USD", distanceUnit: "MI" },
    { code: "CA", name: "Canada", currency: "CAD", distanceUnit: "KM" },
    { code: "GB", name: "United Kingdom", currency: "GBP", distanceUnit: "MI" },
    { code: "AU", name: "Australia", currency: "AUD", distanceUnit: "KM" },
    { code: "DE", name: "Germany", currency: "EUR", distanceUnit: "KM" },
    { code: "FR", name: "France", currency: "EUR", distanceUnit: "KM" },
    { code: "IE", name: "Ireland", currency: "EUR", distanceUnit: "KM" },
    { code: "ES", name: "Spain", currency: "EUR", distanceUnit: "KM" },
    { code: "IT", name: "Italy", currency: "EUR", distanceUnit: "KM" },
    { code: "NL", name: "Netherlands", currency: "EUR", distanceUnit: "KM" },
    { code: "PT", name: "Portugal", currency: "EUR", distanceUnit: "KM" },
    { code: "BE", name: "Belgium", currency: "EUR", distanceUnit: "KM" },
    { code: "AT", name: "Austria", currency: "EUR", distanceUnit: "KM" },
]

export function getCountryPreset(countryCode: string): CountryPreset | undefined {
    return COUNTRIES.find(country => country.code === countryCode)
}