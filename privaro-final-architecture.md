# Privaro — Complete Technical Architecture

---

## 1. Technology Stack

### 1.1 Core Application

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend** | Next.js 14+ (App Router) | SSR for SEO on marketing pages, React Server Components for dashboard performance, built-in i18n routing for 24 EU languages, middleware for auth |
| **UI Library** | Tailwind CSS + Radix UI + Framer Motion | Accessible primitives, fast iteration, consistent design tokens, smooth transitions |
| **State** | Zustand (client) + TanStack Query (server) | Lightweight client state, automatic cache invalidation for server data |
| **Backend API** | Node.js + Fastify | Lower overhead than Express, built-in schema validation via JSON Schema, TypeScript-native |
| **API Layer** | tRPC | End-to-end type safety between Next.js frontend and Fastify backend, eliminates API contract drift |
| **Primary Database** | PostgreSQL 16 (via Supabase or AWS RDS) | JSONB for flexible metadata, row-level security, excellent full-text search, mature ecosystem |
| **ORM** | Drizzle ORM | Type-safe, lightweight, SQL-first (not an abstraction layer), excellent migration tooling |
| **Cache** | Redis (Upstash or ElastiCache) | Session storage, rate limiting, job queue backing, vendor database caching |
| **Search** | Meilisearch | Vendor database search, DSAR data subject search, ROPA activity search — fast, typo-tolerant, self-hostable in EU |
| **File Storage** | S3-compatible (AWS S3 eu-west-1 or Cloudflare R2 EU) | DPA uploads, breach evidence, exported documents, DSAR response packages |
| **Job Queue** | BullMQ (backed by Redis) | Scheduled compliance reminders, retention deadline checks, vendor monitoring, report generation |
| **Email** | Postmark (transactional) + Resend (marketing) | Deadline alerts, DSAR reminders, breach countdown notifications, onboarding sequences |
| **PDF Generation** | Puppeteer (headless Chrome) | Audit files, DPIA reports, DSAR response packages, compliance certificates |
| **Document Generation** | Docxtemplater | Word/DOCX exports for privacy policies, DPA templates, breach notification letters |
| **Auth** | NextAuth.js v5 + custom RBAC | Google/Microsoft SSO, email/password, magic links, role-based access (owner, admin, member, client-viewer) |
| **Payments** | Stripe | Subscription management, usage-based billing for cookie consent pageviews, EU entity billing |
| **Analytics** | PostHog (self-hosted EU) or Plausible | Privacy-respecting, GDPR-compliant analytics for your own product (practice what you preach) |
| **Error Tracking** | Sentry (EU data region) | Error monitoring, performance tracking |
| **CI/CD** | GitHub Actions | Automated testing, database migrations, deployment |
| **Monitoring** | Grafana + Prometheus | Infrastructure monitoring, API latency, job queue health |

### 1.2 AI Layer

| Component | Technology | Use Case |
|---|---|---|
| **LLM** | Claude API (claude-sonnet-4-20250514) | Natural language compliance Q&A, DPA clause analysis, policy review suggestions |
| **Embeddings** | Voyage AI or OpenAI text-embedding-3-small | Semantic search across GDPR articles, EDPB guidelines, supervisory authority decisions |
| **Vector Store** | pgvector (PostgreSQL extension) | Store embeddings alongside relational data, no separate vector DB needed |
| **RAG Pipeline** | LangChain.js or custom | Ground AI responses in official GDPR text, EDPB opinions, national DPA guidance |

### 1.3 Infrastructure

| Component | Technology | Rationale |
|---|---|---|
| **Hosting** | AWS eu-west-1 (Dublin) | Irish company, Irish data center, EU data residency guaranteed |
| **Container Orchestration** | AWS ECS Fargate or Railway | No server management, auto-scaling, pay-per-use |
| **CDN** | Cloudflare (EU-only routing) | Edge caching for marketing site, DDoS protection, cookie consent script delivery |
| **DNS** | Cloudflare | Fast propagation, easy management |
| **Secrets** | AWS Secrets Manager | API keys, database credentials, encryption keys |
| **Backups** | Automated daily to S3 with 90-day retention | Point-in-time recovery, cross-region replication to eu-central-1 (Frankfurt) |

### 1.4 Cookie Consent Infrastructure

| Component | Technology | Rationale |
|---|---|---|
| **Consent Script** | Vanilla JS bundle (~15KB gzipped) | Lightweight, no framework dependency, loads before any other scripts |
| **Script Delivery** | Cloudflare Workers (EU) | Edge-deployed, sub-50ms latency across EU |
| **Cookie Scanner** | Puppeteer-based crawler | Headless browser visits the site, captures all cookies/trackers, categorizes them |
| **Consent Storage** | Dedicated PostgreSQL table + S3 archival | Real-time lookups in PG, long-term proof archived to S3 |

---

## 2. Database Schema

### 2.1 Schema Diagram Overview

```
organizations
  ├── users (members of the org)
  ├── clients (agency's clients)
  ├── processing_activities (ROPA)
  │     ├── processing_data_categories
  │     ├── processing_recipients
  │     └── processing_transfers
  ├── vendors
  │     ├── vendor_dpas
  │     └── vendor_sub_processors
  ├── privacy_policies
  │     └── policy_versions
  ├── dsar_requests
  │     ├── dsar_tasks
  │     └── dsar_communications
  ├── breaches
  │     ├── breach_notifications
  │     └── breach_remediation_tasks
  ├── dpias
  │     ├── dpia_risks
  │     └── dpia_measures
  ├── consent_domains
  │     ├── consent_cookies
  │     └── consent_records
  ├── training_modules
  │     └── training_completions
  ├── documents (file storage references)
  └── audit_logs
```

### 2.2 Core Tables

#### organizations

The top-level entity. Everything belongs to an organization.

```sql
CREATE TABLE organizations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(100) UNIQUE NOT NULL,
    legal_name      VARCHAR(255),
    registration_number VARCHAR(100),
    
    -- Location & jurisdiction
    country_code    CHAR(2) NOT NULL,          -- ISO 3166-1 (IE, DE, FR, etc.)
    address         JSONB,                      -- {street, city, postal_code, country}
    eu_representative JSONB,                    -- Article 27 rep if needed
    
    -- DPO information
    has_dpo         BOOLEAN DEFAULT FALSE,
    dpo_name        VARCHAR(255),
    dpo_email       VARCHAR(255),
    dpo_is_external BOOLEAN DEFAULT FALSE,
    
    -- Supervisory authority
    lead_supervisory_authority VARCHAR(100),    -- e.g., 'IE_DPC', 'DE_BfDI', 'FR_CNIL'
    
    -- Compliance status
    compliance_score INTEGER DEFAULT 0,         -- 0-100, recalculated periodically
    last_assessment_at TIMESTAMPTZ,
    next_review_due_at TIMESTAMPTZ,
    
    -- Subscription
    stripe_customer_id VARCHAR(255),
    subscription_tier VARCHAR(50) DEFAULT 'starter', -- starter, professional, agency, enterprise
    subscription_status VARCHAR(50) DEFAULT 'trialing',
    
    -- Settings
    settings        JSONB DEFAULT '{}',         -- timezone, language, notification prefs
    branding        JSONB DEFAULT '{}',         -- logo_url, primary_color, for client dashboards
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ                 -- soft delete
);

CREATE INDEX idx_org_slug ON organizations(slug);
CREATE INDEX idx_org_country ON organizations(country_code);
```

