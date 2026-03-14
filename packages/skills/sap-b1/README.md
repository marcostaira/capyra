# @capyra/skill-sap-b1

SAP Business One connector for Capyra via Service Layer REST API.

## Requirements

- SAP B1 9.3 or higher
- Service Layer enabled on your B1 server
- Network access from Capyra host to SAP server port 50000

## Configuration

Add to your `capyra.config.yml`:

```yaml
skills:
  sap-b1:
    baseUrl: https://your-server:50000/b1s/v1
    companyDB: YOUR_COMPANY_DB
    username: manager
    password: your-password
    verifySsl: false
```

## Test connection

```bash
capyra skill test sap-b1
```

## Available tools

| Tool                     | Description                            |
| ------------------------ | -------------------------------------- |
| `sap_query`              | Run SQL SELECT queries                 |
| `sap_get_orders`         | List sales orders with filters         |
| `sap_get_stock`          | Check inventory levels                 |
| `sap_get_partner`        | Get customer/vendor data               |
| `sap_create_order_draft` | Create order draft (with confirmation) |

## Security notes

- Credentials are stored locally in your config file
- Service Layer sessions expire after 30 minutes — Capyra handles renewal automatically
- `sap_query` only allows SELECT statements
- Write operations always require user confirmation via `sap_create_order_draft`
