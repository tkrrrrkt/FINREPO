-- EDINET ingestion DDL draft (raw/staging/core)
-- PostgreSQL 15+

-- Schemas
CREATE SCHEMA IF NOT EXISTS raw;
CREATE SCHEMA IF NOT EXISTS staging;
CREATE SCHEMA IF NOT EXISTS core;

-- =========================
-- RAW SCHEMA
-- =========================

CREATE TABLE IF NOT EXISTS raw.edinet_document (
    id                BIGSERIAL PRIMARY KEY,
    doc_id            VARCHAR(20) NOT NULL UNIQUE,
    edinet_code       VARCHAR(10),
    sec_code          VARCHAR(10),
    jcn               VARCHAR(13),
    company_name      TEXT,
    fund_code         VARCHAR(10),
    submission_date   DATE NOT NULL,
    ope_date_time     TIMESTAMPTZ,
    doc_type_code     VARCHAR(10),
    ordinance_code    VARCHAR(10),
    form_code         VARCHAR(10),
    doc_description   TEXT,
    issuer_edinet_code   VARCHAR(10),
    subject_edinet_code  VARCHAR(10),
    subsidiary_edinet_code TEXT,
    period_start      DATE,
    period_end        DATE,
    fiscal_year       SMALLINT,
    accounting_standard VARCHAR(10),
    is_consolidated   BOOLEAN,
    is_amended        BOOLEAN DEFAULT FALSE,
    parent_doc_id     VARCHAR(20),
    withdrawal_status SMALLINT,
    doc_info_edit_status SMALLINT,
    disclosure_status SMALLINT,
    xbrl_flag         SMALLINT,
    pdf_flag          SMALLINT,
    attach_doc_flag   SMALLINT,
    english_doc_flag  SMALLINT,
    csv_flag          SMALLINT,
    legal_status      SMALLINT,
    api_version       VARCHAR(10) DEFAULT 'v2',
    doclist_json_path TEXT,
    zip_path          TEXT,
    extracted_path    TEXT,
    fetch_status      VARCHAR(20) DEFAULT 'fetched',
    fetched_at        TIMESTAMPTZ DEFAULT NOW(),
    parsed_at         TIMESTAMPTZ,
    loaded_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_raw_edinet_document_submission_date
    ON raw.edinet_document (submission_date);
CREATE INDEX IF NOT EXISTS idx_raw_edinet_document_sec_code
    ON raw.edinet_document (sec_code);
CREATE INDEX IF NOT EXISTS idx_raw_edinet_document_edinet_code
    ON raw.edinet_document (edinet_code);

CREATE TABLE IF NOT EXISTS raw.edinet_file (
    id          BIGSERIAL PRIMARY KEY,
    doc_id      VARCHAR(20) NOT NULL REFERENCES raw.edinet_document(doc_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    file_type   VARCHAR(30) NOT NULL, -- doclist/json/zip/xbrl/ixbrl/etc
    path        TEXT NOT NULL,
    size_bytes  BIGINT,
    sha256      CHAR(64),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (doc_id, file_type, path)
);

CREATE INDEX IF NOT EXISTS idx_raw_edinet_file_doc_id
    ON raw.edinet_file (doc_id);

-- =========================
-- STAGING SCHEMA
-- =========================

CREATE TABLE IF NOT EXISTS staging.context (
    id              BIGSERIAL PRIMARY KEY,
    doc_id          VARCHAR(20) NOT NULL REFERENCES raw.edinet_document(doc_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    context_ref     TEXT NOT NULL,
    period_type     VARCHAR(20), -- instant/duration
    period_start    DATE,
    period_end      DATE,
    instant_date    DATE,
    entity_identifier TEXT,
    is_consolidated BOOLEAN,
    dimensions      JSONB,
    context_hash    CHAR(64),
    UNIQUE (doc_id, context_ref)
);

CREATE INDEX IF NOT EXISTS idx_staging_context_doc_id
    ON staging.context (doc_id);
CREATE INDEX IF NOT EXISTS idx_staging_context_period_end
    ON staging.context (period_end);
CREATE INDEX IF NOT EXISTS idx_staging_context_dimensions_gin
    ON staging.context USING GIN (dimensions);

CREATE TABLE IF NOT EXISTS staging.unit (
    id          BIGSERIAL PRIMARY KEY,
    doc_id      VARCHAR(20) NOT NULL REFERENCES raw.edinet_document(doc_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    unit_ref    TEXT NOT NULL,
    measures    JSONB,
    unit_hash   CHAR(64),
    UNIQUE (doc_id, unit_ref)
);

CREATE INDEX IF NOT EXISTS idx_staging_unit_doc_id
    ON staging.unit (doc_id);

CREATE TABLE IF NOT EXISTS staging.fact (
    id              BIGSERIAL PRIMARY KEY,
    doc_id          VARCHAR(20) NOT NULL REFERENCES raw.edinet_document(doc_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    concept_qname   TEXT NOT NULL, -- namespace:element
    concept_namespace TEXT,
    concept_name    TEXT,
    context_id      BIGINT REFERENCES staging.context(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    unit_id         BIGINT REFERENCES staging.unit(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    value_numeric   NUMERIC(30, 6),
    value_text      TEXT,
    decimals        SMALLINT,
    is_nil          BOOLEAN DEFAULT FALSE,
    fact_hash       CHAR(64) NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (doc_id, fact_hash)
);

CREATE INDEX IF NOT EXISTS idx_staging_fact_doc_id
    ON staging.fact (doc_id);
CREATE INDEX IF NOT EXISTS idx_staging_fact_concept_qname
    ON staging.fact (concept_qname);
CREATE INDEX IF NOT EXISTS idx_staging_fact_context_id
    ON staging.fact (context_id);

-- =========================
-- CORE SCHEMA
-- =========================

CREATE TABLE IF NOT EXISTS core.company (
    company_id      BIGSERIAL PRIMARY KEY,
    edinet_code     VARCHAR(10) UNIQUE,
    sec_code        VARCHAR(10),
    jcn             VARCHAR(13),
    company_name    TEXT NOT NULL,
    industry_code   VARCHAR(10),
    is_listed       BOOLEAN DEFAULT TRUE,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_core_company_sec_code
    ON core.company (sec_code);
CREATE INDEX IF NOT EXISTS idx_core_company_company_name
    ON core.company (company_name);

CREATE TABLE IF NOT EXISTS core.document (
    document_id       BIGSERIAL PRIMARY KEY,
    doc_id            VARCHAR(20) NOT NULL UNIQUE,
    company_id        BIGINT NOT NULL REFERENCES core.company(company_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    doc_type_code     VARCHAR(10),
    submission_date   DATE NOT NULL,
    period_start      DATE,
    period_end        DATE NOT NULL,
    fiscal_year       SMALLINT,
    accounting_standard VARCHAR(10),
    is_consolidated   BOOLEAN,
    is_amended        BOOLEAN DEFAULT FALSE,
    parent_doc_id     VARCHAR(20),
    source_doc_id     VARCHAR(20),
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_core_document_company_id
    ON core.document (company_id);
CREATE INDEX IF NOT EXISTS idx_core_document_period_end
    ON core.document (period_end);
CREATE INDEX IF NOT EXISTS idx_core_document_submission_date
    ON core.document (submission_date);

CREATE TABLE IF NOT EXISTS core.concept (
    concept_id    BIGSERIAL PRIMARY KEY,
    namespace     VARCHAR(120) NOT NULL,
    element_name  VARCHAR(200) NOT NULL,
    label_ja      TEXT,
    label_en      TEXT,
    data_type     VARCHAR(50),
    period_type   VARCHAR(20), -- instant/duration
    balance_type  VARCHAR(10),
    is_standard   BOOLEAN DEFAULT TRUE,
    UNIQUE (namespace, element_name)
);

CREATE TABLE IF NOT EXISTS core.standard_code (
    standard_code VARCHAR(50) PRIMARY KEY,
    name_ja        TEXT NOT NULL,
    name_en        TEXT,
    category       VARCHAR(20), -- BS/PL/CF/OTHER
    period_type    VARCHAR(20), -- instant/duration
    description    TEXT,
    is_active      BOOLEAN DEFAULT TRUE,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS core.concept_mapping (
    mapping_id     BIGSERIAL PRIMARY KEY,
    concept_id     BIGINT NOT NULL REFERENCES core.concept(concept_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    standard_code  VARCHAR(50) REFERENCES core.standard_code(standard_code) ON UPDATE CASCADE ON DELETE RESTRICT,
    mapping_method VARCHAR(20) DEFAULT 'manual', -- manual/auto
    confidence     NUMERIC(5, 2),
    is_active      BOOLEAN DEFAULT TRUE,
    notes          TEXT,
    mapped_by      TEXT,
    mapped_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (concept_id, standard_code, mapping_method)
);

CREATE INDEX IF NOT EXISTS idx_core_concept_mapping_concept_id
    ON core.concept_mapping (concept_id);
CREATE INDEX IF NOT EXISTS idx_core_concept_mapping_standard_code
    ON core.concept_mapping (standard_code);

CREATE TABLE IF NOT EXISTS core.context (
    context_id      BIGSERIAL PRIMARY KEY,
    document_id     BIGINT NOT NULL REFERENCES core.document(document_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    context_key     TEXT NOT NULL,
    period_type     VARCHAR(20),
    period_start    DATE,
    period_end      DATE,
    instant_date    DATE,
    entity_identifier TEXT,
    is_consolidated BOOLEAN,
    dimensions      JSONB,
    UNIQUE (document_id, context_key)
);

CREATE INDEX IF NOT EXISTS idx_core_context_document_id
    ON core.context (document_id);
CREATE INDEX IF NOT EXISTS idx_core_context_period_end
    ON core.context (period_end);
CREATE INDEX IF NOT EXISTS idx_core_context_dimensions_gin
    ON core.context USING GIN (dimensions);

CREATE TABLE IF NOT EXISTS core.unit (
    unit_id     BIGSERIAL PRIMARY KEY,
    unit_key    TEXT NOT NULL, -- canonical key, e.g. "JPY"
    measures    JSONB,
    UNIQUE (unit_key)
);

CREATE TABLE IF NOT EXISTS core.financial_fact (
    fact_id         BIGSERIAL PRIMARY KEY,
    document_id     BIGINT NOT NULL REFERENCES core.document(document_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    company_id      BIGINT NOT NULL REFERENCES core.company(company_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    concept_id      BIGINT NOT NULL REFERENCES core.concept(concept_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    context_id      BIGINT NOT NULL REFERENCES core.context(context_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    unit_id         BIGINT REFERENCES core.unit(unit_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    value_numeric   NUMERIC(30, 6),
    value_text      TEXT,
    decimals        SMALLINT,
    is_nil          BOOLEAN DEFAULT FALSE,
    fact_hash       CHAR(64) NOT NULL,
    period_end      DATE NOT NULL,
    is_consolidated BOOLEAN,
    accounting_standard VARCHAR(10),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (document_id, fact_hash)
);

CREATE INDEX IF NOT EXISTS idx_core_fact_document_id
    ON core.financial_fact (document_id);
CREATE INDEX IF NOT EXISTS idx_core_fact_company_id
    ON core.financial_fact (company_id);
CREATE INDEX IF NOT EXISTS idx_core_fact_concept_id
    ON core.financial_fact (concept_id);
CREATE INDEX IF NOT EXISTS idx_core_fact_period_end
    ON core.financial_fact (period_end);
CREATE INDEX IF NOT EXISTS idx_core_fact_is_consolidated
    ON core.financial_fact (is_consolidated);

-- =========================
-- PARTITIONING POLICY (deferred)
-- =========================
-- 現在はパーティションを使わず、doc_id の一意性とFK整合性を優先。
-- データ量が増えた段階で、再設計（PK/FKの見直し）と併せて導入する。
