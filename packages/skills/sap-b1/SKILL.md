# SAP Business One Skill

## Purpose

Query and interact with SAP Business One via Service Layer REST API.

## Available Tools

### sap_query

Run custom SQL SELECT queries against SAP B1.
Use for complex reports not covered by other tools.
NEVER use INSERT, UPDATE, DELETE — only SELECT.

### sap_get_orders

Retrieve sales orders with filters:

- status: open | closed | cancelled | all
- cardCode: customer filter (optional)
- fromDate / toDate: date range (optional)

### sap_get_stock

Check inventory levels.

- Pass itemCode for a specific item
- Pass \* to get ALL items below minimum stock level

### sap_get_partner

Get customer or vendor data by CardCode.

### sap_create_order_draft

Create a sales order draft.
⚠️ ALWAYS ask user for confirmation before calling this tool.
Tell the user exactly what will be created and wait for "yes/confirm".

## Behavior Rules

- Always present monetary values formatted (e.g. $48,320.00)
- Dates should be shown as DD/MM/YYYY in responses
- When stock is below MinLevel, flag it with ⚠️
- For drafts, always say "draft created" — never "order submitted"
- If a query returns 0 results, say so clearly
