import { useMemo, useRef, useState } from "react";
import { Check, Gift } from "lucide-react";
import { CopyField } from "@/components/CopyField";
import { Modal, originFromEl, type ModalOrigin } from "@/components/Modal";
import { CountUsd } from "@/components/CountUp";
import { formatUsd, sleep } from "@/lib/format";
import { apiPost, ApiError } from "@/lib/api";
import { useApp } from "@/lib/store";

const PRESETS = [25, 50, 100, 250, 500];

const METHODS = [
  { id: "btc", label: "Bitcoin", hint: "Network fee", ticker: "BTC", icon: `${import.meta.env.BASE_URL}img/crypto/btc.svg`, address: "bc1qrxlookupdemo000000000000000000000xyz" },
  { id: "eth", label: "Ethereum", hint: "ERC-20", ticker: "ETH", icon: `${import.meta.env.BASE_URL}img/crypto/eth.svg`, address: "0xA11CE00000000000000000000000RxLookup01" },
  { id: "ltc", label: "Litecoin", hint: "On-chain", ticker: "LTC", icon: `${import.meta.env.BASE_URL}img/crypto/ltc.svg`, address: "ltc1qrxlookupdemo000000000000000000abcd" },
  { id: "sol", label: "Solana", hint: "On-chain", ticker: "SOL", icon: `${import.meta.env.BASE_URL}img/crypto/sol.svg`, address: "SoLrxLookupDemo0000000000000000000001" },
  { id: "usdt-trc", label: "USDT", hint: "TRC-20", ticker: "USDT", icon: `${import.meta.env.BASE_URL}img/crypto/usdt.svg`, address: "TRxLookUpDemo0000000000000000000001" },
  { id: "usdt-erc", label: "USDT", hint: "ERC-20", ticker: "USDT", icon: `${import.meta.env.BASE_URL}img/crypto/usdt.svg`, address: "0xUSDT0000000000000000000000RxLookup02" },
] as const;

type Step = "confirm" | "generate" | "address" | "checking" | "success" | null;

