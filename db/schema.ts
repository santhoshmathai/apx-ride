import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const bookings = sqliteTable('bookings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ownerId: text('owner_id').notNull(),
  passengerName: text('passenger_name').notNull(),
  phone: text('phone').notNull().default(''),
  pickup: text('pickup').notNull(),
  dropoff: text('dropoff').notNull(),
  pickupAt: text('pickup_at').notNull(),
  operator: text('operator').notNull().default('APX RIDE'),
  driverCallSign: text('driver_call_sign').notNull().default(''),
  driverName: text('driver_name').notNull().default(''),
  driverLicence: text('driver_licence').notNull().default(''),
  bookingType: text('booking_type').notNull().default('CASH'),
  paymentMethod: text('payment_method').notNull().default(''),
  accountStatus: text('account_status').notNull().default('pending'),
  passengers: integer('passengers').notNull().default(1),
  largeBags: integer('large_bags').notNull().default(0),
  smallBags: integer('small_bags').notNull().default(0),
  fleetTier: text('fleet_tier').notNull().default('Saloon'),
  distance: real('distance').notNull().default(0),
  fare: real('fare').notNull().default(0),
  status: text('status').notNull().default('upcoming'),
  notes: text('notes').notNull().default(''),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
export const settings = sqliteTable('settings', {
  ownerId: text('owner_id').primaryKey(),
  fareModel: text('fare_model').notNull().default('A'),
  fuelPer100: real('fuel_per_100').notNull().default(50),
  includeFuel: integer('include_fuel', { mode: 'boolean' })
    .notNull()
    .default(true),
  reviewUrl: text('review_url').notNull().default(''),
  operatorsJson: text('operators_json').notNull().default('["APX RIDE"]'),
  ratesJson: text('rates_json').notNull().default('{}'),
  timeFormat: text('time_format').notNull().default('24'),
  updatedAt: text('updated_at').notNull(),
});
export const expenses = sqliteTable('expenses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ownerId: text('owner_id').notNull(),
  expenseDate: text('expense_date').notNull(),
  category: text('category').notNull(),
  driverCallSign: text('driver_call_sign').notNull().default(''),
  amount: real('amount').notNull(),
  notes: text('notes').notNull().default(''),
  createdAt: text('created_at').notNull(),
});

export const complianceRecords = sqliteTable('compliance_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ownerId: text('owner_id').notNull(),
  recordType: text('record_type').notNull(),
  reference: text('reference').notNull(),
  eventDate: text('event_date').notNull(),
  status: text('status').notNull(),
  dataJson: text('data_json').notNull(),
  retentionUntil: text('retention_until').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const auditEvents = sqliteTable('audit_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ownerId: text('owner_id').notNull(),
  actorEmail: text('actor_email').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  summary: text('summary').notNull(),
  createdAt: text('created_at').notNull(),
});

export const recordRevisions = sqliteTable('record_revisions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ownerId: text('owner_id').notNull(),
  recordId: integer('record_id').notNull(),
  revisionNumber: integer('revision_number').notNull(),
  snapshotJson: text('snapshot_json').notNull(),
  actorEmail: text('actor_email').notNull(),
  createdAt: text('created_at').notNull(),
});

export const unavailablePeriods = sqliteTable('unavailable_periods', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ownerId: text('owner_id').notNull(),
  unavailableDate: text('unavailable_date').notNull(),
  fullDay: integer('full_day', { mode: 'boolean' }).notNull().default(true),
  startTime: text('start_time').notNull().default(''),
  endTime: text('end_time').notNull().default(''),
  reason: text('reason').notNull(),
  createdAt: text('created_at').notNull(),
});

export const messageLogs = sqliteTable('message_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ownerId: text('owner_id').notNull(),
  bookingId: integer('booking_id').notNull(),
  channel: text('channel').notNull(),
  recipient: text('recipient').notNull(),
  message: text('message').notNull(),
  status: text('status').notNull(),
  actorEmail: text('actor_email').notNull(),
  createdAt: text('created_at').notNull(),
});

export const complianceDocuments = sqliteTable('compliance_documents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ownerId: text('owner_id').notNull(),
  recordId: integer('record_id').notNull(),
  fieldName: text('field_name').notNull(),
  fileName: text('file_name').notNull(),
  contentType: text('content_type').notNull(),
  objectKey: text('object_key').notNull(),
  uploadedAt: text('uploaded_at').notNull(),
});
