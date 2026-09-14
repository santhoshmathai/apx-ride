'use client';
import { FormEvent, useEffect, useState } from 'react';
import {
  CalendarDays,
  CarFront,
  Check,
  CircleGauge,
  Copy,
  Download,
  Eye,
  FileText,
  FolderLock,
  LayoutDashboard,
  LogOut,
  Mail,
  MessageSquareText,
  Menu,
  Pencil,
  Plus,
  Settings,
  PoundSterling,
  Printer,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { RecordsHub } from './records-hub';

type Booking = {
  id: number;
  passenger_name: string;
  phone: string;
  pickup: string;
  dropoff: string;
  pickup_at: string;
  operator: string;
  booking_type?: 'CASH' | 'ACCOUNT';
  payment_method?: 'CASH' | 'CARD' | '';
  account_status?: 'pending' | 'settled';
  passengers: number;
  large_bags: number;
  small_bags: number;
  fleet_tier: string;
  distance: number;
  fare: number;
  status: string;
  notes: string;
  driver_call_sign?: string;
  driver_name?: string;
  driver_licence?: string;
};
type Rate = { base: number; rate: number };
type Rates = Record<'Saloon' | 'Estate' | '6-seater' | '7-seater', Rate>;
type Tariff = 'day' | 'night';
type TariffRates = Record<Tariff, Rates>;
const defaultRates: Rates = {
  Saloon: { base: 6, rate: 1.6 },
  Estate: { base: 7, rate: 1.7 },
  '6-seater': { base: 8, rate: 2.2 },
  '7-seater': { base: 9, rate: 2.5 },
};
const defaultTariffRates: TariffRates = {
  day: defaultRates,
  night: {
    Saloon: { base: 7.5, rate: 2 },
    Estate: { base: 8.5, rate: 2.15 },
    '6-seater': { base: 10, rate: 2.75 },
    '7-seater': { base: 11, rate: 3.1 },
  },
};
function normaliseRates(value: unknown): TariffRates {
  const input = value as Partial<TariffRates> & Partial<Rates> | null;
  if (input?.day && input?.night) return input as TariffRates;
  if (input?.Saloon) return { day: input as Rates, night: input as Rates };
  return defaultTariffRates;
}
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
  ['Records Hub', FolderLock],
  ['Earnings', PoundSterling],
  ['Settings', Settings],
] as const;
let activeTimeFormat: '12' | '24' = '24';

