import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, CreditCard, Gauge, IdCard, Search, Wallet } from "lucide-react";
import { cx } from "@/lib/format";

const FAQ = [
  {
    title: "Search",
    desc: "People database",
    icon: Search,
    items: [
      { q: "How do I unlock Search?", a: "Buy a plan in Subscriptions. The desk stays locked until a plan is active." },
      { q: "What can I search with?", a: "Any mix of first name, last name, year of birth, city, state, and ZIP." },
    ],
  },
  {
    title: "SSN+DOB",
    desc: "$2.50 per hit",
    icon: IdCard,
    items: [
      { q: "When am I charged?", a: "Only when a record is found. Empty results do not touch the balance." },
      { q: "What do I need to search?", a: "First and last name with a location, or a phone number with at least ten digits." },
    ],
  },
  {
    title: "Credit score",
    desc: "$1.00 on success",
    icon: Gauge,
    items: [
      { q: "When is the fee taken?", a: "Only when a valid bureau score comes back." },
      { q: "How long does it take?", a: "Most checks finish in five to ten seconds." },
    ],
  },
  {
    title: "Balance & keys",
    desc: "Wallet and API",
    icon: Wallet,
    items: [
      { q: "How do I add funds?", a: "Use Top up. Send BTC, ETH, LTC, or USDT — the desk credits after the network confirms." },
      { q: "Where are API keys?", a: "The API tab. Secrets are shown once. Revoked keys can be deleted later." },
      { q: "I forgot my password.", a: "There is no reset. Sign in with the secret key from registration, or issue a new key in Settings while you are still signed in." },
    ],
  },
  {
    title: "Plans",
    desc: "Subscriptions",
    icon: CreditCard,
    items: [
      { q: "What does a plan unlock?", a: "Search in the desk. SSN+DOB and credit still bill per successful hit." },
      { q: "Is there an API plan?", a: "Yes — Search API is a separate subscription from the desk Search plan." },
    ],
  },
];

export function FaqPage() {
  const [open, setOpen] = useState<string | null>("Search:How do I unlock Search?");

  return (
    <>
      <div className="help-hero">
        <div>
          <h2>FAQ</h2>
          <p className="panel-card__desc">Short answers for search, scores, keys, and billing.</p>
        </div>
      </div>

      <div className="faq-grid">
        {FAQ.map((section) => {
          const Icon = section.icon;
          return (
            <section key={section.title} className="card faq-card">
              <div className="faq-card__head">
                <span className="faq-card__icon" aria-hidden="true">
                  <Icon size={17} />
                </span>
                <div>
                  <h3>{section.title}</h3>
                  <p>{section.desc}</p>
                </div>
              </div>
              <div className="faq-list">
                {section.items.map((item) => {
                  const id = `${section.title}:${item.q}`;
                  const on = open === id;
                  return (
                    <div key={id} className={cx("faq-item", on && "is-on")}>
                      <button type="button" className="faq-item__q" aria-expanded={on} onClick={() => setOpen(on ? null : id)}>
                        <span>{item.q}</span>
                        <ChevronDown size={16} />
                      </button>
                      <AnimatePresence initial={false}>
                        {on ? (
                          <motion.div
                            className="faq-item__a"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                          >
                            <p>{item.a}</p>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