export function TopupPage() {
  const app = useApp();
  const [amount, setAmount] = useState("50");
  const [methodId, setMethodId] = useState<string>("btc");
  const [step, setStep] = useState<Step>(null);
  const [origin, setOrigin] = useState<ModalOrigin | null>(null);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const coinRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const method = METHODS.find((m) => m.id === methodId) ?? METHODS[0];
  const dollars = Number(amount);
  const cents = Math.round(dollars * 100);
  const valid = Number.isFinite(dollars) && dollars >= 5 && dollars <= 10_000;

  const quote = useMemo(() => {
    const rates: Record<string, number> = { BTC: 0.000015, ETH: 0.00042, LTC: 0.012, USDT: 1 };
    const rate = rates[method.ticker] ?? 1;
    return `${(dollars * rate).toFixed(method.ticker === "USDT" ? 2 : 6)} ${method.ticker}`;
  }, [dollars, method.ticker]);

  function start() {
    setError("");
    if (!valid) {
      setError("Enter an amount between $5 and $10,000.");
      return;
    }
    const el = coinRefs.current[methodId];
    if (el) setOrigin(originFromEl(el));
    setStep("confirm");
  }

  async function generate() {
    setStep("generate");
    await sleep(400);
    setStep("address");
  }

  async function confirmPaid() {
    setStep("checking");
    try {
      await app.createDeposit(method.ticker, dollars);
      setStep("success");
    } catch (err) {
      setStep(null);
      setError(err instanceof ApiError ? err.message : "Could not open the invoice");
    }
  }

  async function redeem() {
    try {
      await apiPost("/v1/redeem", { code });
      setCode("");
      await app.refreshMe();
      app.showToast("Code redeemed", "saved");
    } catch (err) {
      app.showToast(err instanceof ApiError ? err.message : "Code is not valid");
    }
  }

  const busy = step === "generate" || step === "checking";

  return (
    <>
      <div className="help-hero">
        <div>
          <h2>Top up</h2>
          <p className="panel-card__desc">Staff credits the desk after the transfer confirms.</p>
        </div>
        <div className="topup-hero-bal">
          <span>Balance</span>
          <strong>
            <CountUsd cents={app.balanceCents} />
          </strong>
        </div>
      </div>

      <div className="card topup-desk">
        <div className="topup-desk__grid">
          <div className="topup-desk__amount">
            <label htmlFor="topup-amount">Amount</label>
            <div className="topup-amount">
              <span>$</span>
              <input
                id="topup-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") start();
                }}
                placeholder="50"
                aria-label="Amount in USD"
              />
            </div>
            <div className="topup-presets" role="group" aria-label="Suggested amounts">
              {PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`topup-preset${Number(amount) === n ? " is-on" : ""}`}
                  onClick={() => setAmount(String(n))}
                >
                  ${n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="topup-desk__label">Coin</p>
            <div className="topup-coins" role="group" aria-label="Payment method">
              {METHODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`topup-coin${methodId === m.id ? " is-on" : ""}`}
                  ref={(node) => {
                    coinRefs.current[m.id] = node;
                  }}
                  onClick={() => setMethodId(m.id)}
                  aria-pressed={methodId === m.id}
                >
                  <img src={m.icon} alt="" width={22} height={22} />
                  <strong>{m.ticker}</strong>
                  <em>{m.hint}</em>
                </button>
              ))}
            </div>
          </div>
        </div>

        {error ? <p className="auth__error">{error}</p> : null}

        <div className="topup-desk__foot">
          <span className="topup-quote">
            {valid ? (
              <>
                ≈ {quote}
                <em>via {method.label}</em>
              </>
            ) : (
              <em>$5 – $10,000</em>
            )}
          </span>
          <button type="button" className="panel-btn panel-btn--primary" onClick={start} disabled={!valid}>
            Continue
          </button>
        </div>
      </div>

      <form
        className="card topup-code"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) void redeem();
        }}
      >
        <span className="topup-code__icon" aria-hidden="true">
          <Gift size={16} />
        </span>
        <div className="topup-code__copy">
          <strong>Gift code</strong>
          <em>Credits land on the desk instantly.</em>
        </div>
        <div className="input-wrap topup-code__field">
          <input
            id="gift-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="RX-XXXXXX"
            autoComplete="off"
            aria-label="Gift code"
          />
        </div>
        <button type="submit" className="panel-btn panel-btn--ghost" disabled={!code.trim()}>
          Redeem
        </button>
      </form>

      <Modal open={Boolean(step)} onClose={() => !busy && setStep(null)} origin={origin}>
        {step === "confirm" ? (
          <div className="sub-confirm">
            <img className="topup-sheet__coin" src={method.icon} alt="" width={28} height={28} />
            <h3>Confirm deposit</h3>
            <p>
              {formatUsd(cents)} via {method.label}
              <br />
              ≈ {quote}
            </p>
            <div className="set-wipe__actions">
              <button type="button" className="panel-btn panel-btn--ghost" onClick={() => setStep(null)}>
                Cancel
              </button>
              <button type="button" className="panel-btn panel-btn--primary" onClick={() => void generate()}>
                Generate address
              </button>
            </div>
          </div>
        ) : null}

        {step === "generate" ? (
          <div className="sub-confirm">
            <div className="panel-loading__spinner" aria-hidden="true" />
            <h3>Creating invoice</h3>
            <p>Preparing a {method.ticker} address…</p>
          </div>
        ) : null}

        {step === "address" ? (
          <div className="sub-confirm topup-sheet">
            <h3>Send {method.ticker}</h3>
            <p>Send exactly {quote} to the address below.</p>
            <div className="topup-qr" aria-hidden="true">
              <i />
            </div>
            <CopyField value={method.address} toast="Address copied" />
            <div className="set-wipe__actions">
              <button type="button" className="panel-btn panel-btn--ghost" onClick={() => setStep(null)}>
                Cancel
              </button>
              <button type="button" className="panel-btn panel-btn--primary" onClick={() => void confirmPaid()}>
                I sent it
              </button>
            </div>
          </div>
        ) : null}

        {step === "checking" ? (
          <div className="sub-confirm">
            <div className="panel-loading__spinner" aria-hidden="true" />
            <h3>Checking payment</h3>
            <p>Looking for the incoming transfer…</p>
          </div>
        ) : null}

        {step === "success" ? (
          <div className="sub-confirm">
            <div className="topup-ok" aria-hidden="true">
              <Check size={22} />
            </div>
            <h3>Invoice opened</h3>
            <p>
              {formatUsd(cents)} via {method.label} is waiting on the desk. Balance updates after staff credits it.
            </p>
            <div className="set-wipe__actions">
              <button type="button" className="panel-btn panel-btn--primary" onClick={() => setStep(null)}>
                Done
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
