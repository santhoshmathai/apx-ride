'use client';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CarFront,
  Check,
  CircleGauge,
  Copy,
  Eye,
  FileText,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  Pencil,
  Plus,
  Settings,
  PoundSterling,
  Printer,
  Save,
  Trash2,
  X,
} from 'lucide-react';

type Booking = {
  id: number;
  passenger_name: string;
  phone: string;
  pickup: string;
  dropoff: string;
  pickup_at: string;
  operator: string;
  booking_type?: 'CASH' | 'ACCOUNT';
  passengers: number;
  large_bags: number;
  small_bags: number;
  fleet_tier: string;
  distance: number;
  fare: number;
  status: string;
  notes: string;
};
type Rate = { base: number; rate: number };
type Rates = Record<'Saloon' | 'Estate' | '6-seater' | '7-seater', Rate>;
const defaultRates: Rates = {
  Saloon: { base: 6, rate: 1.6 },
  Estate: { base: 7, rate: 1.7 },
  '6-seater': { base: 8, rate: 2.2 },
  '7-seater': { base: 9, rate: 2.5 },
};
const localStorage =
  typeof window === 'undefined'
    ? { getItem: () => null, setItem: () => {} }
    : window.localStorage;
const nav = [
  ['Dashboard', LayoutDashboard],
  ['Booking Control', CarFront],
  ['Calculator', FileText],
  ['Calendar', CalendarDays],
  ['Messages', MessageSquareText],
  ['Earnings', PoundSterling],
  ['Settings', Settings],
] as const;

export function AppShell() {
  const [active, setActive] = useState('Dashboard'),
    [mobile, setMobile] = useState(false),
    [modal, setModal] = useState<Booking | null | undefined>(),
    [detail, setDetail] = useState<Booking | null>(null),
    [bookings, setBookings] = useState<Booking[]>([]),
    [loading, setLoading] = useState(true);
  const [operators, setOperators] = useState<string[]>(['APX RIDE']),
    [rates, setRates] = useState<Rates>(defaultRates),
    [fuelRate, setFuelRate] = useState(50);
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem('apx-settings') || '{}');
      if (s.operators) setOperators(s.operators);
      if (s.rates) setRates(s.rates);
      if (s.fuelRate !== undefined) setFuelRate(s.fuelRate);
    } catch {}
    refresh().finally(() => setLoading(false));
  }, []);
  const persist = (o = operators, r = rates, f = fuelRate) => {
    setOperators(o);
    setRates(r);
    setFuelRate(f);
    localStorage.setItem(
      'apx-settings',
      JSON.stringify({ operators: o, rates: r, fuelRate: f }),
    );
  };
  const refresh = () =>
    fetch('/api/bookings')
      .then((r) => r.json())
      .then((d: Booking[]) => Array.isArray(d) && setBookings(d));
  const save = async (data: Record<string, unknown>, id?: number) => {
    await fetch('/api/bookings', {
      method: id ? 'PUT' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(id ? { ...data, id } : data),
    });
    setModal(undefined);
    await refresh();
  };
  const status = async (id: number, s: string) => {
    await fetch('/api/bookings', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, status: s }),
    });
    await refresh();
  };
  const remove = async (id: number) => {
    if (
      !confirm(
        'Remove this booking from active dispatch? It remains safely archived.',
      )
    )
      return;
    await fetch('/api/bookings?id=' + id, { method: 'DELETE' });
    await refresh();
  };
  return (
    <main className="app">
      <Sidebar
        active={active}
        select={setActive}
        mobile={mobile}
        close={() => setMobile(false)}
        operators={operators.length}
      />
      {mobile && <button className="scrim" onClick={() => setMobile(false)} />}
      <section className="workspace">
        <header className="topbar">
          <button className="menu" onClick={() => setMobile(true)}>
            <Menu />
          </button>
          <div>
            <small>
              {new Date()
                .toLocaleDateString('en-GB', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'long',
                })
                .toUpperCase()}
            </small>
            <h1>{active}</h1>
          </div>
          <button className="primary" onClick={() => setModal(null)}>
            <Plus />
            New booking
          </button>
        </header>
        <div className="content">
          {active === 'Dashboard' && (
            <Dashboard
              bookings={bookings}
              operators={operators}
              rates={rates}
              fuelRate={fuelRate}
              save={save}
              go={setActive}
            />
          )}
          {active === 'Booking Control' && (
            <Bookings
              items={bookings}
              loading={loading}
              done={status}
              remove={remove}
              view={setDetail}
              edit={setModal}
              add={() => setModal(null)}
            />
          )}
          {active === 'Calculator' && (
            <Calculator
              rates={rates}
              fuelRate={fuelRate}
              operators={operators}
              save={save}
            />
          )}
          {active === 'Calendar' && <Calendar items={bookings} />}{' '}
          {active === 'Messages' && <Messages items={bookings} />}{' '}
          {active === 'Earnings' && <Earnings items={bookings} />}
          {active === 'Settings' && (
            <SettingsPage
              operators={operators}
              rates={rates}
              fuelRate={fuelRate}
              persist={persist}
            />
          )}
        </div>
      </section>
      {modal !== undefined && (
        <BookingModal
          booking={modal}
          operators={operators}
          close={() => setModal(undefined)}
          save={save}
        />
      )}{' '}
      {detail && (
        <BookingDetail
          booking={detail}
          close={() => setDetail(null)}
          edit={() => {
            setDetail(null);
            setModal(detail);
          }}
        />
      )}
    </main>
  );
}