export function AppShell({ signOutPath }: { signOutPath: string }) {
  const [active, setActive] = useState('Dashboard'),
    [mobile, setMobile] = useState(false),
    [modal, setModal] = useState<Booking | null | undefined>(),
    [detail, setDetail] = useState<Booking | null>(null),
    [bookings, setBookings] = useState<Booking[]>([]),
    [loading, setLoading] = useState(true);
  const [operators, setOperators] = useState<string[]>(['APX RIDE']),
    [rates, setRates] = useState<TariffRates>(defaultTariffRates),
    [fuelRate, setFuelRate] = useState(50),
    [timeFormat, setTimeFormat] = useState<'12' | '24'>('24');
  useEffect(() => { activeTimeFormat = timeFormat; }, [timeFormat]);
  const refresh = () =>
    fetch('/api/bookings')
      .then((r) => r.json())
      .then((d: unknown) => {
        if (Array.isArray(d)) setBookings(d as Booking[]);
      });
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem('apx-settings') || '{}');
      if (s.operators) setOperators(s.operators);
      if (s.rates) setRates(normaliseRates(s.rates));
      if (s.fuelRate !== undefined) setFuelRate(s.fuelRate);
    } catch {}
    void Promise.all([
      refresh(),
      fetch('/api/settings').then((r) => r.json()).then((value: unknown) => {
        const server = value as Record<string, unknown>;
        if (server.operators_json) setOperators(JSON.parse(String(server.operators_json)));
        if (server.rates_json && server.rates_json !== '{}') setRates(normaliseRates(JSON.parse(String(server.rates_json))));
        if (server.fuel_per_100 !== undefined) setFuelRate(Number(server.fuel_per_100));
        if (server.time_format === '12' || server.time_format === '24') setTimeFormat(server.time_format);
      }),
    ]).finally(() => setLoading(false));
  }, []);
  const persist = (o = operators, r = rates, f = fuelRate, t = timeFormat) => {
    setOperators(o);
    setRates(r);
    setFuelRate(f);
    setTimeFormat(t);
    localStorage.setItem(
      'apx-settings',
      JSON.stringify({ operators: o, rates: r, fuelRate: f, timeFormat: t }),
    );
    void fetch('/api/settings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ operators: o, rates: r, fuelRate: f, timeFormat: t }) });
  };
  const save = async (data: Record<string, unknown>, id?: number) => {
    await fetch('/api/bookings', {
      method: id ? 'PUT' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(id ? { ...data, id } : data),
    });
    setModal(undefined);
    await refresh();
  };
  const status = async (
    id: number,
    s: string,
    paymentMethod?: string,
    accountStatus?: string,
  ) => {
    await fetch('/api/bookings', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, status: s, paymentMethod, accountStatus }),
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
        signOutPath={signOutPath}
      />
      {mobile && <button className="scrim" onClick={() => setMobile(false)} />}
      <section className="workspace">
        <header
          className={`topbar ${active === 'Dashboard' ? 'dashboard-topbar' : ''}`}
        >
          <button className="menu" onClick={() => setMobile(true)}>
            <Menu />
          </button>
          {active !== 'Dashboard' && (
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
          )}
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
              go={setActive}
              timeFormat={timeFormat}
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
          {active === 'Calendar' && <Calendar items={bookings} />}
          {active === 'Messages' && <Messages items={bookings} />}
          {active === 'Records Hub' && <RecordsHub />}
          {active === 'Earnings' && <EarningsV2 items={bookings} status={status} />}
          {active === 'Settings' && (
            <SettingsPage
              operators={operators}
              rates={rates}
              fuelRate={fuelRate}
              timeFormat={timeFormat}
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
  signOutPath,
}: {
  active: string;
  select: (s: string) => void;
  mobile: boolean;
  close: () => void;
  operators: number;
  signOutPath: string;
}) {
  return (
    <aside className={`sidebar ${mobile ? 'open' : ''}`}>
      <div className="brand">
        <img src="/apx-logo.png" alt="APX Ride logo" />
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
        <a className="sidebar-signout" href={signOutPath}><LogOut />Sign out</a>
      </footer>
    </aside>
  );
}

function Dashboard({
  bookings,
  operators,
  go,
  timeFormat,
}: {
  bookings: Booking[];
  operators: string[];
  go: (s: string) => void;
  timeFormat: '12' | '24';
}) {
  const upcoming = bookings
      .filter((b) => b.status === 'upcoming' || b.status === 'in_progress')
      .sort((a, b) => a.pickup_at.localeCompare(b.pickup_at)),
    next = upcoming[0],
    done = bookings.filter((b) => b.status === 'complete'),
    earn = done.reduce((a, b) => a + b.fare, 0);
  return (
    <>
      <div className="dashboard-hero">
        <div>
          <section className="welcome">
            <div>
              <small>OPERATIONS DESK</small>
              <h2>Good day, Santhosh.</h2>
              <p>Bookings, dispatch and quotes in one live workspace.</p>
            </div>
          </section>
          <Dispatch next={next} following={upcoming[1]} go={go} />
        </div>
        <LiveClock go={() => go('Calendar')} timeFormat={timeFormat} />
      </div>
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
      <TodayJobs jobs={upcoming.filter((booking) => booking.pickup_at.slice(0, 10) === new Date().toISOString().slice(0, 10))} go={go} />
    </>
  );
}
function LiveClock({ go, timeFormat }: { go: () => void; timeFormat: '12' | '24' }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <section className="panel clock-widget">
      <small>LOCAL TIME · LONDON</small>
      <b>
        {now.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: timeFormat === '12',
        })}
      </b>
      <span>
        {now.toLocaleDateString('en-GB', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })}
      </span>
      <button onClick={go}>Open calendar →</button>
    </section>
  );
}
function Dispatch({ next, following, go }: { next?: Booking; following?: Booking; go: (s: string) => void }) {
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
          <div className="route dispatch-route-grid">
            <div className="route-point">
              <i />
              <div>
              <small>PICKUP</small>
              <b>{next.pickup}</b>
              <p>
                {next.passenger_name} · {next.passengers} passenger(s)
              </p>
              </div>
            </div>
            <div className="route-point">
              <i />
              <div>
              <small>DROP-OFF</small>
              <b>{next.dropoff}</b>
              <p>{next.notes || 'No dispatch notes'}</p>
              </div>
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
          {following && (
            <button className="next-job-preview" onClick={() => go('Booking Control')}>
              <time><b>{new Date(following.pickup_at).getDate()}</b>{new Date(following.pickup_at).toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()}</time>
              <div><small>NEXT UPCOMING JOB · {fmtTime(following.pickup_at)} · {following.operator}</small><strong>{following.pickup} → {following.dropoff}</strong><span>{following.passenger_name} · {following.booking_type || 'CASH'}</span></div>
              <em>UPCOMING</em>
            </button>
          )}
        </>
      ) : (
        <Empty text="No upcoming dispatches." />
      )}
    </section>
  );
}

