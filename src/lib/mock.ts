export type PanelResult = {
  first_name: string;
  middle_name?: string;
  last_name: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  dob?: string;
  altdob?: string;
  ssn?: string;
};

export const MOCK_PANEL_RESULTS: PanelResult[] = [
  {
    first_name: "John",
    middle_name: "A",
    last_name: "Smith",
    address: "742 Evergreen Terrace",
    city: "Springfield",
    state: "IL",
    zip_code: "62704",
    dob: "1985",
    altdob: "03/12/1985",
    ssn: "•••-••-4521",
  },
  {
    first_name: "Jane",
    last_name: "Doe",
    address: "1600 Pennsylvania Ave NW",
    city: "Washington",
    state: "DC",
    zip_code: "20500",
    dob: "1972",
    ssn: "•••-••-8834",
  },
];

export const SUBSCRIPTION_PLANS = [
  { id: "day", label: "1 Day", price: 15 },
  { id: "week", label: "7 Days", price: 45 },
  { id: "month", label: "30 Days", price: 120 },
] as const;

export const API_SUBSCRIPTION_PLANS = [
  { id: "day", label: "1 Day", price: 30 },
  { id: "week", label: "7 Days", price: 90 },
  { id: "month", label: "30 Days", price: 240 },
] as const;

export const SEARCH_COST = 0;
export const SSNDOB_COST = 2.5;
export const CS_COST = 1;
export const REVEAL_COST = 1.5;

export type SsndobResult = {
  name: string;
  ssn: string;
  dob: string;
  akas: string[];
  addresses: string[];
  phones: string[];
  emails: string[];
};

export const MOCK_SSNDOB_RESULT: SsndobResult = {
  name: "John Smith",
  ssn: "•••-••-4521",
  dob: "03/12/1985",
  akas: ["John A Smith", "J Smith"],
  addresses: ["742 Evergreen Terrace, Springfield IL 62704"],
  phones: ["(555) 123-4567"],
  emails: ["john.smith@example.com"],
};

export const MOCK_HISTORY = [
  { id: 1, type: "Panel search", amount: 0, date: "2026-03-09 14:22", status: "Success" },
  { id: 2, type: "SSN+DOB lookup", amount: -2.5, date: "2026-03-08 19:05", status: "Charged" },
  { id: 3, type: "Deposit", amount: 50, date: "2026-03-07 11:40", status: "Confirmed" },
];

export const MOCK_TICKETS = [
  { id: 101, subject: "Deposit not credited", status: "Open", updated: "2026-03-09" },
  { id: 98, subject: "Subscription question", status: "Closed", updated: "2026-03-05" },
];
