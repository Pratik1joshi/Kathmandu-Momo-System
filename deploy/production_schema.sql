--
-- PostgreSQL database dump
--

-- Dumped from database version 17.3
-- Dumped by pg_dump version 17.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    id integer NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    subtype text,
    parent_id integer,
    is_active integer DEFAULT 1,
    is_system integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT accounts_type_check CHECK ((type = ANY (ARRAY['asset'::text, 'liability'::text, 'equity'::text, 'income'::text, 'expense'::text])))
);


--
-- Name: accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.accounts_id_seq OWNED BY public.accounts.id;


--
-- Name: bank_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_accounts (
    id integer NOT NULL,
    name text NOT NULL,
    account_number text,
    account_id integer,
    opening_balance numeric(14,2) DEFAULT 0,
    is_active integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: bank_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bank_accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bank_accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bank_accounts_id_seq OWNED BY public.bank_accounts.id;


--
-- Name: bank_reconciliations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_reconciliations (
    id integer NOT NULL,
    bank_account_id integer,
    statement_date date NOT NULL,
    statement_balance numeric(14,2) NOT NULL,
    book_balance numeric(14,2) NOT NULL,
    difference numeric(14,2) NOT NULL,
    note text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: bank_reconciliations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bank_reconciliations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bank_reconciliations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bank_reconciliations_id_seq OWNED BY public.bank_reconciliations.id;


--
-- Name: bill_corrections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bill_corrections (
    id integer NOT NULL,
    bill_id integer,
    type text NOT NULL,
    amount numeric(14,2) NOT NULL,
    reason text,
    restocked integer DEFAULT 0,
    journal_id integer,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT bill_corrections_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT bill_corrections_type_check CHECK ((type = ANY (ARRAY['void'::text, 'refund'::text])))
);


--
-- Name: bill_corrections_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bill_corrections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bill_corrections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bill_corrections_id_seq OWNED BY public.bill_corrections.id;


--
-- Name: bill_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bill_payments (
    id integer NOT NULL,
    bill_id integer NOT NULL,
    amount double precision NOT NULL,
    payment_method text NOT NULL,
    reference_number text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT bill_payments_amount_check CHECK ((amount >= (0)::double precision))
);


--
-- Name: bill_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bill_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bill_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bill_payments_id_seq OWNED BY public.bill_payments.id;


--
-- Name: bills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bills (
    id integer NOT NULL,
    bill_number text NOT NULL,
    order_id integer NOT NULL,
    subtotal double precision NOT NULL,
    tax double precision DEFAULT 0,
    vat_amount double precision DEFAULT 0,
    service_charge double precision DEFAULT 0,
    discount_amount double precision DEFAULT 0,
    discount_reason text,
    grand_total double precision NOT NULL,
    cashier_id integer,
    tax_percent double precision DEFAULT 0,
    service_charge_percent double precision DEFAULT 0,
    status text DEFAULT 'unpaid'::text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    paid_at timestamp without time zone,
    void_reason text,
    voided_at timestamp without time zone,
    refunded_amount numeric(14,2) DEFAULT 0,
    CONSTRAINT bills_grand_total_check CHECK ((grand_total >= (0)::double precision)),
    CONSTRAINT bills_subtotal_check CHECK ((subtotal >= (0)::double precision))
);


--
-- Name: bills_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bills_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bills_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bills_id_seq OWNED BY public.bills.id;


--
-- Name: cash_drawers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_drawers (
    id integer NOT NULL,
    name text NOT NULL,
    is_active integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: cash_drawers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cash_drawers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cash_drawers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cash_drawers_id_seq OWNED BY public.cash_drawers.id;


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id integer NOT NULL,
    name text NOT NULL,
    phone text,
    email text,
    address text,
    total_visits integer DEFAULT 0,
    total_spent double precision DEFAULT 0,
    credit_limit double precision DEFAULT 0,
    current_credit double precision DEFAULT 0,
    is_vip integer DEFAULT 0,
    is_blacklisted integer DEFAULT 0,
    notes text,
    phone_digits text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: customers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;


--
-- Name: devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.devices (
    id integer NOT NULL,
    device_id text NOT NULL,
    device_name text,
    device_type text,
    ip_address text,
    last_seen timestamp without time zone,
    user_id integer,
    is_active integer DEFAULT 1
);


--
-- Name: devices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.devices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: devices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.devices_id_seq OWNED BY public.devices.id;


--
-- Name: drawer_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.drawer_sessions (
    id integer NOT NULL,
    drawer_id integer NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    opening_amount numeric(14,2) DEFAULT 0 NOT NULL,
    opened_by integer,
    opened_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expected_amount numeric(14,2),
    counted_amount numeric(14,2),
    difference numeric(14,2),
    note text,
    closed_by integer,
    closed_at timestamp without time zone,
    CONSTRAINT drawer_sessions_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text])))
);


--
-- Name: drawer_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.drawer_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: drawer_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.drawer_sessions_id_seq OWNED BY public.drawer_sessions.id;


--
-- Name: expense_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expense_categories (
    id integer NOT NULL,
    name text NOT NULL,
    normalized_name text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: expense_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.expense_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: expense_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.expense_categories_id_seq OWNED BY public.expense_categories.id;


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id integer NOT NULL,
    description text,
    category text,
    amount double precision NOT NULL,
    expense_date date,
    purchase_date text,
    supplier text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    payment_method text DEFAULT 'cash'::text,
    logged_by integer,
    receipt_url text,
    source_type text,
    source_id integer
);


--
-- Name: expenses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.expenses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: expenses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.expenses_id_seq OWNED BY public.expenses.id;


--
-- Name: inquiries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inquiries (
    id integer NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    phone text,
    subject text,
    message text NOT NULL,
    status text DEFAULT 'new'::text,
    admin_notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    viewed_at timestamp without time zone
);


--
-- Name: inquiries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inquiries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inquiries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inquiries_id_seq OWNED BY public.inquiries.id;


