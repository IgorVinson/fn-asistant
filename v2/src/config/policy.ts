export interface TravelPolicy {
  thresholdMiles: number;
  ratePerMile: number;
  flatTravel: number;
}

export interface WorkingHoursPolicy {
  start: string;
  end: string;
  bufferMinutes: number;
}

export interface PolicySnapshot {
  version: string;
  graniteOnly: boolean;
  testMode: boolean;
  counterDates: boolean;
  counterRates: boolean;
  futureCounterSearchDays: number;
  workMarketMinTotal: number;
  fieldNationMinTotal: number;
  workMarketBaseRate: number;
  fieldNationBaseRate: number;
  travel: TravelPolicy;
  workingHours: WorkingHoursPolicy;
}

function readBooleanEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name];

  if (value === undefined) {
    return fallback;
  }

  return !["0", "false", "no", "off"].includes(value.toLowerCase());
}

export const defaultPolicy: PolicySnapshot = {
  version: "v2-initial",
  graniteOnly: true,
  testMode: readBooleanEnv("FIELDOPS_V2_TEST_MODE", true),
  counterDates: true,
  counterRates: true,
  futureCounterSearchDays: 7,
  workMarketMinTotal: 100,
  fieldNationMinTotal: 300,
  workMarketBaseRate: 65,
  fieldNationBaseRate: 50,
  travel: {
    thresholdMiles: 20,
    ratePerMile: 1.25,
    flatTravel: 30
  },
  workingHours: {
    start: "09:00",
    end: "18:00",
    bufferMinutes: 30
  }
};