function Sidebar({
  active,
  select,
  mobile,
  close,
  operators,
}: {
  active: string;
  select: (s: string) => void;
  mobile: boolean;
  close: () => void;
  operators: number;
}) {
  return (
    <aside className={`sidebar ${mobile ? 'open' : ''}`}>
      <div className="brand">
        <img src="/apx-logo.png" alt="APX Ride logo" />
        <div>
          <strong>APX RIDE</strong>
          <small>Executive portal</small>
        </div>
      </div>
      <button className="close" onClick={close}>
        <X />
      </button>
      <nav>
        {nav.map(([label, Icon]) => (
          <button
            key={label}
            className={active === label ? 'active' : ''}
            onClick={() => {
              select(label);
              close();
            }}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <footer>
        <i />
        Secure workspace
        <strong>
          {operators} operator{operators === 1 ? '' : 's'}
        </strong>
      </footer>
    </aside>
  );
}

function Dashboard({
  bookings,
  operators,
  rates,
  fuelRate,
  save,
  go,
}: {
  bookings: Booking[];
  operators: string[];
  rates: Rates;
  fuelRate: number;
  save: (d: Record<string, unknown>) => void;
  go: (s: string) => void;
}) {
  const upcoming = bookings
      .filter((b) => b.status === 'upcoming')
      .sort((a, b) => a.pickup_at.localeCompare(b.pickup_at)),
    next = upcoming[0],
    done = bookings.filter((b) => b.status === 'complete'),
    earn = done.reduce((a, b) => a + b.fare, 0);
  return (
    <>
      <section className="brand-banner">
        <img src="/apx-header.png" alt="APX Ride — Elevate every mile" />
      </section>
      <section className="welcome">
        <div>
          <small>OPERATIONS DESK</small>
          <h2>Good day, Santhosh.</h2>
          <p>Bookings, dispatch and quotes in one live workspace.</p>
        </div>
        <button onClick={() => go('Calendar')}>View calendar →</button>
      </section>
      <div className="stats">
        <Stat
          icon={PoundSterling}
          label="Completed earnings"
          value={`£${earn.toFixed(2)}`}
          detail={`${done.length} completed jobs`}
        />
        <Stat
          icon={CircleGauge}
          label="Active jobs"
          value={String(upcoming.length).padStart(2, '0')}
          detail="Upcoming dispatches"
        />
        <Stat
          icon={CalendarDays}
          label="All bookings"
          value={String(bookings.length).padStart(2, '0')}
          detail={`${operators.length} booking sources`}
        />
      </div>
      <div className="grid">
        <Dispatch next={next} go={go} />
        <QuickQuote
          rates={rates}
          fuelRate={fuelRate}
          go={() => go('Calculator')}
        />
      </div>
      <FastBooking operators={operators} save={save} />
    </>
  );
}
function Dispatch({ next, go }: { next?: Booking; go: (s: string) => void }) {
  return (
    <section className="panel dispatch">
      <Head over="LIVE DISPATCH" title="Next journey" />
      {next ? (
        <>
          <span className="live">● Ready for dispatch</span>
          <div className="dispatch-strip">
            <b>{fmtDate(next.pickup_at)}</b>
            <strong>{fmtTime(next.pickup_at)}</strong>
            <span>{next.operator}</span>
          </div>
          <div className="route">
            <i />
            <div>
              <small>PICKUP</small>
              <b>{next.pickup}</b>
              <p>
                {next.passenger_name} · {next.passengers} passenger(s)
              </p>
            </div>
            <i />
            <div>
              <small>DROP-OFF</small>
              <b>{next.dropoff}</b>
              <p>{next.notes || 'No dispatch notes'}</p>
            </div>
          </div>
          <div className="job">
            <span>{initials(next.passenger_name)}</span>
            <p>
              <b>{next.passenger_name}</b>
              {next.fleet_tier} · £{next.fare.toFixed(2)}
            </p>
            <button onClick={() => go('Booking Control')}>
              Manage dispatch →
            </button>
          </div>
        </>
      ) : (
        <Empty text="No upcoming dispatches." />
      )}
    </section>
  );
}
function QuickQuote({
  rates,
  fuelRate,
  go,
}: {
  rates: Rates;
  fuelRate: number;
  go: () => void;
}) {
  const [d, setD] = useState(10),
    [tier, setTier] = useState<keyof Rates>('Saloon'),
    cfg = rates[tier],
    fuel = (d * fuelRate) / 100,
    total = cfg.base + d * cfg.rate + fuel;
  return (
    <section className="panel quote">
      <Head over="MODEL A · FAST QUOTE" title="Quick quote" />
      <div className="form-grid">
        <label>
          Fleet
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as keyof Rates)}
          >
            {Object.keys(rates).map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          Distance
          <input
            type="number"
            min="0"
            value={d}
            onChange={(e) => setD(+e.target.value)}
          />
        </label>
      </div>
      <div className="total">
        <small>ESTIMATED FARE</small>
        <b>£{total.toFixed(2)}</b>
        <span>
          £{cfg.base} base + {d} × £{cfg.rate} + £{fuel.toFixed(2)} fuel
        </span>
      </div>
      <button className="primary full" onClick={go}>
        Open full calculator →
      </button>
    </section>
  );
}
function FastBooking({
  operators,
  save,
}: {
  operators: string[];
  save: (d: Record<string, unknown>) => void;
}) {
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    save({
      ...d,
      pickupAt: d.pickupAt || new Date().toISOString(),
      passengers: 1,
      status: 'upcoming',
    });
    e.currentTarget.reset();
  };
  return (
    <section className="panel fast-bar">
      <Head over="FAST QUOTE & BOOKING BAR" title="Quick-save a job" />
      <form onSubmit={submit}>
        <input name="passengerName" placeholder="Passenger" required />
        <select name="operator">
          {operators.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        <select name="bookingType" aria-label="Booking type">
          <option value="CASH">CASH</option>
          <option value="ACCOUNT">ACCOUNT</option>
        </select>
        <input name="pickup" placeholder="Pickup" required />
        <input name="dropoff" placeholder="Drop-off" required />
        <input name="pickupAt" type="datetime-local" required />
        <input name="fare" type="number" step="0.01" placeholder="Fare £" />
        <button className="primary">
          <Save />
          Save
        </button>
      </form>
    </section>
  );
}

function Bookings({
  items,
  loading,
  done,
  remove,
  view,
  edit,
  add,
}: {
  items: Booking[];
  loading: boolean;
  done: (id: number, s: string) => void;
  remove: (id: number) => void;
  view: (b: Booking) => void;
  edit: (b: Booking) => void;
  add: () => void;
}) {
  const [tab, setTab] = useState<'active' | 'complete'>('active');
  const shown = items.filter((b) =>
    tab === 'complete'
      ? b.status === 'complete'
      : b.status !== 'complete' && b.status !== 'archived',
  );
  return (
    <Page
      title="Booking control"
      sub="Active and completed jobs are kept in separate views."
      action={
        <button className="primary" onClick={add}>
          <Plus />
          Add job
        </button>
      }
    >
      <div className="view-tabs">
        <button
          className={tab === 'active' ? 'active' : ''}
          onClick={() => setTab('active')}
        >
          Active jobs
        </button>
        <button
          className={tab === 'complete' ? 'active' : ''}
          onClick={() => setTab('complete')}
        >
          Completed jobs ({items.filter((b) => b.status === 'complete').length})
        </button>
      </div>
      {loading && <p>Loading…</p>}
      <div className="records">
        {shown.map((b) => (
          <article className="record" key={b.id}>
            <div className="avatar">{initials(b.passenger_name)}</div>
            <div className="record-main">
              <small>
                {fmtDate(b.pickup_at)} · {fmtTime(b.pickup_at)} ·{' '}
                <em>{b.operator}</em> · {b.booking_type || 'CASH'}
              </small>
              <h3>{b.passenger_name}</h3>
              <p>
                {b.pickup} <span>→</span> {b.dropoff}
              </p>
            </div>
            <div className="record-fare">
              <b>£{b.fare.toFixed(2)}</b>
              <span className={`pill ${b.status}`}>{b.status}</span>
            </div>
            <div className="record-actions">
              <button onClick={() => view(b)} title="View details">
                <Eye />
              </button>
              <button onClick={() => edit(b)} title="Edit booking">
                <Pencil />
              </button>
              {b.status !== 'complete' && (
                <button
                  onClick={() => done(b.id, 'complete')}
                  title="Mark complete"
                >
                  <Check />
                </button>
              )}
              <button onClick={() => remove(b.id)} title="Remove">
                <Trash2 />
              </button>
            </div>
          </article>
        ))}
      </div>
    </Page>
  );
}

function Calculator({
  rates,
  fuelRate,
  operators,
  save,
}: {
  rates: Rates;
  fuelRate: number;
  operators: string[];
  save: (d: Record<string, unknown>) => void;
}) {
  const [model, setModel] = useState<'A' | 'B'>('A'),
    [doc, setDoc] = useState<'quote' | 'confirmation'>('quote'),
    [tier, setTier] = useState<keyof Rates>('Saloon'),
    [distance, setDistance] = useState(0),
    [duration, setDuration] = useState(0),
    [waiting, setWaiting] = useState(0),
    [airport, setAirport] = useState(0),
    [fuel, setFuel] = useState(true),
    [fixed, setFixed] = useState(''),
    [passenger, setPassenger] = useState(''),
    [phone, setPhone] = useState(''),
    [pickup, setPickup] = useState(''),
    [dropoff, setDropoff] = useState(''),
    [date, setDate] = useState(''),
    [operator, setOperator] = useState('APX RIDE'),
    [bookingType, setBookingType] = useState<'CASH' | 'ACCOUNT'>('CASH'),
    [pax, setPax] = useState(1),
    [large, setLarge] = useState(0),
    [small, setSmall] = useState(0);
  const cfg = rates[tier],
    miles = model === 'A' ? distance : Math.max(0, distance - 1),
    distanceCharge = miles * cfg.rate,
    fuelCost = fuel ? (distance * fuelRate) / 100 : 0,
    durationCharge = duration * waiting,
    total = fixed
      ? +fixed
      : cfg.base + distanceCharge + fuelCost + durationCharge + airport;
  const reset = () => {
    setDistance(0);
    setDuration(0);
    setWaiting(0);
    setAirport(0);
    setFixed('');
    setPassenger('');
    setPhone('');
    setPickup('');
    setDropoff('');
    setDate('');
    setPax(1);
    setLarge(0);
    setSmall(0);
    setTier('Saloon');
    setModel('A');
    setDoc('quote');
    setBookingType('CASH');
  };
  const payload = {
    passengerName: passenger || 'Quote passenger',
    phone,
    pickup: pickup || 'Pickup',
    dropoff: dropoff || 'Drop-off',
    pickupAt: date || new Date().toISOString(),
    operator,
    bookingType,
    passengers: pax,
    largeBags: large,
    smallBags: small,
    fleetTier: tier,
    distance,
    fare: total,
    notes: `${doc === 'quote' ? 'Official quote' : 'Booking confirmation'} · Fare Model ${model}`,
  };
  return (
    <Page
      title="Calculator / quote"
      sub="Create a quote or confirmation, save the job, and generate a branded PDF."
    >
      <div className="view-tabs doc-tabs">
        <button
          className={doc === 'quote' ? 'active' : ''}
          onClick={() => setDoc('quote')}
        >
          Official booking quote
        </button>
        <button
          className={doc === 'confirmation' ? 'active' : ''}
          onClick={() => setDoc('confirmation')}
        >
          Booking confirmation
        </button>
      </div>
      <div className="quote-layout">
        <section className="panel form-card">
          <h3>Passenger & route</h3>
          <div className="form-grid">
            <Field label="Passenger" value={passenger} set={setPassenger} />
            <Field label="Contact" value={phone} set={setPhone} />
            <Field label="Pickup" value={pickup} set={setPickup} />
            <Field label="Drop-off" value={dropoff} set={setDropoff} />
            <Field
              label="Trip date & time"
              value={date}
              set={setDate}
              type="datetime-local"
            />
            <Field
              label="Distance (miles)"
              value={String(distance)}
              set={(v) => setDistance(+v)}
              type="number"
            />
          </div>
          <h3>Capacity & pricing</h3>
          <div className="form-grid thirds">
            <Num label="Passengers" value={pax} set={setPax} max={7} />
            <Num label="Large bags" value={large} set={setLarge} max={4} />
            <Num label="Small bags" value={small} set={setSmall} max={4} />
          </div>
          <p className="recommend">
            Recommended fleet: <b>{vehicle(pax, large, small)}</b>
          </p>
          <div className="form-grid">
            <label>
              Operator
              <select
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
              >
                {operators.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
            <label>
              Booking type
              <select
                value={bookingType}
                onChange={(e) =>
                  setBookingType(e.target.value as 'CASH' | 'ACCOUNT')
                }
              >
                <option>CASH</option>
                <option>ACCOUNT</option>
              </select>
            </label>
            <label>
              Fleet tier
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value as keyof Rates)}
              >
                {Object.keys(rates).map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Fare model
              <select
                value={model}
                onChange={(e) => setModel(e.target.value as 'A' | 'B')}
              >
                <option value="A">Model A · mileage from mile 1</option>
                <option value="B">Model B · first mile included</option>
              </select>
            </label>
            <Field
              label="Journey / waiting hours"
              value={String(duration)}
              set={(v) => setDuration(+v)}
              type="number"
            />
            <Field
              label="Waiting rate (£/hr)"
              value={String(waiting)}
              set={(v) => setWaiting(+v)}
              type="number"
            />
            <Field
              label="Airport fee (£)"
              value={String(airport)}
              set={(v) => setAirport(+v)}
              type="number"
            />
            <Field
              label="Fixed fare override (£)"
              value={fixed}
              set={setFixed}
              type="number"
            />
            <label className="check">
              <input
                type="checkbox"
                checked={fuel}
                onChange={(e) => setFuel(e.target.checked)}
              />{' '}
              Include fuel (£{fuelRate}/100 miles)
            </label>
          </div>
        </section>
        <section className={`panel preview document-preview ${doc}`}>
          <header className="document-brand">
            <strong>APX RIDE</strong>
            <span>ELEVATE EVERY MILE</span>
            <small>
              {doc === 'quote'
                ? 'AIRPORT TRANSFERS & LONG-DISTANCE PREMIUM QUOTES'
                : 'PREMIUM AIRPORT TRANSFERS & CHAUFFEUR SERVICES'}
            </small>
          </header>
          <h2>
            {doc === 'quote'
              ? 'OFFICIAL BOOKING QUOTE'
              : 'BOOKING CONFIRMATION RECEIPT'}
          </h2>
          {doc === 'confirmation' && (
            <section className="client-block">
              <h3>CLIENT DETAILS</h3>
              <b>{passenger || 'Client name'}</b>
              <span>{phone || 'Email / phone number'}</span>
            </section>
          )}
          <div className="blueprint">
            <span>{doc === 'quote' ? 'ROUTE BLUEPRINT' : 'ROUTE DETAILS'}</span>
            <b>FROM: {pickup || 'Not specified'}</b>
            <i>to</i>
            <b>TO: {dropoff || 'Not specified'}</b>
          </div>
          <dl>
            <div>
              <dt>Passenger</dt>
              <dd>{passenger || '—'}</dd>
            </div>
            <div>
              <dt>Journey date</dt>
              <dd>{date ? fmtDate(date) : '—'}</dd>
            </div>
            <div>
              <dt>Booking type</dt>
              <dd>{bookingType}</dd>
            </div>
            <div>
              <dt>Vehicle specification</dt>
              <dd>{tier}</dd>
            </div>
            <Line k="Base minimum" v={cfg.base} />
            <Line k={`Distance · Model ${model}`} v={distanceCharge} />
            <Line k="Journey / waiting" v={durationCharge} />
            <Line k="Fuel expense" v={fuelCost} />
            <Line k="Airport fee" v={airport} />
          </dl>
          {doc === 'confirmation' && (
            <section className="schedule-block">
              <h3>SCHEDULE DETAILS</h3>
              <div>
                <span>Deployment date</span>
                <b>{date ? fmtDate(date) : '—'}</b>
              </div>
              <div>
                <span>Dispatch time</span>
                <b>{date ? fmtTime(date) : '—'} (Scheduled GMT Line)</b>
              </div>
              <div>
                <span>System log generation</span>
                <b>{new Date().toLocaleDateString('en-GB')}</b>
              </div>
            </section>
          )}
          <div className="grand">
            <span>
              TOTAL {doc === 'quote' ? 'ESTIMATED' : 'CONFIRMED'} FARE
            </span>
            <b>£{total.toFixed(2)}</b>
          </div>
          <p className="formula">
            {fixed
              ? 'Fixed fare override applied'
              : `£${cfg.base} + ${miles} miles × £${cfg.rate} + extras`}
          </p>
          {doc === 'confirmation' && (
            <p className="terms">
              <b>Terms & Conditions:</b> Thank you for selecting APX RIDE. Your
              vehicle allocation is secured for the confirmed schedule.
              Cancellation and dispatch terms apply.
            </p>
          )}
          <div className="preview-actions">
            <button onClick={reset}>
              <X />
              Reset calculator
            </button>
            <button onClick={() => window.print()}>
              <Printer />
              Generate {doc === 'quote' ? 'quote' : 'confirmation'} PDF
            </button>
            <button className="primary" onClick={() => save(payload)}>
              <Save />
              Save job to bookings
            </button>
          </div>
        </section>
      </div>
    </Page>
  );
}

function SettingsPage({
  operators,
  rates,
  fuelRate,
  persist,
}: {
  operators: string[];
  rates: Rates;
  fuelRate: number;
  persist: (o: string[], r: Rates, f: number) => void;
}) {
  const [tab, setTab] = useState<
      'drivers' | 'vehicles' | 'templates' | 'operators' | 'rates'
    >('drivers'),
    [ops, setOps] = useState(operators),
    [draft, setDraft] = useState(''),
    [localRates, setLocalRates] = useState(rates),
    [fuel, setFuel] = useState(fuelRate),
    [drivers, setDrivers] = useState<string[]>(() =>
      JSON.parse(localStorage.getItem('apx-drivers') || '[]'),
    ),
    [vehicles, setVehicles] = useState<string[]>(() =>
      JSON.parse(localStorage.getItem('apx-vehicles') || '[]'),
    ),
    [entry, setEntry] = useState('');
  const storeList = (
    key: string,
    value: string[],
    setter: (v: string[]) => void,
  ) => {
    setter(value);
    localStorage.setItem(key, JSON.stringify(value));
    setEntry('');
  };
  const addOp = () => {
    const n = draft.trim();
    if (n && !ops.some((o) => o.toLowerCase() === n.toLowerCase())) {
      setOps([...ops, n]);
      setDraft('');
    }
  };
  return (
    <Page
      title="System settings"
      sub="Profiles, templates, operators and rates are organised in separate tabs."
    >
      <div className="view-tabs settings-tabs">
        <button
          className={tab === 'drivers' ? 'active' : ''}
          onClick={() => setTab('drivers')}
        >
          Drivers
        </button>
        <button
          className={tab === 'vehicles' ? 'active' : ''}
          onClick={() => setTab('vehicles')}
        >
          Vehicles
        </button>
        <button
          className={tab === 'templates' ? 'active' : ''}
          onClick={() => setTab('templates')}
        >
          Notification templates
        </button>
        <button
          className={tab === 'operators' ? 'active' : ''}
          onClick={() => setTab('operators')}
        >
          Operators
        </button>
        <button
          className={tab === 'rates' ? 'active' : ''}
          onClick={() => setTab('rates')}
        >
          Default rates
        </button>
      </div>
      {tab === 'drivers' && (
        <ProfileList
          title="Driver profiles"
          hint="Driver name · phone · badge/licence"
          items={drivers}
          entry={entry}
          setEntry={setEntry}
          save={(v) => storeList('apx-drivers', v, setDrivers)}
        />
      )}{' '}
      {tab === 'vehicles' && (
        <ProfileList
          title="Vehicle profiles"
          hint="Make/model · registration · colour"
          items={vehicles}
          entry={entry}
          setEntry={setEntry}
          save={(v) => storeList('apx-vehicles', v, setVehicles)}
        />
      )}{' '}
      {tab === 'templates' && (
        <section className="panel">
          <Head over="NOTIFICATIONS" title="Message templates" />
          <p className="note">
            Templates are created and edited in Messages. Saved templates
            automatically remain available for future bookings and can use
            passenger, pickup, drop-off, driver and vehicle placeholders.
          </p>
        </section>
      )}{' '}
      {tab === 'operators' && (
        <section className="panel">
          <Head over="OPERATOR DIRECTORY" title="Dispatch partners" />
          <div className="add-row">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Operator name"
            />
            <button onClick={addOp} className="primary">
              <Plus />
              Add
            </button>
          </div>
          <div className="ledger">
            {ops.map((o) => (
              <div key={o}>
                <span>
                  {o}
                  {o === 'APX RIDE' && <small> · In-house</small>}
                </span>
                {o !== 'APX RIDE' && (
                  <button onClick={() => setOps(ops.filter((x) => x !== o))}>
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            className="primary settings-save"
            onClick={() => persist(ops, localRates, fuel)}
          >
            <Save />
            Save operators
          </button>
        </section>
      )}{' '}
      {tab === 'rates' && (
        <section className="panel">
          <Head over="DEFAULT RATES" title="Fleet rate chart" />
          <div className="rate-table">
            {Object.entries(localRates).map(([n, v]) => (
              <div key={n}>
                <b>{n}</b>
                <label>
                  Base £
                  <input
                    type="number"
                    step="0.01"
                    value={v.base}
                    onChange={(e) =>
                      setLocalRates({
                        ...localRates,
                        [n]: { ...v, base: +e.target.value },
                      })
                    }
                  />
                </label>
                <label>
                  Per mile £
                  <input
                    type="number"
                    step="0.01"
                    value={v.rate}
                    onChange={(e) =>
                      setLocalRates({
                        ...localRates,
                        [n]: { ...v, rate: +e.target.value },
                      })
                    }
                  />
                </label>
              </div>
            ))}
          </div>
          <label>
            Fuel cost per 100 miles
            <input
              type="number"
              step="0.01"
              value={fuel}
              onChange={(e) => setFuel(+e.target.value)}
            />
          </label>
          <button
            className="primary settings-save"
            onClick={() => persist(ops, localRates, fuel)}
          >
            <Save />
            Save default rates
          </button>
        </section>
      )}
    </Page>
  );
}
function ProfileList({
  title,
  hint,
  items,
  entry,
  setEntry,
  save,
}: {
  title: string;
  hint: string;
  items: string[];
  entry: string;
  setEntry: (v: string) => void;
  save: (v: string[]) => void;
}) {
  return (
    <section className="panel">
      <Head over="ROSTER" title={title} />
      <div className="add-row">
        <input
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
          placeholder={hint}
        />
        <button
          className="primary"
          onClick={() => entry.trim() && save([...items, entry.trim()])}
        >
          <Plus />
          Add
        </button>
      </div>
      <div className="ledger">
        {items.map((x, i) => (
          <div key={i}>
            <span>{x}</span>
            <button onClick={() => save(items.filter((_, n) => n !== i))}>
              Remove
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function BookingModal({
  booking,
  operators,
  close,
  save,
}: {
  booking: Booking | null;
  operators: string[];
  close: () => void;
  save: (d: Record<string, unknown>, id?: number) => void;
}) {
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    save(Object.fromEntries(new FormData(e.currentTarget)), booking?.id);
  };
  return (
    <div className="modal">
      <button className="scrim" onClick={close} />
      <form onSubmit={submit}>
        <header>
          <div>
            <small>{booking ? 'EDIT DISPATCH' : 'NEW DISPATCH'}</small>
            <h2>{booking ? 'Edit booking' : 'Add booking'}</h2>
          </div>
          <button type="button" onClick={close}>
            <X />
          </button>
        </header>
        <div className="form-grid">
          <label>
            Passenger name
            <input
              name="passengerName"
              defaultValue={booking?.passenger_name}
              required
            />
          </label>
          <label>
            Contact
            <input name="phone" defaultValue={booking?.phone} />
          </label>
          <label>
            Pickup
            <input name="pickup" defaultValue={booking?.pickup} required />
          </label>
          <label>
            Drop-off
            <input name="dropoff" defaultValue={booking?.dropoff} required />
          </label>
          <label>
            Pickup date & time
            <input
              name="pickupAt"
              type="datetime-local"
              defaultValue={booking?.pickup_at?.slice(0, 16)}
              required
            />
          </label>
          <label>
            Operator
            <select
              name="operator"
              defaultValue={booking?.operator || 'APX RIDE'}
            >
              {operators.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
          <label>
            Booking type
            <select
              name="bookingType"
              defaultValue={booking?.booking_type || 'CASH'}
            >
              <option>CASH</option>
              <option>ACCOUNT</option>
            </select>
          </label>
          <label>
            Passengers
            <input
              name="passengers"
              type="number"
              min="1"
              max="7"
              defaultValue={booking?.passengers || 1}
            />
          </label>
          <label>
            Fleet
            <select
              name="fleetTier"
              defaultValue={booking?.fleet_tier || 'Saloon'}
            >
              {Object.keys(defaultRates).map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Distance
            <input
              name="distance"
              type="number"
              step="0.1"
              defaultValue={booking?.distance || 0}
            />
          </label>
          <label>
            Fare (£)
            <input
              name="fare"
              type="number"
              step="0.01"
              min="0"
              defaultValue={booking?.fare || 0}
            />
          </label>
          <label className="wide">
            Notes
            <textarea name="notes" rows={3} defaultValue={booking?.notes} />
          </label>
        </div>
        <footer>
          <button type="button" onClick={close}>
            Cancel
          </button>
          <button className="primary">
            <Save />
            {booking ? 'Update booking' : 'Save booking'}
          </button>
        </footer>
      </form>
    </div>
  );
}
function BookingDetail({
  booking: b,
  close,
  edit,
}: {
  booking: Booking;
  close: () => void;
  edit: () => void;
}) {
  return (
    <div className="modal">
      <button className="scrim" onClick={close} />
      <section className="detail-card">
        <header>
          <div>
            <small>BOOKING DETAILS</small>
            <h2>{b.passenger_name}</h2>
          </div>
          <button onClick={close}>
            <X />
          </button>
        </header>
        <div className="detail-route">
          <span>{b.pickup}</span>
          <i>→</i>
          <span>{b.dropoff}</span>
        </div>
        <dl>
          <div>
            <dt>Date & time</dt>
            <dd>
              {fmtDate(b.pickup_at)} · {fmtTime(b.pickup_at)}
            </dd>
          </div>
          <div>
            <dt>Operator</dt>
            <dd>{b.operator}</dd>
          </div>
          <div>
            <dt>Booking type</dt>
            <dd>{b.booking_type || 'CASH'}</dd>
          </div>
          <div>
            <dt>Contact</dt>
            <dd>{b.phone || '—'}</dd>
          </div>
          <div>
            <dt>Fleet</dt>
            <dd>{b.fleet_tier}</dd>
          </div>
          <div>
            <dt>Passengers / bags</dt>
            <dd>
              {b.passengers} / {b.large_bags + b.small_bags}
            </dd>
          </div>
          <div>
            <dt>Fare</dt>
            <dd>£{b.fare.toFixed(2)}</dd>
          </div>
          <div>
            <dt>Notes</dt>
            <dd>{b.notes || '—'}</dd>
          </div>
        </dl>
        <footer>
          <button onClick={close}>Close</button>
          <button className="primary" onClick={edit}>
            <Pencil />
            Edit
          </button>
        </footer>
      </section>
    </div>
  );
}

function Calendar({ items }: { items: Booking[] }) {
  const [tab, setTab] = useState<'list' | 'calendar'>('list'),
    [days, setDays] = useState<string[]>(() => {
      try {
        return JSON.parse(localStorage.getItem('apx-unavailable') || '[]');
      } catch {
        return [];
      }
    }),
    [day, setDay] = useState('');
  const jobs = items
    .filter((b) => b.status !== 'archived')
    .sort((a, b) => a.pickup_at.localeCompare(b.pickup_at));
  const unavailable = (d: string) => days.includes(d);
  const addDay = () => {
    if (day && !days.includes(day)) {
      const n = [...days, day];
      setDays(n);
      localStorage.setItem('apx-unavailable', JSON.stringify(n));
      setDay('');
    }
  };
  const month = Array.from({ length: 35 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    const offset = (d.getDay() + 6) % 7;
    d.setDate(i - offset + 1);
    return d;
  });
  return (
    <Page
      title="Dispatch calendar"
      sub="Switch between the dispatch list and monthly availability."
    >
      <div className="view-tabs">
        <button
          className={tab === 'list' ? 'active' : ''}
          onClick={() => setTab('list')}
        >
          List view
        </button>
        <button
          className={tab === 'calendar' ? 'active' : ''}
          onClick={() => setTab('calendar')}
        >
          Calendar view
        </button>
      </div>
      {tab === 'list' ? (
        <div className="calendar-list">
          {jobs.map((b) => (
            <article key={b.id}>
              <time>
                <b>{new Date(b.pickup_at).getDate()}</b>
                {new Date(b.pickup_at)
                  .toLocaleDateString('en-GB', { month: 'short' })
                  .toUpperCase()}
              </time>
              <div>
                <small>
                  {fmtTime(b.pickup_at)} · {b.operator} ·{' '}
                  {b.booking_type || 'CASH'}
                </small>
                <h3>{b.passenger_name}</h3>
                <p>
                  {b.pickup} → {b.dropoff}
                </p>
              </div>
              <b>£{b.fare.toFixed(2)}</b>
            </article>
          ))}
        </div>
      ) : (
        <>
          <section className="panel availability">
            <Head over="AVAILABILITY" title="Mark an unavailable day" />
            <div className="add-row">
              <input
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
              <button className="primary" onClick={addDay}>
                <Plus />
                Add unavailable day
              </button>
            </div>
          </section>
          <div className="month-grid">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((x) => (
              <b key={x}>{x}</b>
            ))}
            {month.map((d, i) => {
              const key = d.toISOString().slice(0, 10),
                count = jobs.filter(
                  (j) => j.pickup_at.slice(0, 10) === key,
                ).length;
              return (
                <button
                  key={i}
                  className={unavailable(key) ? 'unavailable' : ''}
                  onClick={() =>
                    unavailable(key) &&
                    setDays((v) => {
                      const n = v.filter((x) => x !== key);
                      localStorage.setItem(
                        'apx-unavailable',
                        JSON.stringify(n),
                      );
                      return n;
                    })
                  }
                >
                  <span>{d.getDate()}</span>
                  {count > 0 && (
                    <small>
                      {count} job{count > 1 ? 's' : ''}
                    </small>
                  )}
                  {unavailable(key) && <em>Unavailable</em>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </Page>
  );
}
function Messages({ items }: { items: Booking[] }) {
  const defaults = {
    enroute:
      'Good day, {passenger}. Your APX RIDE chauffeur is en route for your transfer to {dropoff}. Driver: {driver}. Vehicle: {vehicle}.',
    arrived: 'Good day, {passenger}. Your chauffeur has arrived at {pickup}.',
    review:
      'Dear {passenger}, thank you for choosing APX RIDE for your journey to {dropoff}.',
  };
  const [selected, setSelected] = useState(items[0]?.id),
    [kind, setKind] = useState<keyof typeof defaults>('enroute'),
    [templates, setTemplates] = useState(defaults),
    [draft, setDraft] = useState(defaults.enroute),
    b = items.find((x) => x.id === selected) || items[0];
  useEffect(() => {
    try {
      const t = JSON.parse(
        localStorage.getItem('apx-message-templates') || 'null',
      );
      if (t) {
        setTemplates(t);
        setDraft(t[kind]);
      }
    } catch {}
  }, []);
  const choose = (k: keyof typeof defaults) => {
    setKind(k);
    setDraft(templates[k]);
  };
  const text = b
    ? draft
        .replaceAll('{passenger}', b.passenger_name)
        .replaceAll('{pickup}', b.pickup)
        .replaceAll('{dropoff}', b.dropoff)
        .replaceAll('{driver}', 'your assigned driver')
        .replaceAll('{vehicle}', b.fleet_tier)
    : draft;
  const saveTemplate = () => {
    const t = { ...templates, [kind]: draft };
    setTemplates(t);
    localStorage.setItem('apx-message-templates', JSON.stringify(t));
  };
  return (
    <Page
      title="Passenger messages"
      sub="Choose, customise and save reusable message templates."
    >
      <div className="message-grid">
        <section className="panel">
          <label>
            Booking
            <select
              value={selected}
              onChange={(e) => setSelected(+e.target.value)}
            >
              {items.map((x) => (
                <option value={x.id} key={x.id}>
                  {x.passenger_name} · {x.operator}
                </option>
              ))}
            </select>
          </label>
          <label>
            Template
            <select
              value={kind}
              onChange={(e) => choose(e.target.value as keyof typeof defaults)}
            >
              <option value="enroute">Vehicle en route</option>
              <option value="arrived">Driver arrived</option>
              <option value="review">Journey complete</option>
            </select>
          </label>
          <label>
            Edit template
            <textarea
              rows={7}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </label>
          <button className="primary settings-save" onClick={saveTemplate}>
            <Save />
            Save template
          </button>
        </section>
        <section className="panel message-preview">
          <small>MESSAGE PREVIEW</small>
          <p>{text}</p>
          <div>
            <button onClick={() => navigator.clipboard.writeText(text)}>
              <Copy />
              Copy
            </button>
            {b?.phone && (
              <a href={`sms:${b.phone}?body=${encodeURIComponent(text)}`}>
                Open SMS
              </a>
            )}
          </div>
        </section>
      </div>
    </Page>
  );
}
function Earnings({ items }: { items: Booking[] }) {
  type Expense = {
    id: number;
    date: string;
    category: string;
    amount: number;
    note: string;
  };
  const done = items.filter((b) => b.status === 'complete'),
    total = done.reduce((a, b) => a + b.fare, 0),
    [tab, setTab] = useState<'income' | 'expenses'>('income'),
    [period, setPeriod] = useState<'week' | 'month' | 'all'>('month'),
    [expenses, setExpenses] = useState<Expense[]>(() => {
      try {
        return JSON.parse(localStorage.getItem('apx-expenses') || '[]');
      } catch {
        return [];
      }
    });
  const cutoff = new Date();
  if (period === 'week') cutoff.setDate(cutoff.getDate() - 7);
  if (period === 'month') cutoff.setMonth(cutoff.getMonth() - 1);
  const shown = expenses.filter(
      (e) => period === 'all' || new Date(e.date) >= cutoff,
    ),
    spent = shown.reduce((a, e) => a + e.amount, 0);
  const add = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    const n = [
      ...expenses,
      {
        id: Date.now(),
        date: String(d.date),
        category: String(d.category),
        amount: +d.amount,
        note: String(d.note || ''),
      },
    ];
    setExpenses(n);
    localStorage.setItem('apx-expenses', JSON.stringify(n));
    e.currentTarget.reset();
  };
  return (
    <Page
      title="Earnings & expenses"
      sub="Track completed income and daily operating costs."
    >
      <div className="view-tabs">
        <button
          className={tab === 'income' ? 'active' : ''}
          onClick={() => setTab('income')}
        >
          Income
        </button>
        <button
          className={tab === 'expenses' ? 'active' : ''}
          onClick={() => setTab('expenses')}
        >
          Expenses
        </button>
      </div>
      {tab === 'income' ? (
        <>
          <div className="stats">
            <Stat
              icon={PoundSterling}
              label="Total earnings"
              value={`£${total.toFixed(2)}`}
              detail={`${done.length} completed jobs`}
            />
            <Stat
              icon={CalendarDays}
              label="Average job"
              value={`£${done.length ? (total / done.length).toFixed(2) : '0.00'}`}
              detail="Completed work"
            />
            <Stat
              icon={CircleGauge}
              label="Account jobs"
              value={String(
                done.filter((b) => b.booking_type === 'ACCOUNT').length,
              )}
              detail="Operator-collected"
            />
          </div>
          <section className="panel">
            <div className="ledger">
              {done.map((b) => (
                <div key={b.id}>
                  <span>
                    {fmtDate(b.pickup_at)} · {b.passenger_name} ·{' '}
                    {b.booking_type || 'CASH'}
                  </span>
                  <b>£{b.fare.toFixed(2)}</b>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="panel expense-tools">
            <form onSubmit={add}>
              <input name="date" type="date" required />
              <select name="category">
                <option>Fuel</option>
                <option>Maintenance</option>
                <option>Other</option>
              </select>
              <input
                name="amount"
                type="number"
                step="0.01"
                placeholder="Amount £"
                required
              />
              <input name="note" placeholder="Note" />
              <button className="primary">
                <Plus />
                Add expense
              </button>
            </form>
            <div className="period">
              <button onClick={() => setPeriod('week')}>7 days</button>
              <button onClick={() => setPeriod('month')}>30 days</button>
              <button onClick={() => setPeriod('all')}>All</button>
              <strong>Total £{spent.toFixed(2)}</strong>
            </div>
          </section>
          <section className="panel">
            <div className="ledger">
              {shown.map((e) => (
                <div key={e.id}>
                  <span>
                    {fmtDate(e.date)} · {e.category} · {e.note}
                  </span>
                  <b>£{e.amount.toFixed(2)}</b>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </Page>
  );
}

function Page({
  title,
  sub,
  action,
  children,
}: {
  title: string;
  sub: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <section className="page-head">
        <div>
          <h2>{title}</h2>
          <p>{sub}</p>
        </div>
        {action}
      </section>
      {children}
    </>
  );
}
function Field({
  label,
  value,
  set,
  type = 'text',
}: {
  label: string;
  value: string;
  set: (s: string) => void;
  type?: string;
}) {
  return (
    <label>
      {label}
      <input type={type} value={value} onChange={(e) => set(e.target.value)} />
    </label>
  );
}
function Num({
  label,
  value,
  set,
  max,
}: {
  label: string;
  value: number;
  set: (n: number) => void;
  max: number;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        min="0"
        max={max}
        value={value}
        onChange={(e) => set(+e.target.value)}
      />
    </label>
  );
}
function Line({ k, v }: { k: string; v: number }) {
  return (
    <div>
      <dt>{k}</dt>
      <dd>£{v.toFixed(2)}</dd>
    </div>
  );
}
function Head({ over, title }: { over: string; title: string }) {
  return (
    <header className="head">
      <small>{over}</small>
      <h3>{title}</h3>
    </header>
  );
}
function Stat({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof PoundSterling;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="stat">
      <div>
        <Icon />
      </div>
      <span>{label}</span>
      <b>{value}</b>
      <small>{detail}</small>
    </article>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="empty">{text}</p>;
}
const initials = (s: string) =>
  s
    .split(' ')
    .map((x) => x[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
const fmtTime = (s: string) =>
  new Date(s).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
function vehicle(p: number, l: number, s: number) {
  if (p <= 4 && l <= 2 && s <= 2) return 'Saloon';
  if (p <= 4 && l <= 3 && s <= 3) return 'Estate';
  if (p <= 5 && l <= 4 && s <= 4) return '6-seater';
  return '7-seater';
}