--
-- Name: inventory_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_categories (
    id integer NOT NULL,
    name text NOT NULL,
    normalized_name text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: inventory_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_categories_id_seq OWNED BY public.inventory_categories.id;


--
-- Name: inventory_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_items (
    id integer NOT NULL,
    item_name text,
    name text,
    quantity double precision DEFAULT 0,
    unit text,
    cost_per_unit double precision DEFAULT 0,
    selling_price double precision,
    min_stock_level double precision DEFAULT 0,
    min_stock double precision DEFAULT 0,
    supplier text,
    notes text,
    menu_item_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    purchase_unit text,
    consumption_unit text,
    conversion_factor double precision DEFAULT 1,
    category text,
    is_archived integer DEFAULT 0,
    supplier_id integer,
    category_id integer
);


--
-- Name: inventory_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_items_id_seq OWNED BY public.inventory_items.id;


--
-- Name: journal_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_entries (
    id integer NOT NULL,
    entry_date date DEFAULT CURRENT_DATE NOT NULL,
    memo text,
    source_type text,
    source_id integer,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    external_ref text
);


--
-- Name: journal_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.journal_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: journal_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.journal_entries_id_seq OWNED BY public.journal_entries.id;


--
-- Name: journal_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_lines (
    id integer NOT NULL,
    journal_id integer NOT NULL,
    account_id integer NOT NULL,
    debit numeric(14,2) DEFAULT 0 NOT NULL,
    credit numeric(14,2) DEFAULT 0 NOT NULL,
    memo text,
    drawer_id integer,
    bank_account_id integer,
    supplier_id integer,
    reconciled integer DEFAULT 0,
    reconciled_at timestamp without time zone,
    CONSTRAINT chk_line_one_side CHECK ((NOT (((debit)::double precision > (0)::double precision) AND ((credit)::double precision > (0)::double precision)))),
    CONSTRAINT journal_lines_credit_check CHECK (((credit)::double precision >= (0)::double precision)),
    CONSTRAINT journal_lines_debit_check CHECK (((debit)::double precision >= (0)::double precision))
);


--
-- Name: journal_lines_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.journal_lines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: journal_lines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.journal_lines_id_seq OWNED BY public.journal_lines.id;


--
-- Name: kot_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kot_items (
    id integer NOT NULL,
    kot_id integer NOT NULL,
    order_item_id integer,
    menu_item_id integer,
    quantity integer DEFAULT 1 NOT NULL,
    special_instructions text,
    status text DEFAULT 'pending'::text
);


--
-- Name: kot_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.kot_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: kot_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.kot_items_id_seq OWNED BY public.kot_items.id;


--
-- Name: kots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kots (
    id integer NOT NULL,
    kot_number text,
    order_id integer NOT NULL,
    station text DEFAULT 'main'::text,
    status text DEFAULT 'pending'::text,
    prepared_by integer,
    printed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    started_at timestamp without time zone,
    completed_at timestamp without time zone
);


--
-- Name: kots_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.kots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: kots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.kots_id_seq OWNED BY public.kots.id;


--
-- Name: menu_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_categories (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    display_order integer DEFAULT 0,
    icon text,
    is_active integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: menu_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.menu_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: menu_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.menu_categories_id_seq OWNED BY public.menu_categories.id;


--
-- Name: menu_item_variants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_item_variants (
    id integer NOT NULL,
    menu_item_id integer NOT NULL,
    variant_name text NOT NULL,
    price_modifier double precision DEFAULT 0,
    is_default integer DEFAULT 0
);


--
-- Name: menu_item_variants_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.menu_item_variants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: menu_item_variants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.menu_item_variants_id_seq OWNED BY public.menu_item_variants.id;


--
-- Name: menu_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_items (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    category_id integer NOT NULL,
    base_price double precision NOT NULL,
    image_url text,
    preparation_time integer DEFAULT 15,
    is_vegetarian integer DEFAULT 0,
    is_vegan integer DEFAULT 0,
    is_spicy integer DEFAULT 0,
    spice_level integer DEFAULT 0,
    is_available integer DEFAULT 1,
    tags text,
    allergens text,
    calories integer,
    display_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT menu_items_base_price_check CHECK ((base_price >= (0)::double precision))
);


--
-- Name: menu_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.menu_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: menu_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.menu_items_id_seq OWNED BY public.menu_items.id;


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id integer NOT NULL,
    order_id integer NOT NULL,
    item_id integer,
    menu_item_id integer,
    item_name text,
    quantity integer DEFAULT 1,
    price double precision NOT NULL,
    subtotal double precision NOT NULL,
    special_instructions text,
    status text DEFAULT 'pending'::text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT order_items_price_check CHECK ((price >= (0)::double precision)),
    CONSTRAINT order_items_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT order_items_subtotal_check CHECK ((subtotal >= (0)::double precision))
);


--
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    order_number text NOT NULL,
    table_id integer,
    table_number text,
    order_type text DEFAULT 'dine_in'::text,
    status text DEFAULT 'pending'::text,
    waiter_id integer,
    customer_id integer,
    customer_name text,
    customer_phone text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    prep_started_at timestamp without time zone,
    ready_at timestamp without time zone,
    prepared_by integer
);


--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: payment_settlements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_settlements (
    id integer NOT NULL,
    method text NOT NULL,
    gross_amount numeric(14,2) NOT NULL,
    fee_amount numeric(14,2) DEFAULT 0,
    net_amount numeric(14,2) NOT NULL,
    bank_account_id integer,
    reference text,
    note text,
    settled_by integer,
    settled_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    journal_id integer
);


--
-- Name: payment_settlements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payment_settlements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payment_settlements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payment_settlements_id_seq OWNED BY public.payment_settlements.id;


