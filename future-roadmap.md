# Future Roadmap: Privaro Architecture Unbuilt Features

This document outlines an extensive list of all modules, tables, and features detailed in the original `privaro-final-architecture.md` document that were purposefully scoped out of the initial 10-Phase MVP. 

The following phases outline the comprehensive plan to achieve 100% parity with the final architecture spec.

## Proposed Future Phases

### Phase 11: Audit Logging & Demonstrable Accountability
GDPR strictly requires "demonstrable accountability" (Article 5(2)). We need a system to track who did what, and when.
- **New Tables**: `audit_logs` (Partitioned by range/month for massive scale).
- **Backend Implementation**: 
  - Create a TRPC middleware/interceptor to automatically log all mutation requests (e.g., "User X updated ROPA Y").
  - Store immutable records with `newValue` JSON, IP addresses, and user agents.
- **Frontend Implementation**:
  - Add an "Audit Log" tab in the Settings dashboard with complex filtering (by date, user, or resource).

### Phase 12: Vendor Sub-processors & TIA
Currently, we track top-level Vendors. The architecture calls for tracking their downstream sub-processors.
- **New Tables**: `vendor_sub_processors`.
- **Backend Implementation**: 
  - APIs to link third-party sub-processors to a main Vendor.
  - Transfer Impact Assessment (TIA) data structure expansions.
- **Frontend Implementation**:
  - Vendor detailed view expansion to show a nested tree of sub-processors.

### Phase 13: Client Portals (Agency Feature)
Allowing Agencies to share a read-only compliance dashboard with their clients.
- **Schema Updates**: Add `portal_enabled`, `portal_token`, and `compliance_summary` to the `clients` table.
- **Backend Implementation**:
  - Unauthenticated (but token-secured) TRPC routes for fetching a client's specific compliance snapshot.
- **Frontend Implementation**:
  - Build `apps/web/src/app/(public)/portal/[token]/page.tsx`.
  - Display a branded dashboard showing the client's compliance score, ROPA count, active vendors, and signed DPAs.

### Phase 14: Employee Training Module
A full LMS (Learning Management System) built into Privaro to handle mandatory GDPR staff training.
- **New Tables**: `training_modules` (quizzes, slide content), `training_completions` (progress tracking, certificates).
- **Backend Implementation**:
  - Auto-generate signed PDF Certificates of Completion using the existing Puppeteer infrastructure.
  - BullMQ workers to send "Training Overdue" reminders to employees.
- **Frontend Implementation**:
  - `/training` dashboard for Admins to create quizzes.
  - `/learn` interface for Employees to take the courses and answer quiz questions.

### Phase 15: DSAR Communications & Global Notification Queue
Centralizing notifications and tracking two-way communication for DSARs.
- **New Tables**: `dsar_communications`, `notification_queue`.
- **Backend Implementation**:
  - Setup Inbound/Outbound email parsing for DSARs (e.g., `dsar-1234@privaro.io` routes directly to the specific DSAR ticket).
  - Background worker to process the `notification_queue` and dispatch via Postmark (Email) or Slack based on user preferences.
- **Frontend Implementation**:
  - An email-client-like interface inside the DSAR detailed view to message the data subject directly.

### Phase 16: Regulatory Updates Feed
A system to notify users when GDPR laws or national DPA guidelines change.
- **New Tables**: `regulatory_updates`.
- **Backend Implementation**:
  - Admin-only routes for Privaro team to publish updates.
  - AI script to scrape EDPB guidelines and draft summaries automatically.
- **Frontend Implementation**:
  - A "Compliance News" widget on the main dashboard.
  - Visual indicators warning users if a regulatory update affects one of their specific ROPA activities.

### Phase 17: Public REST API & Webhooks
Allowing enterprise customers to integrate Privaro programmatically into their CI/CD pipelines.
- **New Tables**: `api_keys`, `webhooks`.
- **Backend Implementation**:
  - Add traditional REST endpoints in Fastify (`/api/v1/vendors`, `/api/v1/ropa`).
  - Implement strict API Key authentication and per-tier Rate Limiting.
  - Create an event-emitter system that POSTs JSON payloads to registered customer Webhooks when events occur (e.g., `breach.detected`).

### Phase 18: Advanced CRM Integrations (Inbound)
Automating DSAR data discovery by scanning external systems.
- **Backend Implementation**:
  - Implement NextAuth/OAuth2 connections for HubSpot, Salesforce, and Google Workspace.
  - Create a "Discovery Engine" worker that takes a DSAR email address, queries the APIs of connected CRMs, and returns a unified report of all personal data held.
- **Frontend Implementation**:
  - An "Integrations" marketplace page to connect external tools.