#### users

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    
    email           VARCHAR(255) UNIQUE NOT NULL,
    name            VARCHAR(255) NOT NULL,
    avatar_url      VARCHAR(500),
    
    -- Auth
    password_hash   VARCHAR(255),               -- null if using SSO only
    auth_provider   VARCHAR(50),                -- 'email', 'google', 'microsoft'
    auth_provider_id VARCHAR(255),
    mfa_enabled     BOOLEAN DEFAULT FALSE,
    mfa_secret      VARCHAR(255),
    
    -- Role & permissions
    role            VARCHAR(50) NOT NULL DEFAULT 'member',  -- owner, admin, member, viewer
    permissions     JSONB DEFAULT '[]',         -- granular overrides: ['dsar:manage', 'breach:report']
    
    -- Training & compliance
    last_training_completed_at TIMESTAMPTZ,
    policy_acknowledged_at TIMESTAMPTZ,
    
    -- Activity
    last_login_at   TIMESTAMPTZ,
    invited_at      TIMESTAMPTZ,
    invited_by      UUID REFERENCES users(id),
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_user_org ON users(organization_id);
CREATE INDEX idx_user_email ON users(email);
```

#### clients

The agency's clients — each gets their own compliance context.

```sql
CREATE TABLE clients (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    
    name            VARCHAR(255) NOT NULL,
    legal_name      VARCHAR(255),
    contact_name    VARCHAR(255),
    contact_email   VARCHAR(255),
    country_code    CHAR(2),
    industry        VARCHAR(100),
    
    -- DPA with this client
    dpa_status      VARCHAR(50) DEFAULT 'not_started', -- not_started, draft, sent, signed, expired
    dpa_signed_at   TIMESTAMPTZ,
    dpa_expires_at  TIMESTAMPTZ,
    dpa_document_id UUID REFERENCES documents(id),
    
    -- Client portal access
    portal_enabled  BOOLEAN DEFAULT FALSE,
    portal_token    VARCHAR(255) UNIQUE,        -- for read-only dashboard access
    
    -- Compliance summary (denormalized for dashboard)
    compliance_summary JSONB DEFAULT '{}',      -- {processing_activities: 5, vendors: 12, dpa_signed: true}
    
    notes           TEXT,
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_client_org ON clients(organization_id);
CREATE INDEX idx_client_portal ON clients(portal_token);
```

### 2.3 ROPA (Records of Processing Activities) Tables

#### processing_activities

The heart of GDPR compliance — Article 30.

```sql
CREATE TABLE processing_activities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    client_id       UUID REFERENCES clients(id),  -- null if org's own processing
    
    -- Core Article 30 fields
    name            VARCHAR(255) NOT NULL,         -- "Email marketing for Client X"
    description     TEXT,
    purpose         TEXT NOT NULL,                  -- why this processing exists
    
    -- Lawful basis (Article 6)
    lawful_basis    VARCHAR(50) NOT NULL,           -- consent, contract, legal_obligation, vital_interests, public_task, legitimate_interests
    lawful_basis_detail TEXT,                       -- specific explanation
    
    -- If lawful basis is legitimate interests, link to LIA
    lia_id          UUID REFERENCES legitimate_interest_assessments(id),
    
    -- Data subjects
    data_subject_categories JSONB NOT NULL DEFAULT '[]',  -- ['customers', 'employees', 'website_visitors', 'minors']
    estimated_data_subjects VARCHAR(50),                    -- '<1000', '1000-10000', '10000-100000', '>100000'
    
    -- Processing details
    processing_type JSONB DEFAULT '[]',            -- ['collection', 'storage', 'analysis', 'sharing', 'profiling', 'automated_decision_making']
    is_systematic_monitoring BOOLEAN DEFAULT FALSE,
    involves_special_categories BOOLEAN DEFAULT FALSE,  -- Article 9 data (health, religion, biometrics, etc.)
    special_categories JSONB DEFAULT '[]',              -- ['health', 'biometric', 'political', 'religious', 'sexual_orientation', 'trade_union', 'genetic', 'racial_ethnic']
    involves_children BOOLEAN DEFAULT FALSE,
    
    -- Retention
    retention_period VARCHAR(100),                  -- "24 months", "duration of contract + 6 months"
    retention_justification TEXT,
    retention_review_date TIMESTAMPTZ,
    deletion_procedure TEXT,                        -- how data is actually deleted
    
    -- Security measures
    security_measures JSONB DEFAULT '[]',           -- ['encryption_at_rest', 'encryption_in_transit', 'access_controls', 'pseudonymization', 'backups', 'audit_logging']
    security_measures_detail TEXT,
    
    -- Status & review
    status          VARCHAR(50) DEFAULT 'draft',    -- draft, active, under_review, archived
    risk_level      VARCHAR(20) DEFAULT 'low',      -- low, medium, high, critical
    requires_dpia   BOOLEAN DEFAULT FALSE,
    dpia_id         UUID REFERENCES dpias(id),
    
    last_reviewed_at TIMESTAMPTZ,
    next_review_at  TIMESTAMPTZ,
    reviewed_by     UUID REFERENCES users(id),
    
    -- Version tracking
    version         INTEGER DEFAULT 1,
    previous_version_id UUID REFERENCES processing_activities(id),
    
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_pa_org ON processing_activities(organization_id);
CREATE INDEX idx_pa_client ON processing_activities(client_id);
CREATE INDEX idx_pa_status ON processing_activities(status);
CREATE INDEX idx_pa_lawful_basis ON processing_activities(lawful_basis);
CREATE INDEX idx_pa_risk ON processing_activities(risk_level);
```

#### processing_data_categories

What types of personal data are involved in each processing activity.

```sql
CREATE TABLE processing_data_categories (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    processing_activity_id  UUID NOT NULL REFERENCES processing_activities(id) ON DELETE CASCADE,
    
    category        VARCHAR(100) NOT NULL,     -- 'name', 'email', 'ip_address', 'location', 'financial', 'health', 'biometric', etc.
    category_group  VARCHAR(50),               -- 'identity', 'contact', 'technical', 'financial', 'sensitive', 'behavioral'
    description     TEXT,                       -- specifics: "email addresses collected via signup form"
    source          VARCHAR(100),              -- 'direct_from_subject', 'third_party', 'public_source', 'automated_collection'
    source_detail   TEXT,                       -- "collected via HubSpot form on website"
    is_special_category BOOLEAN DEFAULT FALSE,  -- Article 9 special categories
    
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pdc_activity ON processing_data_categories(processing_activity_id);
```

#### processing_recipients

Who receives the data (Article 30(1)(d)).

```sql
CREATE TABLE processing_recipients (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    processing_activity_id  UUID NOT NULL REFERENCES processing_activities(id) ON DELETE CASCADE,
    
    recipient_type  VARCHAR(50) NOT NULL,       -- 'internal_team', 'vendor', 'client', 'supervisory_authority', 'other_third_party'
    vendor_id       UUID REFERENCES vendors(id), -- link to vendor if applicable
    name            VARCHAR(255) NOT NULL,
    purpose         TEXT,                        -- why they receive this data
    
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pr_activity ON processing_recipients(processing_activity_id);
```

#### processing_transfers

International data transfers (Article 44-49).

```sql
CREATE TABLE processing_transfers (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    processing_activity_id  UUID NOT NULL REFERENCES processing_activities(id) ON DELETE CASCADE,
    
    destination_country CHAR(2) NOT NULL,       -- ISO country code
    destination_entity VARCHAR(255),             -- company name receiving the data
    vendor_id       UUID REFERENCES vendors(id),
    
    -- Transfer mechanism
    transfer_mechanism VARCHAR(100) NOT NULL,    -- 'adequacy_decision', 'standard_contractual_clauses', 'binding_corporate_rules', 'explicit_consent', 'derogation', 'none'
    mechanism_detail TEXT,
    
    -- Transfer Impact Assessment
    tia_completed   BOOLEAN DEFAULT FALSE,
    tia_date        TIMESTAMPTZ,
    tia_document_id UUID REFERENCES documents(id),
    tia_risk_level  VARCHAR(20),                -- low, medium, high
    
    -- Supplementary measures
    supplementary_measures JSONB DEFAULT '[]',   -- ['encryption', 'pseudonymization', 'access_restrictions', 'contractual_restrictions']
    supplementary_detail TEXT,
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pt_activity ON processing_transfers(processing_activity_id);
CREATE INDEX idx_pt_country ON processing_transfers(destination_country);
```

#### legitimate_interest_assessments

Article 6(1)(f) — three-part balancing test.

```sql
CREATE TABLE legitimate_interest_assessments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    
    name            VARCHAR(255) NOT NULL,
    
    -- Part 1: Purpose test
    purpose_description TEXT NOT NULL,           -- what is the legitimate interest?
    purpose_is_lawful BOOLEAN,
    purpose_evidence TEXT,
    
    -- Part 2: Necessity test
    necessity_description TEXT NOT NULL,          -- is processing necessary for this purpose?
    less_intrusive_alternatives TEXT,             -- have you considered alternatives?
    necessity_conclusion TEXT,
    
    -- Part 3: Balancing test
    impact_on_individuals TEXT NOT NULL,          -- what impact does processing have?
    individual_expectations TEXT,                 -- would they reasonably expect this?
    mitigating_measures TEXT,                     -- what safeguards are in place?
    balancing_conclusion TEXT NOT NULL,           -- does the interest override the impact?
    
    -- Outcome
    outcome         VARCHAR(50) NOT NULL,         -- 'approved', 'rejected', 'needs_review'
    assessed_by     UUID REFERENCES users(id),
    assessed_at     TIMESTAMPTZ,
    next_review_at  TIMESTAMPTZ,
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lia_org ON legitimate_interest_assessments(organization_id);
```

### 2.4 Vendor & Processor Management Tables

#### vendors

The master vendor intelligence database.

```sql
CREATE TABLE vendors (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Two types: global (shared database) and org-specific (custom vendor)
    is_global       BOOLEAN DEFAULT FALSE,      -- true = part of shared vendor DB, false = org-specific
    organization_id UUID REFERENCES organizations(id),  -- null for global vendors
    
    -- Basic info
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(100),
    website         VARCHAR(500),
    logo_url        VARCHAR(500),
    description     TEXT,
    category        VARCHAR(100),               -- 'crm', 'email_marketing', 'analytics', 'cloud_hosting', 'payment', 'advertising', etc.
    
    -- GDPR specifics
    headquarters_country CHAR(2),
    data_processing_locations JSONB DEFAULT '[]',   -- ['US', 'IE', 'DE']
    dpa_url         VARCHAR(500),                    -- link to their public DPA
    dpa_available   BOOLEAN DEFAULT FALSE,
    privacy_policy_url VARCHAR(500),
    
    -- Transfer mechanisms they support
    transfer_mechanisms JSONB DEFAULT '[]',           -- ['adequacy_decision', 'sccs', 'bcrs']
    eu_hosting_available BOOLEAN DEFAULT FALSE,
    eu_hosting_detail TEXT,
    
    -- Security posture
    security_certifications JSONB DEFAULT '[]',       -- ['soc2_type2', 'iso27001', 'iso27701', 'csa_star']
    encryption_at_rest BOOLEAN,
    encryption_in_transit BOOLEAN,
    
    -- Sub-processors
    sub_processor_list_url VARCHAR(500),
    sub_processor_notification VARCHAR(100),           -- 'email', 'website', 'none'
    
    -- Data processed
    typical_data_categories JSONB DEFAULT '[]',        -- ['name', 'email', 'ip_address', 'behavioral']
    
    -- Risk assessment (for global vendors, maintained by Privaro team)
    risk_score      INTEGER,                           -- 1-100
    risk_level      VARCHAR(20),                       -- low, medium, high, critical
    risk_factors    JSONB DEFAULT '[]',                 -- ['us_based', 'no_eu_hosting', 'fisa_702_subject', 'recent_breach']
    
    -- Regulatory history
    known_incidents JSONB DEFAULT '[]',                 -- [{date, description, severity, source_url}]
    regulatory_actions JSONB DEFAULT '[]',              -- [{date, authority, action, fine_amount, source_url}]
    
    -- Metadata
    last_verified_at TIMESTAMPTZ,                       -- when Privaro team last verified this info
    verified_by     VARCHAR(100),
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vendor_global ON vendors(is_global) WHERE is_global = TRUE;
CREATE INDEX idx_vendor_org ON vendors(organization_id);
CREATE INDEX idx_vendor_slug ON vendors(slug);
CREATE INDEX idx_vendor_category ON vendors(category);
CREATE INDEX idx_vendor_risk ON vendors(risk_level);
```

#### organization_vendors

Junction table — which vendors each org actually uses.

```sql
CREATE TABLE organization_vendors (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    vendor_id       UUID NOT NULL REFERENCES vendors(id),
    
    -- Org-specific status
    status          VARCHAR(50) DEFAULT 'active',       -- active, under_review, deprecated, removed
    added_by        UUID REFERENCES users(id),
    
    -- DPA management
    dpa_status      VARCHAR(50) DEFAULT 'not_started',  -- not_started, in_review, signed, expired, not_needed
    dpa_signed_at   TIMESTAMPTZ,
    dpa_expires_at  TIMESTAMPTZ,
    dpa_document_id UUID REFERENCES documents(id),      -- uploaded signed DPA
    dpa_notes       TEXT,
    
    -- TIA if vendor transfers outside EU
    tia_required    BOOLEAN DEFAULT FALSE,
    tia_completed   BOOLEAN DEFAULT FALSE,
    tia_document_id UUID REFERENCES documents(id),
    
    -- Usage context
    data_categories_shared JSONB DEFAULT '[]',           -- what data this org shares with this vendor
    processing_activities JSONB DEFAULT '[]',            -- linked processing activity IDs
    purpose         TEXT,                                 -- why this org uses this vendor
    
    -- Review
    last_reviewed_at TIMESTAMPTZ,
    next_review_at  TIMESTAMPTZ,
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(organization_id, vendor_id)
);

CREATE INDEX idx_ov_org ON organization_vendors(organization_id);
CREATE INDEX idx_ov_dpa_status ON organization_vendors(dpa_status);
```

#### vendor_sub_processors

```sql
CREATE TABLE vendor_sub_processors (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id       UUID NOT NULL REFERENCES vendors(id),
    
    name            VARCHAR(255) NOT NULL,
    service         VARCHAR(255),               -- "Cloud hosting", "Payment processing"
    country         CHAR(2),
    website         VARCHAR(500),
    
    added_at        TIMESTAMPTZ DEFAULT NOW(),   -- when this sub-processor was added
    removed_at      TIMESTAMPTZ,                 -- when removed (null if current)
    
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vsp_vendor ON vendor_sub_processors(vendor_id);
```

### 2.5 Privacy Policy & Consent Tables

#### privacy_policies

```sql
CREATE TABLE privacy_policies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    
    type            VARCHAR(50) NOT NULL,        -- 'website_visitors', 'employees', 'clients', 'job_applicants', 'cookie_policy'
    name            VARCHAR(255) NOT NULL,
    language        CHAR(2) DEFAULT 'en',
    
    -- Current published version
    current_version_id UUID REFERENCES policy_versions(id),
    published_at    TIMESTAMPTZ,
    
    -- Settings
    auto_update     BOOLEAN DEFAULT FALSE,       -- regenerate when ROPA/vendors change
    embed_url       VARCHAR(500),                -- hosted URL for embedding
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_pp_org ON privacy_policies(organization_id);
```

#### policy_versions

Full version history of every policy.

```sql
CREATE TABLE policy_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id       UUID NOT NULL REFERENCES privacy_policies(id),
    
    version_number  INTEGER NOT NULL,
    content_html    TEXT NOT NULL,               -- rendered HTML
    content_markdown TEXT NOT NULL,              -- source markdown
    content_json    JSONB,                       -- structured sections for programmatic access
    
    -- What changed
    change_summary  TEXT,                        -- "Added Mailchimp as data processor, updated retention periods"
    change_type     VARCHAR(50),                 -- 'minor', 'major', 'legal_update', 'auto_generated'
    
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    
    -- Diff from previous
    diff_from_previous JSONB                     -- structured diff for UI display
);

CREATE INDEX idx_pv_policy ON policy_versions(policy_id);
```

#### consent_domains

Cookie consent management per website.

```sql
CREATE TABLE consent_domains (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    client_id       UUID REFERENCES clients(id),  -- null if agency's own domain
    
    domain          VARCHAR(255) NOT NULL,
    
    -- Configuration
    banner_config   JSONB DEFAULT '{}',          -- position, colors, text, behavior
    categories      JSONB DEFAULT '["necessary", "analytics", "marketing", "functional"]',
    gcm_v2_enabled  BOOLEAN DEFAULT FALSE,       -- Google Consent Mode v2
    tcf_enabled     BOOLEAN DEFAULT FALSE,       -- IAB TCF v2.2
    
    -- Scanner
    last_scan_at    TIMESTAMPTZ,
    scan_frequency  VARCHAR(20) DEFAULT 'weekly', -- daily, weekly, monthly
    
    -- Script
    script_id       VARCHAR(100) UNIQUE NOT NULL, -- embedded in the JS snippet
    
    -- Stats (denormalized for dashboard)
    total_pageviews_30d BIGINT DEFAULT 0,
    consent_rate_30d DECIMAL(5,2),                -- % who accept all
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cd_org ON consent_domains(organization_id);
CREATE INDEX idx_cd_domain ON consent_domains(domain);
CREATE INDEX idx_cd_script ON consent_domains(script_id);
```

#### consent_cookies

Discovered cookies/trackers per domain.

```sql
CREATE TABLE consent_cookies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id       UUID NOT NULL REFERENCES consent_domains(id) ON DELETE CASCADE,
    
    cookie_name     VARCHAR(255) NOT NULL,
    cookie_domain   VARCHAR(255),
    cookie_path     VARCHAR(255) DEFAULT '/',
    category        VARCHAR(50) NOT NULL,        -- necessary, analytics, marketing, functional
    provider        VARCHAR(255),                -- "Google", "Meta", "HubSpot"
    purpose         TEXT,                        -- human-readable explanation
    expiry          VARCHAR(100),                -- "Session", "1 year", "2 years"
    is_third_party  BOOLEAN DEFAULT FALSE,
    
    -- Auto-classification confidence
    auto_classified BOOLEAN DEFAULT FALSE,
    classification_confidence DECIMAL(3,2),       -- 0.00 - 1.00
    manually_verified BOOLEAN DEFAULT FALSE,
    
    discovered_at   TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cc_domain ON consent_cookies(domain_id);
```

#### consent_records

Proof of consent — the legal receipt.

```sql
CREATE TABLE consent_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id       UUID NOT NULL REFERENCES consent_domains(id),
    
    -- Visitor identification (anonymous)
    consent_id      VARCHAR(255) NOT NULL,       -- unique per visitor session (stored in cookie)
    
    -- What they consented to
    categories_accepted JSONB NOT NULL,           -- ['necessary', 'analytics']
    categories_rejected JSONB DEFAULT '[]',
    
    -- Context
    ip_hash         VARCHAR(64),                  -- hashed IP, not raw (privacy by design)
    user_agent_hash VARCHAR(64),
    country_code    CHAR(2),                      -- derived from IP for jurisdiction
    
    -- Policy version shown
    policy_version_id UUID REFERENCES policy_versions(id),
    banner_version  VARCHAR(50),                  -- version of the consent banner shown
    
    -- Interaction
    interaction_type VARCHAR(50),                  -- 'accept_all', 'reject_all', 'custom', 'dismiss'
    
    -- TCF specific (if enabled)
    tcf_string      TEXT,                          -- IAB TC string
    
    -- GCM specific (if enabled)
    gcm_consent_state JSONB,                       -- {analytics_storage, ad_storage, ad_user_data, ad_personalization}
    
    given_at        TIMESTAMPTZ DEFAULT NOW(),
    withdrawn_at    TIMESTAMPTZ,                   -- null until consent is withdrawn
    
    -- Partitioned by month for query performance
    created_at      TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Create monthly partitions (automate via pg_partman or cron job)
CREATE TABLE consent_records_2026_04 PARTITION OF consent_records
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE INDEX idx_cr_domain ON consent_records(domain_id);
CREATE INDEX idx_cr_consent_id ON consent_records(consent_id);
CREATE INDEX idx_cr_date ON consent_records(created_at);
```

### 2.6 DSAR Tables

#### dsar_requests

```sql
CREATE TABLE dsar_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    
    -- Request details
    reference_number VARCHAR(50) UNIQUE NOT NULL,  -- DSAR-2026-0001
    request_type    VARCHAR(50) NOT NULL,           -- access, rectification, erasure, restriction, portability, objection, automated_decision_optout
    
    -- Data subject info
    subject_name    VARCHAR(255),
    subject_email   VARCHAR(255),
    subject_identifier JSONB,                       -- additional identifiers: {phone, account_id, etc.}
    subject_verified BOOLEAN DEFAULT FALSE,
    verification_method VARCHAR(100),               -- 'email_confirmation', 'id_document', 'account_login'
    verification_date TIMESTAMPTZ,
    
    -- Source
    source          VARCHAR(50),                    -- 'intake_portal', 'email', 'manual', 'verbal'
    original_message TEXT,                           -- the actual request text
    
    -- Deadlines
    received_at     TIMESTAMPTZ NOT NULL,
    deadline_at     TIMESTAMPTZ NOT NULL,           -- 30 days from receipt
    extended        BOOLEAN DEFAULT FALSE,
    extension_reason TEXT,
    extended_deadline_at TIMESTAMPTZ,               -- up to 60 additional days
    
    -- Status
    status          VARCHAR(50) DEFAULT 'new',      -- new, identity_verification, in_progress, pending_review, completed, refused, overdue
    
    -- If refused
    refusal_reason  VARCHAR(100),                   -- 'manifestly_unfounded', 'manifestly_excessive', 'identity_not_verified'
    refusal_detail  TEXT,
    
    -- Completion
    completed_at    TIMESTAMPTZ,
    completed_by    UUID REFERENCES users(id),
    response_method VARCHAR(50),                    -- 'encrypted_email', 'secure_link', 'postal'
    response_document_id UUID REFERENCES documents(id),
    
    -- Data package (for access/portability requests)
    data_package_url VARCHAR(500),                   -- secure download link
    data_package_format VARCHAR(20),                 -- 'json', 'csv', 'pdf'
    data_package_expires_at TIMESTAMPTZ,
    
    assigned_to     UUID REFERENCES users(id),
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dsar_org ON dsar_requests(organization_id);
CREATE INDEX idx_dsar_status ON dsar_requests(status);
CREATE INDEX idx_dsar_deadline ON dsar_requests(deadline_at);
CREATE INDEX idx_dsar_subject ON dsar_requests(subject_email);
```

#### dsar_tasks

System-by-system search tasks for each DSAR.

```sql
CREATE TABLE dsar_tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dsar_id         UUID NOT NULL REFERENCES dsar_requests(id) ON DELETE CASCADE,
    
    -- What to search
    system_name     VARCHAR(255) NOT NULL,       -- "HubSpot CRM", "Google Workspace", "Mailchimp"
    vendor_id       UUID REFERENCES vendors(id),
    search_instructions TEXT,                     -- "Search contacts by email address"
    
    -- Results
    status          VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, not_applicable
    data_found      BOOLEAN,
    data_description TEXT,                         -- what was found
    action_taken    VARCHAR(100),                  -- 'exported', 'deleted', 'rectified', 'restricted', 'no_data_found'
    action_detail   TEXT,
    evidence_document_id UUID REFERENCES documents(id), -- screenshot or export as proof
    
    completed_by    UUID REFERENCES users(id),
    completed_at    TIMESTAMPTZ,
    
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dsar_task_dsar ON dsar_tasks(dsar_id);
CREATE INDEX idx_dsar_task_status ON dsar_tasks(status);
```

#### dsar_communications

All communications with the data subject about this request.

```sql
CREATE TABLE dsar_communications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dsar_id         UUID NOT NULL REFERENCES dsar_requests(id) ON DELETE CASCADE,
    
    direction       VARCHAR(10) NOT NULL,        -- 'inbound', 'outbound'
    type            VARCHAR(50) NOT NULL,        -- 'acknowledgment', 'verification_request', 'extension_notice', 'response', 'refusal', 'follow_up'
    channel         VARCHAR(50),                 -- 'email', 'portal', 'postal'
    
    subject         VARCHAR(255),
    body            TEXT,
    
    sent_by         UUID REFERENCES users(id),
    sent_at         TIMESTAMPTZ DEFAULT NOW(),
    
    -- Email tracking
    email_message_id VARCHAR(255),
    delivered_at    TIMESTAMPTZ,
    opened_at       TIMESTAMPTZ
);

CREATE INDEX idx_dsar_comm_dsar ON dsar_communications(dsar_id);
```

### 2.7 Breach Management Tables

#### breaches

```sql
CREATE TABLE breaches (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    
    reference_number VARCHAR(50) UNIQUE NOT NULL,  -- BRE-2026-0001
    title           VARCHAR(255) NOT NULL,
    
    -- Discovery
    discovered_at   TIMESTAMPTZ NOT NULL,
    discovered_by   UUID REFERENCES users(id),
    discovery_method VARCHAR(100),                  -- 'internal_monitoring', 'employee_report', 'vendor_notification', 'external_report', 'dpa_notification'
    
    -- 72-hour deadline
    notification_deadline TIMESTAMPTZ NOT NULL,     -- discovered_at + 72 hours
    
    -- Classification
    breach_type     VARCHAR(100) NOT NULL,          -- 'confidentiality', 'integrity', 'availability', 'combined'
    breach_cause    VARCHAR(100),                    -- 'cyber_attack', 'human_error', 'system_failure', 'stolen_device', 'vendor_breach', 'unauthorized_access'
    
    -- Scope
    description     TEXT NOT NULL,
    data_categories_affected JSONB DEFAULT '[]',     -- ['email', 'name', 'financial', 'health']
    data_subjects_affected JSONB DEFAULT '[]',       -- ['customers', 'employees']
    estimated_records_affected INTEGER,
    estimated_individuals_affected INTEGER,
    affected_systems JSONB DEFAULT '[]',             -- which systems/vendors were involved
    
    -- Risk assessment
    risk_to_individuals VARCHAR(20),                 -- 'unlikely', 'low', 'medium', 'high'
    risk_assessment_detail TEXT,
    
    -- Notification decisions
    notify_authority BOOLEAN,                        -- required if risk is not 'unlikely'
    authority_notified_at TIMESTAMPTZ,
    authority_reference VARCHAR(255),                 -- reference number from DPA
    
    notify_individuals BOOLEAN,                      -- required if risk is 'high'
    individuals_notified_at TIMESTAMPTZ,
    individual_notification_method VARCHAR(100),      -- 'email', 'postal', 'public_notice'
    
    -- Status
    status          VARCHAR(50) DEFAULT 'detected',  -- detected, assessing, contained, notified, investigating, resolved, closed
    
    -- Resolution
    root_cause      TEXT,
    lessons_learned TEXT,
    resolved_at     TIMESTAMPTZ,
    
    -- Vendor-originated breach
    vendor_originated BOOLEAN DEFAULT FALSE,
    vendor_id       UUID REFERENCES vendors(id),
    vendor_notification_date TIMESTAMPTZ,
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_breach_org ON breaches(organization_id);
CREATE INDEX idx_breach_status ON breaches(status);
CREATE INDEX idx_breach_deadline ON breaches(notification_deadline);
```

#### breach_notifications

Generated notification documents.

```sql
CREATE TABLE breach_notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    breach_id       UUID NOT NULL REFERENCES breaches(id) ON DELETE CASCADE,
    
    notification_type VARCHAR(50) NOT NULL,       -- 'supervisory_authority', 'individuals', 'vendor_upstream'
    recipient       VARCHAR(255),                  -- DPA name or 'affected individuals'
    
    -- Content
    document_id     UUID REFERENCES documents(id),
    content_json    JSONB,                         -- structured notification data
    
    -- Status
    status          VARCHAR(50) DEFAULT 'draft',   -- draft, approved, sent, acknowledged
    sent_at         TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bn_breach ON breach_notifications(breach_id);
```

#### breach_remediation_tasks

```sql
CREATE TABLE breach_remediation_tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    breach_id       UUID NOT NULL REFERENCES breaches(id) ON DELETE CASCADE,
    
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    priority        VARCHAR(20) DEFAULT 'medium',  -- critical, high, medium, low
    
    assigned_to     UUID REFERENCES users(id),
    due_at          TIMESTAMPTZ,
    
    status          VARCHAR(50) DEFAULT 'pending',  -- pending, in_progress, completed, cancelled
    completed_at    TIMESTAMPTZ,
    completion_notes TEXT,
    evidence_document_id UUID REFERENCES documents(id),
    
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_brt_breach ON breach_remediation_tasks(breach_id);
```

### 2.8 DPIA Tables

#### dpias

```sql
CREATE TABLE dpias (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    
    -- Linked processing
    processing_activity_ids JSONB DEFAULT '[]',   -- which activities triggered this DPIA
    
    -- Step 1: Systematic description
    processing_description TEXT,
    necessity_assessment TEXT,                      -- why is this processing necessary?
    proportionality_assessment TEXT,                -- is it proportionate to the purpose?
    
    -- Step 2: Risk assessment (detail in dpia_risks table)
    overall_risk_level VARCHAR(20),                -- low, medium, high, critical
    
    -- Step 3: Measures (detail in dpia_measures table)
    residual_risk_level VARCHAR(20),               -- after measures applied
    
    -- Consultation
    requires_prior_consultation BOOLEAN DEFAULT FALSE,  -- Article 36 — if residual risk still high
    consultation_submitted_at TIMESTAMPTZ,
    consultation_authority VARCHAR(100),
    consultation_response TEXT,
    
    -- Status
    status          VARCHAR(50) DEFAULT 'draft',    -- draft, in_progress, completed, approved, needs_review
    approved_by     UUID REFERENCES users(id),
    approved_at     TIMESTAMPTZ,
    
    -- Review cycle
    last_reviewed_at TIMESTAMPTZ,
    next_review_at  TIMESTAMPTZ,
    review_trigger  VARCHAR(100),                   -- 'scheduled', 'processing_change', 'incident'
    
    -- Version
    version         INTEGER DEFAULT 1,
    
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dpia_org ON dpias(organization_id);
CREATE INDEX idx_dpia_status ON dpias(status);
```

#### dpia_risks

```sql
CREATE TABLE dpia_risks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dpia_id         UUID NOT NULL REFERENCES dpias(id) ON DELETE CASCADE,
    
    description     TEXT NOT NULL,
    risk_source     VARCHAR(100),                -- 'unauthorized_access', 'data_loss', 'purpose_creep', 'discrimination', 'reidentification'
    
    -- Risk scoring
    likelihood      VARCHAR(20) NOT NULL,        -- negligible, low, medium, high
    severity        VARCHAR(20) NOT NULL,        -- negligible, low, medium, high
    risk_level      VARCHAR(20) NOT NULL,        -- calculated from likelihood x severity matrix
    
    -- After mitigation
    residual_likelihood VARCHAR(20),
    residual_severity VARCHAR(20),
    residual_risk_level VARCHAR(20),
    
    affected_rights JSONB DEFAULT '[]',          -- ['right_to_privacy', 'non_discrimination', 'freedom_of_expression']
    
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dpia_risk_dpia ON dpia_risks(dpia_id);
```

#### dpia_measures

```sql
CREATE TABLE dpia_measures (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dpia_id         UUID NOT NULL REFERENCES dpias(id) ON DELETE CASCADE,
    risk_id         UUID REFERENCES dpia_risks(id),  -- which risk this measure mitigates
    
    measure_type    VARCHAR(50) NOT NULL,         -- 'technical', 'organizational', 'legal'
    description     TEXT NOT NULL,
    
    -- Implementation
    status          VARCHAR(50) DEFAULT 'planned', -- planned, in_progress, implemented, verified
    implemented_at  TIMESTAMPTZ,
    responsible     UUID REFERENCES users(id),
    evidence_document_id UUID REFERENCES documents(id),
    
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dpia_measure_dpia ON dpia_measures(dpia_id);
```

### 2.9 Training Tables

#### training_modules

```sql
CREATE TABLE training_modules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Global modules (Privaro-provided) or org-custom
    is_global       BOOLEAN DEFAULT FALSE,
    organization_id UUID REFERENCES organizations(id),
    
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    category        VARCHAR(100),                -- 'gdpr_fundamentals', 'data_handling', 'breach_response', 'dsar_handling', 'phishing_awareness'
    target_role     VARCHAR(50),                 -- 'all', 'management', 'marketing', 'developers', 'hr'
    
    -- Content
    content_json    JSONB NOT NULL,              -- structured lesson content: slides, text, videos
    
    -- Quiz
    quiz_questions  JSONB,                       -- [{question, options, correct_answer, explanation}]
    passing_score   INTEGER DEFAULT 70,          -- percentage
    
    -- Settings
    estimated_duration_minutes INTEGER,
    is_mandatory    BOOLEAN DEFAULT FALSE,
    recurrence      VARCHAR(50),                 -- 'once', 'annual', 'quarterly'
    
    version         INTEGER DEFAULT 1,
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tm_global ON training_modules(is_global) WHERE is_global = TRUE;
CREATE INDEX idx_tm_org ON training_modules(organization_id);
```

#### training_completions

```sql
CREATE TABLE training_completions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id       UUID NOT NULL REFERENCES training_modules(id),
    user_id         UUID NOT NULL REFERENCES users(id),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    
    -- Progress
    status          VARCHAR(50) DEFAULT 'not_started', -- not_started, in_progress, completed, failed
    progress_percent INTEGER DEFAULT 0,
    
    -- Quiz results
    quiz_score      INTEGER,
    quiz_passed     BOOLEAN,
    quiz_attempts   INTEGER DEFAULT 0,
    
    -- Certificate
    certificate_id  VARCHAR(100) UNIQUE,
    certificate_url VARCHAR(500),
    
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,                 -- for recurring training
    
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tc_user ON training_completions(user_id);
CREATE INDEX idx_tc_org ON training_completions(organization_id);
CREATE INDEX idx_tc_status ON training_completions(status);
```

### 2.10 Supporting Tables

#### documents

Central file storage references.

```sql
CREATE TABLE documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    
    name            VARCHAR(255) NOT NULL,
    type            VARCHAR(100) NOT NULL,       -- 'dpa', 'privacy_policy', 'dpia_report', 'breach_evidence', 'dsar_response', 'training_certificate', 'lia', 'tia', 'audit_file'
    
    -- Storage
    storage_key     VARCHAR(500) NOT NULL,       -- S3 key
    storage_bucket  VARCHAR(100) NOT NULL,
    mime_type       VARCHAR(100),
    file_size_bytes BIGINT,
    
    -- Encryption
    encrypted       BOOLEAN DEFAULT TRUE,
    encryption_key_id VARCHAR(255),              -- reference to KMS key
    
    -- Metadata
    metadata        JSONB DEFAULT '{}',          -- flexible metadata per document type
    
    uploaded_by     UUID REFERENCES users(id),
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ                  -- soft delete, then hard delete after retention period
);

CREATE INDEX idx_doc_org ON documents(organization_id);
CREATE INDEX idx_doc_type ON documents(type);
```

#### audit_logs

Immutable log of every significant action — your accountability backbone.

```sql
CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    
    -- Who
    user_id         UUID REFERENCES users(id),   -- null for system actions
    user_email      VARCHAR(255),                 -- denormalized in case user is deleted
    ip_address      VARCHAR(45),
    user_agent      VARCHAR(500),
    
    -- What
    action          VARCHAR(100) NOT NULL,        -- 'processing_activity.created', 'dsar.completed', 'breach.reported', 'policy.published', 'vendor.dpa_signed', 'user.login'
    resource_type   VARCHAR(100) NOT NULL,        -- 'processing_activity', 'dsar_request', 'breach', 'vendor', 'policy', etc.
    resource_id     UUID,
    
    -- Details
    description     TEXT,
    changes         JSONB,                        -- {field: {old: "x", new: "y"}}
    metadata        JSONB DEFAULT '{}',
    
    -- Immutability
    created_at      TIMESTAMPTZ DEFAULT NOW()
    -- No updated_at or deleted_at — audit logs are append-only
) PARTITION BY RANGE (created_at);

CREATE INDEX idx_al_org ON audit_logs(organization_id);
CREATE INDEX idx_al_user ON audit_logs(user_id);
CREATE INDEX idx_al_action ON audit_logs(action);
CREATE INDEX idx_al_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_al_date ON audit_logs(created_at);
```

#### compliance_assessments

Stores completed assessment questionnaires and scores.

```sql
CREATE TABLE compliance_assessments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    
    assessment_type VARCHAR(50) NOT NULL,         -- 'initial', 'quarterly_review', 'post_incident', 'regulatory_change'
    
    -- Questions & answers
    responses       JSONB NOT NULL,               -- [{question_id, question_text, answer, gdpr_articles_affected, score_impact}]
    
    -- Scoring
    total_score     INTEGER NOT NULL,             -- 0-100
    category_scores JSONB NOT NULL,               -- {data_mapping: 80, lawful_basis: 60, security: 90, rights: 45, ...}
    
    -- Generated action items
    action_items    JSONB DEFAULT '[]',            -- [{priority, title, description, gdpr_article, status}]
    
    -- Context
    regulatory_context JSONB DEFAULT '{}',         -- which country-specific rules were applied
    
    completed_by    UUID REFERENCES users(id),
    completed_at    TIMESTAMPTZ DEFAULT NOW(),
    
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ca_org ON compliance_assessments(organization_id);
CREATE INDEX idx_ca_type ON compliance_assessments(assessment_type);
```

#### regulatory_updates

Tracks GDPR and national law changes that affect customers.

```sql
CREATE TABLE regulatory_updates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    title           VARCHAR(255) NOT NULL,
    summary         TEXT NOT NULL,
    source_url      VARCHAR(500),
    source_authority VARCHAR(100),                -- 'EDPB', 'CNIL', 'DPC_Ireland', 'BfDI_Germany', etc.
    
    -- Scope
    affects_countries JSONB DEFAULT '["ALL"]',    -- ['DE', 'FR'] or ['ALL']
    affects_articles JSONB DEFAULT '[]',          -- ['Article 6', 'Article 28']
    affects_modules JSONB DEFAULT '[]',           -- ['ropa', 'consent', 'transfers']
    
    -- Severity
    severity        VARCHAR(20),                  -- 'info', 'advisory', 'action_required', 'urgent'
    action_required TEXT,                          -- what orgs need to do
    
    effective_date  DATE,
    published_at    TIMESTAMPTZ,
    
    -- Internal
    created_by      VARCHAR(100),                 -- Privaro team member
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ru_severity ON regulatory_updates(severity);
CREATE INDEX idx_ru_date ON regulatory_updates(published_at);
```

#### notification_queue

Centralized notification management.

```sql
CREATE TABLE notification_queue (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    user_id         UUID REFERENCES users(id),    -- null for org-wide notifications
    
    -- Content
    type            VARCHAR(100) NOT NULL,        -- 'dsar_deadline_warning', 'breach_72h_countdown', 'vendor_dpa_expiring', 'assessment_due', 'training_overdue', 'regulatory_update'
    title           VARCHAR(255) NOT NULL,
    body            TEXT NOT NULL,
    action_url      VARCHAR(500),
    
    -- Delivery
    channels        JSONB DEFAULT '["in_app"]',   -- ['in_app', 'email', 'slack', 'webhook']
    priority        VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
    
    -- Status
    status          VARCHAR(50) DEFAULT 'pending', -- pending, sent, delivered, read, failed
    sent_at         TIMESTAMPTZ,
    read_at         TIMESTAMPTZ,
    
    -- Scheduling
    scheduled_for   TIMESTAMPTZ,                  -- null = send immediately
    
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_nq_org ON notification_queue(organization_id);
CREATE INDEX idx_nq_user ON notification_queue(user_id);
CREATE INDEX idx_nq_status ON notification_queue(status);
CREATE INDEX idx_nq_scheduled ON notification_queue(scheduled_for) WHERE status = 'pending';
```

---

## 3. Integration Architecture

### 3.1 Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                                  │
├──────────────┬───────────────┬────────────────┬──────────────────────┤
│  Next.js     │  Cookie       │  Client        │  DSAR Intake         │
│  Dashboard   │  Consent JS   │  Portal        │  Portal              │
│  (main app)  │  (embedded)   │  (read-only)   │  (public form)       │
└──────┬───────┴───────┬───────┴────────┬───────┴──────────┬───────────┘
       │               │                │                  │
       ▼               ▼                ▼                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        API GATEWAY / EDGE                            │
│                    Cloudflare (WAF + Rate Limiting)                   │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        APPLICATION LAYER                             │
├──────────────────────┬───────────────────────────────────────────────┤
│  Fastify API Server  │  Background Workers (BullMQ)                  │
│                      │                                               │
│  - tRPC endpoints    │  - Vendor monitoring (daily)                   │
│  - REST API (public) │  - Retention deadline checks (daily)           │
│  - Webhook receivers │  - Cookie scanner (weekly per domain)          │
│  - Auth middleware    │  - Compliance score recalculation              │
│  - RBAC enforcement  │  - Report generation                           │
│                      │  - Email sending                               │
│                      │  - Regulatory update ingestion                  │
│                      │  - Consent record archival (monthly)            │
└──────────┬───────────┴───────────┬───────────────────────────────────┘
           │                       │
           ▼                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                                    │
├────────────┬──────────┬──────────┬──────────┬────────────────────────┤
│ PostgreSQL │  Redis   │ S3 (EU)  │ Meili-   │  pgvector              │
│            │          │          │ search   │  (embeddings)          │
│ - All      │ - Cache  │ - Files  │ - Vendor │  - GDPR articles       │
│   tables   │ - Queue  │ - DPAs   │   search │  - EDPB guidance       │
│ - Audit    │ - Rate   │ - Docs   │ - ROPA   │  - DPA rulings         │
│   logs     │   limits │ - Exports│   search │  - Supervisory         │
│ - Consent  │ - Session│          │ - DSAR   │    authority decisions  │
│   records  │          │          │   search │                        │
└────────────┴──────────┴──────────┴──────────┴────────────────────────┘
```

### 3.2 External Integrations

#### 3.2.1 Inbound Integrations (data flowing INTO Privaro)

```
┌─────────────────────────────────────────────────────────┐
│                 INBOUND INTEGRATIONS                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  OAuth2 Connections (user authorizes):                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  HubSpot     │  │  Google      │  │  Microsoft   │  │
│  │  - Contacts  │  │  Workspace   │  │  365         │  │
│  │  - Lists     │  │  - Drive     │  │  - OneDrive  │  │
│  │  - Forms     │  │  - Gmail     │  │  - Outlook   │  │
│  │  - Tracking  │  │  - Calendar  │  │  - SharePoint│  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Mailchimp   │  │  Salesforce  │  │  Slack       │  │
│  │  - Audiences │  │  - Contacts  │  │  - Messages  │  │
│  │  - Campaigns │  │  - Leads     │  │  (for DSAR   │  │
│  │  - Automations│ │  - Custom obj│  │   search)    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
│  API Key Connections:                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Stripe      │  │  Xero        │  │  QuickBooks  │  │
│  │  - Customer  │  │  - Contacts  │  │  - Customers │  │
│  │    data map  │  │  - Employees │  │  - Vendors   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
│  Webhook Receivers:                                      │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Vendor breach notifications                      │   │
│  │  Vendor sub-processor changes                     │   │
│  │  Vendor DPA updates                               │   │
│  │  Stripe subscription events                       │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  Purpose of inbound integrations:                        │
│  1. DSAR automation (search for data subjects across     │
│     all connected systems)                               │
│  2. Auto-discovery of processing activities              │
│  3. Data mapping validation (verify what data            │
│     actually exists vs what's documented)                │
│  4. Vendor detection (auto-detect which tools            │
│     are in use from SSO/OAuth logs)                      │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

#### 3.2.2 Outbound Integrations (data flowing OUT of Privaro)

```
┌─────────────────────────────────────────────────────────┐
│                 OUTBOUND INTEGRATIONS                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Notification Channels:                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Email       │  │  Slack       │  │  Microsoft   │  │
│  │  (Postmark)  │  │  Bot         │  │  Teams Bot   │  │
│  │              │  │              │  │              │  │
│  │  - Deadline  │  │  - DSAR      │  │  - Same as   │  │
│  │    alerts    │  │    alerts    │  │    Slack     │  │
│  │  - Breach    │  │  - Breach    │  │              │  │
│  │    countdown │  │    countdown │  │              │  │
│  │  - Reports   │  │  - Daily     │  │              │  │
│  │              │  │    digest    │  │              │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
│  Automation Platforms:                                    │
│  ┌──────────────┐  ┌──────────────┐                     │
│  │  Zapier      │  │  Make        │                     │
│  │              │  │  (Integromat)│                     │
│  │  Triggers:   │  │              │                     │
│  │  - New DSAR  │  │  Same        │                     │
│  │  - Breach    │  │  triggers    │                     │
│  │  - Score     │  │              │                     │
│  │    change    │  │              │                     │
│  │  - Vendor    │  │              │                     │
│  │    alert     │  │              │                     │
│  └──────────────┘  └──────────────┘                     │
│                                                          │
│  Webhooks (custom):                                      │
│  ┌──────────────────────────────────────────────────┐   │
│  │  POST to customer-configured endpoints            │   │
│  │  Events: dsar.created, breach.detected,           │   │
│  │  vendor.dpa_expiring, assessment.completed,       │   │
│  │  compliance_score.changed                         │   │
│  │  Signed with HMAC-SHA256 for verification         │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

#### 3.2.3 Public API

```
┌─────────────────────────────────────────────────────────┐
│                    PUBLIC REST API                        │
│                    /api/v1/*                              │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Authentication: API key (Bearer token) per org          │
│  Rate Limiting: 100 req/min (starter), 500 (pro),       │
│                 2000 (agency), custom (enterprise)        │
│  Format: JSON                                            │
│                                                          │
│  Endpoints:                                              │
│                                                          │
│  Processing Activities                                   │
│  GET    /processing-activities                           │
│  POST   /processing-activities                           │
│  GET    /processing-activities/:id                       │
│  PUT    /processing-activities/:id                       │
│  DELETE /processing-activities/:id                       │
│                                                          │
│  Vendors                                                 │
│  GET    /vendors                                         │
│  POST   /vendors                                         │
│  GET    /vendors/:id                                     │
│  PUT    /vendors/:id/dpa-status                          │
│                                                          │
│  DSARs                                                   │
│  GET    /dsars                                           │
│  POST   /dsars                                           │
│  GET    /dsars/:id                                       │
│  PUT    /dsars/:id/status                                │
│  POST   /dsars/:id/tasks                                 │
│                                                          │
│  Breaches                                                │
│  POST   /breaches                                        │
│  GET    /breaches                                        │
│  GET    /breaches/:id                                    │
│  PUT    /breaches/:id                                    │
│                                                          │
│  Consent                                                 │
│  POST   /consent/record        (from JS snippet)         │
│  GET    /consent/config/:scriptId  (JS snippet config)   │
│  GET    /consent/stats/:domainId                         │
│                                                          │
│  Compliance                                              │
│  GET    /compliance/score                                │
│  GET    /compliance/report                               │
│  POST   /compliance/assessment                           │
│                                                          │
│  Webhooks                                                │
│  GET    /webhooks                                        │
│  POST   /webhooks                                        │
│  DELETE /webhooks/:id                                    │
│  POST   /webhooks/:id/test                               │
│                                                          │
└─────────────────────────────────────────────────────────┘
```



#### 3.2.4 Integration Implementation Details

### How each integration category works

#### 1. CRM & Marketing Tools (HubSpot, Salesforce, etc.)

**Purpose:** DSAR data discovery + ROPA auto-population

**How it works:**
- OAuth2 connection — user authenticates in your dashboard
- On connection, pull contact field schema → auto-suggest processing activities
- When DSAR received, search contacts API for the data subject
- Return structured data: contact record, activity timeline, associated deals
- For erasure requests: option to trigger deletion via API (with confirmation)

```
DSAR received for john@example.com
  → HubSpot integration searches:
      GET /crm/v3/objects/contacts/search
      body: {"filterGroups": [{"filters": [
        {"propertyName": "email", "value": "john@example.com"}
      ]}]}
  → Returns: contact record, deals, tickets, email interactions
  → Compiled into DSAR response package
```

**Data stored:** Only metadata (connection status, last sync, field mappings). Personal data from CRM is queried on-demand and never persisted in your database.

#### 2. Email Marketing (Mailchimp, SendGrid, Brevo)

**Purpose:** Consent verification + DSAR data discovery + subscriber management

**How it works:**
- Pull subscriber lists and consent records
- Cross-reference with your consent management module
- For DSAR/erasure: unsubscribe and delete subscriber via API

#### 3. Cloud Storage (Google Drive, OneDrive, Dropbox)

**Purpose:** DSAR document search + data mapping

**How it works:**
- Search APIs to find documents containing data subject's name/email
- Return file names and locations (NOT file contents — privacy first)
- Generate task list: "Check these 12 files in Google Drive for john@example.com's data"

#### 4. Auth & Identity (Google, Microsoft, Okta)

**Purpose:** SSO login + user directory sync

**How it works:**
- OIDC/SAML authentication flow
- Optional SCIM provisioning for larger agencies — auto-create/remove user accounts
- Enforce MFA requirements through identity provider

#### 5. Payments & Billing (Stripe)

**Purpose:** Subscription management

**How it works:**
- Stripe Checkout for signup
- Stripe Billing for recurring charges
- Webhook listener for payment events (subscription created, payment failed, plan changed, cancellation)
- Stripe Customer Portal for self-service billing management

#### 6. Communication (Slack, Microsoft Teams)

**Purpose:** Real-time compliance alerts

**How it works:**
- Slack bot / Teams connector that posts to a designated channel
- Alert types: DSAR deadline approaching, breach reported, vendor alert, DPA expiring, assessment overdue
- Slash commands: `/privaro status` → compliance score summary

#### 7. Document Signing (DocuSign, PandaDoc)

**Purpose:** DPA execution workflow

**How it works:**
- Generate DPA from template → send for signature via DocuSign API
- Track signature status
- Auto-update DPA status in vendor module when signed
- Store signed document reference

#### 8. Accounting (Xero, QuickBooks)

**Purpose:** Vendor discovery

**How it works:**
- Pull list of recurring software subscriptions from accounting data
- Cross-reference with vendor database
- Flag SaaS tools being paid for that aren't tracked in the vendor module
- "You're paying for 28 SaaS tools but only tracking 19 in Privaro"

### 3.3 Cookie Consent Script Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                 AGENCY CLIENT'S WEBSITE                        │
│                                                                │
│  <script src="https://consent.privaro.io/v1/abc123.js">      │
│                                                                │
│  1. Script loads (15KB gzipped, from Cloudflare edge)         │
│  2. Checks for existing consent cookie                         │
│  3. If no consent → renders banner                             │
│  4. User interacts → records consent                           │
│  5. Fires/blocks scripts based on consent categories           │
│  6. Sends consent record to Privaro API                        │
│  7. Updates Google Consent Mode signals                        │
│                                                                │
│  ┌────────────────────────────────────────────────┐           │
│  │           CONSENT BANNER (rendered)             │           │
│  │                                                  │           │
│  │  We use cookies to improve your experience.      │           │
│  │                                                  │           │
│  │  ☑ Necessary (always on)                         │           │
│  │  ☐ Analytics                                     │           │
│  │  ☐ Marketing                                     │           │
│  │  ☐ Functional                                    │           │
│  │                                                  │           │
│  │  [Reject All]  [Accept Selected]  [Accept All]   │           │
│  │                                                  │           │
│  └────────────────────────────────────────────────┘           │
│                                                                │
│  Script behavior:                                              │
│  - Blocks <script> tags marked with data-consent="marketing"  │
│  - Manages Google Tag Manager dataLayer consent signals        │
│  - Fires callbacks: window.Privaro.on('consent', fn)          │
│  - Provides API: window.Privaro.getConsent()                  │
│  - Handles consent withdrawal via settings link                │
│                                                                │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  Privaro Consent API (Cloudflare Workers)                     │
│                                                                │
│  POST /consent/record                                         │
│  {                                                             │
│    "script_id": "abc123",                                     │
│    "consent_id": "uuid",                                      │
│    "categories_accepted": ["necessary", "analytics"],         │
│    "categories_rejected": ["marketing"],                      │
│    "interaction": "custom",                                   │
│    "banner_version": "2.1",                                   │
│    "gcm_state": {                                             │
│      "analytics_storage": "granted",                          │
│      "ad_storage": "denied"                                   │
│    }                                                           │
│  }                                                             │
│                                                                │
│  Writes to: PostgreSQL consent_records table                  │
│  Archives to: S3 monthly (for long-term proof)                │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

### 3.4 DSAR Automation Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    DSAR AUTOMATION FLOW                        │
│                                                                │
│  Step 1: Request Intake                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                    │
│  │  Public   │  │  Email   │  │  Manual  │                    │
│  │  Portal   │  │  Forward │  │  Entry   │                    │
│  │  Form     │  │  Parser  │  │  (UI)    │                    │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘                    │
│        └─────────────┼─────────────┘                          │
│                      ▼                                         │
│  Step 2: Case Created                                          │
│  ┌────────────────────────────────────────┐                   │
│  │  dsar_requests record created           │                   │
│  │  Reference: DSAR-2026-0042              │                   │
│  │  30-day countdown starts                │                   │
│  │  Assigned to: team member               │                   │
│  │  Notifications sent (email + Slack)     │                   │
│  └───────────────────┬────────────────────┘                   │
│                      ▼                                         │
│  Step 3: Identity Verification                                 │
│  ┌────────────────────────────────────────┐                   │
│  │  Auto-send verification email           │                   │
│  │  "Click to confirm you made this        │                   │
│  │   request"                              │                   │
│  │  If unverified after 7 days → alert     │                   │
│  └───────────────────┬────────────────────┘                   │
│                      ▼                                         │
│  Step 4: Auto-generate Search Tasks                            │
│  ┌────────────────────────────────────────┐                   │
│  │  System reads org's ROPA + vendor list  │                   │
│  │  Creates dsar_tasks for each system:    │                   │
│  │                                         │                   │
│  │  Task 1: HubSpot (connected via OAuth)  │                   │
│  │    → AUTO: API search for subject email │                   │
│  │    → Returns: contact record, activity  │                   │
│  │                                         │                   │
│  │  Task 2: Mailchimp (connected via OAuth)│                   │
│  │    → AUTO: API search for subject email │                   │
│  │    → Returns: subscriber data, campaigns│                   │
│  │                                         │                   │
│  │  Task 3: Google Drive (connected)       │                   │
│  │    → AUTO: Search for files containing  │                   │
│  │      subject name/email                 │                   │
│  │                                         │                   │
│  │  Task 4: Internal database (manual)     │                   │
│  │    → MANUAL: "Search your project       │                   │
│  │      management tool for this person"   │                   │
│  │                                         │                   │
│  │  Task 5: Slack (connected)              │                   │
│  │    → AUTO: Search messages for subject  │                   │
│  │      name/email                         │                   │
│  └───────────────────┬────────────────────┘                   │
│                      ▼                                         │
│  Step 5: Compile Results                                       │
│  ┌────────────────────────────────────────┐                   │
│  │  All tasks completed                    │                   │
│  │  Auto-generate data package:            │                   │
│  │    - JSON export (machine-readable)     │                   │
│  │    - PDF summary (human-readable)       │                   │
│  │  Upload to S3, generate secure link     │                   │
│  │  Link expires in 30 days               │                   │
│  └───────────────────┬────────────────────┘                   │
│                      ▼                                         │
│  Step 6: Response                                              │
│  ┌────────────────────────────────────────┐                   │
│  │  Generate response letter from template │                   │
│  │  Human reviews and approves             │                   │
│  │  Send via encrypted email               │                   │
│  │  Log in dsar_communications             │                   │
│  │  Mark DSAR as completed                 │                   │
│  │  Audit log entry created                │                   │
│  └────────────────────────────────────────┘                   │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```


### 3.4.1 Per-Vendor Search Logic Implementation

When auto-generating search tasks (Step 4), the platform implements specific API logic for each integrated system:

**CRM & Marketing Tools (HubSpot, Salesforce, etc.)**
- On connection, pull contact field schema to auto-suggest processing activities.
- When DSAR received, search contacts API for the data subject.
- Return structured data: contact record, activity timeline, associated deals.
- For erasure requests: option to trigger deletion via API (with confirmation).
```http
GET /crm/v3/objects/contacts/search
body: {"filterGroups": [{"filters": [
  {"propertyName": "email", "value": "john@example.com"}
]}]}
```

**Email Marketing (Mailchimp, SendGrid, Brevo)**
- Pull subscriber lists and consent records.
- Cross-reference with your consent management module.
- For DSAR/erasure: unsubscribe and delete subscriber via API.

**Cloud Storage (Google Drive, OneDrive, Dropbox)**
- Search APIs to find documents containing data subject's name/email.
- Return file names and locations (NOT file contents — privacy first).
- Generate task list: "Check these 12 files in Google Drive for john@example.com's data".

### 3.5 Background Job Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    BULLMQ JOB QUEUES                          │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  Queue: compliance-checks (runs daily at 02:00 UTC)           │
│  ├── Job: check-retention-deadlines                           │
│  │   → Scans processing_activities for expired retention      │
│  │   → Creates notification for data deletion                 │
│  ├── Job: check-dpa-expiry                                    │
│  │   → Scans organization_vendors for DPAs expiring < 30 days│
│  │   → Sends warning notifications                            │
│  ├── Job: check-review-dates                                  │
│  │   → Scans processing_activities, dpias for overdue reviews │
│  │   → Sends review reminder notifications                    │
│  ├── Job: check-training-expiry                               │
│  │   → Scans training_completions for expired certifications  │
│  │   → Sends retraining notifications                         │
│  └── Job: recalculate-compliance-scores                       │
│      → Recalculates score for all active orgs                 │
│      → Updates organizations.compliance_score                 │
│                                                                │
│  Queue: vendor-monitoring (runs daily at 04:00 UTC)           │
│  ├── Job: check-vendor-dpa-changes                            │
│  │   → Crawls DPA URLs for global vendors                     │
│  │   → Detects content changes (hash comparison)              │
│  │   → Alerts affected organizations                          │
│  ├── Job: check-vendor-sub-processor-changes                  │
│  │   → Crawls sub-processor list URLs                         │
│  │   → Detects additions/removals                             │
│  │   → Alerts affected organizations                          │
│  └── Job: check-vendor-incidents                              │
│      → Monitors breach disclosure feeds                       │
│      → Matches against vendor database                        │
│      → Creates breach cases for affected orgs                 │
│                                                                │
│  Queue: cookie-scanning (distributed across the week)         │
│  └── Job: scan-domain                                         │
│      → Launches headless Puppeteer browser                    │
│      → Visits domain, captures all cookies/trackers           │
│      → Compares with previous scan                            │
│      → Auto-classifies new cookies                            │
│      → Alerts if unclassified cookies found                   │
│                                                                │
│  Queue: notifications (real-time)                              │
│  └── Job: send-notification                                   │
│      → Reads from notification_queue                          │
│      → Delivers via configured channels                       │
│      → Updates delivery status                                │
│                                                                │
│  Queue: reports (on-demand + scheduled)                        │
│  ├── Job: generate-audit-file                                 │
│  │   → Compiles all compliance data into PDF package          │
│  │   → Uploads to S3, sends download link                     │
│  └── Job: generate-periodic-report                            │
│      → Monthly/quarterly compliance summary                   │
│      → Emails to org admins                                   │
│                                                                │
│  Queue: data-archival (runs monthly)                           │
│  ├── Job: archive-consent-records                             │
│  │   → Moves consent_records older than 24 months to S3       │
│  │   → Maintains queryable index in PostgreSQL                │
│  └── Job: archive-audit-logs                                  │
│      → Moves audit_logs older than 36 months to S3            │
│      → Maintains summary index                                │
│                                                                │
│  Queue: ai-processing (on-demand)                              │
│  ├── Job: analyze-dpa-document                                │
│  │   → Extracts clauses from uploaded DPA                     │
│  │   → Checks against Article 28 requirements                 │
│  │   → Returns gap analysis                                   │
│  ├── Job: compliance-qa                                       │
│  │   → RAG-based Q&A against GDPR knowledge base             │
│  │   → Returns answer with article citations                  │
│  └── Job: policy-review                                       │
│      → AI reviews generated privacy policy                    │
│      → Suggests improvements and flags issues                 │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

### 3.6 Security Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                            │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  Network:                                                      │
│  ├── Cloudflare WAF (DDoS protection, bot mitigation)         │
│  ├── TLS 1.3 everywhere (no TLS 1.2 fallback)                │
│  ├── HSTS with preload                                        │
│  ├── VPC with private subnets for DB/Redis                    │
│  └── No public database access                                │
│                                                                │
│  Application:                                                  │
│  ├── RBAC enforced at API layer (not just UI)                 │
│  ├── Row-level security in PostgreSQL (org isolation)         │
│  ├── Input validation via JSON Schema (Fastify native)        │
│  ├── CSRF protection (double-submit cookie)                   │
│  ├── Content Security Policy headers                          │
│  ├── Rate limiting per API key and per IP                     │
│  └── Request signing for webhooks (HMAC-SHA256)               │
│                                                                │
│  Data:                                                         │
│  ├── AES-256 encryption at rest (AWS RDS + S3)                │
│  ├── TLS 1.3 encryption in transit                            │
│  ├── Database-level encryption for sensitive fields:          │
│  │   ├── dsar subject identifiers                             │
│  │   ├── breach details                                       │
│  │   └── API keys                                             │
│  ├── S3 server-side encryption with customer-managed keys     │
│  ├── Audit logs are append-only (no UPDATE/DELETE)            │
│  └── Automatic PII detection in audit log payloads            │
│                                                                │
│  Authentication:                                               │
│  ├── Argon2id for password hashing                            │
│  ├── TOTP-based MFA (Google Authenticator / Authy)            │
│  ├── Session tokens (HttpOnly, Secure, SameSite=Strict)       │
│  ├── API keys: SHA-256 hashed storage, prefix-based lookup    │
│  ├── OAuth2 PKCE for SSO integrations                         │
│  └── Automatic session invalidation on password change        │
│                                                                │
│  Compliance (practice what we preach):                         │
│  ├── Our own ROPA documented and published                    │
│  ├── Annual penetration testing                               │
│  ├── SOC 2 Type II (target: year 2)                           │
│  ├── ISO 27001 (target: year 3)                               │
│  ├── Bug bounty program                                       │
│  ├── 72-hour breach notification to our own customers         │
│  └── Transparent sub-processor list on our website            │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

### 3.7 Multi-tenancy & Data Isolation

```
┌──────────────────────────────────────────────────────────────┐
│                    MULTI-TENANCY MODEL                        │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  Approach: Shared database, row-level isolation               │
│                                                                │
│  Every table with org data has:                                │
│  - organization_id UUID NOT NULL                              │
│  - Row-Level Security (RLS) policy in PostgreSQL              │
│                                                                │
│  Example RLS policy:                                           │
│                                                                │
│  CREATE POLICY org_isolation ON processing_activities          │
│    USING (organization_id = current_setting('app.org_id')     │
│           ::uuid);                                             │
│                                                                │
│  On every API request:                                         │
│  1. Auth middleware extracts org_id from JWT                   │
│  2. Sets PostgreSQL session variable:                          │
│     SET app.org_id = 'uuid-here';                             │
│  3. All queries automatically filtered                         │
│  4. Impossible to accidentally access another org's data      │
│                                                                │
│  Exception: global vendors table                               │
│  - Shared rows (is_global = true) readable by all             │
│  - Org-specific rows follow standard RLS                      │
│                                                                │
│  Enterprise tier: option for dedicated database                │
│  - Separate PostgreSQL instance                                │
│  - Full data isolation at infrastructure level                 │
│  - Required for some enterprise security policies             │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. Deployment Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                 AWS eu-west-1 (Dublin)                         │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  VPC                                                     │ │
│  │                                                          │ │
│  │  Public Subnet                                           │ │
│  │  ┌───────────────┐  ┌───────────────┐                   │ │
│  │  │  ALB           │  │  NAT Gateway  │                   │ │
│  │  │  (Load         │  │               │                   │ │
│  │  │   Balancer)    │  │               │                   │ │
│  │  └───────┬───────┘  └───────────────┘                   │ │
│  │          │                                               │ │
│  │  Private Subnet                                          │ │
│  │  ┌───────────────┐  ┌───────────────┐                   │ │
│  │  │  ECS Fargate   │  │  ECS Fargate  │                   │ │
│  │  │  (API)         │  │  (Workers)    │                   │ │
│  │  │  2-8 tasks     │  │  2-4 tasks    │                   │ │
│  │  │  auto-scaling  │  │               │                   │ │
│  │  └───────────────┘  └───────────────┘                   │ │
│  │                                                          │ │
│  │  Data Subnet                                             │ │
│  │  ┌───────────────┐  ┌───────────────┐  ┌────────────┐  │ │
│  │  │  RDS           │  │  ElastiCache  │  │  Meili-    │  │ │
│  │  │  PostgreSQL    │  │  Redis        │  │  search    │  │ │
│  │  │  Multi-AZ      │  │  Cluster      │  │            │  │ │
│  │  │  encrypted     │  │               │  │            │  │ │
│  │  └───────────────┘  └───────────────┘  └────────────┘  │ │
│  │                                                          │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                                │
│  S3 Buckets:                                                   │
│  ├── privaro-documents-eu (DPAs, exports, evidence)           │
│  ├── privaro-consent-archive-eu (monthly consent archives)    │
│  └── privaro-backups-eu (database backups)                    │
│                                                                │
│  Cross-region backup: eu-central-1 (Frankfurt)                │
│  ├── S3 replication for documents                             │
│  └── RDS read replica for disaster recovery                   │
│                                                                │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                 Cloudflare (Edge)                              │
│                                                                │
│  ├── CDN for Next.js static assets + marketing site           │
│  ├── Workers for consent script delivery (EU-only routing)    │
│  ├── WAF rules + DDoS protection                             │
│  ├── Rate limiting at edge                                    │
│  └── DNS management                                           │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. Estimated Infrastructure Costs (Monthly)

| Component | At 100 customers | At 1,000 customers | At 5,000 customers |
|---|---|---|---|
| RDS PostgreSQL (db.t4g.medium → db.r6g.large) | $70 | $250 | $800 |
| ElastiCache Redis (cache.t4g.micro → cache.r6g.large) | $15 | $80 | $300 |
| ECS Fargate (API + Workers) | $50 | $200 | $800 |
| S3 + data transfer | $10 | $50 | $200 |
| Cloudflare (Pro → Business) | $20 | $200 | $200 |
| Meilisearch (self-hosted on EC2) | $30 | $60 | $150 |
| Postmark (email) | $10 | $50 | $200 |
| Sentry | $26 | $26 | $80 |
| Puppeteer instances (cookie scanning) | $20 | $100 | $400 |
| Anthropic API (AI features) | $30 | $200 | $800 |
| **Total** | **~$280/mo** | **~$1,200/mo** | **~$3,900/mo** |
| **Per customer** | **$2.80** | **$1.20** | **$0.78** |

Infrastructure cost per customer drops significantly at scale, maintaining healthy 85%+ gross margins at the Professional/Agency tier pricing.

---

## 6. Key Technical Decisions & Rationale

**Why PostgreSQL over MongoDB:** GDPR compliance data is inherently relational — processing activities link to vendors, which link to DPAs, which link to transfers. MongoDB would require denormalization that makes audit trails and version history painful. PostgreSQL's JSONB gives you document flexibility where needed (settings, metadata) without sacrificing joins.

**Why tRPC over REST internally:** The dashboard makes hundreds of different API calls. Maintaining OpenAPI specs for all of them is overhead that slows development. tRPC gives you end-to-end type safety with zero schema maintenance. The public API remains REST for external consumers.

**Why BullMQ over AWS SQS:** BullMQ gives you scheduled/recurring jobs, rate limiting, retries, and a dashboard (Bull Board) out of the box. SQS would require Lambda functions for processing, adding architectural complexity. BullMQ keeps everything in one runtime.

**Why Meilisearch over Elasticsearch:** For the search volumes involved (vendor lookup, ROPA search, DSAR subject search), Meilisearch is dramatically simpler to operate, uses less memory, and is fast enough. Elasticsearch is overkill until you're processing millions of consent records.

**Why Cloudflare Workers for consent script:** The consent script must load before any other JavaScript on the page. Edge deployment via Workers means sub-50ms latency across all of Europe. Serving from your origin server would add 100-200ms for users far from Dublin.

**Why partitioned tables for consent_records and audit_logs:** These tables grow unbounded. Monthly partitioning allows efficient archival (detach old partitions, move to cold storage), fast queries on recent data, and independent vacuum/maintenance per partition.