function TodayJobs({ jobs, go }: { jobs: Booking[]; go: (page: string) => void }) {
  return <section className="panel today-jobs"><Head over="TODAY" title="Upcoming jobs today" />{jobs.length ? <div className="today-job-list">{jobs.map((job) => <button key={job.id} onClick={() => go('Booking Control')}><b>{fmtTime(job.pickup_at)}</b><span>{job.pickup} → {job.dropoff}</span><em>{job.operator}</em></button>)}</div> : <Empty text="No Upcoming Jobs Today" />}</section>;
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
      pickupAt: `${d.pickupDate}T${d.pickupTime}`,
      passengers: 1,
      largeBags: d.bags,
      status: 'upcoming',
    });
    e.currentTarget.reset();
  };
  return (
    <section className="panel fast-bar">
      <Head over="FAST QUOTE & BOOKING BAR" title="Quick-save a job" />
      <form onSubmit={submit}>
        <div className="fast-grid top">
          <label>
            Passenger name
            <input name="passengerName" required />
          </label>
          <label>
            Contact number
            <input name="phone" type="tel" required />
          </label>
          <label>
            Pickup address
            <input name="pickup" required />
          </label>
          <label>
            Drop-off address
            <input name="dropoff" required />
          </label>
          <label>
            Pickup date
            <input name="pickupDate" type="date" required />
          </label>
          <label>
            Pickup time
            <input name="pickupTime" type="time" required />
          </label>
          <label>
            Bags / luggage
            <input name="bags" type="number" min="0" defaultValue="0" />
          </label>
        </div>
        <div className="fast-grid bottom">
          <label>
            Fleet tier
            <select name="fleetTier">
              {Object.keys(defaultRates).map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Operator
            <select name="operator">
              {operators.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
          <label>
            Job type
            <select name="bookingType">
              <option value="CASH">CASH</option>
              <option value="ACCOUNT">ACCOUNT</option>
            </select>
          </label>
          <label>
            Fare (£)
            <input name="fare" type="number" step="0.01" min="0" />
          </label>
        </div>
        <label className="fast-note">
          Note
          <textarea
            name="notes"
            rows={3}
            placeholder="Passenger, flight, pickup or dispatch notes"
          />
        </label>
        <button className="primary fast-save">
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
  done: (id: number, s: string, paymentMethod?: string) => void;
  remove: (id: number) => void;
  view: (b: Booking) => void;
  edit: (b: Booking) => void;
  add: () => void;
}) {
  const [tab, setTab] = useState<'active' | 'progress' | 'complete'>('active');
  const [finishing, setFinishing] = useState<Booking | null>(null),
    [messaging, setMessaging] = useState<Booking | null>(null),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [page, setPage] = useState(1);
  const filtered = items.filter((b) =>
    tab === 'complete'
      ? b.status === 'complete'
      : tab === 'progress'
        ? b.status === 'in_progress'
        : b.status === 'upcoming',
  ).filter((b) => tab !== 'complete' || ((!from || b.pickup_at.slice(0, 10) >= from) && (!to || b.pickup_at.slice(0, 10) <= to)))
    .sort((a, b) => a.pickup_at.localeCompare(b.pickup_at));
  const shown = tab === 'complete' ? filtered.slice((page - 1) * 10, page * 10) : filtered;
  return (
    <Page
      title="Booking control"
      sub="Move each dispatch from scheduled to en route, then confirm payment at completion."
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
          className={tab === 'progress' ? 'active' : ''}
          onClick={() => setTab('progress')}
        >
          In Progress / En Route (
          {items.filter((b) => b.status === 'in_progress').length})
        </button>
        <button
          className={tab === 'complete' ? 'active' : ''}
          onClick={() => setTab('complete')}
        >
          Completed jobs ({items.filter((b) => b.status === 'complete').length})
        </button>
      </div>
      {tab === 'complete' && <div className="completed-filter"><label>From date<input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} /></label><label>To date<input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} /></label><button onClick={() => { setFrom(''); setTo(''); setPage(1); }}>Reset</button></div>}
      {loading && <p>Loading…</p>}
      <div className="records">
        {shown.map((b) => (
          <article className="record" key={b.id}>
            <time className="record-date"><b>{new Date(b.pickup_at).getDate()}</b>{new Date(b.pickup_at).toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()}</time>
            <div className="record-main">
              <small>
                APX-{String(b.id).padStart(5, '0')} · {fmtTime(b.pickup_at)} · <em>{b.operator}</em>
              </small>
              <h3>{b.pickup} <span>→</span> {b.dropoff}</h3>
              <p>{b.passenger_name} · {b.fleet_tier} · {b.booking_type || 'CASH'}{b.status === 'complete' && b.driver_name ? ` · Driver ${b.driver_call_sign || ''} ${b.driver_name} ${b.driver_licence ? `(${b.driver_licence})` : ''}` : ''}</p>
            </div>
            <div className="record-fare">
              <b>£{b.fare.toFixed(2)}</b>
              <span className={`pill ${b.status}`}>{b.status}</span>
            </div>
            <div className="record-actions">
              <button onClick={() => view(b)} title="View details">
                <Eye />
              </button>
              {b.status !== 'complete' && <button onClick={() => edit(b)} title="Edit booking"><Pencil /></button>}
              {b.status === 'upcoming' && (
                <button
                  onClick={() => done(b.id, 'in_progress')}
                  title="Move to In Progress / En Route"
                >
                  En route
                </button>
              )}
              {b.status === 'in_progress' && (
                <button onClick={() => setFinishing(b)} title="Finish job">
                  <Check />
                  Finish
                </button>
              )}
              {b.status !== 'complete' && <button onClick={() => setMessaging(b)} title="Message passenger"><Mail /></button>}
              {b.status !== 'complete' && <button onClick={() => remove(b.id)} title="Remove"><Trash2 /></button>}
            </div>
          </article>
        ))}
      </div>
      {tab === 'complete' && filtered.length > 10 && <div className="pager"><button disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><span>Showing {(page - 1) * 10 + 1}–{Math.min(page * 10, filtered.length)} of {filtered.length}</span><button disabled={page * 10 >= filtered.length} onClick={() => setPage(page + 1)}>Next</button></div>}
      {finishing && (
        <PaymentModal
          booking={finishing}
          close={() => setFinishing(null)}
          confirm={(method) => {
            done(finishing.id, 'complete', method);
            setFinishing(null);
            setTab('complete');
          }}
        />
      )}
      {messaging && <QuickMessage booking={messaging} close={() => setMessaging(null)} />}
    </Page>
  );
}

function QuickMessage({ booking, close }: { booking: Booking; close: () => void }) {
  const templates = {
    'Vehicle En Route': `Hello ${booking.passenger_name}, your APX RIDE vehicle is en route to ${booking.pickup} for your journey to ${booking.dropoff}.`,
    'Driver Arrived': `Hello ${booking.passenger_name}, your APX RIDE driver has arrived at ${booking.pickup}.`,
    'Journey Complete': `Thank you ${booking.passenger_name}. Your APX RIDE journey to ${booking.dropoff} is complete.`,
  };
  const [message, setMessage] = useState(templates['Vehicle En Route']);
  const openSms = async () => {
    await fetch('/api/messages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ bookingId: booking.id, channel: 'SMS', recipient: booking.phone, message }) });
    window.location.href = `sms:${booking.phone}?body=${encodeURIComponent(message)}`;
  };
  return <div className="modal"><button className="scrim" onClick={close} /><section className="payment-card quick-message"><header><div><small>PASSENGER MESSAGE</small><h2>{booking.passenger_name}</h2></div><button onClick={close}><X /></button></header><label>Template<select onChange={(e) => setMessage(templates[e.target.value as keyof typeof templates])}>{Object.keys(templates).map((name) => <option key={name}>{name}</option>)}</select></label><label>Message<textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} /></label><footer><button onClick={() => navigator.clipboard.writeText(message)}><Copy />Copy</button><button className="primary sms-link" onClick={openSms}>Open SMS</button></footer></section></div>;
}

