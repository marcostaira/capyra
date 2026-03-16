# SAP Business One Skill

## Purpose

Query and interact with SAP Business One via Service Layer REST API.

## Language Rule

ALWAYS respond in the same language the user used in their message.

- User writes in Portuguese → respond in Portuguese
- User writes in English → respond in English
- Never mix languages in the same response

## Available Tools

### sap_query

Run custom SQL SELECT queries against SAP B1.
Use for complex reports not covered by other tools.
NEVER use INSERT, UPDATE, DELETE — only SELECT.
NEVER end SQL with semicolon (;) — SAP rejects it.

### sap_get_orders

Retrieve sales orders with filters:

- status: open | closed | cancelled | all
- cardCode: customer filter (optional)
- fromDate / toDate: date range (optional)
- Always order by DocNum desc to get the most recent first

### sap_get_order_lines

Get full details and line items of a specific order.

- Always use this before duplicating an order to get the real items
- Use DocEntry when available (more reliable than DocNum)

### sap_get_stock

Check inventory levels.

- Pass itemCode for a specific item
- Pass \* to get ALL items below minimum stock level

### sap_get_partner

Get customer or vendor data by CardCode.

### sap_search_partners

Search business partners by name, phone, email or tax ID.

- Use when the user mentions a name but not a CardCode
- Returns CardCode, name, phone, email

### sap_get_bp_default_series

Get the default series for creating business partners.

- Always call this before sap_create_business_partner if series is unknown
- Stores result in procedural memory as 'sap_bp_default_series'

### sap_create_order_draft

Create a sales order draft.
⚠️ ALWAYS ask user for confirmation before calling this tool.
Tell the user exactly what will be created and wait for confirmation.

### sap_get_drafts

Get sales order drafts (rascunhos) from SAP B1.

- Use this when user asks about drafts/rascunhos
- NEVER use sap_query to search drafts — use this tool instead
- NEVER answer from memory — always query SAP for current data

### sap_create_business_partner

Create a new customer, vendor or lead in SAP B1.
⚠️ ALWAYS ask user for confirmation before calling this tool.

- cardType: use 'cCustomer' for customers, 'cSupplier' for vendors, 'cLead' for leads
- ALWAYS call sap_get_bp_default_series first to get the correct series
- ALWAYS format name in Title Case: "mateus souza" → "Mateus Souza"
- After creation, always return the generated CardCode to the user

### sap_update_business_partner

Update an existing business partner.
⚠️ ALWAYS ask user for confirmation before calling this tool.

- Requires CardCode — use sap_search_partners first if only name is known
- Only send fields that need to be changed

## Brazil-specific rules

- Currency code for Brazilian Real is "R$" not "BRL"
- Always use "R$" when setting currency for Brazilian companies

## SAP B1 Document Types

| Document         | SAP Table | API Endpoint     | Description            |
| ---------------- | --------- | ---------------- | ---------------------- |
| Sales Order      | ORDR      | Orders           | Confirmed sales orders |
| Draft            | ODRF      | Drafts           | Unconfirmed drafts     |
| Delivery         | ODLN      | DeliveryNotes    | Deliveries             |
| Invoice          | OINV      | Invoices         | Sales invoices         |
| Business Partner | OCRD      | BusinessPartners | Customers/vendors      |
| Item             | OITM      | Items            | Products/inventory     |

## Behavior Rules

- ALWAYS respond in the same language as the user's message
- Always present monetary values formatted with currency symbol (e.g. R$ 1.255,00)
- Dates should be shown as DD/MM/YYYY in responses
- When stock is below MinLevel, flag it with ⚠️
- For drafts, always say "rascunho criado" (PT) or "draft created" (EN)
- If a query returns 0 results, say so clearly
- When duplicating an order, ALWAYS call sap_get_order_lines first — NEVER invent item codes
- "pedido" or "order" = confirmed document → use Orders endpoint (ORDR)
- "rascunho" or "draft" = unconfirmed → use Drafts endpoint (ODRF)
- When user mentions a customer by name (not code), use sap_search_partners first
- Never expose internal SAP error messages to the user — translate them to friendly language
- For write operations, always summarize what will be done and wait for confirmation
- After any creation or update, confirm what was done with the key identifiers (DocNum, CardCode, etc)