--
-- Name: purchase_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_items (
    id integer NOT NULL,
    purchase_id integer NOT NULL,
    inventory_item_id integer,
    quantity_ordered double precision DEFAULT 0,
    quantity_received double precision DEFAULT 0,
    unit_cost double precision DEFAULT 0,
    line_total double precision DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: purchase_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_items_id_seq OWNED BY public.purchase_items.id;


--
-- Name: purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchases (
    id integer NOT NULL,
    supplier_id integer,
    supplier text,
    invoice_number text,
    invoice_date text,
    expected_delivery_date text,
    received_by integer,
    subtotal double precision DEFAULT 0,
    tax double precision DEFAULT 0,
    discount double precision DEFAULT 0,
    shipping double precision DEFAULT 0,
    total double precision DEFAULT 0,
    notes text,
    attachment_url text,
    status text DEFAULT 'received'::text NOT NULL,
    void_reason text,
    voided_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: purchases_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchases_id_seq OWNED BY public.purchases.id;


--
-- Name: rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_limits (
    id integer NOT NULL,
    rate_key text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: rate_limits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rate_limits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rate_limits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rate_limits_id_seq OWNED BY public.rate_limits.id;


--
-- Name: recipe_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recipe_items (
    id integer NOT NULL,
    recipe_id integer NOT NULL,
    raw_material_id integer,
    component_recipe_id integer,
    quantity double precision NOT NULL,
    unit text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT recipe_items_check CHECK ((((raw_material_id IS NOT NULL) AND (component_recipe_id IS NULL)) OR ((raw_material_id IS NULL) AND (component_recipe_id IS NOT NULL)))),
    CONSTRAINT recipe_items_quantity_check CHECK ((quantity > (0)::double precision))
);


--
-- Name: recipe_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.recipe_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: recipe_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.recipe_items_id_seq OWNED BY public.recipe_items.id;


--
-- Name: recipes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recipes (
    id integer NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    menu_item_id integer,
    yield_quantity double precision DEFAULT 1,
    yield_unit text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    prep_time_minutes integer,
    prep_notes text,
    CONSTRAINT recipes_type_check CHECK ((type = ANY (ARRAY['menu_item'::text, 'sub_recipe'::text])))
);


--
-- Name: recipes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.recipes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: recipes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.recipes_id_seq OWNED BY public.recipes.id;


--
-- Name: reservations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reservations (
    id integer NOT NULL,
    name text NOT NULL,
    phone text NOT NULL,
    date text NOT NULL,
    "time" text,
    guests text,
    party_size integer DEFAULT 2,
    occasion text,
    message text,
    status text DEFAULT 'new'::text,
    table_id integer,
    order_id integer,
    customer_id integer,
    admin_notes text,
    cancel_reason text,
    source text DEFAULT 'web'::text,
    expected_end_at text,
    preferences text,
    is_vip integer DEFAULT 0,
    deposit_required integer DEFAULT 0,
    deposit_paid integer DEFAULT 0,
    deposit_amount double precision DEFAULT 0,
    checked_in_at text,
    seated_at text,
    completed_at text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    viewed_at timestamp without time zone
);


--
-- Name: reservations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reservations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reservations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reservations_id_seq OWNED BY public.reservations.id;


--
-- Name: salary_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.salary_payments (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    amount double precision NOT NULL,
    period_label text,
    paid_on date DEFAULT CURRENT_DATE NOT NULL,
    method text DEFAULT 'cash'::text,
    note text,
    paid_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT salary_payments_amount_check CHECK ((amount >= (0)::double precision))
);


--
-- Name: salary_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.salary_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: salary_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.salary_payments_id_seq OWNED BY public.salary_payments.id;


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    id integer NOT NULL,
    version text NOT NULL,
    applied_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: schema_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.schema_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: schema_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.schema_migrations_id_seq OWNED BY public.schema_migrations.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sessions_id_seq OWNED BY public.sessions.id;


--
-- Name: stock_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_items (
    id integer NOT NULL,
    item_name text NOT NULL,
    category text NOT NULL,
    quantity double precision DEFAULT 0 NOT NULL,
    unit text NOT NULL,
    cost_per_unit double precision DEFAULT 0 NOT NULL,
    supplier text,
    purchase_date text,
    expiry_date text,
    min_stock_level double precision DEFAULT 10,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: stock_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stock_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stock_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stock_items_id_seq OWNED BY public.stock_items.id;


--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_movements (
    id integer NOT NULL,
    inventory_item_id integer,
    change_type text NOT NULL,
    quantity_changed double precision NOT NULL,
    performed_by integer,
    reason text,
    reference_id text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    unit_cost double precision,
    balance_after double precision,
    quantity_requested double precision,
    variance double precision
);


--
-- Name: stock_movements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stock_movements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stock_movements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stock_movements_id_seq OWNED BY public.stock_movements.id;


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppliers (
    id integer NOT NULL,
    name text NOT NULL,
    normalized_name text NOT NULL,
    phone text,
    email text,
    address text,
    notes text,
    is_archived integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: suppliers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.suppliers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: suppliers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.suppliers_id_seq OWNED BY public.suppliers.id;


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    id integer NOT NULL,
    setting_key text NOT NULL,
    setting_value text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: system_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.system_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: system_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.system_settings_id_seq OWNED BY public.system_settings.id;


--
-- Name: table_floors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.table_floors (
    id integer NOT NULL,
    name text NOT NULL,
    normalized_name text NOT NULL,
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: table_floors_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.table_floors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: table_floors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.table_floors_id_seq OWNED BY public.table_floors.id;


--
-- Name: table_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.table_types (
    id integer NOT NULL,
    name text NOT NULL,
    normalized_name text NOT NULL,
    color text DEFAULT '#3b82f6'::text,
    default_capacity integer DEFAULT 4,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: table_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.table_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: table_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.table_types_id_seq OWNED BY public.table_types.id;


--
-- Name: tables; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tables (
    id integer NOT NULL,
    table_number text NOT NULL,
    capacity integer DEFAULT 4,
    status text DEFAULT 'available'::text,
    current_order_id integer,
    is_active integer DEFAULT 1,
    floor text,
    section text,
    waiter_id integer,
    table_type text DEFAULT 'regular'::text,
    min_capacity integer DEFAULT 1,
    position_x double precision DEFAULT 0,
    position_y double precision DEFAULT 0,
    shape text DEFAULT 'square'::text,
    color text DEFAULT '#3b82f6'::text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    qr_token text
);


--
-- Name: tables_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tables_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tables_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tables_id_seq OWNED BY public.tables.id;


--
-- Name: unit_conversions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_conversions (
    id integer NOT NULL,
    from_unit text NOT NULL,
    to_unit text NOT NULL,
    factor double precision NOT NULL,
    note text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unit_conversions_factor_check CHECK ((factor > (0)::double precision))
);


--
-- Name: unit_conversions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.unit_conversions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: unit_conversions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.unit_conversions_id_seq OWNED BY public.unit_conversions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username text NOT NULL,
    password_hash text NOT NULL,
    full_name text NOT NULL,
    role text NOT NULL,
    email text,
    phone text,
    is_active integer DEFAULT 1,
    must_change_password integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    salary double precision,
    hire_date date,
    "position" text,
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'cashier'::text, 'waiter'::text, 'kitchen'::text])))
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: wastage_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wastage_log (
    id integer NOT NULL,
    raw_material_id integer,
    recipe_id integer,
    quantity double precision NOT NULL,
    unit text,
    reason text NOT NULL,
    logged_by integer,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    employee_id integer,
    shift text,
    photo_url text,
    total_cost double precision,
    CONSTRAINT wastage_log_check CHECK (((raw_material_id IS NOT NULL) OR (recipe_id IS NOT NULL))),
    CONSTRAINT wastage_log_quantity_check CHECK ((quantity > (0)::double precision)),
    CONSTRAINT wastage_log_reason_check CHECK ((reason = ANY (ARRAY['expired'::text, 'burned'::text, 'spoiled'::text, 'returned'::text, 'preparation_error'::text, 'customer_complaint'::text, 'spillage'::text, 'other'::text, 'burnt'::text, 'dropped'::text])))
);


--
-- Name: wastage_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wastage_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wastage_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wastage_log_id_seq OWNED BY public.wastage_log.id;


--
-- Name: accounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts ALTER COLUMN id SET DEFAULT nextval('public.accounts_id_seq'::regclass);


--
-- Name: bank_accounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_accounts ALTER COLUMN id SET DEFAULT nextval('public.bank_accounts_id_seq'::regclass);


--
-- Name: bank_reconciliations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_reconciliations ALTER COLUMN id SET DEFAULT nextval('public.bank_reconciliations_id_seq'::regclass);


--
-- Name: bill_corrections id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill_corrections ALTER COLUMN id SET DEFAULT nextval('public.bill_corrections_id_seq'::regclass);


--
-- Name: bill_payments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill_payments ALTER COLUMN id SET DEFAULT nextval('public.bill_payments_id_seq'::regclass);


--
-- Name: bills id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bills ALTER COLUMN id SET DEFAULT nextval('public.bills_id_seq'::regclass);


--
-- Name: cash_drawers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_drawers ALTER COLUMN id SET DEFAULT nextval('public.cash_drawers_id_seq'::regclass);


--
-- Name: customers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);


--
-- Name: devices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices ALTER COLUMN id SET DEFAULT nextval('public.devices_id_seq'::regclass);


--
-- Name: drawer_sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drawer_sessions ALTER COLUMN id SET DEFAULT nextval('public.drawer_sessions_id_seq'::regclass);


--
-- Name: expense_categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_categories ALTER COLUMN id SET DEFAULT nextval('public.expense_categories_id_seq'::regclass);


--
-- Name: expenses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses ALTER COLUMN id SET DEFAULT nextval('public.expenses_id_seq'::regclass);


--
-- Name: inquiries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inquiries ALTER COLUMN id SET DEFAULT nextval('public.inquiries_id_seq'::regclass);


--
-- Name: inventory_categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_categories ALTER COLUMN id SET DEFAULT nextval('public.inventory_categories_id_seq'::regclass);


--
-- Name: inventory_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items ALTER COLUMN id SET DEFAULT nextval('public.inventory_items_id_seq'::regclass);


--
-- Name: journal_entries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries ALTER COLUMN id SET DEFAULT nextval('public.journal_entries_id_seq'::regclass);


--
-- Name: journal_lines id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_lines ALTER COLUMN id SET DEFAULT nextval('public.journal_lines_id_seq'::regclass);


--
-- Name: kot_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kot_items ALTER COLUMN id SET DEFAULT nextval('public.kot_items_id_seq'::regclass);


--
-- Name: kots id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kots ALTER COLUMN id SET DEFAULT nextval('public.kots_id_seq'::regclass);


--
-- Name: menu_categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_categories ALTER COLUMN id SET DEFAULT nextval('public.menu_categories_id_seq'::regclass);


--
-- Name: menu_item_variants id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_item_variants ALTER COLUMN id SET DEFAULT nextval('public.menu_item_variants_id_seq'::regclass);


--
-- Name: menu_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items ALTER COLUMN id SET DEFAULT nextval('public.menu_items_id_seq'::regclass);


--
-- Name: order_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: payment_settlements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_settlements ALTER COLUMN id SET DEFAULT nextval('public.payment_settlements_id_seq'::regclass);


--
-- Name: purchase_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_items ALTER COLUMN id SET DEFAULT nextval('public.purchase_items_id_seq'::regclass);


--
-- Name: purchases id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases ALTER COLUMN id SET DEFAULT nextval('public.purchases_id_seq'::regclass);


--
-- Name: rate_limits id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_limits ALTER COLUMN id SET DEFAULT nextval('public.rate_limits_id_seq'::regclass);


--
-- Name: recipe_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_items ALTER COLUMN id SET DEFAULT nextval('public.recipe_items_id_seq'::regclass);


--
-- Name: recipes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipes ALTER COLUMN id SET DEFAULT nextval('public.recipes_id_seq'::regclass);


--
-- Name: reservations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservations ALTER COLUMN id SET DEFAULT nextval('public.reservations_id_seq'::regclass);


--
-- Name: salary_payments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salary_payments ALTER COLUMN id SET DEFAULT nextval('public.salary_payments_id_seq'::regclass);


--
-- Name: schema_migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations ALTER COLUMN id SET DEFAULT nextval('public.schema_migrations_id_seq'::regclass);


--
-- Name: sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions ALTER COLUMN id SET DEFAULT nextval('public.sessions_id_seq'::regclass);


--
-- Name: stock_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_items ALTER COLUMN id SET DEFAULT nextval('public.stock_items_id_seq'::regclass);


--
-- Name: stock_movements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements ALTER COLUMN id SET DEFAULT nextval('public.stock_movements_id_seq'::regclass);


--
-- Name: suppliers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers ALTER COLUMN id SET DEFAULT nextval('public.suppliers_id_seq'::regclass);


--
-- Name: system_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings ALTER COLUMN id SET DEFAULT nextval('public.system_settings_id_seq'::regclass);


--
-- Name: table_floors id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_floors ALTER COLUMN id SET DEFAULT nextval('public.table_floors_id_seq'::regclass);


--
-- Name: table_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_types ALTER COLUMN id SET DEFAULT nextval('public.table_types_id_seq'::regclass);


--
-- Name: tables id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tables ALTER COLUMN id SET DEFAULT nextval('public.tables_id_seq'::regclass);


--
-- Name: unit_conversions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_conversions ALTER COLUMN id SET DEFAULT nextval('public.unit_conversions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: wastage_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wastage_log ALTER COLUMN id SET DEFAULT nextval('public.wastage_log_id_seq'::regclass);


--
-- Name: accounts accounts_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_code_key UNIQUE (code);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: bank_accounts bank_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_accounts
    ADD CONSTRAINT bank_accounts_pkey PRIMARY KEY (id);


--
-- Name: bank_reconciliations bank_reconciliations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_reconciliations
    ADD CONSTRAINT bank_reconciliations_pkey PRIMARY KEY (id);


--
-- Name: bill_corrections bill_corrections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill_corrections
    ADD CONSTRAINT bill_corrections_pkey PRIMARY KEY (id);


--
-- Name: bill_payments bill_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill_payments
    ADD CONSTRAINT bill_payments_pkey PRIMARY KEY (id);


--
-- Name: bills bills_bill_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bills
    ADD CONSTRAINT bills_bill_number_key UNIQUE (bill_number);


--
-- Name: bills bills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bills
    ADD CONSTRAINT bills_pkey PRIMARY KEY (id);


--
-- Name: cash_drawers cash_drawers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_drawers
    ADD CONSTRAINT cash_drawers_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: devices devices_device_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_device_id_key UNIQUE (device_id);


--
-- Name: devices devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_pkey PRIMARY KEY (id);


--
-- Name: drawer_sessions drawer_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drawer_sessions
    ADD CONSTRAINT drawer_sessions_pkey PRIMARY KEY (id);


--
-- Name: expense_categories expense_categories_normalized_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_categories
    ADD CONSTRAINT expense_categories_normalized_name_key UNIQUE (normalized_name);


--
-- Name: expense_categories expense_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_categories
    ADD CONSTRAINT expense_categories_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: inquiries inquiries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inquiries
    ADD CONSTRAINT inquiries_pkey PRIMARY KEY (id);


--
-- Name: inventory_categories inventory_categories_normalized_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_categories
    ADD CONSTRAINT inventory_categories_normalized_name_key UNIQUE (normalized_name);


--
-- Name: inventory_categories inventory_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_categories
    ADD CONSTRAINT inventory_categories_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: journal_entries journal_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_pkey PRIMARY KEY (id);


--
-- Name: journal_lines journal_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_lines
    ADD CONSTRAINT journal_lines_pkey PRIMARY KEY (id);


--
-- Name: kot_items kot_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kot_items
    ADD CONSTRAINT kot_items_pkey PRIMARY KEY (id);


--
-- Name: kots kots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kots
    ADD CONSTRAINT kots_pkey PRIMARY KEY (id);


--
-- Name: menu_categories menu_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_categories
    ADD CONSTRAINT menu_categories_name_key UNIQUE (name);


--
-- Name: menu_categories menu_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_categories
    ADD CONSTRAINT menu_categories_pkey PRIMARY KEY (id);


--
-- Name: menu_item_variants menu_item_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_item_variants
    ADD CONSTRAINT menu_item_variants_pkey PRIMARY KEY (id);


--
-- Name: menu_items menu_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: payment_settlements payment_settlements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_settlements
    ADD CONSTRAINT payment_settlements_pkey PRIMARY KEY (id);


--
-- Name: purchase_items purchase_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_pkey PRIMARY KEY (id);


--
-- Name: purchases purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_pkey PRIMARY KEY (id);


--
-- Name: rate_limits rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_limits
    ADD CONSTRAINT rate_limits_pkey PRIMARY KEY (id);


--
-- Name: recipe_items recipe_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_items
    ADD CONSTRAINT recipe_items_pkey PRIMARY KEY (id);


--
-- Name: recipes recipes_menu_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_menu_item_id_key UNIQUE (menu_item_id);


--
-- Name: recipes recipes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_pkey PRIMARY KEY (id);


--
-- Name: reservations reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_pkey PRIMARY KEY (id);


--
-- Name: salary_payments salary_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salary_payments
    ADD CONSTRAINT salary_payments_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_version_key UNIQUE (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_token_key UNIQUE (token);


--
-- Name: stock_items stock_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_items
    ADD CONSTRAINT stock_items_pkey PRIMARY KEY (id);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_setting_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_setting_key_key UNIQUE (setting_key);


--
-- Name: table_floors table_floors_normalized_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_floors
    ADD CONSTRAINT table_floors_normalized_name_key UNIQUE (normalized_name);


--
-- Name: table_floors table_floors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_floors
    ADD CONSTRAINT table_floors_pkey PRIMARY KEY (id);


--
-- Name: table_types table_types_normalized_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_types
    ADD CONSTRAINT table_types_normalized_name_key UNIQUE (normalized_name);


--
-- Name: table_types table_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_types
    ADD CONSTRAINT table_types_pkey PRIMARY KEY (id);


--
-- Name: tables tables_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tables
    ADD CONSTRAINT tables_pkey PRIMARY KEY (id);


--
-- Name: tables tables_table_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tables
    ADD CONSTRAINT tables_table_number_key UNIQUE (table_number);


--
-- Name: unit_conversions unit_conversions_from_unit_to_unit_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_conversions
    ADD CONSTRAINT unit_conversions_from_unit_to_unit_key UNIQUE (from_unit, to_unit);


--
-- Name: unit_conversions unit_conversions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_conversions
    ADD CONSTRAINT unit_conversions_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: wastage_log wastage_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wastage_log
    ADD CONSTRAINT wastage_log_pkey PRIMARY KEY (id);


--
-- Name: idx_bank_recon_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_recon_account ON public.bank_reconciliations USING btree (bank_account_id, statement_date DESC);


--
-- Name: idx_bill_corrections_bill; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bill_corrections_bill ON public.bill_corrections USING btree (bill_id, type);


--
-- Name: idx_bill_payments_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bill_payments_created ON public.bill_payments USING btree (created_at DESC);


--
-- Name: idx_bills_one_paid_per_order; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_bills_one_paid_per_order ON public.bills USING btree (order_id) WHERE (status = 'paid'::text);


--
-- Name: idx_bills_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bills_order ON public.bills USING btree (order_id);


--
-- Name: idx_bills_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bills_status ON public.bills USING btree (status);


--
-- Name: idx_customers_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_name ON public.customers USING btree (name);


--
-- Name: idx_customers_phone_digits; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_phone_digits ON public.customers USING btree (phone_digits);


--
-- Name: idx_drawer_one_open; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_drawer_one_open ON public.drawer_sessions USING btree (drawer_id) WHERE (status = 'open'::text);


--
-- Name: idx_drawer_sessions_drawer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drawer_sessions_drawer ON public.drawer_sessions USING btree (drawer_id, status);


--
-- Name: idx_expenses_category_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_category_created ON public.expenses USING btree (category, created_at DESC);


--
-- Name: idx_expenses_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_created ON public.expenses USING btree (created_at DESC);


--
-- Name: idx_expenses_expense_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_expense_date ON public.expenses USING btree (expense_date);


--
-- Name: idx_expenses_purchase_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_purchase_date ON public.expenses USING btree (purchase_date);


--
-- Name: idx_expenses_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_source ON public.expenses USING btree (source_type, source_id);


--
-- Name: idx_inventory_items_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_items_category ON public.inventory_items USING btree (category);


--
-- Name: idx_inventory_items_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_items_category_id ON public.inventory_items USING btree (category_id);


--
-- Name: idx_inventory_items_normalized_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_inventory_items_normalized_name ON public.inventory_items USING btree (lower(TRIM(BOTH FROM item_name))) WHERE (COALESCE(is_archived, 0) = 0);


--
-- Name: idx_inventory_items_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_items_supplier ON public.inventory_items USING btree (supplier_id);


--
-- Name: idx_inventory_menu_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_menu_item ON public.inventory_items USING btree (menu_item_id);


--
-- Name: idx_journal_entries_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_entries_date ON public.journal_entries USING btree (entry_date DESC);


--
-- Name: idx_journal_external_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_journal_external_ref ON public.journal_entries USING btree (external_ref) WHERE (external_ref IS NOT NULL);


--
-- Name: idx_journal_lines_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_lines_account ON public.journal_lines USING btree (account_id);


--
-- Name: idx_journal_lines_bank; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_lines_bank ON public.journal_lines USING btree (bank_account_id) WHERE (bank_account_id IS NOT NULL);


--
-- Name: idx_journal_lines_drawer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_lines_drawer ON public.journal_lines USING btree (drawer_id) WHERE (drawer_id IS NOT NULL);


--
-- Name: idx_journal_lines_journal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_lines_journal ON public.journal_lines USING btree (journal_id);


--
-- Name: idx_journal_lines_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_lines_supplier ON public.journal_lines USING btree (supplier_id) WHERE (supplier_id IS NOT NULL);


--
-- Name: idx_journal_source; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_journal_source ON public.journal_entries USING btree (source_type, source_id) WHERE ((source_type IS NOT NULL) AND (source_id IS NOT NULL));


--
-- Name: idx_menu_items_available; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menu_items_available ON public.menu_items USING btree (is_available);


--
-- Name: idx_menu_items_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menu_items_category ON public.menu_items USING btree (category_id);


--
-- Name: idx_order_items_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_order ON public.order_items USING btree (order_id);


--
-- Name: idx_orders_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_created ON public.orders USING btree (created_at DESC);


--
-- Name: idx_orders_prepared_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_prepared_by ON public.orders USING btree (prepared_by);


--
-- Name: idx_orders_ready_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_ready_at ON public.orders USING btree (ready_at);


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_status ON public.orders USING btree (status);


--
-- Name: idx_orders_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_status_created ON public.orders USING btree (status, created_at DESC);


--
-- Name: idx_orders_table; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_table ON public.orders USING btree (table_id);


--
-- Name: idx_orders_type_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_type_created ON public.orders USING btree (order_type, created_at DESC);


--
-- Name: idx_purchase_items_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_items_item ON public.purchase_items USING btree (inventory_item_id);


--
-- Name: idx_purchase_items_purchase; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_items_purchase ON public.purchase_items USING btree (purchase_id);


--
-- Name: idx_purchases_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchases_created ON public.purchases USING btree (created_at DESC);


--
-- Name: idx_purchases_invoice_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchases_invoice_date ON public.purchases USING btree (invoice_date);


--
-- Name: idx_purchases_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchases_status_created ON public.purchases USING btree (status, created_at DESC);


--
-- Name: idx_purchases_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchases_supplier ON public.purchases USING btree (supplier_id);


--
-- Name: idx_rate_limits_key_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rate_limits_key_created ON public.rate_limits USING btree (rate_key, created_at);


--
-- Name: idx_recipe_items_component; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recipe_items_component ON public.recipe_items USING btree (component_recipe_id);


--
-- Name: idx_recipe_items_raw_material; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recipe_items_raw_material ON public.recipe_items USING btree (raw_material_id);


--
-- Name: idx_recipe_items_recipe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recipe_items_recipe ON public.recipe_items USING btree (recipe_id);


--
-- Name: idx_recipes_menu_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recipes_menu_item ON public.recipes USING btree (menu_item_id);


--
-- Name: idx_reservations_date_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservations_date_status ON public.reservations USING btree (date, status);


--
-- Name: idx_reservations_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservations_order ON public.reservations USING btree (order_id);


--
-- Name: idx_salary_payments_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_salary_payments_employee ON public.salary_payments USING btree (employee_id);


--
-- Name: idx_salary_payments_paid_on; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_salary_payments_paid_on ON public.salary_payments USING btree (paid_on DESC);


--
-- Name: idx_sessions_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_expires ON public.sessions USING btree (expires_at);


--
-- Name: idx_sessions_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_token ON public.sessions USING btree (token);


--
-- Name: idx_stock_movements_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_created ON public.stock_movements USING btree (created_at DESC);


--
-- Name: idx_stock_movements_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_item ON public.stock_movements USING btree (inventory_item_id);


--
-- Name: idx_stock_movements_item_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_item_created ON public.stock_movements USING btree (inventory_item_id, created_at DESC);


--
-- Name: idx_stock_movements_type_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_type_created ON public.stock_movements USING btree (change_type, created_at DESC);


--
-- Name: idx_suppliers_is_archived; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suppliers_is_archived ON public.suppliers USING btree (is_archived);


--
-- Name: idx_suppliers_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suppliers_name ON public.suppliers USING btree (name);


--
-- Name: idx_suppliers_normalized_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_suppliers_normalized_name ON public.suppliers USING btree (normalized_name);


--
-- Name: idx_tables_qr_token; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_tables_qr_token ON public.tables USING btree (qr_token) WHERE (qr_token IS NOT NULL);


--
-- Name: idx_tables_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tables_status ON public.tables USING btree (status);


--
-- Name: idx_wastage_log_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wastage_log_created ON public.wastage_log USING btree (created_at DESC);


--
-- Name: idx_wastage_log_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wastage_log_employee ON public.wastage_log USING btree (employee_id);


--
-- Name: idx_wastage_log_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wastage_log_item ON public.wastage_log USING btree (raw_material_id);


--
-- Name: idx_wastage_log_reason_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wastage_log_reason_created ON public.wastage_log USING btree (reason, created_at DESC);


--
-- Name: accounts accounts_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.accounts(id) ON DELETE SET NULL;


--
-- Name: bank_accounts bank_accounts_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_accounts
    ADD CONSTRAINT bank_accounts_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;


--
-- Name: bank_reconciliations bank_reconciliations_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_reconciliations
    ADD CONSTRAINT bank_reconciliations_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts(id) ON DELETE CASCADE;


--
-- Name: bank_reconciliations bank_reconciliations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_reconciliations
    ADD CONSTRAINT bank_reconciliations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: bill_corrections bill_corrections_bill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill_corrections
    ADD CONSTRAINT bill_corrections_bill_id_fkey FOREIGN KEY (bill_id) REFERENCES public.bills(id) ON DELETE CASCADE;


--
-- Name: bill_corrections bill_corrections_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill_corrections
    ADD CONSTRAINT bill_corrections_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: bill_corrections bill_corrections_journal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill_corrections
    ADD CONSTRAINT bill_corrections_journal_id_fkey FOREIGN KEY (journal_id) REFERENCES public.journal_entries(id) ON DELETE SET NULL;


--
-- Name: bill_payments bill_payments_bill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill_payments
    ADD CONSTRAINT bill_payments_bill_id_fkey FOREIGN KEY (bill_id) REFERENCES public.bills(id) ON DELETE CASCADE;


--
-- Name: bills bills_cashier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bills
    ADD CONSTRAINT bills_cashier_id_fkey FOREIGN KEY (cashier_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: bills bills_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bills
    ADD CONSTRAINT bills_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: devices devices_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: drawer_sessions drawer_sessions_closed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drawer_sessions
    ADD CONSTRAINT drawer_sessions_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: drawer_sessions drawer_sessions_drawer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drawer_sessions
    ADD CONSTRAINT drawer_sessions_drawer_id_fkey FOREIGN KEY (drawer_id) REFERENCES public.cash_drawers(id) ON DELETE CASCADE;


--
-- Name: drawer_sessions drawer_sessions_opened_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drawer_sessions
    ADD CONSTRAINT drawer_sessions_opened_by_fkey FOREIGN KEY (opened_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: expenses expenses_logged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_logged_by_fkey FOREIGN KEY (logged_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: inventory_items inventory_items_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.inventory_categories(id) ON DELETE SET NULL;


--
-- Name: inventory_items inventory_items_menu_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE SET NULL;


--
-- Name: inventory_items inventory_items_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: journal_entries journal_entries_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: journal_lines journal_lines_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_lines
    ADD CONSTRAINT journal_lines_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: journal_lines journal_lines_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_lines
    ADD CONSTRAINT journal_lines_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts(id) ON DELETE SET NULL;


--
-- Name: journal_lines journal_lines_drawer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_lines
    ADD CONSTRAINT journal_lines_drawer_id_fkey FOREIGN KEY (drawer_id) REFERENCES public.cash_drawers(id) ON DELETE SET NULL;


--
-- Name: journal_lines journal_lines_journal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_lines
    ADD CONSTRAINT journal_lines_journal_id_fkey FOREIGN KEY (journal_id) REFERENCES public.journal_entries(id) ON DELETE CASCADE;


--
-- Name: journal_lines journal_lines_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_lines
    ADD CONSTRAINT journal_lines_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: kot_items kot_items_kot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kot_items
    ADD CONSTRAINT kot_items_kot_id_fkey FOREIGN KEY (kot_id) REFERENCES public.kots(id) ON DELETE CASCADE;


--
-- Name: kots kots_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kots
    ADD CONSTRAINT kots_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: menu_item_variants menu_item_variants_menu_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_item_variants
    ADD CONSTRAINT menu_item_variants_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE CASCADE;


--
-- Name: menu_items menu_items_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.menu_categories(id);


--
-- Name: order_items order_items_menu_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE SET NULL;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: orders orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: orders orders_prepared_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_prepared_by_fkey FOREIGN KEY (prepared_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: orders orders_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.tables(id) ON DELETE SET NULL;


--
-- Name: orders orders_waiter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_waiter_id_fkey FOREIGN KEY (waiter_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: payment_settlements payment_settlements_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_settlements
    ADD CONSTRAINT payment_settlements_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts(id) ON DELETE SET NULL;


--
-- Name: payment_settlements payment_settlements_journal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_settlements
    ADD CONSTRAINT payment_settlements_journal_id_fkey FOREIGN KEY (journal_id) REFERENCES public.journal_entries(id) ON DELETE SET NULL;


--
-- Name: payment_settlements payment_settlements_settled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_settlements
    ADD CONSTRAINT payment_settlements_settled_by_fkey FOREIGN KEY (settled_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: purchase_items purchase_items_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id) ON DELETE SET NULL;


--
-- Name: purchase_items purchase_items_purchase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.purchases(id) ON DELETE CASCADE;


--
-- Name: purchases purchases_received_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_received_by_fkey FOREIGN KEY (received_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: purchases purchases_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: recipe_items recipe_items_component_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_items
    ADD CONSTRAINT recipe_items_component_recipe_id_fkey FOREIGN KEY (component_recipe_id) REFERENCES public.recipes(id) ON DELETE RESTRICT;


--
-- Name: recipe_items recipe_items_raw_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_items
    ADD CONSTRAINT recipe_items_raw_material_id_fkey FOREIGN KEY (raw_material_id) REFERENCES public.inventory_items(id) ON DELETE RESTRICT;


--
-- Name: recipe_items recipe_items_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_items
    ADD CONSTRAINT recipe_items_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE CASCADE;


--
-- Name: recipes recipes_menu_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE CASCADE;


--
-- Name: reservations reservations_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: reservations reservations_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: reservations reservations_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.tables(id) ON DELETE SET NULL;


--
-- Name: salary_payments salary_payments_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salary_payments
    ADD CONSTRAINT salary_payments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: salary_payments salary_payments_paid_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salary_payments
    ADD CONSTRAINT salary_payments_paid_by_fkey FOREIGN KEY (paid_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: stock_movements stock_movements_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id) ON DELETE SET NULL;


--
-- Name: stock_movements stock_movements_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: tables tables_current_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tables
    ADD CONSTRAINT tables_current_order_id_fkey FOREIGN KEY (current_order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: tables tables_waiter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tables
    ADD CONSTRAINT tables_waiter_id_fkey FOREIGN KEY (waiter_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: wastage_log wastage_log_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wastage_log
    ADD CONSTRAINT wastage_log_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: wastage_log wastage_log_logged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wastage_log
    ADD CONSTRAINT wastage_log_logged_by_fkey FOREIGN KEY (logged_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: wastage_log wastage_log_raw_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wastage_log
    ADD CONSTRAINT wastage_log_raw_material_id_fkey FOREIGN KEY (raw_material_id) REFERENCES public.inventory_items(id) ON DELETE SET NULL;


--
-- Name: wastage_log wastage_log_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wastage_log
    ADD CONSTRAINT wastage_log_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE SET NULL;


--
-- Migration 024: reopen paid bills + proforma (print-before-pay).
-- Kept as idempotent ALTERs so a fresh install from this file matches an
-- existing DB that has run migrations/024_reopen_bills.sql.
--

ALTER TABLE public.bill_corrections DROP CONSTRAINT IF EXISTS bill_corrections_type_check;
ALTER TABLE public.bill_corrections
    ADD CONSTRAINT bill_corrections_type_check CHECK (type IN ('void', 'refund', 'reopen'));

ALTER TABLE public.bills  ADD COLUMN IF NOT EXISTS reopened_at timestamp without time zone;
ALTER TABLE public.bills  ADD COLUMN IF NOT EXISTS reopen_count integer DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS bill_printed_at timestamp without time zone;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS reopened_from_bill_id integer;


--
-- Migration 025: table transfer / merge audit.
--

CREATE TABLE IF NOT EXISTS public.table_ops_log (
    id integer NOT NULL,
    action text NOT NULL,
    order_id integer,
    merged_order_id integer,
    from_table_id integer,
    to_table_id integer,
    reason text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT table_ops_log_action_check CHECK (action IN ('transfer', 'merge'))
);

CREATE SEQUENCE IF NOT EXISTS public.table_ops_log_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.table_ops_log_id_seq OWNED BY public.table_ops_log.id;
ALTER TABLE ONLY public.table_ops_log ALTER COLUMN id SET DEFAULT nextval('public.table_ops_log_id_seq'::regclass);
DO $$ BEGIN
  ALTER TABLE ONLY public.table_ops_log ADD CONSTRAINT table_ops_log_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR invalid_table_definition THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_table_ops_order ON public.table_ops_log USING btree (order_id);

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS merged_into_order_id integer;


--
-- PostgreSQL database dump complete
--

