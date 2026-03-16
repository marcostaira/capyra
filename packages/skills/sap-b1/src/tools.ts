import { SapB1Client } from "./client.js";
import {
  SapB1Config,
  SapDocument,
  SapItem,
  SapBusinessPartner,
} from "./types.js";

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (
    params: Record<string, unknown>,
    client: SapB1Client,
  ) => Promise<unknown>;
}

export const tools: Tool[] = [
  {
    name: "sap_query",
    description:
      "Run a read-only SQL query against SAP Business One. Use for custom reports and data not covered by other tools.",
    parameters: {
      type: "object",
      properties: {
        sql: {
          type: "string",
          description: "SQL SELECT query. Only SELECT statements are allowed.",
        },
      },
      required: ["sql"],
    },
    execute: async ({ sql }, client) => {
      if (typeof sql !== "string") throw new Error("sql must be a string");
      const upper = sql.trim().toUpperCase();
      if (!upper.startsWith("SELECT")) {
        throw new Error("Only SELECT queries are allowed in sap_query");
      }
      return client.query(sql as string);
    },
  },

  {
    name: "sap_get_orders",
    description:
      "Get sales orders from SAP B1. Filter by status, date range or customer.",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["open", "closed", "cancelled", "all"],
          description: "Order status filter",
        },
        cardCode: {
          type: "string",
          description: "Customer code (optional)",
        },
        fromDate: {
          type: "string",
          description: "Start date YYYY-MM-DD (optional)",
        },
        toDate: {
          type: "string",
          description: "End date YYYY-MM-DD (optional)",
        },
        top: {
          type: "number",
          description: "Max results, default 20",
        },
      },
      required: ["status"],
    },
    execute: async (
      { status, cardCode, fromDate, toDate, top = 20 },
      client,
    ) => {
      const filters: string[] = [];

      if (status === "open") filters.push("DocumentStatus eq 'bost_Open'");
      if (status === "closed") filters.push("DocumentStatus eq 'bost_Close'");
      if (status === "cancelled") filters.push("Cancelled eq 'tYES'");
      if (cardCode) filters.push(`CardCode eq '${cardCode}'`);
      if (fromDate) filters.push(`DocDate ge '${fromDate}'`);
      if (toDate) filters.push(`DocDate le '${toDate}'`);

      const params: Record<string, string> = {
        $top: String(top),
        $orderby: "DocEntry desc",
        $select:
          "DocEntry,DocNum,CardCode,CardName,DocDate,DocDueDate,DocTotal,DocumentStatus",
      };

      if (filters.length > 0) {
        params["$filter"] = filters.join(" and ");
      }

      return client.get<{ value: SapDocument[] }>("Orders", params);
    },
  },

  {
    name: "sap_get_order_lines",
    description:
      "Get the full details and lines of a specific sales order by DocEntry or DocNum.",
    parameters: {
      type: "object",
      properties: {
        docEntry: {
          type: "number",
          description:
            "DocEntry of the order (preferred, use this if available)",
        },
        docNum: {
          type: "number",
          description: "DocNum of the order (human-readable number)",
        },
      },
    },
    execute: async ({ docEntry, docNum }, client) => {
      if (docEntry) {
        return client.get<SapDocument>(`Orders(${docEntry})`, {
          $select:
            "DocEntry,DocNum,CardCode,CardName,DocDate,DocDueDate,DocTotal,Comments,DocumentLines",
        });
      }

      // busca pelo DocNum
      const result = await client.get<{ value: SapDocument[] }>("Orders", {
        $filter: `DocNum eq ${docNum}`,
        $select:
          "DocEntry,DocNum,CardCode,CardName,DocDate,DocDueDate,DocTotal,Comments,DocumentLines",
        $top: "1",
      });

      return result.value?.[0] ?? null;
    },
  },

  {
    name: "sap_get_stock",
    description: "Check current stock level for one or more items in SAP B1.",
    parameters: {
      type: "object",
      properties: {
        itemCode: {
          type: "string",
          description: "Item code. Use * to get all items below minimum stock.",
        },
      },
      required: ["itemCode"],
    },
    execute: async ({ itemCode }, client) => {
      if (itemCode === "*") {
        return client.get<{ value: SapItem[] }>("Items", {
          $filter: "OnHand le MinLevel and InventoryItem eq 'tYES'",
          $select: "ItemCode,ItemName,OnHand,IsCommited,OnOrder,MinLevel",
          $top: "50",
        });
      }
      return client.get<SapItem>(`Items('${itemCode}')`, {
        $select: "ItemCode,ItemName,OnHand,IsCommited,OnOrder,MinLevel",
      });
    },
  },

  {
    name: "sap_get_partner",
    description: "Get business partner (customer or vendor) data from SAP B1.",
    parameters: {
      type: "object",
      properties: {
        cardCode: {
          type: "string",
          description: "Business partner code",
        },
      },
      required: ["cardCode"],
    },
    execute: async ({ cardCode }, client) => {
      return client.get<SapBusinessPartner>(`BusinessPartners('${cardCode}')`, {
        $select: [
          "CardCode",
          "CardName",
          "CardType",
          "Phone1",
          "Phone2",
          "Cellular",
          "EmailAddress",
          "Website",
          "ContactPerson",
          "Notes",
          "FederalTaxID",
          "VatLiable",
          "Currency",
          "PriceListNum",
          "PayTermsGrpCode",
          "CreditLimit",
          "GroupCode",
          "CreateDate",
          "UpdateDate",
          "Frozen",
        ].join(","),
      });
    },
  },

  {
    name: "sap_search_partners",
    description: "Search business partners by name, phone, email or tax ID.",
    parameters: {
      type: "object",
      properties: {
        search: {
          type: "string",
          description: "Search term — matches against name, phone or email",
        },
        cardType: {
          type: "string",
          enum: ["cCustomer", "cSupplier", "cLead", "all"],
          description: "Filter by type (optional, default all)",
        },
        top: {
          type: "number",
          description: "Max results, default 10",
        },
      },
      required: ["search"],
    },
    execute: async ({ search, cardType = "all", top = 10 }, client) => {
      const filters: string[] = [
        `(contains(CardName,'${search}') or contains(Phone1,'${search}') or contains(EmailAddress,'${search}') or contains(FederalTaxID,'${search}'))`,
      ];
      if (cardType !== "all") filters.push(`CardType eq '${cardType}'`);

      return client.get<{ value: SapBusinessPartner[] }>("BusinessPartners", {
        $select:
          "CardCode,CardName,CardType,Phone1,Cellular,EmailAddress,FederalTaxID,Frozen",
        $filter: filters.join(" and "),
        $top: String(top),
        $orderby: "CardName asc",
      });
    },
  },

  {
    name: "sap_create_order_draft",
    description:
      "Create a sales order draft in SAP B1. Always confirm with user before calling this tool.",
    parameters: {
      type: "object",
      properties: {
        cardCode: {
          type: "string",
          description: "Customer code",
        },
        items: {
          type: "array",
          description: "Order lines",
          items: {
            type: "object",
            properties: {
              itemCode: { type: "string" },
              quantity: { type: "number" },
              price: { type: "number" },
            },
            required: ["itemCode", "quantity"],
          },
        },
        comments: {
          type: "string",
          description: "Order notes (optional)",
        },
      },
      required: ["cardCode", "items"],
    },
    execute: async ({ cardCode, items, comments }, client) => {
      return client.post("Drafts", {
        DocObjectCode: 17,
        CardCode: cardCode,
        Comments: comments ?? "Created by Capyra",
        DocumentLines: (
          items as Array<{ itemCode: string; quantity: number; price?: number }>
        ).map((i) => ({
          ItemCode: i.itemCode,
          Quantity: i.quantity,
          ...(i.price ? { UnitPrice: i.price } : {}),
        })),
      });
    },
  },

  {
    name: "sap_get_bp_default_series",
    description:
      "Get the default series for creating business partners in SAP B1. Call this before sap_create_business_partner if the series is not known.",
    parameters: {
      type: "object",
      properties: {
        cardType: {
          type: "string",
          enum: ["cCustomer", "cSupplier", "cLead"],
          description: "Type of business partner",
        },
      },
      required: ["cardType"],
    },
    execute: async ({ cardType }, client) => {
      const result = await client.get<{
        value: Array<{ CardCode: string; Series: number }>;
      }>("BusinessPartners", {
        $select: "CardCode,Series",
        $top: "1",
        $orderby: "CreateDate desc",
        $filter: `CardType eq '${cardType}' and Series ne 1`,
      });

      const series = result.value?.[0]?.Series;
      if (!series) {
        return {
          series: null,
          message: "Could not determine default series. Please ask the user.",
        };
      }
      return { series, message: `Default series for ${cardType} is ${series}` };
    },
  },

  {
    name: "sap_create_business_partner",
    description:
      "Create a new customer, vendor or lead in SAP B1. Always confirm with user before calling this tool.",
    parameters: {
      type: "object",
      properties: {
        cardName: {
          type: "string",
          description: "Full name (Title Case will be applied automatically)",
        },
        cardType: {
          type: "string",
          enum: ["cCustomer", "cSupplier", "cLead"],
          description: "cCustomer, cSupplier or cLead",
        },
        phone1: { type: "string", description: "Main phone" },
        phone2: { type: "string", description: "Secondary phone" },
        cellular: { type: "string", description: "Mobile phone" },
        emailAddress: { type: "string", description: "Email address" },
        website: { type: "string", description: "Website URL" },
        contactPerson: { type: "string", description: "Contact person name" },
        federalTaxID: { type: "string", description: "CPF or CNPJ" },
        vatLiable: {
          type: "string",
          enum: ["vLiable", "vExempt"],
          description: "Tax liable status",
        },
        currency: {
          type: "string",
          description: "Currency code e.g. BRL, USD",
        },
        creditLimit: { type: "number", description: "Credit limit" },
        priceListNum: { type: "number", description: "Price list number" },
        payTermsGrpCode: {
          type: "number",
          description: "Payment terms group code",
        },
        groupCode: { type: "number", description: "BP group code" },
        notes: { type: "string", description: "Additional notes" },
        billToStreet: { type: "string", description: "Billing address street" },
        billToCity: { type: "string", description: "Billing address city" },
        billToState: {
          type: "string",
          description: "Billing address state code e.g. SP, PR",
        },
        billToZipCode: {
          type: "string",
          description: "Billing address zip code",
        },
        billToCountry: {
          type: "string",
          description: "Billing address country code e.g. BR",
        },
        series: {
          type: "number",
          description:
            "SAP series number — use sap_get_bp_default_series if unknown",
        },
      },
      required: ["cardName", "cardType"],
    },
    execute: async (params, client) => {
      const p = params as Record<string, unknown>;

      const body: Record<string, unknown> = {
        CardName: toTitleCase(p.cardName as string),
        CardType: p.cardType,
        Series: p.series ?? 56,
      };

      const fieldMap: Record<string, string> = {
        phone1: "Phone1",
        phone2: "Phone2",
        cellular: "Cellular",
        emailAddress: "EmailAddress",
        website: "Website",
        contactPerson: "ContactPerson",
        federalTaxID: "FederalTaxID",
        vatLiable: "VatLiable",
        currency: "Currency",
        creditLimit: "CreditLimit",
        priceListNum: "PriceListNum",
        payTermsGrpCode: "PayTermsGrpCode",
        groupCode: "GroupCode",
        notes: "Notes",
        billToStreet: "BillToStreet",
        billToCity: "BillToCity",
        billToState: "BillToState",
        billToZipCode: "BillToZipCode",
        billToCountry: "BillToCountry",
      };

      for (const [key, sapKey] of Object.entries(fieldMap)) {
        if (p[key] !== undefined && p[key] !== null && p[key] !== "") {
          body[sapKey] = p[key];
        }
      }

      return client.post("BusinessPartners", body);
    },
  },

  {
    name: "sap_update_business_partner",
    description:
      "Update an existing business partner in SAP B1. Always confirm with user before calling this tool.",
    parameters: {
      type: "object",
      properties: {
        cardCode: {
          type: "string",
          description: "Business partner code to update (required)",
        },
        cardName: {
          type: "string",
          description: "New name (Title Case applied automatically)",
        },
        phone1: { type: "string", description: "Main phone" },
        phone2: { type: "string", description: "Secondary phone" },
        cellular: { type: "string", description: "Mobile phone" },
        emailAddress: { type: "string", description: "Email address" },
        website: { type: "string", description: "Website URL" },
        contactPerson: { type: "string", description: "Contact person name" },
        federalTaxID: { type: "string", description: "CPF or CNPJ" },
        vatLiable: {
          type: "string",
          enum: ["vLiable", "vExempt"],
          description: "Tax liable status",
        },
        currency: {
          type: "string",
          description: "Currency code e.g. BRL, USD",
        },
        creditLimit: { type: "number", description: "Credit limit" },
        priceListNum: { type: "number", description: "Price list number" },
        payTermsGrpCode: {
          type: "number",
          description: "Payment terms group code",
        },
        groupCode: { type: "number", description: "BP group code" },
        notes: { type: "string", description: "Additional notes" },
        frozen: {
          type: "string",
          enum: ["tYES", "tNO"],
          description: "Freeze or unfreeze the BP",
        },
        billToStreet: { type: "string", description: "Billing address street" },
        billToCity: { type: "string", description: "Billing address city" },
        billToState: {
          type: "string",
          description: "Billing address state code e.g. SP, PR",
        },
        billToZipCode: {
          type: "string",
          description: "Billing address zip code",
        },
        billToCountry: {
          type: "string",
          description: "Billing address country code e.g. BR",
        },
      },
      required: ["cardCode"],
    },
    execute: async (params, client) => {
      const p = params as Record<string, unknown>;
      const cardCode = p.cardCode as string;

      const body: Record<string, unknown> = {};

      if (p.cardName) body.CardName = toTitleCase(p.cardName as string);

      const fieldMap: Record<string, string> = {
        phone1: "Phone1",
        phone2: "Phone2",
        cellular: "Cellular",
        emailAddress: "EmailAddress",
        website: "Website",
        contactPerson: "ContactPerson",
        federalTaxID: "FederalTaxID",
        vatLiable: "VatLiable",
        currency: "Currency",
        creditLimit: "CreditLimit",
        priceListNum: "PriceListNum",
        payTermsGrpCode: "PayTermsGrpCode",
        groupCode: "GroupCode",
        notes: "Notes",
        frozen: "Frozen",
        billToStreet: "BillToStreet",
        billToCity: "BillToCity",
        billToState: "BillToState",
        billToZipCode: "BillToZipCode",
        billToCountry: "BillToCountry",
      };

      for (const [key, sapKey] of Object.entries(fieldMap)) {
        if (p[key] !== undefined && p[key] !== null && p[key] !== "") {
          body[sapKey] = p[key];
        }
      }

      if (Object.keys(body).length === 0) {
        throw new Error("No fields to update provided");
      }

      await client.patch("BusinessPartners", `'${cardCode}'`, body);
      return { success: true, cardCode, updated: Object.keys(body) };
    },
  },

  {
    name: "sap_get_drafts",
    description: "Get sales order drafts from SAP B1.",
    parameters: {
      type: "object",
      properties: {
        top: {
          type: "number",
          description: "Max results, default 10",
        },
        cardCode: {
          type: "string",
          description: "Filter by customer code (optional)",
        },
      },
    },
    execute: async ({ top = 10, cardCode }, client) => {
      const params: Record<string, string> = {
        $select:
          "DocEntry,DocNum,CardCode,CardName,DocDate,DocTotal,DocumentStatus",
        $filter: "DocObjectCode eq 'oOrders'",
        $orderby: "DocEntry desc",
        $top: String(top),
      };

      if (cardCode) {
        params.$filter += ` and CardCode eq '${cardCode}'`;
      }

      return client.get<{ value: SapDocument[] }>("Drafts", params);
    },
  },
];

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
