# APX RIDE Council Readiness Notes

## Purpose

This document maps the APX RIDE portal to the current Reigate and Banstead private hire operator requirements. It is an implementation record, not legal advice or a guarantee that a licence will be granted. The operator should confirm the final evidence set with the Council Licensing Officer before applying.

## Authoritative sources checked

- Reigate and Banstead Private Hire Vehicles Drivers and Operators Policy and Conditions 2024: https://www.reigate-banstead.gov.uk/download/downloads/id/544/private_hire_vehicles_drivers_and_operators_policy_and_conditions_2024.pdf
- Reigate and Banstead new private hire operator application guidance: https://www.reigate-banstead.gov.uk/info/20119/taxi_and_private_hire_licensing/236/private_hire_operators/2
- ICO data protection guidance for small organisations: https://ico.org.uk/for-organisations/advice-for-small-organisations/getting-started-with-gdpr/getting-started-with-data-protection/

## Portal controls implemented

| Requirement or risk | Portal control | Evidence to demonstrate |
|---|---|---|
| Booking records | Durable booking register with passenger, contact, pickup, destination, scheduled time, operator, vehicle tier, fare, status and creation timestamp | Create, edit, dispatch and complete a sample booking during the Council test |
| Lost property procedure and 12 month records | Lost Property register records journey reference, item, driver, vehicle, passenger contact, return attempt, storage status and resolution date. The portal displays the minimum retention date and has no delete action | Add a sample item, update its outcome and export the register |
| Complaints procedure and 12 month records | Complaints register records driver name and licence, complainant details, category, incident detail, investigation or action and status. The portal displays the minimum retention date and has no delete action | Add a sample complaint, update it and export the register |
| Driver and vehicle records | Separate registers include licence, badge, DBS, MOT, insurance, council plate, keeper and availability information with expiry indicators | Show active, expiring and expired examples during the test |
| Council disclosures | Council Incident register records category, driver or vehicle, date and time, summary, evidence reference and Council status | Add and export a sample disclosure |
| Fare information | Calculator produces a client-facing quote or booking confirmation while keeping internal calculations out of the passenger document | Generate both document types |
| Financial audit | Completed jobs feed cash and account ledgers. Completed bookings cannot be edited or deleted from Booking Control | Complete a sample job and show the resulting ledger entry |
| Access control | Individual ChatGPT sign-in and server-side approved-email checking protect every data API. Shared four-digit PINs are intentionally not used | Demonstrate approved and unapproved user access plus sign-out |
| Accountability | Creates and edits in the compliance registers add an append-only audit event containing actor, action, record and time | Include the audit trail in the full backup export |
| Backup and portability | Security and Backup settings provide a full JSON export of bookings, expenses, settings, compliance registers and audit events | Download a backup and store it in an encrypted, access-controlled location |

## Business documents and procedures still required

Software alone cannot satisfy all licensing and UK GDPR duties. The operator should prepare and maintain:

1. A written privacy notice covering controller identity, purposes, lawful bases, recipients, retention and individual rights.
2. A data retention schedule for bookings, financial records, staff records, complaints, lost property, backups and unsuccessful quotes. UK GDPR does not give one universal retention period; each period needs a documented reason.
3. A written lost-property procedure covering vehicle checks, secure storage, attempts to identify and contact the owner, handover and disposal.
4. A written complaints procedure with ownership, acknowledgement times, investigation, outcome, escalation and Council contact arrangements.
5. An access-control register naming each authorised portal user and a process for promptly removing leavers or unused accounts.
6. A backup schedule, encrypted storage location, responsible person, restoration test frequency and secure deletion process.
7. A personal-data breach response procedure and incident log, including assessment and ICO notification where legally required.
8. Processor due diligence and appropriate contracts for hosting, messaging, payment, email, document storage and any future mapping service.
9. Evidence of staff safeguarding, disability-awareness and data-protection training.
10. A record of processing activities or equivalent data inventory listing the personal information held and why it is needed.

## Recommended operating routine

- Daily: check upcoming bookings, licence warnings, new complaints and lost property.
- Weekly: export a full backup to encrypted storage and check that only current staff retain access.
- Monthly: test one backup restore in a separate safe environment, review open complaints and property, and verify licence and insurance expiry dates.
- Annually: review the privacy notice, retention schedule, processor contracts, access list, breach procedure and Council policy updates.

## Important limitations

- The backup button creates a portable export; the operator remains responsible for storing it securely and testing restoration.
- Document fields currently accept secure document references or links. Original licence, MOT, insurance and evidence files should be kept in an approved encrypted document store with appropriate access controls.
- The SMS action opens the device messaging application with a prepared message. It does not prove delivery; delivery evidence should be retained if relied upon.
- Council requirements and data-protection guidance can change. Recheck the sources immediately before application and renewal.