function PaymentModal({
  booking,
  close,
  confirm,
}: {
  booking: Booking;
  close: () => void;
  confirm: (method: 'CASH' | 'CARD') => void;
}) {
  const [method, setMethod] = useState<'CASH' | 'CARD'>('CASH');
  return (
    <div className="modal">
      <button className="scrim" onClick={close} />
      <section className="payment-card">
        <header>
          <div>
            <small>FINISH JOB</small>
            <h2>Confirm payment</h2>
          </div>
          <button onClick={close}>
            <X />
          </button>
        </header>
        <p>
          {booking.passenger_name} · £{booking.fare.toFixed(2)}
        </p>
        <label>
          Payment method
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as 'CASH' | 'CARD')}
          >
            <option>CASH</option>
            <option>CARD</option>
          </select>
        </label>
        <footer>
          <button onClick={close}>Cancel</button>
          <button className="primary" onClick={() => confirm(method)}>
            <Check />
            Complete job
          </button>
        </footer>
      </section>
    </div>
  );
}

function Calculator({
  rates,
  fuelRate,
  operators,
  save,
}: {
  rates: TariffRates;
  fuelRate: number;
  operators: string[];
  save: (d: Record<string, unknown>) => void;
}) {
  const [tariff, setTariff] = useState<Tariff>('day'),
    [tariffOverride, setTariffOverride] = useState(false),
    [doc, setDoc] = useState<'quote' | 'confirmation'>('quote'),
    [tier, setTier] = useState<keyof Rates>('Saloon'),
    [distance, setDistance] = useState(0),
    [duration, setDuration] = useState(0),
    [waiting, setWaiting] = useState(0),
    [airport, setAirport] = useState(0),
    [toll, setToll] = useState(0),
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
  useEffect(() => {
    if (!date || tariffOverride) return;
    const trip = new Date(date);
    const hour = trip.getHours();
    setTariff(isEnglandWalesBankHoliday(trip) || hour < 6 || hour >= 22 ? 'night' : 'day');
  }, [date, tariffOverride]);
  const cfg = rates[tariff][tier],
    chargeableMiles = Math.max(0, distance - 1),
    distanceCharge = chargeableMiles * cfg.rate,
    fuelCost = fuel ? (distance * fuelRate) / 100 : 0,
    durationCharge = duration * waiting,
    total = fixed
      ? +fixed
      : cfg.base + distanceCharge + fuelCost + durationCharge + airport + toll;
  const reset = () => {
    setDistance(0);
    setDuration(0);
    setWaiting(0);
    setAirport(0);
    setToll(0);
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
    setTariff('day');
    setTariffOverride(false);
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
    notes: `${doc === 'quote' ? 'Official quote' : 'Booking confirmation'} · ${tariff === 'day' ? 'Day' : 'Night / Holiday'} tariff`,
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
                {Object.keys(rates[tariff]).map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Tariff (Fare Model)
              <select
                value={tariff}
                onChange={(e) => { setTariff(e.target.value as Tariff); setTariffOverride(true); }}
              >
                <option value="day">Day</option>
                <option value="night">Night / Holiday</option>
              </select>
              <small className="field-hint">Auto-selected from trip time; changing it keeps your manual override.</small>
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
              label="Toll fee (£)"
              value={String(toll)}
              set={(v) => setToll(+v)}
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
          <dl className="operator-breakdown">
            <div>
              <dt>Passenger</dt>
              <dd>{passenger || '—'}</dd>
            </div>
            <div>
              <dt>Journey date & time</dt>
              <dd>{date ? `${fmtDate(date)} · ${fmtTime(date)}` : '—'}</dd>
            </div>
            <div>
              <dt>Booking type</dt>
              <dd>{bookingType}</dd>
            </div>
            <div>
              <dt>Fleet tier</dt>
              <dd>{tier}</dd>
            </div>
            <div><dt>Base fare ({tariff === 'day' ? 'Day' : 'Night / Holiday'})</dt><dd>£{cfg.base.toFixed(2)}</dd></div>
            <div><dt>Fare after first mile</dt><dd>£{distanceCharge.toFixed(2)}</dd></div>
            <div><dt>Fuel expense</dt><dd>{fuel ? `£${fuelCost.toFixed(2)}` : 'Not included'}</dd></div>
            <div><dt>Airport fee</dt><dd>£{airport.toFixed(2)}</dd></div>
            <div><dt>Toll fee</dt><dd>£{toll.toFixed(2)}</dd></div>
            <div><dt>Fare model</dt><dd>{tariff === 'day' ? 'Day' : 'Night / Holiday'}</dd></div>
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
            <button onClick={() => printCustomerDocument({ doc, passenger, date, pickup, dropoff, tier, airport, toll, tariff, total })}>
              <Printer />
              Generate {doc === 'quote' ? 'quote' : 'confirmation'} PDF
            </button>
            <button className="primary" onClick={() => save(payload)}>
              <Save />
              Save This Booking
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
  timeFormat,
  persist,
}: {
  operators: string[];
  rates: TariffRates;
  fuelRate: number;
  timeFormat: '12' | '24';
  persist: (o: string[], r: TariffRates, f: number, t?: '12' | '24') => void;
}) {
  const [tab, setTab] = useState<
      'templates' | 'operators' | 'rates' | 'clock' | 'security'
    >('templates'),
    [ops, setOps] = useState(operators),
    [draft, setDraft] = useState(''),
    [localRates, setLocalRates] = useState(rates),
    [fuel, setFuel] = useState(fuelRate),
    [clock, setClock] = useState<'12' | '24'>(timeFormat);
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
        <button className={tab === 'clock' ? 'active' : ''} onClick={() => setTab('clock')}>Clock settings</button>
        <button className={tab === 'security' ? 'active' : ''} onClick={() => setTab('security')}>Security & backup</button>
      </div>
      {tab === 'templates' && (
        <section className="panel">
          <Head over="NOTIFICATIONS" title="Message templates" />
          <p className="note">
            Standard passenger notifications are available from each active or
            en-route booking. They bind the passenger and route automatically.
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
            onClick={() => persist(ops, localRates, fuel, clock)}
          >
            <Save />
            Save operators
          </button>
        </section>
      )}{' '}
      {tab === 'rates' && (
        <section className="panel">
          <Head over="DEFAULT RATES" title="Day and Night / Holiday tariff chart" />
          {(['day', 'night'] as Tariff[]).map((tariffName) => <div className="tariff-rate-group" key={tariffName}>
            <h4>{tariffName === 'day' ? 'Day tariff' : 'Night / Holiday tariff'}</h4>
            <div className="rate-table">
            {Object.entries(localRates[tariffName]).map(([n, v]) => (
              <div key={`${tariffName}-${n}`}>
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
                        [tariffName]: { ...localRates[tariffName], [n]: { ...v, base: +e.target.value } },
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
                        [tariffName]: { ...localRates[tariffName], [n]: { ...v, rate: +e.target.value } },
                      })
                    }
                  />
                </label>
              </div>
            ))}
            </div>
          </div>)}
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
            onClick={() => persist(ops, localRates, fuel, clock)}
          >
            <Save />
            Save default rates
          </button>
        </section>
      )}
      {tab === 'clock' && <section className="panel"><Head over="DISPLAY PREFERENCE" title="Clock & time display" /><p className="note">Choose the time format used by the live operations clock.</p><div className="clock-options"><label><input type="radio" name="clock" checked={clock === '12'} onChange={() => setClock('12')} />12-hour clock <small>03:00 PM</small></label><label><input type="radio" name="clock" checked={clock === '24'} onChange={() => setClock('24')} />24-hour clock <small>15:00</small></label></div><button className="primary settings-save" onClick={() => persist(ops, localRates, fuel, clock)}><Save />Save preference</button></section>}
      {tab === 'security' && <section className="panel security-panel"><Head over="DATA PROTECTION" title="Security & backup" /><div className="security-grid"><article><Check /><div><b>Individual authenticated access</b><p>Every user signs in with their own approved ChatGPT account. Shared PINs are not used.</p></div></article><article><Check /><div><b>Server-side authorisation</b><p>Booking, expense and compliance APIs verify identity and the approved email list.</p></div></article><article><Check /><div><b>Durable records and audit trail</b><p>Operational data is stored in the hosted database; compliance edits create audit entries.</p></div></article><article><Check /><div><b>12-month compliance retention</b><p>Lost property and complaint records show their minimum retention date and cannot be deleted in the portal.</p></div></article></div><a className="primary backup-link" href="/api/backup"><Download />Download full data backup</a><p className="retention-note">Store downloaded backups in an encrypted, access-controlled location. Test restoration and document who is responsible for the backup schedule.</p></section>}
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
          <label>Driver call sign<input name="driverCallSign" defaultValue={booking?.driver_call_sign || ''} /></label>
          <label>Driver name<input name="driverName" defaultValue={booking?.driver_name || ''} /></label>
          <label>Driver licence number<input name="driverLicence" defaultValue={booking?.driver_licence || ''} /></label>
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
            Bags (Large)
            <input
              name="largeBags"
              type="number"
              min="0"
              max="9"
              defaultValue={booking?.large_bags || 0}
            />
          </label>
          <label>
            Bags (Small)
            <input
              name="smallBags"
              type="number"
              min="0"
              max="9"
              defaultValue={booking?.small_bags || 0}
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
    [periods, setPeriods] = useState<Array<{ id: number; unavailable_date: string; full_day: number; start_time: string; end_time: string; reason: string }>>([]),
    [marking, setMarking] = useState(false),
    [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const refreshAvailability = () => fetch('/api/availability').then((r) => r.json()).then((d) => Array.isArray(d) && setPeriods(d));
  useEffect(() => { void refreshAvailability(); }, []);
  const jobs = items
    .filter((b) => b.status !== 'archived' && b.status !== 'complete')
    .sort((a, b) => a.pickup_at.localeCompare(b.pickup_at));
  const unavailable = (d: string) => periods.find((period) => period.unavailable_date === d);
  const removeUnavailable = async (id: number) => { if (!confirm('Remove this unavailable period?')) return; await fetch(`/api/availability?id=${id}`, { method: 'DELETE' }); void refreshAvailability(); };
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
                  {fmtTime(b.pickup_at)}{' '}
                  <em className="operator-badge">{b.operator}</em>
                </small>
                <h3 className="calendar-route">
                  {b.pickup} → {b.dropoff}
                </h3>
                <p>
                  {b.passenger_name} · {b.booking_type || 'CASH'}
                </p>
              </div>
              <div className="calendar-fare">
                <b>£{b.fare.toFixed(2)}</b>
                <span className={`pill ${b.status}`}>
                  {b.status.replace('_', ' ')}
                </span>
              </div>
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
              <button className="primary" onClick={() => setMarking(true)}>
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
                dayJobs = jobs.filter(
                  (j) => j.pickup_at.slice(0, 10) === key,
                );
              return (
                <button
                  key={i}
                  className={unavailable(key) ? 'unavailable' : ''}
                  onClick={() => { const period = unavailable(key); if (period) void removeUnavailable(period.id); else { setDay(key); setMarking(true); } }}
                >
                  <span>{d.getDate()}</span>
                  {dayJobs.length > 0 && (
                    <div className="calendar-day-jobs">
                      {dayJobs.slice(0, 2).map((job) => (
                        <div
                          className="calendar-day-job"
                          key={job.id}
                          title={`${job.pickup} to ${job.dropoff} · ${job.id}`}
                        >
                          <strong>
                            {job.pickup} → {job.dropoff}
                          </strong>
                          <small>
                            {fmtTime(job.pickup_at)} · {job.operator}
                          </small>
                          <small className="calendar-job-ref">
                            {job.id} · {job.status.replace('_', ' ')}
                          </small>
                        </div>
                      ))}
                      {dayJobs.length > 2 && (
                        <small className="calendar-more-jobs">
                          +{dayJobs.length - 2} more job
                          {dayJobs.length - 2 > 1 ? 's' : ''}
                        </small>
                      )}
                    </div>
                  )}
                  {unavailable(key) && <em title={unavailable(key)?.reason}>{unavailable(key)?.full_day ? 'Unavailable' : `${unavailable(key)?.start_time}–${unavailable(key)?.end_time}`}</em>}
                </button>
              );
            })}
          </div>
          {marking && <AvailabilityModal day={day} close={() => setMarking(false)} saved={() => { setMarking(false); void refreshAvailability(); }} />}
        </>
      )}
    </Page>
  );
}
function AvailabilityModal({ day, close, saved }: { day: string; close: () => void; saved: () => void }) {
  const [fullDay, setFullDay] = useState(true);
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); const response = await fetch('/api/availability', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ date: data.date, fullDay, startTime: data.startTime || '', endTime: data.endTime || '', reason: data.reason || '' }) }); if (response.ok) saved(); else alert('Availability could not be saved.'); };
  return <div className="modal"><button className="scrim" onClick={close} /><form className="payment-card" onSubmit={submit}><header><div><small>DISPATCH AVAILABILITY</small><h2>Add unavailable period</h2></div><button type="button" onClick={close}><X /></button></header><label>Date<input name="date" type="date" defaultValue={day} required /></label><label className="check-label"><input type="checkbox" checked={fullDay} onChange={(e) => setFullDay(e.target.checked)} />Full day</label>{!fullDay && <div className="form-grid"><label>Start time<input name="startTime" type="time" required /></label><label>End time<input name="endTime" type="time" required /></label></div>}<label>Reason<input name="reason" placeholder="Holiday, appointment, vehicle maintenance…" required /></label><footer><button type="button" onClick={close}>Cancel</button><button className="primary"><Save />Save unavailable period</button></footer></form></div>;
}
function Messages({ items }: { items: Booking[] }) {
  const defaults = {
    enroute:
      'Good day, {passenger}. Your APX RIDE chauffeur is en route for your transfer to {dropoff}. Driver: {driver}. Vehicle: {vehicle}.',
    arrived: 'Good day, {passenger}. Your chauffeur has arrived at {pickup}.',
    review:
      'Dear {passenger}, thank you for choosing APX RIDE for your journey to {dropoff}.',
  };
  const messageJobs = items.filter(
    (x) =>
      x.status !== 'complete' &&
      x.status !== 'archived' &&
      new Date(x.pickup_at) >= new Date(Date.now() - 86400000),
  );
  const [selected, setSelected] = useState(messageJobs[0]?.id),
    [kind, setKind] = useState<keyof typeof defaults>('enroute'),
    [templates, setTemplates] = useState(defaults),
    [draft, setDraft] = useState(defaults.enroute),
    b = messageJobs.find((x) => x.id === selected) || messageJobs[0];
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
              {messageJobs.map((x) => (
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

type ExpenseRecord = {
  id: number;
  expense_date: string;
  category: string;
  amount: number;
  notes: string;
  driver_call_sign?: string;
};
function EarningsV2({
  items,
  status,
}: {
  items: Booking[];
  status: (
    id: number,
    s: string,
    paymentMethod?: string,
    accountStatus?: string,
  ) => void;
}) {
  const [source, setSource] = useState('ALL');
  const drivers = Array.from(new Map(items.filter((item) => item.driver_call_sign || item.driver_name).map((item) => [item.driver_call_sign || item.driver_name || '', `${item.driver_call_sign || 'Driver'}${item.driver_name ? ` · ${item.driver_name}` : ''}`])).entries());
  const done = items.filter((b) => b.status === 'complete' && (source === 'ALL' || (b.driver_call_sign || b.driver_name) === source)),
    cash = done.filter((b) => (b.booking_type || 'CASH') === 'CASH'),
    accounts = done.filter((b) => b.booking_type === 'ACCOUNT'),
    gross = done.reduce((a, b) => a + b.fare, 0),
    [tab, setTab] = useState<'charts' | 'cash' | 'accounts' | 'expenses'>('charts'),
    [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const refreshExpenses = () =>
    fetch('/api/expenses')
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setExpenses(d));
  useEffect(() => {
    refreshExpenses();
  }, []);
  const shownExpenses = expenses.filter((e) => source === 'ALL' || e.driver_call_sign === source),
    expenseTotal = shownExpenses.reduce((a, e) => a + e.amount, 0),
    cashTotal = cash.reduce((a, b) => a + b.fare, 0),
    receivable = accounts
      .filter((b) => b.account_status !== 'settled')
      .reduce((a, b) => a + b.fare, 0);
  const add = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        date: d.date,
        category: d.category,
        amount: +d.amount,
        notes: d.notes,
        driverCallSign: d.driverCallSign || '',
      }),
    });
    e.currentTarget.reset();
    refreshExpenses();
  };
  const del = async (id: number) => {
    await fetch('/api/expenses?id=' + id, { method: 'DELETE' });
    refreshExpenses();
  };
  const cats = ['Fuel', 'Servicing', 'Tolls', 'Wash', 'Other'];
  return (
    <Page
      title={source === 'ALL' ? 'Company Earnings Overview' : `Driver Earnings — ${drivers.find(([key]) => key === source)?.[1] || source}`}
      sub="Revenue, collections, receivables and operating costs in one ledger."
      action={<div className="earnings-actions"><select value={source} onChange={(e) => setSource(e.target.value)}><option value="ALL">All Drivers (Fleet Overview)</option>{drivers.map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select><button onClick={() => window.print()}><Printer />Generate Driver Statement</button></div>}
    >
      <div className="finance-kpis">
        <FinanceCard
          label="Total gross revenue"
          value={gross}
          detail={`${done.length} jobs`}
        />
        <FinanceCard
          className="green"
          label="Cash collected"
          value={cashTotal}
          detail={`${cash.length} cash jobs`}
        />
        <FinanceCard
          className="blue"
          label="Accounts receivable"
          value={receivable}
          detail={`${accounts.filter((b) => b.account_status !== 'settled').length} pending invoices`}
        />
        <FinanceCard
          className="red"
          label="Total expenses"
          value={expenseTotal}
          detail={`${shownExpenses.length} entries`}
        />
        <FinanceCard
          className="gold"
          label="Net operating revenue"
          value={gross - expenseTotal}
          detail="Revenue minus expenses"
        />
      </div>
      <div className="view-tabs">
        <button className={tab === 'charts' ? 'active' : ''} onClick={() => setTab('charts')}>Charts</button>
        <button
          className={tab === 'cash' ? 'active' : ''}
          onClick={() => setTab('cash')}
        >
          Cash Jobs
        </button>
        <button
          className={tab === 'accounts' ? 'active' : ''}
          onClick={() => setTab('accounts')}
        >
          Account Jobs
        </button>
        <button
          className={tab === 'expenses' ? 'active' : ''}
          onClick={() => setTab('expenses')}
        >
          Expenses
        </button>
      </div>
      {tab === 'charts' && <FinancialCharts rows={done} expenses={shownExpenses} />}
      {tab === 'cash' && <LedgerTable rows={cash} cash />}
      {tab === 'accounts' && (
        <LedgerTable
          rows={accounts}
          settle={(id) => status(id, 'complete', undefined, 'settled')}
        />
      )}{' '}
      {tab === 'expenses' && (
        <>
          <section className="panel expense-tools">
            <form onSubmit={add}>
              <input name="date" type="date" required />
              <select name="category">
                {cats.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <input
                name="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="Amount £"
                required
              />
              <input name="notes" placeholder="Notes" />
              <select name="driverCallSign"><option value="">Company expense</option>{drivers.map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select>
              <button className="primary">
                <Plus />
                Add Expense
              </button>
            </form>
          </section>
          <div className="expense-categories">
            {cats.map((c) => (
              <FinanceCard
                key={c}
                label={c}
                value={shownExpenses
                  .filter((e) => e.category === c)
                  .reduce((a, e) => a + e.amount, 0)}
                detail={`${shownExpenses.filter((e) => e.category === c).length} entries`}
              />
            ))}
          </div>
          <section className="panel table-wrap">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Notes</th>
                  <th>Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shownExpenses.map((e) => (
                  <tr key={e.id}>
                    <td>{fmtDate(e.expense_date)}</td>
                    <td>{e.category}</td>
                    <td>{e.notes || '—'}</td>
                    <td>£{e.amount.toFixed(2)}</td>
                    <td>
                      <button onClick={() => del(e.id)}>
                        <Trash2 />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5}>
                    Total Expenses: £{expenseTotal.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </section>
        </>
      )}
    </Page>
  );
}

function FinancialCharts({ rows, expenses }: { rows: Booking[]; expenses: ExpenseRecord[] }) {
  const monday = new Date(); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const daily = Array.from({ length: 7 }, (_, index) => { const date = new Date(monday); date.setDate(monday.getDate() + index); const key = date.toISOString().slice(0, 10); return rows.filter((row) => row.pickup_at.slice(0, 10) === key).reduce((sum, row) => sum + row.fare, 0); });
  const max = Math.max(...daily, 1), gross = rows.reduce((sum, row) => sum + row.fare, 0), expense = expenses.reduce((sum, row) => sum + row.amount, 0), net = gross - expense;
  const expensePercent = gross > 0 ? Math.min(100, Math.max(0, (expense / gross) * 100)) : 0;
  return <div className="financial-charts"><section className="panel"><Head over="CURRENT WEEK" title="Weekly revenue overview" /><div className="bar-chart">{daily.map((value, index) => <div key={index}><span title={`£${value.toFixed(2)}`} style={{ height: `${Math.max(4, value / max * 100)}%` }} /><b>{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][index]}</b><small>£{value.toFixed(0)}</small></div>)}</div></section><section className="panel"><Head over="REVENUE MIX" title="Financial breakdown" /><div className="donut-layout"><div className="donut" style={{ background: `conic-gradient(#ef4444 0 ${expensePercent}%, #d4af37 ${expensePercent}% 100%)` }}><span><b>£{gross.toFixed(0)}</b><small>Gross</small></span></div><div className="chart-legend"><p><i className="gold-dot" />Net operating revenue <b>£{net.toFixed(2)}</b></p><p><i className="red-dot" />Total expenses <b>£{expense.toFixed(2)}</b></p></div></div></section></div>;
}
function FinanceCard({
  label,
  value,
  detail,
  className = '',
}: {
  label: string;
  value: number;
  detail: string;
  className?: string;
}) {
  return (
    <article className={`finance-card ${className}`}>
      <span>{label}</span>
      <b>£{value.toFixed(2)}</b>
      <small>{detail}</small>
    </article>
  );
}
function LedgerTable({
  rows,
  cash = false,
  settle,
}: {
  rows: Booking[];
  cash?: boolean;
  settle?: (id: number) => void;
}) {
  const total = rows.reduce((a, b) => a + b.fare, 0);
  return (
    <section className="panel table-wrap">
      <table className="finance-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Pickup</th>
            <th>Drop-off</th>
            <th>Operator</th>
            <th>Fleet tier</th>
            {cash ? <th>Payment method</th> : <th>Status</th>}
            <th>Fare</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id}>
              <td>{fmtDate(b.pickup_at)}</td>
              <td>{b.pickup}</td>
              <td>{b.dropoff}</td>
              <td>{b.operator}</td>
              <td>{b.fleet_tier}</td>
              <td>
                {cash ? (
                  b.payment_method || 'CASH'
                ) : (
                  <button
                    className={`account-status ${b.account_status === 'settled' ? 'settled' : ''}`}
                    onClick={() => settle?.(b.id)}
                  >
                    {b.account_status || 'pending'}
                  </button>
                )}
              </td>
              <td>£{b.fare.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={7}>
              {cash ? 'Cash' : 'Account'} Ledger Total: £{total.toFixed(2)}
            </td>
          </tr>
        </tfoot>
      </table>
    </section>
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
    hour12: activeTimeFormat === '12',
  });
function vehicle(p: number, l: number, s: number) {
  if (p <= 4 && l <= 2 && s <= 2) return 'Saloon';
  if (p <= 4 && l <= 3 && s <= 3) return 'Estate';
  if (p <= 5 && l <= 4 && s <= 4) return '6-seater';
  return '7-seater';
}

function isEnglandWalesBankHoliday(date: Date) {
  const year = date.getFullYear();
  const key = (value: Date) => `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`;
  const holidays = new Set<string>();
  const addWithSubstitute = (month: number, day: number) => {
    const actual = new Date(year, month, day);
    holidays.add(key(actual));
    if (actual.getDay() === 6) holidays.add(key(new Date(year, month, day + 2)));
    if (actual.getDay() === 0) holidays.add(key(new Date(year, month, day + 1)));
  };
  const nthMonday = (month: number, occurrence: number) => {
    const first = new Date(year, month, 1);
    return new Date(year, month, 1 + ((8 - first.getDay()) % 7) + (occurrence - 1) * 7);
  };
  const lastMonday = (month: number) => {
    const last = new Date(year, month + 1, 0);
    return new Date(year, month, last.getDate() - ((last.getDay() + 6) % 7));
  };
  addWithSubstitute(0, 1);
  const easter = easterSunday(year);
  holidays.add(key(new Date(year, easter.getMonth(), easter.getDate() - 2)));
  holidays.add(key(new Date(year, easter.getMonth(), easter.getDate() + 1)));
  holidays.add(key(nthMonday(4, 1)));
  holidays.add(key(lastMonday(4)));
  holidays.add(key(lastMonday(7)));
  const christmas = new Date(year, 11, 25);
  const boxing = new Date(year, 11, 26);
  holidays.add(key(christmas));
  holidays.add(key(boxing));
  const used = new Set([key(christmas), key(boxing)]);
  for (const actual of [christmas, boxing]) {
    if (actual.getDay() === 0 || actual.getDay() === 6) {
      const substitute = new Date(actual);
      do substitute.setDate(substitute.getDate() + 1); while (substitute.getDay() === 0 || substitute.getDay() === 6 || used.has(key(substitute)));
      used.add(key(substitute)); holidays.add(key(substitute));
    }
  }
  return holidays.has(key(date));
}

function easterSunday(year: number) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function printCustomerDocument(input: {
  doc: 'quote' | 'confirmation';
  passenger: string;
  date: string;
  pickup: string;
  dropoff: string;
  tier: string;
  airport: number;
  toll: number;
  tariff: Tariff;
  total: number;
}) {
  const safe = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] || character);
  const extra = input.airport + input.toll;
  const title = input.doc === 'quote' ? 'Official Booking Quote' : 'Booking Confirmation';
  const tripDate = input.date ? `${fmtDate(input.date)} at ${fmtTime(input.date)}` : 'Not specified';
  const popup = window.open('', '_blank');
  if (!popup) { alert('Please allow pop-ups to generate the customer PDF.'); return; }
  popup.document.write(`<!doctype html><html><head><title>${safe(title)}</title><style>@page{size:A4;margin:18mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#222;margin:0}header{text-align:center;border-bottom:2px solid #bd9225;padding:14px 0 24px;margin-bottom:34px}header b{font-size:30px;letter-spacing:.16em}header span{display:block;margin-top:7px;font-size:11px;letter-spacing:.38em;color:#666}h1{font-size:18px;text-transform:uppercase;margin:0 0 24px}.row{display:grid;grid-template-columns:190px 1fr;padding:13px 0;border-bottom:1px solid #ddd}.row label{font-weight:bold;color:#555}.route div+div{margin-top:7px}.total{margin-top:32px;border-top:2px solid #bd9225;border-bottom:2px solid #bd9225;padding:20px 0;display:flex;justify-content:space-between;font-size:20px;font-weight:bold}.total strong{font-size:28px}footer{margin-top:36px;color:#666;font-size:11px}@media print{button{display:none}}</style></head><body><header><b>APX RIDE</b><span>ELEVATE EVERY MILE</span></header><h1>${safe(title)}</h1><div class="row"><label>Passenger</label><span>${safe(input.passenger || 'Not specified')}</span></div><div class="row"><label>Trip date &amp; time</label><span>${safe(tripDate)}</span></div><div class="row"><label>Pickup / Drop-off</label><span class="route"><div><b>Pickup:</b> ${safe(input.pickup || 'Not specified')}</div><div><b>Drop-off:</b> ${safe(input.dropoff || 'Not specified')}</div></span></div><div class="row"><label>Fleet tier</label><span>${safe(input.tier)}</span></div>${extra > 0 ? `<div class="row"><label>Airport / Toll fee</label><span>£${extra.toFixed(2)}</span></div>` : ''}<div class="row"><label>Fare model</label><span>${input.tariff === 'day' ? 'Day' : 'Night / Holiday'}</span></div><div class="total"><span>Total Amount</span><strong>£${input.total.toFixed(2)}</strong></div><footer>This client document excludes APX RIDE internal operating calculations.</footer><script>window.addEventListener('load',()=>window.print())<\/script></body></html>`);
  popup.document.close();
}
