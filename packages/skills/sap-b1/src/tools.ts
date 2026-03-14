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
        $orderby: "DocDate desc",
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
        $select: "CardCode,CardName,CardType,Balance,Phone1,EmailAddress",
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
];
