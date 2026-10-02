'use client';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link2, Plus, Trash2, X } from 'lucide-react';
import { ProfileDocuments, type StaffMember } from './staff-access';

type Vehicle = Record<string, string | number | null> & {
  id: string;
  registration: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_colour: string;
  vehicle_category: string;
  active: number;
  approved: number;
  mot_expiry: string;
  insurance_expiry: string;
  private_hire_vehicle_licence_expiry: string;
  active_assignment_count: number;
};
type Assignment = Record<string, string | number> & {
  id: number;
  driver_profile_id: string;
  vehicle_id: string;
  full_name: string;
  email: string;
  registration: string;
  valid_from: string;
  valid_until: string;
  active: number;
  approved: number;
  primary_vehicle: number;
};
const getJson = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  const value = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(value.error || 'Request failed');
  return value;
};

export function FleetOverview({
  mode,
}: {
  mode: 'vehicles' | 'assignments' | 'expiring';
}) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]),
    [assignments, setAssignments] = useState<Assignment[]>([]),
    [staff, setStaff] = useState<StaffMember[]>([]);
  const [editing, setEditing] = useState<Vehicle | null | undefined>(),
    [assigning, setAssigning] = useState(false),
    [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try {
      const [v, a, s] = await Promise.all([
        getJson<Vehicle[]>('/api/vehicles'),
        getJson<Assignment[]>('/api/vehicle-assignments'),
        getJson<StaffMember[]>('/api/staff'),
      ]);
      setVehicles(v);
      setAssignments(a);
      setStaff(s.filter((member) => member.profile_id));
      setError('');
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Could not load fleet',
      );
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const expiring = useMemo(() => {
    const limit = new Date(Date.now() + 30 * 86400000)
      .toISOString()
      .slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    return vehicles.filter((v) =>
      [
        v.mot_expiry,
        v.insurance_expiry,
        v.private_hire_vehicle_licence_expiry,
      ].some((value) => value && value >= today && value <= limit),
    );
  }, [vehicles]);
  if (mode === 'assignments')
    return (
      <section className="panel compliance-register">
        <RegisterHead
          eyebrow="DRIVER–VEHICLE HISTORY"
          title="Driver–vehicle assignments"
          action={
            <button className="primary" onClick={() => setAssigning(true)}>
              <Link2 />
              Assign vehicle
            </button>
          }
        />
        {error && <p className="staff-message error">{error}</p>}
        <div className="staff-list">
          {assignments.map((row) => (
            <div className="staff-row" key={row.id}>
              <div>
                <strong>{row.full_name || row.email}</strong>
                <span>
                  {row.registration} · from {row.valid_from}
                  {row.valid_until ? ` to ${row.valid_until}` : ''}
                </span>
              </div>
              <div className="staff-badges">
                <span className={row.active ? 'active' : 'inactive'}>
                  {row.active ? 'Active' : 'Ended'}
                </span>
                {row.primary_vehicle ? (
                  <span className="verified">Primary</span>
                ) : null}
                <span className={row.approved ? 'verified' : 'pending'}>
                  {row.approved ? 'Approved' : 'Pending approval'}
                </span>
              </div>
              {row.active ? (
                <button
                  onClick={async () => {
                    await fetch('/api/vehicle-assignments', {
                      method: 'PATCH',
                      headers: { 'content-type': 'application/json' },
                      body: JSON.stringify({ id: row.id, active: false }),
                    });
                    await refresh();
                  }}
                >
                  End assignment
                </button>
              ) : null}
            </div>
          ))}
        </div>
        {!assignments.length && (
          <p className="empty-register">
            No Driver–vehicle assignments have been recorded.
          </p>
        )}
        {assigning && (
          <AssignmentModal
            staff={staff}
            vehicles={vehicles}
            close={() => setAssigning(false)}
            saved={async () => {
              setAssigning(false);
              await refresh();
            }}
          />
        )}
      </section>
    );
  const displayed = mode === 'expiring' ? expiring : vehicles;
  return (
    <section className="panel compliance-register">
      <RegisterHead
        eyebrow={
          mode === 'expiring' ? 'NEXT 30 DAYS' : 'COUNCIL VEHICLE REGISTER'
        }
        title={mode === 'expiring' ? 'Expiring vehicle documents' : 'Vehicles'}
        action={
          mode === 'vehicles' ? (
            <button className="primary" onClick={() => setEditing(null)}>
              <Plus />
              Add Vehicle
            </button>
          ) : undefined
        }
      />
      {error && <p className="staff-message error">{error}</p>}
      <div className="staff-list">
        {displayed.map((vehicle) => (
          <div className="staff-row" key={vehicle.id}>
            <div>
              <strong>{vehicle.registration}</strong>
              <span>
                {vehicle.vehicle_make} {vehicle.vehicle_model} ·{' '}
                {vehicle.vehicle_colour} ·{' '}
                {vehicle.vehicle_category || 'Category not recorded'}
              </span>
              <span>
                PHV{' '}
                {vehicle.private_hire_vehicle_licence_expiry ||
                  'expiry missing'}{' '}
                · MOT {vehicle.mot_expiry || 'missing'} · Insurance{' '}
                {vehicle.insurance_expiry || 'missing'}
              </span>
            </div>
            <div className="staff-badges">
              <span className={vehicle.active ? 'active' : 'inactive'}>
                {vehicle.active ? 'Active' : 'Inactive'}
              </span>
              <span className={vehicle.approved ? 'verified' : 'pending'}>
                {vehicle.approved ? 'Approved' : 'Approval pending'}
              </span>
              <span className="pending">
                {vehicle.active_assignment_count || 0} Driver assignment
                {Number(vehicle.active_assignment_count) === 1 ? '' : 's'}
              </span>
            </div>
            <button onClick={() => setEditing(vehicle)}>View / edit</button>
          </div>
        ))}
      </div>
      {!displayed.length && (
        <p className="empty-register">
          {mode === 'expiring'
            ? 'No vehicle documents expire in the next 30 days.'
            : 'No vehicles have been added. Use Add Vehicle to create the first fleet record.'}
        </p>
      )}
      {editing !== undefined && (
        <VehicleModal
          row={editing}
          close={() => setEditing(undefined)}
          saved={async () => {
            setEditing(undefined);
            await refresh();
          }}
        />
      )}
    </section>
  );
}
function RegisterHead({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="register-head">
      <div>
        <small>{eyebrow}</small>
        <h3>{title}</h3>
      </div>
      {action}
    </header>
  );
}
function VehicleModal({
  row,
  close,
  saved,
}: {
  row: Vehicle | null;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [error, setError] = useState('');
  const value = (key: string) => String(row?.[key] ?? '');
  async function remove() {
    if (!row || !confirm(`Delete unused vehicle ${row.registration}?`)) return;
    const response=await fetch(`/api/vehicles?id=${encodeURIComponent(row.id)}`,{method:'DELETE'}); const result=await response.json() as {error?:string};
    if(!response.ok){setError(result.error||'Could not delete vehicle');return;} await saved();
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body = Object.fromEntries(data.entries()) as Record<string, unknown>;
    body.id = row?.id;
    body.active = data.get('active') === 'on';
    body.approved = data.get('approved') === 'on';
    const response = await fetch('/api/vehicles', {
      method: row ? 'PUT' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error || 'Could not save vehicle');
      return;
    }
    await saved();
  }
  return (
    <div className="modal">
      <button
        className="scrim"
        aria-label="Close vehicle form"
        onClick={close}
      />
      <form className="record-modal" onSubmit={submit}>
        <header>
          <div>
            <small>FLEET COMPLIANCE</small>
            <h2>{row ? 'Update' : 'Add'} Vehicle</h2>
          </div>
          <button type="button" aria-label="Close vehicle form" onClick={close}>
            <X />
          </button>
        </header>
        {error && <p className="staff-message error">{error}</p>}
        <div className="record-form-grid">
          {[
            ['registration', 'Registration'],
            ['vehicleMake', 'Vehicle Make'],
            ['vehicleModel', 'Vehicle Model'],
            ['vehicleColour', 'Vehicle Colour'],
            ['vehicleCategory', 'Vehicle Category'],
            ['privateHireVehicleLicenceNumber', 'PHV Licence Number'],
            ['phvBadgeNumber', 'PHV Badge / Plate Number'],
            ['registeredKeeperAddress', 'Registered Keeper Address'],
          ].map(([name, label]) => (
            <label key={name}>
              {label}
              <input
                name={name}
                defaultValue={value(
                  name.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase()),
                )}
                required
              />
            </label>
          ))}
          {[
            ['availableFrom', 'Available from'],
            ['availableUntil', 'Ceased availability'],
            ['insuranceValidFrom', 'Insurance valid from'],
            ['insuranceExpiry', 'Insurance expiry'],
            ['motExpiry', 'MOT expiry'],
            ['inTermMotDate', 'In-term MOT date'],
            ['privateHireVehicleLicenceExpiry', 'PHV licence expiry'],
          ].map(([name, label]) => (
            <label key={name}>
              {label}
              <input
                type="date"
                name={name}
                defaultValue={value(
                  name.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase()),
                )}
                required={!['availableUntil', 'inTermMotDate'].includes(name)}
              />
            </label>
          ))}
          <label>
            V5 document status
            <select
              name="v5DocumentStatus"
              defaultValue={value('v5_document_status') || 'MISSING'}
            >
              <option value="MISSING">Missing / pending</option>
              <option value="VERIFIED">Verified</option>
            </select>
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              name="active"
              defaultChecked={row ? Boolean(row.active) : true}
            />
            Vehicle active
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              name="approved"
              defaultChecked={Boolean(row?.approved)}
            />
            Approved for assignments
          </label>
        </div>
        {row ? (
          <ProfileDocuments
            entityType="VEHICLE"
            entityId={row.id}
            label="Private vehicle compliance documents"
          />
        ) : (
          <p className="private-document-note">
            Save the vehicle first, then reopen it to upload private MOT,
            insurance, PHV licence and V5 evidence.
          </p>
        )}
        <p className="private-document-note">
          Documents remain in private R2 storage and are available only through
          authenticated portal endpoints.
        </p>
      <footer>
        {row && <button type="button" className="danger" onClick={() => void remove()}><Trash2/>Delete vehicle</button>}
        <button type="button" onClick={close}>
            Cancel
          </button>
          <button className="primary">Save vehicle</button>
        </footer>
      </form>
    </div>
  );
}
function AssignmentModal({
  staff,
  vehicles,
  close,
  saved,
}: {
  staff: StaffMember[];
  vehicles: Vehicle[];
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body = Object.fromEntries(data.entries()) as Record<string, unknown>;
    body.active = true;
    body.approved = data.get('approved') === 'on';
    body.primaryVehicle = data.get('primaryVehicle') === 'on';
    const response = await fetch('/api/vehicle-assignments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const value = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(value.error || 'Could not assign vehicle');
      return;
    }
    await saved();
  }
  return (
    <div className="modal">
      <button className="scrim" onClick={close} />
      <form className="record-modal" onSubmit={submit}>
        <header>
          <div>
            <small>FLEET ALLOCATION</small>
            <h2>Assign vehicle to Driver</h2>
          </div>
          <button type="button" onClick={close}>
            <X />
          </button>
        </header>
        {error && <p className="staff-message error">{error}</p>}
        <div className="record-form-grid">
          <label>
            Driver
            <select name="driverProfileId" required>
              <option value="">Select Driver</option>
              {staff.map((row) => (
                <option value={row.profile_id} key={row.id}>
                  {row.full_name || row.email}
                </option>
              ))}
            </select>
          </label>
          <label>
            Vehicle
            <select name="vehicleId" required>
              <option value="">Select Vehicle</option>
              {vehicles
                .filter((v) => v.active)
                .map((v) => (
                  <option value={v.id} key={v.id}>
                    {v.registration} · {v.vehicle_make} {v.vehicle_model}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Valid from
            <input type="date" name="validFrom" required />
          </label>
          <label>
            Valid until
            <input type="date" name="validUntil" />
          </label>
          <label className="check-label">
            <input type="checkbox" name="primaryVehicle" />
            Primary vehicle
          </label>
          <label className="check-label">
            <input type="checkbox" name="approved" />
            Assignment approved
          </label>
        </div>
        <footer>
          <button type="button" onClick={close}>
            Cancel
          </button>
          <button className="primary">Save assignment</button>
        </footer>
      </form>
    </div>
  );
}
