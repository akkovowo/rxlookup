export const API_BASE = "https://rx.144.124.248.226.sslip.io";
export const APP_ORIGIN = "https://rx.144.124.248.226.sslip.io";
export const DOCS_HOST = "docs.rxlookup";

export type HttpMethod = "GET" | "POST";

export type DocParam = {
  name: string;
  type: string;
  required: boolean;
  note: string;
};

export type DocExample = {
  curl: string;
  js: string;
  python: string;
};

export type DocEndpoint = {
  id: string;
  title: string;
  method: HttpMethod;
  path: string;
  summary: string;
  auth: string;
  params: DocParam[];
  example: DocExample;
  response: string;
  status: { code: string; note: string }[];
};

export const NAV = [
  { id: "intro", label: "Introduction" },
  { id: "auth", label: "Authentication" },
  { id: "balance", label: "Balance" },
  { id: "search", label: "Search" },
  { id: "ssndob", label: "SSN+DOB" },
  { id: "credit", label: "Credit score" },
  { id: "errors", label: "Errors" },
  { id: "limits", label: "Limits" },
] as const;

export const ENDPOINTS: DocEndpoint[] = [
  {
    id: "balance",
    title: "Check balance",
    method: "GET",
    path: "/v1/balance",
    summary: "Read wallet balance, desk plan, and API plan for the authenticated key or session.",
    auth: "Bearer key or session",
    params: [],
    example: {
      curl: `curl "${API_BASE}/v1/balance" \\
  -H "Authorization: Bearer rx_live_••••"`,
      js: `const res = await fetch("${API_BASE}/v1/balance", {
  headers: { Authorization: "Bearer rx_live_••••" },
});
const data = await res.json();`,
      python: `import requests

r = requests.get(
    "${API_BASE}/v1/balance",
    headers={"Authorization": "Bearer rx_live_••••"},
)
print(r.json())`,
    },
    response: `{
  "ok": true,
  "balance_cents": 50000,
  "balance": 500.0,
  "currency": "USD",
  "desk_plan": "month",
  "desk_until": "2026-10-10 12:00",
  "api_plan": "month",
  "api_until": "2026-10-10 12:00"
}`,
    status: [
      { code: "200", note: "Balance returned" },
      { code: "401", note: "Missing or invalid key" },
    ],
  },
  {
    id: "search",
    title: "People search",
    method: "POST",
    path: "/v1/search",
    summary: "Query the people database with any mix of name, DOB, SSN, and location. Free with an active API subscription. Desk sessions also work with a desk Search plan.",
    auth: "Bearer key + Search API subscription · $0.00",
    params: [
      { name: "first_name", type: "string", required: false, note: "Given name" },
      { name: "last_name", type: "string", required: false, note: "Family name" },
      { name: "dob", type: "string", required: false, note: "Year or MM/DD/YYYY" },
      { name: "ssn", type: "string", required: false, note: "Full or last 4" },
      { name: "city", type: "string", required: false, note: "City" },
      { name: "state", type: "string", required: false, note: "US state, 2 letters" },
      { name: "zip_code", type: "string", required: false, note: "ZIP or ZIP+4" },
    ],
    example: {
      curl: `curl -X POST "${API_BASE}/v1/search" \\
  -H "Authorization: Bearer rx_live_••••" \\
  -H "Content-Type: application/json" \\
  -d '{"first_name":"John","last_name":"Smith","state":"IL"}'`,
      js: `const res = await fetch("${API_BASE}/v1/search", {
  method: "POST",
  headers: {
    Authorization: "Bearer rx_live_••••",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    first_name: "John",
    last_name: "Smith",
    state: "IL",
  }),
});
const data = await res.json();`,
      python: `import requests

r = requests.post(
    "${API_BASE}/v1/search",
    headers={"Authorization": "Bearer rx_live_••••"},
    json={"first_name": "John", "last_name": "Smith", "state": "IL"},
)
print(r.json())`,
    },
    response: `{
  "ok": true,
  "count": 1,
  "charged": 0,
  "results": [
    {
      "first_name": "John",
      "middle_name": "A",
      "last_name": "Smith",
      "address": "742 Evergreen Terrace",
      "city": "Springfield",
      "state": "IL",
      "zip_code": "62704",
      "dob": "1985",
      "ssn": "***-**-4521"
    }
  ]
}`,
    status: [
      { code: "200", note: "Matches returned" },
      { code: "400", note: "Empty query" },
      { code: "402", note: "Search plan inactive" },
      { code: "401", note: "Missing or invalid key" },
    ],
  },
  {
    id: "ssndob",
    title: "SSN+DOB lookup",
    method: "POST",
    path: "/v1/ssndob",
    summary: "Resolve SSN and date of birth from a name plus location, or from a phone number. Charged per successful hit.",
    auth: "Bearer key · $2.50 on a hit",
    params: [
      { name: "first_name", type: "string", required: false, note: "Required with last_name" },
      { name: "last_name", type: "string", required: false, note: "Required with first_name" },
      { name: "zip_code", type: "string", required: false, note: "Improves match quality" },
      { name: "city", type: "string", required: false, note: "Optional city" },
      { name: "state", type: "string", required: false, note: "US state, 2 letters" },
      { name: "phone", type: "string", required: false, note: "10+ digits, can replace name" },
    ],
    example: {
      curl: `curl -X POST "${API_BASE}/v1/ssndob" \\
  -H "Authorization: Bearer rx_live_••••" \\
  -H "Content-Type: application/json" \\
  -d '{"first_name":"John","last_name":"Smith","zip_code":"62704"}'`,
      js: `const res = await fetch("${API_BASE}/v1/ssndob", {
  method: "POST",
  headers: {
    Authorization: "Bearer rx_live_••••",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    first_name: "John",
    last_name: "Smith",
    zip_code: "62704",
  }),
});`,
      python: `import requests

r = requests.post(
    "${API_BASE}/v1/ssndob",
    headers={"Authorization": "Bearer rx_live_••••"},
    json={"first_name": "John", "last_name": "Smith", "zip_code": "62704"},
)
print(r.json())`,
    },
    response: `{
  "ok": true,
  "charged": 2.5,
  "result": {
    "name": "John Smith",
    "ssn": "318-45-4521",
    "dob": "03/12/1985",
    "akas": ["John A Smith", "J Smith"],
    "addresses": ["742 Evergreen Terrace, Springfield IL 62704"],
    "phones": ["(555) 123-4567"]
  }
}`,
    status: [
      { code: "200", note: "Record found, balance charged" },
      { code: "404", note: "No match — not charged" },
      { code: "402", note: "Insufficient balance" },
      { code: "400", note: "Need a name pair or a phone" },
    ],
  },
  {
    id: "credit",
    title: "Credit score",
    method: "POST",
    path: "/v1/credit",
    summary: "Request a bureau credit score. Charged only when a score comes back.",
    auth: "Bearer key · $1.00 on success",
    params: [
      { name: "first_name", type: "string", required: true, note: "Given name" },
      { name: "last_name", type: "string", required: true, note: "Family name" },
      { name: "city", type: "string", required: true, note: "Current city" },
      { name: "state", type: "string", required: true, note: "US state, 2 letters" },
      { name: "zipcode", type: "string", required: true, note: "5-digit ZIP" },
      { name: "dob", type: "string", required: false, note: "MM/DD/YYYY if known" },
      { name: "ssn", type: "string", required: false, note: "Improves hit rate" },
    ],
    example: {
      curl: `curl -X POST "${API_BASE}/v1/credit" \\
  -H "Authorization: Bearer rx_live_••••" \\
  -H "Content-Type: application/json" \\
  -d '{"first_name":"John","last_name":"Smith","city":"Springfield","state":"IL","zipcode":"62704"}'`,
      js: `const res = await fetch("${API_BASE}/v1/credit", {
  method: "POST",
  headers: {
    Authorization: "Bearer rx_live_••••",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    first_name: "John",
    last_name: "Smith",
    city: "Springfield",
    state: "IL",
    zipcode: "62704",
  }),
});`,
      python: `import requests

r = requests.post(
    "${API_BASE}/v1/credit",
    headers={"Authorization": "Bearer rx_live_••••"},
    json={
        "first_name": "John",
        "last_name": "Smith",
        "city": "Springfield",
        "state": "IL",
        "zipcode": "62704",
    },
)
print(r.json())`,
    },
    response: `{
  "ok": true,
  "charged": 1.0,
  "score": 742,
  "range": "300-850",
  "model": "VantageScore 4.0"
}`,
    status: [
      { code: "200", note: "Score returned, balance charged" },
      { code: "404", note: "No file — not charged" },
      { code: "402", note: "Insufficient balance" },
      { code: "422", note: "Incomplete identity" },
    ],
  },
];

export const ERRORS = [
  { code: "400", title: "Bad request", note: "Missing fields or an empty query." },
  { code: "401", title: "Unauthorized", note: "No key, or the key was revoked." },
  { code: "402", title: "Payment required", note: "Plan inactive or balance too low." },
  { code: "404", title: "Not found", note: "No record. Lookups are not charged." },
  { code: "429", title: "Too many requests", note: "Back off and retry after the window." },
  { code: "500", title: "Server error", note: "Safe to retry. Nothing was charged." },
];
