import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const bookings = sqliteTable('bookings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ownerId: text('owner_id').notNull(),
  assignedDriverUserId: text('assigned_driver_user_id'),
  passengerName: text('passenger_name').notNull(),
  customerEmail: text('customer_email').notNull().default(''),
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
  baseFare: real('base_fare').notNull().default(0),
  airportFee: real('airport_fee').notNull().default(0),
  tollFee: real('toll_fee').notNull().default(0),
  tariff: text('tariff').notNull().default('day'),
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
  messageTemplatesJson: text('message_templates_json').notNull().default('{}'),
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

export const organisations = sqliteTable('organisations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  ownerUserId: text('owner_user_id').notNull(),
  ownerEmail: text('owner_email').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const organisationMembers = sqliteTable('organisation_members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  organisationId: text('organisation_id').notNull(),
  userId: text('user_id').notNull(),
  email: text('email').notNull(),
  role: text('role').notNull().default('OWNER'),
  createdAt: text('created_at').notNull(),
}, (table) => [uniqueIndex('idx_organisation_members_org_user').on(table.organisationId, table.userId)]);

export const portalStaff = sqliteTable('portal_staff', {
  id: text('id').primaryKey(),
  organisationId: text('organisation_id').notNull(),
  ownerId: text('owner_id').notNull(),
  email: text('email').notNull(),
  role: text('role').notNull(),
  accessSubject: text('access_subject'),
  lastLoginAt: text('last_login_at'),
  active: integer('active').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [uniqueIndex('idx_portal_staff_email').on(table.email), uniqueIndex('idx_portal_staff_access_subject').on(table.accessSubject)]);

export const publicBookingSettings = sqliteTable('public_booking_settings', {
  organisationId: text('organisation_id').primaryKey(),
  publicKey: text('public_key').notNull(),
  publicBookingsEnabled: integer('public_bookings_enabled', { mode: 'boolean' }).notNull().default(false),
  acknowledgementTemplate: text('acknowledgement_template').notNull().default(''),
  confirmationTemplate: text('confirmation_template').notNull().default(''),
  unavailableTemplate: text('unavailable_template').notNull().default(''),
  cancellationTemplate: text('cancellation_template').notNull().default(''),
  notificationCopyEmail: text('notification_copy_email').notNull().default('apxride.bookings@gmail.com'),
  senderName: text('sender_name').notNull().default('APX RIDE'),
  senderEmail: text('sender_email').notNull().default('bookings@notifications.apxride.com'),
  replyToEmail: text('reply_to_email').notNull().default('apxride.bookings@gmail.com'),
  updatedAt: text('updated_at').notNull(),
});

export const bookingRequests = sqliteTable('booking_requests', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  organisationId: text('organisation_id').notNull(),
  ownerId: text('owner_id').notNull(),
  reference: text('reference').notNull(),
  passengerName: text('passenger_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  pickup: text('pickup').notNull(),
  dropoff: text('dropoff').notNull(),
  pickupAt: text('pickup_at').notNull(),
  passengers: integer('passengers').notNull().default(1),
  largeBags: integer('large_bags').notNull().default(0),
  smallBags: integer('small_bags').notNull().default(0),
  fleetTier: text('fleet_tier').notNull().default('Saloon'),
  quotedFare: real('quoted_fare').notNull().default(0),
  notes: text('notes').notNull().default(''),
  source: text('source').notNull().default('PORTAL'),
  status: text('status').notNull().default('RECEIVED'),
  decisionReason: text('decision_reason').notNull().default(''),
  assignedBookingId: integer('assigned_booking_id'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  decidedAt: text('decided_at').notNull().default(''),
}, (table) => [index('idx_booking_requests_org_created').on(table.organisationId, table.createdAt), uniqueIndex('idx_booking_requests_org_reference').on(table.organisationId, table.reference)]);

export const bookingRequestEvents = sqliteTable('booking_request_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  organisationId: text('organisation_id').notNull(),
  requestId: integer('request_id').notNull(),
  actorEmail: text('actor_email').notNull(),
  eventType: text('event_type').notNull(),
  fromStatus: text('from_status').notNull().default(''),
  toStatus: text('to_status').notNull(),
  note: text('note').notNull().default(''),
  createdAt: text('created_at').notNull(),
}, (table) => [index('idx_booking_request_events_request').on(table.organisationId, table.requestId)]);

export const notificationOutbox = sqliteTable('notification_outbox', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  organisationId: text('organisation_id').notNull(),
  requestId: integer('request_id').notNull(),
  bookingId: integer('booking_id'),
  channel: text('channel').notNull().default('EMAIL'),
  recipient: text('recipient').notNull(),
  templateKey: text('template_key').notNull(),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  status: text('status').notNull().default('PREPARED'),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error').notNull().default(''),
  providerMessageId: text('provider_message_id').notNull().default(''),
  copyTo: text('copy_to').notNull().default(''),
  nextAttemptAt: text('next_attempt_at').notNull().default(''),
  lastAttemptAt: text('last_attempt_at').notNull().default(''),
  createdAt: text('created_at').notNull(),
  sentAt: text('sent_at').notNull().default(''),
}, (table) => [index('idx_notification_outbox_org_status').on(table.organisationId, table.status)]);

export const notificationDeliveries = sqliteTable('notification_deliveries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  organisationId: text('organisation_id').notNull(),
  outboxId: integer('outbox_id').notNull(),
  provider: text('provider').notNull(),
  providerMessageId: text('provider_message_id').notNull().default(''),
  status: text('status').notNull(),
  detail: text('detail').notNull().default(''),
  occurredAt: text('occurred_at').notNull(),
  eventId: text('event_id').notNull().default(''),
}, (table) => [uniqueIndex('idx_notification_deliveries_event').on(table.eventId), index('idx_notification_deliveries_outbox').on(table.organisationId, table.outboxId)]);
